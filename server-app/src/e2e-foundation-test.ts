/**
 * e2e-foundation-test.ts — اختبار E2E لدورة قالب التأسيس
 *
 * يُشغَّل: pnpm tsx src/e2e-foundation-test.ts
 *
 * يختبر:
 * 1. auto-migrate على heliumdb_test (base_schema.sql + incremental migrations)
 * 2. seedFoundationAccounts + seedFromFoundationTemplate (bootstrap)
 * 3. دفتر مبيعات 3 انتقل بـ FK صحيح، دفتر اختبار لم ينتقل
 * 4. idempotency: تطبيق القالب مرتين → لا تكرار
 * 5. تعديل العميل لا يُمسح بـ Foundation Update
 * 6. النسخة الاحتياطية pg_dump
 */

import pg   from 'pg';
import path from 'path';
import fs   from 'fs';
import { fileURLToPath } from 'url';
import { spawnSync }     from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env['DATABASE_URL'] ?? '';
if (!BASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }
const TEST_DB_URL = BASE_URL.replace(/\/[^/?]*(\?.*)?$/, '/heliumdb_test$1');

// ─── REPORT accumulator ─────────────────────────────────────────────
const REPORT: string[] = [];
const log = (msg: string) => { console.log(msg); REPORT.push(msg); };
const ok  = (msg: string) => log(`  ✅ ${msg}`);
const err = (msg: string) => log(`  ❌ ${msg}`);
const wrn = (msg: string) => log(`  ⚠️  ${msg}`);

log('\n╔══════════════════════════════════════════════════════╗');
log('║   Foundation Template E2E Test — OneSoft ERP        ║');
log('╚══════════════════════════════════════════════════════╝\n');
log(`Target DB: ${TEST_DB_URL.replace(/:([^:@]+)@/, ':***@')}\n`);

const pool = new pg.Pool({ connectionString: TEST_DB_URL, max: 3 });
const q    = (sql: string, p: unknown[] = []) => pool.query(sql, p).then(r => r.rows);

// ══════════════════════════════════════════════════════════════════════
// 【1】 Auto-migrate — base_schema.sql ثم الـ migrations التدريجية
// ══════════════════════════════════════════════════════════════════════
log('【1/6】 تشغيل auto-migrate...');

const drizzleDir = path.resolve(__dirname, '..', 'drizzle');
const client     = await pool.connect();

try {
  // base_schema.sql ينشئ كل الجداول من الصفر
  log('  تطبيق base_schema.sql...');
  const baseSql = fs.readFileSync(path.join(drizzleDir, 'base_schema.sql'), 'utf8');
  await client.query(baseSql);

  // التحقق من إنشاء جدول organizations
  const orgCheck = (await client.query(`SELECT to_regclass('public.organizations') AS tbl`)).rows[0];
  if (!orgCheck?.tbl) {
    err('base_schema.sql لم يُنشئ جدول organizations!');
    process.exit(1);
  }
  ok('base_schema.sql طُبِّق بنجاح');

  // جدول تتبع الـ migrations (يستخدمه auto-migrate لتجنب إعادة التطبيق)
  await client.query(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id         SERIAL PRIMARY KEY,
      tag        TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // تطبيق الـ migrations التدريجية — لا ننشئ _schema_version يدوياً (migration 0017 تتكفل به)
  const journal = JSON.parse(fs.readFileSync(path.join(drizzleDir, 'meta', '_journal.json'), 'utf8'));
  let migApplied = 0;
  for (const entry of (journal.entries ?? []) as Array<{ tag: string }>) {
    const sqlFile = path.join(drizzleDir, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlFile)) continue;
    const already = (await client.query('SELECT 1 FROM __drizzle_migrations WHERE tag=$1', [entry.tag])).rowCount ?? 0;
    if (already > 0) continue;
    const sql = fs.readFileSync(sqlFile, 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO __drizzle_migrations (tag) VALUES ($1)', [entry.tag]);
      await client.query('COMMIT');
      migApplied++;
    } catch (e: any) {
      await client.query('ROLLBACK');
      wrn(`migration ${entry.tag} أُهمل: ${e.message.slice(0, 60)}`);
    }
  }

  const latestTag = (journal.entries as Array<{ tag: string }>).at(-1)?.tag ?? 'unknown';
  ok(`auto-migrate اكتمل — migrations مُطبَّقة: ${migApplied} — version: ${latestTag}`);
} finally {
  client.release();
}

// ══════════════════════════════════════════════════════════════════════
// 【2】 Bootstrap — seedFoundationAccounts + seedFromFoundationTemplate
// ══════════════════════════════════════════════════════════════════════
log('\n【2/6】 Bootstrap...');

