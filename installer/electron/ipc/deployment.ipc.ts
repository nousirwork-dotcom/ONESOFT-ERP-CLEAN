import type { IpcMain, BrowserWindow } from 'electron';
import {
  DeploymentOrchestrator,
  ChangeModeManager,
  RepairManager,
  DatabaseMigrator,
} from '../../core/index.js';
import type {
  ChangeDeploymentRequest,
  RepairRequest,
  DatabaseMigrationRequest,
  RemoteServerConfig,
  ProgressEvent,
  DeploymentType,
  AccessMode,
} from '../../core/types.js';

function emit(win: BrowserWindow | null, event: ProgressEvent) {
  win?.webContents.send('installer:progress', event);
}

export function registerDeploymentIpc(ipcMain: IpcMain, win: BrowserWindow | null) {
  const orchestrator = new DeploymentOrchestrator();
  const changeMgr    = new ChangeModeManager();
  const repairMgr    = new RepairManager();
  const dbMigrator   = new DatabaseMigrator();

  // ── خطة النشر لنوع + طرق الاستخدام ────────────────────────────────────────
  ipcMain.handle('deploy:get-plan', (_, args: {
    deploymentType: DeploymentType;
    accessModes: AccessMode[];
  }) => {
    try {
      return orchestrator.getPlan(args.deploymentType, args.accessModes);
    } catch (e) {
      return { error: String(e) };
    }
  });

  // ── الأنواع المتاحة ─────────────────────────────────────────────────────────
  ipcMain.handle('deploy:list-types', () => ({
    deploymentTypes: DeploymentOrchestrator.availableDeploymentTypes(),
    accessModes:     DeploymentOrchestrator.availableAccessModes(),
  }));

  // ── تغيير نوع التثبيت أو طرق الاستخدام ─────────────────────────────────────
  ipcMain.handle('deploy:change', async (_, req: ChangeDeploymentRequest) => {
    return changeMgr.changeDeployment(req, e => emit(win, e));
  });

  // ── تغيير طرق الاستخدام فقط ────────────────────────────────────────────────
  ipcMain.handle('deploy:change-access', async (_, args: {
    currentModes: AccessMode[];
    targetModes:  AccessMode[];
  }) => {
    return changeMgr.changeAccessModes(args.currentModes, args.targetModes, e => emit(win, e));
  });

  // ── تغيير عنوان السيرفر ─────────────────────────────────────────────────────
  ipcMain.handle('deploy:change-endpoint', async (_, cfg: RemoteServerConfig) => {
    return changeMgr.changeEndpoint(cfg, e => emit(win, e));
  });

  // ── إصلاح التثبيت ──────────────────────────────────────────────────────────
  ipcMain.handle('deploy:repair', async (_, req: RepairRequest) => {
    return repairMgr.repair(req, e => emit(win, e));
  });

  // ── نقل قاعدة البيانات ─────────────────────────────────────────────────────
  ipcMain.handle('database:migrate-to-host', async (_, req: DatabaseMigrationRequest) => {
    return dbMigrator.migrate(req, e => emit(win, e));
  });
}
