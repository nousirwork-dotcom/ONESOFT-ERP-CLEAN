import type { ProgressEvent, DatabaseConnectionOptions, UpgradeStatus } from '../types.js';
import { VersionDetector }      from './VersionDetector.js';
import { BackupBeforeUpgrade }  from './BackupBeforeUpgrade.js';
import { RollbackManager }      from './RollbackManager.js';
import { MigrationRunner }      from '../database/MigrationRunner.js';
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
      backupDir = await this.backupManager.backup({ dbOpts, backupsDir, currentVersion }, emit);

      // 3. إيقاف الخدمات
      onStatus?.('stopping-services');
      emit({ level: 'info', message: 'جارٍ إيقاف الخدمات...', timestamp: now() });
      const svcMgr = new ServiceManager();
      svcMgr.stop('OneSoft-Server');
      svcMgr.stop('OneSoft-Client');
      emit({ level: 'success', message: 'تم إيقاف الخدمات', timestamp: now() });

      // 4. تشغيل Migrations الجديدة
      onStatus?.('running-migrations');
      const migrator = new MigrationRunner(serverAppPath);
      const result = await migrator.runMigrations(databaseUrl, emit);
      if (result.failed) {
        throw new Error(`فشل Migrations: ${result.failed}`);
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
      const journalPath = path.join(serverAppPath, 'drizzle', 'meta', '_journal.json');
      const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
        entries: Array<{ tag: string }>;
      };
      const expectedSchemaVersion = journal.entries.at(-1)?.tag;
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
      const msg = e instanceof Error ? e.message : String(e);
      emit({ level: 'error', message: `❌ فشلت الترقية: ${msg}`, timestamp: now() });
      emit({ level: 'warning', message: 'جارٍ التراجع تلقائياً...', timestamp: now() });

      onStatus?.('rolling-back');
      if (backupDir && dbOpts) {
        await this.rollback.rollback({ backupDir, dbOpts }, emit);
        onStatus?.('rollback-complete');
      }

      return { success: false, backupDir };
    }
  }
}

function now() { return new Date().toISOString(); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
