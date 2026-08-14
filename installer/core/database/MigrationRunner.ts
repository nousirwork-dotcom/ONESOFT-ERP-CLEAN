import * as path from 'path';
import * as fs from 'fs';
import type { PoolClient } from 'pg';
import type { MigrationResult, ProgressEvent } from '../types.js';

type Emit = (e: ProgressEvent) => void;

/**
 * Legacy databases can carry a valid migration ledger whose SERIAL sequence
 * was not preserved by an old backup/import path. The next INSERT then reuses
 * an existing surrogate id even though the migration tag is new.
 *
 * The numeric id is only a surrogate ordering key; migration identity is the
 * unique tag. Repair the sequence metadata, never the ledger rows, before
 * inserting a new tag.
 */
async function synchronizeMigrationLedgerSequence(
  client: PoolClient,
  emit: Emit,
): Promise<void> {
  const sequenceResult = await client.query<{ sequence_name: string | null }>(`
    SELECT pg_get_serial_sequence('public.__drizzle_migrations', 'id') AS sequence_name
  `);
  const sequenceName = sequenceResult.rows[0]?.sequence_name;
  if (!sequenceName) {
    throw new Error(
      '__drizzle_migrations.id has no PostgreSQL sequence; cannot safely append a Legacy migration ledger row',
    );
  }

  const maxResult = await client.query<{ max_id: string | null }>(`
    SELECT MAX(id)::text AS max_id
    FROM public.__drizzle_migrations
  `);
  const maxIdText = maxResult.rows[0]?.max_id ?? null;
  const maxId = maxIdText === null ? 1 : Number(maxIdText);
  if (!Number.isInteger(maxId) || maxId < 1) {
    throw new Error(`Invalid __drizzle_migrations MAX(id): ${maxIdText ?? 'null'}`);
  }

  const stateResult = await client.query<{ last_value: string | null }>(`
    SELECT last_value::text AS last_value
    FROM pg_sequences
    WHERE schemaname = 'public'
      AND sequencename = regexp_replace(
        replace(pg_get_serial_sequence('public.__drizzle_migrations', 'id'), '"', ''),
        '^.*\.',
        ''
      )
  `);
  const lastValueText = stateResult.rows[0]?.last_value ?? null;
  const lastValue = lastValueText === null ? null : Number(lastValueText);
  if (lastValue !== null && Number.isSafeInteger(lastValue) && lastValue > maxId) {
    emit({
      level: 'info',
      message: `sequence سجل migrations متقدم (${lastValue}) — تم الحفاظ عليه`,
      timestamp: now(),
    });
    return;
  }

  await client.query(
    'SELECT setval($1::regclass, $2::bigint, $3::boolean)',
    [sequenceName, maxId, maxIdText !== null],
  );
  emit({
    level: 'info',
    message: `تمت مزامنة sequence سجل migrations مع MAX(id)=${maxIdText ?? '0'}`,
    timestamp: now(),
  });
}

