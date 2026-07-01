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

  // ✅ يستقبل password اختيارياً لإصلاح PostgreSQL
  ipc.handle('requirements:fix', async (_, id: string, pgPassword?: string) => {
    const emit = (e: unknown) => win?.webContents.send('installer:progress', e);

    if (id === 'nodejs') {
      const fixer = new NodeJsFixer();
      await fixer.fix(emit as any);
    } else if (id === 'postgresql') {
      if (!pgPassword || pgPassword.trim().length < 8) {
        throw new Error('يجب تقديم كلمة مرور PostgreSQL (8 أحرف على الأقل) قبل التثبيت التلقائي');
      }
      const fixer = new PostgreSQLFixer(pgPassword);
      await fixer.fix(emit as any);
    }

    return { ok: true };
  });
}
