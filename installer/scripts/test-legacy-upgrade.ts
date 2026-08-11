import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { spawn, type ChildProcess } from 'node:child_process';
import pg from 'pg';
import { DatabaseRoleManager, MIGRATOR_ROLE, RUNTIME_ROLE, SCHEMA_OWNER_ROLE } from '../core/database/DatabaseRoleManager.js';
import { preflightDatabase, migrationConnection } from '../core/database/DatabasePreflight.js';
import { MigrationRunner } from '../core/database/MigrationRunner.js';
import type { DatabaseConnectionOptions, ProgressEvent } from '../core/types.js';

const { Client } = pg;
const root = path.resolve(import.meta.dirname, '../..');
const serverRoot = path.join(root, 'server-app');
const drizzleRoot = path.join(serverRoot, 'drizzle');
const journal = JSON.parse(fs.readFileSync(path.join(drizzleRoot, 'meta/_journal.json'), 'utf8')) as {
  entries: Array<{ tag: string }>;
};
const migrations = journal.entries.map(({ tag }) => ({
  tag,
  sql: fs.readFileSync(path.join(drizzleRoot, `${tag}.sql`), 'utf8'),
}));
const latestTag = migrations.at(-1)!.tag;
const legacyStartTag = '0023_custody_records';
const partialTag = '0068_zatca_compliance_secret';
const failingTag = '0069_credit_debit_notes';

const adminUrl = process.env.DATABASE_URL ?? (() => {
  throw new Error('DATABASE_URL is required');
})();
const parsedAdminUrl = new URL(adminUrl);
const admin: DatabaseConnectionOptions = {
  host: parsedAdminUrl.hostname,
  port: Number(parsedAdminUrl.port || 5432),
  database: parsedAdminUrl.pathname.slice(1),
  user: decodeURIComponent(parsedAdminUrl.username),
  password: decodeURIComponent(parsedAdminUrl.password),
};

const suffix = `${process.pid}_${Date.now()}`;
const fullDb = `onesoft_legacy_full_${suffix}`;
const partialDb = `onesoft_legacy_partial_${suffix}`;
const restoreDb = `onesoft_backup_restore_${suffix}`;
const appPassword = `runtime_${suffix}`;
const legacyOwner = `onesoft_legacy_owner_${process.pid}`;
const createdRoles = new Set<string>();
const tempFiles: string[] = [];

const emit: (event: ProgressEvent) => void = (event) => {
  if (event.level === 'error') console.error(`[migration] ${event.message}`);
};

function quote(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function dbUrl(name: string, user = admin.user, password = admin.password): string {
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${admin.host}:${admin.port}/${encodeURIComponent(name)}`;
}

async function withClient<T>(url: string, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function createDb(name: string): Promise<void> {
  await withClient(adminUrl, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS ${quote(name)}`);
    await client.query(`CREATE DATABASE ${quote(name)}`);
  });
}

