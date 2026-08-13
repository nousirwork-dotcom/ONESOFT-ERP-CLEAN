import type { Pool, PoolClient } from 'pg';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { REQUIRED_SCHEMA_VERSION } from './schema-version.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Legacy backups can preserve the migration rows but lose/reset the SERIAL
 * sequence. Migration tags are the identity; id is only a surrogate key.
 * Repair sequence metadata before appending and never rewrite/delete rows.
 */
async function synchronizeMigrationLedgerSequence(client: PoolClient): Promise<void> {
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
    return;
  }

  await client.query(
    'SELECT setval($1::regclass, $2::bigint, $3::boolean)',
    [sequenceName, maxId, maxIdText !== null],
  );
}
/**
 * autoMigrate — يطبّق ملفات SQL من drizzle/ مباشرة عبر pg، بدون أي اعتماد
 * على pnpm أو drizzle-kit أو المُثبِّت (installer).
 *
 * هذا يجعل الـ Backend قادراً على "شفاء نفسه" في أي سيناريو تكون فيه
 * قاعدة البيانات موجودة لكن غير مهيّأة بعد — سواء كان ذلك بسبب:
 *   - تثبيت لم يكمل خطوة الـ migration لأي سبب
 *   - تحديث مستقبلي نسخ الملفات فقط دون تشغيل المُثبِّت الكامل
 *   - قاعدة بيانات جديدة تماماً تم إنشاؤها يدوياً
 *
 * ملاحظة: هذا المنطق مطابق لـ installer/core/database/MigrationRunner.ts
 * عمداً — أي تعديل في أحدهما (خصوصاً خطوة ختم _schema_version) يجب أن
 * يُطبَّق على الآخر أيضاً.
 */
export async function autoMigrate(pool: Pool): Promise<{ ok: boolean; error?: string; failedMigration?: string }> {
  // drizzle/ يُشحن بجانب dist/index.mjs — أي: server-app/drizzle
  const drizzleDir = path.join(__dirname, '..', 'drizzle');

  if (!fs.existsSync(drizzleDir)) {
    return { ok: false, error: `مجلد drizzle غير موجود: ${drizzleDir}` };
  }

  const journalPath = path.join(drizzleDir, 'meta', '_journal.json');
  let entries: Array<{ tag: string }> = [];
  if (fs.existsSync(journalPath)) {
    try {
      const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8')) as {
        entries: Array<{ tag: string }>;
      };
      entries = journal.entries ?? [];
    } catch {
      // fallback أدناه
    }
  }
  if (entries.length === 0) {
    entries = fs.readdirSync(drizzleDir)
      .filter((f) => f.endsWith('.sql') && f !== 'base_schema.sql')
      .sort()
      .map((f) => ({ tag: f.replace('.sql', '') }));
  }

  const client = await pool.connect();
  try {
    // Bootstrap DDL is for an empty database only. Replaying it against an
    // existing installation is unsafe because its historical shape can differ
    // from the live schema (for example branch_id changes).
    const orgCheck = await client.query(`SELECT to_regclass('public.organizations') AS tbl`);
    if (orgCheck.rows[0]?.tbl === null) {
      const baseSchemaFile = path.join(drizzleDir, 'base_schema.sql');
      if (!fs.existsSync(baseSchemaFile)) {
        return { ok: false, error: `base_schema.sql غير موجود في: ${drizzleDir}` };
      }
      console.log('[auto-migrate] قاعدة فارغة — تطبيق base_schema.sql مرة واحدة...');
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(baseSchemaFile, 'utf-8'));
        const created = await client.query(`SELECT to_regclass('public.organizations') AS tbl`);
        if (created.rows[0]?.tbl === null) throw new Error('organizations مفقود بعد تهيئة القاعدة');
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: `فشل تهيئة القاعدة الفارغة: ${msg}` };
      }
    } else {
      console.log('[auto-migrate] قاعدة موجودة — تخطي base_schema.sql');
    }

    // ── 2. جدول تتبع migrations التدريجية ───────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id         SERIAL PRIMARY KEY,
        tag        TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await synchronizeMigrationLedgerSequence(client);

    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_version (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        version TEXT NOT NULL,
        stamped_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    const versionRow = await client.query<{ version: string }>(
      'SELECT version FROM _schema_version WHERE id = 1',
    );
    const currentTag = versionRow.rows[0]?.version ?? null;
    const currentIndex = currentTag ? entries.findIndex((entry) => entry.tag === currentTag) : -1;
    const ledgerCountResult = await client.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM __drizzle_migrations',
    );
    const ledgerWasEmpty = Number(ledgerCountResult.rows[0]?.count ?? 0) === 0;
    // Legacy installations may have been stamped before the migration ledger
    // existed. Reconstruct only the already-completed prefix; never mark
    // migrations beyond the stamped version as applied. Once the ledger has
    // any entries, it is the source of truth: a version stamp must never make
    // an unrecorded SQL file get skipped.
    if (ledgerWasEmpty && currentIndex >= 0) {
      for (const entry of entries.slice(0, currentIndex + 1)) {
        await synchronizeMigrationLedgerSequence(client);
        await client.query(
          'INSERT INTO __drizzle_migrations (tag) VALUES ($1) ON CONFLICT (tag) DO NOTHING',
          [entry.tag],
        );
      }
    }

    // ── 3. تطبيق كل migration لم تُطبَّق بعد ────────────────────────────────
    for (const entry of entries) {
      const sqlFile = path.join(drizzleDir, `${entry.tag}.sql`);
      if (!fs.existsSync(sqlFile)) continue;

      const { rowCount } = await client.query(
        'SELECT 1 FROM __drizzle_migrations WHERE tag = $1',
        [entry.tag],
      );
      if ((rowCount ?? 0) > 0) continue;

      const sql = fs.readFileSync(sqlFile, 'utf-8');
      console.log(`[auto-migrate] تطبيق: ${entry.tag}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await synchronizeMigrationLedgerSequence(client);
        await client.query(
          'INSERT INTO __drizzle_migrations (tag) VALUES ($1) ON CONFLICT (tag) DO NOTHING',
          [entry.tag],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: `فشل تطبيق ${entry.tag}: ${msg}`, failedMigration: entry.tag };
      }
    }

    // Stamp only after every pending SQL file has committed successfully.
    const latestVersion = entries.length > 0 ? entries[entries.length - 1]!.tag : REQUIRED_SCHEMA_VERSION;
    await client.query(
      `INSERT INTO _schema_version (id, version, stamped_at)
       VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE SET version = $1, stamped_at = NOW()`,
      [latestVersion],
    );

    console.log(`[auto-migrate] ✅ اكتمل — إصدار المخطط: ${latestVersion}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}
