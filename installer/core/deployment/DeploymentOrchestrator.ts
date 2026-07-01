import type {
  InstallMode,
  DeploymentPlan,
  InstalledComponents,
  ProgressEvent,
} from '../types.js';

type Emit = (e: ProgressEvent) => void;

// ──────────────────────────────────────────────────────────────────────────────
// خطط النشر لكل InstallMode — المرجع الوحيد لما يُثبَّت في كل وضع
// ──────────────────────────────────────────────────────────────────────────────
const PLANS: Record<string, Omit<DeploymentPlan, 'mode'>> = {
  standalone: {
    description: 'نسخة مستقلة — DB + Backend + Frontend على نفس الجهاز',
    installDatabase:      true,
    installBackend:       true,
    installFrontend:      true,
    installUpdater:       true,
    installBackup:        true,
    runMigrations:        true,
    seedAccounts:         true,
    createShortcuts:      true,
    registerInRegistry:   true,
    requiresRemoteServer: false,
  },
  'single-user': {   // legacy alias
    description: 'نسخة مستخدم واحد (standalone)',
    installDatabase:      true,
    installBackend:       true,
    installFrontend:      true,
    installUpdater:       true,
    installBackup:        true,
    runMigrations:        true,
    seedAccounts:         true,
    createShortcuts:      true,
    registerInRegistry:   true,
    requiresRemoteServer: false,
  },
  'server-only': {
    description: 'سيرفر رئيسي — Backend + DB بدون واجهة محلية',
    installDatabase:      true,
    installBackend:       true,
    installFrontend:      false,
    installUpdater:       true,
    installBackup:        true,
    runMigrations:        true,
    seedAccounts:         true,
    createShortcuts:      false,
    registerInRegistry:   true,
    requiresRemoteServer: false,
  },
  'client-only': {
    description: 'عميل فقط — يتصل بسيرفر بعيد، بدون DB محلية',
    installDatabase:      false,
    installBackend:       false,
    installFrontend:      true,
    installUpdater:       true,
    installBackup:        false,
    runMigrations:        false,
    seedAccounts:         false,
    createShortcuts:      true,
    registerInRegistry:   true,
    requiresRemoteServer: true,
  },
  'server+client': {
    description: 'سيرفر + عميل — نفس الجهاز، متاح لشبكة LAN',
    installDatabase:      true,
    installBackend:       true,
    installFrontend:      true,
    installUpdater:       true,
    installBackup:        true,
    runMigrations:        true,
    seedAccounts:         true,
    createShortcuts:      true,
    registerInRegistry:   true,
    requiresRemoteServer: false,
  },
  'multi-user': {   // legacy alias
    description: 'متعدد المستخدمين — LAN (server+client)',
    installDatabase:      true,
    installBackend:       true,
    installFrontend:      true,
    installUpdater:       true,
    installBackup:        true,
    runMigrations:        true,
    seedAccounts:         true,
    createShortcuts:      true,
    registerInRegistry:   true,
    requiresRemoteServer: false,
  },
  branch: {
    description: 'فرع — يتصل بسيرفر رئيسي مع DB محلية للتخزين المؤقت',
    installDatabase:      true,
    installBackend:       true,
    installFrontend:      true,
    installUpdater:       true,
    installBackup:        true,
    runMigrations:        true,
    seedAccounts:         false,   // يرث الحسابات من الرئيسي
    createShortcuts:      true,
    registerInRegistry:   true,
    requiresRemoteServer: true,
  },
  'branch-server': {   // legacy alias
    description: 'سيرفر فرع (branch)',
    installDatabase:      true,
    installBackend:       true,
    installFrontend:      true,
    installUpdater:       true,
    installBackup:        true,
    runMigrations:        true,
    seedAccounts:         false,
    createShortcuts:      true,
    registerInRegistry:   true,
    requiresRemoteServer: true,
  },
  'hybrid-cloud': {
    description: 'هجين — محلي مع مزامنة سحابية',
    installDatabase:      true,
    installBackend:       true,
    installFrontend:      true,
    installUpdater:       true,
    installBackup:        true,
    runMigrations:        true,
    seedAccounts:         true,
    createShortcuts:      true,
    registerInRegistry:   true,
    requiresRemoteServer: true,
  },
  'cloud-only': {
    description: 'سحابي كامل — بدون تثبيت محلي',
    installDatabase:      false,
    installBackend:       false,
    installFrontend:      false,
    installUpdater:       false,
    installBackup:        false,
    runMigrations:        false,
    seedAccounts:         false,
    createShortcuts:      false,
    registerInRegistry:   false,
    requiresRemoteServer: true,
  },
};

export class DeploymentOrchestrator {
  /**
   * إرجاع خطة النشر الكاملة لوضع معين
   */
  getPlan(mode: InstallMode): DeploymentPlan {
    const plan = PLANS[mode];
    if (!plan) {
      throw new Error(`وضع التثبيت غير معروف: ${mode}`);
    }
    return { mode, ...plan };
  }

  /**
   * إرجاع مكونات النشر النشطة بناءً على الوضع
   */
  getComponents(mode: InstallMode): InstalledComponents {
    const plan = this.getPlan(mode);
    return {
      database: plan.installDatabase,
      backend:  plan.installBackend,
      frontend: plan.installFrontend,
      updater:  plan.installUpdater,
      backup:   plan.installBackup,
    };
  }

  /**
   * حساب الفرق بين وضعين — ما يُضاف وما يُزال عند تغيير الوضع
   */
  diff(
    currentMode: InstallMode,
    targetMode: InstallMode,
    emit: Emit,
  ): {
    toInstall:   (keyof InstalledComponents)[];
    toUninstall: (keyof InstalledComponents)[];
    unchanged:   (keyof InstalledComponents)[];
  } {
    const current = this.getComponents(currentMode);
    const target  = this.getComponents(targetMode);

    const toInstall:   (keyof InstalledComponents)[] = [];
    const toUninstall: (keyof InstalledComponents)[] = [];
    const unchanged:   (keyof InstalledComponents)[] = [];

    for (const key of Object.keys(current) as (keyof InstalledComponents)[]) {
      if (!current[key] && target[key]) {
        toInstall.push(key);
        emit({ level: 'info', message: `سيُضاف المكوّن: ${key}`, timestamp: now() });
      } else if (current[key] && !target[key]) {
        toUninstall.push(key);
        emit({ level: 'warning', message: `سيُزال المكوّن: ${key}`, timestamp: now() });
      } else {
        unchanged.push(key);
      }
    }

    return { toInstall, toUninstall, unchanged };
  }

  /**
   * التحقق من أن جميع متطلبات الوضع المطلوب متوفرة
   */
  validate(mode: InstallMode): { valid: boolean; errors: string[] } {
    const plan = this.getPlan(mode);
    const errors: string[] = [];

    if (plan.requiresRemoteServer && mode === 'client-only') {
      errors.push('وضع client-only يتطلب تحديد عنوان السيرفر الرئيسي');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * قائمة جميع أوضاع التثبيت المتاحة (بدون legacy aliases)
   */
  static availableModes(): InstallMode[] {
    return [
      'standalone',
      'server-only',
      'client-only',
      'server+client',
      'branch',
      'hybrid-cloud',
      'cloud-only',
    ];
  }
}

function now() { return new Date().toISOString(); }
