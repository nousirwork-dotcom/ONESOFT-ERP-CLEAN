import * as path from 'path';
import { randomBytes } from 'node:crypto';
import { APP_VERSION } from '../version.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { UpgradeManager } from './UpgradeManager.js';
import type { DatabaseConnectionOptions, OneSoftConfig, ProgressEvent } from '../types.js';

function connectionString(db: DatabaseConnectionOptions): string {
  return [
    'postgresql://',
    encodeURIComponent(db.user),
    ':',
    encodeURIComponent(db.password),
    '@',
    db.host,
    ':',
    db.port,
    '/',
    encodeURIComponent(db.database),
  ].join('');
}

function emit(event: ProgressEvent): void {
  const prefix = `[upgrade-core] ${event.level.toUpperCase()}`;
  console.log(`${prefix} ${event.message}`);
}

function resourcesPath(): string {
  const electronProcess = process as NodeJS.Process & { resourcesPath?: string };
  return electronProcess.resourcesPath ?? path.resolve(process.cwd(), 'resources');
}

function runtimePassword(): string {
  return randomBytes(24).toString('base64url');
}

function buildUpgradeOptions(config: OneSoftConfig): {
  serverAppPath: string;
  backupsDir: string;
  dbOpts: DatabaseConnectionOptions;
  databaseUrl: string;
  targetVersion: string;
  backendPort: number;
  adminDbOpts?: DatabaseConnectionOptions;
  forceRoleProvision: boolean;
} {
  const db = config.database;
  const isRuntimeRole = db.user === 'onesoft_app';
  const legacyAdminUser = db.adminUser?.trim() || (!isRuntimeRole ? db.user : '');
  const legacyAdminPassword = db.adminPassword || (!isRuntimeRole ? db.password : '');
  const appPassword = isRuntimeRole ? db.password : runtimePassword();
  const dbOpts: DatabaseConnectionOptions = {
    host: db.host,
    port: db.port,
    database: db.name,
    user: 'onesoft_app',
    password: appPassword,
  };

  const adminDbOpts =
    legacyAdminUser && legacyAdminPassword
      ? {
          ...dbOpts,
          user: legacyAdminUser,
          password: legacyAdminPassword,
        }
      : undefined;

  return {
    serverAppPath: path.join(resourcesPath(), 'app', 'server-app'),
    backupsDir: config.paths.backups,
    dbOpts,
    databaseUrl: connectionString(dbOpts),
    targetVersion: APP_VERSION,
    backendPort: config.server.backendPort,
    adminDbOpts,
    forceRoleProvision: !isRuntimeRole,
  };
}

/**
 * Shared non-UI entrypoint used by NSIS upgrades.
 *
 * Both a manually launched installer and electron-updater eventually execute
 * the same NSIS customInstall macro, which invokes the packaged Electron
 * process with --run-upgrade-core. Keeping the adapter here means those
 * installers cannot accidentally grow a second migration implementation.
 */
export async function runHeadlessUpgrade(): Promise<number> {
  if (!ConfigManager.exists()) {
    console.error('[upgrade-core] existing installation config was not found');
    return 2;
  }

  try {
    const config = ConfigManager.load();
    const upgradeOptions = buildUpgradeOptions(config);

    const result = await new UpgradeManager().upgrade(
      upgradeOptions,
      emit,
      (status) => console.log(`[upgrade-core] status=${status}`),
    );

    return result.success ? 0 : 1;
  } catch (error) {
    console.error(
      '[upgrade-core] fatal:',
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}