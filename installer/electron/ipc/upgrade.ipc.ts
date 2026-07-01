import type { IpcMain, BrowserWindow } from 'electron';
import { VersionDetector, UpgradeManager, RollbackManager } from '../../core/index.js';
import type { DatabaseConnectionOptions } from '../../core/types.js';
import * as path from 'path';

export function registerUpgradeIpc(ipc: IpcMain, win: BrowserWindow | null) {
  const emit = (e: unknown) => win?.webContents.send('installer:progress', e);

  ipc.handle('upgrade:detect', () => {
    const detector = new VersionDetector();
    return detector.detect();
  });

  ipc.handle('upgrade:run', async (_, opts: {
    backupsDir: string;
    dbOpts: DatabaseConnectionOptions;
    databaseUrl: string;
    targetVersion: string;
  }) => {
    // ✅ المسار الصحيح في حزمة electron-builder: resources/app/server-app
    const serverAppPath = path.join(process.resourcesPath ?? process.cwd(), 'app', 'server-app');
    const mgr = new UpgradeManager();
    return mgr.upgrade({ serverAppPath, ...opts }, emit as any, (status) => {
      win?.webContents.send('installer:progress', { level: 'info', message: `status:${status}`, timestamp: new Date().toISOString() });
    });
  });

  ipc.handle('upgrade:rollback', async (_, opts: {
    backupDir: string;
    dbOpts: DatabaseConnectionOptions;
  }) => {
    const mgr = new RollbackManager();
    await mgr.rollback(opts, emit as any);
    return { ok: true };
  });
}
