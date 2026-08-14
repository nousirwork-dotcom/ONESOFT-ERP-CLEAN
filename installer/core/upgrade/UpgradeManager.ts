import type { ProgressEvent, DatabaseConnectionOptions, UpgradeStatus } from '../types.js';
import { VersionDetector }      from './VersionDetector.js';
import { BackupBeforeUpgrade }  from './BackupBeforeUpgrade.js';
import { RollbackManager, type RollbackResult } from './RollbackManager.js';
import { MigrationRunner }      from '../database/MigrationRunner.js';
import {
  formatOwnershipViolation,
  preflightDatabase,
  validateAdminCredential,
  migrationConnection,
  safeMigrationError,
} from '../database/DatabasePreflight.js';
import type { OwnershipViolation } from '../database/DatabasePreflight.js';
import { MigrationCredentialStore } from '../security/MigrationCredentialStore.js';
import {
  DatabaseRoleManager,
  provisionRepairThenSaveCredential,
  RUNTIME_ROLE,
} from '../database/DatabaseRoleManager.js';
import type { MigrationCredential } from '../security/MigrationCredentialStore.js';
import { APP_SCHEMA_VERSION } from '../version.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { ServiceManager }       from '../services/ServiceManager.js';
import { verifyPostUpgrade, verifyPostUpgradeDatabase } from './PostUpgradeVerifier.js';
import { checkPermissionCompatibility } from '../database/PermissionCompatibilityChecker.js';
import { repairRuntimePrivileges } from '../database/DatabaseRoleManager.js';
import { UpgradeDiagnosticLogger } from './UpgradeDiagnosticLogger.js';
import { PostgreSQLToolsResolver } from '../database/PostgreSQLToolsResolver.js';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';

type Emit = (e: ProgressEvent) => void;
type StatusCb = (s: UpgradeStatus) => void;

type RoleManagerLike = Pick<DatabaseRoleManager, 'provision' | 'adoptAllowlistedObjects'>;
type BackupManagerLike = Pick<BackupBeforeUpgrade, 'backup'>;
type RollbackManagerLike = Pick<RollbackManager, 'rollback'>;
type ServiceManagerLike = Pick<ServiceManager, 'stop' | 'start' | 'getStatus'>;

export interface UpgradeManagerDependencies {
  backupManager?: BackupManagerLike;
  rollbackManager?: RollbackManagerLike;
  roleManagerFactory?: () => RoleManagerLike;
  serviceManager?: ServiceManagerLike;
  loadMigrationCredential?: () => MigrationCredential | null;
  saveMigrationCredential?: (credential: MigrationCredential) => void;
  validateAdminCredential?: (opts: DatabaseConnectionOptions) => Promise<void>;
  postgresToolsResolver?: Pick<PostgreSQLToolsResolver, 'resolveAll'>;
}

export class UpgradeManager {
  private readonly versionDetector = new VersionDetector();
  private readonly backupManager: BackupManagerLike;
  private readonly rollback: RollbackManagerLike;
  private readonly roleManagerFactory: () => RoleManagerLike;
  private readonly serviceManager: ServiceManagerLike;
  private readonly loadMigrationCredential: () => MigrationCredential | null;
  private readonly saveMigrationCredential: (credential: MigrationCredential) => void;
  private readonly validateAdminCredential: (opts: DatabaseConnectionOptions) => Promise<void>;
  private readonly postgresToolsResolver: Pick<PostgreSQLToolsResolver, 'resolveAll'>;
  private readonly diagnosticLogger = new UpgradeDiagnosticLogger();

  constructor(deps: UpgradeManagerDependencies = {}) {
    this.backupManager = deps.backupManager ?? new BackupBeforeUpgrade();
    this.rollback = deps.rollbackManager ?? new RollbackManager();
    this.roleManagerFactory = deps.roleManagerFactory ?? (() => new DatabaseRoleManager());
    this.serviceManager = deps.serviceManager ?? new ServiceManager();
    this.loadMigrationCredential = deps.loadMigrationCredential ?? (() => MigrationCredentialStore.load());
    this.saveMigrationCredential = deps.saveMigrationCredential ?? ((credential) => {
      DatabaseRoleManager.saveCredential(credential);
    });
    this.validateAdminCredential = deps.validateAdminCredential ?? validateAdminCredential;
    this.postgresToolsResolver = deps.postgresToolsResolver ?? new PostgreSQLToolsResolver();
  }

