import type { IpcMain, BrowserWindow } from 'electron';
import { UninstallManager } from '../../core/uninstall/UninstallManager.js';
import type { UninstallOptions } from '../../core/uninstall/UninstallManager.js';

export function registerUninstallIpc(ipc: IpcMain, win: BrowserWindow | null) {
  const emit = (e: unknown) => win?.webContents.send('installer:progress', e);

  ipc.handle('uninstall:run', async (_, opts: UninstallOptions) => {
    const mgr = new UninstallManager();
    await mgr.uninstall(opts, emit as any);
    return { ok: true };
  });
}
