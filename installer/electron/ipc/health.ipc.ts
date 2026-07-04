import type { IpcMain, BrowserWindow } from 'electron';
import { HealthChecker } from '../../core/index.js';
import type { DatabaseConnectionOptions } from '../../core/types.js';

const checker = new HealthChecker();

export function registerHealthIpc(ipc: IpcMain, win: BrowserWindow | null) {
  ipc.handle('health:run', async (_, opts: {
    dbOpts: DatabaseConnectionOptions;
    backendPort: number;
    frontendPort?: number;
  }) => {
    return checker.runAll(opts, (result) => {
      win?.webContents.send('installer:progress', {
        level: result.status === 'healthy' ? 'success' : result.status === 'warning' ? 'warning' : 'error',
        message: `${result.label}: ${result.detail ?? result.status}${result.responseMs ? ` (${result.responseMs}ms)` : ''}`,
        timestamp: new Date().toISOString(),
      });
    });
  });
}