async function dropDb(name: string): Promise<void> {
  await withClient(adminUrl, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS ${quote(name)}`);
  }).catch(() => undefined);
}

async function applyThrough(client: pg.Client, tag: string): Promise<void> {
  // The checked-in base schema is the latest shape and already contains
  // credit_note. A real 0023 installation predates that enum value, so make
  // the test baseline historical rather than accidentally skipping 0069.
  const historicalBase = fs.readFileSync(path.join(drizzleRoot, 'base_schema.sql'), 'utf8')
    .replace(
      `CREATE TYPE "invoice_type" AS ENUM ('sale', 'return', 'quote', 'order', 'credit_note', 'debit_note');`,
      `CREATE TYPE "invoice_type" AS ENUM ('sale', 'return', 'quote');`,
    );
  if (historicalBase.includes("'credit_note'")) {
    throw new Error('Historical test baseline still contains credit_note');
  }
  await client.query(historicalBase);
  for (const migration of migrations) {
    await client.query(migration.sql);
    if (migration.tag === tag) return;
  }
  throw new Error(`Migration tag not found: ${tag}`);
}

async function seedLedgerAndStamp(client: pg.Client, tag: string): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id SERIAL PRIMARY KEY, tag TEXT NOT NULL UNIQUE, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS _schema_version (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      version TEXT NOT NULL,
      stamped_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  const index = migrations.findIndex((migration) => migration.tag === tag);
  if (index < 0) throw new Error(`Ledger tag not found: ${tag}`);
  for (const migration of migrations.slice(0, index + 1)) {
    await client.query(
      `INSERT INTO __drizzle_migrations (tag) VALUES ($1) ON CONFLICT (tag) DO NOTHING`,
      [migration.tag],
    );
  }
  await client.query(
    `INSERT INTO _schema_version (id, version) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, stamped_at = now()`,
    [tag],
  );
}

async function createLegacyOwner(): Promise<void> {
  await withClient(adminUrl, async (client) => {
    const exists = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [legacyOwner]);
    if (!exists.rowCount) {
      await client.query(`CREATE ROLE ${quote(legacyOwner)} NOLOGIN`);
      createdRoles.add(legacyOwner);
    }
  });
}

async function makeLegacyDatabase(name: string, tag: string): Promise<void> {
  await createDb(name);
  await createLegacyOwner();
  await withClient(dbUrl(name), async (client) => {
    await applyThrough(client, tag);
    await seedLedgerAndStamp(client, tag);
    // Reproduce the Windows failure: invoice_type exists, but its owner is
    // an unrelated legacy role when migration 0069 tries ALTER TYPE.
    await client.query(`ALTER TYPE public.invoice_type OWNER TO ${quote(legacyOwner)}`);
  });
}

async function provisionRoles(name: string): Promise<{
  migration: DatabaseConnectionOptions;
  runtime: DatabaseConnectionOptions;
}> {
  const roleManager = new DatabaseRoleManager();
  const provisioned = await roleManager.provision(admin, name, appPassword);
  createdRoles.add(MIGRATOR_ROLE);
  createdRoles.add(RUNTIME_ROLE);
  createdRoles.add(SCHEMA_OWNER_ROLE);
  return {
    migration: provisioned.migration,
    runtime: { ...admin, database: name, user: RUNTIME_ROLE, password: appPassword },
  };
}

function migrationTags(): string[] {
  return migrations.map((migration) => migration.tag);
}

async function assertLegacyOwnershipDrift(
  name: string,
  credential: DatabaseConnectionOptions,
): Promise<void> {
  const result = await preflightDatabase(credential, migrationTags());
  if (!result.ok) throw new Error(`Legacy preflight failed: ${result.error}`);
  if (result.invoiceTypeOwner !== legacyOwner) {
    throw new Error(`Legacy invoice_type owner was not preserved: ${result.invoiceTypeOwner}`);
  }
  if (!result.ownershipDrift.some((item) => item.startsWith('invoice_type owned by '))) {
    throw new Error(`Preflight did not report invoice_type ownership drift: ${result.ownershipDrift.join('; ')}`);
  }
  console.log(`[legacy-test] ${name}: foreign invoice_type owner detected before repair: PASS`);
}

async function adoptOwnership(name: string): Promise<void> {
  await new DatabaseRoleManager().adoptAllowlistedObjects({ ...admin, database: name });
  console.log(`[legacy-test] ${name}: allowlisted ownership repair completed: PASS`);
}

async function reintroduceInvoiceTypeDrift(name: string): Promise<void> {
  await withClient(dbUrl(name), async (client) => {
    await client.query(`ALTER TYPE public.invoice_type OWNER TO ${quote(legacyOwner)}`);
  });
  console.log(`[legacy-test] ${name}: isolated invoice_type ownership drift reintroduced: PASS`);
}

async function assertPreflight(name: string, credential: DatabaseConnectionOptions, expectedPending: string): Promise<void> {
  const result = await preflightDatabase(credential, migrationTags());
  if (!result.ok) throw new Error(`Preflight failed: ${result.error}`);
  if (result.invoiceTypeOwner !== SCHEMA_OWNER_ROLE) {
    throw new Error(`invoice_type owner mismatch: ${result.invoiceTypeOwner}`);
  }
  if (result.pendingMigration !== expectedPending) {
    throw new Error(`pending migration mismatch: ${result.pendingMigration} != ${expectedPending}`);
  }
  if (result.ownershipDrift.length || result.ledgerDrift.length) {
    throw new Error(`unexpected preflight drift: ${JSON.stringify({
      ownership: result.ownershipDrift,
      ledger: result.ledgerDrift,
    })}`);
  }
  console.log(`[legacy-test] preflight owner invoice_type=${result.invoiceTypeOwner}, pending=${result.pendingMigration}: PASS`);
}

async function runMigrations(name: string, migration: DatabaseConnectionOptions): Promise<void> {
  const result = await new MigrationRunner(serverRoot).runMigrations(
    migrationConnection(migration),
    emit,
  );
  if (result.failed) throw new Error(`Migration failed at ${result.failed}`);
  if (!result.applied.includes(failingTag)) throw new Error(`Upgrade did not apply ${failingTag}`);
  const row = await withClient(dbUrl(name), async (client) => {
    const version = await client.query(`SELECT version FROM _schema_version WHERE id = 1`);
    const ledger = await client.query(
      `SELECT COUNT(*)::int AS count FROM __drizzle_migrations WHERE tag = $1`,
      [failingTag],
    );
    return { version: version.rows[0]?.version, failingApplied: ledger.rows[0]?.count === 1 };
  });
  if (row.version !== latestTag || !row.failingApplied) {
    throw new Error(`Migration resume verification failed: ${JSON.stringify(row)}`);
  }
  console.log(`[legacy-test] ${name === fullDb ? '0023' : 'partial'} → 0092, SET ROLE, ${failingTag}, ledger: PASS`);
}

async function assertMigrationFailsAtForeignOwner(
  name: string,
  migration: DatabaseConnectionOptions,
): Promise<void> {
  const result = await new MigrationRunner(serverRoot).runMigrations(
    migrationConnection(migration),
    emit,
  );
  if (!result.failed || !/owner|permission denied|must be owner/i.test(result.failed)) {
    throw new Error(`Expected ${failingTag} ownership failure, got: ${result.failed ?? 'no failure'}`);
  }
  const row = await withClient(dbUrl(name), async (client) => {
    const applied = await client.query(
      `SELECT 1 FROM __drizzle_migrations WHERE tag = $1`,
      [failingTag],
    );
    const enumValue = await client.query(
      `SELECT 1 FROM pg_enum
        WHERE enumtypid = 'public.invoice_type'::regtype
          AND enumlabel = 'credit_note'`,
    );
    return { applied: applied.rowCount === 1, enumValue: enumValue.rowCount === 1 };
  });
  if (row.applied || row.enumValue) {
    throw new Error(`Failed migration left partial state: ${JSON.stringify(row)}`);
  }
  console.log(`[legacy-test] ${name}: ${failingTag} failed on foreign owner and rolled back atomically: PASS`);
}

function configFor(runtime: DatabaseConnectionOptions, port: number): string {
  const configPath = path.join(os.tmpdir(), `onesoft-test-config-${process.pid}-${port}.json`);
  fs.writeFileSync(configPath, JSON.stringify({
    version: '1.0.26',
    configVersion: 4,
    database: {
      host: runtime.host,
      port: runtime.port,
      name: runtime.database,
      user: runtime.user,
      password: runtime.password,
      poolMin: 1,
      poolMax: 4,
    },
    server: { backendPort: port, frontendPort: 5000, host: '127.0.0.1', allowedOrigins: [] },
  }));
  tempFiles.push(configPath);
  return configPath;
}

async function getHealth(port: number): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5_000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function startBackend(runtime: DatabaseConnectionOptions, port: number): Promise<{
  child: ChildProcess;
  output: string[];
}> {
  const output: string[] = [];
  const child = spawn(
    process.execPath,
    [path.join(serverRoot, 'node_modules/tsx/dist/cli.mjs'), 'src/index.ts'],
    {
      cwd: serverRoot,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ONESOFT_CONFIG: configFor(runtime, port),
        PORT: String(port),
        ELECTRON_MODE: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout?.on('data', (chunk: Buffer) => output.push(chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => output.push(chunk.toString()));
  return { child, output };
}

async function waitForHealth(port: number, predicate: (health: { status: number; body: Record<string, unknown> }) => boolean, output: string[]): Promise<{ status: number; body: Record<string, unknown> }> {
  const deadline = Date.now() + 45_000;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const health = await getHealth(port);
      last = JSON.stringify(health);
      if (predicate(health)) return health;
    } catch {
      // HTTP listener may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Health timeout: ${last}\n${output.slice(-30).join('')}`);
}

