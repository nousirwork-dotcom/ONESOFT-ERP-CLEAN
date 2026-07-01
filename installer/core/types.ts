// ─── Installer Core — Shared Types ────────────────────────────────────────────
// هذا الملف هو المرجع الوحيد لجميع الأنواع المشتركة في Installer Core
// يُستخدم من Core وElectron IPC والـ UI

// ══════════════════════════════════════════════════════════════════════════════
// Deployment Type — ما يُثبَّت على الجهاز (اختيار واحد، Radio)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * DeploymentType — نوع التثبيت (البنية التحتية المحلية)
 *
 * server       : سيرفر رئيسي — DB + Backend فقط، بدون واجهة محلية
 * client       : عميل فقط — يتصل بسيرفر بعيد، بدون DB أو Backend محلي
 * server+client: سيرفر + عميل على نفس الجهاز — مناسب لـ LAN
 * branch       : فرع — DB + Backend محلي يتصل بالسيرفر الرئيسي
 * cloud        : سحابي — بدون تثبيت محلي (SaaS)
 */
export type DeploymentType =
  | 'server'
  | 'client'
  | 'server+client'
  | 'branch'
  | 'cloud';

// ══════════════════════════════════════════════════════════════════════════════
// Access Modes — طرق استخدام النظام (اختيار متعدد، Checkboxes)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * AccessMode — طريقة وصول المستخدم للنظام
 * يمكن اختيار أكثر من طريقة في آنٍ واحد
 *
 * desktop : تطبيق مكتبي (Electron — اختصار على سطح المكتب)
 * web     : متصفح (Browser — وصول عبر الشبكة المحلية أو الإنترنت)
 * offline : وضع أوفلاين (DB محلية + مزامنة تلقائية عند الاتصال)
 */
export type AccessMode =
  | 'desktop'
  | 'web'
  | 'offline';

// ══════════════════════════════════════════════════════════════════════════════
// Legacy — محتفظ بها للتوافق مع الإصدارات القديمة (deprecated)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated استخدم DeploymentType بدلاً منه
 * محتفظ به للتوافق مع onesoft.config.json القديمة
 */
export type InstallMode =
  | 'standalone'
  | 'server-only'
  | 'client-only'
  | 'server+client'
  | 'branch'
  | 'hybrid-cloud'
  | 'cloud-only'
  | 'single-user'
  | 'multi-user'
  | 'branch-server';

/**
 * @deprecated استخدم AccessMode[] بدلاً منه
 * محتفظ به للتوافق مع onesoft.config.json القديمة
 */
export type RunMode =
  | 'desktop'
  | 'web'
  | 'desktop+web';

// ══════════════════════════════════════════════════════════════════════════════
// Requirements
// ══════════════════════════════════════════════════════════════════════════════

export type RequirementStatus = 'pass' | 'fail' | 'warn' | 'checking' | 'fixing';

export interface RequirementResult {
  id: string;
  label: string;
  status: RequirementStatus;
  detail?: string;
  fixable: boolean;
  fixLabel?: string;
}

export interface RequirementsReport {
  allPassed: boolean;
  canContinue: boolean;
  results: RequirementResult[];
}

// ══════════════════════════════════════════════════════════════════════════════
// Configuration
// ══════════════════════════════════════════════════════════════════════════════

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  poolMin: number;
  poolMax: number;
}

export interface ServerConfig {
  backendPort: number;
  frontendPort: number;
  host: string;
  allowedOrigins: string[];
}

export interface CloudConfig {
  enabled: boolean;
  provider: string | null;
  syncInterval: number;
  endpoint: string | null;
}

export interface BackupConfig {
  enabled: boolean;
  schedule: string;
  retentionDays: number;
  path: string;
  compress: boolean;
  includeAttachments: boolean;
}

export interface UpdateConfig {
  autoCheck: boolean;
  channel: 'stable' | 'beta' | 'dev';
  updateServerUrl: string;
  checkInterval: number;
}

export interface PrintingConfig {
  defaultPrinter: string | null;
  pdfOutputPath: string;
}

export interface LicenseConfig {
  key: string | null;
  type: 'trial' | 'standard' | 'enterprise';
  expiresAt: string | null;
  maxUsers: number;
  activatedAt: string | null;
}

export interface PathsConfig {
  data: string;
  backups: string;
  logs: string;
  temp: string;
  updates: string;
  attachments: string;
  exports: string;
}

/**
 * المكونات المثبّتة — يحدد ما يعمل فعلياً على هذا الجهاز
 * يمكن تغييره لاحقاً بدون إعادة تثبيت (Change Installation)
 */
