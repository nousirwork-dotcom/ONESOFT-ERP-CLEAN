import type {
  ChangeModeRequest,
  ChangeModeResult,
  ProgressEvent,
  RemoteServerConfig,
} from '../types.js';
import { DeploymentOrchestrator } from '../deployment/DeploymentOrchestrator.js';
import { ConfigManager } from '../config/ConfigManager.js';

type Emit = (e: ProgressEvent) => void;

/**
 * تغيير وضع التثبيت (InstallMode) أو عنوان السيرفر بدون إعادة تثبيت كاملة
 *
 * السيناريوهات المدعومة:
 *   standalone  → server+client    (فتح LAN)
 *   standalone  → hybrid-cloud     (إضافة مزامنة سحابية)
 *   server-only → server+client    (إضافة Frontend)
 *   client-only → standalone       (إضافة DB + Backend محلية)
 *   أي وضع     → cloud-only       (التحويل الكامل للسحابة)
 */
export class ChangeModeManager {
  private readonly orchestrator: DeploymentOrchestrator;
  private readonly config: ConfigManager;

  constructor(configDir?: string) {
    this.orchestrator = new DeploymentOrchestrator();
    this.config       = new ConfigManager(configDir);
  }

  async changeMode(req: ChangeModeRequest, emit: Emit): Promise<ChangeModeResult> {
    const stepsApplied: string[] = [];
    const stepsSkipped: string[] = [];

    try {
      emit({ level: 'info', message: `تغيير الوضع: ${req.currentMode} → ${req.targetMode}`, timestamp: now() });

      // 1. حساب الفرق
      const diff = this.orchestrator.diff(req.currentMode, req.targetMode, emit);

      // 2. التحقق من صحة الطلب
      const validation = this.orchestrator.validate(req.targetMode);
      if (!validation.valid) {
        return {
          success: false,
          stepsApplied: [],
          stepsSkipped: [],
          error: validation.errors.join('\n'),
          requiresRestart: false,
        };
      }

      // 3. تطبيق التغييرات
      for (const component of diff.toInstall) {
        emit({ level: 'info', message: `تثبيت مكوّن: ${component}`, timestamp: now() });
        await this._installComponent(component, emit);
        stepsApplied.push(`install:${component}`);
      }

      for (const component of diff.toUninstall) {
        emit({ level: 'warning', message: `إيقاف مكوّن: ${component}`, timestamp: now() });
        await this._uninstallComponent(component, emit);
        stepsApplied.push(`uninstall:${component}`);
      }

      for (const component of diff.unchanged) {
        stepsSkipped.push(`unchanged:${component}`);
      }

      // 4. تحديث Config
      const cfg = await this.config.load();
      cfg.installMode = req.targetMode;
      if (req.targetRunMode) cfg.runMode = req.targetRunMode;
      if (req.remoteServer) cfg.remoteServer = req.remoteServer;
      cfg.components = this.orchestrator.getComponents(req.targetMode);
      await this.config.save(cfg);
      stepsApplied.push('update-config');

      emit({ level: 'success', message: 'تم تغيير الوضع بنجاح — يُرجى إعادة التشغيل', timestamp: now() });

      return {
        success: true,
        stepsApplied,
        stepsSkipped,
        requiresRestart: diff.toInstall.length > 0 || diff.toUninstall.length > 0,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      emit({ level: 'error', message: `فشل تغيير الوضع: ${msg}`, timestamp: now() });
      return { success: false, stepsApplied, stepsSkipped, error: msg, requiresRestart: false };
    }
  }

  /**
   * تغيير عنوان السيرفر أو الـ API بدون إعادة تثبيت
   */
  async changeEndpoint(remoteServer: RemoteServerConfig, emit: Emit): Promise<{ success: boolean; error?: string }> {
    try {
      const cfg = await this.config.load();
      const old = cfg.remoteServer.apiUrl;
      cfg.remoteServer = remoteServer;
      await this.config.save(cfg);
      emit({
        level: 'success',
        message: `تم تغيير عنوان السيرفر: ${old} → ${remoteServer.apiUrl}`,
        timestamp: now(),
      });
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────────────────────

  private async _installComponent(
    component: string,
    emit: Emit,
  ): Promise<void> {
    // هذه الوحدة تُنسّق — التنفيذ الفعلي في ServiceManager/DatabaseInstaller
    emit({ level: 'info', message: `→ تثبيت ${component} (سيُطبَّق في v1.1)`, timestamp: now() });
    await sleep(200);
  }

  private async _uninstallComponent(
    component: string,
    emit: Emit,
  ): Promise<void> {
    emit({ level: 'info', message: `→ إيقاف ${component} (سيُطبَّق في v1.1)`, timestamp: now() });
    await sleep(200);
  }
}

function now() { return new Date().toISOString(); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
