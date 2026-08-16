import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { ENV } from '../src/env.js';
import type { Client as PgClient } from 'pg';

const { Client } = pg;
const drizzleDir = path.dirname(fileURLToPath(import.meta.url)).replace(
  `${path.sep}scripts`,
  `${path.sep}drizzle`,
);
const journal = JSON.parse(
  fs.readFileSync(path.join(drizzleDir, 'meta/_journal.json'), 'utf8'),
) as { entries: Array<{ tag: string }> };
const migrations = journal.entries.map(({ tag }) => ({
  tag,
  sql: fs.readFileSync(path.join(drizzleDir, `${tag}.sql`), 'utf8'),
}));
const base = fs.readFileSync(path.join(drizzleDir, 'base_schema.sql'), 'utf8');
const PRE_UPGRADE_TAG = '0051_add_draft_number_to_sales_invoices';
const latestTag = migrations.at(-1)!.tag;

function quoteIdent(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function databaseUrlFor(name: string): string {
  const url = new URL(ENV.dbUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function createDatabase(name: string): Promise<void> {
  const admin = new Client({ connectionString: ENV.dbUrl });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)}`);
    await admin.query(`CREATE DATABASE ${quoteIdent(name)}`);
  } finally {
    await admin.end();
  }
}

async function dropDatabase(name: string): Promise<void> {
  const admin = new Client({ connectionString: ENV.dbUrl });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)}`);
  } finally {
    await admin.end();
  }
}

async function apply(client: PgClient, sql: string): Promise<void> {
  await client.query(sql);
}

async function assertTable(client: PgClient, table: string): Promise<void> {
  const result = await client.query(
    `SELECT to_regclass('public.' || $1) AS table_name`,
    [table],
  );
  if (!result.rows[0]?.table_name) {
    throw new Error(`missing table ${table}`);
  }
}

