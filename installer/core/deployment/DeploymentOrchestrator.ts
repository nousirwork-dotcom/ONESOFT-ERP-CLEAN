import type {
  DeploymentType,
  AccessMode,
  DeploymentPlan,
  InstalledComponents,
  ProgressEvent,
  InstallMode,
  legacyModeToDeploymentType as LegacyFn,
} from '../types.js';
import { legacyModeToDeploymentType, legacyRunModeToAccessModes } from '../types.js';

type Emit = (e: ProgressEvent) => void;

// ──────────────────────────────────────────────────────────────────────────────
// مصفوفة البنية التحتية — ما يُثبَّت لكل DeploymentType
// هذا هو المرجع الوحيد الذي يحدد المكونات المحلية لكل نوع تثبيت
// ──────────────────────────────────────────────────────────────────────────────
interface InfraSpec {
  database:            boolean;
  backend:             boolean;
  frontendBase:        boolean;  // هل يُثبَّت Frontend service افتراضياً؟
  frontendIfWeb:       boolean;  // هل يُضاف Frontend إذا كان 'web' في AccessModes؟
  updater:             boolean;
  backup:              boolean;
  runMigrations:       boolean;
  seedAccounts:        boolean;
  requiresRemoteServer: boolean;
}

const INFRA: Record<DeploymentType, InfraSpec> = {
  /**
   * server: سيرفر رئيسي — DB + Backend
   * الواجهة (React) تُخدَم من نفس منفذ الـ Backend مباشرة (express.static) —
   * لا توجد خدمة Frontend منفصلة على الإطلاق (أُلغيت — كانت زائدة بالكامل).
   */
  'server': {
    database: true, backend: true,
    frontendBase: false, frontendIfWeb: false,
    updater: true, backup: true,
    runMigrations: true, seedAccounts: true,
    requiresRemoteServer: false,
  },

  /**
   * client: عميل فقط — يتصل بسيرفر بعيد
   * - لا DB ولا Backend محلي
   * - Electron أو Browser يتصل بالسيرفر البعيد مباشرةً على منفذ الـ Backend
   */
  'client': {
    database: false, backend: false,
    frontendBase: false, frontendIfWeb: false,
    updater: true, backup: false,
    runMigrations: false, seedAccounts: false,
    requiresRemoteServer: true,
  },

  /**
   * server+client: سيرفر + عميل على نفس الجهاز
   * - DB + Backend محلياً، والواجهة تُخدَم من نفس منفذ الـ Backend
   */
  'server+client': {
    database: true, backend: true,
    frontendBase: false, frontendIfWeb: false,
    updater: true, backup: true,
    runMigrations: true, seedAccounts: true,
    requiresRemoteServer: false,
  },

  /**
   * branch: فرع — DB + Backend محلي + يتصل بالسيرفر الرئيسي
   * - يملك DB محلية للعمل في حالة انقطاع الاتصال
   * - لا يبذر شجرة الحسابات (يرثها من الرئيسي)
   */
  'branch': {
    database: true, backend: true,
    frontendBase: false, frontendIfWeb: false,
    updater: true, backup: true,
    runMigrations: true, seedAccounts: false,
    requiresRemoteServer: true,
  },

  /**
   * cloud: سحابي كامل — بدون أي تثبيت محلي
   * - يحتاج فقط عنوان السيرفر السحابي
   */
  'cloud': {
    database: false, backend: false,
    frontendBase: false, frontendIfWeb: false,
    updater: false, backup: false,
    runMigrations: false, seedAccounts: false,
    requiresRemoteServer: true,
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// وصف كل نوع تثبيت (للـ UI)
// ──────────────────────────────────────────────────────────────────────────────
const DESCRIPTIONS: Record<DeploymentType, string> = {
  'server':        'سيرفر رئيسي — DB + Backend فقط، العملاء يتصلون من الشبكة',
  'client':        'عميل فقط — يتصل بسيرفر بعيد، بدون تثبيت DB أو Backend',
  'server+client': 'سيرفر + عميل — كل شيء على نفس الجهاز، مناسب لـ LAN',
  'branch':        'فرع — DB محلية + يتصل بالسيرفر الرئيسي للمزامنة',
  'cloud':         'سحابي — بدون تثبيت محلي، وصول عبر الإنترنت فقط',
};

// ──────────────────────────────────────────────────────────────────────────────
// DeploymentOrchestrator — المرجع الوحيد لحسابات النشر
// ──────────────────────────────────────────────────────────────────────────────
export class DeploymentOrchestrator {

  /**
   * احسب خطة النشر الكاملة بناءً على:
   *   - deploymentType: ما يُثبَّت على الجهاز
   *   - accessModes:    كيف يصل المستخدمون للنظام
   */
  getPlan(deploymentType: DeploymentType, accessModes: AccessMode[]): DeploymentPlan {
    const infra = INFRA[deploymentType];

    const hasWeb     = accessModes.includes('web');
    const hasDesktop = accessModes.includes('desktop');
    const hasOffline = accessModes.includes('offline');

    // installFrontend:
    //   = frontendBase (دائماً لـ server+client و branch)
    //   OR frontendIfWeb مع 'web' في accessModes (لـ server عند تفعيل Web Access)
    const installFrontend = infra.frontendBase || (infra.frontendIfWeb && hasWeb);

    // createDesktopShortcut: منطقي فقط إذا لم يكن cloud-only
    const createDesktopShortcut = hasDesktop && deploymentType !== 'cloud';

    return {
      deploymentType,
      accessModes: [...accessModes],

      // البنية التحتية
      installDatabase:       infra.database,
      installBackend:        infra.backend,
      installFrontend,
      installUpdater:        infra.updater,
      installBackup:         infra.backup,
      runMigrations:         infra.runMigrations,
      seedAccounts:          infra.seedAccounts,
      requiresRemoteServer:  infra.requiresRemoteServer,

      // طبقة الوصول
      createDesktopShortcut,
      enableWebAccess:       hasWeb,
      enableOfflineSync:     hasOffline,

      // نظام
      registerInRegistry:    deploymentType !== 'cloud',
      description:           DESCRIPTIONS[deploymentType],
    };
  }

  /**
   * اشتقاق InstalledComponents من خطة النشر
   * (يُستخدم لتتبع ما هو مثبَّت فعلياً في onesoft.config.json)
   */
  getComponents(deploymentType: DeploymentType, accessModes: AccessMode[]): InstalledComponents {
    const plan = this.getPlan(deploymentType, accessModes);
    return {
      database: plan.installDatabase,
      backend:  plan.installBackend,
      frontend: plan.installFrontend,
      updater:  plan.installUpdater,
      backup:   plan.installBackup,
    };
  }

  /**
   * احسب الفرق بين نوعَي تثبيت — ما يُضاف وما يُزال عند التحويل
   */
  diff(
    currentType: DeploymentType, currentModes: AccessMode[],
    targetType:  DeploymentType, targetModes:  AccessMode[],
    emit: Emit,
  ): {
    toInstall:   (keyof InstalledComponents)[];
    toUninstall: (keyof InstalledComponents)[];
    unchanged:   (keyof InstalledComponents)[];
  } {
    const current = this.getComponents(currentType, currentModes);
    const target  = this.getComponents(targetType,  targetModes);

    const toInstall:   (keyof InstalledComponents)[] = [];
    const toUninstall: (keyof InstalledComponents)[] = [];
    const unchanged:   (keyof InstalledComponents)[] = [];

    for (const key of Object.keys(current) as (keyof InstalledComponents)[]) {
      if (!current[key] && target[key]) {
        toInstall.push(key);
        emit({ level: 'info',    message: `سيُضاف المكوّن: ${key}`,  timestamp: now() });
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
   * تحقق من صحة الطلب قبل تطبيقه
   */
  validate(
    deploymentType: DeploymentType,
    accessModes: AccessMode[],
    remoteServerUrl?: string | null,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const plan = this.getPlan(deploymentType, accessModes);

    if (plan.requiresRemoteServer && !remoteServerUrl) {
      errors.push(`نوع التثبيت "${deploymentType}" يتطلب تحديد عنوان السيرفر الرئيسي`);
    }

    if (accessModes.length === 0) {
      errors.push('يجب اختيار طريقة وصول واحدة على الأقل');
    }

    if (deploymentType === 'cloud' && accessModes.includes('offline')) {
      errors.push('وضع أوفلاين غير مدعوم مع النوع السحابي');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * قائمة أنواع التثبيت المتاحة للمستخدم
   */
  static availableDeploymentTypes(): DeploymentType[] {
    return ['server', 'client', 'server+client', 'branch', 'cloud'];
  }

  /**
   * قائمة طرق الاستخدام المتاحة
   */
  static availableAccessModes(): AccessMode[] {
    return ['desktop', 'web', 'offline'];
  }

  // ── دعم backward compat للكود القديم ──────────────────────────────────────

  /**
   * @deprecated استخدم getPlan(deploymentType, accessModes)
   * يقبل InstallMode القديم للتوافق مع الكود الموجود
   */
  getPlanByLegacyMode(mode: InstallMode): DeploymentPlan {
    const deploymentType = legacyModeToDeploymentType(mode);
    const accessModes    = mode === 'server-only' ? ['web'] as AccessMode[]
                         : mode === 'client-only' ? ['desktop'] as AccessMode[]
                         : ['desktop', 'web'] as AccessMode[];
    return this.getPlan(deploymentType, accessModes);
  }
}

function now() { return new Date().toISOString(); }
