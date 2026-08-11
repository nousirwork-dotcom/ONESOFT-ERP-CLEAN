import { Client } from 'pg';
import type { DatabaseConnectionOptions } from '../types.js';
import { MigrationCredentialStore } from '../security/MigrationCredentialStore.js';
import {
  TABLE_ALLOWLIST, TYPE_ALLOWLIST, SCHEMA_OWNER_ROLE,
} from './DatabaseRoleManager.js';

export interface DatabasePreflightResult {
  ok: boolean;
  currentUser?: string;
  databaseOwner?: string;
  currentSchemaVersion?: string | null;
  appliedMigrations: string[];
  pendingMigration?: string | null;
  invoiceTypeOwner?: string | null;
  migratorRoleExists: boolean;
  schemaOwnerRoleExists: boolean;
  canSetSchemaOwner: boolean;
  canCreateRole: boolean;
  ownershipDrift: string[];
  ledgerDrift: string[];
  drift: string[];
  error?: string;
}

const quoteIdent = (value: string) => `"${value.replaceAll('"', '""')}"`;

/**
 * Read-only credential probe used before any backup or role DDL.
 * The caller classifies the error for the user; this function deliberately
 * does not log connection options or PostgreSQL error details.
 */
export async function validateAdminCredential(
  admin: DatabaseConnectionOptions,
): Promise<void> {
  const client = new Client({
    ...admin,
    database: 'postgres',
    connectionTimeoutMillis: 15_000,
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
  } finally {
    await client.end().catch(() => {});
  }
}

export async function preflightDatabase(
  db: DatabaseConnectionOptions,
  migrationTags: string[],
): Promise<DatabasePreflightResult> {
  const client = new Client({ ...db, connectionTimeoutMillis: 15_000 });
  const result: DatabasePreflightResult = {
    ok: false,
    appliedMigrations: [],
    migratorRoleExists: false,
    schemaOwnerRoleExists: false,
    canSetSchemaOwner: false,
    canCreateRole: false,
    ownershipDrift: [],
    ledgerDrift: [],
    drift: [],
  };

  try {
    await client.connect();
    const identity = await client.query<{
      current_user: string; database_owner: string; can_create_role: boolean;
    }>(`
      SELECT current_user,
             pg_get_userbyid(d.datdba) AS database_owner,
             (SELECT rolsuper OR rolcreaterole FROM pg_roles WHERE rolname = current_user) AS can_create_role
        FROM pg_database d
       WHERE d.datname = current_database()
    `);
    result.currentUser = identity.rows[0]?.current_user;
    result.databaseOwner = identity.rows[0]?.database_owner;
    result.canCreateRole = identity.rows[0]?.can_create_role === true;

    const roles = await client.query<{ rolname: string }>(
      `SELECT rolname FROM pg_roles WHERE rolname IN ('onesoft_migrator', 'onesoft_schema_owner')`,
    );
    result.migratorRoleExists = roles.rows.some((r) => r.rolname === 'onesoft_migrator');
    result.schemaOwnerRoleExists = roles.rows.some((r) => r.rolname === 'onesoft_schema_owner');
    result.canSetSchemaOwner = (await client.query<{ allowed: boolean }>(
      `SELECT pg_has_role(current_user, 'onesoft_schema_owner', 'member') AS allowed`,
    )).rows[0]?.allowed === true;

    const version = await client.query<{ version: string }>(
      `SELECT version FROM _schema_version WHERE id = 1`,
    ).catch(() => ({ rows: [] as { version: string }[] }));
    result.currentSchemaVersion = version.rows[0]?.version ?? null;

    const ledger = await client.query<{ tag: string }>(
      `SELECT tag FROM __drizzle_migrations ORDER BY id`,
    ).catch(() => ({ rows: [] as { tag: string }[] }));
    result.appliedMigrations = ledger.rows.map((row) => row.tag);
    result.pendingMigration = migrationTags.find((tag) => !result.appliedMigrations.includes(tag)) ?? null;
    const expectedPrefix = migrationTags.slice(
      0,
      result.appliedMigrations.length,
    );
    const appliedSet = new Set(result.appliedMigrations);
    const unknownApplied = result.appliedMigrations.filter((tag) => !migrationTags.includes(tag));
    const outOfOrder = result.appliedMigrations.some((tag, index) => {
      const expected = expectedPrefix[index];
      return expected !== undefined && tag !== expected;
    });
    result.ledgerDrift = [
      ...unknownApplied.map((tag) => `unknown migration ledger entry: ${tag}`),
      ...(outOfOrder ? ['migration ledger is not a contiguous prefix'] : []),
      ...(result.currentSchemaVersion && !migrationTags.includes(result.currentSchemaVersion)
        ? [`unknown schema stamp: ${result.currentSchemaVersion}`]
        : []),
    ];

    const enumOwner = await client.query<{ owner: string | null }>(`
      SELECT pg_get_userbyid(t.typowner) AS owner
        FROM pg_type t
       WHERE t.typnamespace = 'public'::regnamespace AND t.typname = 'invoice_type'
    `).catch(() => ({ rows: [] as { owner: string | null }[] }));
    result.invoiceTypeOwner = enumOwner.rows[0]?.owner ?? null;

    const tableOwners = await client.query<{ relname: string; owner: string }>(
      `SELECT c.relname, pg_get_userbyid(c.relowner) AS owner
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'S')
          AND c.relname = ANY($1::text[])
          AND pg_get_userbyid(c.relowner) <> $2`,
      [TABLE_ALLOWLIST, SCHEMA_OWNER_ROLE],
    );
    const typeOwners = await client.query<{ typname: string; owner: string }>(
      `SELECT t.typname, pg_get_userbyid(t.typowner) AS owner
         FROM pg_type t
         JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = ANY($1::text[])
          AND pg_get_userbyid(t.typowner) <> $2`,
      [TYPE_ALLOWLIST, SCHEMA_OWNER_ROLE],
    );
    const schemaOwner = await client.query<{ owner: string }>(
      `SELECT pg_get_userbyid(nspowner) AS owner
         FROM pg_namespace
        WHERE nspname = 'public'`,
    );
    result.ownershipDrift = [
      ...(schemaOwner.rows[0]?.owner && schemaOwner.rows[0].owner !== SCHEMA_OWNER_ROLE
        ? [`schema public owned by ${schemaOwner.rows[0].owner}`]
        : []),
      ...tableOwners.rows.map((row) => `${row.relname} owned by ${row.owner}`),
      ...typeOwners.rows.map((row) => `${row.typname} owned by ${row.owner}`),
    ];

    if (!result.migratorRoleExists || !result.schemaOwnerRoleExists) {
      result.drift.push('OneSoft migration roles are missing');
    }
    if (result.pendingMigration) {
      result.drift.push(`pending migration: ${result.pendingMigration}`);
    }
    if (result.invoiceTypeOwner && result.invoiceTypeOwner !== 'onesoft_schema_owner') {
      result.drift.push(`invoice_type owner: ${result.invoiceTypeOwner}`);
    }
    result.drift.push(...result.ownershipDrift);
    result.drift.push(...result.ledgerDrift);
    result.ok = true;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  } finally {
    await client.end().catch(() => {});
  }
}

export function migrationConnection(
  credential: DatabaseConnectionOptions,
): string {
  return `postgresql://${encodeURIComponent(credential.user)}:${encodeURIComponent(credential.password)}@${credential.host}:${credential.port}/${encodeURIComponent(credential.database)}`;
}

export function safeMigrationError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://***')
    .replace(/password authentication failed for user ".*?"/gi, 'database authentication failed')
    .replace(/(password|secret|token|credential|api[-_]?key|private[-_]?key)\s*[:=]\s*\S+/gi, '$1=***');
}

export { MigrationCredentialStore, quoteIdent };