async function assertColumn(
  client: PgClient,
  table: string,
  column: string,
): Promise<void> {
  const result = await client.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2`,
    [table, column],
  );
  if (!result.rowCount) {
    throw new Error(`missing column ${table}.${column}`);
  }
}

async function applyAll(client: PgClient): Promise<void> {
  await apply(client, base);
  for (const migration of migrations) {
    await apply(client, migration.sql);
  }
}

async function applyThrough(client: PgClient, tag: string): Promise<void> {
  await apply(client, base);
  for (const migration of migrations) {
    await apply(client, migration.sql);
    if (migration.tag === tag) return;
  }
  throw new Error(`migration tag not found: ${tag}`);
}

async function seedUpgradeData(client: PgClient): Promise<{
  orgId: number;
  customerId: number;
  username: string;
}> {
  const org = await client.query(
    `INSERT INTO organizations (code, name, status)
     VALUES ('UPGRADE-TEST', 'Upgrade Test Organization', 'trial')
     RETURNING id`,
  );
  const orgId = Number(org.rows[0].id);
  const customer = await client.query(
    `INSERT INTO customers (org_id, code, name, phone)
     VALUES ($1, 'CUS-KEEP', 'Customer Must Survive', '0500000000')
     RETURNING id`,
    [orgId],
  );
  const customerId = Number(customer.rows[0].id);
  const username = `upgrade_admin_${process.pid}`;
  await client.query(
    `INSERT INTO users (org_id, username, password_hash, name, role)
     VALUES ($1, $2, 'not-used-by-test', 'Upgrade Administrator', 'admin')`,
    [orgId, username],
  );
  const branch = await client.query(
    `INSERT INTO branches (org_id, name)
     VALUES ($1, 'Customer Branch')
     RETURNING id`,
    [orgId],
  );
  await client.query(
    `INSERT INTO warehouses (org_id, branch_id, code, name)
     VALUES ($1, $2, 'CUS-WH', 'Customer Warehouse')`,
    [orgId, branch.rows[0].id],
  );
  await client.query(
    `INSERT INTO chart_of_accounts
       (org_id, code, name, account_type, nature, is_parent, allow_posting,
        is_active, record_type, system_key)
     VALUES
       ($1, '110101', 'Customer Cash', 'asset', 'debit', false, true, true, 'system', '110101'),
       ($1, '410101', 'Customer Sales', 'revenue', 'credit', false, true, true, 'system', '410101'),
       ($1, '210501', 'Customer VAT', 'liability', 'credit', false, true, true, 'system', '210501'),
       ($1, '110103', 'Customer Installment Cash', 'asset', 'debit', false, true, true, 'system', '110103')`,
    [orgId],
  );
  return { orgId, customerId, username };
}

async function seedWarehouseReconciliationFixtures(client: PgClient): Promise<{
  orgIds: number[];
  legacyWarehouseIds: number[];
  duplicateWarehouseIds: Array<number | null>;
  customerId: number;
}> {
  const fixtures = [
    { code: 'RECON-WHMAIN', name: 'WH-MAIN Only', warehouseCode: 'WH-MAIN' },
    { code: 'RECON-001', name: '001 Only', warehouseCode: '001' },
    { code: 'RECON-DUPLICATE', name: 'Duplicate References', warehouseCode: '001', duplicateWarehouseCode: 'WH-MAIN' },
  ];
  const orgIds: number[] = [];
  const legacyWarehouseIds: number[] = [];
  const duplicateWarehouseIds: Array<number | null> = [];
  let customerId = 0;

  for (const [index, fixture] of fixtures.entries()) {
    const org = await client.query(
      `INSERT INTO organizations (code, name, status)
       VALUES ($1, $2, 'trial')
       RETURNING id`,
      [fixture.code, fixture.name],
    );
    const orgId = Number(org.rows[0].id);
    orgIds.push(orgId);

    const customer = await client.query(
      `INSERT INTO customers (org_id, code, name, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        orgId,
        index === 0 ? 'CUS-KEEP' : `RECON-CUS-${index}`,
        index === 0 ? 'Customer Must Survive' : `Reconciliation Customer ${index}`,
        index === 0 ? '0500000000' : `051000000${index}`,
      ],
    );
    if (index === 0) customerId = Number(customer.rows[0].id);

    await client.query(
      `INSERT INTO chart_of_accounts
         (org_id, code, name, account_type, nature, is_parent, allow_posting,
          is_active, record_type, system_key)
       VALUES
         ($1, '110101', 'Reconciliation Cash', 'asset', 'debit', false, true, true, 'system', '110101'),
         ($1, '410101', 'Reconciliation Sales', 'revenue', 'credit', false, true, true, 'system', '410101'),
         ($1, '210501', 'Reconciliation VAT', 'liability', 'credit', false, true, true, 'system', '210501'),
         ($1, '110103', 'Reconciliation Installment Cash', 'asset', 'debit', false, true, true, 'system', '110103')`,
      [orgId],
    );

    const warehouse = await client.query(
      `INSERT INTO warehouses
         (org_id, code, name, is_active, include_in_foundation, record_origin)
       VALUES ($1, $2, $3, true, false, 'user')
       RETURNING id`,
      [orgId, fixture.warehouseCode, fixture.name],
    );
    legacyWarehouseIds.push(Number(warehouse.rows[0].id));

    let duplicateWarehouseId: number | null = null;
    if (fixture.duplicateWarehouseCode) {
      const duplicateWarehouse = await client.query(
        `INSERT INTO warehouses
           (org_id, code, name, is_active, include_in_foundation, record_origin)
         VALUES ($1, $2, $3, true, false, 'user')
         RETURNING id`,
        [orgId, fixture.duplicateWarehouseCode, `${fixture.name} Duplicate`],
      );
      duplicateWarehouseId = Number(duplicateWarehouse.rows[0].id);
    }
    duplicateWarehouseIds.push(duplicateWarehouseId);

    if (index === 0) {
      const branch = await client.query(
        `INSERT INTO branches (org_id, name)
         VALUES ($1, 'Reconciliation Customer Branch')
         RETURNING id`,
        [orgId],
      );
      await client.query(
        `INSERT INTO warehouses (org_id, branch_id, code, name)
         VALUES ($1, $2, 'CUS-WH', 'Customer Warehouse')`,
        [orgId, branch.rows[0].id],
      );
    }

    if (duplicateWarehouseId !== null) {
      await client.query(
        `INSERT INTO users (org_id, username, password_hash, name, default_warehouse_id)
         VALUES ($1, $2, 'not-used-by-test', 'Reconciliation Reference User', $3)`,
        [orgId, `recon_reference_${process.pid}`, duplicateWarehouseId],
      );
      await client.query(
        `INSERT INTO warehouse_account_links (warehouse_id, label)
         VALUES ($1, 'reconciliation-duplicate-link')`,
        [duplicateWarehouseId],
      );
      await client.query(
        `INSERT INTO document_journals (org_id, doc_type, code, name, warehouse_id)
         VALUES ($1, 'sales', 'RECON-DJ', 'Reconciliation Journal', $2)`,
        [orgId, duplicateWarehouseId],
      );
      await client.query(
        `INSERT INTO stock_vouchers (org_id, voucher_number, type, warehouse_id)
         VALUES ($1, 'RECON-SV', 'receipt', $2)`,
        [orgId, duplicateWarehouseId],
      );
    }
  }

  return { orgIds, legacyWarehouseIds, duplicateWarehouseIds, customerId };
}

