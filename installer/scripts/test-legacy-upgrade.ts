import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { spawn, type ChildProcess } from 'node:child_process';
import pg from 'pg';
import {
  DatabaseRoleManager,
  MIGRATOR_ROLE,
  RUNTIME_ROLE,
  SCHEMA_OWNER_ROLE,
  TABLE_ALLOWLIST,
} from '../core/database/DatabaseRoleManager.js';
import { preflightDatabase, migrationConnection } from '../core/database/DatabasePreflight.js';
import { MigrationRunner } from '../core/database/MigrationRunner.js';
import { RollbackManager } from '../core/upgrade/RollbackManager.js';
import {
  buildPostgreSQLConnectionArgs,
  buildPostgreSQLToolEnv,
  PostgreSQLToolsResolver,
} from '../core/database/PostgreSQLToolsResolver.js';
import type { DatabaseConnectionOptions, ProgressEvent } from '../core/types.js';
import { APP_VERSION } from '../core/version.js';

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
const v100LedgerTag = migrations[13]!.tag;
if (v100LedgerTag !== '0013_add_missing_tables') {
  throw new Error(`Unexpected v1.0.0 ledger boundary: ${v100LedgerTag}`);
}
const legacyStartTag = '0023_custody_records';
const partialTag = '0068_zatca_compliance_secret';
const failingTag = '0069_credit_debit_notes';
const schemaRepairTag = '0093_schema_compatibility_repair';
const requiredSystemAccounts = [
  { code: '110101', name: 'نقدية بالصندوق فرع 1' },
  { code: '110103', name: 'نقدية بالصندوق فرع 3' },
  { code: '210501', name: 'ضريبة مخرجات' },
  { code: '410101', name: 'مبيعات فرع 1' },
] as const;

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
const historicalDb = `onesoft_legacy_v100_${suffix}`;
const restoreDb = `onesoft_backup_restore_${suffix}`;
const appPassword = `runtime_${suffix}`;
const legacyOwner = `onesoft_legacy_owner_${process.pid}`;
const createdRoles = new Set<string>();
const tempFiles: string[] = [];
const postgresTools = new PostgreSQLToolsResolver().resolveAll(admin);
console.log(
  `[legacy-test] PostgreSQL tools: pg_dump=${postgresTools.pgDump} ` +
  `pg_restore=${postgresTools.pgRestore} psql=${postgresTools.psql}`,
);

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

async function desynchronizeLegacyLedgerSequence(name: string): Promise<void> {
  await withClient(dbUrl(name), async (client) => {
    const rows = await client.query<{ id: number; tag: string }>(
      `SELECT id, tag FROM __drizzle_migrations ORDER BY id`,
    );
    const expected = migrations.slice(0, 14).map((migration) => migration.tag);
    if (
      rows.rows.length !== expected.length ||
      rows.rows.some((row, index) => Number(row.id) !== index + 1 || row.tag !== expected[index])
    ) {
      throw new Error(
        `v1.0.0 ledger fixture is not the expected 14-row prefix: ${JSON.stringify(rows.rows)}`,
      );
    }

    const sequence = await client.query<{ sequence_name: string | null }>(`
      SELECT pg_get_serial_sequence('public.__drizzle_migrations', 'id') AS sequence_name
    `);
    const sequenceName = sequence.rows[0]?.sequence_name;
    if (!sequenceName) throw new Error('v1.0.0 ledger fixture has no id sequence');

    // Simulate a historical backup/import that preserved the rows but left the
    // SERIAL sequence at its initial, not-yet-called value. This is test-only;
    // no customer ledger row is changed or deleted.
    await client.query(
      'SELECT setval($1::regclass, 1, false)',
      [sequenceName],
    );
    const maxId = await client.query<{ max_id: string }>(
      `SELECT MAX(id)::text AS max_id FROM __drizzle_migrations`,
    );
    if (maxId.rows[0]?.max_id !== '14') {
      throw new Error(`Unexpected v1.0.0 ledger MAX(id): ${maxId.rows[0]?.max_id}`);
    }
  });
  console.log('[legacy-test] v1.0.0 ledger with stale SERIAL sequence reproduced: PASS');
}

