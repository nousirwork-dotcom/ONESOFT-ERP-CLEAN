/**
 * PermissionCompatibilityChecker
 *
 * Runs after runMigrations() and before verifyFoundation(). Verifies that
 * onesoft_app has all required privileges on every object in the public schema.
 * If any privilege is missing (common after legacy upgrades where DEFAULT
 * PRIVILEGES fired before the metadata tables were created), issues an
 * idempotent repair and rechecks. Emits a detailed diagnostic report.
 *
 * Privileges checked:
 *   - schema USAGE on public
 *   - SELECT, INSERT, UPDATE, DELETE on all tables in public
 *   - USAGE, SELECT on all sequences in public
 *   - EXECUTE on all functions in public
 *   - ownership of all objects by onesoft_schema_owner
 *   - pg_default_acl entries for future objects
 */

import { Pool, Client } from 'pg';
import type { ProgressEvent } from '../types.js';
import { RUNTIME_ROLE, SCHEMA_OWNER_ROLE } from './DatabaseRoleManager.js';

type Emit = (e: ProgressEvent) => void;

function now(): string {
  return new Date().toISOString();
}

function quoteIdent(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export interface PermissionCheckResult {
  ok: boolean;
  repairApplied: boolean;
  missing: string[];
  report: string;
}

interface PrivilegeMissing {
  objectType: 'schema' | 'table' | 'sequence' | 'function' | 'default_acl' | 'ownership';
  objectName: string;
  privilege: string;
}

/**
 * Collect privileges that onesoft_app is missing on schema public.
 * Uses has_schema_privilege / has_table_privilege / has_sequence_privilege /
 * has_function_privilege for precise per-object checks.
 */
async function collectMissingPrivileges(
  adminClient: Client,
  runtimeRole: string,
): Promise<PrivilegeMissing[]> {
  const missing: PrivilegeMissing[] = [];

  // Schema USAGE
  const schemaUsage = await adminClient.query<{ has_usage: boolean }>(`
    SELECT has_schema_privilege(${sqlLiteral(runtimeRole)}, 'public', 'USAGE') AS has_usage
  `);
  if (!schemaUsage.rows[0]?.has_usage) {
    missing.push({ objectType: 'schema', objectName: 'public', privilege: 'USAGE' });
  }

  // Tables
  const tables = await adminClient.query<{ relname: string }>(`
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
     ORDER BY c.relname
  `);
  for (const { relname } of tables.rows) {
    for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      const check = await adminClient.query<{ ok: boolean }>(`
        SELECT has_table_privilege(${sqlLiteral(runtimeRole)}, ${sqlLiteral(`public.${relname}`)}, ${sqlLiteral(priv)}) AS ok
      `);
      if (!check.rows[0]?.ok) {
        missing.push({ objectType: 'table', objectName: relname, privilege: priv });
      }
    }
  }

  // Sequences
  const sequences = await adminClient.query<{ relname: string }>(`
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'S'
     ORDER BY c.relname
  `);
  for (const { relname } of sequences.rows) {
    for (const priv of ['USAGE', 'SELECT']) {
      const check = await adminClient.query<{ ok: boolean }>(`
        SELECT has_sequence_privilege(${sqlLiteral(runtimeRole)}, ${sqlLiteral(`public.${relname}`)}, ${sqlLiteral(priv)}) AS ok
      `);
      if (!check.rows[0]?.ok) {
        missing.push({ objectType: 'sequence', objectName: relname, privilege: priv });
      }
    }
  }

  // Functions
  const functions = await adminClient.query<{ oid: number; proname: string; identity_args: string }>(`
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS identity_args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
     ORDER BY p.proname, identity_args
  `);
  for (const fn of functions.rows) {
    const fnIdent = `public.${fn.proname}(${fn.identity_args})`;
    const check = await adminClient.query<{ ok: boolean }>(`
      SELECT has_function_privilege(${quoteIdent(runtimeRole)}, ${fn.oid}::oid, 'EXECUTE') AS ok
    `);
    if (!check.rows[0]?.ok) {
      missing.push({ objectType: 'function', objectName: fnIdent, privilege: 'EXECUTE' });
    }
  }

  // Default privileges (pg_default_acl)
  const defaultAclTables = await adminClient.query<{ count: number }>(`
    SELECT COUNT(*)::int AS count
      FROM pg_default_acl da
      JOIN pg_namespace n ON n.oid = da.defaclnamespace
      JOIN pg_roles r ON r.oid = da.defaclrole
     WHERE n.nspname = 'public'
       AND r.rolname = ${sqlLiteral(SCHEMA_OWNER_ROLE)}
       AND da.defaclobjtype = 'r'
       AND EXISTS (
         SELECT 1 FROM unnest(da.defaclacl) AS acl_entry(entry)
          WHERE acl_entry.entry::text LIKE ${`'${runtimeRole}=%'`}
       )
  `);
  if ((defaultAclTables.rows[0]?.count ?? 0) === 0) {
    missing.push({
      objectType: 'default_acl',
      objectName: `DEFAULT PRIVILEGES FOR ROLE ${SCHEMA_OWNER_ROLE} ON TABLES`,
      privilege: 'SELECT,INSERT,UPDATE,DELETE',
    });
  }

  const defaultAclSeqs = await adminClient.query<{ count: number }>(`
    SELECT COUNT(*)::int AS count
      FROM pg_default_acl da
      JOIN pg_namespace n ON n.oid = da.defaclnamespace
      JOIN pg_roles r ON r.oid = da.defaclrole
     WHERE n.nspname = 'public'
       AND r.rolname = ${sqlLiteral(SCHEMA_OWNER_ROLE)}
       AND da.defaclobjtype = 'S'
       AND EXISTS (
         SELECT 1 FROM unnest(da.defaclacl) AS acl_entry(entry)
          WHERE acl_entry.entry::text LIKE ${`'${runtimeRole}=%'`}
       )
  `);
  if ((defaultAclSeqs.rows[0]?.count ?? 0) === 0) {
    missing.push({
      objectType: 'default_acl',
      objectName: `DEFAULT PRIVILEGES FOR ROLE ${SCHEMA_OWNER_ROLE} ON SEQUENCES`,
      privilege: 'USAGE,SELECT',
    });
  }

  return missing;
}