async function assertWarehouseReconciliationFixtures(
  client: PgClient,
  orgIds: number[],
  legacyWarehouseIds: number[],
  duplicateWarehouseIds: Array<number | null>,
): Promise<void> {
  for (const [index, orgId] of orgIds.entries()) {
    const rows = await client.query(
      `SELECT id, code, foundation_key, is_active, include_in_foundation
         FROM warehouses
        WHERE org_id = $1
        ORDER BY id`,
      [orgId],
    );
    const canonical = rows.rows.filter(
      (row) =>
        row.is_active === true &&
        row.code === '001' &&
        row.foundation_key === 'wh.001' &&
        row.include_in_foundation === true,
    );
    if (canonical.length !== 1) {
      throw new Error(
        `reconciliation fixture ${index} expected one active canonical warehouse: ${JSON.stringify(rows.rows)}`,
      );
    }
    const legacy = rows.rows.find((row) => Number(row.id) === legacyWarehouseIds[index]);
    if (!legacy || Number(legacy.id) !== Number(canonical[0].id)) {
      throw new Error(
        `reconciliation fixture ${index} did not preserve the legacy warehouse as canonical: ${JSON.stringify(rows.rows)}`,
      );
    }
    if (
      rows.rows.some(
        (row) =>
          row.is_active === true &&
          (String(row.code).toUpperCase() === 'WH-MAIN' ||
            row.foundation_key === 'wh.المخزن_الرئيسي'),
      )
    ) {
      throw new Error(`reconciliation fixture ${index} left an active WH-MAIN row`);
    }

    const duplicateId = duplicateWarehouseIds[index];
    if (duplicateId !== null && duplicateId !== undefined) {
      const duplicate = rows.rows.find((row) => Number(row.id) === duplicateId);
      if (!duplicate || duplicate.is_active === true || duplicate.foundation_key !== null) {
        throw new Error(
          `reconciliation fixture ${index} did not retire duplicate warehouse: ${JSON.stringify(rows.rows)}`,
        );
      }
      const canonicalId = Number(canonical[0].id);
      const references = await client.query(
        `SELECT
           (SELECT default_warehouse_id FROM users
             WHERE org_id = $1 AND username = $2) AS user_warehouse_id,
           (SELECT warehouse_id FROM warehouse_account_links
             WHERE label = 'reconciliation-duplicate-link') AS link_warehouse_id,
           (SELECT warehouse_id FROM document_journals
             WHERE org_id = $1 AND code = 'RECON-DJ') AS journal_warehouse_id,
           (SELECT warehouse_id FROM stock_vouchers
             WHERE org_id = $1 AND voucher_number = 'RECON-SV') AS voucher_warehouse_id`,
        [orgId, `recon_reference_${process.pid}`],
      );
      const referenceRow = references.rows[0];
      if (
        [referenceRow.user_warehouse_id, referenceRow.link_warehouse_id,
          referenceRow.journal_warehouse_id, referenceRow.voucher_warehouse_id]
          .some((value) => Number(value) !== canonicalId)
      ) {
        throw new Error(
          `reconciliation fixture ${index} left stale references: ${JSON.stringify(referenceRow)}`,
        );
      }
    }
  }
}

function stableHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

