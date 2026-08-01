import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { ENV } from '../src/env.js';

const pool = new pg.Pool({ connectionString: ENV.dbUrl });
const outputPath = path.resolve(process.cwd(), '../reports/ZATCA_0061_LEGACY_AUDIT_2026-08-01.md');

const constraintPlan: Array<{ name: string; table: string; purpose: string; plan: string; order: number }> = [
  { name: 'zatca_pos_units_warehouse_org_fk', table: 'zatca_pos_units', purpose: 'منع ربط وحدة ZATCA بمخزن من منظمة أخرى', plan: 'لا مخالفات مكتشفة؛ تحقق بعد مراجعة الدفاتر', order: 1 },
  { name: 'document_journals_warehouse_org_fk', table: 'document_journals', purpose: 'مطابقة منظمة الدفتر مع منظمة المخزن', plan: 'مراجعة يدوية لكل سجل ثم إصلاح محافظ أو فك ربط المخزن', order: 2 },
  { name: 'document_journals_zatca_unit_org_fk', table: 'document_journals', purpose: 'مطابقة منظمة الدفتر مع وحدة الربط', plan: 'لا مخالفات مكتشفة؛ تحقق بعد القيد السابق', order: 3 },
  { name: 'document_journals_zatca_unit_warehouse_fk', table: 'document_journals', purpose: 'مطابقة مخزن الدفتر مع مخزن وحدة الربط', plan: 'لا مخالفات مكتشفة؛ تحقق بعد مراجعة مخازن الدفاتر', order: 4 },
  { name: 'document_journals_zatca_unit_requires_warehouse_ck', table: 'document_journals', purpose: 'كل دفتر مرتبط بوحدة يجب أن يملك مخزنًا', plan: 'لا مخالفات مكتشفة؛ تحقق بعد القيود المرجعية', order: 5 },
  { name: 'document_journals_zatca_doc_type_ck', table: 'document_journals', purpose: 'حصر دفاتر وحدة الربط في أنواع ZATCA الأربعة', plan: 'لا مخالفات مكتشفة؛ تحقق بعد المراجعة', order: 6 },
  { name: 'zatca_devices_pos_unit_org_fk', table: 'zatca_devices', purpose: 'مطابقة منظمة EGS مع وحدة الربط', plan: 'لا مخالفات مكتشفة؛ تحقق', order: 7 },
  { name: 'zatca_devices_environment_org_fk', table: 'zatca_devices', purpose: 'مطابقة منظمة EGS مع البيئة', plan: 'لا مخالفات مكتشفة؛ تحقق', order: 8 },
  { name: 'zatca_devices_pos_unit_requires_environment_ck', table: 'zatca_devices', purpose: 'كل EGS المرتبط بوحدة يملك بيئة', plan: 'لا مخالفات مكتشفة؛ تحقق', order: 9 },
  { name: 'zatca_devices_current_csid_org_fk', table: 'zatca_devices', purpose: 'مطابقة CSID الحالي مع منظمة EGS', plan: 'لا مخالفات مكتشفة؛ تحقق', order: 10 },
  { name: 'zatca_csid_device_org_fk', table: 'zatca_csid', purpose: 'مطابقة منظمة CSID مع الجهاز', plan: 'لا مخالفات مكتشفة؛ تحقق', order: 11 },
  { name: 'zatca_csid_certificate_org_fk', table: 'zatca_csid', purpose: 'مطابقة منظمة CSID مع الشهادة', plan: 'لا مخالفات مكتشفة؛ تحقق', order: 12 },
  { name: 'zatca_certificates_device_org_fk', table: 'zatca_certificates', purpose: 'مطابقة منظمة الشهادة مع الجهاز', plan: 'لا مخالفات مكتشفة؛ تحقق', order: 13 },
];

