import type { IpcMain, BrowserWindow } from 'electron';
import { VersionDetector, UpgradeManager, RollbackManager } from '../../core/index.js';
import { preflightDatabase, safeMigrationError } from '../../core/database/DatabasePreflight.js';
import { MigrationCredentialStore } from '../../core/security/MigrationCredentialStore.js';
import type { DatabaseConnectionOptions } from '../../core/types.js';
import * as fs from 'fs';
import * as path from 'path';

type UpgradePreflightOptions = Pick<DatabaseConnectionOptions, 'host' | 'port' | 'database'>;

function readMigrationTags(serverAppPath: string): string[] {
  const journalPath = path.join(serverAppPath, 'drizzle', 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
    entries?: Array<{ tag: string }>;
  };
  return (journal.entries ?? []).map((entry) => entry.tag);
}

export function registerUpgradeIpc(
  ipc: IpcMain,
  win: BrowserWindow | null,
  onCompleted?: (success: boolean) => void,
  onDiagnostic?: (message: string) => void,
) {
  const emit = (e: unknown) => win?.webContents.send('installer:progress', e);

  ipc.handle('upgrade:detect', () => {
    const detector = new VersionDetector();
    return detector.detect();
  });
  ipc.handle('upgrade:has-credential', () => MigrationCredentialStore.load() !== null);

  ipc.handle('upgrade:preflight', async (_, opts: UpgradePreflightOptions) => {
    const storedCredential = MigrationCredentialStore.load();
    if (!storedCredential) {
      return {
        migrationCredentialValid: false,
        needsAdminCredential: true,
        ownershipDriftCount: 0,
      };
    }

    try {
      // Use the configured target database while keeping the protected
      // migration password in the main process. The renderer receives only
      // the decision and a count, never the credential or ownership details.
      const credential = {
        ...storedCredential,
        host: opts.host,
        port: opts.port,
        database: opts.database,
      };
      const serverAppPath = path.join(process.resourcesPath ?? process.cwd(), 'app', 'server-app');
      const result = await preflightDatabase(credential, readMigrationTags(serverAppPath));
      if (!result.ok) {
        return {
          migrationCredentialValid: true,
          needsAdminCredential: false,
          ownershipDriftCount: 0,
          error: safeMigrationError(result.error ?? 'تعذر فحص قاعدة البيانات قبل الترقية'),
        };
      }

      const needsAdminCredential =
        result.ownershipDrift.length > 0
        || !result.migratorRoleExists
        || !result.schemaOwnerRoleExists
        || !result.canSetSchemaOwner;

      return {
        migrationCredentialValid: true,
        needsAdminCredential,
        ownershipDriftCount: result.ownershipDrift.length,
      };
    } catch (error: unknown) {
      return {
        migrationCredentialValid: true,
        needsAdminCredential: false,
        ownershipDriftCount: 0,
        error: safeMigrationError(error),
      };
    }
  });

  ipc.handle('upgrade:run', async (_, opts: {
    backupsDir: string;
    dbOpts: DatabaseConnectionOptions;
    databaseUrl: string;
    targetVersion: string;
    backendPort?: number;
    adminDbOpts?: DatabaseConnectionOptions;
    forceRoleProvision?: boolean;
  }) => {
    onDiagnostic?.(`upgrade:run received targetVersion=${opts.targetVersion} database=${opts.dbOpts.database} adminUser=${opts.adminDbOpts?.user ?? 'none'}`);
    // ✅ المسار الصحيح في حزمة electron-builder: resources/app/server-app
    const serverAppPath = path.join(process.resourcesPath ?? process.cwd(), 'app', 'server-app');
    const mgr = new UpgradeManager();
    try {
      const result = await mgr.upgrade({ serverAppPath, ...opts }, emit as any, (status) => {
        win?.webContents.send('installer:progress', { level: 'info', message: `status:${status}`, timestamp: new Date().toISOString() });
      });
      onDiagnostic?.(`upgrade:run completed success=${result.success} stage=${result.stage ?? 'none'} migration=${result.migration ?? 'none'}`);
      onCompleted?.(result.success);
      return result;
    } catch (error: unknown) {
      onDiagnostic?.(`upgrade:run rejected ${safeMigrationError(error)}`);
      throw error;
    }
  });

  ipc.handle('upgrade:rollback', async (_, opts: {
    backupDir: string;
    dbOpts: DatabaseConnectionOptions;
  }) => {
    const mgr = new RollbackManager();
    return mgr.rollback(opts, emit as any);
  });
}