async function assertMigrationLedger(name: string): Promise<void> {
  await withClient(dbUrl(name), async (client) => {
    const rows = await client.query<{ id: number; tag: string }>(
      `SELECT id, tag FROM __drizzle_migrations ORDER BY id`,
    );
    if (rows.rows.length !== migrations.length) {
      throw new Error(
        `Migration ledger count mismatch: ${rows.rows.length} != ${migrations.length}`,
      );
    }
    rows.rows.forEach((row, index) => {
      const expectedTag = migrations[index]!.tag;
      if (Number(row.id) !== index + 1 || row.tag !== expectedTag) {
        throw new Error(
          `Migration ledger order mismatch at ${index + 1}: ` +
          `${JSON.stringify(row)} != ${JSON.stringify({ id: index + 1, tag: expectedTag })}`,
        );
      }
    });
  });
  console.log(`[legacy-test] ${name}: migration ledger rows and surrogate IDs preserved: PASS`);
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

async function makeLegacyDatabase(
  name: string,
  tag: string,
  options: { preserveOrganizationsCode?: boolean } = {},
): Promise<void> {
  const preserveOrganizationsCode = options.preserveOrganizationsCode === true;
  await createDb(name);
  await createLegacyOwner();
  await withClient(dbUrl(name), async (client) => {
    await applyThrough(client, tag);
    // Reproduce the schema drift found by the Fresh-vs-Legacy diff. These
    // columns are present in the current Fresh bootstrap, but historical
    // Legacy databases can reach 0092 without ever receiving them.
    await client.query(`
      ALTER TABLE document_journals
        DROP COLUMN IF EXISTS customers_journal,
        DROP COLUMN IF EXISTS suppliers_journal,
        DROP COLUMN IF EXISTS payment_types_config,
        DROP COLUMN IF EXISTS issuance_config,
        DROP COLUMN IF EXISTS options_config
    `);
    await client.query(`
      ALTER TABLE purchase_invoices
        DROP COLUMN IF EXISTS zatca_invoice_type
    `);
    await seedLedgerAndStamp(client, tag);
    // Reproduce the Windows Legacy shape: migrations through 0092 add the
    // Foundation reconciliation columns, but no migration adds organizations.code.
    // Keep an existing organization/user so bootstrap does not try to create
    // a modern organization row before Foundation detection runs.
    const organization = await client.query(`
      INSERT INTO organizations (code, name, status)
      VALUES ('LEGACY', 'Legacy Windows Organization', 'trial')
      RETURNING id
    `);
    const organizationId = organization.rows[0]?.id;
    if (!organizationId) throw new Error('Could not seed Legacy organization');
    await client.query(`
      INSERT INTO users (id, org_id, username, password_hash, name, role, is_active, password_status)
      VALUES
        (41001, $1, 'LEGACY_ADMIN', 'legacy-test-hash', 'Legacy Admin', 'admin', true, 'set'),
        (42002, $1, 'LEGACY_OPERATOR', 'legacy-test-hash', 'Legacy Operator', 'cashier', true, 'set')
    `, [organizationId]);
    const missingSystemAccounts = await client.query(
      `SELECT code
         FROM chart_of_accounts
        WHERE org_id = $1
          AND code = ANY($2::text[])`,
      [organizationId, requiredSystemAccounts.map((account) => account.code)],
    );
    if (missingSystemAccounts.rowCount !== 0) {
      throw new Error(
        `Legacy fixture unexpectedly contains system accounts before Foundation: ` +
        `${missingSystemAccounts.rows.map((row: { code: string }) => row.code).join(', ')}`,
      );
    }
    console.log('[legacy-test] Legacy fixture starts without the four system accounts: PASS');
    if (!preserveOrganizationsCode) {
      await client.query(`
        ALTER TABLE organizations
          DROP CONSTRAINT IF EXISTS organizations_code_unique,
          DROP CONSTRAINT IF EXISTS organizations_code_key
      `);
      await client.query(`ALTER TABLE organizations DROP COLUMN IF EXISTS code`);
    }
    const columns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'organizations'
      ORDER BY ordinal_position
    `);
    const actualColumns = columns.rows.map((row: { column_name: string }) => row.column_name);
    if (!preserveOrganizationsCode && actualColumns.includes('code')) {
      throw new Error(`Legacy organizations.code still exists: ${actualColumns.join(', ')}`);
    }
    if (!preserveOrganizationsCode && tag === latestTag && !actualColumns.includes('foundation_status')) {
      throw new Error(`Legacy Foundation status columns missing after ${tag}`);
    }
    console.log(
      `[legacy-test] ${name}: organizations schema after ${tag} ` +
      `${preserveOrganizationsCode ? 'preserves code' : 'has no code'}` +
      `${actualColumns.includes('foundation_status') ? ' and has Foundation status columns' : ''}: PASS`,
    );
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
  if (!result.ownershipDrift.some((item) => item.includes('invoice_type [type]'))) {
    throw new Error(`Preflight did not report invoice_type ownership drift: ${result.ownershipDrift.join('; ')}`);
  }
  console.log(
    `[legacy-test] ownership violations first ${Math.min(20, result.ownershipViolations.length)}: ` +
    JSON.stringify(result.ownershipViolations.slice(0, 20)),
  );
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
    if (result.ownershipViolations.length) {
      console.error(
        `[legacy-test] preflight ownership violations first ${Math.min(20, result.ownershipViolations.length)}: ` +
        JSON.stringify(result.ownershipViolations.slice(0, 20)),
      );
    }
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
  await assertMigrationLedger(name);
  console.log(`[legacy-test] ${name === fullDb ? '0023' : 'partial'} → ${latestTag}, SET ROLE, ${failingTag}, ledger: PASS`);
}

async function assertSchemaCompatibility(name: string): Promise<void> {
  await withClient(dbUrl(name), async (client) => {
    const expectedColumns = [
      ['document_journals', 'customers_journal'],
      ['document_journals', 'suppliers_journal'],
      ['document_journals', 'payment_types_config'],
      ['document_journals', 'issuance_config'],
      ['document_journals', 'options_config'],
      ['purchase_invoices', 'zatca_invoice_type'],
    ] as const;
    const missing: string[] = [];
    for (const [tableName, columnName] of expectedColumns) {
      const result = await client.query(
        `SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2`,
        [tableName, columnName],
      );
      if (!result.rowCount) missing.push(`${tableName}.${columnName}`);
    }
    if (missing.length) {
      throw new Error(`Schema repair ${schemaRepairTag} left missing columns: ${missing.join(', ')}`);
    }

    const constraints = await client.query<{ conname: string }>(
      `SELECT conname
         FROM pg_constraint
        WHERE conname = ANY($1::text[])`,
      [[
        'products_tax_id_tax_definitions_id_fk',
        'sales_invoice_items_tax_id_tax_definitions_id_fk',
        'stock_vouchers_receiver_user_id_users_id_fk',
        'tax_definitions_org_id_organizations_id_fk',
      ]],
    );
    const actual = new Set(constraints.rows.map((row) => row.conname));
    const required = [
      'products_tax_id_tax_definitions_id_fk',
      'sales_invoice_items_tax_id_tax_definitions_id_fk',
      'stock_vouchers_receiver_user_id_users_id_fk',
      'tax_definitions_org_id_organizations_id_fk',
    ];
    const missingConstraints = required.filter((name) => !actual.has(name));
    if (missingConstraints.length) {
      throw new Error(`Schema repair ${schemaRepairTag} left missing constraints: ${missingConstraints.join(', ')}`);
    }
  });
  console.log(`[legacy-test] ${name}: schema compatibility after ${schemaRepairTag}: PASS`);
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
    version: APP_VERSION,
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

function findNssm(): string {
  const candidates = [
    process.env['NSSM_PATH'],
    'nssm.exe',
    'C:\\ProgramData\\chocolatey\\bin\\nssm.exe',
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (candidate === 'nssm.exe' || fs.existsSync(candidate)) return candidate;
  }
  try {
    return execFileSync('where.exe', ['nssm.exe'], {
      encoding: 'utf8',
      stdio: 'pipe',
      windowsHide: true,
    }).trim().split(/\r?\n/)[0]!;
  } catch {
    throw new Error('NSSM is required for the Windows OneSoft-Server service acceptance');
  }
}

function invokeNssm(nssm: string, args: string[]): void {
  execFileSync(nssm, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
  });
}

async function assertWindowsServiceReady(
  runtime: DatabaseConnectionOptions,
  port: number,
): Promise<void> {
  if (process.platform !== 'win32') return;

  const serviceName = 'OneSoft-Server';
  const nssm = findNssm();
  const tsxEntry = path.join(serverRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const serviceLog = path.join(os.tmpdir(), `onesoft-service-${process.pid}-${port}.log`);
  tempFiles.push(serviceLog);

  // The GitHub runner is disposable. Remove a stale service so this assertion
  // cannot pass by observing a previous process.
  try { invokeNssm(nssm, ['stop', serviceName]); } catch {}
  try { invokeNssm(nssm, ['remove', serviceName, 'confirm']); } catch {}

  const configPath = configFor(runtime, port);
  invokeNssm(nssm, ['install', serviceName, process.execPath, tsxEntry, 'src/index.ts']);
  invokeNssm(nssm, ['set', serviceName, 'AppDirectory', serverRoot]);
  const quotedTsxEntry = /\s/.test(tsxEntry) ? `"${tsxEntry}"` : tsxEntry;
  invokeNssm(nssm, ['set', serviceName, 'AppParameters', `${quotedTsxEntry} src/index.ts`]);
  invokeNssm(nssm, [
    'set', serviceName, 'AppEnvironmentExtra',
    'NODE_ENV=production',
    `ONESOFT_CONFIG=${configPath}`,
    `PORT=${port}`,
    'ELECTRON_MODE=0',
  ]);
  invokeNssm(nssm, ['set', serviceName, 'AppStdout', serviceLog]);
  invokeNssm(nssm, ['set', serviceName, 'AppStderr', serviceLog]);
  invokeNssm(nssm, ['set', serviceName, 'Start', 'SERVICE_DEMAND_START']);
  invokeNssm(nssm, ['start', serviceName]);

  try {
    const health = await waitForHealth(
      port,
      (value) => value.status === 200 && value.body.ready === true,
      [],
    );
    const serviceState = execFileSync('sc.exe', ['query', serviceName], {
      encoding: 'utf8',
      stdio: 'pipe',
      windowsHide: true,
    });
    if (!/RUNNING/.test(serviceState)) {
      throw new Error(`OneSoft-Server did not reach RUNNING: ${serviceState}`);
    }
    if (health.body.status !== 'ok') {
      throw new Error(`Windows service health is not ok: ${JSON.stringify(health.body)}`);
    }
    console.log('[legacy-test] Windows OneSoft-Server service start → ready=true: PASS');

    invokeNssm(nssm, ['stop', serviceName]);
    const rollback = await new RollbackManager().rollback({
      backupDir: path.join(os.tmpdir(), `onesoft-empty-rollback-${process.pid}`),
      dbOpts: runtime,
      restartServer: true,
    }, () => {});
    if (!rollback.ok || rollback.serviceRollback !== 'success') {
      throw new Error(`Rollback did not restart OneSoft-Server: ${JSON.stringify(rollback)}`);
    }
    await waitForHealth(
      port,
      (value) => value.status === 200 && value.body.ready === true,
      [],
    );
    console.log('[legacy-test] Windows rollback → old OneSoft-Server restarted → ready=true: PASS');
  } finally {
    try { invokeNssm(nssm, ['stop', serviceName]); } catch {}
    try { invokeNssm(nssm, ['remove', serviceName, 'confirm']); } catch {}
  }
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

function foundationMigrationUrl(credential: DatabaseConnectionOptions): string {
  const url = new URL(migrationConnection(credential));
  url.searchParams.set('options', '-c role=onesoft_schema_owner');
  return url.toString();
}

async function assertOwnershipRepairAndRuntime(
  name: string,
  runtime: DatabaseConnectionOptions,
): Promise<void> {
  const ownership = await withClient(dbUrl(name), async (client) => {
    const result = await client.query<{
      relname: string;
      owner: string;
    }>(`
      SELECT c.relname, pg_get_userbyid(c.relowner) AS owner
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND c.relname = ANY($1::text[])
      ORDER BY c.relname
    `, [TABLE_ALLOWLIST]);
    return result.rows;
  });
  const drift = ownership.filter((row) => row.owner !== SCHEMA_OWNER_ROLE);
  if (drift.length) {
    throw new Error(
      `Ownership repair left tables outside ${SCHEMA_OWNER_ROLE}: ` +
      drift.map((row) => `${row.relname}=${row.owner}`).join(', '),
    );
  }

  const runtimeIdentity = await withClient(
    dbUrl(name, runtime.user, runtime.password),
    (client) => client.query<{ current_user: string }>('SELECT current_user')
      .then((result) => result.rows[0]?.current_user),
  );
  if (runtimeIdentity !== RUNTIME_ROLE) {
    throw new Error(`Runtime credential did not connect as ${RUNTIME_ROLE}: ${runtimeIdentity ?? 'unknown'}`);
  }
  console.log(
    `[legacy-test] ${name}: tables owned by ${SCHEMA_OWNER_ROLE}; runtime=${runtimeIdentity}: PASS`,
  );
}

async function runFoundationUpgradeProcess(
  name: string,
  migration: DatabaseConnectionOptions,
): Promise<void> {
  const output: string[] = [];
  const tsxEntry = path.join(serverRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const foundationDataPath = path.join(serverRoot, 'src', 'foundation-data.json');
  const child = spawn(
    process.execPath,
    [tsxEntry, 'src/index.ts'],
    {
      cwd: serverRoot,
      env: {
        ...process.env,
        DATABASE_URL: '',
        NODE_ENV: 'production',
        ELECTRON_RUN_AS_NODE: '1',
        ONESOFT_FOUNDATION_ONLY: '1',
        ONESOFT_UPGRADE_DATABASE_URL: foundationMigrationUrl(migration),
        FOUNDATION_DATA_PATH: foundationDataPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout?.on('data', (chunk: Buffer) => output.push(chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => output.push(chunk.toString()));

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Foundation-only process timed out for ${name}\n${output.slice(-20).join('')}`));
    }, 300_000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(
          `Foundation-only process failed for ${name}: exit=${code ?? 'null'} signal=${signal ?? 'none'}\n` +
          output.slice(-30).join(''),
        ));
      }
    });
  });
  console.log(`[legacy-test] ${name}: Foundation via migrator + SET ROLE ${SCHEMA_OWNER_ROLE}: PASS`);
}

