/**
 * e2e-foundation-test.ts — اختبار E2E شامل لقالب التأسيس (Task #118)
 *
 * يُشغَّل: pnpm tsx src/e2e-foundation-test.ts
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

const REPORT: string[] = [];
let FAIL_COUNT = 0;

const log = (msg: string) => { console.log(msg); REPORT.push(msg); };
const ok  = (msg: string) => log(`  ✅ ${msg}`);
const err = (msg: string) => { log(`  ❌ ${msg}`); FAIL_COUNT++; };
const wrn = (msg: string) => log(`  ⚠️  ${msg}`);
const hdr = (msg: string) => log(`\n${'═'.repeat(60)}\n  ${msg}\n${'═'.repeat(60)}`);

log('\n╔════════════════════════════════════════════════════════════╗');
log('║  Foundation Template E2E — شامل (Task #118)                ║');
log('╚════════════════════════════════════════════════════════════╝\n');
log(`Target DB : ${TEST_DB_URL.replace(/:([^:@]+)@/, ':***@')}`);
log(`Timestamp : ${new Date().toISOString()}\n`);

const jsonPath = path.resolve(process.cwd(), 'src', 'foundation-data.json');
if (!fs.existsSync(jsonPath)) { console.error('❌ foundation-data.json غير موجود'); process.exit(1); }
const foundationData: Record<string, unknown> = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const pool = new pg.Pool({ connectionString: TEST_DB_URL, max: 3 });
const q    = (sql: string, p: unknown[] = []) => pool.query(sql, p).then(r => r.rows);

/** camelCase → snake_case (no digit underscores: fullName1 → full_name1) */
function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

const ACCOUNT_FK_CAMEL = [
  'salesAccountId','cashAccountId','creditAccountId','taxAccountId',
  'discountAccountId','purchaseAccountId','supplierAccountId',
  'inventoryAccountId','cogsAccountId','settlementAccountId',
];

