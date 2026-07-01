import type { IpcMain, BrowserWindow } from 'electron';
import { OrganizationCreator, UserCreator, AccountSeeder } from '../../core/index.js';
import type { OrganizationSetup, FirstUserSetup } from '../../core/types.js';
import * as path from 'path';

export function registerSetupIpc(ipc: IpcMain, win: BrowserWindow | null) {
  const emit = (e: unknown) => win?.webContents.send('installer:progress', e);

  ipc.handle('setup:create-org', async (_, opts: { databaseUrl: string; org: OrganizationSetup }) => {
    const creator = new OrganizationCreator();
    return creator.create(opts.databaseUrl, opts.org, emit as any);
  });

  ipc.handle('setup:create-user', async (_, opts: {
    databaseUrl: string;
    orgId: number;
    user: FirstUserSetup;
  }) => {
    const creator = new UserCreator();
    return creator.create(opts.databaseUrl, opts.orgId, opts.user, emit as any);
  });

  ipc.handle('setup:seed-accounts', async (_, databaseUrl: string) => {
    const serverAppPath = path.join(process.resourcesPath ?? process.cwd(), '..', 'server-app');
    const seeder = new AccountSeeder(serverAppPath);
    await seeder.seed(databaseUrl, emit as any);
    return { ok: true };
  });
}
