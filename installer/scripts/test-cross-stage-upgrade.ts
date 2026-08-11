import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import pg from 'pg';
import type { DatabaseConnectionOptions, ProgressEvent } from '../core/types.js';

const { Client } = pg;

type UpgradeManagerModule = typeof import('../core/upgrade/UpgradeManager.js');
type RoleManagerModule = typeof import('../core/database/DatabaseRoleManager.js');
type ConfigModule = typeof import('../core/config/ConfigManager.js');
type PolicyModule = typeof import('../core/upgrade/UpgradeLaunchPolicy.js');

type FakeRollbackCall = {
  backupDir: string;
  roleBootstrapRollback: string;
  ownershipRollback: string;
};

const root = path.resolve(import.meta.dirname, '../..');
const serverAppPath = path.join(root, 'server-app');
const serverDist = path.join(serverAppPath, 'dist', 'index.mjs');
const journal = JSON.parse(
  fs.readFileSync(path.join(serverAppPath, 'drizzle', 'meta', '_journal.json'), 'utf8'),
) as { entries: Array<{ tag: string }> };
const migrationTags = journal.entries.map((entry) => entry.tag);
const baseSchema = fs.readFileSync(path.join(serverAppPath, 'drizzle', 'base_schema.sql'), 'utf8');
const migrationSql = migrationTags.map((tag) => ({
  tag,
  sql: fs.readFileSync(path.join(serverAppPath, 'drizzle', `${tag}.sql`), 'utf8'),
}));

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'onesoft-cross-stage-'));
process.env.HOME = testRoot;
process.env.USERPROFILE = testRoot;

const port = 42_000 + (process.pid % 1_000);
const dbName = `onesoft_cross_stage_${process.pid}`;
const admin: DatabaseConnectionOptions = {
  host: '127.0.0.1',
  port,
  database: 'postgres',
  user: 'postgres',
  password: '',
};
const runtimePassword = `runtime-cross-stage-${process.pid}`;
const dbOpts: DatabaseConnectionOptions = {
  ...admin,
  database: dbName,
  user: 'onesoft_app',
  password: runtimePassword,
};
const databaseUrl = `postgresql://${dbOpts.user}:${dbOpts.password}@${dbOpts.host}:${dbOpts.port}/${dbName}`;
const clusterDir = path.join(testRoot, 'pgdata');
const pgLog = path.join(testRoot, 'postgres.log');
let backend: ChildProcess | null = null;

