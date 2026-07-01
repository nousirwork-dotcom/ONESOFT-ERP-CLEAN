import * as path from 'path';
import * as fs from 'fs';
import type { MigrationResult, ProgressEvent } from '../types.js';

type Emit = (e: ProgressEvent) => void;

/**
 * يُطبّق ملفات SQL من مجلد drizzle/ مباشرةً عبر pg
 * لا يعتمد على pnpm أو drizzle-kit أو أي أداة dev على جهاز العميل
 */
export class MigrationRunner {
  constructor(private readonly serverAppPath: string) {}

  async runMigrations(databaseUrl: string, emit: Emit): Promise<MigrationResult> {
    emit({ level: 'info', message: 'جارٍ تطبيق Database Migrations...', timestamp: now() });

    // ─── مسار ملفات SQL المُجمَّعة مع البرنامج ───────────────────────────────
    const drizzleDir = path.join(this.serverAppPath, 'drizzle');

    if (!fs.existsSync(drizzleDir)) {
      const msg = `مجلد migrations غير موجود: ${drizzleDir}`;
      emit({ level: 'error', message: msg, timestamp: now() });
      return { applied: [], skipped: [], failed: msg };
    }

    // ─── قراءة Journal لمعرفة ترتيب Migrations ───────────────────────────────
    const journalPath = path.join(drizzleDir, 'meta', '_journal.json');
    let entries: Array<{ tag: string }> = [];

    if (fs.existsSync(journalPath)) {
      try {
        const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8')) as {
          entries: Array<{ tag: string }>;
        };
        entries = journal.entries ?? [];
      } catch {
        // fallback: نقرأ كل ملفات .sql مرتّبة
      }
    }

    if (entries.length === 0) {
      // بدون journal — نأخذ كل .sql مرتّبة أبجدياً
      entries = fs.readdirSync(drizzleDir)
        .filter(f => f.endsWith('.sql'))
        .sort()
        .map(f => ({ tag: f.replace('.sql', '') }));
    }

    // ─── اتصال بقاعدة البيانات ────────────────────────────────────────────────
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 15_000 });

    const applied: string[] = [];
    const skipped: string[] = [];

    try {
      const client = await pool.connect();
      try {
        // جدول تتبع Migrations (مشابه لـ drizzle journal)
        await client.query(`
          CREATE TABLE IF NOT EXISTS __drizzle_migrations (
            id         SERIAL PRIMARY KEY,
            tag        TEXT NOT NULL UNIQUE,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);

        for (const entry of entries) {
          const sqlFile = path.join(drizzleDir, `${entry.tag}.sql`);
          if (!fs.existsSync(sqlFile)) {
            skipped.push(entry.tag);
            continue;
          }

          // هل سُبق تطبيقه؟
          const { rowCount } = await client.query(
            'SELECT 1 FROM __drizzle_migrations WHERE tag = $1',
            [entry.tag],
          );
          if ((rowCount ?? 0) > 0) {
            skipped.push(entry.tag);
            continue;
          }

          const sql = fs.readFileSync(sqlFile, 'utf-8');
          emit({ level: 'info', message: `تطبيق: ${entry.tag}`, timestamp: now() });

          await client.query('BEGIN');
          try {
            await client.query(sql);
            await client.query(
              'INSERT INTO __drizzle_migrations (tag) VALUES ($1)',
              [entry.tag],
            );
            await client.query('COMMIT');
            applied.push(entry.tag);
            emit({ level: 'success', message: `✅ ${entry.tag}`, timestamp: now() });
          } catch (sqlErr: unknown) {
            await client.query('ROLLBACK');
            const msg = sqlErr instanceof Error ? sqlErr.message : String(sqlErr);
            emit({ level: 'error', message: `❌ فشل ${entry.tag}: ${msg}`, timestamp: now() });
            return { applied, skipped, failed: msg };
          }
        }
      } finally {
        client.release();
      }
    } finally {
      await pool.end().catch(() => {});
    }

    emit({
      level: 'success',
      message: `تمت Migrations: ${applied.length} مُطبَّق، ${skipped.length} مُتخطَّى`,
      timestamp: now(),
    });
    return { applied, skipped };
  }
}

function now() { return new Date().toISOString(); }
