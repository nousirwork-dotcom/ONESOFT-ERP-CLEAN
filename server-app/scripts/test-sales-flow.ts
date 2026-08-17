import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { fileURLToPath } from 'node:url';

const { Client } = pg;
const root = path.dirname(fileURLToPath(import.meta.url)).replace(`${path.sep}scripts`, '');
const drizzleDir = path.join(root, 'drizzle');
const baseSchema = fs.readFileSync(path.join(drizzleDir, 'base_schema.sql'), 'utf8');
const journal = JSON.parse(fs.readFileSync(path.join(drizzleDir, 'meta/_journal.json'), 'utf8')) as {
  entries: Array<{ tag: string }>;
};
const migrations = journal.entries.map(({ tag }) => fs.readFileSync(path.join(drizzleDir, `${tag}.sql`), 'utf8'));
const adminUrl = process.env.DATABASE_URL;
if (!adminUrl) throw new Error('DATABASE_URL is required');
const testDb = `onesoft_sales_flow_${process.pid}`;
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${testDb}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SALES FLOW FAIL: ${message}`);
}

async function q(client: pg.Client, text: string, values: unknown[] = []) {
  return client.query(text, values);
}

async function main() {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await q(admin, `DROP DATABASE IF EXISTS ${quote(testDb)}`);
  await q(admin, `CREATE DATABASE ${quote(testDb)}`);
  await admin.end();

  const client = new Client({ connectionString: testUrl.toString() });
  let activePool: { end: () => Promise<void> } | null = null;
  await client.connect();
  try {
    await q(client, baseSchema);
    for (const migration of migrations) await q(client, migration);

    const org = await q(client, `INSERT INTO organizations (code, name, status) VALUES ('FLOW-TEST', 'Sales Flow Test', 'trial') RETURNING id`);
    const orgId = Number(org.rows[0].id);
    const user = await q(client, `INSERT INTO users (org_id, username, password_hash, name, role) VALUES ($1, 'flow_admin', 'test', 'Flow Admin', 'admin') RETURNING id`, [orgId]);
    const userId = Number(user.rows[0].id);
    const warehouse = await q(client, `INSERT INTO warehouses (org_id, code, name) VALUES ($1, 'WH-FLOW', 'Flow Warehouse') RETURNING id`, [orgId]);
    const warehouseId = Number(warehouse.rows[0].id);
    const accounts = await q(client, `INSERT INTO chart_of_accounts (org_id, code, name, account_type) VALUES
      ($1, '1100', 'Cash', 'asset'), ($1, '4100', 'Sales', 'income'),
      ($1, '2200', 'VAT', 'liability'), ($1, '5100', 'COGS', 'expense'),
      ($1, '1300', 'Inventory', 'asset') RETURNING id, code`, [orgId]);
    const byCode = new Map(accounts.rows.map((row: { id: number; code: string }) => [row.code, Number(row.id)]));
    const customer = await q(client, `INSERT INTO customers (org_id, code, name) VALUES ($1, 'CUS-FLOW', 'Flow Customer') RETURNING id`, [orgId]);
    const customerId = Number(customer.rows[0].id);
    const product = await q(client, `INSERT INTO products (org_id, code, name, unit, item_type, sale_price, purchase_price) VALUES ($1, 'SKU-FLOW', 'Flow Item', 'pcs', 'stock', '100', '60') RETURNING id`, [orgId]);
    const productId = Number(product.rows[0].id);
    await q(client, `INSERT INTO inventory (org_id, product_id, warehouse_id, quantity, avg_cost) VALUES ($1, $2, $3, '10', '60')`, [orgId, productId, warehouseId]);

    const journal = async (docType: string, code: string, name: string, extra: Record<string, unknown> = {}) => {
      const result = await q(client, `INSERT INTO document_journals
        (org_id, doc_type, code, name, warehouse_id, number_prefix, first_number, last_number, num_digits, include_year,
         auto_serial, current_seq, payment_types_config, issuance_config, inventory_account_id, cogs_account_id)
        VALUES ($1,$2,$3,$4,$5,$6,1,999999,4,false,true,0,$7,$8,$9,$10) RETURNING id`,
        [orgId, docType, code, name, warehouseId, code, JSON.stringify(extra.paymentTypesConfig ?? null),
          JSON.stringify(extra.issuanceConfig ?? null), extra.inventoryAccountId ?? null, extra.cogsAccountId ?? null]);
      return Number(result.rows[0].id);
    };
    const salesSource = await journal('sales_invoice', 'SI-FLOW', 'Sales Invoice Flow', {
      paymentTypesConfig: { types: [{ id: 'cash', codeEn: 'cash' }], accountLinks: [
        { accountId: byCode.get('1100'), postingName: 'CASH_AMOUNT', postingSide: 'debit', description: 'Cash' },
        { accountId: byCode.get('4100'), postingName: 'NETSALES', postingSide: 'credit', description: 'Sales' },
        { accountId: byCode.get('2200'), postingName: 'TAX', postingSide: 'credit', description: 'VAT' },
      ] },
    });
    const salesTarget = await journal('journal_entry', 'SJ-FLOW', 'Sales Target Flow');
    const cogsTarget = await journal('journal_entry', 'CG-FLOW', 'COGS Target Flow');
    const stockIssue = await journal('stock_issue_items', 'ST-FLOW', 'Stock Issue Flow', {
      issuanceConfig: { journalEntryType: 'journal_entry', journalBookId: cogsTarget },
      inventoryAccountId: byCode.get('1300'), cogsAccountId: byCode.get('5100'),
    });
    await q(client, `UPDATE document_journals SET issuance_config = $1 WHERE id = $2`, [
      JSON.stringify({ journalEntryType: 'journal_entry', journalBookId: salesTarget, inventoryDocType: 'stock_issue_items', inventoryDocBookId: stockIssue }),
      salesSource,
    ]);

    // Load the actual caller only after DATABASE_URL points to the isolated DB.
    process.env.DATABASE_URL = testUrl.toString();
    const [{ appRouter }, { createCallerFactory }, dbModule] = await Promise.all([
      import('../src/routers/index.js'),
      import('../src/trpc.js'),
      import('../src/db.js'),
    ]);
    activePool = dbModule.pool;
    const caller = createCallerFactory(appRouter)({ req: {} as any, res: {} as any, user: {
      id: userId, orgId, role: 'admin', username: 'flow_admin', name: 'Flow Admin',
      extraPermissions: null,
    } as any });

    const input = {
      invoiceNumber: 'IGNORED', invoiceType: 'sale' as const, invoiceDate: '2026-08-17',
      customerId, customerName: 'Flow Customer', warehouseId, journalId: salesSource,
      currency: 'SAR', exchangeRate: '1', subtotal: '100', discountPercent: '0',
      discountAmount: '0', taxAmount: '15', total: '115', paidAmount: '115',
      remainingAmount: '0', paymentMethod: 'cash' as const, paymentBreakdown: { CASH: 115 },
      status: 'confirmed' as const, items: [{ productId, productCode: 'SKU-FLOW', productName: 'Flow Item',
        unit: 'pcs', quantity: '1', unitPrice: '100', discountPercent: '0', discountAmount: '0',
        taxPercent: '15', taxAmount: '15', total: '115' }],
    };
    let saved: any;
    try {
      saved = await caller.salesInvoices.create(input);
    } catch (error: any) {
      console.error('CREATE FAILURE DETAILS:', error?.cause ?? error);
      throw error;
    }
    const invoiceId = Number(saved.id);
    const afterSave = await q(client, `SELECT quantity FROM inventory WHERE org_id=$1 AND product_id=$2 AND warehouse_id=$3`, [orgId, productId, warehouseId]);
    const pending = await q(client, `SELECT COUNT(*)::int AS count FROM pending_account_movements WHERE source_doc_id=$1 AND status='unposted'`, [invoiceId]);
    const officialBefore = await q(client, `SELECT COUNT(*)::int AS count FROM journal_entries WHERE source_doc_id=$1`, [invoiceId]);
    const stockBefore = await q(client, `SELECT COUNT(*)::int AS count FROM stock_vouchers WHERE source_doc_id=$1`, [invoiceId]);
    assert(afterSave.rows[0].quantity === '9.0000', `Save quantity expected 9, got ${afterSave.rows[0].quantity}`);
    assert(Number(pending.rows[0].count) >= 3, 'Save pending account effects missing');
    assert(Number(officialBefore.rows[0].count) === 0 && Number(stockBefore.rows[0].count) === 0, 'Save created official documents');

    const posted = await caller.posting.postSalesInvoice({ invoiceId });
    const afterPost = await q(client, `SELECT quantity FROM inventory WHERE org_id=$1 AND product_id=$2 AND warehouse_id=$3`, [orgId, productId, warehouseId]);
    const pendingAfterPost = await q(client, `SELECT COUNT(*)::int AS count FROM pending_account_movements WHERE source_doc_id=$1 AND status='unposted'`, [invoiceId]);
    assert(Number(pendingAfterPost.rows[0].count) === 0, 'Pending accounting effects remained unposted after Post');
    const docs = await q(client, `SELECT si.invoice_number, je.entry_number AS sales_number, sj.voucher_number AS stock_number, cj.entry_number AS cogs_number,
      je.journal_id AS sales_journal_id, sj.source_journal_id AS stock_journal_id, cj.journal_id AS cogs_journal_id
      FROM sales_invoices si
      LEFT JOIN journal_entries je ON je.id=si.posted_journal_entry_id
      LEFT JOIN stock_vouchers sj ON sj.id=si.generated_stock_voucher_id
      LEFT JOIN journal_entries cj ON cj.id=sj.generated_journal_entry_id WHERE si.id=$1`, [invoiceId]);
    const accountEvidence = await q(client, `SELECT je.entry_number, je.journal_id, jel.account_code, jel.account_name, jel.debit, jel.credit
      FROM journal_entries je JOIN journal_entry_lines jel ON jel.entry_id=je.id
      WHERE je.id IN ($1,$2) ORDER BY je.id, jel.id`, [posted.journalEntryId, posted.stockJournalEntryId]);
    const pendingEvidence = await q(client, `SELECT status, SUM(debit)::numeric AS debit, SUM(credit)::numeric AS credit
      FROM pending_account_movements WHERE source_doc_id=$1 GROUP BY status`, [invoiceId]);
    assert(afterPost.rows[0].quantity === '9.0000', 'Post changed quantity a second time');
    const row = docs.rows[0];
    assert(row.sales_journal_id === salesTarget && row.stock_journal_id === stockIssue && row.cogs_journal_id === cogsTarget, 'Issuance Config target journals not used');
    const linked = await caller.salesInvoices.getLinkedDocuments({ id: invoiceId });
    assert(linked.relations.some((r: any) => r.relationType === 'sales_journal'), 'document_relations missing Sales Journal');
    assert(linked.relations.some((r: any) => r.relationType === 'stock_issue'), 'document_relations missing Stock Issue');
    assert(linked.relations.some((r: any) => r.relationType === 'cogs_journal'), 'document_relations missing COGS');

    const batch = posted.postingBatchId;
    await caller.posting.unpostSalesInvoice({ invoiceId, reason: 'flow test' });
    const afterUnpost = await q(client, `SELECT quantity FROM inventory WHERE org_id=$1 AND product_id=$2 AND warehouse_id=$3`, [orgId, productId, warehouseId]);
    const audit = await q(client, `SELECT posting_batch_id, user_id, unposted_at, deleted_documents FROM unpost_audit WHERE source_document_id=$1 ORDER BY id DESC LIMIT 1`, [invoiceId]);
    const officialAfter = await q(client, `SELECT COUNT(*)::int AS count FROM journal_entries WHERE source_doc_id=$1 OR id IN (SELECT generated_document_id FROM document_relations WHERE source_document_id=$1)`, [invoiceId]);
    assert(afterUnpost.rows[0].quantity === '9.0000', 'Unpost changed Save quantity');
    assert(audit.rowCount === 1 && audit.rows[0].user_id === userId && audit.rows[0].deleted_documents.length >= 3, 'Unpost audit snapshot incomplete');
    assert(Number(officialAfter.rows[0].count) === 0, 'Unpost left official documents');

    const createAndPost = async (number: string) => {
      const created = await caller.salesInvoices.create({ ...input, invoiceNumber: number });
      const postedResult = await caller.posting.postSalesInvoice({ invoiceId: Number(created.id) });
      return { id: Number(created.id), postedResult };
    };
    const guarded = [
      await createAndPost('GUARD-1'),
      await createAndPost('GUARD-2'),
      await createAndPost('GUARD-3'),
    ];
    let guardRejected = false;
    try {
      await caller.posting.unpostSalesInvoice({ invoiceId: guarded[0].id });
    } catch {
      guardRejected = true;
    }
    assert(guardRejected, 'Unpost Guard allowed deleting an older posted invoice');
    await caller.posting.unpostSalesInvoice({ invoiceId: guarded[2].id });
    await caller.posting.unpostSalesInvoice({ invoiceId: guarded[1].id });
    await caller.posting.unpostSalesInvoice({ invoiceId: guarded[0].id });

    const deleteBefore = await q(client, `SELECT quantity FROM inventory WHERE org_id=$1 AND product_id=$2 AND warehouse_id=$3`, [orgId, productId, warehouseId]);
    const deletable = await caller.salesInvoices.create({ ...input, invoiceNumber: 'DELETE-FLOW' });
    const deleteDuring = await q(client, `SELECT quantity FROM inventory WHERE org_id=$1 AND product_id=$2 AND warehouse_id=$3`, [orgId, productId, warehouseId]);
    await caller.salesInvoices.delete({ id: Number(deletable.id) });
    const deleteAfter = await q(client, `SELECT quantity FROM inventory WHERE org_id=$1 AND product_id=$2 AND warehouse_id=$3`, [orgId, productId, warehouseId]);
    const orphanPending = await q(client, `SELECT COUNT(*)::int AS count FROM pending_account_movements WHERE source_doc_id=$1 UNION ALL SELECT COUNT(*)::int FROM pending_stock_movements WHERE source_doc_id=$1`, [Number(deletable.id)]);
    assert(Number(deleteDuring.rows[0].quantity) === Number(deleteBefore.rows[0].quantity) - 1, 'Delete test did not apply Save stock effect');
    assert(deleteAfter.rows[0].quantity === deleteBefore.rows[0].quantity, 'Delete did not reverse Save stock effect');
    assert(orphanPending.rows.every((r: { count: number }) => Number(r.count) === 0), 'Delete left pending orphan rows');

    console.log(JSON.stringify({ database: testDb, orgId, invoiceId, salesSource, salesTarget, stockIssue, cogsTarget,
      saveQuantity: '9.0000', postQuantity: '9.0000', posted, docs: row,
      pendingEvidence: pendingEvidence.rows, accountEvidence: accountEvidence.rows,
      unpostAudit: audit.rows[0], batch }, null, 2));
  } finally {
    await client.end();
    if (activePool) await activePool.end();
    const cleanup = new Client({ connectionString: adminUrl });
    await cleanup.connect();
    await q(cleanup, `DROP DATABASE IF EXISTS ${quote(testDb)}`);
    await cleanup.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});