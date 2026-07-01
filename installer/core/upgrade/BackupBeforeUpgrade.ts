import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type { ProgressEvent, DatabaseConnectionOptions } from '../types.js';

type Emit = (e: ProgressEvent) => void;

export class BackupBeforeUpgrade {
  async backup(opts: {
    dbOpts: DatabaseConnectionOptions;
    backupsDir: string;
    currentVersion: string;
  }, emit: Emit): Promise<string> {
    const { dbOpts, backupsDir, currentVersion } = opts;
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

      const pgDump = findPgDump();
      const env = { ...process.env, PGPASSWORD: dbOpts.password };

      execSync(
        `"${pgDump}" -h ${host} -p ${port} -U ${user} -d ${database} -F p -f "${dumpFile}"`,
        { env, stdio: 'pipe', timeout: 300_000 },
      );
      emit({ level: 'success', message: `تم حفظ قاعدة البيانات: ${dumpFile}`, timestamp: now() });
    } catch (e: unknown) {
      emit({ level: 'warning', message: `تحذير: فشل dump قاعدة البيانات — ${e instanceof Error ? e.message : String(e)}`, timestamp: now() });
    }

    // حفظ ملف الإعدادات
    const configSrc = path.join(process.env['ProgramData'] || 'C:\\ProgramData', 'OneSoft', 'config', 'onesoft.config.json');
    if (fs.existsSync(configSrc)) {
      fs.copyFileSync(configSrc, path.join(backupDir, 'onesoft.config.json'));
      emit({ level: 'success', message: 'تم حفظ ملف الإعدادات', timestamp: now() });
    }

    emit({ level: 'success', message: `النسخة الاحتياطية محفوظة في: ${backupDir}`, timestamp: now() });
    return backupDir;
  }
}

function findPgDump(): string {
  const candidates = [
    'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
    'pg_dump',
  ];
  for (const p of candidates) {
    if (p === 'pg_dump') return p;
    if (fs.existsSync(p)) return p;
  }
  return 'pg_dump';
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