function quote(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function asProgress(event: ProgressEvent): void {
  if (event.level === 'error') console.error(`[cross-stage] ${event.message}`);
}

async function withClient<T>(
  options: DatabaseConnectionOptions,
  fn: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new Client(options);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

function initCluster(): void {
  execFileSync('initdb', ['-D', clusterDir, '-U', 'postgres', '--auth=trust', '--no-locale'], {
    stdio: 'pipe',
  });
  try {
    execFileSync('pg_ctl', [
      '-D', clusterDir,
      '-o', `-p ${port} -h 127.0.0.1 -k ${testRoot}`,
      '-l', pgLog,
      '-w',
      'start',
    ], { stdio: 'pipe' });
  } catch (error) {
    const log = fs.existsSync(pgLog) ? fs.readFileSync(pgLog, 'utf8') : '(postgres.log missing)';
    throw new Error(
      `temporary PostgreSQL cluster failed to start: ${
        error instanceof Error ? error.message : String(error)
      }\n${log}`,
    );
  }
}

async function createDatabase(): Promise<void> {
  await withClient(admin, async (client) => {
    await client.query(`CREATE DATABASE ${quote(dbName)}`);
  });
}

async function seedLatestSchema(): Promise<void> {
  await withClient({ ...admin, database: dbName }, async (client) => {
    await client.query(baseSchema);
    for (const migration of migrationSql) {
      await client.query(migration.sql);
    }
    await client.query(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        tag TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_version (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        version TEXT NOT NULL,
        stamped_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    for (const tag of migrationTags) {
      await client.query(
        `INSERT INTO __drizzle_migrations (tag) VALUES ($1) ON CONFLICT (tag) DO NOTHING`,
        [tag],
      );
    }
    await client.query(
      `INSERT INTO _schema_version (id, version) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, stamped_at = now()`,
      [migrationTags.at(-1)],
    );
  });
}

async function grantBaselineRuntimeAccess(): Promise<void> {
  await withClient({ ...admin, database: dbName }, async (client) => {
    await client.query(`GRANT USAGE ON SCHEMA public TO "onesoft_app"`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "onesoft_app"`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "onesoft_app"`);
    await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO "onesoft_app"`);
  });
}

async function roleExists(role: string): Promise<boolean> {
  return withClient(admin, async (client) => {
    const result = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists`,
      [role],
    );
    return result.rows[0]?.exists === true;
  });
}

async function roleMembershipExists(): Promise<boolean> {
  return withClient(admin, async (client) => {
    const result = await client.query<{ member: boolean }>(`
      SELECT pg_has_role('onesoft_migrator', 'onesoft_schema_owner', 'member') AS member
    `);
    return result.rows[0]?.member === true;
  });
}

async function runtimeCanConnect(): Promise<void> {
  await withClient(dbOpts, async (client) => {
    await client.query('SELECT 1');
  });
}

async function ownershipSnapshot(): Promise<{ schema: string | null; invoiceType: string | null }> {
  return withClient({ ...admin, database: dbName }, async (client) => {
    const schema = await client.query<{ owner: string | null }>(`
      SELECT pg_get_userbyid(nspowner) AS owner
      FROM pg_namespace WHERE nspname = 'public'
    `);
    const type = await client.query<{ owner: string | null }>(`
      SELECT pg_get_userbyid(t.typowner) AS owner
      FROM pg_type t
      WHERE t.typnamespace = 'public'::regnamespace AND t.typname = 'invoice_type'
    `);
    return {
      schema: schema.rows[0]?.owner ?? null,
      invoiceType: type.rows[0]?.owner ?? null,
    };
  });
}

async function waitForHealth(portToCheck: number, child: ChildProcess): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 45_000;
  let lastError = 'no response';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Backend exited before health check: ${lastError}`);
    }
    try {
      const body = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const request = http.get(`http://127.0.0.1:${portToCheck}/api/health`, (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          response.on('end', () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>);
            } catch (error) {
              reject(error);
            }
          });
        });
        request.setTimeout(2_000, () => request.destroy(new Error('health timeout')));
        request.on('error', reject);
      });
      if (body.ready === true) return body;
      lastError = JSON.stringify(body);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Backend did not become ready: ${lastError}`);
}

function startBackend(portToCheck: number): ChildProcess {
  const child = spawn(process.execPath, [serverDist], {
    cwd: serverAppPath,
    env: {
      ...process.env,
      HOME: testRoot,
      USERPROFILE: testRoot,
      NODE_ENV: 'production',
      PORT: String(portToCheck),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => {
    if (process.env['CROSS_STAGE_VERBOSE'] === '1') process.stdout.write(chunk);
  });
  child.stderr?.on('data', (chunk) => {
    if (process.env['CROSS_STAGE_VERBOSE'] === '1') process.stderr.write(chunk);
  });
  return child;
}

async function stopBackend(): Promise<void> {
  if (!backend) return;
  backend.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      backend?.kill('SIGKILL');
      resolve();
    }, 3_000);
    backend?.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  backend = null;
}

async function createConfig(
  ConfigManager: ConfigModule['ConfigManager'],
  backendPort: number,
): Promise<Buffer> {
  const config = ConfigManager.initDefault({ dbPassword: runtimePassword });
  config.database.host = dbOpts.host;
  config.database.port = dbOpts.port;
  config.database.name = dbName;
  config.database.user = 'onesoft_app';
  config.database.password = runtimePassword;
  config.server.backendPort = backendPort;
  ConfigManager.save(config);
  return fs.readFileSync(ConfigManager.getConfigPath());
}

function createUpgradeDependencies(
  modules: {
    UpgradeManager: UpgradeManagerModule['UpgradeManager'];
    DatabaseRoleManager: RoleManagerModule['DatabaseRoleManager'];
    runOwnershipRepairTransaction: RoleManagerModule['runOwnershipRepairTransaction'];
    ConfigManager: ConfigModule['ConfigManager'];
  },
  options: {
    failOwnershipOnce: boolean;
    failDpapi: boolean;
    backupRoot: string;
  },
) {
  const realRoleManager = new modules.DatabaseRoleManager();
  let ownershipFailurePending = options.failOwnershipOnce;
  let savedCredential: ReturnType<typeof realRoleManager['provision']> extends Promise<infer R> ? R['migration'] : never;
  let saveCalls = 0;
  const rollbackCalls: FakeRollbackCall[] = [];

  const roleManager = {
    provision: (...args: Parameters<typeof realRoleManager['provision']>) =>
      realRoleManager.provision(...args),
    adoptAllowlistedObjects: async (repairAdmin: DatabaseConnectionOptions) => {
      const client = new Client(repairAdmin);
      await client.connect();
      try {
        if (ownershipFailurePending) {
          ownershipFailurePending = false;
          const injected = {
            query: async <T extends Record<string, unknown> = Record<string, unknown>>(
              text: string,
              values?: unknown[],
            ): Promise<{ rows: T[] }> => {
              if (text.trim().startsWith('ALTER TYPE')) {
                throw new Error('injected cross-stage ownership failure');
              }
              return client.query<T>(text, values as never);
            },
          };
          await modules.runOwnershipRepairTransaction(injected, repairAdmin);
          return;
        }
        await realRoleManager.adoptAllowlistedObjects(repairAdmin);
      } finally {
        await client.end().catch(() => {});
      }
    },
  };

  const backupManager = {
    backup: async () => {
      const backupDir = path.join(options.backupRoot, `backup-${Date.now()}-${Math.random()}`);
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(path.join(backupDir, 'database.sql'), '-- test backup\n');
      fs.copyFileSync(modules.ConfigManager.getConfigPath(), path.join(backupDir, 'onesoft.config.json'));
      return backupDir;
    },
  };

  const rollbackManager = {
    rollback: async (opts: FakeRollbackCall) => {
      rollbackCalls.push(opts);
      return {
        ok: true,
        databaseRollback: 'not-attempted' as const,
        roleBootstrapRollback: opts.roleBootstrapRollback as 'preserved',
        ownershipRollback: opts.ownershipRollback as 'atomic-rollback',
      };
    },
  };

  const serviceManager = {
    stop: () => ({ success: true }),
    start: () => ({ success: true }),
    getStatus: () => 'not-installed',
  };

  const manager = new modules.UpgradeManager({
    backupManager,
    rollbackManager,
    roleManagerFactory: () => roleManager,
    serviceManager,
    loadMigrationCredential: () => savedCredential ?? null,
    saveMigrationCredential: (credential) => {
      saveCalls += 1;
      if (options.failDpapi) throw new Error('injected DPAPI credential failure');
      savedCredential = credential;
    },
    validateAdminCredential: async () => undefined,
  });

  return { manager, rollbackCalls, getSaveCalls: () => saveCalls, getSavedCredential: () => savedCredential };
}

async function runUpgrade(
  manager: InstanceType<UpgradeManagerModule['UpgradeManager']>,
  adminDbOpts: DatabaseConnectionOptions,
  backendPort: number,
) {
  return manager.upgrade({
    serverAppPath,
    backupsDir: path.join(testRoot, 'backups'),
    dbOpts,
    databaseUrl,
    targetVersion: '1.0.28',
    backendPort,
    adminDbOpts,
    forceRoleProvision: true,
  }, asProgress);
}

async function main(): Promise<void> {
  initCluster();
  await createDatabase();
  await seedLatestSchema();

  const [
    { ConfigManager },
    { UpgradeManager },
    roleModule,
    { chooseUpgradeLaunchMode },
  ] = await Promise.all([
    import('../core/config/ConfigManager.js'),
    import('../core/upgrade/UpgradeManager.js'),
    import('../core/database/DatabaseRoleManager.js'),
    import('../core/upgrade/UpgradeLaunchPolicy.js'),
  ]) as [
    { ConfigManager: ConfigModule['ConfigManager'] },
    { UpgradeManager: UpgradeManagerModule['UpgradeManager'] },
    RoleManagerModule,
    { chooseUpgradeLaunchMode: PolicyModule['chooseUpgradeLaunchMode'] },
  ];

  const configBefore = await createConfig(ConfigManager, 43_000 + (process.pid % 1_000));
  const adminDbOpts = { ...admin, database: dbName };

  const first = createUpgradeDependencies({
    UpgradeManager,
    DatabaseRoleManager: roleModule.DatabaseRoleManager,
    runOwnershipRepairTransaction: roleModule.runOwnershipRepairTransaction,
    ConfigManager,
  }, {
    failOwnershipOnce: true,
    failDpapi: false,
    backupRoot: path.join(testRoot, 'backups-first'),
  });

  const failedOwnership = await runUpgrade(first.manager, adminDbOpts, 43_000 + (process.pid % 1_000));
  assert.equal(failedOwnership.success, false);
  assert.equal(failedOwnership.stage, 'ownership-repair');
  assert.equal(failedOwnership.rollback?.ownershipRollback, 'atomic-rollback');
  assert.equal(failedOwnership.rollback?.roleBootstrapRollback, 'preserved');
  assert.equal(first.rollbackCalls.length, 1, 'UpgradeManager enters rollback after cross-stage failure');
  assert.equal(first.getSaveCalls(), 0, 'DPAPI credential is not saved after ownership failure');
  assert.deepEqual(fs.readFileSync(ConfigManager.getConfigPath()), configBefore, 'original config is restored');
  assert.equal(await roleExists('onesoft_app'), true, 'runtime role remains after committed role bootstrap');
  assert.equal(await roleExists('onesoft_migrator'), true, 'migrator role remains after committed role bootstrap');
  assert.equal(await roleExists('onesoft_schema_owner'), true, 'schema owner role remains after committed role bootstrap');
  assert.equal(await roleMembershipExists(), true, 'role membership remains usable for retry');
  await grantBaselineRuntimeAccess();
  await runtimeCanConnect();
  const ownershipAfterFailure = await ownershipSnapshot();
  assert.notEqual(ownershipAfterFailure.invoiceType, 'onesoft_schema_owner', 'failed ownership repair restored previous type owner');

  backend = startBackend(43_000 + (process.pid % 1_000));
  const oldBackendHealth = await waitForHealth(43_000 + (process.pid % 1_000), backend);
  assert.equal(oldBackendHealth.ready, true, 'previous backend starts after rollback using restored config');
  await stopBackend();

  backend = startBackend(43_000 + (process.pid % 1_000));
  await waitForHealth(43_000 + (process.pid % 1_000), backend);
  const retry = await runUpgrade(first.manager, adminDbOpts, 43_000 + (process.pid % 1_000));
  assert.equal(retry.success, true, 'retry on the same database succeeds idempotently');
  assert.equal(first.getSaveCalls(), 1, 'retry saves DPAPI only after both stages succeed');
  await runtimeCanConnect();
  assert.deepEqual(
    ConfigManager.load().database.password,
    runtimePassword,
    'runtime password remains compatible with restored config',
  );
  await stopBackend();

  const second = createUpgradeDependencies({
    UpgradeManager,
    DatabaseRoleManager: roleModule.DatabaseRoleManager,
    runOwnershipRepairTransaction: roleModule.runOwnershipRepairTransaction,
    ConfigManager,
  }, {
    failOwnershipOnce: false,
    failDpapi: true,
    backupRoot: path.join(testRoot, 'backups-second'),
  });
  const dpapiFailure = await runUpgrade(second.manager, adminDbOpts, 43_000 + (process.pid % 1_000));
  assert.equal(dpapiFailure.success, false);
  assert.equal(dpapiFailure.stage, 'dpapi-credential-create');
  assert.equal(dpapiFailure.rollback?.ownershipRollback, 'preserved');
  assert.equal(second.rollbackCalls.length, 1, 'UpgradeManager rolls back after DPAPI failure');
  assert.equal(second.getSaveCalls(), 1, 'DPAPI save was attempted exactly once');
  assert.equal(second.getSavedCredential(), undefined, 'failed DPAPI save does not create an in-memory credential');
  assert.equal(
    fs.existsSync(path.join(testRoot, 'OneSoft', 'Security', 'migration-credential.bin')),
    false,
    'DPAPI file is absent after injected credential failure',
  );
  assert.equal(chooseUpgradeLaunchMode({
    migrationCredentialValid: false,
    legacyAdminCredentialValid: false,
  }), 'interactive', 'Wizard remains interactive when both DPAPI and Legacy credentials are absent');
  assert.equal(chooseUpgradeLaunchMode({
    migrationCredentialValid: false,
    legacyAdminCredentialValid: true,
  }), 'silent', 'Legacy admin capability may still select silent bootstrap without DPAPI');
  await runtimeCanConnect();

  const secondRetry = createUpgradeDependencies({
    UpgradeManager,
    DatabaseRoleManager: roleModule.DatabaseRoleManager,
    runOwnershipRepairTransaction: roleModule.runOwnershipRepairTransaction,
    ConfigManager,
  }, {
    failOwnershipOnce: false,
    failDpapi: false,
    backupRoot: path.join(testRoot, 'backups-second-retry'),
  });
  backend = startBackend(43_000 + (process.pid % 1_000));
  await waitForHealth(43_000 + (process.pid % 1_000), backend);
  const dpapiRetry = await runUpgrade(secondRetry.manager, adminDbOpts, 43_000 + (process.pid % 1_000));
  assert.equal(dpapiRetry.success, true, 'retry after DPAPI failure completes safely');
  await runtimeCanConnect();
  console.log('CROSS-STAGE FAILURE TESTS: PASS');
}

main()
  .catch((error: unknown) => {
    console.error('[cross-stage] FAILED:', error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopBackend();
    try {
      execFileSync('pg_ctl', ['-D', clusterDir, '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe' });
    } catch {
      // Best effort cleanup if setup failed before the cluster started.
    }
    fs.rmSync(testRoot, { recursive: true, force: true });
  });