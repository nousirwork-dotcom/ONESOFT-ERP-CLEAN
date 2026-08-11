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
}