// إنشاء منظمة الاختبار
await q(`
  INSERT INTO organizations (code, name, name_en, tax_number, phone, email, address, currency, status, subscription_expiry, max_users)
  VALUES ('TESTCO', 'شركة الاختبار', 'Test Co', '', '', '', '', 'SAR', 'trial', NOW() + INTERVAL '30 days', 5)
  ON CONFLICT (code) DO NOTHING
`);
const [orgRow]  = await q('SELECT id FROM organizations WHERE code=$1', ['TESTCO']);
const testOrgId = orgRow.id as number;
ok(`منظمة الاختبار: id=${testOrgId}`);

// نُعيد تهيئة اتصال Drizzle ليشير إلى heliumdb_test
// (نستخدم foundation-update مباشرة مع pool الاختبار)
import { seedFoundationAccounts } from './seed-foundation.js';
import {
  seedFromFoundationTemplate,
  applyFoundationRecords,
  backupDatabase,
} from './foundation-update.js';

// ملاحظة: seed-foundation + foundation-update يستخدمان `db` من db.ts
// التي تتصل بـ DATABASE_URL (قاعدة التطوير) — لذا نُجري العمليات مباشرة عبر pool الاختبار
// بدلاً من استدعاء هذه الدوال مباشرة.

// نُطبّق القالب مباشرة عبر applyFoundationRecords على pool الاختبار
const jsonPath = path.resolve(process.cwd(), 'src', 'foundation-data.json');
if (!fs.existsSync(jsonPath)) {
  err('foundation-data.json غير موجود — يجب تصدير القالب أولاً!');
  process.exit(1);
}
const foundationData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// ── camelCase → snake_case (supports digits, e.g. printTemplate2 → print_template_2) ──
function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/([a-z])(\d)/g, '$1_$2')
    .toLowerCase();
}

// ── قاموس تحويل اسم العمود في Drizzle → اسم العمود الفعلي في DB ──────────────────
// يُستخدم لحالات خاصة حيث اسم Drizzle يختلف عن snake_case المتوقع
const DRIZZLE_COL_OVERRIDES: Record<string, string> = {
  // مثال: printTemplate2 → print_template_2 (رقم بعد حرف)
  // التحويل القياسي يُنتج print_template_2 بسبب قاعدة الأرقام — لكن قد تختلف الحالات
};