async function assertFoundation(name: string, runtime: DatabaseConnectionOptions): Promise<void> {
  await withClient(dbUrl(name, runtime.user, runtime.password), async (client) => {
    const orgs = await client.query(`SELECT id, foundation_status FROM organizations WHERE status IN ('active', 'trial')`);
    if (!orgs.rowCount) throw new Error('No active/trial organization after upgrade');
    const foundationTables = [
      'branches',
      'warehouses',
      'document_types',
      'document_journals',
    ];
    for (const org of orgs.rows) {
      if (org.foundation_status !== 'applied') {
        throw new Error(
          `Foundation status for Legacy organization ${org.id} is ${org.foundation_status ?? 'null'}`,
        );
      }
      let foundationCount = 0;
      for (const table of foundationTables) {
        const count = await client.query(
          `SELECT COUNT(*)::int AS count FROM ${table} WHERE org_id = $1 AND foundation_key IS NOT NULL`,
          [org.id],
        );
        foundationCount += Number(count.rows[0]?.count ?? 0);
      }
      if (foundationCount !== 77) {
        throw new Error(`Legacy organization ${org.id} has ${foundationCount} Foundation records; expected 77`);
      }
      for (const table of ['document_journals', 'warehouses']) {
        const brokenUserFks = await client.query(
          `SELECT COUNT(*)::int AS count
             FROM ${table} AS foundation_record
             LEFT JOIN users AS target_user
               ON target_user.id = foundation_record.allowed_user_id
            WHERE foundation_record.org_id = $1
              AND foundation_record.foundation_key IS NOT NULL
              AND foundation_record.allowed_user_id IS NOT NULL
              AND target_user.id IS NULL`,
          [org.id],
        );
        if (Number(brokenUserFks.rows[0]?.count ?? 0) !== 0) {
          throw new Error(
            `Foundation ${table} contains broken allowed_user_id FK(s): ${brokenUserFks.rows[0]?.count}`,
          );
        }
      }
      for (const key of ['wh.001', 'wh.002', 'wh.003', 'wh.004']) {
        const warehouse = await client.query(
          `SELECT id FROM warehouses WHERE org_id = $1 AND foundation_key = $2`,
          [org.id, key],
        );
        if (warehouse.rowCount !== 1) throw new Error(`Missing/duplicate ${key} for organization ${org.id}`);
      }
      for (const code of ['INV.01.', 'INV.02.', 'INV.03.', 'INV.04.']) {
        const journal = await client.query(
          `SELECT id FROM document_journals WHERE org_id = $1 AND UPPER(code) = $2`,
          [org.id, code],
        );
        if (journal.rowCount !== 1) throw new Error(`Missing/duplicate ${code} for organization ${org.id}`);
      }
    }
    const before = await client.query(
      `SELECT COUNT(*)::int AS count FROM warehouses WHERE foundation_key IN ('wh.001','wh.002','wh.003','wh.004')`,
    );
    return { orgCount: orgs.rowCount, before: before.rows[0].count };
  });
  console.log('[legacy-test] migrations → Foundation → organizations detection without code → 77 records, no user FK violations: PASS');
}

