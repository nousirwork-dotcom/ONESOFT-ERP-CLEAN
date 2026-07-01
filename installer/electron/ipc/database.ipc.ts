import type { IpcMain, BrowserWindow } from 'electron';
import { ConnectionTester, DatabaseInstaller, MigrationRunner } from '../../core/index.js';
import type { DatabaseConnectionOptions } from '../../core/types.js';
import * as path from 'path';

const tester = new ConnectionTester();

export function registerDatabaseIpc(ipc: IpcMain, win: BrowserWindow | null) {
  const emit = (e: unknown) => win?.webContents.send('installer:progress', e);

  ipc.handle('database:test-connection', async (_, opts: DatabaseConnectionOptions) => {
    return tester.test(opts);
  });

  ipc.handle('database:create', async (_, opts: {
    adminOpts: DatabaseConnectionOptions;
    dbName: string;
    appUser: string;
    appPassword: string;
  }) => {
    const installer = new DatabaseInstaller();
    await installer.createDatabase(opts.adminOpts, opts.dbName, opts.appUser, opts.appPassword, emit as any);
    return { ok: true };
  });

  ipc.handle('database:migrate', async (_, databaseUrl: string) => {
    // البحث عن server-app بالنسبة لمجلد التثبيت
    const serverAppPath = path.join(process.resourcesPath ?? process.cwd(), '..', 'server-app');
    const runner = new MigrationRunner(serverAppPath);
    return runner.runMigrations(databaseUrl, emit as any);
  });
}
