import * as path from 'path';
import * as fs from 'fs';
import type { MigrationResult, ProgressEvent } from '../types.js';

type Emit = (e: ProgressEvent) => void;

/**
 * يُطبّق ملفات SQL من مجلد drizzle/ مباشرةً عبر pg
 * لا يعتمد على pnpm أو drizzle-kit أو أي أداة dev على جهاز العميل
 *
 * الترتيب:
 *   1. base_schema.sql  — ينشئ الجداول الأساسية الـ 30 (IF NOT EXISTS)
 *   2. journal entries  — ALTER TABLE / CREATE TABLE التدريجية (0000-0012)
 */
export class MigrationRunner {
  constructor(private readonly serverAppPath: string) {}

  async runMigrations(databaseUrl: string, emit: Emit): Promise<MigrationResult> {
    emit({ level: 'info', message: 'جارٍ تطبيق Database Migrations...', timestamp: now() });

    const drizzleDir = path.join(this.serverAppPath, 'drizzle');

    if (!fs.existsSync(drizzleDir)) {
      const msg = `مجلد migrations غير موجود: ${drizzleDir}`;
      emit({ level: 'error', message: msg, timestamp: now() });
      return { applied: [], skipped: [], failed: msg };
    }

    // ─── قراءة Journal ────────────────────────────────────────────────────────
    const journalPath = path.join(drizzleDir, 'meta', '_journal.json');
    let entries: Array<{ tag: string }> = [];

    if (fs.existsSync(journalPath)) {
      try {
        const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8')) as {
          entries: Array<{ tag: string }>;
        };
        entries = journal.entries ?? [];
        emit({ level: 'info', message: `Journal يحتوي على ${entries.length} migration`, timestamp: now() });
      } catch {
        // fallback: كل .sql مرتّبة أبجدياً (ماعدا base_schema)
      }
    }

    if (entries.length === 0) {
      entries = fs.readdirSync(drizzleDir)
        .filter(f => f.endsWith('.sql') && f !== 'base_schema.sql')
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
        // ── STEP 1: تطبيق base_schema.sql (ينشئ الجداول الأساسية) ────────────
        const baseSchemaFile = path.join(drizzleDir, 'base_schema.sql');
        if (fs.existsSync(baseSchemaFile)) {
          emit({ level: 'info', message: 'تطبيق base_schema.sql (الجداول الأساسية)...', timestamp: now() });
          const baseSql = fs.readFileSync(baseSchemaFile, 'utf-8');
          try {
            await client.query(baseSql);
            emit({ level: 'success', message: '✅ base_schema.sql — الجداول الأساسية جاهزة', timestamp: now() });
          } catch (baseErr: unknown) {
            const msg = baseErr instanceof Error ? baseErr.message : String(baseErr);
            emit({ level: 'error', message: `❌ فشل base_schema.sql: ${msg}`, timestamp: now() });
            return { applied, skipped, failed: `base_schema.sql: ${msg}` };
          }
        } else {
          emit({ level: 'error', message: `base_schema.sql غير موجود في: ${drizzleDir}`, timestamp: now() });
          return { applied, skipped, failed: 'base_schema.sql not found' };
        }

        // ── STEP 2: التحقق من وجود جدول organizations ─────────────────────────
        const orgCheck = await client.query(
          `SELECT to_regclass('public.organizations') AS tbl`
        );
        const orgExists = orgCheck.rows[0]?.tbl !== null;
        if (!orgExists) {
          const msg = 'The database schema was not created successfully (organizations table missing).';
          emit({ level: 'error', message: msg, timestamp: now() });
          return { applied, skipped, failed: msg };
        }
        emit({ level: 'success', message: '✅ جدول organizations موجود', timestamp: now() });

        // ── STEP 3: جدول تتبع Migrations ──────────────────────────────────────
        await client.query(`
          CREATE TABLE IF NOT EXISTS __drizzle_migrations (
            id         SERIAL PRIMARY KEY,
            tag        TEXT NOT NULL UNIQUE,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);

        // ── STEP 4: تطبيق Journal migrations بالترتيب ─────────────────────────
        emit({ level: 'info', message: `تطبيق ${entries.length} migration من الـ journal...`, timestamp: now() });

        for (const entry of entries) {
          const sqlFile = path.join(drizzleDir, `${entry.tag}.sql`);
          if (!fs.existsSync(sqlFile)) {
            emit({ level: 'info', message: `تخطي (ملف غير موجود): ${entry.tag}`, timestamp: now() });
            skipped.push(entry.tag);
            continue;
          }

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

        // ── STEP 5: تحقق نهائي من organizations ───────────────────────────────
        const finalCheck = await client.query(
          `SELECT to_regclass('public.organizations') AS tbl`
        );
        if (finalCheck.rows[0]?.tbl === null) {
          const msg = 'The database schema was not created successfully.';
          emit({ level: 'error', message: msg, timestamp: now() });
          return { applied, skipped, failed: msg };
        }

        // ── STEP 6: ختم _schema_version ─────────────────────────────────────
        // حرج جداً: server-app/src/check-schema.ts يرفض العمل عند بدء التشغيل
        // إذا كان جدول _schema_version غير موجود أو غير مطابق لآخر migration.
        // نستخدم tag آخر عنصر في الـ journal كرقم النسخة — هذا يطابق تلقائياً
        // REQUIRED_SCHEMA_VERSION طالما أن schema-version.ts يُحدَّث مع كل
        // migration جديدة (كما هو موثّق في تعليق الملف نفسه).
        if (entries.length > 0) {
          const latestVersion = entries[entries.length - 1]!.tag;
          emit({ level: 'info', message: `جارٍ ختم إصدار المخطط: ${latestVersion}...`, timestamp: now() });

          await client.query(`
            CREATE TABLE IF NOT EXISTS _schema_version (
              id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
              version    TEXT    NOT NULL,
              stamped_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);

          await client.query(
            `INSERT INTO _schema_version (id, version, stamped_at)
             VALUES (1, $1, NOW())
             ON CONFLICT (id) DO UPDATE SET version = $1, stamped_at = NOW()`,
            [latestVersion],
          );

          emit({ level: 'success', message: `✅ تم ختم إصدار المخطط: ${latestVersion}`, timestamp: now() });
        } else {
          emit({
            level: 'error',
            message: '⚠️ لا توجد migrations في الـ journal — تعذّر ختم _schema_version. سيفشل فحص المخطط عند بدء تشغيل الخادم.',
            timestamp: now(),
          });
        }

      } finally {
        client.release();
      }
    } finally {
      await pool.end().catch(() => {});
    }

    emit({
      level: 'success',
      message: `✅ تمت Migrations: ${applied.length} مُطبَّق، ${skipped.length} مُتخطَّى`,
      timestamp: now(),
    });
    emit({
      level: 'info',
      message: `Migrations مُطبَّقة: ${applied.join(', ') || 'لا شيء جديد'}`,
      timestamp: now(),
    });
    return { applied, skipped };
  }
}

function now() { return new Date().toISOString(); }
