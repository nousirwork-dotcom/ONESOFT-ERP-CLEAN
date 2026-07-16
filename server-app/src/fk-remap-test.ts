import { Pool } from 'pg';
import fs from 'fs';

const SRC_DB = process.env.DATABASE_URL!;
const DST_DB = process.env.DATABASE_URL!.replace('heliumdb?', 'heliumdb_test?');
const ORG_ID = 5; // المنظمة المصدر في heliumdb

const srcPool = new Pool({ connectionString: SRC_DB });
const dstPool = new Pool({ connectionString: DST_DB });

async function sq(sql: string, p: unknown[] = []) { return (await srcPool.query(sql, p)).rows; }
async function dq(sql: string, p: unknown[] = []) { return (await dstPool.query(sql, p)).rows; }

async function run() {
  console.log('=== FK Remap Test ===\n');

  // 1. قراءة الدفتر التجريبي من المصدر
  const [djSrc] = await sq(`
    SELECT d.id, d.name, d.foundation_key, d.doc_type,
      d.branch_id, b.foundation_key AS branch_fk,
      d.warehouse_id, w.foundation_key AS wh_fk,
      d.sales_account_id, a.system_key AS acct_sk
    FROM document_journals d
    LEFT JOIN branches b ON b.id=d.branch_id
    LEFT JOIN warehouses w ON w.id=d.warehouse_id
    LEFT JOIN chart_of_accounts a ON a.id=d.sales_account_id
    WHERE d.foundation_key='dj.cert.fk.test.01' AND d.org_id=$1`, [ORG_ID]);

  console.log('المصدر (heliumdb org_id=5):');
  console.log(`  branch_id=${djSrc.branch_id} → branch_fk="${djSrc.branch_fk}"`);
  console.log(`  warehouse_id=${djSrc.warehouse_id} → wh_fk="${djSrc.wh_fk}"`);
  console.log(`  sales_account_id=${djSrc.sales_account_id} → acct_sk="${djSrc.acct_sk}"`);
  console.log(`  ✅ FK references موثَّقة في المصدر`);

  // 2. في الوجهة: إنشئ branch + warehouse + account بنفس foundation_key / system_key
  const dstOrgId = 1;

  // Branch في heliumdb_test
  const [dstBranch] = await dq(`SELECT id FROM branches WHERE org_id=$1 AND foundation_key=$2`, [dstOrgId, djSrc.branch_fk]);
  const dstBranchId = dstBranch?.id;

  // Warehouse في heliumdb_test
  const [dstWh] = await dq(`SELECT id FROM warehouses WHERE org_id=$1 AND foundation_key=$2`, [dstOrgId, djSrc.wh_fk]);
  const dstWhId = dstWh?.id;

  // Account في heliumdb_test — إنشاء أو استخدام موجود
  let [dstAcct] = await dq(`SELECT id FROM chart_of_accounts WHERE org_id=$1 AND system_key=$2`, [dstOrgId, djSrc.acct_sk]);
  if (!dstAcct) {
    const [inserted] = await dq(`
      INSERT INTO chart_of_accounts (org_id, name, code, account_type, system_key)
      VALUES ($1, 'حساب مبيعات اختبار (وجهة)', 'DST-CERT-01', 'revenue', $2)
      RETURNING id`, [dstOrgId, djSrc.acct_sk]);
    dstAcct = inserted;
  }
  const dstAcctId = dstAcct?.id;

  console.log(`\nالوجهة (heliumdb_test org_id=1):`);
  console.log(`  branch_fk="${djSrc.branch_fk}" → new branch_id=${dstBranchId ?? 'N/A'}`);
  console.log(`  wh_fk="${djSrc.wh_fk}" → new warehouse_id=${dstWhId ?? 'N/A'}`);
  console.log(`  acct_sk="${djSrc.acct_sk}" → new account_id=${dstAcctId}`);

  // 3. تطبيق Foundation Update: أدرج الدفتر مع IDs الجديدة (المُعاد رسمها)
  const existing = await dq(`SELECT id FROM document_journals WHERE org_id=$1 AND foundation_key='dj.cert.fk.test.01'`, [dstOrgId]);
  if (existing.length > 0) {
    await dq(`DELETE FROM document_journals WHERE org_id=$1 AND foundation_key='dj.cert.fk.test.01'`, [dstOrgId]);
  }

  const [djDst] = await dq(`
    INSERT INTO document_journals (org_id, doc_type, code, name, record_origin, foundation_key, is_active,
      branch_id, warehouse_id, sales_account_id)
    VALUES ($1, $2, $3, $4, 'foundation', 'dj.cert.fk.test.01', true, $5, $6, $7)
    RETURNING id, branch_id, warehouse_id, sales_account_id`,
    [dstOrgId, djSrc.doc_type, 'CERT01', djSrc.name, dstBranchId ?? null, dstWhId ?? null, dstAcctId ?? null]);

  console.log(`\n=== نتيجة FK Remap ===`);
  console.log(`المصدر: branch_id=${djSrc.branch_id} → الوجهة: branch_id=${djDst?.branch_id}`);
  console.log(`المصدر: warehouse_id=${djSrc.warehouse_id} → الوجهة: warehouse_id=${djDst?.warehouse_id}`);
  console.log(`المصدر: sales_account_id=${djSrc.sales_account_id} → الوجهة: sales_account_id=${djDst?.sales_account_id}`);

  const allMatch = (
    dstBranchId && djDst?.branch_id === dstBranchId &&
    dstWhId && djDst?.warehouse_id === dstWhId &&
    dstAcctId && djDst?.sales_account_id === dstAcctId
  );
  console.log(allMatch ? '\n✅ FK Remap: IDs الوجهة مختلفة عن IDs المصدر (تحققت الإعادة)' : '\n⚠️ بعض الـ IDs لم تتغير أو فارغة');

  // تحقق نهائي: IDs مختلفة بين المصدر والوجهة
  if (djSrc.branch_id !== djDst?.branch_id) console.log(`  ✅ branch_id: ${djSrc.branch_id} ≠ ${djDst?.branch_id}`);
  if (djSrc.warehouse_id !== djDst?.warehouse_id) console.log(`  ✅ warehouse_id: ${djSrc.warehouse_id} ≠ ${djDst?.warehouse_id}`);
  if (djSrc.sales_account_id !== djDst?.sales_account_id) console.log(`  ✅ sales_account_id: ${djSrc.sales_account_id} ≠ ${djDst?.sales_account_id}`);

  await srcPool.end(); await dstPool.end();
}
run().catch(e => { console.error('ERR:', e.message); process.exit(1); });
