// Type declarations for Electron contextBridge API exposed as window.installer

interface InstallerAPI {
  // Window
  minimize: () => Promise<void>;
  close: () => Promise<void>;
  openUrl: (url: string) => Promise<void>;

  // Requirements
  checkRequirements: () => Promise<import('../core/types').RequirementsReport>;
  fixRequirement: (id: string) => Promise<{ ok: boolean }>;

  // Database
  testConnection: (opts: import('../core/types').DatabaseConnectionOptions) => Promise<{ ok: boolean; detail: string; ms: number }>;
  installPostgres: (password: string) => Promise<void>;
  createDatabase: (opts: {
    adminOpts: import('../core/types').DatabaseConnectionOptions;
    dbName: string; appUser: string; appPassword: string;
  }) => Promise<{ ok: boolean }>;
  runMigrations: (url: string) => Promise<import('../core/types').MigrationResult>;

  // Setup
  createOrganization: (opts: {
    databaseUrl: string;
    org: import('../core/types').OrganizationSetup;
  }) => Promise<{ id: number; code: string }>;
  createUser: (opts: {
    databaseUrl: string; orgId: number;
    user: import('../core/types').FirstUserSetup;
  }) => Promise<{ id: number }>;
  seedAccounts: (url: string) => Promise<{ ok: boolean }>;

  // Services
  installServices: (opts: { installDir: string; logsDir: string; runMode: string }) => Promise<{ ok: boolean }>;
  getServiceStatus: (name: string) => Promise<import('../core/types').ServiceStatus>;
  startService: (name: string) => Promise<import('../core/types').ServiceOperationResult>;
  stopService: (name: string) => Promise<import('../core/types').ServiceOperationResult>;
  restartService: (name: string) => Promise<import('../core/types').ServiceOperationResult>;

  // Filesystem
  createDirectories: (paths: import('../core/types').PathsConfig) => Promise<{ ok: boolean }>;
  createShortcuts: (opts: { installDir: string; appExe: string; iconPath: string }) => Promise<{ ok: boolean }>;
  writeRegistry: (opts: {
    installDir: string; version: string;
    uninstallExe: string; iconPath: string; sizeKB: number;
  }) => Promise<{ ok: boolean }>;

  // Health
  runHealthCheck: (opts: {
    dbOpts: import('../core/types').DatabaseConnectionOptions;
    backendPort: number; frontendPort: number;
  }) => Promise<import('../core/types').HealthReport>;

  // Config
  getConfig: () => Promise<import('../core/types').OneSoftConfig | null>;
  saveConfig: (cfg: Partial<import('../core/types').OneSoftConfig>) => Promise<{ ok: boolean }>;

  // Upgrade
  detectVersion: () => Promise<import('../core/types').VersionInfo | null>;
  runUpgrade: (opts: unknown) => Promise<{ success: boolean; backupDir?: string }>;
  rollback: (opts: unknown) => Promise<{ ok: boolean }>;

  // Uninstall
  uninstall: (opts: import('../core/uninstall/UninstallManager').UninstallOptions) => Promise<{ ok: boolean }>;

  // Progress stream
  onProgress: (cb: (e: import('../core/types').ProgressEvent) => void) => () => void;
}

declare global {
  interface Window {
    installer?: InstallerAPI;
  }
}

export {};