function md(value: unknown): string {
  return String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

try {
  const constraints = await pool.query(
    `SELECT c.relname AS table_name, con.conname, con.convalidated,
            pg_get_constraintdef(con.oid) AS definition
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND con.conname = ANY($1::text[])
      ORDER BY c.relname, con.conname`,
    [constraintPlan.map((item) => item.name)],
  );

  const journals = await pool.query(
    `SELECT
       j.id AS journal_id,
       j.name AS journal_name,
       j.code AS journal_code,
       j.doc_type,
       j.org_id AS organization_id,
       j.warehouse_id,
       w_any.id AS warehouse_found_id,
       w_any.name AS warehouse_name,
       w_any.org_id AS warehouse_organization_id,
       b.name AS branch_name,
       u.id AS pos_unit_id,
       u.unit_code AS pos_unit_code,
       u.unit_name AS pos_unit_name,
       COALESCE(si.invoice_count, 0)::int AS invoice_count,
       COALESCE(je.entry_count, 0)::int AS journal_entry_count,
       COALESCE(sv.voucher_count, 0)::int AS stock_voucher_count,
       COALESCE(pm.account_movement_count, 0)::int AS pending_account_movement_count,
       COALESCE(ps.stock_movement_count, 0)::int AS pending_stock_movement_count
     FROM document_journals j
     LEFT JOIN warehouses w
       ON w.id = j.warehouse_id AND w.org_id = j.org_id
     LEFT JOIN warehouses w_any ON w_any.id = j.warehouse_id
     LEFT JOIN branches b ON b.id = w.branch_id
     LEFT JOIN zatca_pos_units u
       ON u.id = j.zatca_pos_unit_id AND u.org_id = j.org_id
     LEFT JOIN LATERAL (
       SELECT count(*) AS invoice_count FROM sales_invoices x
       WHERE x.org_id = j.org_id AND x.journal_id = j.id
     ) si ON true
     LEFT JOIN LATERAL (
       SELECT count(*) AS entry_count FROM journal_entries x
       WHERE x.org_id = j.org_id AND x.journal_id = j.id
     ) je ON true
     LEFT JOIN LATERAL (
       SELECT count(*) AS voucher_count FROM stock_vouchers x
       WHERE x.org_id = j.org_id AND x.source_journal_id = j.id
     ) sv ON true
     LEFT JOIN LATERAL (
       SELECT count(*) AS account_movement_count FROM pending_account_movements x
       WHERE x.org_id = j.org_id AND x.source_doc_type = 'sales_invoice'
         AND EXISTS (SELECT 1 FROM sales_invoices si2 WHERE si2.id = x.source_doc_id AND si2.journal_id = j.id)
     ) pm ON true
     LEFT JOIN LATERAL (
       SELECT count(*) AS stock_movement_count FROM pending_stock_movements x
       WHERE x.org_id = j.org_id AND x.source_doc_type = 'sales_invoice'
         AND EXISTS (SELECT 1 FROM sales_invoices si2 WHERE si2.id = x.source_doc_id AND si2.journal_id = j.id)
     ) ps ON true
    WHERE j.warehouse_id IS NOT NULL
      AND w.id IS NULL
    ORDER BY j.id`,
  );

  const rows = journals.rows.map((row) => {
    const warehouseOrganizationMismatch = row.warehouse_found_id != null
      && row.warehouse_organization_id !== row.organization_id;
    const reason = warehouseOrganizationMismatch
      ? 'warehouse_id موجود لكنه يتبع منظمة أخرى'
      : 'warehouse_id لا يشير إلى مخزن موجود داخل منظمة الدفتر';
    const previousActivity = Number(row.invoice_count) + Number(row.journal_entry_count)
      + Number(row.stock_voucher_count) + Number(row.pending_account_movement_count)
      + Number(row.pending_stock_movement_count);
    const safe = previousActivity === 0 && !row.pos_unit_id;
    return {
      ...row,
      reason,
      classification: warehouseOrganizationMismatch ? 'Legacy organization/warehouse mismatch' : 'Legacy missing warehouse reference',
      previousActivity,
      proposedCorrection: safe
        ? 'قد يكون تصفير warehouse_id محافظًا، لكنه يحتاج موافقة يدوية'
        : 'تحديد المخزن الصحيح من السجلات التاريخية أو فك الربط فقط بعد قرار مالك البيانات',
      correctionSafety: 'MANUAL_REVIEW_REQUIRED',
      legacySeparationLikely: true,
    };
  });

  const lines: string[] = [
    '# ZATCA 0061 — Legacy Journal Warehouse Audit',
    '',
    '> Read-only report. No row was updated or deleted. `VALIDATE CONSTRAINT` was not executed.',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `- Violating journals: **${rows.length}**`,
    `- Constraint: **document_journals_warehouse_org_fk**`,
    '- Working classification: legacy separation between branch and warehouse; confirm against historical ownership before repair.',
    '',
    '## Constraint status and validation plan',
    '',
    '| Order | Table | Constraint | Purpose | convalidated | Violations | Repair plan |',
    '|---:|---|---|---|---:|---:|---|',
  ];
  for (const item of constraintPlan) {
    const status = constraints.rows.find((row) => row.conname === item.name);
    const count = item.name === 'document_journals_warehouse_org_fk' ? rows.length : 0;
    lines.push(`| ${item.order} | ${item.table} | ${item.name} | ${item.purpose} | ${status?.convalidated === true ? 'true' : 'false'} | ${count} | ${item.plan} |`);
  }
  lines.push('', '## Detailed journal findings', '', '| Journal ID | Name / code | Type | Organization | Warehouse ID | Warehouse organization | Branch | ZATCA unit | Previous activity | Reason | Proposed correction | Safe? | Legacy pattern |', '|---:|---|---|---:|---:|---:|---|---|---:|---|---|---|---|');
  for (const row of rows) {
    const unit = row.pos_unit_id ? `${row.pos_unit_id}: ${row.pos_unit_name} (${row.pos_unit_code})` : '—';
    const warehouseOrg = row.warehouse_organization_id ?? 'غير موجود';
    lines.push(`| ${row.journal_id} | ${md(row.journal_name)} / ${md(row.journal_code)} | ${md(row.doc_type)} | ${row.organization_id} | ${row.warehouse_id} | ${warehouseOrg}${row.warehouse_name ? `: ${md(row.warehouse_name)}` : ''} | ${md(row.branch_name)} | ${md(unit)} | ${row.previousActivity} (invoices=${row.invoice_count}, entries=${row.journal_entry_count}, vouchers=${row.stock_voucher_count}, pending=${Number(row.pending_account_movement_count) + Number(row.pending_stock_movement_count)}) | ${row.reason} | ${row.proposedCorrection} | ${row.correctionSafety} | ${row.legacySeparationLikely ? 'محتمل — يحتاج مراجعة' : 'غير مثبت'} |`);
  }
  lines.push('', '## Required validation order', '', '1. Review every row above and approve a conservative repair decision.', '2. Re-run this report and confirm zero violating rows.', '3. Run `VALIDATE CONSTRAINT` for `document_journals_warehouse_org_fk`.', '4. Validate the remaining constraints in the order shown above.', '5. Re-run the audit and confirm all 13 constraints have `convalidated=true`.', '', 'No automatic repair is authorized by this report.');

  await fs.writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(lines.join('\n'));
  console.log(`\nSaved read-only report: ${outputPath}`);
} finally {
  await pool.end();
}