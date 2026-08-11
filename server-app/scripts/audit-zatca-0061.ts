import pg from 'pg';
import { ENV } from '../src/env.js';

const pool = new pg.Pool({ connectionString: ENV.dbUrl });

const constraintNames = [
  'zatca_pos_units_warehouse_org_fk',
  'document_journals_warehouse_org_fk',
  'document_journals_zatca_unit_org_fk',
  'document_journals_zatca_unit_warehouse_fk',
  'document_journals_zatca_unit_requires_warehouse_ck',
  'document_journals_zatca_doc_type_ck',
  'zatca_devices_pos_unit_org_fk',
  'zatca_devices_environment_org_fk',
  'zatca_devices_pos_unit_requires_environment_ck',
  'zatca_devices_current_csid_org_fk',
  'zatca_csid_device_org_fk',
  'zatca_csid_certificate_org_fk',
  'zatca_certificates_device_org_fk',
] as const;

type ViolationCheck = { name: string; sql: string };

const violationChecks: ViolationCheck[] = [
  {
    name: 'zatca_pos_units_warehouse_org_fk',
    sql: `SELECT u.id FROM zatca_pos_units u
      LEFT JOIN warehouses w ON w.org_id = u.org_id AND w.id = u.warehouse_id
      WHERE w.id IS NULL`,
  },
  {
    name: 'document_journals_warehouse_org_fk',
    sql: `SELECT j.id FROM document_journals j
      LEFT JOIN warehouses w ON w.org_id = j.org_id AND w.id = j.warehouse_id
      WHERE j.warehouse_id IS NOT NULL AND w.id IS NULL`,
  },
  {
    name: 'document_journals_zatca_unit_org_fk',
    sql: `SELECT j.id FROM document_journals j
      LEFT JOIN zatca_pos_units u ON u.org_id = j.org_id AND u.id = j.zatca_pos_unit_id
      WHERE j.zatca_pos_unit_id IS NOT NULL AND u.id IS NULL`,
  },
  {
    name: 'document_journals_zatca_unit_warehouse_fk',
    sql: `SELECT j.id FROM document_journals j
      LEFT JOIN zatca_pos_units u ON u.org_id = j.org_id AND u.id = j.zatca_pos_unit_id AND u.warehouse_id = j.warehouse_id
      WHERE j.zatca_pos_unit_id IS NOT NULL AND u.id IS NULL`,
  },
  {
    name: 'document_journals_zatca_unit_requires_warehouse_ck',
    sql: `SELECT id FROM document_journals
      WHERE zatca_pos_unit_id IS NOT NULL AND warehouse_id IS NULL`,
  },
  {
    name: 'document_journals_zatca_doc_type_ck',
    sql: `SELECT id FROM document_journals
      WHERE zatca_pos_unit_id IS NOT NULL
        AND doc_type NOT IN ('sales_invoice', 'sales_return', 'credit_note', 'debit_note')`,
  },
  {
    name: 'zatca_devices_pos_unit_org_fk',
    sql: `SELECT d.id FROM zatca_devices d
      LEFT JOIN zatca_pos_units u ON u.org_id = d.org_id AND u.id = d.pos_unit_id
      WHERE d.pos_unit_id IS NOT NULL AND u.id IS NULL`,
  },
  {
    name: 'zatca_devices_environment_org_fk',
    sql: `SELECT d.id FROM zatca_devices d
      LEFT JOIN zatca_environments e ON e.org_id = d.org_id AND e.id = d.environment_id
      WHERE d.environment_id IS NOT NULL AND e.id IS NULL`,
  },
  {
    name: 'zatca_devices_pos_unit_requires_environment_ck',
    sql: `SELECT id FROM zatca_devices
      WHERE pos_unit_id IS NOT NULL AND environment_id IS NULL`,
  },
  {
    name: 'zatca_devices_current_csid_org_fk',
    sql: `SELECT d.id FROM zatca_devices d
      LEFT JOIN zatca_csid c ON c.org_id = d.org_id AND c.id = d.current_csid_id
      WHERE d.current_csid_id IS NOT NULL AND c.id IS NULL`,
  },
  {
    name: 'zatca_csid_device_org_fk',
    sql: `SELECT c.id FROM zatca_csid c
      LEFT JOIN zatca_devices d ON d.org_id = c.org_id AND d.id = c.device_id
      WHERE c.device_id IS NOT NULL AND d.id IS NULL`,
  },
  {
    name: 'zatca_csid_certificate_org_fk',
    sql: `SELECT c.id FROM zatca_csid c
      LEFT JOIN zatca_certificates x ON x.org_id = c.org_id AND x.id = c.certificate_id
      WHERE c.certificate_id IS NOT NULL AND x.id IS NULL`,
  },
  {
    name: 'zatca_certificates_device_org_fk',
    sql: `SELECT c.id FROM zatca_certificates c
      LEFT JOIN zatca_devices d ON d.org_id = c.org_id AND d.id = c.device_id
      WHERE c.device_id IS NOT NULL AND d.id IS NULL`,
  },
];

try {
  const constraints = await pool.query(
    `SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname,
            con.contype, con.convalidated, pg_get_constraintdef(con.oid) AS definition
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND con.conname = ANY($1::text[])
      ORDER BY c.relname, con.conname`,
    [constraintNames],
  );

  const violations = [];
  for (const check of violationChecks) {
    const result = await pool.query(check.sql);
    violations.push({
      constraint: check.name,
      count: result.rowCount ?? 0,
      ids: result.rows.map((row) => row.id),
    });
  }

  const notValidated = constraints.rows.filter((row) => row.convalidated === false);
  const totalViolations = violations.reduce((sum, row) => sum + row.count, 0);

  console.log('# ZATCA 0061 legacy constraint audit');
  console.log('');
  console.log('Read-only audit. VALIDATE CONSTRAINT was not executed.');
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log('');
  console.log(`- Known constraints: ${constraints.rowCount}`);
  console.log(`- NOT VALID / convalidated=false: ${notValidated.length}`);
  console.log(`- Reported violating rows: ${totalViolations}`);
  console.log('');
  console.log('## Constraint status');
  console.log('');
  console.log('| Table | Constraint | Validated | Definition |');
  console.log('|---|---|---:|---|');
  for (const row of constraints.rows) {
    console.log(`| ${row.table_name} | ${row.conname} | ${row.convalidated ? 'true' : 'false'} | ${String(row.definition).replaceAll('|', '\\|')} |`);
  }
  console.log('');
  console.log('## Potential legacy violations');
  console.log('');
  console.log('| Constraint | Count | IDs |');
  console.log('|---|---:|---|');
  for (const row of violations) {
    console.log(`| ${row.constraint} | ${row.count} | ${row.ids.length ? row.ids.join(', ') : '—'} |`);
  }
  console.log('');
  console.log(totalViolations === 0
    ? 'No violating rows were found by the read-only checks. This is not approval to validate yet.'
    : 'Violations require review and conservative repair before validation. No data was changed.');
} finally {
  await pool.end();
}