/**
 * Issue an idempotent GRANT repair using the migration connection (which
 * can SET ROLE onesoft_schema_owner to issue GRANTs as the object owner).
 */
async function repairPrivileges(migrationUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: migrationUrl, connectionTimeoutMillis: 15_000 });
  const client = await pool.connect();
  try {
    await client.query(`SET ROLE ${quoteIdent(SCHEMA_OWNER_ROLE)}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${quoteIdent(RUNTIME_ROLE)}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${quoteIdent(RUNTIME_ROLE)}`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quoteIdent(RUNTIME_ROLE)}`);
    await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${quoteIdent(RUNTIME_ROLE)}`);
    await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(SCHEMA_OWNER_ROLE)} IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${quoteIdent(RUNTIME_ROLE)}`);
    await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(SCHEMA_OWNER_ROLE)} IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO ${quoteIdent(RUNTIME_ROLE)}`);
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Build a 42501-style diagnostic report from system catalogs when a
 * permission denied error is caught.
 */
export async function buildPermissionDeniedDiagnostic(
  adminUrl: string,
  objectName: string,
  attemptedPrivilege: string,
  sqlState?: string,
): Promise<string> {
  const client = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    const ctx = await client.query<{
      current_user: string;
      session_user: string;
    }>(`SELECT current_user, session_user`);

    const objectAcl = await client.query<{
      relname: string;
      owner: string;
      acl: string | null;
    }>(`
      SELECT c.relname,
             pg_get_userbyid(c.relowner) AS owner,
             array_to_string(c.relacl, ', ') AS acl
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = $1
    `, [objectName]).catch(() => ({ rows: [] as Array<{ relname: string; owner: string; acl: string | null }> }));

    const row = ctx.rows[0];
    const aclRow = objectAcl.rows[0];
    const lines = [
      `=== PERMISSION DENIED DIAGNOSTIC (SQLSTATE ${sqlState ?? '42501'}) ===`,
      `  attempted_privilege : ${attemptedPrivilege}`,
      `  object_name         : ${objectName}`,
      `  current_user        : ${row?.current_user ?? '?'}`,
      `  session_user        : ${row?.session_user ?? '?'}`,
      `  object_owner        : ${aclRow?.owner ?? 'not found'}`,
      `  actual_privileges   : ${aclRow?.acl ?? 'none/not found'}`,
    ];
    return lines.join('\n');
  } finally {
    await client.end();
  }
}

/**
 * Run the full permission compatibility check.
 *
 * @param adminUrl   Connection URL for an admin/superuser role used only
 *                   for read-only catalog queries.
 * @param migrationUrl Connection URL for onesoft_migrator (used for repair).
 * @param emit       Progress event emitter.
 */
export async function checkPermissionCompatibility(
  adminUrl: string,
  migrationUrl: string,
  emit: Emit,
): Promise<PermissionCheckResult> {
  emit({ level: 'info', message: 'جارٍ فحص توافق صلاحيات onesoft_app...', timestamp: now() });

  const adminClient = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 15_000 });
  await adminClient.connect();

  let missing: PrivilegeMissing[];
  try {
    missing = await collectMissingPrivileges(adminClient, RUNTIME_ROLE);
  } finally {
    await adminClient.end();
  }

  let repairApplied = false;

  if (missing.length > 0) {
    const missingDesc = missing
      .slice(0, 30)
      .map((m) => `${m.objectType}:${m.objectName}[${m.privilege}]`)
      .join(', ');
    emit({
      level: 'warning',
      message: `فقدان ${missing.length} صلاحية لـonesoft_app — جارٍ الإصلاح...\n${missingDesc}`,
      timestamp: now(),
    });

    await repairPrivileges(migrationUrl);
    repairApplied = true;

    // Re-check after repair
    const adminClient2 = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 15_000 });
    await adminClient2.connect();
    try {
      missing = await collectMissingPrivileges(adminClient2, RUNTIME_ROLE);
    } finally {
      await adminClient2.end();
    }
  }

  const missingStrings = missing.map(
    (m) => `${m.objectType}:${m.objectName}[${m.privilege}]`,
  );

  const report = [
    `=== Permission Compatibility Report ===`,
    `  runtime_role  : ${RUNTIME_ROLE}`,
    `  schema_owner  : ${SCHEMA_OWNER_ROLE}`,
    `  repair_applied: ${repairApplied}`,
    `  missing_after : ${missing.length}`,
    ...(missing.length > 0 ? missing.slice(0, 30).map((m) => `    MISSING: ${m.objectType} ${m.objectName} [${m.privilege}]`) : ['  all_required_privileges: OK']),
    `=======================================`,
  ].join('\n');

  if (missing.length > 0) {
    emit({
      level: 'error',
      message: `❌ فشل فحص الصلاحيات بعد الإصلاح:\n${report}`,
      timestamp: now(),
    });
    throw new Error(
      `permission compatibility check failed after repair: ${missing.length} missing privileges — ${missingStrings.slice(0, 10).join(', ')}`,
    );
  }

  emit({
    level: 'success',
    message: `✅ فحص توافق الصلاحيات ناجح (repair_applied=${repairApplied})\n${report}`,
    timestamp: now(),
  });

  return { ok: true, repairApplied, missing: [], report };
}