export interface InstalledComponents {
  database:  boolean;  // PostgreSQL محلية
  backend:   boolean;  // OneSoft-Server service
  frontend:  boolean;  // OneSoft-Client service (واجهة الويب)
  updater:   boolean;  // OneSoft-Updater service
  backup:    boolean;  // OneSoft-Backup service
}

/**
 * إعدادات السيرفر البعيد (للـ client و branch و cloud)
 */
export interface RemoteServerConfig {
  enabled:  boolean;
  apiUrl:   string | null;
  apiKey:   string | null;
  syncMode: 'realtime' | 'scheduled' | 'manual';
}

export interface OneSoftConfig {
  version:       string;
  configVersion: number;  // رقم إصدار schema — يُستخدم للترحيل

  // ── البنية المعمارية الجديدة (configVersion >= 2) ─────────────────────────
  deploymentType: DeploymentType;   // نوع التثبيت (واحد)
  accessModes:    AccessMode[];     // طرق الاستخدام (متعددة)

  // ── البنية القديمة (محتفظ بها للتوافق، deprecated) ────────────────────────
  /** @deprecated استخدم deploymentType */
  installMode?: InstallMode;
  /** @deprecated استخدم accessModes */
  runMode?: RunMode;

  components:    InstalledComponents;
  database:      DatabaseConfig;
  remoteServer:  RemoteServerConfig;
  server:        ServerConfig;
  cloud:         CloudConfig;
  backup:        BackupConfig;
  update:        UpdateConfig;
  printing:      PrintingConfig;
  license:       LicenseConfig;
  paths:         PathsConfig;
}

// ══════════════════════════════════════════════════════════════════════════════
// Database
// ══════════════════════════════════════════════════════════════════════════════