async function assertRuntimeCannotDdl(runtime: DatabaseConnectionOptions): Promise<void> {
  await withClient(dbUrl(runtime.database, runtime.user, runtime.password), async (client) => {
    const privilege = await client.query(
      `SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS can_create`,
    );
    if (privilege.rows[0]?.can_create !== false) {
      throw new Error('onesoft_app still has CREATE on public schema');
    }
    try {
      await client.query(`CREATE TABLE public.runtime_ddl_probe_${process.pid}(id integer)`);
      throw new Error('onesoft_app unexpectedly executed DDL');
    } catch (error) {
      if (!(error instanceof Error) || !/permission denied|must be owner|not owner/i.test(error.message)) {
        throw error;
      }
    }
  });
  const indexSource = fs.readFileSync(path.join(serverRoot, 'src/index.ts'), 'utf8');
  const autoMigrateSource = fs.readFileSync(path.join(serverRoot, 'src/auto-migrate.ts'), 'utf8');
  if (!/ENV\.nodeEnv\s*!==\s*'production'/.test(indexSource) || !/export async function autoMigrate/.test(autoMigrateSource)) {
    throw new Error('Production auto-migration guard is missing');
  }
  console.log('[legacy-test] onesoft_app runtime DDL denied: PASS');
}

async function assertFoundation(name: string, runtime: DatabaseConnectionOptions): Promise<void> {
  await withClient(dbUrl(name, runtime.user, runtime.password), async (client) => {
    const orgs = await client.query(`SELECT id, code, foundation_status FROM organizations WHERE status IN ('active', 'trial')`);
    if (!orgs.rowCount) throw new Error('No active/trial organization after upgrade');
    for (const org of orgs.rows) {
      for (const key of ['wh.001', 'wh.002', 'wh.003', 'wh.004']) {
        const warehouse = await client.query(
          `SELECT id FROM warehouses WHERE org_id = $1 AND foundation_key = $2`,
          [org.id, key],
        );
        if (warehouse.rowCount !== 1) throw new Error(`Missing/duplicate ${key} for ${org.code}`);
      }
      for (const code of ['INV.01.', 'INV.02.', 'INV.03.', 'INV.04.']) {
        const journal = await client.query(
          `SELECT id FROM document_journals WHERE org_id = $1 AND UPPER(code) = $2`,
          [org.id, code],
        );
        if (journal.rowCount !== 1) throw new Error(`Missing/duplicate ${code} for ${org.code}`);
      }
    }
    const before = await client.query(
      `SELECT COUNT(*)::int AS count FROM warehouses WHERE foundation_key IN ('wh.001','wh.002','wh.003','wh.004')`,
    );
    return { orgCount: orgs.rowCount, before: before.rows[0].count };
  });
  console.log(`[legacy-test] Foundation wh.001..wh.004 + INV.01..INV.04: PASS`);
}

