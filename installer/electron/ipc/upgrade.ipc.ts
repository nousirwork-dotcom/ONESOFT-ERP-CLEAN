import type { IpcMain, BrowserWindow } from 'electron';
import { VersionDetector, UpgradeManager, RollbackManager } from '../../core/index.js';
import { MigrationCredentialStore } from '../../core/security/MigrationCredentialStore.js';
import type { DatabaseConnectionOptions } from '../../core/types.js';
import * as path from 'path';

export function registerUpgradeIpc(
  ipc: IpcMain,
  win: BrowserWindow | null,
  onCompleted?: (success: boolean) => void,
) {
  const emit = (e: unknown) => win?.webContents.send('installer:progress', e);

  ipc.handle('upgrade:detect', () => {
    const detector = new VersionDetector();
    return detector.detect();
  });
  ipc.handle('upgrade:has-credential', () => MigrationCredentialStore.load() !== null);

  ipc.handle('upgrade:run', async (_, opts: {
    backupsDir: string;
    dbOpts: DatabaseConnectionOptions;
    databaseUrl: string;
    targetVersion: string;
    backendPort?: number;
    adminDbOpts?: DatabaseConnectionOptions;
    forceRoleProvision?: boolean;
  }) => {
    // ✅ المسار الصحيح في حزمة electron-builder: resources/app/server-app
    const serverAppPath = path.join(process.resourcesPath ?? process.cwd(), 'app', 'server-app');
    const mgr = new UpgradeManager();
    const result = await mgr.upgrade({ serverAppPath, ...opts }, emit as any, (status) => {
      win?.webContents.send('installer:progress', { level: 'info', message: `status:${status}`, timestamp: new Date().toISOString() });
    });
    onCompleted?.(result.success);
    return result;
  });

  ipc.handle('upgrade:rollback', async (_, opts: {
    backupDir: string;
    dbOpts: DatabaseConnectionOptions;
  }) => {
    const mgr = new RollbackManager();
    return mgr.rollback(opts, emit as any);
  });
}