  async upgrade(opts: {
    serverAppPath: string;
    backupsDir: string;
    dbOpts: DatabaseConnectionOptions;
    databaseUrl: string;
    targetVersion: string;
    backendPort?: number;
    adminDbOpts?: DatabaseConnectionOptions;
    forceRoleProvision?: boolean;
  }, emit: Emit, onStatus?: StatusCb): Promise<{
    success: boolean;
    backupDir?: string;
    error?: string;
    stage?: string;
    migration?: string;
    rollback?: RollbackResult;
  }> {
    const { serverAppPath, backupsDir, dbOpts, databaseUrl, targetVersion } = opts;

    let backupDir: string | undefined;
    let activeStage = 'preflight';
    let failedMigration: string | undefined;
    let rollbackResult: RollbackResult | undefined;
    let ownershipRepairPerformed = false;
    let serverWasRunning = false;
    let adminCredentialValidated = false;
    const originalConfig = snapshotConfig();
    const startStage = (stage: string) => {
      activeStage = stage;
      this.diagnosticLogger.record(stage, 'started');
    };
    const successStage = (stage: string, migration?: string) => {
      this.diagnosticLogger.record(stage, 'success', migration ? { migration } : {});
    };
    const ensureAdminCredential = async (): Promise<void> => {
      if (!opts.adminDbOpts || adminCredentialValidated) return;
      startStage('admin-credential-validation');
      try {
        await this.validateAdminCredential(opts.adminDbOpts);
        adminCredentialValidated = true;
      } catch (error: unknown) {
        if (isPostgresAuthenticationFailure(error)) {
          throw new Error('بيانات PostgreSQL الإدارية غير صحيحة');
        }
        throw error;
      }
      successStage('admin-credential-validation');
    };

    try {
      startStage('preflight');
      // Fail closed before creating a backup or stopping services when the
      // machine has neither a protected migrator credential nor a one-time
      // legacy administrator credential. A runtime-only role cannot bootstrap
      // the migration roles or repair ownership.
      const storedMigrationCredential = this.loadMigrationCredential();
      if (
        (!storedMigrationCredential && !opts.adminDbOpts) ||
        (opts.forceRoleProvision === true && !opts.adminDbOpts)
      ) {
        throw new Error(
          'لا يوجد اعتماد ترحيل محمي ولا اعتماد PostgreSQL إداري Legacy. ' +
          'يجب إدخال اعتماد إداري لمرة واحدة لإكمال ترقية قاعدة Legacy بأمان.',
        );
      }
      successStage('preflight');

      // Validate the legacy administrator with a read-only SELECT before
      // creating a backup or changing roles. The same validated credential is
      // also used for a first backup when read-only preflight finds legacy
      // ownership drift.
      if (!storedMigrationCredential || opts.forceRoleProvision === true) {
        await ensureAdminCredential();
      }

      // Resolve and execute-test all PostgreSQL client tools before creating a
      // backup or stopping services. Windows service installations commonly
      // omit PostgreSQL\bin from PATH, so this must not be a PATH-only check.
      startStage('postgres-tools-preflight');
      // A legacy config intentionally points dbOpts at the not-yet-provisioned
      // runtime role. Probe the live server with the already validated admin
      // or protected migrator credential instead; otherwise psql cannot run
      // SHOW server_version_num before role bootstrap.
      const toolConnection = opts.adminDbOpts ?? storedMigrationCredential ?? dbOpts;
      const postgresTools = this.postgresToolsResolver.resolveAll(toolConnection);
      emit({
        level: 'info',
        message: `أدوات PostgreSQL جاهزة: pg_dump=${postgresTools.pgDump}, pg_restore=${postgresTools.pgRestore}, psql=${postgresTools.psql}`,
        timestamp: now(),
      });
      successStage('postgres-tools-preflight');

      // 1. اكتشاف النسخة الحالية
      onStatus?.('detecting');
      const current = this.versionDetector.detect();
      const currentVersion = current?.version ?? 'unknown';
      emit({ level: 'info', message: `النسخة الحالية: v${currentVersion}`, timestamp: now() });
      emit({ level: 'info', message: `الترقية إلى: v${targetVersion}`, timestamp: now() });

      // 2. Read-only preflight must happen before the first backup. If a
      // legacy database has ownership drift, its migrator cannot read every
      // table yet, so the first backup must use the validated admin account.
      const migrationTags = readMigrationTags(serverAppPath);
      startStage('preflight');
      const preflightCredential = storedMigrationCredential ?? opts.adminDbOpts;
      if (!preflightCredential) {
        throw new Error('لا يوجد اعتماد صالح لفحص قاعدة البيانات قبل النسخة الاحتياطية');
      }
      let initialPreflight = await preflightDatabase(preflightCredential, migrationTags);
      if (!initialPreflight.ok && storedMigrationCredential && opts.adminDbOpts) {
        await ensureAdminCredential();
        initialPreflight = await preflightDatabase(opts.adminDbOpts, migrationTags);
      }
      if (!initialPreflight.ok) {
        throw new Error(`فشل فحص قاعدة البيانات قبل النسخة الاحتياطية: ${safeMigrationError(initialPreflight.error ?? 'اتصال غير صالح')}`);
      }
      emit({
        level: 'info',
        message: `فحص Read-only قبل النسخة: user=${initialPreflight.currentUser ?? '—'}, ownershipDrift=${initialPreflight.ownershipDrift.length}, roles=${initialPreflight.migratorRoleExists && initialPreflight.schemaOwnerRoleExists ? 'جاهزة' : 'تحتاج bootstrap'}`,
        timestamp: now(),
      });
      if (initialPreflight.ledgerDrift.length > 0) {
        throw new Error(`انحراف غير قابل للاستئناف في سجل migrations: ${initialPreflight.ledgerDrift.join('; ')}`);
      }
      if (initialPreflight.ownershipDrift.length > 0) {
        logOwnershipViolations(this.diagnosticLogger, emit, initialPreflight.ownershipViolations);
      }

      const requiresRoleRepair =
        !storedMigrationCredential ||
        opts.forceRoleProvision === true ||
        initialPreflight.ownershipDrift.length > 0 ||
        !initialPreflight.migratorRoleExists ||
        !initialPreflight.schemaOwnerRoleExists ||
        !initialPreflight.canSetSchemaOwner;
      const backupCredential = requiresRoleRepair
        ? opts.adminDbOpts
        : storedMigrationCredential;
      const backupCredentialKind = requiresRoleRepair ? 'admin' as const : 'migrator' as const;
      if (!backupCredential) {
        throw new Error(
          'تم اكتشاف Legacy ownership drift أو أدوار غير مكتملة، ولا يوجد اعتماد PostgreSQL إداري للنسخة الأولى — لم يتم تنفيذ أي تغيير',
        );
      }
      if (backupCredentialKind === 'admin') {
        await ensureAdminCredential();
      }
      successStage('preflight');

      // 3. Mandatory first backup. It is the only database operation allowed
      // before role bootstrap/ownership repair.
      startStage('backup');
      onStatus?.('backing-up');
      backupDir = await this.backupManager.backup({
        dbOpts: backupCredential,
        backupsDir,
        currentVersion,
        credential: backupCredentialKind,
      }, emit);
      successStage('backup');

      // 4. Role Bootstrap → Ownership Repair → protected Migrator credential.
      // This is deliberately after a verified first backup.
      let migrationCredential = storedMigrationCredential;
      if (requiresRoleRepair) {
        if (!opts.adminDbOpts) {
          throw new Error('لا يوجد اعتماد إداري لإصلاح أدوار وملكية قاعدة Legacy بعد النسخة الاحتياطية');
        }
        startStage('role-bootstrap');
        emit({
          level: 'warning',
          message: 'تم حفظ النسخة الأولى بنجاح — جارٍ تنفيذ Role Bootstrap ثم Ownership Repair...',
          timestamp: now(),
        });
        const roleManager = this.roleManagerFactory();
        const provisioned = await provisionRepairThenSaveCredential(
          () => roleManager.provision(
            opts.adminDbOpts!,
            dbOpts.database,
            dbOpts.password,
            { preserveRuntimePassword: true },
          ),
          async () => {
            startStage('ownership-repair');
            await roleManager.adoptAllowlistedObjects({
              ...opts.adminDbOpts!,
              database: dbOpts.database,
            });
            ownershipRepairPerformed = true;
          },
          (credential) => {
            startStage('dpapi-credential-create');
            this.saveMigrationCredential(credential);
          },
        );
        migrationCredential = provisioned.migration;
        if (ownershipRepairPerformed) successStage('ownership-repair');
        successStage('role-bootstrap');
        successStage('dpapi-credential-create');
      } else {
        successStage('role-bootstrap');
        successStage('dpapi-credential-create');
      }
      if (!migrationCredential) {
        throw new Error('لا يوجد اعتماد ترحيل محمي بعد إصلاح الأدوار — لم يبدأ Migrations');
      }

      // 5. إيقاف الخدمات بعد نجاح النسخة وإصلاح البنية الأمنية.
      startStage('service-stop');
      onStatus?.('stopping-services');
      emit({ level: 'info', message: 'جارٍ إيقاف الخدمات...', timestamp: now() });
      const svcMgr = this.serviceManager;
      serverWasRunning = ['running', 'starting'].includes(svcMgr.getStatus('OneSoft-Server'));
      svcMgr.stop('OneSoft-Server');
      svcMgr.stop('OneSoft-Client');
      emit({ level: 'success', message: 'تم إيقاف الخدمات', timestamp: now() });
      successStage('service-stop');

      // 6. Verify the post-repair read-only state before migrations.
      startStage('preflight');
      let preflight = await preflightDatabase(migrationCredential, migrationTags);
      if (!preflight.ok) {
        throw new Error(`فشل فحص قاعدة البيانات قبل الترحيل: ${safeMigrationError(preflight.error ?? 'اتصال غير صالح')}`);
      }
      emit({
        level: 'info',
        message: `فحص Read-only ناجح: user=${preflight.currentUser ?? '—'}, schema=${preflight.currentSchemaVersion ?? 'مفقود'}, pending=${preflight.pendingMigration ?? 'لا يوجد'}, drift=${preflight.drift.length}`,
        timestamp: now(),
      });
      if (preflight.ledgerDrift.length > 0) {
        throw new Error(`انحراف غير قابل للاستئناف في سجل migrations: ${preflight.ledgerDrift.join('; ')}`);
      }
      if (preflight.ownershipDrift.length > 0) {
        logOwnershipViolations(this.diagnosticLogger, emit, preflight.ownershipViolations);
        throw new Error(
          `فشل التحقق بعد Ownership Repair: ما زال ${preflight.ownershipDrift.length} كائن OneSoft خارج المالك المتوقع`,
        );
      }
      if (!preflight.migratorRoleExists || !preflight.schemaOwnerRoleExists) {
        throw new Error('أدوار الترحيل المطلوبة غير موجودة — لم يتم تنفيذ أي تغيير');
      }
      if (!preflight.canSetSchemaOwner) {
        throw new Error('حساب الترحيل لا يستطيع SET ROLE onesoft_schema_owner — لم يتم تنفيذ أي تغيير');
      }
      successStage('preflight');

      // 5. تشغيل Migrations بحساب migrator ثم SET ROLE للمالك، وليس بحساب Runtime.
      startStage('migrations');
      onStatus?.('running-migrations');
      const migrator = new MigrationRunner(serverAppPath);
      const migrationEmit: Emit = (event) => {
        emit(event);
        const started = event.message.match(/^تطبيق:\s*(\S+)/);
        if (started?.[1]) {
          this.diagnosticLogger.record('migrations', 'started', { migration: started[1] });
        }
      };
      const result = await migrator.runMigrations(migrationConnection(migrationCredential), migrationEmit);
      if (result.failed) {
        failedMigration = result.failedMigration;
        throw new Error(`فشل Migrations: ${safeMigrationError(result.failed)}`);
      }
      successStage('migrations', result.applied.at(-1) ?? result.skipped.at(-1));

      // After migrations, perform a comprehensive runtime-privilege repair as
      // a safety layer. This ensures onesoft_app has SELECT/INSERT/UPDATE/DELETE
      // on ALL tables including __drizzle_migrations and _schema_version which
      // were created by MigrationRunner under SET ROLE onesoft_schema_owner.
      // The explicit GRANT in MigrationRunner handles the common case; this
      // handles edge cases where DEFAULT PRIVILEGES did not fire correctly.
      startStage('permission-repair');
      try {
        await repairRuntimePrivileges(
          migrationConnection(migrationCredential),
          (msg) => emit({ level: 'info', message: msg, timestamp: now() }),
        );
      } catch (repairError: unknown) {
        emit({
          level: 'error',
          message: `فشل إصلاح الصلاحيات الشاملة: ${safeMigrationError(repairError)}`,
          timestamp: now(),
        });
        throw repairError;
      }
      successStage('permission-repair');

      // Permission compatibility check: verify onesoft_app has all required
      // privileges and emit a detailed diagnostic report.
      startStage('permission-compatibility');
      const adminUrl = opts.adminDbOpts
        ? `postgresql://${encodeURIComponent(opts.adminDbOpts.user)}:${encodeURIComponent(opts.adminDbOpts.password ?? '')}@${opts.adminDbOpts.host}:${opts.adminDbOpts.port ?? 5432}/${encodeURIComponent(dbOpts.database)}`
        : databaseUrl;
      await checkPermissionCompatibility(
        adminUrl,
        migrationConnection(migrationCredential),
        emit,
      );
      successStage('permission-compatibility');

      // 6. Apply Foundation with the production engine before any Backend
      // service is started. The one-shot process does not listen on HTTP.
      startStage('foundation');
      onStatus?.('health-check');
      emit({ level: 'info', message: 'جارٍ تطبيق Foundation قبل تشغيل الخادم...', timestamp: now() });
      runFoundationOnly(
        serverAppPath,
        migrationFoundationConnection(migrationCredential),
        emit,
        this.diagnosticLogger,
      );
      successStage('foundation');

      const expectedSchemaVersion = APP_SCHEMA_VERSION;
      if (!expectedSchemaVersion) {
        throw new Error('Journal فارغ — لا يمكن التحقق من إصدار المخطط');
      }
      startStage('verification');
      const adminUrlForDiagnostic = opts.adminDbOpts
        ? `postgresql://${encodeURIComponent(opts.adminDbOpts.user)}:${encodeURIComponent(opts.adminDbOpts.password ?? '')}@${opts.adminDbOpts.host}:${opts.adminDbOpts.port ?? 5432}/${encodeURIComponent(dbOpts.database)}`
        : undefined;
      await verifyPostUpgradeDatabase({
        databaseUrl,
        serverAppPath,
        expectedSchemaVersion,
        adminUrl: adminUrlForDiagnostic,
      }, emit);
      successStage('verification');

      // The service reads config.json at process start. Commit the runtime
      // connection only after all pre-service DB work has succeeded; the
      // original bytes are restored below if any later service/health step
      // fails.
      persistRuntimeConfig(dbOpts);

      // 7. تشغيل الخدمات only after migrations and Foundation verification.
      startStage('service-start');
      onStatus?.('starting-services');
      emit({ level: 'info', message: 'جارٍ تشغيل الخدمات...', timestamp: now() });
      const backendStart = svcMgr.start('OneSoft-Server');
      if (!backendStart.success) {
        throw new Error(`تعذّر تشغيل خدمة الخادم: ${backendStart.error ?? 'خطأ غير معروف'}`);
      }
      await sleep(2000);
      // OneSoft-Client is no longer installed by the current deployment
      // model. Preserve compatibility with machines that still have the
      // legacy service, but never make it a prerequisite for an upgrade.
      if (svcMgr.getStatus('OneSoft-Client') !== 'not-installed') {
        const clientStart = svcMgr.start('OneSoft-Client');
        if (!clientStart.success) {
          throw new Error(`تعذّر تشغيل خدمة العميل: ${clientStart.error ?? 'خطأ غير معروف'}`);
        }
      }
      emit({ level: 'success', message: 'تم تشغيل الخدمات', timestamp: now() });
      successStage('service-start');

      onStatus?.('health-check');
      startStage('health-check');
      emit({ level: 'info', message: 'جارٍ التحقق من health/schema/Foundation والروابط...', timestamp: now() });
      if (!expectedSchemaVersion) {
        throw new Error('Journal فارغ — لا يمكن التحقق من إصدار المخطط');
      }
      await verifyPostUpgrade({
        databaseUrl,
        backendPort: opts.backendPort ?? 3000,
        serverAppPath,
        expectedSchemaVersion,
      }, emit);
      successStage('health-check');

      onStatus?.('complete');
      emit({ level: 'success', message: `✅ اكتملت الترقية إلى v${targetVersion} بنجاح`, timestamp: now() });
      return { success: true, backupDir };

    } catch (e: unknown) {
      restoreConfig(originalConfig);
      const msg = safeMigrationError(e);
      const failedStage = activeStage;
      this.diagnosticLogger.record(activeStage, 'failure', {
        error: msg,
        migration: failedMigration,
      });
      emit({ level: 'error', message: `❌ فشلت الترقية: ${msg}`, timestamp: now() });
      emit({ level: 'warning', message: 'جارٍ التراجع تلقائياً...', timestamp: now() });

      startStage('rollback');
      onStatus?.('rolling-back');
      if (backupDir && dbOpts) {
        try {
          const roleBootstrapRollback = failedStage === 'role-bootstrap'
            ? 'atomic-rollback' as const
            : failedStage === 'preflight' || failedStage === 'admin-credential-validation' ||
                failedStage === 'backup' || failedStage === 'service-stop'
              ? 'not-attempted' as const
              : 'preserved' as const;
          const ownershipRollback = failedStage === 'ownership-repair'
            ? 'atomic-rollback' as const
            : failedStage === 'preflight' || failedStage === 'admin-credential-validation' ||
                failedStage === 'backup' || failedStage === 'service-stop' ||
                failedStage === 'role-bootstrap'
              ? 'not-attempted' as const
              : 'preserved' as const;
          rollbackResult = await this.rollback.rollback({
            backupDir,
            dbOpts: opts.adminDbOpts ?? dbOpts,
            roleBootstrapRollback,
            ownershipRollback,
            restartServer: serverWasRunning,
          }, emit);
          if (rollbackResult.ok) {
            successStage('rollback');
          } else {
            this.diagnosticLogger.record('rollback', 'failure', {
              error: `rollback-incomplete: ${JSON.stringify(rollbackResult)}`,
              rollbackStages: rollbackDiagnosticStages(rollbackResult),
            });
          }
        } catch (rollbackError: unknown) {
          rollbackResult = {
            ok: false,
            databaseRollback: 'failed',
            roleBootstrapRollback: 'failed',
            ownershipRollback: 'failed',
            serviceRollback: 'failed',
          };
          this.diagnosticLogger.record('rollback', 'failure', { error: safeMigrationError(rollbackError) });
        }
        onStatus?.('rollback-complete');
      } else {
        rollbackResult = {
          ok: true,
          databaseRollback: 'not-attempted',
          roleBootstrapRollback: 'not-attempted',
          ownershipRollback: 'not-attempted',
          serviceRollback: 'not-attempted',
        };
        successStage('rollback');
      }

      return {
        success: false,
        backupDir,
        error: msg,
        stage: failedStage,
        migration: failedMigration,
        rollback: rollbackResult,
      };
    }
  }
}

