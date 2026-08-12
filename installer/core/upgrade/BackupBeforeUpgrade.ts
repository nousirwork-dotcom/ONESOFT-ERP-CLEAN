import { execFileSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type { ProgressEvent, DatabaseConnectionOptions } from '../types.js';
import {
  buildPostgreSQLConnectionArgs,
  buildMigratorPgDumpArgs,
  POSTGRES_SCHEMA_OWNER_PG_DUMP_ARG,
  PostgreSQLToolsResolver,
} from '../database/PostgreSQLToolsResolver.js';

type Emit = (e: ProgressEvent) => void;
export type PreUpgradeBackupCredential = 'admin' | 'migrator';

export class BackupBeforeUpgrade {
  async backup(opts: {
    dbOpts: DatabaseConnectionOptions;
    backupsDir: string;
    currentVersion: string;
    credential?: PreUpgradeBackupCredential;
  }, emit: Emit): Promise<string> {
    const {
      dbOpts,
      backupsDir,
      currentVersion,
      credential = 'migrator',
    } = opts;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `pre-upgrade-v${currentVersion}-${timestamp}`;
    const backupDir = path.join(backupsDir, backupName);

    fs.mkdirSync(backupDir, { recursive: true });

    emit({ level: 'info', message: 'جارٍ إنشاء نسخة احتياطية قبل الترقية...', timestamp: now() });

    // dump قاعدة البيانات
    const dumpFile = path.join(backupDir, 'database.sql');
    emit({ level: 'info', message: 'جارٍ حفظ قاعدة البيانات...', timestamp: now() });

    try {
      // ✅ تحقق من جميع المدخلات قبل الإدراج في shell command
      const host     = validateHost(dbOpts.host);
      const port     = validatePort(dbOpts.port);
      const user     = validateIdentifier(dbOpts.user);
      const database = validateIdentifier(dbOpts.database);

      const pgDump = new PostgreSQLToolsResolver().resolveAll(dbOpts).pgDump;
      emit({ level: 'info', message: `تم اكتشاف pg_dump.exe: ${pgDump}`, timestamp: now() });
      const env = { ...process.env, PGPASSWORD: dbOpts.password };
      const pgDumpArgs = credential === 'migrator'
        ? buildMigratorPgDumpArgs({
            host,
            port,
            user,
            database,
            password: dbOpts.password,
          })
        : buildPostgreSQLConnectionArgs({
            host,
            port,
            user,
            database,
            password: dbOpts.password,
          });
      if (credential === 'migrator' && !pgDumpArgs.includes(POSTGRES_SCHEMA_OWNER_PG_DUMP_ARG)) {
        throw new Error(
          `تم رفض تشغيل pg_dump: argument مفقود ${POSTGRES_SCHEMA_OWNER_PG_DUMP_ARG}`,
        );
      }
      emit({
        level: 'info',
        message: credential === 'migrator'
          ? `تم التحقق من أمر pg_dump قبل الترقية: -U ${user} ${POSTGRES_SCHEMA_OWNER_PG_DUMP_ARG}`
          : `تم التحقق من أمر pg_dump الإداري قبل إصلاح Legacy ownership: -U ${user} (بدون --role)`,
        timestamp: now(),
      });

      execFileSync(pgDump, [
        ...pgDumpArgs,
        '-F', 'p', '-f', dumpFile,
      ], { env, stdio: 'pipe', timeout: 300_000, windowsHide: true });
      const dumpStats = fs.statSync(dumpFile);
      if (!dumpStats.isFile() || dumpStats.size < 128) {
        throw new Error('pg_dump produced an empty or incomplete backup');
      }
      emit({ level: 'success', message: `تم حفظ قاعدة البيانات: ${dumpFile}`, timestamp: now() });
    } catch (e: unknown) {
      throw new Error(`فشل إنشاء/التحقق من النسخة الاحتياطية: ${e instanceof Error ? e.message : String(e)}`);
    }

    // حفظ ملف الإعدادات
    const configSrc = path.join(process.env['ProgramData'] || 'C:\\ProgramData', 'OneSoft', 'config', 'onesoft.config.json');
    if (fs.existsSync(configSrc)) {
      try {
        const raw = JSON.parse(fs.readFileSync(configSrc, 'utf8')) as {
          database?: Record<string, unknown>;
        };
        if (raw.database) {
          delete raw.database['adminUser'];
          delete raw.database['adminPassword'];
        }
        fs.writeFileSync(
          path.join(backupDir, 'onesoft.config.json'),
          `${JSON.stringify(raw, null, 2)}\n`,
          { encoding: 'utf8', mode: 0o600 },
        );
      } catch {
        // Do not copy an unreadable legacy config: it may contain plaintext
        // administrative credentials that must not enter a new backup.
        emit({ level: 'warning', message: 'تعذّر قراءة config القديم — تم تخطي نسخه لحماية بيانات الاعتماد', timestamp: now() });
      }
      emit({ level: 'success', message: 'تم حفظ ملف الإعدادات بدون اعتماد المدير القديم', timestamp: now() });
    }

    emit({ level: 'success', message: `النسخة الاحتياطية محفوظة في: ${backupDir}`, timestamp: now() });
    return backupDir;
  }
}

/** يتحقق أن الاسم يحتوي فقط على أحرف وأرقام وشرطة سفلية */
function validateIdentifier(value: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    throw new Error(`قيمة غير صالحة للمُعرِّف: "${value}"`);
  }
  return value;
}

/** يتحقق أن host عنوان IP أو hostname بسيط (بدون مسافات أو shell metacharacters) */
function validateHost(host: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(host)) {
    throw new Error(`عنوان host غير صالح: "${host}"`);
  }
  return host;
}

/** يتحقق أن المنفذ رقم صحيح */
function validatePort(port: number): number {
  const n = Number(port);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`رقم المنفذ غير صالح: "${port}"`);
  }
  return n;
}

function now() { return new Date().toISOString(); }
