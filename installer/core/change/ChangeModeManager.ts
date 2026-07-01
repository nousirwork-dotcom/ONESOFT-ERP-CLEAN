import type {
  ChangeDeploymentRequest,
  ChangeDeploymentResult,
  ProgressEvent,
  RemoteServerConfig,
  DeploymentType,
  AccessMode,
} from '../types.js';
import { DeploymentOrchestrator } from '../deployment/DeploymentOrchestrator.js';
import { ConfigManager } from '../config/ConfigManager.js';

type Emit = (e: ProgressEvent) => void;

/**
 * تغيير نوع التثبيت (DeploymentType) أو طرق الاستخدام (AccessModes) أو عنوان السيرفر
 * بدون إعادة تثبيت كاملة
 *
 * السيناريوهات المدعومة:
 *   server+client → server         (إزالة Frontend المحلي)
 *   server+client → branch         (ربط بسيرفر رئيسي)
 *   client        → server+client  (إضافة DB + Backend محلي)
 *   أي نوع       → cloud          (التحويل الكامل للسحابة)
 *   [desktop]     → [desktop, web] (إضافة Web access بدون مسّ الخدمات)
 *   [desktop, web]→ [desktop]      (إيقاف Web access)
 */
export class ChangeModeManager {
  private readonly orchestrator: DeploymentOrchestrator;

  constructor() {
    this.orchestrator = new DeploymentOrchestrator();
  }

  async changeDeployment(req: ChangeDeploymentRequest, emit: Emit): Promise<ChangeDeploymentResult> {
    const stepsApplied: string[] = [];
    const stepsSkipped: string[] = [];

    try {
      emit({
        level: 'info',
        message: `تغيير نوع التثبيت: ${req.currentDeploymentType} → ${req.targetDeploymentType}`,
        timestamp: now(),
      });
      emit({
        level: 'info',
        message: `طرق الاستخدام: [${req.currentAccessModes.join(', ')}] → [${req.targetAccessModes.join(', ')}]`,
        timestamp: now(),
      });

      // 1. التحقق من صحة الطلب
      const remoteUrl = req.remoteServer?.apiUrl;
      const validation = this.orchestrator.validate(
        req.targetDeploymentType,
        req.targetAccessModes,
        remoteUrl,
      );
      if (!validation.valid) {
        return {
          success: false,
          stepsApplied: [],
          stepsSkipped: [],
          error: validation.errors.join('\n'),
          requiresRestart: false,
        };
      }

      // 2. حساب الفرق بين المكونات
      const diff = this.orchestrator.diff(
        req.currentDeploymentType, req.currentAccessModes,
        req.targetDeploymentType,  req.targetAccessModes,
        emit,
      );

      // 3. تطبيق التغييرات (التنفيذ الفعلي سيُكتمل في v1.1)
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

      // 4. تحديث onesoft.config.json
      const cfg = ConfigManager.load();
      cfg.deploymentType = req.targetDeploymentType;
      cfg.accessModes    = req.targetAccessModes;
      cfg.components     = this.orchestrator.getComponents(
        req.targetDeploymentType,
        req.targetAccessModes,
      );
      if (req.remoteServer) {
        cfg.remoteServer = req.remoteServer;
      }
      ConfigManager.save(cfg);
      stepsApplied.push('update-config');

      emit({
        level: 'success',
        message: 'تم تحديث إعدادات النشر — يُرجى إعادة التشغيل',
        timestamp: now(),
      });

      return {
        success: true,
        stepsApplied,
        stepsSkipped,
        requiresRestart: diff.toInstall.length > 0 || diff.toUninstall.length > 0,
      };

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      emit({ level: 'error', message: `فشل تغيير النشر: ${msg}`, timestamp: now() });
      return { success: false, stepsApplied, stepsSkipped, error: msg, requiresRestart: false };
    }
  }

  /**
   * تغيير عنوان السيرفر أو الـ API بدون مسّ الخدمات
   */
  async changeEndpoint(
    remoteServer: RemoteServerConfig,
    emit: Emit,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const cfg = ConfigManager.load();
      const old = cfg.remoteServer.apiUrl;
      cfg.remoteServer = remoteServer;
      ConfigManager.save(cfg);
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

  /**
   * تغيير طرق الاستخدام فقط (بدون تغيير نوع التثبيت)
   */
  async changeAccessModes(
    currentModes: AccessMode[],
    targetModes:  AccessMode[],
    emit: Emit,
  ): Promise<ChangeDeploymentResult> {
    const cfg = ConfigManager.load();
    return this.changeDeployment({
      currentDeploymentType: cfg.deploymentType,
      currentAccessModes:    currentModes,
      targetDeploymentType:  cfg.deploymentType,
      targetAccessModes:     targetModes,
    }, emit);
  }

  // ── Private helpers (v1.1: ربط فعلي بـ ServiceManager) ──────────────────

  private async _installComponent(component: string, emit: Emit): Promise<void> {
    emit({ level: 'info', message: `→ تثبيت ${component} (سيُطبَّق في v1.1)`, timestamp: now() });
    await sleep(200);
  }

  private async _uninstallComponent(component: string, emit: Emit): Promise<void> {
    emit({ level: 'info', message: `→ إيقاف ${component} (سيُطبَّق في v1.1)`, timestamp: now() });
    await sleep(200);
  }
}

function now() { return new Date().toISOString(); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