function logOwnershipViolations(
  diagnosticLogger: UpgradeDiagnosticLogger,
  emit: Emit,
  violations: OwnershipViolation[],
): void {
  if (!violations.length) return;
  const firstTwenty = violations.slice(0, 20);
  const details = firstTwenty.map(formatOwnershipViolation);
  emit({
    level: 'warning',
    message: `تفاصيل أول ${firstTwenty.length} مخالفة ownership:\n${details.join('\n')}`,
    timestamp: now(),
  });
  diagnosticLogger.record('preflight', 'failure', {
    error: `ownership drift: ${violations.length} OneSoft objects`,
    ownershipViolations: firstTwenty,
  });
}

function now() { return new Date().toISOString(); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function isPostgresAuthenticationFailure(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === '28P01'
    || /password authentication failed|authentication failed/i.test(String(candidate.message ?? error));
}

function readMigrationTags(serverAppPath: string): string[] {
  const journalPath = path.join(serverAppPath, 'drizzle', 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
    entries?: Array<{ tag: string }>;
  };
  return (journal.entries ?? []).map((entry) => entry.tag);
}

function persistRuntimeConfig(dbOpts: DatabaseConnectionOptions): void {
  if (!ConfigManager.exists()) return;
  const config = ConfigManager.load();
  if (
    config.database.user === RUNTIME_ROLE &&
    config.database.password === dbOpts.password
  ) {
    return;
  }
  ConfigManager.save({
    ...config,
    database: {
      ...config.database,
      user: RUNTIME_ROLE,
      password: dbOpts.password,
    },
  });
}

function snapshotConfig(): Buffer | undefined {
  if (!ConfigManager.exists()) return undefined;
  return fs.readFileSync(ConfigManager.getConfigPath());
}

function restoreConfig(snapshot: Buffer | undefined): void {
  if (!snapshot || !ConfigManager.exists()) return;
  const configPath = ConfigManager.getConfigPath();
  const temporary = `${configPath}.rollback-${process.pid}`;
  try {
    fs.writeFileSync(temporary, snapshot, { mode: 0o600 });
    fs.renameSync(temporary, configPath);
  } catch {
    try { fs.rmSync(temporary, { force: true }); } catch { /* best effort */ }
  }
}

function runFoundationOnly(
  serverAppPath: string,
  databaseUrl: string,
  emit: Emit,
  diagnosticLogger: UpgradeDiagnosticLogger,
): void {
  // Electron ships a Node-compatible runtime. ELECTRON_RUN_AS_NODE makes the
  // packaged executable run the bundled server entrypoint without depending
  // on a globally installed Node.js or PATH state on the customer machine.
  const nodePath = process.execPath;
  const serverEntry = path.join(serverAppPath, 'dist', 'index.mjs');
  const sourceEntry = path.join(serverAppPath, 'src', 'index.ts');
  const tsxEntry = path.join(serverAppPath, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const entrypoint = fs.existsSync(serverEntry)
    ? [serverEntry]
    : fs.existsSync(tsxEntry) && fs.existsSync(sourceEntry)
      ? [tsxEntry, sourceEntry]
      : null;
  if (!entrypoint) {
    throw new Error(`ملف الخادم المبني غير موجود: ${serverEntry}`);
  }
  const foundationDataPath = path.join(serverAppPath, 'src', 'foundation-data.json');
  const foundationMetadata = readFoundationMetadata(foundationDataPath);
  const command = [nodePath, ...entrypoint].map(quoteCommandArg).join(' ');
  const result = spawnSync(nodePath, entrypoint, {
    env: {
      ...process.env,
      // Prevent an unrelated installer/session DATABASE_URL from being
      // selected by fallback code. The foundation-only override is the sole
      // connection source for this child.
      DATABASE_URL: '',
      NODE_ENV: 'production',
      ELECTRON_RUN_AS_NODE: '1',
      ONESOFT_FOUNDATION_ONLY: '1',
      ONESOFT_UPGRADE_DATABASE_URL: databaseUrl,
      ...(fs.existsSync(foundationDataPath)
        ? { FOUNDATION_DATA_PATH: foundationDataPath }
        : {}),
    },
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 300_000,
    windowsHide: true,
  });
  const stdout = String(result.stdout ?? '');
  const stderr = String(result.stderr ?? '');
  const stdoutTail = stdout.slice(-4000);
  const stderrTail = stderr.slice(-4000);
  const timedOut = (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT'
    || result.status === null;
  const exitCode = result.status;
  const signal = result.signal ? String(result.signal) : null;
  const childError = result.error
    ? `${(result.error as NodeJS.ErrnoException).code ?? 'spawn-error'}: ${result.error.message}`
    : null;
  const foundation = {
    executable: nodePath,
    command,
    exitCode,
    signal,
    timedOut,
    schemaVersion: APP_SCHEMA_VERSION,
    foundationHash: foundationMetadata.hash,
    foundationVersion: foundationMetadata.version,
    stdout,
    stderr,
    stdoutTail,
    stderrTail,
  };

  if (stdout) emit({ level: 'info', message: `[foundation-only stdout]\n${stdoutTail}`, timestamp: now() });
  if (stderr) emit({ level: 'warning', message: `[foundation-only stderr]\n${stderrTail}`, timestamp: now() });
  emit({
    level: result.error || exitCode !== 0 ? 'error' : 'success',
    message: `[foundation-only] executable=${nodePath} exit=${exitCode ?? 'unknown'}`
      + ` schema=${APP_SCHEMA_VERSION}`
      + ` foundationHash=${foundationMetadata.hash ?? 'unknown'}`
      + ` foundationVersion=${foundationMetadata.version ?? 'unknown'}`,
    timestamp: now(),
  });

  const foundationFailed = Boolean(result.error || exitCode !== 0);
  const diagnosticMessage = foundationFailed
    ? [
        `فشل تطبيق Foundation قبل تشغيل الخادم: ${
          childError ?? (timedOut ? 'timeout after 300000ms' : `exit=${exitCode ?? 'unknown'}`)
        }`,
        `schema=${APP_SCHEMA_VERSION}`,
        `foundationHash=${foundationMetadata.hash ?? 'unknown'}`,
        `foundationVersion=${foundationMetadata.version ?? 'unknown'}`,
        `stdoutTail=${stdoutTail || '(فارغ)'}`,
        `stderrTail=${stderrTail || '(فارغ)'}`,
      ].join('\n')
    : undefined;
  diagnosticLogger.record('foundation', foundationFailed ? 'failure' : 'success', {
    ...(diagnosticMessage ? { error: diagnosticMessage } : {}),
    foundation,
  });

  if (foundationFailed) {
    throw new Error(diagnosticMessage!);
  }
}

function migrationFoundationConnection(credential: MigrationCredential): string {
  const url = new URL(migrationConnection(credential));
  // pg establishes every pooled session as onesoft_migrator, then applies the
  // schema-owner role before Foundation touches tables. This is intentionally
  // scoped to the one-shot upgrade child; runtime config remains onesoft_app.
  url.searchParams.set('options', '-c role=onesoft_schema_owner');
  return url.toString();
}

function readFoundationMetadata(filePath: string): {
  hash: string | null;
  version: string | null;
} {
  try {
    const raw = fs.readFileSync(filePath);
    const parsed = JSON.parse(raw.toString('utf8')) as { exportedAt?: unknown };
    return {
      hash: createHash('sha256').update(raw).digest('hex'),
      version: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
    };
  } catch {
    return { hash: null, version: null };
  }
}

function quoteCommandArg(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function rollbackDiagnosticStages(result: RollbackResult): Record<string, { status: string; error?: string }> {
  return {
    database: { status: result.databaseRollback, error: result.errors?.database },
    config: { status: result.configRollback ?? 'unknown', error: result.errors?.config },
    roleBootstrap: { status: result.roleBootstrapRollback },
    ownership: { status: result.ownershipRollback },
    service: { status: result.serviceRollback, error: result.errors?.service },
  };
}
