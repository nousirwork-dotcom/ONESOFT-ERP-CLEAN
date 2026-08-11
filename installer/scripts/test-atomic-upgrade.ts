import assert from 'node:assert/strict';
import {
  runOwnershipRepairTransaction,
  runRoleBootstrapTransaction,
  provisionRepairThenSaveCredential,
  type TransactionClient,
  type ProvisionedRoles,
} from '../core/database/DatabaseRoleManager.js';
import type { DatabaseConnectionOptions } from '../core/types.js';

type FakeState = {
  roles: Set<string>;
  grants: Set<string>;
  ownership: Map<string, string>;
};

function cloneState(state: FakeState): FakeState {
  return {
    roles: new Set(state.roles),
    grants: new Set(state.grants),
    ownership: new Map(state.ownership),
  };
}

function stateSnapshot(state: FakeState): string {
  return JSON.stringify({
    roles: [...state.roles].sort(),
    grants: [...state.grants].sort(),
    ownership: [...state.ownership.entries()].sort(),
  });
}

class FakeTransactionClient implements TransactionClient {
  readonly queries: string[] = [];
  private checkpoint: FakeState | null = null;
  private mutations = 0;

  constructor(
    readonly state: FakeState,
    private readonly failOnMutation: number | null = null,
  ) {}

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    _values?: unknown[],
  ): Promise<{ rows: T[] }> {
    const sql = text.trim();
    this.queries.push(sql);

    if (sql === 'BEGIN') {
      this.checkpoint = cloneState(this.state);
      this.mutations = 0;
      return { rows: [] as T[] };
    }
    if (sql === 'ROLLBACK') {
      assert.ok(this.checkpoint, 'ROLLBACK must follow BEGIN');
      this.state.roles = new Set(this.checkpoint.roles);
      this.state.grants = new Set(this.checkpoint.grants);
      this.state.ownership = new Map(this.checkpoint.ownership);
      this.checkpoint = null;
      return { rows: [] as T[] };
    }
    if (sql === 'COMMIT') {
      assert.ok(this.checkpoint, 'COMMIT must follow BEGIN');
      this.checkpoint = null;
      return { rows: [] as T[] };
    }
    if (sql.startsWith('SELECT')) {
      if (sql.includes('seq.relname')) {
        return { rows: [{ relname: 'orders_id_seq' } as T] };
      }
      if (sql.includes('pg_get_function_identity_arguments')) {
        return { rows: [{ identity: 'text' } as T] };
      }
      return { rows: [{ exists: true } as T] };
    }

    this.mutations += 1;
    if (this.failOnMutation === this.mutations) {
      throw new Error(`injected failure at mutation ${this.mutations}`);
    }

    const roles = [
      'onesoft_schema_owner',
      'onesoft_migrator',
      'onesoft_app',
    ];
    for (const role of roles) {
      if (sql.includes(`"${role}"`)) this.state.roles.add(role);
    }
    if (sql.startsWith('GRANT')) this.state.grants.add(sql);
    if (sql.startsWith('ALTER SCHEMA')) this.state.ownership.set('schema:public', 'onesoft_schema_owner');
    if (sql.startsWith('ALTER TABLE')) this.state.ownership.set(sql, 'onesoft_schema_owner');
    if (sql.startsWith('ALTER SEQUENCE')) this.state.ownership.set(sql, 'onesoft_schema_owner');
    if (sql.startsWith('ALTER TYPE')) this.state.ownership.set(sql, 'onesoft_schema_owner');
    if (sql.startsWith('ALTER FUNCTION')) this.state.ownership.set(sql, 'onesoft_schema_owner');
    return { rows: [] as T[] };
  }
}

const admin: DatabaseConnectionOptions = {
  host: 'localhost',
  port: 5432,
  database: 'onesoft_atomic_test',
  user: 'postgres',
  password: 'not-used',
};

