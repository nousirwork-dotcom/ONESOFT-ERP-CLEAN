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
    databaseUrl?:   string;
    backendPort?:   number;
    frontendPort?:  number;
  }) => {
    const result = await mgr.installAll({
      ...opts,
      resourcesPath: process.resourcesPath ?? '',
    }, emit as any);
    return { ok: true, backendPort: result.backendPort, frontendPort: result.frontendPort };
  });

  ipc.handle('services:status',  (_, name: ServiceName) => mgr.getStatus(name));
  ipc.handle('services:start',   (_, name: ServiceName) => mgr.start(name));
  ipc.handle('services:stop',    (_, name: ServiceName) => mgr.stop(name));
  ipc.handle('services:restart', (_, name: ServiceName) => mgr.restart(name));

  // تشخيص شامل للنظام
  ipc.handle('services:diagnose', async () => {
    const installDir = 'C:\\Program Files\\OneSoft ERP';
    return mgr.diagnose(
      { installDir, resourcesPath: process.resourcesPath ?? '' },
      emit as any,
    );
  });
}
