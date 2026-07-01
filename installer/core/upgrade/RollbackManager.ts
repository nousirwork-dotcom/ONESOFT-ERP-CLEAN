import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type { ProgressEvent, DatabaseConnectionOptions } from '../types.js';

type Emit = (e: ProgressEvent) => void;

export class RollbackManager {
  async rollback(opts: {
    backupDir: string;
    dbOpts: DatabaseConnectionOptions;
  }, emit: Emit): Promise<void> {
    const { backupDir, dbOpts } = opts;

    emit({ level: 'warning', message: 'جارٍ التراجع (Rollback)...', timestamp: now() });

    // استعادة قاعدة البيانات
    const dumpFile = path.join(backupDir, 'database.sql');
    if (fs.existsSync(dumpFile)) {
      emit({ level: 'info', message: 'جارٍ استعادة قاعدة البيانات...', timestamp: now() });
      try {
        const pgRestore = findPsql();
        const env = { ...process.env, PGPASSWORD: dbOpts.password };
        execSync(
          `"${pgRestore}" -h ${dbOpts.host} -p ${dbOpts.port} -U ${dbOpts.user} -d ${dbOpts.name} -f "${dumpFile}"`,
          { env, stdio: 'pipe', timeout: 300_000 },
        );
        emit({ level: 'success', message: 'تم استعادة قاعدة البيانات', timestamp: now() });
      } catch (e: unknown) {
        emit({ level: 'error', message: `فشل استعادة قاعدة البيانات: ${e instanceof Error ? e.message : String(e)}`, timestamp: now() });
      }
    }

    // استعادة ملف الإعدادات
    const configBackup = path.join(backupDir, 'onesoft.config.json');
    const configDest = path.join(process.env['ProgramData'] || 'C:\\ProgramData', 'OneSoft', 'config', 'onesoft.config.json');
    if (fs.existsSync(configBackup)) {
      fs.copyFileSync(configBackup, configDest);
      emit({ level: 'success', message: 'تم استعادة ملف الإعدادات', timestamp: now() });
    }

    emit({ level: 'success', message: 'اكتمل التراجع (Rollback) بنجاح', timestamp: now() });
  }
}

function findPsql(): string {
  const candidates = [
    'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
    'psql',
  ];
  for (const p of candidates) {
    if (p === 'psql') return p;
    if (fs.existsSync(p)) return p;
  }
  return 'psql';
}

function now() { return new Date().toISOString(); }
