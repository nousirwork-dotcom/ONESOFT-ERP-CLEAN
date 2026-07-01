// ─── Installer Core — Shared Types ────────────────────────────────────────────
// هذا الملف هو المرجع الوحيد لجميع الأنواع المشتركة في Installer Core
// يُستخدم من Core وElectron IPC والـ UI

// ══════════════════════════════════════════════════════════════════════════════
// Installation Modes & Run Modes
// ══════════════════════════════════════════════════════════════════════════════

/**
 * InstallMode — وضع التثبيت
 *
 * standalone     : جهاز واحد مستقل (DB + Backend + Frontend على نفس الجهاز)
 * server-only    : سيرفر رئيسي بدون واجهة محلية (للـ headless servers)
 * client-only    : عميل فقط يتصل بسيرفر بعيد (لا يحتاج PostgreSQL)
 * server+client  : سيرفر + عميل على نفس الجهاز (= standalone مع LAN)
 * branch         : فرع يتصل بسيرفر رئيسي مع قاعدة بيانات محلية اختيارية
 * hybrid-cloud   : محلي مع مزامنة سحابية
 * cloud-only     : SaaS كامل بدون تثبيت محلي
 *
 * الأوضاع القديمة محتفظ بها كـ aliases للتوافق:
 *   single-user  → standalone
 *   multi-user   → server+client
 *   branch-server → branch
 */
export type InstallMode =
  | 'standalone'
  | 'server-only'
  | 'client-only'
  | 'server+client'
  | 'branch'
  | 'hybrid-cloud'
  | 'cloud-only'
  // legacy aliases (kept for backward compat with saved configs)
  | 'single-user'
  | 'multi-user'
  | 'branch-server';

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
 * المكونات المثبّتة — يُحدّد ما هو نشط فعلياً
 * يمكن تغييره لاحقاً بدون إعادة تثبيت (Change Installation)
 */
export interface InstalledComponents {
  database:  boolean;  // PostgreSQL محلية
  backend:   boolean;  // OneSoft-Server service
  frontend:  boolean;  // OneSoft-Client service
  updater:   boolean;  // OneSoft-Updater service
  backup:    boolean;  // OneSoft-Backup service
}

/**
 * إعدادات السيرفر البعيد (للـ client-only و branch)
 */
export interface RemoteServerConfig {
  enabled:  boolean;
  apiUrl:   string | null;
  apiKey:   string | null;
  syncMode: 'realtime' | 'scheduled' | 'manual';
}

export interface OneSoftConfig {
  version:       string;
  configVersion: number;   // رقم إصدار schema الـ config — يُستخدم للترحيل
  installMode:   InstallMode;
  runMode:       RunMode;
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
  installMode: InstallMode;
  runMode: RunMode;
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
  installMode: InstallMode;
  runMode: RunMode;
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

  // Change Mode / Repair / Components
  GET_DEPLOYMENT_PLAN: 'deploy:get-plan',
  CHANGE_MODE: 'deploy:change-mode',
  CHANGE_ENDPOINT: 'deploy:change-endpoint',
  REPAIR: 'deploy:repair',
  ADD_COMPONENT: 'deploy:add-component',
  REMOVE_COMPONENT: 'deploy:remove-component',

  // Database Operations
  MIGRATE_DATABASE: 'database:migrate-to-host',
  EXPORT_DATABASE: 'database:export',
  IMPORT_DATABASE: 'database:import',

  // Deployment Settings (post-install)
  GET_DEPLOYMENT_STATUS: 'settings:status',
  SAVE_BACKUP_SCHEDULE: 'settings:backup-schedule',
  SAVE_UPDATE_SETTINGS: 'settings:update-config',
  VALIDATE_LICENSE: 'settings:validate-license',
  ACTIVATE_LICENSE: 'settings:activate-license',

  // Progress stream
  PROGRESS: 'installer:progress',
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Deployment Plan — خطة النشر لكل InstallMode
// ══════════════════════════════════════════════════════════════════════════════

export interface DeploymentPlan {
  mode: InstallMode;
  installDatabase: boolean;
  installBackend: boolean;
  installFrontend: boolean;
  installUpdater: boolean;
  installBackup: boolean;
  runMigrations: boolean;
  seedAccounts: boolean;
  createShortcuts: boolean;
  registerInRegistry: boolean;
  requiresRemoteServer: boolean;
  description: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Change Mode — تغيير وضع التثبيت بدون إعادة تثبيت
// ══════════════════════════════════════════════════════════════════════════════

export interface ChangeModeRequest {
  currentMode: InstallMode;
  targetMode:  InstallMode;
  targetRunMode?: RunMode;
  remoteServer?: RemoteServerConfig;
}

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
  /** تسجيل معالج لقناة IPC */
  handle(channel: string, fn: (args: unknown) => Promise<unknown>): void;
  /** إرسال حدث للـ UI */
  emit(channel: string, data: unknown): void;
  /** الاستماع لأحداث من الـ UI */
  on(channel: string, fn: (args: unknown) => void): void;
}