async function waitForBackend(
  child: ReturnType<typeof spawn>,
  port: number,
  output: string[],
): Promise<void> {
  const deadline = Date.now() + 90_000;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (child.exitCode !== null) {
      throw new Error(
        `backend exited with code ${child.exitCode}\n${output.slice(-80).join('')}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`backend readiness timeout: ${lastError}\n${output.slice(-80).join('')}`);
}

async function waitForFoundation(
  child: ReturnType<typeof spawn>,
  verification: PgClient,
  orgId: number,
  output: string[],
): Promise<void> {
  const deadline = Date.now() + 90_000;
  let lastStatus = '';
  while (Date.now() < deadline) {
    const result = await verification.query(
      `SELECT foundation_snapshot_hash, foundation_status, foundation_last_error
         FROM organizations
        WHERE id = $1`,
      [orgId],
    );
    const row = result.rows[0];
    lastStatus = JSON.stringify(row);
    if (row?.foundation_status === 'applied') return;
    if (row?.foundation_status === 'failed') {
      throw new Error(`Foundation failed during startup: ${row.foundation_last_error ?? lastStatus}`);
    }
    if (child.exitCode !== null) {
      throw new Error(
        `backend exited with code ${child.exitCode}\n${output.slice(-80).join('')}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Foundation readiness timeout: ${lastStatus}\n${output.slice(-80).join('')}`);
}

async function runUpgradeStartup(
  databaseName: string,
  orgId: number,
  customerId: number,
): Promise<string> {
  const port = 39000 + (process.pid % 500);
  const output: string[] = [];
  const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');
  const foundationPath = path.resolve('src/foundation-data.json');
  const child = spawn(process.execPath, [tsx, 'src/index.ts'], {
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrlFor(databaseName),
      FOUNDATION_DATA_PATH: foundationPath,
      PORT: String(port),
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk: Buffer) => output.push(chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => output.push(chunk.toString()));

  const verification = new Client({ connectionString: databaseUrlFor(databaseName) });
  await verification.connect();
  try {
    await waitForBackend(child, port, output);
    const health = await fetch(`http://127.0.0.1:${port}/api/health`);
    if (!health.ok) throw new Error(`health check failed: ${health.status}`);
    await waitForFoundation(child, verification, orgId, output);

    const result = await verification.query(
      `SELECT foundation_snapshot_hash, foundation_status
         FROM organizations
        WHERE id = $1`,
      [orgId],
    );
    if (result.rows[0]?.foundation_status !== 'applied') {
      throw new Error(`Foundation status is not applied: ${JSON.stringify(result.rows[0])}`);
    }
    if (!result.rows[0]?.foundation_snapshot_hash) {
      throw new Error('Foundation snapshot hash was not persisted');
    }

    const customer = await verification.query(
      `SELECT name, phone FROM customers WHERE id = $1`,
      [customerId],
    );
    if (
      customer.rows[0]?.name !== 'Customer Must Survive' ||
      customer.rows[0]?.phone !== '0500000000'
    ) {
      throw new Error(`customer data changed or disappeared: ${JSON.stringify(customer.rows[0])}`);
    }

    const warehouses = await verification.query(
      `SELECT code, branch_id
         FROM warehouses
        WHERE org_id = $1
        ORDER BY code`,
      [orgId],
    );
    if (!warehouses.rows.some((row) => row.code === 'CUS-WH' && row.branch_id !== null)) {
      throw new Error('customer warehouse or branch relationship was not preserved');
    }

    const foundationWarehouses = await verification.query(
      `SELECT foundation_key, branch_id
         FROM warehouses
        WHERE org_id = $1 AND foundation_key IS NOT NULL`,
      [orgId],
    );
    for (const key of ['wh.001', 'wh.002', 'wh.003', 'wh.004']) {
      if (!foundationWarehouses.rows.some((row) => row.foundation_key === key)) {
        throw new Error(`missing foundation warehouse ${key}`);
      }
    }

    const duplicateKeys = await verification.query(
      `SELECT foundation_key, COUNT(*)::int AS count
         FROM warehouses
        WHERE org_id = $1 AND foundation_key IS NOT NULL
        GROUP BY foundation_key
       HAVING COUNT(*) > 1`,
      [orgId],
    );
    if (duplicateKeys.rowCount) {
      throw new Error(`duplicate foundation warehouses: ${JSON.stringify(duplicateKeys.rows)}`);
    }
  } finally {
    await verification.end();
    child.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', () => resolve());
      setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 5_000);
    });
  }
  return output.join('');
}

const freshDatabase = `onesoft_migration_fresh_${process.pid}`;
const upgradeDatabase = `onesoft_migration_upgrade_${process.pid}`;
const reconciliationDatabase = `onesoft_migration_reconciliation_${process.pid}`;
let client: PgClient | null = null;