type RequiredSystemAccountSnapshot = {
  id: number;
  code: string;
  name: string;
  systemKey: string | null;
};

async function readRequiredSystemAccounts(
  name: string,
  runtime: DatabaseConnectionOptions,
  phase: string,
): Promise<RequiredSystemAccountSnapshot[]> {
  return withClient(dbUrl(name, runtime.user, runtime.password), async (client) => {
    const result = await client.query(
      `SELECT coa.id, coa.code, coa.name, coa.system_key AS "systemKey"
         FROM chart_of_accounts AS coa
         JOIN organizations AS org ON org.id = coa.org_id
        WHERE org.name = $1
          AND coa.code = ANY($2::text[])
        ORDER BY coa.code`,
      ['Legacy Windows Organization', requiredSystemAccounts.map((account) => account.code)],
    );
    if (result.rowCount !== requiredSystemAccounts.length) {
      throw new Error(
        `${phase}: expected ${requiredSystemAccounts.length} system accounts, found ${result.rowCount}`,
      );
    }

    const expectedByCode = new Map(requiredSystemAccounts.map((account) => [account.code, account.name]));
    const snapshots = result.rows.map((row: RequiredSystemAccountSnapshot) => ({
      id: Number(row.id),
      code: row.code,
      name: row.name,
      systemKey: row.systemKey,
    }));
    for (const account of snapshots) {
      if (
        expectedByCode.get(account.code) !== account.name ||
        account.systemKey !== `acct.${account.code}`
      ) {
        throw new Error(`${phase}: invalid system account row ${JSON.stringify(account)}`);
      }
    }
    console.log(
      `[legacy-test] ${phase}: ${snapshots.map((account) => `${account.code}=${account.name}`).join(', ')}: PASS`,
    );
    return snapshots;
  });
}

