import type { IpcMain, BrowserWindow } from 'electron';
import { DirectoryCreator, ShortcutCreator, RegistryWriter } from '../../core/index.js';
import type { PathsConfig } from '../../core/types.js';

export function registerFilesystemIpc(ipc: IpcMain, win: BrowserWindow | null) {
  const emit = (e: unknown) => win?.webContents.send('installer:progress', e);

  ipc.handle('fs:create-dirs', (_, paths: PathsConfig) => {
    const creator = new DirectoryCreator();
    creator.create(paths, emit as any);
    return { ok: true };
  });

  ipc.handle('fs:create-shortcuts', async (_, opts: {
    installDir: string;
    appExe: string;
    iconPath: string;
  }) => {
    const creator = new ShortcutCreator();
    await creator.createAll(opts, emit as any);
    return { ok: true };
  });

  ipc.handle('fs:write-registry', (_, opts: {
    installDir: string;
    version: string;
    uninstallExe: string;
    iconPath: string;
    sizeKB: number;
  }) => {
    const rw = new RegistryWriter();
    rw.write({
      displayName: 'OneSoft ERP',
      displayVersion: opts.version,
      publisher: 'OneSoft',
      installLocation: opts.installDir,
      uninstallString: opts.uninstallExe,
      displayIcon: opts.iconPath,
      estimatedSizeKB: opts.sizeKB,
    }, emit as any);
    return { ok: true };
  });
}