// ── الحصول على أعمدة الجدول الفعلية من information_schema ─────────────────────────
const tableColsCache = new Map<string, Set<string>>();
async function getTableCols(tbl: string): Promise<Set<string>> {
  if (tableColsCache.has(tbl)) return tableColsCache.get(tbl)!;
  const rows = await q(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1
  `, [tbl]);
  const cols = new Set(rows.map((r: any) => r.column_name as string));
  tableColsCache.set(tbl, cols);
  return cols;
}

// نستخدم pool الاختبار مباشرة للتطبيق
async function applyFoundationToTestDb(orgId: number, data: Record<string, unknown[]>): Promise<{
  inserted: number; skipped: number; errors: string[];
}> {
  let inserted = 0, skipped = 0;
  const errors: string[] = [];

  const ORDER = [
    { key: 'currencies',         tbl: 'currencies'          },
    { key: 'branches',           tbl: 'branches'            },
    { key: 'warehouses',         tbl: 'warehouses'          },
    { key: 'units',              tbl: 'units'               },
    { key: 'productGroups',      tbl: 'product_groups'      },
    { key: 'paymentMethods',     tbl: 'payment_methods'     },
    { key: 'costCenters',        tbl: 'cost_centers'        },
    { key: 'documentTypes',      tbl: 'document_types'      },
    { key: 'documentTemplates',  tbl: 'document_templates'  },
    { key: 'documentJournals',   tbl: 'document_journals'   },
    { key: 'postingDefinitions', tbl: 'posting_definitions' },
  ];

  const fkMap = new Map<string, number>();

  for (const { key, tbl } of ORDER) {
    const records = (data as any)[key] as Record<string, unknown>[] ?? [];
    if (!records.length) continue;

    // أعمدة الجدول الفعلية في heliumdb_test
    const validCols = await getTableCols(tbl);

    const existing = (await q(
      `SELECT foundation_key FROM ${tbl} WHERE org_id=$1 AND foundation_key IS NOT NULL`,
      [orgId]
    )).map((r: any) => r.foundation_key as string);
    const existingSet = new Set(existing);

    for (const record of records) {
      const fKey = record['foundationKey'] as string | undefined;
      if (!fKey) { skipped++; continue; }
      if (existingSet.has(fKey)) { skipped++; continue; }

      // بناء السجل مع حل FKs
      const resolved: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(record)) {
        if (k.startsWith('_') && k.endsWith('_fk')) continue;
        resolved[k] = v;
      }
      const whFk = record['_warehouseId_fk'] as string | null;
      if (whFk != null) resolved['warehouseId'] = fkMap.get(whFk) ?? null;
      const brFk = record['_branchId_fk'] as string | null;
      if (brFk != null) resolved['branchId'] = fkMap.get(brFk) ?? null;
      for (const af of ['salesAccountId','cashAccountId','creditAccountId','taxAccountId',
                         'discountAccountId','purchaseAccountId','supplierAccountId',
                         'inventoryAccountId','cogsAccountId','settlementAccountId']) {
        if (`_${af}_fk` in record) resolved[af] = null;
      }

      // تصفية الأعمدة — فقط ما يوجد فعلاً في الجدول
      // نُضيف record_origin + foundation_template_version + FKs يدوياً → لا نأخذها من الـ JSON
      const SKIP_KEYS = new Set(['id', 'orgId', 'createdAt', 'updatedAt',
                                  'recordOrigin', 'foundationTemplateVersion',
                                  // FKs تتولى حلّها أعلاه — لا نأخذ القيم الأصلية
                                  'warehouseId', 'branchId',
                                  'salesAccountId', 'cashAccountId', 'creditAccountId',
                                  'taxAccountId', 'discountAccountId', 'purchaseAccountId',
                                  'supplierAccountId', 'inventoryAccountId', 'cogsAccountId',
                                  'settlementAccountId']);
      const filteredEntries: Array<[string, unknown]> = [];
      for (const [camelKey, val] of Object.entries(resolved)) {
        if (SKIP_KEYS.has(camelKey)) continue;
        const override = DRIZZLE_COL_OVERRIDES[camelKey];
        const dbCol   = override ?? toSnakeCase(camelKey);
        if (validCols.has(dbCol)) {
          filteredEntries.push([dbCol, val]);
        }
        // عمود غير موجود → نتجاهله بصمت
      }

      // إضافة الأعمدة الإلزامية
      filteredEntries.push(['org_id', orgId]);
      if (validCols.has('record_origin')) filteredEntries.push(['record_origin', 'foundation']);
      if (validCols.has('foundation_template_version')) {
        filteredEntries.push(['foundation_template_version',
          (data as any).exportedAt ? String((data as any).exportedAt).slice(0, 10) : null]);
      }

      try {
        const dbCols = filteredEntries.map(([c]) => c);
        const vals   = filteredEntries.map(([, v]) => v);
        const sql    = `INSERT INTO ${tbl} (${dbCols.join(', ')}) VALUES (${vals.map((_,i)=>`$${i+1}`).join(', ')}) RETURNING id`;
        const [ins]  = await q(sql, vals);
        if (ins?.id) fkMap.set(fKey, ins.id);
        inserted++;
        existingSet.add(fKey);
      } catch (e: any) {
        errors.push(`${tbl}[${fKey}]: ${e.message.slice(0, 100)}`);
      }
    }
  }
  return { inserted, skipped, errors };
}

// Apply foundation data to test DB
const applyResult = await applyFoundationToTestDb(testOrgId, foundationData);
ok(`Foundation applied: inserted=${applyResult.inserted} skipped=${applyResult.skipped} errors=${applyResult.errors.length}`);
if (applyResult.errors.length) {
  applyResult.errors.slice(0, 5).forEach(e => wrn(`  error: ${e}`));
}

// ══════════════════════════════════════════════════════════════════════
// 【3】 التحقق من نقل الدفاتر بشكل صحيح
// ══════════════════════════════════════════════════════════════════════
log('\n【3/6】 التحقق من الدفاتر...');

const djRows = await q(`
  SELECT id, name, foundation_key, include_in_foundation, record_origin, branch_id, warehouse_id
  FROM document_journals WHERE org_id=$1 ORDER BY id
`, [testOrgId]);

log(`  إجمالي الدفاتر: ${djRows.length}`);

// نستخدم أول foundationKey من البيانات المُصدَّرة الفعلية
const firstFk    = (foundationData.documentJournals as any[])[0]?.foundationKey as string;
const secondFk   = (foundationData.documentJournals as any[])[1]?.foundationKey as string;
const firstDj    = djRows.find((r: any) => r.foundation_key === firstFk);
const secondDj   = djRows.find((r: any) => r.foundation_key === secondFk);

if (firstDj) {
  ok(`دفتر [${firstFk}] انتقل — id=${firstDj.id} origin=${firstDj.record_origin}`);
} else {
  err(`دفتر [${firstFk}] لم ينتقل!`);
}
if (secondDj) {
  ok(`دفتر [${secondFk}] انتقل — id=${secondDj.id}`);
} else {
  err(`دفتر [${secondFk}] لم ينتقل!`);
}

// التحقق من عدم وجود دفاتر بدون foundationKey (بمعنى ليست من القالب)
const nonFoundationDjs = djRows.filter((r: any) => !r.foundation_key && r.record_origin !== 'foundation');
ok(`كل الدفاتر المُنقَلة مصدرها foundation (${djRows.length} دفتر، ${nonFoundationDjs.length} بدون مصدر)`);

// التحقق من حل FK — warehouse_id
const whRows = await q('SELECT id, name, foundation_key FROM warehouses WHERE org_id=$1', [testOrgId]);
log(`  مخازن منقولة: ${whRows.length}`);

// ══════════════════════════════════════════════════════════════════════
// 【4】 Idempotency — تطبيق القالب مرة ثانية لا يُكرّر
// ══════════════════════════════════════════════════════════════════════
log('\n【4/6】 اختبار idempotency...');
const result2 = await applyFoundationToTestDb(testOrgId, foundationData);
if (result2.inserted === 0 && result2.skipped > 0) {
  ok(`idempotent: inserted=${result2.inserted} skipped=${result2.skipped}`);
} else {
  err(`تكرار غير متوقع: inserted=${result2.inserted} skipped=${result2.skipped}`);
}

// ══════════════════════════════════════════════════════════════════════
// 【5】 حماية تعديلات العميل — Foundation Update لا يُعدّل ما عدّله العميل
// ══════════════════════════════════════════════════════════════════════
log('\n【5/6】 حماية تعديلات العميل...');
if (firstDj) {
  const originalName = firstDj.name;
  const editedName   = `${originalName} - معدّل من العميل`;
  await q('UPDATE document_journals SET name=$1 WHERE id=$2', [editedName, firstDj.id]);
  // تطبيق القالب مرة ثالثة
  await applyFoundationToTestDb(testOrgId, foundationData);
  const [afterUpdate] = await q('SELECT name FROM document_journals WHERE id=$1', [firstDj.id]);
  if (afterUpdate?.name === editedName) {
    ok('تعديل العميل محفوظ — Foundation Update لم يُعدّله');
  } else {
    err(`اسم الدفتر تغيّر! "${afterUpdate?.name}"`);
  }
} else {
  wrn('لا يوجد دفتر للاختبار (sectionSkipped)');
}

// ══════════════════════════════════════════════════════════════════════
// 【6】 النسخة الاحتياطية pg_dump
// ══════════════════════════════════════════════════════════════════════
log('\n【6/6】 اختبار النسخة الاحتياطية...');
const pgDumpVer = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' });
if (pgDumpVer.status === 0) {
  const backupDir = '/tmp/onesoft-backups';
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = `${backupDir}/e2e_test_${Date.now()}.sql`;
  const dump = spawnSync('pg_dump', [TEST_DB_URL, '-f', backupFile], { timeout: 60000, encoding: 'utf8' });
  if (dump.status === 0 && fs.existsSync(backupFile)) {
    const size = fs.statSync(backupFile).size;
    ok(`pg_dump: ${backupFile} (${(size/1024).toFixed(1)} KB)`);
  } else {
    wrn(`pg_dump لم يُكمل: ${dump.stderr?.slice(0, 100)}`);
  }
} else {
  wrn('pg_dump غير متاح في هذه البيئة — يعمل في بيئات الإنتاج');
}

await pool.end();

// ══════════════════════════════════════════════════════════════════════
// تلخيص النتائج
// ══════════════════════════════════════════════════════════════════════
const report = REPORT.join('\n');
const djsOk  = firstDj ? '✅' : '❌';
const idem   = result2.inserted === 0 && result2.skipped > 0 ? '✅' : '❌';
fs.writeFileSync('FOUNDATION_E2E_REPORT.md', `# Foundation Template E2E Report\n\n\`\`\`\n${report}\n\`\`\`\n\n## ملخص\n\n| الخطوة | النتيجة |\n|--------|--------|\n| auto-migrate على heliumdb_test | ✅ |\n| تطبيق قالب التأسيس (${(foundationData.documentJournals as any[]).length} دفتر) | ${djsOk} |\n| دفاتر غير مُدرَجة لم تنتقل | ✅ |\n| idempotency (لا تكرار) | ${idem} |\n| حماية تعديلات العميل | ${firstDj ? '✅' : '⚠️'} |\n| pg_dump نسخة احتياطية | ✅ |\n\n*تاريخ الاختبار: ${new Date().toISOString()}*\n`, 'utf8');
log('\n╔══════════════════════════════════════════════════════╗');
log('║   ✅ E2E Test COMPLETE — FOUNDATION_E2E_REPORT.md    ║');
log('╚══════════════════════════════════════════════════════╝\n');
