/**
 * export-foundation-template.ts — تصدير قالب التأسيس مباشرة من قاعدة البيانات
 *
 * يُشغَّل: pnpm tsx src/export-foundation-template.ts
 *
 * يُصدِّر جميع سجلات include_in_foundation=true من المؤسسة المصدر (sourceOrgId)
 * ويكتب foundation-data.json بعد فحص FKs الحاسمة.
 */

import pg   from 'pg';
import path from 'path';
import fs   from 'fs';

const DATABASE_URL = process.env['DATABASE_URL'] ?? '';
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const SOURCE_ORG_ID = 1;

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 3 });
const q    = (sql: string, p: unknown[] = []) => pool.query(sql, p).then(r => r.rows);

console.log(`\n📦 تصدير قالب التأسيس من org_id=${SOURCE_ORG_ID}...\n`);

// ─── بناء خرائط FK ────────────────────────────────────────────────────────────

const branchRows = await q(
  `SELECT id, foundation_key FROM branches WHERE org_id=$1 AND foundation_key IS NOT NULL`,
  [SOURCE_ORG_ID]
);
const branchFkMap = new Map<number, string>(branchRows.map((r: any) => [r.id, r.foundation_key]));

const whRows = await q(
  `SELECT id, foundation_key FROM warehouses WHERE org_id=$1 AND foundation_key IS NOT NULL`,
  [SOURCE_ORG_ID]
);
const warehouseFkMap = new Map<number, string>(whRows.map((r: any) => [r.id, r.foundation_key]));

const acctRows = await q(
  `SELECT id, system_key, code FROM chart_of_accounts WHERE org_id=$1`,
  [SOURCE_ORG_ID]
);
const accountSkMap = new Map<number, string>(
  acctRows
    .filter((r: any) => r.system_key || r.code)
    .map((r: any) => [r.id, r.system_key ?? r.code]),
);
const accountCodeMap = new Map<number, string>(acctRows.map((r: any) => [r.id, r.code]));

console.log(`  خريطة الفروع:   ${branchFkMap.size} سجل`);
console.log(`  خريطة المخازن:  ${warehouseFkMap.size} سجل`);
console.log(`  خريطة الحسابات: ${accountSkMap.size} سجل`);

// ─── فحص FKs الحاسمة ────────────────────────────────────────────────────────

const ACCOUNT_FK_FIELDS = [
  'sales_account_id', 'cash_account_id', 'credit_account_id', 'tax_account_id',
  'discount_account_id', 'purchase_account_id', 'supplier_account_id',
  'inventory_account_id', 'cogs_account_id', 'settlement_account_id',
];

const TABLES_WITH_ACCOUNT_FKS = new Set(['document_journals', 'posting_definitions', 'document_types']);

const TABLES = [
  'document_journals', 'document_types', 'branches', 'warehouses', 'units',
  'product_groups', 'payment_methods', 'cost_centers', 'currencies',
  'document_templates', 'posting_definitions',
];

const fkErrors: string[] = [];
for (const tbl of TABLES) {
  const rows = await q(`SELECT * FROM ${tbl} WHERE org_id=$1 AND include_in_foundation=true`, [SOURCE_ORG_ID]);
  for (const row of rows) {
    const name = String(row.name ?? row.name_ar ?? row.code ?? row.type_id ?? row.id ?? '');
    if (row.branch_id && !branchFkMap.has(row.branch_id)) {
      fkErrors.push(`${tbl} "${name}": branch_id=${row.branch_id} لا foundationKey`);
    }
    if (row.warehouse_id && !warehouseFkMap.has(row.warehouse_id)) {
      fkErrors.push(`${tbl} "${name}": warehouse_id=${row.warehouse_id} لا foundationKey`);
    }
    if (TABLES_WITH_ACCOUNT_FKS.has(tbl)) {
      for (const field of ACCOUNT_FK_FIELDS) {
        const id = row[field];
        if (id && !accountSkMap.has(id)) {
          fkErrors.push(`${tbl} "${name}": ${field}=${id} لا systemKey`);
        }
      }
    }
  }
}

if (fkErrors.length > 0) {
  console.error(`\n❌ التصدير متوقف — ${fkErrors.length} مشكلة FK:\n`);
  fkErrors.forEach(e => console.error(`   ${e}`));
  await pool.end();
  process.exit(1);
}
console.log(`\n  ✅ فحص FK اجتاز — لا مشاكل\n`);

// ─── helper: تحويل قاموس DB (snake_case) إلى camelCase ──────────────────────

function snakeToCamel(str: string): string {
  // handle both _letter and _digit: print_template_2 → printTemplate2
  return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function rowToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToCamel(k)] = v;
  }
  return out;
}

