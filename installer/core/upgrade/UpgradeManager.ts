import type { ProgressEvent, DatabaseConnectionOptions, UpgradeStatus } from '../types.js';
import { VersionDetector }      from './VersionDetector.js';
import { BackupBeforeUpgrade }  from './BackupBeforeUpgrade.js';
import { RollbackManager }      from './RollbackManager.js';
import { MigrationRunner }      from '../database/MigrationRunner.js';
import {
  preflightDatabase,
  validateAdminCredential,
  migrationConnection,
  safeMigrationError,
} from '../database/DatabasePreflight.js';
import { MigrationCredentialStore } from '../security/MigrationCredentialStore.js';
import { DatabaseRoleManager, RUNTIME_ROLE } from '../database/DatabaseRoleManager.js';
import { APP_SCHEMA_VERSION } from '../version.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { ServiceManager }       from '../services/ServiceManager.js';
import { verifyPostUpgrade, verifyPostUpgradeDatabase } from './PostUpgradeVerifier.js';
import { UpgradeDiagnosticLogger } from './UpgradeDiagnosticLogger.js';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

type Emit = (e: ProgressEvent) => void;
type StatusCb = (s: UpgradeStatus) => void;

export class UpgradeManager {
  private readonly versionDetector = new VersionDetector();
  private readonly backupManager   = new BackupBeforeUpgrade();
  private readonly rollback        = new RollbackManager();
  private readonly diagnosticLogger = new UpgradeDiagnosticLogger();

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
  }> {
    const { serverAppPath, backupsDir, dbOpts, databaseUrl, targetVersion } = opts;

    let backupDir: string | undefined;
    let activeStage = 'preflight';
    let failedMigration: string | undefined;
    const originalConfig = snapshotConfig();
    const startStage = (stage: string) => {
      activeStage = stage;
      this.diagnosticLogger.record(stage, 'started');
    };
    const successStage = (stage: string, migration?: string) => {
      this.diagnosticLogger.record(stage, 'success', migration ? { migration } : {});
    };

    try {
      startStage('preflight');
      // Fail closed before creating a backup or stopping services when the
      // machine has neither a protected migrator credential nor a one-time
      // legacy administrator credential. A runtime-only role cannot bootstrap
      // the migration roles or repair ownership.
      const storedMigrationCredential = MigrationCredentialStore.load();
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
      // creating a backup or changing roles. A valid pg_dump alone does not
      // prove that the account may provision roles or repair ownership.
      startStage('admin-credential-validation');
      if (opts.adminDbOpts && (!storedMigrationCredential || opts.forceRoleProvision === true)) {
        try {
          await validateAdminCredential(opts.adminDbOpts);
        } catch (error: unknown) {
          if (isPostgresAuthenticationFailure(error)) {
            throw new Error('بيانات PostgreSQL الإدارية غير صحيحة');
          }
          throw error;
        }
      }
      successStage('admin-credential-validation');

      // 1. اكتشاف النسخة الحالية
      onStatus?.('detecting');
      const current = this.versionDetector.detect();
      const currentVersion = current?.version ?? 'unknown';
      emit({ level: 'info', message: `النسخة الحالية: v${currentVersion}`, timestamp: now() });
      emit({ level: 'info', message: `الترقية إلى: v${targetVersion}`, timestamp: now() });

      // 2. نسخة احتياطية إلزامية
      startStage('backup');
      onStatus?.('backing-up');
      backupDir = await this.backupManager.backup({
        dbOpts: opts.adminDbOpts ?? dbOpts,
        backupsDir,
        currentVersion,
      }, emit);
      successStage('backup');

      // 3. إيقاف الخدمات
      startStage('service-stop');
      onStatus?.('stopping-services');
      emit({ level: 'info', message: 'جارٍ إيقاف الخدمات...', timestamp: now() });
      const svcMgr = new ServiceManager();
      svcMgr.stop('OneSoft-Server');
      svcMgr.stop('OneSoft-Client');
      emit({ level: 'success', message: 'تم إيقاف الخدمات', timestamp: now() });
      successStage('service-stop');

      // 4. لا نبدأ أي DDL قبل إثبات أن اعتماد الترحيل المحمي موجود وصالح.
      // الاعتماد الإداري القديم يُستخدم مرة واحدة فقط لترميم الدور ثم يُزال من
      // active config؛ لا يتم تمريره إلى الواجهة أو تسجيله.
      let migrationCredential = storedMigrationCredential;
      if ((!migrationCredential || opts.forceRoleProvision === true) && opts.adminDbOpts) {
        startStage('role-bootstrap');
        emit({ level: 'warning', message: 'اعتماد الترحيل المحمي غير موجود — جارٍ إنشاءه من اعتماد Legacy صالح مرة واحدة...', timestamp: now() });
        const roleManager = new DatabaseRoleManager();
        const provisioned = await roleManager.provision(opts.adminDbOpts, dbOpts.database, dbOpts.password);
        successStage('role-bootstrap');

        startStage('ownership-repair');
        await roleManager.adoptAllowlistedObjects({ ...opts.adminDbOpts, database: dbOpts.database });
        successStage('ownership-repair');

        startStage('dpapi-credential-create');
        DatabaseRoleManager.saveCredential(provisioned.migration);
        migrationCredential = provisioned.migration;
        successStage('dpapi-credential-create');
      } else {
        successStage('role-bootstrap');
        successStage('ownership-repair');
        successStage('dpapi-credential-create');
      }
      if (!migrationCredential) {
        throw new Error('لا يوجد اعتماد ترحيل محمي صالح. أوقف التحديث بأمان، وأعد تشغيل المثبّت لإصلاح أدوار قاعدة البيانات أولاً.');
      }

      startStage('preflight');
      const migrationTags = readMigrationTags(serverAppPath);
      const preflight = await preflightDatabase(migrationCredential, migrationTags);
      if (!preflight.ok) {
        throw new Error(`فشل فحص قاعدة البيانات قبل الترحيل: ${safeMigrationError(preflight.error ?? 'اتصال غير صالح')}`);
      }
      successStage('preflight');
      emit({
        level: 'info',
        message: `فحص Read-only ناجح: user=${preflight.currentUser ?? '—'}, schema=${preflight.currentSchemaVersion ?? 'مفقود'}, pending=${preflight.pendingMigration ?? 'لا يوجد'}, drift=${preflight.drift.length}`,
        timestamp: now(),
      });
      if (preflight.ownershipDrift.length > 0) {
        if (!opts.adminDbOpts) {
          throw new Error('ملكية كائنات OneSoft غير صحيحة ولا يوجد اعتماد إداري Legacy لإصلاحها — لم يتم تنفيذ أي تغيير');
        }
        startStage('ownership-repair');
        emit({ level: 'warning', message: `تم اكتشاف انحراف ملكية في ${preflight.ownershipDrift.length} كائن — إصلاح Allowlist فقط...`, timestamp: now() });
        await new DatabaseRoleManager().adoptAllowlistedObjects({
          ...opts.adminDbOpts,
          database: dbOpts.database,
        });
        successStage('ownership-repair');
      }
      if (preflight.ledgerDrift.length > 0) {
        throw new Error(`انحراف غير قابل للاستئناف في سجل migrations: ${preflight.ledgerDrift.join('; ')}`);
      }
      if (!preflight.migratorRoleExists || !preflight.schemaOwnerRoleExists) {
        throw new Error('أدوار الترحيل المطلوبة غير موجودة — لم يتم تنفيذ أي تغيير');
      }
      if (!preflight.canSetSchemaOwner) {
        throw new Error('حساب الترحيل لا يستطيع SET ROLE onesoft_schema_owner — لم يتم تنفيذ أي تغيير');
      }

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

      // 6. Apply Foundation with the production engine before any Backend
      // service is started. The one-shot process does not listen on HTTP.
      startStage('foundation');
      onStatus?.('health-check');
      emit({ level: 'info', message: 'جارٍ تطبيق Foundation قبل تشغيل الخادم...', timestamp: now() });
      runFoundationOnly(serverAppPath, databaseUrl, emit);
      successStage('foundation');

      const expectedSchemaVersion = APP_SCHEMA_VERSION;
      if (!expectedSchemaVersion) {
        throw new Error('Journal فارغ — لا يمكن التحقق من إصدار المخطط');
      }
      startStage('verification');
      await verifyPostUpgradeDatabase({
        databaseUrl,
        serverAppPath,
        expectedSchemaVersion,
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
          await this.rollback.rollback({
            backupDir,
            dbOpts: opts.adminDbOpts ?? dbOpts,
          }, emit);
          successStage('rollback');
        } catch (rollbackError: unknown) {
          this.diagnosticLogger.record('rollback', 'failure', { error: safeMigrationError(rollbackError) });
        }
        onStatus?.('rollback-complete');
      } else {
        successStage('rollback');
      }

      return {
        success: false,
        backupDir,
        error: msg,
        stage: failedStage,
        migration: failedMigration,
      };
    }
  }
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
): void {
  // Electron ships a Node-compatible runtime. ELECTRON_RUN_AS_NODE makes the
  // packaged executable run the bundled server entrypoint without depending
  // on a globally installed Node.js or PATH state on the customer machine.
  const nodePath = process.execPath;
  const serverEntry = path.join(serverAppPath, 'dist', 'index.mjs');
  const result = spawnSync(nodePath, [serverEntry], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ELECTRON_RUN_AS_NODE: '1',
      ONESOFT_FOUNDATION_ONLY: '1',
      ONESOFT_UPGRADE_DATABASE_URL: databaseUrl,
    },
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 300_000,
    windowsHide: true,
  });
  const stdout = (result.stdout ?? '').trim();
  const stderr = (result.stderr ?? '').trim();
  if (stdout) emit({ level: 'info', message: `[foundation-only]\n${stdout.slice(-4000)}`, timestamp: now() });
  if (stderr) emit({ level: 'warning', message: `[foundation-only stderr]\n${stderr.slice(-4000)}`, timestamp: now() });
  if (result.error || result.status !== 0) {
    throw new Error(
      `فشل تطبيق Foundation قبل تشغيل الخادم: ${result.error?.message ?? `exit=${result.status ?? 'unknown'}`}`,
    );
  }
}