async function assertFoundationIdempotency(name: string, runtime: DatabaseConnectionOptions): Promise<void> {
  const before = await withClient(dbUrl(name, runtime.user, runtime.password), async (client) => (
    client.query(
      `SELECT COUNT(*)::int AS count FROM warehouses WHERE foundation_key IN ('wh.001','wh.002','wh.003','wh.004')`,
    ).then((result) => result.rows[0].count)
  ));
  const port = 39_100 + (process.pid % 400);
  const { child, output } = await startBackend(runtime, port);
  try {
    await waitForHealth(port, (health) => health.status === 200 && health.body.ready === true, output);
  } finally {
    await stop(child);
  }
  const after = await withClient(dbUrl(name, runtime.user, runtime.password), async (client) => (
    client.query(
      `SELECT COUNT(*)::int AS count FROM warehouses WHERE foundation_key IN ('wh.001','wh.002','wh.003','wh.004')`,
    ).then((result) => result.rows[0].count)
  ));
  if (before !== after) throw new Error(`Foundation second run changed warehouse count: ${before} -> ${after}`);
  console.log('[legacy-test] Foundation second startup inserted no duplicates: PASS');
}

async function assertBackupReadable(name: string): Promise<void> {
  const backupPath = path.join(os.tmpdir(), `onesoft-test-${name}.sql`);
  tempFiles.push(backupPath);
  execFileSync('pg_dump', [dbUrl(name), '-F', 'p', '-f', backupPath], { stdio: 'pipe' });
  const stats = fs.statSync(backupPath);
  if (!stats.isFile() || stats.size < 128) throw new Error('Backup is empty');
  await createDb(restoreDb);
  execFileSync('psql', [dbUrl(restoreDb), '-v', 'ON_ERROR_STOP=1', '-f', backupPath], { stdio: 'pipe' });
  const restored = await withClient(dbUrl(restoreDb), async (client) => (
    client.query(`SELECT to_regclass('public.organizations') AS table_name`)
      .then((result) => result.rows[0]?.table_name)
  ));
  if (!restored) throw new Error('PostgreSQL could not read restored plain SQL backup');
  console.log('[legacy-test] pg_dump plain SQL readable and restorable: PASS');
}

