import type { IpcMain, BrowserWindow } from 'electron';
import { RequirementChecker, NodeJsFixer, PostgreSQLFixer } from '../../core/index.js';

const checker = new RequirementChecker();

export function registerRequirementsIpc(ipc: IpcMain, win: BrowserWindow | null) {
  ipc.handle('requirements:check', async () => {
    return checker.checkAll((result) => {
      win?.webContents.send('installer:progress', {
        level: result.status === 'pass' ? 'success' : result.status === 'fail' ? 'error' : 'info',
        message: `${result.label}: ${result.detail ?? result.status}`,
        timestamp: new Date().toISOString(),
      });
    });
  });

  ipc.handle('requirements:fix', async (_, id: string) => {
    const emit = (e: unknown) => win?.webContents.send('installer:progress', e);

    if (id === 'nodejs') {
      const fixer = new NodeJsFixer();
      await fixer.fix(emit as any);
    } else if (id === 'postgresql') {
      const fixer = new PostgreSQLFixer();
      await fixer.fix(emit as any);
    }

    return { ok: true };
  });
}