/** يحمي أسماء الجداول/المستخدمين عند حقنها داخل نص SQL (معرّفات، لا قيم) */
function quoteIdent(id: string): string {
  return '"' + id.replace(/"/g, '""') + '"';
}

/**
 * يُطبّق ملفات SQL من مجلد drizzle/ مباشرةً عبر pg
 * لا يعتمد على pnpm أو drizzle-kit أو أي أداة dev على جهاز العميل
 *
 * الترتيب:
 *   1. base_schema.sql  — يُطبَّق على قاعدة فارغة فقط
 *   2. journal entries  — ALTER TABLE / CREATE TABLE التدريجية
 */
export class MigrationRunner {
  constructor(private readonly serverAppPath: string) {}

  async runMigrations(databaseUrl: string, emit: Emit): Promise<MigrationResult> {
    emit({ level: 'info', message: 'جارٍ تطبيق Database Migrations...', timestamp: now() });

    const drizzleDir = path.join(this.serverAppPath, 'drizzle');

    if (!fs.existsSync(drizzleDir)) {
      const msg = `مجلد drizzle غير موجود: ${drizzleDir}\nتأكد أن ملفات SQL موجودة داخل server-app/drizzle/ (وليس داخل drizzle/migrations/)`;
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
        // The migrator is allowed to LOGIN, but all OneSoft objects must be
        // owned by the NOLOGIN schema-owner role. SET ROLE makes every DDL
        // statement below execute as that owner without granting SUPERUSER to
        // either the runtime or migrator login.
        await client.query('SET ROLE "onesoft_schema_owner"');

        // ── STEP 1: تطبيق base_schema.sql على قاعدة فارغة فقط ───────────────
        // لا يجوز إعادة تشغيل الـbaseline على قاعدة عميل موجودة؛ بعض الجداول
        // التاريخية تُنشأ في migration 0002، كما أن شكل الـbaseline قد يتغير
        // بين الإصدارات. هذا يطابق auto-migrate في الخادم.
        const orgCheckBeforeBase = await client.query(
          `SELECT to_regclass('public.organizations') AS tbl`,
        );
        const databaseAlreadyInitialized = orgCheckBeforeBase.rows[0]?.tbl !== null;
        const baseSchemaFile = path.join(drizzleDir, 'base_schema.sql');
        if (!databaseAlreadyInitialized && fs.existsSync(baseSchemaFile)) {
          emit({ level: 'info', message: 'تطبيق base_schema.sql (الجداول الأساسية)...', timestamp: now() });
          const baseSql = fs.readFileSync(baseSchemaFile, 'utf-8');
          try {
            await client.query(baseSql);
            emit({ level: 'success', message: '✅ base_schema.sql — الجداول الأساسية جاهزة', timestamp: now() });
          } catch (baseErr: unknown) {
            const msg = baseErr instanceof Error ? baseErr.message : String(baseErr);
            emit({ level: 'error', message: `❌ فشل base_schema.sql: ${msg}`, timestamp: now() });
            return {
              applied,
              skipped,
              failed: `base_schema.sql: ${msg}`,
              failedMigration: 'base_schema.sql',
            };
          }
        } else if (!databaseAlreadyInitialized) {
          emit({ level: 'error', message: `base_schema.sql غير موجود في: ${drizzleDir}`, timestamp: now() });
          return {
            applied,
            skipped,
            failed: 'base_schema.sql not found',
            failedMigration: 'base_schema.sql',
          };
        } else {
          emit({ level: 'info', message: 'قاعدة موجودة — تخطي base_schema.sql للحفاظ على بيانات العميل', timestamp: now() });
        }

        // ── STEP 2: التحقق من وجود جدول organizations ─────────────────────────
        const orgCheck = await client.query(
          `SELECT to_regclass('public.organizations') AS tbl`
        );
        const orgExists = orgCheck.rows[0]?.tbl !== null;
        if (!orgExists) {
          const msg = 'The database schema was not created successfully (organizations table missing).';
          emit({ level: 'error', message: msg, timestamp: now() });
          return {
            applied,
            skipped,
            failed: msg,
            failedMigration: 'schema-check',
          };
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
        // Explicit GRANT while still running as onesoft_schema_owner so that
        // onesoft_app can always read/write the metadata table regardless of
        // whether ALTER DEFAULT PRIVILEGES fired before or after creation.
        await client.query(`
          GRANT SELECT, INSERT, UPDATE, DELETE
            ON TABLE public.__drizzle_migrations
            TO "onesoft_app"
        `);
        await synchronizeMigrationLedgerSequence(client, emit);

        // تثبيتات OneSoft القديمة كانت تملك ختم _schema_version قبل إنشاء
        // ledger. عند ترقية مثل هذه القاعدة نعيد بناء البادئة المنجزة فقط،
        // ولا نسمح للختم بتجاوز SQL غير مسجل. بعد أول سجل يصبح الـledger
        // مصدر الحقيقة الوحيد.
        await client.query(`
          CREATE TABLE IF NOT EXISTS _schema_version (
            id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            version    TEXT NOT NULL,
            stamped_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
        // Same explicit GRANT for _schema_version — the owner issues the grant
        // while SET ROLE is still active.
        await client.query(`
          GRANT SELECT, INSERT, UPDATE, DELETE
            ON TABLE public._schema_version
            TO "onesoft_app"
        `);
        const ledgerCount = await client.query<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM __drizzle_migrations',
        );
        const stampedVersion = await client.query<{ version: string }>(
          'SELECT version FROM _schema_version WHERE id = 1',
        );
        const stampedTag = stampedVersion.rows[0]?.version ?? null;
        const ledgerWasEmpty = Number(ledgerCount.rows[0]?.count ?? 0) === 0;
        const stampedIndex = stampedTag
          ? entries.findIndex((entry) => entry.tag === stampedTag)
          : -1;
        if (ledgerWasEmpty && stampedIndex >= 0) {
          for (const entry of entries.slice(0, stampedIndex + 1)) {
            await synchronizeMigrationLedgerSequence(client, emit);
            await client.query(
              'INSERT INTO __drizzle_migrations (tag) VALUES ($1) ON CONFLICT (tag) DO NOTHING',
              [entry.tag],
            );
          }
          emit({
            level: 'info',
            message: `تمت استعادة ${stampedIndex + 1} migration من ختم الإصدار القديم`,
            timestamp: now(),
          });
        }

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
            await synchronizeMigrationLedgerSequence(client, emit);
            await client.query(
              'INSERT INTO __drizzle_migrations (tag) VALUES ($1) ON CONFLICT (tag) DO NOTHING',
              [entry.tag],
            );
            await client.query('COMMIT');
            applied.push(entry.tag);
            emit({ level: 'success', message: `✅ ${entry.tag}`, timestamp: now() });
          } catch (sqlErr: unknown) {
            await client.query('ROLLBACK');
            const msg = sqlErr instanceof Error ? sqlErr.message : String(sqlErr);
            emit({ level: 'error', message: `❌ فشل ${entry.tag}: ${msg}`, timestamp: now() });
            return {
              applied,
              skipped,
              failed: msg,
              failedMigration: entry.tag,
            };
          }
        }

        // ── STEP 5: تحقق نهائي من organizations ───────────────────────────────
        const finalCheck = await client.query(
          `SELECT to_regclass('public.organizations') AS tbl`
        );
        if (finalCheck.rows[0]?.tbl === null) {
          const msg = 'The database schema was not created successfully.';
          emit({ level: 'error', message: msg, timestamp: now() });
          return {
            applied,
            skipped,
            failed: msg,
            failedMigration: 'schema-check',
          };
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

          // ── حماية دفاعية ──────────────────────────────────────────────────
          // لو الجدول موجود بالفعل من تجربة/نسخة أقدم (بأعمدة ناقصة)،
          // "CREATE TABLE IF NOT EXISTS" أعلاه لا يفعل شيئاً بصمت — فنضمن
          // هنا وجود الأعمدة المطلوبة بغض النظر عن حالة الجدول القديمة.
          await client.query(`
            ALTER TABLE _schema_version
              ADD COLUMN IF NOT EXISTS stamped_at TIMESTAMP NOT NULL DEFAULT NOW()
          `);
          await client.query(`
            ALTER TABLE _schema_version
              ADD COLUMN IF NOT EXISTS version TEXT
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