async function assertFoundationIdempotency(name: string, runtime: DatabaseConnectionOptions): Promise<void> {
  const beforeAccounts = await readRequiredSystemAccounts(name, runtime, 'before second run');
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
  const afterAccounts = await readRequiredSystemAccounts(name, runtime, 'after second run');
  if (JSON.stringify(beforeAccounts) !== JSON.stringify(afterAccounts)) {
    throw new Error(
      `Foundation second run changed system accounts: ` +
      `${JSON.stringify(beforeAccounts)} -> ${JSON.stringify(afterAccounts)}`,
    );
  }
  console.log('[legacy-test] Foundation second startup inserted no duplicates: PASS');
  console.log('[legacy-test] Foundation second startup preserved system account codes and IDs: PASS');
}

async function assertBackupReadable(name: string, migration: DatabaseConnectionOptions): Promise<void> {
  const backupPath = path.join(os.tmpdir(), `onesoft-test-${name}.sql`);
  tempFiles.push(backupPath);
  const connection = { ...migration, database: name };
  execFileSync(postgresTools.pgDump, [
    ...buildPostgreSQLConnectionArgs(connection),
    '--role', SCHEMA_OWNER_ROLE,
    '-F', 'p',
    '-f', backupPath,
  ], {
    env: buildPostgreSQLToolEnv(connection),
    stdio: 'pipe',
    windowsHide: true,
  });
  const stats = fs.statSync(backupPath);
  if (!stats.isFile() || stats.size < 128) throw new Error('Backup is empty');
  await createDb(restoreDb);
  const restoreConnection = { ...admin, database: restoreDb };
  execFileSync(postgresTools.psql, [
    ...buildPostgreSQLConnectionArgs(restoreConnection),
    '-v', 'ON_ERROR_STOP=1',
    '-f', backupPath,
  ], {
    env: buildPostgreSQLToolEnv(restoreConnection),
    stdio: 'pipe',
    windowsHide: true,
  });
  const restored = await withClient(dbUrl(restoreDb), async (client) => (
    client.query(`SELECT to_regclass('public.organizations') AS table_name`)
      .then((result) => result.rows[0]?.table_name)
  ));
  if (!restored) throw new Error('PostgreSQL could not read restored plain SQL backup');
  console.log(`[legacy-test] Backup PASS: pg_dump plain SQL created (${postgresTools.pgDump})`);
  console.log(`[legacy-test] Restore PASS: plain SQL restored with psql (${postgresTools.psql})`);
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
  await assertOwnershipRepairAndRuntime(fullDb, fullRoles.runtime);
  await assertRuntimeCannotDdl(fullRoles.runtime);
  await runFoundationUpgradeProcess(fullDb, fullRoles.migration);
  await assertSchemaCompatibility(fullDb);
  await assertFoundation(fullDb, fullRoles.runtime);
  await readRequiredSystemAccounts(fullDb, fullRoles.runtime, 'Legacy upgrade created four system accounts');
  await assertBackupReadable(fullDb, fullRoles.migration);

  const fullPort = 38_500 + (process.pid % 400);
  if (process.platform === 'win32') {
    await assertWindowsServiceReady(fullRoles.runtime, fullPort);
  } else {
    const fullServer = await startBackend(fullRoles.runtime, fullPort);
    try {
      const health = await waitForHealth(fullPort, (value) => value.status === 200 && value.body.ready === true, fullServer.output);
      if (health.body.status !== 'ok' || health.body.version !== APP_VERSION) {
        throw new Error(`Unexpected ready health: ${JSON.stringify(health)}`);
      }
      console.log('[legacy-test] runtime onesoft_app health ready=true: PASS');
    } finally {
      await stop(fullServer.child);
    }
  }
  await assertFoundationIdempotency(fullDb, fullRoles.runtime);

  // v1.0.0 shipped a 14-entry journal (0000..0013). Verify that an old
  // ledger with a stale SERIAL sequence can still traverse the complete
  // current journal without changing its historical rows.
  await makeLegacyDatabase(historicalDb, v100LedgerTag, { preserveOrganizationsCode: true });
  const historicalRoles = await provisionRoles(historicalDb);
  await assertLegacyOwnershipDrift(historicalDb, historicalRoles.migration);
  await adoptOwnership(historicalDb);
  await assertPreflight(
    historicalDb,
    historicalRoles.migration,
    migrations[14]!.tag,
  );
  await desynchronizeLegacyLedgerSequence(historicalDb);
  await runMigrations(historicalDb, historicalRoles.migration);
  await assertSchemaCompatibility(historicalDb);

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
  await assertOwnershipRepairAndRuntime(partialDb, partialRoles.runtime);
  await runFoundationUpgradeProcess(partialDb, partialRoles.migration);
  await assertSchemaCompatibility(partialDb);
  await assertFoundation(partialDb, partialRoles.runtime);
  await readRequiredSystemAccounts(partialDb, partialRoles.runtime, 'Partial Legacy upgrade created four system accounts');
  const resumedPort = 39_000 + (process.pid % 400);
  const resumedServer = await startBackend(partialRoles.runtime, resumedPort);
  try {
    const health = await waitForHealth(resumedPort, (value) => value.status === 200 && value.body.ready === true, resumedServer.output);
    if (health.body.ready !== true) throw new Error(`Resume health not ready: ${JSON.stringify(health)}`);
    console.log('[legacy-test] migration resume after failure → health ready=true: PASS');
  } finally {
    await stop(resumedServer.child);
  }
  await assertFoundationIdempotency(partialDb, partialRoles.runtime);

  console.log('[legacy-test] ALL LEGACY UPGRADE ACCEPTANCE TESTS: PASS');
}

async function cleanup(): Promise<void> {
  for (const file of tempFiles) fs.rmSync(file, { force: true });
  await dropDb(fullDb);
  await dropDb(partialDb);
  await dropDb(historicalDb);
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