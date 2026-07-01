import type { IpcMain } from 'electron';
import { ConfigManager } from '../../core/index.js';
import type { OneSoftConfig } from '../../core/types.js';

export function registerConfigIpc(ipc: IpcMain, _win: unknown) {
  ipc.handle('config:get', () => {
    if (ConfigManager.exists()) return ConfigManager.load();
    return null;
  });

  ipc.handle('config:save', (_, cfg: OneSoftConfig) => {
    ConfigManager.save(cfg);
    return { ok: true };
  });
}
