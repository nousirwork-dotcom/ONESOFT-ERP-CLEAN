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

function defaultBackupsPath(): string {
  const programData = process.env['PROGRAMDATA'] ?? process.env['ProgramData'] ?? 'C:\\ProgramData';
  return path.join(programData, 'OneSoft', 'Backups');
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
    // v1.0.0 configs predate the structured `paths` block. Keep the
    // headless adapter usable for those real legacy installations.
    backupsDir: config.paths?.backups ?? defaultBackupsPath(),
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
export async function runHeadlessUpgrade(
  onError?: (message: string) => void,
  onProgress?: (event: ProgressEvent) => void,
  onStatus?: (status: string) => void,
): Promise<number> {
  if (!ConfigManager.exists()) {
    const message = `existing installation config was not found: ${ConfigManager.getConfigPath()}`;
    console.error(`[upgrade-core] ${message}`);
    onError?.(message);
    return 2;
  }

  try {
    const config = ConfigManager.load();
    const upgradeOptions = buildUpgradeOptions(config);

    const result = await new UpgradeManager().upgrade(
      upgradeOptions,
      (event) => {
        emit(event);
        onProgress?.(event);
      },
      (status) => {
        console.log(`[upgrade-core] status=${status}`);
        onStatus?.(status);
      },
    );

    return result.success ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[upgrade-core] fatal:', message);
    onError?.(`fatal: ${message}`);
    return 1;
  }
}