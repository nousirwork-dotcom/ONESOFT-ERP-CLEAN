import type { ProgressEvent, DatabaseConnectionOptions, UpgradeStatus } from '../types.js';
import { VersionDetector }      from './VersionDetector.js';
import { BackupBeforeUpgrade }  from './BackupBeforeUpgrade.js';
import { RollbackManager }      from './RollbackManager.js';
import { MigrationRunner }      from '../database/MigrationRunner.js';
import { preflightDatabase, migrationConnection, safeMigrationError } from '../database/DatabasePreflight.js';
import { MigrationCredentialStore } from '../security/MigrationCredentialStore.js';
import { DatabaseRoleManager } from '../database/DatabaseRoleManager.js';
import { APP_SCHEMA_VERSION } from '../version.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { ServiceManager }       from '../services/ServiceManager.js';
import { verifyPostUpgrade }    from './PostUpgradeVerifier.js';
import * as fs from 'fs';
import * as path from 'path';

type Emit = (e: ProgressEvent) => void;
type StatusCb = (s: UpgradeStatus) => void;

export class UpgradeManager {
  private readonly versionDetector = new VersionDetector();
  private readonly backupManager   = new BackupBeforeUpgrade();
  private readonly rollback        = new RollbackManager();

  async upgrade(opts: {
    serverAppPath: string;
    backupsDir: string;
    dbOpts: DatabaseConnectionOptions;
    databaseUrl: string;
    targetVersion: string;
    backendPort?: number;
    adminDbOpts?: DatabaseConnectionOptions;
  }, emit: Emit, onStatus?: StatusCb): Promise<{ success: boolean; backupDir?: string }> {
    const { serverAppPath, backupsDir, dbOpts, databaseUrl, targetVersion } = opts;

    let backupDir: string | undefined;

    try {
      // 1. اكتشاف النسخة الحالية
      onStatus?.('detecting');
      const current = this.versionDetector.detect();
      const currentVersion = current?.version ?? 'unknown';
      emit({ level: 'info', message: `النسخة الحالية: v${currentVersion}`, timestamp: now() });
      emit({ level: 'info', message: `الترقية إلى: v${targetVersion}`, timestamp: now() });

      // 2. نسخة احتياطية إلزامية
      onStatus?.('backing-up');
      backupDir = await this.backupManager.backup({
        dbOpts: opts.adminDbOpts ?? dbOpts,
        backupsDir,
        currentVersion,
      }, emit);

      // 3. إيقاف الخدمات
      onStatus?.('stopping-services');
      emit({ level: 'info', message: 'جارٍ إيقاف الخدمات...', timestamp: now() });
      const svcMgr = new ServiceManager();
      svcMgr.stop('OneSoft-Server');
      svcMgr.stop('OneSoft-Client');
      emit({ level: 'success', message: 'تم إيقاف الخدمات', timestamp: now() });

      // 4. لا نبدأ أي DDL قبل إثبات أن اعتماد الترحيل المحمي موجود وصالح.
      // الاعتماد الإداري القديم يُستخدم مرة واحدة فقط لترميم الدور ثم يُزال من
      // active config؛ لا يتم تمريره إلى الواجهة أو تسجيله.
      let migrationCredential = MigrationCredentialStore.load();
      if (!migrationCredential && opts.adminDbOpts) {
        emit({ level: 'warning', message: 'اعتماد الترحيل المحمي غير موجود — جارٍ إنشاءه من اعتماد Legacy صالح مرة واحدة...', timestamp: now() });
        const roleManager = new DatabaseRoleManager();
        const provisioned = await roleManager.provision(opts.adminDbOpts, dbOpts.database, dbOpts.password);
        await roleManager.adoptAllowlistedObjects({ ...opts.adminDbOpts, database: dbOpts.database });
        DatabaseRoleManager.saveCredential(provisioned.migration);
        ConfigManager.removeLegacyAdminCredentials();
        migrationCredential = provisioned.migration;
      }
      // Also scrub stale legacy fields when a protected credential already
      // exists. This makes the transition idempotent after an interrupted run.
      ConfigManager.removeLegacyAdminCredentials();
      if (!migrationCredential) {
        throw new Error('لا يوجد اعتماد ترحيل محمي صالح. أوقف التحديث بأمان، وأعد تشغيل المثبّت لإصلاح أدوار قاعدة البيانات أولاً.');
      }

      const migrationTags = readMigrationTags(serverAppPath);
      const preflight = await preflightDatabase(migrationCredential, migrationTags);
      if (!preflight.ok) {
        throw new Error(`فشل فحص قاعدة البيانات قبل الترحيل: ${safeMigrationError(preflight.error ?? 'اتصال غير صالح')}`);
      }
      emit({
        level: 'info',
        message: `فحص Read-only ناجح: user=${preflight.currentUser ?? '—'}, schema=${preflight.currentSchemaVersion ?? 'مفقود'}, pending=${preflight.pendingMigration ?? 'لا يوجد'}, drift=${preflight.drift.length}`,
        timestamp: now(),
      });
      if (preflight.ownershipDrift.length > 0) {
        if (!opts.adminDbOpts) {
          throw new Error('ملكية كائنات OneSoft غير صحيحة ولا يوجد اعتماد إداري Legacy لإصلاحها — لم يتم تنفيذ أي تغيير');
        }
        emit({ level: 'warning', message: `تم اكتشاف انحراف ملكية في ${preflight.ownershipDrift.length} كائن — إصلاح Allowlist فقط...`, timestamp: now() });
        await new DatabaseRoleManager().adoptAllowlistedObjects({
          ...opts.adminDbOpts,
          database: dbOpts.database,
        });
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
      onStatus?.('running-migrations');
      const migrator = new MigrationRunner(serverAppPath);
      const result = await migrator.runMigrations(migrationConnection(migrationCredential), emit);
      if (result.failed) {
        throw new Error(`فشل Migrations: ${safeMigrationError(result.failed)}`);
      }

      // 5. تشغيل الخدمات
      onStatus?.('starting-services');
      emit({ level: 'info', message: 'جارٍ تشغيل الخدمات...', timestamp: now() });
      const backendStart = svcMgr.start('OneSoft-Server');
      if (!backendStart.success) {
        throw new Error(`تعذّر تشغيل خدمة الخادم: ${backendStart.error ?? 'خطأ غير معروف'}`);
      }
      await sleep(2000);
      const clientStart = svcMgr.start('OneSoft-Client');
      if (!clientStart.success) {
        throw new Error(`تعذّر تشغيل خدمة العميل: ${clientStart.error ?? 'خطأ غير معروف'}`);
      }
      emit({ level: 'success', message: 'تم تشغيل الخدمات', timestamp: now() });

      onStatus?.('health-check');
      emit({ level: 'info', message: 'جارٍ التحقق من health/schema/Foundation والروابط...', timestamp: now() });
       const expectedSchemaVersion = APP_SCHEMA_VERSION;
      if (!expectedSchemaVersion) {
        throw new Error('Journal فارغ — لا يمكن التحقق من إصدار المخطط');
      }
      await verifyPostUpgrade({
        databaseUrl,
        backendPort: opts.backendPort ?? 3000,
        serverAppPath,
        expectedSchemaVersion,
      }, emit);

      onStatus?.('complete');
      emit({ level: 'success', message: `✅ اكتملت الترقية إلى v${targetVersion} بنجاح`, timestamp: now() });
      return { success: true, backupDir };

    } catch (e: unknown) {
      const msg = safeMigrationError(e);
      emit({ level: 'error', message: `❌ فشلت الترقية: ${msg}`, timestamp: now() });
      emit({ level: 'warning', message: 'جارٍ التراجع تلقائياً...', timestamp: now() });

      onStatus?.('rolling-back');
      if (backupDir && dbOpts) {
        await this.rollback.rollback({
          backupDir,
          dbOpts: opts.adminDbOpts ?? dbOpts,
        }, emit);
        onStatus?.('rollback-complete');
      }

      return { success: false, backupDir };
    }
  }
}

function now() { return new Date().toISOString(); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function readMigrationTags(serverAppPath: string): string[] {
  const journalPath = path.join(serverAppPath, 'drizzle', 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
    entries?: Array<{ tag: string }>;
  };
  return (journal.entries ?? []).map((entry) => entry.tag);
}