async function testRoleBootstrapAtomicity(): Promise<void> {
  const state: FakeState = {
    roles: new Set(),
    grants: new Set(),
    ownership: new Map(),
  };
  const before = stateSnapshot(state);
  const client = new FakeTransactionClient(state, 5);

  await assert.rejects(
    runRoleBootstrapTransaction(client, admin.database, 'runtime-password', 'migration-password'),
    /injected failure/,
  );

  assert.equal(stateSnapshot(state), before, 'role bootstrap failure restores roles and grants');
  assert.ok(client.queries.includes('BEGIN'), 'role bootstrap starts a transaction');
  assert.ok(client.queries.includes('ROLLBACK'), 'role bootstrap rolls back on failure');
  assert.ok(!client.queries.includes('COMMIT'), 'failed role bootstrap never commits');

  const retry = new FakeTransactionClient(state);
  await runRoleBootstrapTransaction(retry, admin.database, 'runtime-password', 'migration-password');
  const afterFirstSuccess = stateSnapshot(state);
  await runRoleBootstrapTransaction(retry, admin.database, 'runtime-password', 'migration-password');
  assert.equal(stateSnapshot(state), afterFirstSuccess, 'role bootstrap retry is idempotent');
}

async function testOwnershipRepairAtomicity(): Promise<void> {
  const state: FakeState = {
    roles: new Set(['onesoft_schema_owner', 'onesoft_migrator', 'onesoft_app']),
    grants: new Set(['legacy-grant']),
    ownership: new Map([
      ['schema:public', 'legacy-owner'],
      ['legacy-table', 'legacy-owner'],
    ]),
  };
  const before = stateSnapshot(state);
  const client = new FakeTransactionClient(state, 7);

  await assert.rejects(
    runOwnershipRepairTransaction(client, admin),
    /injected failure/,
  );

  assert.equal(stateSnapshot(state), before, 'ownership repair failure restores every ownership and grant');
  assert.ok(client.queries.includes('BEGIN'), 'ownership repair starts a transaction');
  assert.ok(client.queries.includes('ROLLBACK'), 'ownership repair rolls back on failure');
  assert.ok(!client.queries.includes('COMMIT'), 'failed ownership repair never commits');

  const retry = new FakeTransactionClient(state);
  await runOwnershipRepairTransaction(retry, admin);
  const afterFirstSuccess = stateSnapshot(state);
  await runOwnershipRepairTransaction(retry, admin);
  assert.equal(stateSnapshot(state), afterFirstSuccess, 'ownership repair retry is idempotent');
}

async function testCredentialIsLast(): Promise<void> {
  const credential: ProvisionedRoles = {
    appPassword: 'runtime-password',
    migration: {
      ...admin,
      user: 'onesoft_migrator',
      password: 'migration-password',
      role: 'onesoft_migrator',
      createdByVersion: 'test',
    },
  };
  let saved = 0;

  await assert.rejects(
    provisionRepairThenSaveCredential(
      async () => credential,
      async () => { throw new Error('ownership stage failed'); },
      () => { saved += 1; },
    ),
    /ownership stage failed/,
  );
  assert.equal(saved, 0, 'DPAPI save is not called after ownership failure');

  await assert.rejects(
    provisionRepairThenSaveCredential(
      async () => { throw new Error('role stage failed'); },
      async () => undefined,
      () => { saved += 1; },
    ),
    /role stage failed/,
  );
  assert.equal(saved, 0, 'DPAPI save is not called after role-bootstrap failure');

  await provisionRepairThenSaveCredential(
    async () => credential,
    async () => undefined,
    () => { saved += 1; },
  );
  assert.equal(saved, 1, 'DPAPI save is called once after both stages succeed');
}

async function main(): Promise<void> {
  await testRoleBootstrapAtomicity();
  console.log('PASS: atomic role bootstrap rollback and retry');
  await testOwnershipRepairAtomicity();
  console.log('PASS: atomic ownership repair rollback and retry');
  await testCredentialIsLast();
  console.log('PASS: DPAPI credential persistence is last');
  console.log('ALL ATOMIC UPGRADE TESTS: PASS');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});