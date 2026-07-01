import type { IpcMain, BrowserWindow } from 'electron';
import { DirectoryCreator, ShortcutCreator } from '../../core/index.js';
import type { PathsConfig } from '../../core/types.js';

export function registerFilesystemIpc(ipc: IpcMain, win: BrowserWindow | null) {
  const emit = (e: unknown) => win?.webContents.send('installer:progress', e);

  ipc.handle('fs:create-dirs', (_, paths: PathsConfig) => {
    const creator = new DirectoryCreator();
    creator.create(paths, emit as any);
    return { ok: true };
  });

  ipc.handle('fs:create-shortcuts', (_, opts: {
    targetPath: string;
    iconPath: string;
    installDir: string;
  }) => {
    const creator = new ShortcutCreator();
    creator.create(opts, emit as any);
    return { ok: true };
  });
}