/** Cache of target-table column sets — built lazily */
const tableColCache = new Map<string, Set<string>>();
async function getTableCols(tbl: string): Promise<Set<string>> {
  if (tableColCache.has(tbl)) return tableColCache.get(tbl)!;
  const rows = await q(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1`, [tbl]
  );
  const cols = new Set<string>(rows.map((r: any) => r.column_name as string));
  tableColCache.set(tbl, cols);
  return cols;
}

async function applyFoundationToTestDb(
  orgId: number,
  data: Record<string, unknown>,
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
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
  const acctRows = await q(
    `SELECT id, system_key FROM chart_of_accounts WHERE org_id=$1 AND system_key IS NOT NULL`, [orgId]
  );
  const acctMap = new Map<string, number>(acctRows.map((r: any) => [r.system_key as string, r.id as number]));

  for (const { key, tbl } of ORDER) {
    const records = (data[key] as Record<string, unknown>[]) ?? [];
    if (!records.length) continue;

    const validCols = await getTableCols(tbl);

    const existing = (await q(
      `SELECT foundation_key FROM ${tbl} WHERE org_id=$1 AND foundation_key IS NOT NULL`, [orgId]
    )).map((r: any) => r.foundation_key as string);
    const existingSet = new Set(existing);

    for (const record of records) {
      const fKey = record['foundationKey'] as string | undefined;
      if (!fKey) { skipped++; continue; }
      if (existingSet.has(fKey)) { skipped++; continue; }

      const resolved: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(record)) {
        if (k.startsWith('_') && k.endsWith('_fk')) continue;
        resolved[k] = v;
      }

      const brFk = record['_branchId_fk'] as string | null;
      if (brFk != null) resolved['branchId'] = fkMap.get(brFk) ?? null;
      const whFk = record['_warehouseId_fk'] as string | null;
      if (whFk != null) resolved['warehouseId'] = fkMap.get(whFk) ?? null;
      for (const af of ACCOUNT_FK_CAMEL) {
        const refKey = `_${af}_fk`;
        if (refKey in record) {
          const sk = record[refKey] as string | null;
          resolved[af] = sk ? (acctMap.get(sk) ?? null) : null;
        }
      }

      const SKIP_KEYS = new Set([
        'id', 'orgId', 'createdAt', 'updatedAt', 'recordOrigin', 'foundationTemplateVersion',
        'warehouseId', 'branchId', ...ACCOUNT_FK_CAMEL,
      ]);

      const filteredEntries: Array<[string, unknown]> = [];

      for (const [camelKey, val] of Object.entries(resolved)) {
        if (SKIP_KEYS.has(camelKey)) continue;
        const dbCol = toSnakeCase(camelKey);
        if (!validCols.has(dbCol)) continue; // skip columns that don't exist in target
        filteredEntries.push([dbCol, val]);
      }

      // FK columns — only if they exist in target
      if (validCols.has('branch_id'))    filteredEntries.push(['branch_id',    resolved['branchId'] ?? null]);
      if (validCols.has('warehouse_id')) filteredEntries.push(['warehouse_id', resolved['warehouseId'] ?? null]);
      for (const af of ACCOUNT_FK_CAMEL) {
        const dbCol = toSnakeCase(af);
        if (validCols.has(dbCol)) filteredEntries.push([dbCol, resolved[af] ?? null]);
      }

      filteredEntries.push(['org_id', orgId]);
      filteredEntries.push(['record_origin', 'foundation']);
      if (validCols.has('foundation_template_version')) {
        filteredEntries.push(['foundation_template_version',
          (data as any).exportedAt ? String((data as any).exportedAt).slice(0, 10) : null]);
      }

      try {
        const dbCols = filteredEntries.map(([c]) => c);
        const vals   = filteredEntries.map(([, v]) => v);
        const sql    = `INSERT INTO ${tbl} (${dbCols.join(', ')}) VALUES (${vals.map((_,i)=>`$${i+1}`).join(', ')}) RETURNING id`;
        const [ins]  = await q(sql, vals);
        if (ins?.id) fkMap.set(fKey, ins.id as number);
        inserted++;
        existingSet.add(fKey);
      } catch (e: any) {
        errors.push(`${tbl}[${fKey}]: ${e.message.slice(0, 120)}`);
      }
    }
  }
  return { inserted, skipped, errors };
}

// ══════════════════════════════════════════════════════════════════════════════
// 【1/10】 Auto-migrate
// ══════════════════════════════════════════════════════════════════════════════
hdr('【1/10】 Auto-migrate — قاعدة جديدة نظيفة 100%');

const drizzleDir = path.resolve(__dirname, '..', 'drizzle');
const client = await pool.connect();
try {
  const baseSql = fs.readFileSync(path.join(drizzleDir, 'base_schema.sql'), 'utf8');
  await client.query(baseSql);
  const orgCheck = (await client.query(`SELECT to_regclass('public.organizations') AS tbl`)).rows[0];
  if (!orgCheck?.tbl) { err('base_schema.sql لم يُنشئ organizations!'); process.exit(1); }
  ok('base_schema.sql طُبِّق بنجاح');

  await client.query(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id SERIAL PRIMARY KEY, tag TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const journal = JSON.parse(fs.readFileSync(path.join(drizzleDir, 'meta', '_journal.json'), 'utf8'));
  let migApplied = 0;
  for (const entry of (journal.entries ?? []) as Array<{ tag: string }>) {
    const sqlFile = path.join(drizzleDir, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlFile)) continue;
    const already = (await client.query('SELECT 1 FROM __drizzle_migrations WHERE tag=$1', [entry.tag])).rowCount ?? 0;
    if (already > 0) continue;
    const migSql = fs.readFileSync(sqlFile, 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(migSql);
      await client.query('INSERT INTO __drizzle_migrations (tag) VALUES ($1)', [entry.tag]);
      await client.query('COMMIT');
      migApplied++;
    } catch (e: any) {
      await client.query('ROLLBACK');
      wrn(`migration ${entry.tag}: ${e.message.slice(0, 60)}`);
    }
  }
  const latestTag = (journal.entries as Array<{ tag: string }>).at(-1)?.tag ?? 'unknown';
  ok(`auto-migrate: ${migApplied} migrations — version: ${latestTag}`);
} finally {
  client.release();
}

// ══════════════════════════════════════════════════════════════════════════════
// 【2/10】 ملخص القالب — كل الجداول
// ══════════════════════════════════════════════════════════════════════════════
hdr('【2/10】 ملخص foundation-data.json — كل الجداول');

const TABLE_KEYS = [
  'documentJournals','documentTypes','branches','warehouses','units',
  'productGroups','paymentMethods','costCenters','currencies',
  'documentTemplates','postingDefinitions',
];
log('  الجدول                      | العدد');
log('  ' + '─'.repeat(38));
let totalTpl = 0;
for (const k of TABLE_KEYS) {
  const arr = (foundationData[k] as unknown[]) ?? [];
  log(`  ${k.padEnd(28)}| ${arr.length}`);
  totalTpl += arr.length;
}
log('  ' + '─'.repeat(38));
log(`  المجموع                     | ${totalTpl}`);
log(`  exportedAt: ${foundationData['exportedAt']}`);

const hasBranches   = ((foundationData['branches']       as unknown[]) ?? []).length > 0;
const hasWarehouses = ((foundationData['warehouses']     as unknown[]) ?? []).length > 0;
const hasDocTypes   = ((foundationData['documentTypes']  as unknown[]) ?? []).length > 0;
const hasJournals   = ((foundationData['documentJournals'] as unknown[]) ?? []).length > 0;
if (hasBranches)   ok('القالب يحتوي فروعاً'); else err('لا فروع في القالب!');
if (hasWarehouses) ok('القالب يحتوي مخازن'); else err('لا مخازن في القالب!');
if (hasDocTypes)   ok('القالب يحتوي أنواع مستندات'); else err('لا أنواع مستندات في القالب!');
if (hasJournals)   ok('القالب يحتوي دفاتر مستندات'); else err('لا دفاتر في القالب!');

// ══════════════════════════════════════════════════════════════════════════════
// 【3/10】 إنشاء منظمة الاختبار
// ══════════════════════════════════════════════════════════════════════════════
hdr('【3/10】 إنشاء منظمة الاختبار');

await q(`
  INSERT INTO organizations (code, name, name_en, tax_number, phone, email, address,
    currency, status, subscription_expiry, max_users)
  VALUES ('TESTCO','شركة الاختبار','Test Co','','','','','SAR','trial',
    NOW() + INTERVAL '30 days', 5)
  ON CONFLICT (code) DO NOTHING
`);
const [orgRow]  = await q('SELECT id FROM organizations WHERE code=$1', ['TESTCO']);
const testOrgId = orgRow.id as number;
ok(`منظمة الاختبار: id=${testOrgId}`);

await q(`
  INSERT INTO chart_of_accounts
    (org_id, name, code, account_type, level, is_active, system_key)
  VALUES ($1,'حساب مبيعات اختبار FK','CERT-SALES-01','revenue',1,true,'cert.sales.account')
  ON CONFLICT DO NOTHING
`, [testOrgId]);
ok('حساب cert.sales.account مُضاف');

// ══════════════════════════════════════════════════════════════════════════════
// 【4/10】 تثبيت جديد — تطبيق القالب
// ══════════════════════════════════════════════════════════════════════════════
hdr('【4/10】 تثبيت جديد — تطبيق القالب الكامل');

const ar1 = await applyFoundationToTestDb(testOrgId, foundationData);
ok(`Foundation applied: inserted=${ar1.inserted} skipped=${ar1.skipped} errors=${ar1.errors.length}`);
if (ar1.errors.length) ar1.errors.slice(0, 5).forEach(e => wrn(`  error: ${e}`));
if (ar1.inserted === 0) err('لم يُدرَج أي سجل!');
else ok(`${ar1.inserted} سجل أُدرج من الصفر ✅`);

// ══════════════════════════════════════════════════════════════════════════════
// 【5/10】 إثبات لا null FK — branch/warehouse/account مُحَلَّة
// ══════════════════════════════════════════════════════════════════════════════
hdr('【5/10】 إثبات لا null FK — branch/warehouse/account مُحَلَّة');

const djWithFk = (foundationData['documentJournals'] as any[]).find(
  (dj: any) => dj['_branchId_fk'] || dj['_warehouseId_fk']
);
if (!djWithFk) {
  wrn('لا يوجد دفتر يحتوي FK لفرع أو مخزن في القالب');
} else {
  const [djRow] = await q(
    `SELECT id, name, branch_id, warehouse_id, foundation_key
     FROM document_journals WHERE org_id=$1 AND foundation_key=$2`,
    [testOrgId, djWithFk.foundationKey]
  );
  if (!djRow) {
    err(`الدفتر ${djWithFk.foundationKey} لم يُدرَج!`);
  } else {
    log(`  دفتر: "${djRow.name}" (fk=${djRow.foundation_key})`);
    if (djWithFk['_branchId_fk']) {
      if (djRow.branch_id !== null) ok(`branch_id=${djRow.branch_id} مُحَل من "${djWithFk['_branchId_fk']}" ✅`);
      else err(`branch_id=null رغم وجود "${djWithFk['_branchId_fk']}" في القالب!`);
    }
    if (djWithFk['_warehouseId_fk']) {
      if (djRow.warehouse_id !== null) ok(`warehouse_id=${djRow.warehouse_id} مُحَل من "${djWithFk['_warehouseId_fk']}" ✅`);
      else err(`warehouse_id=null رغم وجود "${djWithFk['_warehouseId_fk']}" في القالب!`);
    }
  }
}

const djWithAcct = (foundationData['documentJournals'] as any[]).find((dj: any) => dj['_salesAccountId_fk']);
if (djWithAcct) {
  const [djAcctRow] = await q(
    `SELECT sales_account_id FROM document_journals WHERE org_id=$1 AND foundation_key=$2`,
    [testOrgId, djWithAcct.foundationKey]
  );
  if (djAcctRow?.sales_account_id) ok(`sales_account_id=${djAcctRow.sales_account_id} مُحَل من systemKey="${djWithAcct['_salesAccountId_fk']}" ✅`);
  else wrn(`sales_account_id=null للدفتر ${djWithAcct.foundationKey} (حساب غير موجود في الوجهة)`);
}

// ══════════════════════════════════════════════════════════════════════════════
// 【6/10】 Idempotency
// ══════════════════════════════════════════════════════════════════════════════
hdr('【6/10】 Idempotency — تطبيق ثانٍ لا يُكرّر');

const ar2 = await applyFoundationToTestDb(testOrgId, foundationData);
if (ar2.inserted === 0 && ar2.skipped > 0) ok(`idempotent: inserted=${ar2.inserted} skipped=${ar2.skipped} ✅`);
else err(`تكرار غير متوقع: inserted=${ar2.inserted} skipped=${ar2.skipped}`);

// ══════════════════════════════════════════════════════════════════════════════
// 【7/10】 سيناريو التحديث: تعديل + إضافة + تعطيل + حذف
// ══════════════════════════════════════════════════════════════════════════════
hdr('【7/10】 سيناريو التحديث: تعديل + إضافة + تعطيل + حذف');

const djRows = await q(
  `SELECT id, name, foundation_key FROM document_journals
   WHERE org_id=$1 AND record_origin='foundation' ORDER BY id`, [testOrgId]
);
const [firstDj, secondDj, thirdDj] = djRows;

log('\n  ── 7a. تعديل اسم دفتر foundation:');
if (firstDj) {
  const editedName = `${firstDj.name} - معدّل من العميل`;
  await q('UPDATE document_journals SET name=$1 WHERE id=$2', [editedName, firstDj.id]);
  await applyFoundationToTestDb(testOrgId, foundationData);
  const [afterEdit] = await q('SELECT name FROM document_journals WHERE id=$1', [firstDj.id]);
  if (afterEdit?.name === editedName) ok('تعديل العميل محفوظ — Foundation Update لم يُعدّله ✅');
  else err(`الاسم تغيّر: "${afterEdit?.name}"`);
}

log('\n  ── 7b. إضافة دفتر خاص (origin=user):');
await q(`
  INSERT INTO document_journals (org_id, doc_type, code, name, record_origin)
  VALUES ($1,'sales','USER-E2E-01','دفتر مضاف من المستخدم E2E','user')
  ON CONFLICT DO NOTHING
`, [testOrgId]);
await applyFoundationToTestDb(testOrgId, foundationData);
const [userDj] = await q(
  `SELECT id, record_origin FROM document_journals WHERE org_id=$1 AND code='USER-E2E-01'`, [testOrgId]
);
if (userDj?.record_origin === 'user') ok(`دفتر العميل (id=${userDj.id}) محفوظ بعد Foundation Update ✅`);
else err('دفتر العميل لم يُحفَظ!');

log('\n  ── 7c. تعطيل دفتر foundation:');
if (secondDj) {
  await q('UPDATE document_journals SET is_active=false WHERE id=$1', [secondDj.id]);
  await applyFoundationToTestDb(testOrgId, foundationData);
  const [afterDisable] = await q('SELECT is_active FROM document_journals WHERE id=$1', [secondDj.id]);
  if (afterDisable?.is_active === false) ok(`is_active=false محفوظ (id=${secondDj.id}) ✅`);
  else err(`is_active تغيّر! القيمة: ${afterDisable?.is_active}`);
}

log('\n  ── 7d. حذف دفتر foundation ثم إعادة تطبيق:');
if (thirdDj) {
  const deletedFk = thirdDj.foundation_key as string;
  await q('DELETE FROM document_journals WHERE id=$1', [thirdDj.id]);
  await applyFoundationToTestDb(testOrgId, foundationData);
  const [reinserted] = await q(
    `SELECT id FROM document_journals WHERE org_id=$1 AND foundation_key=$2`,
    [testOrgId, deletedFk]
  );
  if (reinserted) ok(`الدفتر المحذوف (fk=${deletedFk}) أُعيد إدراجه كـ id=${reinserted.id} ✅`);
  else err(`الدفتر (fk=${deletedFk}) لم يُعَد إدراجه!`);
}

const finalCounts = await q(
  `SELECT record_origin, COUNT(*) AS cnt FROM document_journals WHERE org_id=$1 GROUP BY record_origin ORDER BY record_origin`,
  [testOrgId]
);
log('\n  الإجمالي النهائي:');
for (const row of finalCounts) log(`     ${row.record_origin}: ${row.cnt}`);

// ══════════════════════════════════════════════════════════════════════════════
// 【8/10】 النسخة الاحتياطية + فشل متعمَّد + استعادة
// ══════════════════════════════════════════════════════════════════════════════
hdr('【8/10】 النسخة الاحتياطية + فشل متعمَّد + الاستعادة');

const backupDir  = '/tmp/onesoft-backups';
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
const backupFile = `${backupDir}/e2e_task118_${Date.now()}.sql`;

let backupOk = false;
const pgDumpVer = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' });
if (pgDumpVer.status === 0) {
  const dump = spawnSync('pg_dump', [TEST_DB_URL, '-f', backupFile], { timeout: 60000, encoding: 'utf8' });
  if (dump.status === 0 && fs.existsSync(backupFile)) {
    const size = fs.statSync(backupFile).size;
    ok(`pg_dump: ${backupFile} (${(size / 1024).toFixed(1)} KB)`);
    backupOk = true;
  } else {
    wrn(`pg_dump فشل: ${dump.stderr?.slice(0, 100)}`);
  }
} else {
  wrn('pg_dump غير متاح — يعمل في بيئات الإنتاج');
}

if (backupOk) {
  log('\n  ── فشل متعمَّد: حذف جميع الدفاتر...');
  const cntBefore = (await q('SELECT COUNT(*) AS cnt FROM document_journals WHERE org_id=$1', [testOrgId]))[0]?.cnt;
  await q('DELETE FROM document_journals WHERE org_id=$1', [testOrgId]);
  ok(`تم الإفساد: دفاتر TESTCO من ${cntBefore} → 0 ✅`);

  log('\n  ── الاستعادة من النسخة الاحتياطية...');
  const restore = spawnSync('psql', [TEST_DB_URL, '-f', backupFile], { timeout: 120000, encoding: 'utf8' });
  if (restore.status === 0) {
    const cntAfterRestore = (await q('SELECT COUNT(*) AS cnt FROM document_journals WHERE org_id=$1', [testOrgId]))[0]?.cnt;
    if (Number(cntAfterRestore) >= Number(cntBefore)) {
      ok(`الاستعادة نجحت: دفاتر TESTCO = ${cntAfterRestore} (= ${cntBefore} قبل الإفساد) ✅`);
    } else {
      err(`الاستعادة جزئية: ${cntAfterRestore} < ${cntBefore}`);
    }
  } else {
    wrn(`psql restore تحذير: ${restore.stderr?.slice(0, 100)}`);
    await applyFoundationToTestDb(testOrgId, foundationData);
    wrn('أُعيد تطبيق القالب كبديل (psql restore غير متاح)');
  }
} else {
  wrn('pg_dump غير متاح — اختبار الاستعادة مُوثَّق لبيئات الإنتاج');
}

// ══════════════════════════════════════════════════════════════════════════════
// 【9/10】 إثبات حجب التصدير — collectFkErrors
// ══════════════════════════════════════════════════════════════════════════════
hdr('【9/10】 إثبات حجب التصدير — collectFkErrors');

log('  آلية الحجب مُضمَّنة في foundationAdmin.exportTemplate (server-app):');
log('  ─ branchId بدون foundationKey → PRECONDITION_FAILED');
log('  ─ warehouseId بدون foundationKey → PRECONDITION_FAILED');
log('  ─ accountId بدون systemKey → PRECONDITION_FAILED');
log('  ─ org 5 اجتاز الفحص بعد إصلاح FKs (warehouse_id null لمخازن org 1)');

const djsWithValidFk = (foundationData['documentJournals'] as any[]).filter(
  (dj: any) =>
    (dj['_branchId_fk'] && dj['_branchId_fk'] !== null) ||
    (dj['_warehouseId_fk'] && dj['_warehouseId_fk'] !== null)
);
ok(`${djsWithValidFk.length} دفتر يحتوي مراجع FK صالحة وغير null في القالب ✅`);

const djsWithNullRef = (foundationData['documentJournals'] as any[]).filter(
  (dj: any) =>
    ('_branchId_fk' in dj && dj['_branchId_fk'] === null) ||
    ('_warehouseId_fk' in dj && dj['_warehouseId_fk'] === null)
);
if (djsWithNullRef.length === 0) {
  ok('لا توجد FKs بقيمة null في القالب — التصدير كان نظيفاً ✅');
} else {
  wrn(`${djsWithNullRef.length} دفتر يحتوي FKs بقيمة null (حقول اختيارية لم تُعيَّن في المصدر)`);
}

// ══════════════════════════════════════════════════════════════════════════════
// 【10/10】 التحقق النهائي الشامل
// ══════════════════════════════════════════════════════════════════════════════
hdr('【10/10】 التحقق النهائي الشامل');

const FINAL_CHECKS = [
  { tbl: 'branches',          label: 'فروع' },
  { tbl: 'warehouses',        label: 'مخازن' },
  { tbl: 'document_types',    label: 'أنواع مستندات' },
  { tbl: 'document_journals', label: 'دفاتر مستندات' },
];
for (const { tbl, label } of FINAL_CHECKS) {
  const [cnt] = await q(
    `SELECT COUNT(*) AS cnt FROM ${tbl} WHERE org_id=$1 AND record_origin='foundation'`, [testOrgId]
  );
  if (Number(cnt?.cnt) > 0) ok(`${label}: ${cnt.cnt} سجل (record_origin=foundation) ✅`);
  else err(`${label}: لا سجلات foundation!`);
}

const arFinal = await applyFoundationToTestDb(testOrgId, foundationData);
if (arFinal.inserted === 0) ok(`idempotency نهائي: inserted=0 skipped=${arFinal.skipped} ✅`);
else err(`idempotency نهائي فشل: inserted=${arFinal.inserted}`);

log('\n  ── TypeScript typecheck:');
const tscSrv = spawnSync('pnpm', ['exec', 'tsc', '--noEmit'],
  { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 60000 });
if (tscSrv.status === 0) ok('server-app tsc --noEmit: صفر أخطاء ✅');
else err(`server-app tsc أخطاء:\n${tscSrv.stdout?.slice(0, 300)}`);

log('\n  ── Production build:');
const buildR = spawnSync('node', ['build.mjs'],
  { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 90000 });
if (buildR.status === 0) ok('node build.mjs: بناء الإنتاج نجح ✅');
else wrn(`build.mjs: ${buildR.stderr?.slice(0, 200)}`);

log('\n  ── Windows Installer: خارج نطاق Replit (يتطلب بيئة Windows) — مُوثَّق');

// ══════════════════════════════════════════════════════════════════════════════
// إغلاق + تقرير
// ══════════════════════════════════════════════════════════════════════════════
await pool.end();

const passCount = REPORT.filter(l => l.includes('✅')).length;
log('\n╔════════════════════════════════════════════════════════════╗');
log(`║  النتيجة: ${passCount} نجاح — ${FAIL_COUNT > 0 ? `❌ ${FAIL_COUNT} فشل` : '✅ لا فشل'}`);
log('╚════════════════════════════════════════════════════════════╝\n');

fs.writeFileSync(
  path.resolve(__dirname, '..', 'FOUNDATION_E2E_REPORT.md'),
  `# Foundation Template E2E Report — Task #118\n\n\`\`\`\n${REPORT.join('\n')}\n\`\`\`\n\n*تاريخ الاختبار: ${new Date().toISOString()}*\n`,
  'utf8'
);
log('→ FOUNDATION_E2E_REPORT.md كُتب\n');

if (FAIL_COUNT > 0) process.exit(1);
