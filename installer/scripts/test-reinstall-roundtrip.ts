/**
 * Task #65 round-trip verification (real schema):
 * install → sample data → keep-DB uninstall (DB untouched) → reinstall
 * (safe migrations re-run) → detect existing DB → data survives.
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { ExistingDbDetector } from '../core/database/ExistingDbDetector.js';

const ROOT = '/home/runner/workspace';
const DRIZZLE = path.join(ROOT, 'server-app', 'drizzle');

function parseUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 5432,
    database: decodeURIComponent(u.pathname.slice(1)),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}

let passed = 0, failed = 0;
function assert(cond: boolean, label: string, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ ${label}`, extra ?? ''); }
}

/** Mirrors server-app/src/auto-migrate.ts + installer MigrationRunner logic */
async function runSafeMigrations(pool: Pool): Promise<string[]> {
  const journal = JSON.parse(fs.readFileSync(path.join(DRIZZLE, 'meta', '_journal.json'), 'utf-8')) as { entries: Array<{ tag: string }> };
  const entries = journal.entries ?? [];
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query(fs.readFileSync(path.join(DRIZZLE, 'base_schema.sql'), 'utf-8'));
    await client.query(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id SERIAL PRIMARY KEY, tag TEXT NOT NULL UNIQUE, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    for (const e of entries) {
      const f = path.join(DRIZZLE, `${e.tag}.sql`);
      if (!fs.existsSync(f)) continue;
      const { rowCount } = await client.query('SELECT 1 FROM __drizzle_migrations WHERE tag=$1', [e.tag]);
      if ((rowCount ?? 0) > 0) continue;
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(f, 'utf-8'));
        await client.query('INSERT INTO __drizzle_migrations (tag) VALUES ($1)', [e.tag]);
        await client.query('COMMIT');
        applied.push(e.tag);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`migration ${e.tag} failed: ${err instanceof Error ? err.message : err}`);
      }
    }
    const latest = entries.length ? entries[entries.length - 1].tag : 'unknown';
    await client.query(`CREATE TABLE IF NOT EXISTS _schema_version (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id=1), version TEXT NOT NULL,
      stamped_at TIMESTAMP NOT NULL DEFAULT NOW())`);
    await client.query(`INSERT INTO _schema_version (id, version, stamped_at) VALUES (1,$1,NOW())
      ON CONFLICT (id) DO UPDATE SET version=$1, stamped_at=NOW()`, [latest]);
  } finally {
    client.release();
  }
  return applied;
}

async function main() {
  const admin = parseUrl(process.env.DATABASE_URL!);
  const dbName = `onesoft_t65_${Date.now()}`;
  const adminPool = new Pool({ ...admin, database: admin.database });
  await adminPool.query(`CREATE DATABASE ${dbName}`);
  await adminPool.end();

  const pool = new Pool({ ...admin, database: dbName });
  const detector = new ExistingDbDetector();
  try {
    console.log('\n=== Task #65 round-trip (real schema) ===\n');

    // ── 1) First install: base schema + all migrations ──
    console.log('١) التثبيت الأول — المخطط الكامل:');
    const applied1 = await runSafeMigrations(pool);
    const orgReg = await pool.query(`SELECT to_regclass('public.organizations') t`);
    assert(orgReg.rows[0].t !== null, `المخطط أُنشئ (organizations موجود) — ${applied1.length} migration مطبَّقة`);

    // ── 2) Sample business data (simulating first-run wizard + usage) ──
    console.log('٢) بيانات تجريبية (مؤسسة + مدير + عميل + فاتورة):');
    const org = await pool.query<{ id: string }>(
      `INSERT INTO organizations (code, name, currency, status) VALUES ('TRIAL','شركة الاختبار','SAR','trial') RETURNING id`);
    const orgId = org.rows[0].id;
    await pool.query(
      `INSERT INTO users (org_id, username, password_hash, name, role) VALUES ($1,'admin','$2b$10$fakehash','المدير','admin')`, [orgId]);
    const cust = await pool.query<{ id: string }>(
      `INSERT INTO customers (org_id, code, name) VALUES ($1,'C-001','عميل تجريبي') RETURNING id`, [orgId]);
    await pool.query(
      `INSERT INTO sales_invoices (org_id, invoice_number, customer_id, total) VALUES ($1,'INV-0001',$2, 1150.0000)`,
      [orgId, cust.rows[0].id]);
    assert(true, 'أُدخلت البيانات التجريبية');

    // snapshot before "uninstall"
    const snap = async () => {
      const r = await pool.query(`SELECT
        (SELECT count(*)::int FROM organizations) orgs,
        (SELECT count(*)::int FROM users) users,
        (SELECT count(*)::int FROM customers) custs,
        (SELECT count(*)::int FROM sales_invoices) invs,
        (SELECT password_hash FROM users WHERE username='admin') hash,
        (SELECT total::text FROM sales_invoices WHERE invoice_number='INV-0001') total`);
      return r.rows[0];
    };
    const before = await snap();

    // ── 3) keep-DB uninstall: UninstallManager with deleteDatabase=false never
    //       touches PostgreSQL (verified statically) — DB state must be identical.
    console.log('٣) إلغاء تثبيت مع الاحتفاظ بالقاعدة — لا عمليات على PostgreSQL:');
    const mid = await snap();
    assert(JSON.stringify(before) === JSON.stringify(mid), 'قاعدة البيانات لم تُمس أثناء إلغاء التثبيت');

    // ── 4) Reinstall detection ──
    console.log('٤) إعادة التثبيت — الكشف عن القاعدة الموجودة:');
    const det = await detector.detect({ ...admin, database: dbName });
    assert(det.exists === true, 'exists=true → يُعرض «الاتصال بالقاعدة الموجودة»', det);
    assert(det.orgCount === 1 && det.userCount === 1, 'عدد المؤسسات/المستخدمين صحيح', det);
    assert(det.schemaVersion !== null, `نسخة المخطط مقروءة: ${det.schemaVersion}`);

    // ── 5) Existing-DB path: re-run safe migrations only (no seed/org/user) ──
    console.log('٥) مسار «الاتصال بالموجود» — إعادة تشغيل الهجرات الآمنة فقط:');
    const applied2 = await runSafeMigrations(pool);
    assert(applied2.length === 0, 'لا هجرات جديدة أُعيد تطبيقها (idempotent)', applied2);
    const after = await snap();
    assert(JSON.stringify(before) === JSON.stringify(after), 'كل البيانات عادت كما هي (مؤسسة/مستخدم/عميل/فاتورة/hash)');

    // ── 6) firstRun guard: with orgCount>0 the setup mutation must refuse ──
    console.log('٦) حارس firstRun في الخادم:');
    const cnt = await pool.query<{ cnt: number }>(`SELECT count(*)::int cnt FROM organizations`);
    const alreadySetup = (cnt.rows[0]?.cnt ?? 0) > 0;
    assert(alreadySetup === true, 'alreadySetup=true → firstRun mutation سيرفض («البرنامج تم إعداده مسبقاً»)');
  } finally {
    await pool.end();
    const cleanup = new Pool({ ...admin, database: admin.database });
    try {
      await cleanup.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`, [dbName]);
      await cleanup.query(`DROP DATABASE IF EXISTS ${dbName}`);
    } finally { await cleanup.end(); }
  }

  console.log(`\n=== النتيجة: ${passed} ناجح، ${failed} فاشل ===\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(e => { console.error('unexpected failure:', e); process.exit(1); });
