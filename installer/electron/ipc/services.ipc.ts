import type { IpcMain, BrowserWindow } from 'electron';
import { ServiceManager } from '../../core/index.js';
import type { ServiceName, DeploymentType, AccessMode } from '../../core/types.js';

const mgr = new ServiceManager();

export function registerServicesIpc(ipc: IpcMain, win: BrowserWindow | null) {
  const emit = (e: unknown) => win?.webContents.send('installer:progress', e);

  ipc.handle('services:install', async (_, opts: {
    installDir:     string;
    logsDir:        string;
    deploymentType: DeploymentType;
    accessModes:    AccessMode[];
  }) => {
    // تمرير process.resourcesPath لتحديد المسار الحقيقي لملفات التطبيق داخل حزمة Electron
    await mgr.installAll({
      ...opts,
      resourcesPath: process.resourcesPath ?? '',
    }, emit as any);
    return { ok: true };
  });

  ipc.handle('services:status',  (_, name: ServiceName) => mgr.getStatus(name));
  ipc.handle('services:start',   (_, name: ServiceName) => mgr.start(name));
  ipc.handle('services:stop',    (_, name: ServiceName) => mgr.stop(name));
  ipc.handle('services:restart', (_, name: ServiceName) => mgr.restart(name));
}
