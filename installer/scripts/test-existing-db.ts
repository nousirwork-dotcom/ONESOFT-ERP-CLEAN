/**
 * اختبار تكاملي على مستوى قاعدة البيانات لسيناريو "الاتصال بقاعدة OneSoft موجودة".
 *
 * يستخدم DATABASE_URL (Postgres في بيئة Replit) كحساب مسؤول لإنشاء قواعد بيانات
 * مؤقتة ثم يتحقق من:
 *   1. ExistingDbDetector يُرجع exists=true لقاعدة فيها organizations + مؤسسة.
 *   2. يُرجع exists=false لقاعدة فارغة (لا مخطط OneSoft).
 *   3. يُرجع databaseExists=false لاسم قاعدة غير موجود.
 *   4. سيناريو "الاتصال بالموجود": هجرة آمنة (ADD COLUMN IF NOT EXISTS) بدون
 *      seed/drop تُبقي المؤسسة والمستخدم الحاليين كما هما (تسجيل الدخول ممكن).
 *
 * التشغيل:  cd installer && pnpm exec tsx scripts/test-existing-db.ts
 */
import { Pool } from 'pg';
import { ExistingDbDetector } from '../core/database/ExistingDbDetector.js';
import type { DatabaseConnectionOptions } from '../core/types.js';

function parseDatabaseUrl(url: string): DatabaseConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 5432,
    database: decodeURIComponent(u.pathname.replace(/^\//, '')),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string, extra?: unknown): void {
  if (cond) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}${extra !== undefined ? '  →  ' + JSON.stringify(extra) : ''}`);
  }
}

async function adminExec(admin: DatabaseConnectionOptions, sql: string): Promise<void> {
  const pool = new Pool({ ...admin, database: 'postgres' });
  try {
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}

async function withDb<T>(
  admin: DatabaseConnectionOptions,
  dbName: string,
  fn: (pool: Pool) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ ...admin, database: dbName });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function seedOneSoftSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      code text
    );
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid,
      username text NOT NULL,
      password_hash text NOT NULL
    );
    CREATE TABLE IF NOT EXISTS _schema_version (
      id int PRIMARY KEY,
      version text NOT NULL
    );
  `);
  await pool.query(
    `INSERT INTO organizations (name, code) VALUES ('شركة الاختبار', 'ORG-001')`,
  );
  const org = await pool.query<{ id: string }>(`SELECT id FROM organizations LIMIT 1`);
  await pool.query(
    `INSERT INTO users (org_id, username, password_hash) VALUES ($1, 'admin', 'hashed-secret')`,
    [org.rows[0].id],
  );
  await pool.query(
    `INSERT INTO _schema_version (id, version) VALUES (1, '1.0.10')
       ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version`,
  );
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL غير مضبوط — لا يمكن تشغيل اختبار قاعدة البيانات.');
    process.exit(1);
  }
  const admin = parseDatabaseUrl(url);
  const detector = new ExistingDbDetector();
  const stamp = Date.now();
  const existingDb = `onesoft_test_existing_${stamp}`;
  const emptyDb = `onesoft_test_empty_${stamp}`;
  const missingDb = `onesoft_test_missing_${stamp}`;

  console.log('\n=== اختبار سيناريو الاتصال بقاعدة OneSoft موجودة ===\n');

  try {
    // تجهيز: قاعدة فيها مخطط OneSoft + مؤسسة + مستخدم
    await adminExec(admin, `CREATE DATABASE ${existingDb}`);
    await withDb(admin, existingDb, seedOneSoftSchema);
    // قاعدة فارغة تماماً
    await adminExec(admin, `CREATE DATABASE ${emptyDb}`);

    // 1) قاعدة OneSoft موجودة
    console.log('١) الكشف عن قاعدة OneSoft موجودة:');
    const r1 = await detector.detect({ ...admin, database: existingDb });
    assert(r1.reachable, 'الخادم قابل للوصول', r1);
    assert(r1.databaseExists, 'قاعدة البيانات موجودة', r1);
    assert(r1.exists, 'exists=true (يوجد مخطط + مؤسسة)', r1);
    assert(r1.hasOrganizations && r1.orgCount === 1, 'مؤسسة واحدة مكتشفة', r1);
    assert(r1.hasUsers && r1.userCount === 1, 'مستخدم واحد مكتشف', r1);
    assert(r1.schemaVersion === '1.0.10', 'نسخة المخطط مقروءة', r1);

    // 2) قاعدة فارغة
    console.log('٢) الكشف عن قاعدة فارغة:');
    const r2 = await detector.detect({ ...admin, database: emptyDb });
    assert(r2.databaseExists, 'قاعدة البيانات موجودة على الخادم', r2);
    assert(!r2.exists, 'exists=false (لا مخطط OneSoft)', r2);
    assert(!r2.hasOrganizations, 'لا يوجد جدول organizations', r2);

    // 3) قاعدة غير موجودة أصلاً
    console.log('٣) الكشف عن قاعدة غير موجودة:');
    const r3 = await detector.detect({ ...admin, database: missingDb });
    assert(r3.reachable, 'الخادم قابل للوصول', r3);
    assert(!r3.databaseExists, 'databaseExists=false', r3);
    assert(!r3.exists, 'exists=false', r3);

    // 4) سلامة الاتصال بالموجود: هجرة آمنة بدون seed/drop تُبقي البيانات
    console.log('٤) سلامة البيانات بعد هجرة آمنة (بدون seed/drop):');
    await withDb(admin, existingDb, async (pool) => {
      const before = await pool.query<{ cnt: number }>(
        `SELECT count(*)::int AS cnt FROM users`,
      );
      const userBefore = await pool.query<{ username: string; password_hash: string }>(
        `SELECT username, password_hash FROM users LIMIT 1`,
      );
      // محاكاة هجرة آمنة idempotent كالتي يشغّلها المُثبِّت في مسار الاتصال بالموجود
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text`);
      await pool.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS currency text DEFAULT 'SAR'`);
      const after = await pool.query<{ cnt: number }>(
        `SELECT count(*)::int AS cnt FROM users`,
      );
      const userAfter = await pool.query<{ username: string; password_hash: string }>(
        `SELECT username, password_hash FROM users LIMIT 1`,
      );
      assert(before.rows[0].cnt === after.rows[0].cnt, 'عدد المستخدمين لم يتغيّر', {
        before: before.rows[0].cnt, after: after.rows[0].cnt,
      });
      assert(
        userBefore.rows[0].password_hash === userAfter.rows[0].password_hash &&
          userBefore.rows[0].username === userAfter.rows[0].username,
        'بيانات اعتماد المستخدم محفوظة (تسجيل الدخول ممكن)',
      );
      // إعادة الكشف يجب أن تبقى exists=true
      const r4 = await detector.detect({ ...admin, database: existingDb });
      assert(r4.exists && r4.orgCount === 1 && r4.userCount === 1, 'الكشف بعد الهجرة يبقى exists=true', r4);
    });
  } finally {
    // تنظيف قواعد البيانات المؤقتة
    for (const db of [existingDb, emptyDb]) {
      try {
        await adminExec(
          admin,
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${db}' AND pid<>pg_backend_pid()`,
        );
        await adminExec(admin, `DROP DATABASE IF EXISTS ${db}`);
      } catch (e) {
        console.warn(`تحذير: تعذّر حذف قاعدة الاختبار ${db}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  console.log(`\n=== النتيجة: ${passed} ناجح، ${failed} فاشل ===\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('فشل الاختبار بخطأ غير متوقع:', e);
  process.exit(1);
});
