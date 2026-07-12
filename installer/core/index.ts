// ─── OneSoft Installer Core — Public API ─────────────────────────────────────
// هذا الملف هو الواجهة العامة الوحيدة للـ Core
// يُستخدم من: Electron IPC, CLI, أي واجهة مستقبلية

export * from './types.js';

// Config
export { ConfigManager, buildDefaultConfig } from './config/ConfigManager.js';

// Requirements
export { RequirementChecker }   from './requirements/RequirementChecker.js';
export { NodeJsFixer }          from './requirements/fixers/NodeJsFixer.js';
export { PostgreSQLFixer }      from './requirements/fixers/PostgreSQLFixer.js';

// Database
export { ConnectionTester }     from './database/ConnectionTester.js';
export { DatabaseInstaller }    from './database/DatabaseInstaller.js';
export { MigrationRunner }      from './database/MigrationRunner.js';
export { ExistingDbDetector }   from './database/ExistingDbDetector.js';
export type { ExistingDbInfo }  from './database/ExistingDbDetector.js';

// Setup
export { OrganizationCreator }  from './setup/OrganizationCreator.js';
export { UserCreator }          from './setup/UserCreator.js';
export { AccountSeeder }        from './setup/AccountSeeder.js';

// Services
export { ServiceManager }       from './services/ServiceManager.js';

// Filesystem
export { DirectoryCreator }     from './filesystem/DirectoryCreator.js';
export { ShortcutCreator }      from './filesystem/ShortcutCreator.js';
export { RegistryWriter }       from './filesystem/RegistryWriter.js';

// Health
export { HealthChecker }        from './health/HealthChecker.js';

// Upgrade
export { VersionDetector }      from './upgrade/VersionDetector.js';
export { BackupBeforeUpgrade }  from './upgrade/BackupBeforeUpgrade.js';
export { RollbackManager }      from './upgrade/RollbackManager.js';
export { UpgradeManager }       from './upgrade/UpgradeManager.js';

// Uninstall
export { UninstallManager }     from './uninstall/UninstallManager.js';
export type { UninstallOptions } from './uninstall/UninstallManager.js';

// Deployment Orchestrator — المرجع الوحيد لحسابات النشر
export { DeploymentOrchestrator } from './deployment/DeploymentOrchestrator.js';

// Change Deployment — تغيير نوع التثبيت أو طرق الاستخدام بدون إعادة تثبيت
export { ChangeModeManager }    from './change/ChangeModeManager.js';

// Repair
export { RepairManager }        from './repair/RepairManager.js';

// Database Migrator — نقل DB إلى جهاز آخر
export { DatabaseMigrator }     from './database/DatabaseMigrator.js';