export interface DatabaseConnectionOptions {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
  failed?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Setup — Organization & User
// ══════════════════════════════════════════════════════════════════════════════

export interface OrganizationSetup {
  code: string;
  name: string;
  nameEn: string;
  country: string;
  currency: string;
  language: string;
  timezone: string;
  taxNumber?: string;
}

export interface FirstUserSetup {
  fullName: string;
  username: string;
  password: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Windows Services
// ══════════════════════════════════════════════════════════════════════════════

export type ServiceName =
  | 'OneSoft-Server'
  | 'OneSoft-Client'
  | 'OneSoft-Updater'
  | 'OneSoft-Backup';

export type ServiceStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'not-installed' | 'error';

export interface ServiceInfo {
  name: ServiceName;
  displayName: string;
  description: string;
  status: ServiceStatus;
  startType: 'Automatic' | 'Manual' | 'Disabled';
  executablePath: string;
  logPath: string;
  dependsOn?: ServiceName[];
}

export interface ServiceOperationResult {
  success: boolean;
  error?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Health Check
// ══════════════════════════════════════════════════════════════════════════════

export type HealthStatus = 'healthy' | 'unhealthy' | 'warning' | 'checking' | 'skipped';

export interface HealthCheckResult {
  id: string;
  label: string;
  status: HealthStatus;
  detail?: string;
  responseMs?: number;
}

export interface HealthReport {
  allHealthy: boolean;
  passedCount: number;
  totalCount: number;
  results: HealthCheckResult[];
  checkedAt: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Upgrade
// ══════════════════════════════════════════════════════════════════════════════

export interface VersionInfo {
  version: string;
  installedAt: string;
  deploymentType: DeploymentType;
  accessModes: AccessMode[];
  /** @deprecated */
  installMode?: InstallMode;
  /** @deprecated */
  runMode?: RunMode;
}

export interface UpgradePlan {
  currentVersion: string;
  targetVersion: string;
  migrationsToRun: string[];
  requiresRestart: boolean;
  estimatedMinutes: number;
}

export type UpgradeStatus =
  | 'idle'
  | 'detecting'
  | 'backing-up'
  | 'stopping-services'
  | 'copying-files'
  | 'running-migrations'
  | 'starting-services'
  | 'health-check'
  | 'complete'
  | 'rolling-back'
  | 'rollback-complete'
  | 'failed';

// ══════════════════════════════════════════════════════════════════════════════
// Progress Events (IPC channel: installer:progress)
// ══════════════════════════════════════════════════════════════════════════════

export type ProgressLevel = 'info' | 'success' | 'warning' | 'error';

export interface ProgressEvent {
  level: ProgressLevel;
  message: string;
  timestamp: string;
  percent?: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// Wizard State (shared between Core and UI)
// ══════════════════════════════════════════════════════════════════════════════

export interface WizardState {
  currentStep: number;
  deploymentType: DeploymentType;
  accessModes: AccessMode[];
  dbOptions: DatabaseConnectionOptions;
  organization: OrganizationSetup;
  firstUser: FirstUserSetup;
  acceptedLicense: boolean;
  requirementsReport: RequirementsReport | null;
  healthReport: HealthReport | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// IPC Channels (مرجع قنوات IPC بين Electron و Core)
// ══════════════════════════════════════════════════════════════════════════════

export const IPC = {
  // Requirements
  CHECK_REQUIREMENTS: 'requirements:check',
  FIX_REQUIREMENT: 'requirements:fix',

  // Database
  TEST_CONNECTION: 'database:test-connection',
  INSTALL_POSTGRES: 'database:install-postgres',
  CREATE_DATABASE: 'database:create',
  RUN_MIGRATIONS: 'database:migrate',

  // Setup
  CREATE_ORGANIZATION: 'setup:create-org',
  CREATE_USER: 'setup:create-user',
  SEED_ACCOUNTS: 'setup:seed-accounts',

  // Services
  INSTALL_SERVICES: 'services:install',
  GET_SERVICE_STATUS: 'services:status',
  START_SERVICE: 'services:start',
  STOP_SERVICE: 'services:stop',
  RESTART_SERVICE: 'services:restart',

  // Filesystem
  CREATE_DIRECTORIES: 'fs:create-dirs',
  CREATE_SHORTCUTS: 'fs:create-shortcuts',

  // Health
  RUN_HEALTH_CHECK: 'health:run',

  // Config
  GET_CONFIG: 'config:get',
  SAVE_CONFIG: 'config:save',

  // Upgrade
  DETECT_VERSION: 'upgrade:detect',
  RUN_UPGRADE: 'upgrade:run',
  ROLLBACK: 'upgrade:rollback',

  // Change Deployment / Repair / Components
  GET_DEPLOYMENT_PLAN:  'deploy:get-plan',
  LIST_DEPLOYMENT_TYPES:'deploy:list-types',
  CHANGE_DEPLOYMENT:    'deploy:change',       // نوع التثبيت + طرق الاستخدام
  CHANGE_ACCESS_MODES:  'deploy:change-access',
  CHANGE_ENDPOINT:      'deploy:change-endpoint',
  REPAIR:               'deploy:repair',
  ADD_COMPONENT:        'deploy:add-component',
  REMOVE_COMPONENT:     'deploy:remove-component',

  // Database Operations
  MIGRATE_DATABASE: 'database:migrate-to-host',
  EXPORT_DATABASE:  'database:export',
  IMPORT_DATABASE:  'database:import',

  // Deployment Settings (post-install)
  GET_DEPLOYMENT_STATUS: 'settings:status',
  SAVE_BACKUP_SCHEDULE:  'settings:backup-schedule',
  SAVE_UPDATE_SETTINGS:  'settings:update-config',
  VALIDATE_LICENSE:      'settings:validate-license',
  ACTIVATE_LICENSE:      'settings:activate-license',

  // Progress stream
  PROGRESS: 'installer:progress',
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Deployment Plan — خطة النشر الكاملة
// ══════════════════════════════════════════════════════════════════════════════

export interface DeploymentPlan {
  // المدخلات
  deploymentType: DeploymentType;
  accessModes: AccessMode[];

  // ── البنية التحتية (من DeploymentType) ────────────────────────────────────
  installDatabase:     boolean;  // PostgreSQL محلية
  installBackend:      boolean;  // OneSoft-Server service
  installFrontend:     boolean;  // OneSoft-Client service (خادم الويب)
  installUpdater:      boolean;  // OneSoft-Updater service
  installBackup:       boolean;  // OneSoft-Backup service
  runMigrations:       boolean;  // تشغيل DB migrations
  seedAccounts:        boolean;  // بذر شجرة الحسابات
  requiresRemoteServer: boolean; // يتطلب تحديد سيرفر بعيد

  // ── طبقة الوصول (من AccessModes) ──────────────────────────────────────────
  createDesktopShortcut: boolean;  // desktop ∈ accessModes
  enableWebAccess:       boolean;  // web ∈ accessModes
  enableOfflineSync:     boolean;  // offline ∈ accessModes

  // ── نظام ──────────────────────────────────────────────────────────────────
  registerInRegistry: boolean;
  description: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Change Deployment — تغيير نوع التثبيت أو طرق الاستخدام بدون إعادة تثبيت
// ══════════════════════════════════════════════════════════════════════════════

export interface ChangeDeploymentRequest {
  currentDeploymentType: DeploymentType;
  currentAccessModes:    AccessMode[];
  targetDeploymentType:  DeploymentType;
  targetAccessModes:     AccessMode[];
  remoteServer?: RemoteServerConfig;
}

export interface ChangeDeploymentResult {
  success: boolean;
  stepsApplied: string[];
  stepsSkipped: string[];
  error?: string;
  requiresRestart: boolean;
}

// Legacy aliases — للتوافق مع ChangeModeManager القديم
/** @deprecated استخدم ChangeDeploymentRequest */
export interface ChangeModeRequest {
  currentMode:     InstallMode;
  targetMode:      InstallMode;
  targetRunMode?:  RunMode;
  remoteServer?:   RemoteServerConfig;
}
/** @deprecated استخدم ChangeDeploymentResult */
export interface ChangeModeResult {
  success: boolean;
  stepsApplied: string[];
  stepsSkipped: string[];
  error?: string;
  requiresRestart: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// Database Migration (نقل DB إلى جهاز آخر)
// ══════════════════════════════════════════════════════════════════════════════

export interface DatabaseMigrationRequest {
  sourceDb: DatabaseConnectionOptions;
  targetDb: DatabaseConnectionOptions;
  includeData: boolean;
  dropSourceAfter: boolean;
}

export interface DatabaseMigrationResult {
  success: boolean;
  tablesTransferred: number;
  rowsTransferred: number;
  dumpPath?: string;
  error?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Repair Installation
// ══════════════════════════════════════════════════════════════════════════════

export type RepairAction =
  | 'reinstall-services'
  | 'recreate-shortcuts'
  | 'fix-permissions'
  | 'run-missing-migrations'
  | 'reseed-accounts'
  | 'fix-config';

export interface RepairRequest {
  actions: RepairAction[];
}

export interface RepairResult {
  success: boolean;
  actionsApplied: RepairAction[];
  errors: string[];
}

// ══════════════════════════════════════════════════════════════════════════════
// IPC Adapter Interface — الواجهة المجرّدة للاتصال بين Core والـ UI
// يُمكّن استبدال Electron بـ WebSocket أو CLI أو HTTP في المستقبل
// ══════════════════════════════════════════════════════════════════════════════

export interface IpcAdapter {
  handle(channel: string, fn: (args: unknown) => Promise<unknown>): void;
  emit(channel: string, data: unknown): void;
  on(channel: string, fn: (args: unknown) => void): void;
}

// ══════════════════════════════════════════════════════════════════════════════
// Utility — تحويل بين الأنواع الجديدة والقديمة (للتوافق)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * تحويل DeploymentType القديم (InstallMode) إلى الجديد
 */
export function legacyModeToDeploymentType(mode: InstallMode): DeploymentType {
  switch (mode) {
    case 'standalone':
    case 'single-user':
    case 'server+client':
    case 'multi-user':     return 'server+client';
    case 'server-only':    return 'server';
    case 'client-only':    return 'client';
    case 'branch':
    case 'branch-server':  return 'branch';
    case 'hybrid-cloud':
    case 'cloud-only':     return 'cloud';
    default:               return 'server+client';
  }
}

/**
 * تحويل RunMode القديم إلى AccessMode[]
 */
export function legacyRunModeToAccessModes(runMode: RunMode): AccessMode[] {
  switch (runMode) {
    case 'desktop':      return ['desktop'];
    case 'web':          return ['web'];
    case 'desktop+web':  return ['desktop', 'web'];
    default:             return ['desktop', 'web'];
  }
}

/**
 * اشتقاق InstallMode من DeploymentType (للتوافق مع الإصدارات القديمة)
 */
export function deploymentTypeToLegacyMode(type: DeploymentType): InstallMode {
  switch (type) {
    case 'server':        return 'server-only';
    case 'client':        return 'client-only';
    case 'server+client': return 'server+client';
    case 'branch':        return 'branch';
    case 'cloud':         return 'cloud-only';
    default:              return 'server+client';
  }
}

/**
 * اشتقاق RunMode من AccessMode[] (للتوافق مع الإصدارات القديمة)
 */
export function accessModesToLegacyRunMode(modes: AccessMode[]): RunMode {
  const d = modes.includes('desktop');
  const w = modes.includes('web');
  if (d && w) return 'desktop+web';
  if (w)      return 'web';
  return 'desktop';
}