try {
  await createDatabase(freshDatabase);
  client = new Client({ connectionString: databaseUrlFor(freshDatabase) });
  await client.connect();
  await applyAll(client);
  for (const table of [
    'organizations',
    'document_types',
    'document_templates',
    'pending_account_movements',
    'pending_stock_movements',
    'zatca_pos_units',
  ]) {
    await assertTable(client, table);
  }
  await assertColumn(client, 'organizations', 'foundation_status');
  console.log('[migration-test] fresh database: PASS');
  await client.end();
  client = null;

  await createDatabase(reconciliationDatabase);
  client = new Client({ connectionString: databaseUrlFor(reconciliationDatabase) });
  await client.connect();
  await applyThrough(client, '0095_sales_invoice_schema_compatibility');
  const {
    orgIds: reconciliationOrgIds,
    legacyWarehouseIds,
    duplicateWarehouseIds,
    customerId: reconciliationCustomerId,
  } = await seedWarehouseReconciliationFixtures(client);
  await client.query(
    `CREATE TABLE IF NOT EXISTS _schema_version (
       id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
       version TEXT NOT NULL,
       stamped_at TIMESTAMP NOT NULL DEFAULT now()
     )`,
  );
  await client.query(
    `INSERT INTO _schema_version (id, version)
     VALUES (1, '0095_sales_invoice_schema_compatibility')
     ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, stamped_at = now()`,
  );
  await client.end();
  client = null;

  // Startup applies 0096 and then runs Foundation against both legacy shapes.
  await runUpgradeStartup(
    reconciliationDatabase,
    reconciliationOrgIds[0]!,
    reconciliationCustomerId,
  );
  const reconciliationVerify = new Client({
    connectionString: databaseUrlFor(reconciliationDatabase),
  });
  await reconciliationVerify.connect();
  try {
    await assertWarehouseReconciliationFixtures(
      reconciliationVerify,
      reconciliationOrgIds,
      legacyWarehouseIds,
      duplicateWarehouseIds,
    );
  } finally {
    await reconciliationVerify.end();
  }
  console.log('[migration-test] WH-MAIN-only + code-001-only reconciliation before Foundation: PASS');

  await createDatabase(upgradeDatabase);
  client = new Client({ connectionString: databaseUrlFor(upgradeDatabase) });
  await client.connect();
  await applyThrough(client, PRE_UPGRADE_TAG);
  const { orgId, customerId } = await seedUpgradeData(client);

  const before = await client.query(
    `SELECT id, code, name, phone FROM customers WHERE id = $1`,
    [customerId],
  );
  const beforeHash = stableHash(before.rows);
  await assertColumn(client, 'sales_invoices', 'draft_number');
  // Simulate a real legacy installation: the schema is at 0051 and has a
  // version stamp, but the newer migration ledger does not exist yet.
  // The spawned backend must create the ledger, reconstruct only the completed
  // prefix, apply 0052+, and stamp the latest version itself.
  await client.query(
    `CREATE TABLE IF NOT EXISTS _schema_version (
       id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
       version TEXT NOT NULL,
       stamped_at TIMESTAMP NOT NULL DEFAULT now()
     )`,
  );
  await client.query(
    `INSERT INTO _schema_version (id, version)
     VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, stamped_at = now()`,
    [PRE_UPGRADE_TAG],
  );
  await client.end();
  client = null;

  await runUpgradeStartup(upgradeDatabase, orgId, customerId);
  const foundationSecondRunOutput = await runUpgradeStartup(upgradeDatabase, orgId, customerId);
  if (
    !foundationSecondRunOutput.includes('"recordsInserted":0') ||
    !foundationSecondRunOutput.includes('"recordsSkipped"') ||
    !foundationSecondRunOutput.includes('"reconcile":"not-needed"')
  ) {
    throw new Error(
      `second startup did not report idempotent Foundation results: ${foundationSecondRunOutput.slice(-4000)}`,
    );
  }
  console.log('[migration-test] second backend startup Foundation inserted=0 + skipped reported: PASS');

  const verify = new Client({ connectionString: databaseUrlFor(upgradeDatabase) });
  await verify.connect();
  const after = await verify.query(
    `SELECT id, code, name, phone FROM customers WHERE id = $1`,
    [customerId],
  );
  if (stableHash(after.rows) !== beforeHash) {
    throw new Error('customer row changed during upgrade/startup');
  }
  const version = await verify.query(
    `SELECT version FROM _schema_version WHERE id = 1`,
  );
  if (version.rows[0]?.version !== latestTag) {
    throw new Error(`schema version mismatch: ${version.rows[0]?.version}`);
  }
  const ledger = await verify.query(
    `SELECT COUNT(*)::int AS count,
            MIN(tag) AS first_tag,
            MAX(tag) AS latest_tag
       FROM __drizzle_migrations`,
  );
  const ledgerRow = ledger.rows[0];
  if (
    ledgerRow?.count !== migrations.length ||
    ledgerRow?.first_tag !== migrations[0]?.tag ||
    ledgerRow?.latest_tag !== latestTag
  ) {
    throw new Error(`migration ledger mismatch: ${JSON.stringify(ledgerRow)}`);
  }
  await verify.end();
  console.log('[migration-test] upgrade 0051 -> latest + backend startup: PASS');
} finally {
  if (client) await client.end().catch(() => undefined);
  await dropDatabase(freshDatabase).catch(() => undefined);
  await dropDatabase(upgradeDatabase).catch(() => undefined);
  await dropDatabase(reconciliationDatabase).catch(() => undefined);
}