async function main(): Promise<void> {
  await makeLegacyDatabase(fullDb, legacyStartTag);
  const fullRoles = await provisionRoles(fullDb);
  await assertLegacyOwnershipDrift(fullDb, fullRoles.migration);
  await adoptOwnership(fullDb);
  await reintroduceInvoiceTypeDrift(fullDb);
  await assertMigrationFailsAtForeignOwner(fullDb, fullRoles.migration);
  await adoptOwnership(fullDb);
  // The runner commits each migration independently. After the intentional
  // 0069 failure, 0024..0068 are present in the ledger and 0069 is pending.
  await assertPreflight(fullDb, fullRoles.migration, failingTag);
  await runMigrations(fullDb, fullRoles.migration);
  await assertRuntimeCannotDdl(fullRoles.runtime);

  const fullPort = 38_500 + (process.pid % 400);
  const fullServer = await startBackend(fullRoles.runtime, fullPort);
  try {
    const health = await waitForHealth(fullPort, (value) => value.status === 200 && value.body.ready === true, fullServer.output);
    if (health.body.status !== 'ok' || health.body.version !== '1.0.26') {
      throw new Error(`Unexpected ready health: ${JSON.stringify(health)}`);
    }
    console.log('[legacy-test] runtime onesoft_app health ready=true: PASS');
  } finally {
    await stop(fullServer.child);
  }
  await assertFoundation(fullDb, fullRoles.runtime);
  await assertFoundationIdempotency(fullDb, fullRoles.runtime);
  await assertBackupReadable(fullDb);

  await makeLegacyDatabase(partialDb, partialTag);
  const partialRoles = await provisionRoles(partialDb);
  await assertLegacyOwnershipDrift(partialDb, partialRoles.migration);
  await adoptOwnership(partialDb);
  await assertPreflight(partialDb, partialRoles.migration, failingTag);
  console.log('[legacy-test] partial migration state before 0069 detected from ledger/schema: PASS');

  const failurePort = 38_900 + (process.pid % 400);
  const failedServer = await startBackend(partialRoles.runtime, failurePort);
  try {
    const health = await waitForHealth(failurePort, (value) => value.body.status === 'migration_failed', failedServer.output);
    if (
      health.status !== 503 ||
      health.body.ready !== false ||
      health.body.startupPhase !== 'migration' ||
      health.body.migration !== failingTag ||
      typeof health.body.message !== 'string' ||
      /postgresql:\/\/|password|secret|token/i.test(health.body.message as string)
    ) {
      throw new Error(`Unsafe/incorrect migration_failed health: ${JSON.stringify(health)}`);
    }
    console.log(`[legacy-test] health migration_failed ready=false phase=migration migration=${failingTag} safe error: PASS`);
  } finally {
    await stop(failedServer.child);
  }

  await runMigrations(partialDb, partialRoles.migration);
  const resumedPort = 39_000 + (process.pid % 400);
  const resumedServer = await startBackend(partialRoles.runtime, resumedPort);
  try {
    const health = await waitForHealth(resumedPort, (value) => value.status === 200 && value.body.ready === true, resumedServer.output);
    if (health.body.ready !== true) throw new Error(`Resume health not ready: ${JSON.stringify(health)}`);
    console.log('[legacy-test] migration resume after failure → health ready=true: PASS');
  } finally {
    await stop(resumedServer.child);
  }
  await assertFoundation(partialDb, partialRoles.runtime);
  await assertFoundationIdempotency(partialDb, partialRoles.runtime);

  console.log('[legacy-test] ALL LEGACY UPGRADE ACCEPTANCE TESTS: PASS');
}

async function cleanup(): Promise<void> {
  for (const file of tempFiles) fs.rmSync(file, { force: true });
  await dropDb(fullDb);
  await dropDb(partialDb);
  await dropDb(restoreDb);
  await withClient(adminUrl, async (client) => {
    if (createdRoles.has(legacyOwner)) await client.query(`DROP ROLE IF EXISTS ${quote(legacyOwner)}`);
    // Never remove roles that predated this test environment.
  }).catch(() => undefined);
}

main().catch((error) => {
  console.error('[legacy-test] FAILED:', error instanceof Error ? error.stack : error);
  process.exitCode = 1;
}).finally(cleanup);