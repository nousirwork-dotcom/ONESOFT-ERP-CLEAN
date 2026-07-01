// ─── Installer Core — Shared Types ────────────────────────────────────────────
// هذا الملف هو المرجع الوحيد لجميع الأنواع المشتركة في Installer Core
// يُستخدم من Core وElectron IPC والـ UI

// ══════════════════════════════════════════════════════════════════════════════
// Installation Modes & Run Modes
// ══════════════════════════════════════════════════════════════════════════════

export type InstallMode =
  | 'single-user'
  | 'multi-user'
  | 'branch-server'
  | 'hybrid-cloud'
  | 'cloud-only';

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

export interface OneSoftConfig {
  version: string;
  installMode: InstallMode;
  runMode: RunMode;
  database: DatabaseConfig;
  server: ServerConfig;
  cloud: CloudConfig;
  backup: BackupConfig;
  update: UpdateConfig;
  printing: PrintingConfig;
  license: LicenseConfig;
  paths: PathsConfig;
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

  // Progress stream
  PROGRESS: 'installer:progress',
} as const;
