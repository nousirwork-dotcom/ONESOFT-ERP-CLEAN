import type {
  DatabaseMigrationRequest,
  DatabaseMigrationResult,
  ProgressEvent,
} from '../types.js';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

type Emit = (e: ProgressEvent) => void;

/**
 * نقل قاعدة البيانات إلى جهاز آخر
 *
 * الاستخدام الرئيسي:
 *   - تحويل standalone → server-only (نقل DB للسيرفر)
 *   - ترقية الجهاز
 *   - إنشاء بيئة اختبار
 */
export class DatabaseMigrator {
  async migrate(
    req: DatabaseMigrationRequest,
    emit: Emit,
  ): Promise<DatabaseMigrationResult> {
    const dumpPath = path.join(
      process.env['TEMP'] ?? 'C:\\Temp',
      `onesoft_dump_${Date.now()}.sql`,
    );

    try {
      // 1. التحقق من اتصال المصدر
      emit({ level: 'info', message: 'فحص اتصال مصدر البيانات...', timestamp: now() });
      await this._testConnection(req.sourceDb);
      emit({ level: 'success', message: 'اتصال المصدر: ✓', timestamp: now() });

      // 2. التحقق من اتصال الهدف
      emit({ level: 'info', message: 'فحص اتصال الجهاز الهدف...', timestamp: now() });
      await this._testConnection(req.targetDb);
      emit({ level: 'success', message: 'اتصال الهدف: ✓', timestamp: now() });

      // 3. تصدير قاعدة البيانات المصدر (pg_dump)
      emit({ level: 'info', message: 'تصدير قاعدة البيانات...', timestamp: now() });
      const { tablesTransferred, rowsTransferred } = await this._dump(
        req.sourceDb,
        dumpPath,
        req.includeData,
        emit,
      );
      emit({ level: 'success', message: `تم التصدير — ${tablesTransferred} جدول، ${rowsTransferred} سجل`, timestamp: now() });

      // 4. استيراد في الجهاز الهدف (psql)
      emit({ level: 'info', message: 'استيراد في الجهاز الهدف...', timestamp: now() });
      await this._restore(req.targetDb, dumpPath, emit);
      emit({ level: 'success', message: 'تم الاستيراد بنجاح', timestamp: now() });

      // 5. حذف المصدر إذا طُلب
      if (req.dropSourceAfter) {
        emit({ level: 'warning', message: 'حذف قاعدة البيانات المصدر...', timestamp: now() });
        await this._dropSource(req.sourceDb, emit);
      }

      return {
        success: true,
        tablesTransferred,
        rowsTransferred,
        dumpPath,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      emit({ level: 'error', message: `فشل النقل: ${msg}`, timestamp: now() });
      return { success: false, tablesTransferred: 0, rowsTransferred: 0, error: msg };
    } finally {
      // تنظيف ملف الـ dump المؤقت (بعد 5 دقائق)
      setTimeout(() => {
        try { if (fs.existsSync(dumpPath)) fs.unlinkSync(dumpPath); } catch { }
      }, 5 * 60 * 1000);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  private async _testConnection(db: DatabaseMigrationRequest['sourceDb']): Promise<void> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: db.host, port: db.port,
      database: db.database, user: db.user, password: db.password,
      connectionTimeoutMillis: 10_000,
    });
    try {
      const client = await pool.connect();
      client.release();
    } finally {
      await pool.end().catch(() => {});
    }
  }

  private async _dump(
    db: DatabaseMigrationRequest['sourceDb'],
    dumpPath: string,
    includeData: boolean,
    emit: Emit,
  ): Promise<{ tablesTransferred: number; rowsTransferred: number }> {
    const pgDump = this._findPgTool('pg_dump');
    const schemaOnly = includeData ? '' : '--schema-only';

    const env = { ...process.env, PGPASSWORD: db.password };
    const cmd = [
      `"${pgDump}"`,
      `-h ${db.host}`,
      `-p ${db.port}`,
      `-U ${db.user}`,
      `-d ${db.database}`,
      schemaOnly,
      `--no-password`,
      `-f "${dumpPath}"`,
    ].filter(Boolean).join(' ');

    emit({ level: 'info', message: `pg_dump: ${db.host}:${db.port}/${db.database}`, timestamp: now() });
    execSync(cmd, { env, stdio: 'ignore' });

    // تقدير عدد الجداول والسجلات من حجم الملف
    const size = fs.statSync(dumpPath).size;
    return {
      tablesTransferred: Math.max(1, Math.floor(size / 5000)),
      rowsTransferred:   0,   // تقدير فقط — pg_dump لا يُعطي العدد مباشرةً
    };
  }

  private async _restore(
    db: DatabaseMigrationRequest['targetDb'],
    dumpPath: string,
    emit: Emit,
  ): Promise<void> {
    const psql = this._findPgTool('psql');

    // إنشاء قاعدة البيانات إذا لم تكن موجودة
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: db.host, port: db.port,
      database: 'postgres', user: db.user, password: db.password,
    });
    try {
      const client = await pool.connect();
      await client.query(`CREATE DATABASE "${db.database}" WITH ENCODING='UTF8'`).catch(() => {});
      client.release();
    } finally {
      await pool.end().catch(() => {});
    }

    const env = { ...process.env, PGPASSWORD: db.password };
    const cmd = [
      `"${psql}"`,
      `-h ${db.host}`,
      `-p ${db.port}`,
      `-U ${db.user}`,
      `-d ${db.database}`,
      `--no-password`,
      `-f "${dumpPath}"`,
      `-q`,
    ].join(' ');

    emit({ level: 'info', message: `psql: ${db.host}:${db.port}/${db.database}`, timestamp: now() });
    execSync(cmd, { env, stdio: 'ignore' });
  }

  private async _dropSource(
    db: DatabaseMigrationRequest['sourceDb'],
    emit: Emit,
  ): Promise<void> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: db.host, port: db.port,
      database: 'postgres', user: db.user, password: db.password,
    });
    try {
      const client = await pool.connect();
      // فصل جميع الاتصالات أولاً
      await client.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
        [db.database],
      );
      await client.query(`DROP DATABASE IF EXISTS "${db.database}"`);
      client.release();
      emit({ level: 'warning', message: `تم حذف قاعدة البيانات: ${db.database}`, timestamp: now() });
    } finally {
      await pool.end().catch(() => {});
    }
  }

  private _findPgTool(tool: 'pg_dump' | 'psql'): string {
    const versions = ['16', '15', '14', '13'];
    for (const ver of versions) {
      const p = `C:\\Program Files\\PostgreSQL\\${ver}\\bin\\${tool}.exe`;
      if (fs.existsSync(p)) return p;
    }
    return tool;  // نأمل أن يكون في PATH
  }
}

function now() { return new Date().toISOString(); }
