import type { IpcMain, BrowserWindow } from 'electron';
import {
  DeploymentOrchestrator,
  ChangeModeManager,
  RepairManager,
  DatabaseMigrator,
} from '../../core/index.js';
import type {
  ChangeModeRequest,
  RepairRequest,
  DatabaseMigrationRequest,
  RemoteServerConfig,
  ProgressEvent,
} from '../../core/types.js';

function emit(win: BrowserWindow | null, event: ProgressEvent) {
  win?.webContents.send('installer:progress', event);
}

export function registerDeploymentIpc(ipcMain: IpcMain, win: BrowserWindow | null) {
  const orchestrator = new DeploymentOrchestrator();
  const changeMgr    = new ChangeModeManager();
  const repairMgr    = new RepairManager();
  const dbMigrator   = new DatabaseMigrator();

  // ── خطة النشر لوضع معين ──────────────────────────────────────────────────
  ipcMain.handle('deploy:get-plan', (_, mode: string) => {
    try { return orchestrator.getPlan(mode as Parameters<typeof orchestrator.getPlan>[0]); }
    catch (e) { return { error: String(e) }; }
  });

  // ── الأوضاع المتاحة ────────────────────────────────────────────────────────
  ipcMain.handle('deploy:list-modes', () => DeploymentOrchestrator.availableModes());

  // ── تغيير وضع التثبيت ──────────────────────────────────────────────────────
  ipcMain.handle('deploy:change-mode', async (_, req: ChangeModeRequest) => {
    return changeMgr.changeMode(req, e => emit(win, e));
  });

  // ── تغيير عنوان السيرفر ───────────────────────────────────────────────────
  ipcMain.handle('deploy:change-endpoint', async (_, cfg: RemoteServerConfig) => {
    return changeMgr.changeEndpoint(cfg, e => emit(win, e));
  });

  // ── إصلاح التثبيت ─────────────────────────────────────────────────────────
  ipcMain.handle('deploy:repair', async (_, req: RepairRequest) => {
    return repairMgr.repair(req, e => emit(win, e));
  });

  // ── نقل قاعدة البيانات ────────────────────────────────────────────────────
  ipcMain.handle('database:migrate-to-host', async (_, req: DatabaseMigrationRequest) => {
    return dbMigrator.migrate(req, e => emit(win, e));
  });
}
