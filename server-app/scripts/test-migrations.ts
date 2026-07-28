import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { ENV } from '../src/env.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: ENV.dbUrl });
const client = await pool.connect();
const schema = `migration_test_${process.pid}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const setPath = `SET search_path TO ${quote(schema)}, public`;
const drizzleDir = path.resolve(new URL('../drizzle/', import.meta.url).pathname);
const journal = JSON.parse(fs.readFileSync(path.join(drizzleDir, 'meta/_journal.json'), 'utf8')) as {
  entries: Array<{ tag: string }>;
};
const migrations = journal.entries.map(({ tag }) => ({
  tag,
  sql: fs.readFileSync(path.join(drizzleDir, `${tag}.sql`), 'utf8'),
}));
const base = fs.readFileSync(path.join(drizzleDir, 'base_schema.sql'), 'utf8');

async function apply(sql: string) {
  await client.query(sql);
}

async function assertExists(table: string) {
  const result = await client.query(
    `SELECT to_regclass($1) AS table_name`,
    [`${schema}.${table}`],
  );
  if (!result.rows[0]?.table_name) throw new Error(`missing table ${table}`);
}

try {
  await client.query(`CREATE SCHEMA ${quote(schema)}`);
  await client.query(setPath);

  // Fresh installation: bootstrap plus every migration must complete.
  await apply(base);
  for (const migration of migrations) await apply(migration.sql);
  for (const table of ['organizations', 'purchase_invoices', 'pending_account_movements', 'pending_stock_movements', 'stock_vouchers']) {
    await assertExists(table);
  }
  console.log('[migration-test] fresh database: PASS');

  // Upgrade path: rebuild the isolated schema, stop at 0051, seed data, then apply 0052+.
  await client.query(`DROP SCHEMA ${quote(schema)} CASCADE`);
  await client.query(`CREATE SCHEMA ${quote(schema)}`);
  await client.query(setPath);
  await apply(base);
  for (const migration of migrations) {
    await apply(migration.sql);
    if (migration.tag === '0051_add_draft_number_to_sales_invoices') break;
  }
  const org = await client.query(
    `INSERT INTO organizations (code, name) VALUES ('MIG-TEST', 'Migration Test') RETURNING id`,
  );
  const orgId = org.rows[0].id;
  for (const migration of migrations.filter((m) => m.tag > '0051_add_draft_number_to_sales_invoices')) {
    await apply(migration.sql);
  }
  await assertExists('pending_account_movements');
  const preserved = await client.query(`SELECT id FROM organizations WHERE id = $1`, [orgId]);
  if (!preserved.rowCount) throw new Error('upgrade path lost existing data');
  const column = await client.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = 'sales_invoices'
      AND column_name = 'draft_number'
  `, [schema]);
  if (!column.rowCount) throw new Error('0051 column missing after upgrade');
  console.log('[migration-test] upgrade 0051 -> latest: PASS');
} finally {
  await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined);
  client.release();
  await pool.end();
}