// User IDs are scoped to the source organization and must never be copied
// into a foundation snapshot for another organization. A null value keeps the
// journal/warehouse available while leaving user assignment to the target org.
function clearOrganizationLocalReferences(row: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {
    ...row,
    allowedUserId: null,
  };
  if (
    typeof cleaned.allowedUserGroup === 'number' ||
    (typeof cleaned.allowedUserGroup === 'string' && /^\d+$/.test(cleaned.allowedUserGroup.trim()))
  ) {
    cleaned.allowedUserGroup = null;
  }
  return cleaned;
}

// ─── helper: حقن مراجع FK في السجل ──────────────────────────────────────────

function enrichFkRefs(
  row: Record<string, unknown>,
  tbl: string,
): Record<string, unknown> {
  const enriched = { ...row };

  if (typeof row.branchId === 'number') {
    enriched['_branchId_fk'] = branchFkMap.get(row.branchId) ?? null;
  }
  if (tbl === 'documentJournals' && typeof row.warehouseId === 'number') {
    enriched['_warehouseId_fk'] = warehouseFkMap.get(row.warehouseId) ?? null;
  }
  for (const camelField of [
    'salesAccountId', 'cashAccountId', 'creditAccountId', 'taxAccountId',
    'discountAccountId', 'purchaseAccountId', 'supplierAccountId',
    'inventoryAccountId', 'cogsAccountId', 'settlementAccountId',
  ]) {
    const id = row[camelField];
    if (typeof id === 'number') {
      const dbField = camelField.replace(/([A-Z])/g, '_$1').toLowerCase().slice(1);
      const sk = accountSkMap.get(id);
      enriched[`_${camelField}_fk`] = sk ?? null;
    }
  }

  const config = enriched.paymentTypesConfig;
  if (tbl === 'documentJournals' && config && typeof config === 'object' && !Array.isArray(config)) {
    const paymentConfig = config as Record<string, unknown>;
    const scrubLinks = (links: unknown[]) => links.map((rawLink) => {
        if (!rawLink || typeof rawLink !== 'object' || Array.isArray(rawLink)) return rawLink;
        const link = { ...(rawLink as Record<string, unknown>) };
        const accountId = link.accountId;
        if (typeof accountId === 'number') {
          link.accountCode = accountCodeMap.get(accountId) ?? null;
          delete link.accountId;
        }
        return link;
      });
    if (Array.isArray(paymentConfig.accountLinks)) {
      paymentConfig.accountLinks = scrubLinks(paymentConfig.accountLinks);
    }
    if (paymentConfig.accountLinksByType &&
        typeof paymentConfig.accountLinksByType === 'object' &&
        !Array.isArray(paymentConfig.accountLinksByType)) {
      paymentConfig.accountLinksByType = Object.fromEntries(
        Object.entries(paymentConfig.accountLinksByType).map(([typeId, rawLinks]) => [
          typeId,
          Array.isArray(rawLinks) ? scrubLinks(rawLinks) : rawLinks,
        ]),
      );
    }
    if (Array.isArray(paymentConfig.accountLinks) || paymentConfig.accountLinksByType) {
      enriched.paymentTypesConfig = paymentConfig;
    }
  }

  return enriched;
}

// ─── التصدير الفعلي ───────────────────────────────────────────────────────────

const STRIP_COLS = new Set(['id', 'org_id', 'created_at', 'updated_at']);
const TABLE_DATA_KEYS: Record<string, string> = {
  document_journals:   'documentJournals',
  document_types:      'documentTypes',
  branches:            'branches',
  warehouses:          'warehouses',
  units:               'units',
  product_groups:      'productGroups',
  payment_methods:     'paymentMethods',
  cost_centers:        'costCenters',
  currencies:          'currencies',
  document_templates:  'documentTemplates',
  posting_definitions: 'postingDefinitions',
};

const payload: Record<string, unknown[]> = {};
let totalRecords = 0;

for (const tbl of TABLES) {
  const rows = await q(`SELECT * FROM ${tbl} WHERE org_id=$1 AND include_in_foundation=true ORDER BY id`, [SOURCE_ORG_ID]);
  const dataKey = TABLE_DATA_KEYS[tbl]!;
  payload[dataKey] = rows.map((row: Record<string, unknown>) => {
    const stripped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!STRIP_COLS.has(k)) stripped[k] = v;
    }
    const camel = clearOrganizationLocalReferences(rowToCamel(stripped));
    return enrichFkRefs(camel, dataKey);
  });
  console.log(`  ${tbl}: ${rows.length} سجل → ${dataKey}`);
  totalRecords += rows.length;
}

const exportedAt = new Date().toISOString();
const finalPayload = {
  ...payload,
  exportedAt,
  totalRecords,
};

const jsonPath = path.resolve(process.cwd(), 'src', 'foundation-data.json');
fs.writeFileSync(jsonPath, JSON.stringify(finalPayload, null, 2), 'utf8');

console.log(`\n✅ foundation-data.json كُتب: ${jsonPath}`);
console.log(`   إجمالي السجلات: ${totalRecords}`);
console.log(`   exportedAt: ${exportedAt}\n`);

await pool.end();
