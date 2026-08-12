import { Pool } from 'pg';
import { randomBytes } from 'crypto';
import { Client } from 'pg';
import type { DatabaseConnectionOptions } from '../types.js';
import { MigrationCredentialStore, type MigrationCredential } from '../security/MigrationCredentialStore.js';
import { APP_VERSION } from '../version.js';

export const RUNTIME_ROLE = 'onesoft_app';
export const SCHEMA_OWNER_ROLE = 'onesoft_schema_owner';
export const MIGRATOR_ROLE = 'onesoft_migrator';

export const TABLE_ALLOWLIST = [
  '__drizzle_migrations','_schema_version',
  'organizations','users','user_groups','user_categories','user_group_members','branches','warehouses',
  'warehouse_account_links','units','product_groups','products','customers','suppliers','chart_of_accounts',
  'sales_invoices','sales_invoice_items','purchase_invoices','purchase_invoice_items','journal_entries',
  'journal_entry_lines','vouchers','receipt_vouchers','payment_vouchers','inventory','stock_vouchers',
  'stock_voucher_items','inventory_counts','inventory_count_items','free_products','messages','document_journals',
  'document_types','document_templates','cost_centers','qr_settings','document_send_logs','waba_message_templates',
  'send_settings','app_settings','currencies','posting_definitions','posting_definition_lines','field_dictionary',
  'payment_methods','sales_invoice_payments','zatca_environments','zatca_devices','zatca_certificates','zatca_csid',
  'zatca_keys','zatca_csr_requests','zatca_invoice_transactions','zatca_request_log','zatca_response_log',
  'zatca_error_log','zatca_xml_documents','zatca_qr_codes','zatca_settings','zatca_api_history',
  'verification_tokens','password_reset_tokens','security_events','re_purchases','re_purchase_statements',
  'user_warehouse_assignments','user_audit_logs','user_group_migration_log','re_documents','re_document_types',
  're_document_versions','re_housing_units','re_projects','re_trial_balances','re_tb_accounts','re_tb_entries',
  're_tb_purchase_links','re_tb_audit_log','re_tb_settlements','re_tb_tax_returns','re_purchases',
  're_purchase_statements','pending_account_movements','pending_stock_movements','tax_definitions',
  'foundation_tombstones','zatca_pos_units','zatca_submission_queue','zatca_submission_attempts',
  'zatca_clock_states','zatca_clock_events','zatca_clock_policy','zatca_compliance_tests',
  'zatca_compliance_fixtures','zatca_compliance_fixture_items','zatca_readiness_settings',
  'zatca_unit_lifecycle_events','ai_settings','ai_conversations','ai_messages','ai_action_proposals','ai_audit_logs',
  'lc_clients','lc_devices','lc_licenses','lc_operations_log','lc_support_tickets','lc_support_ticket_messages',
  'lc_support_ticket_attachments','lc_support_ticket_notes','support_tickets_local','support_ticket_messages_local',
  'support_ticket_attachments_local',
  'hs_tasks','hs_custody_entries','hs_custody_records','hs_link_sections','hs_links',
  'user_branch_assignments','zatca_logs',
] as const;

/** OneSoft sequences which are not owned automatically by a serial/identity column. */
export const SEQUENCE_ALLOWLIST = ['support_ticket_seq'] as const;

export const TYPE_ALLOWLIST = [
  'inventory_count_status','invoice_status','invoice_type','journal_status','org_status','payment_method',
  'stock_voucher_type','user_role','voucher_type','pending_movement_status','lc_device_status',
  'lc_license_status','lc_license_type','lc_op_type',
] as const;

export const FUNCTION_ALLOWLIST = ['update_re_purchase_statements_timestamp'] as const;

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;

export type OwnershipObjectType = 'schema' | 'relation' | 'sequence' | 'type' | 'function';

export interface OwnershipTarget {
  schema: string;
  objectName: string;
  objectType: OwnershipObjectType;
  currentOwner: string;
  expectedOwner: typeof SCHEMA_OWNER_ROLE;
  identityArguments?: string;
}

/**
 * The ownership scope is deliberately allowlisted. PostgreSQL exposes many
 * public objects which are not OneSoft objects (extension objects, catalog
 * support objects, and composite row types generated for tables). Both the
 * repair and the read-only preflight call this same discovery function so
 * they cannot disagree about what should be owned by OneSoft.
 */
export async function getOneSoftOwnershipTargets(
  client: TransactionClient,
): Promise<OwnershipTarget[]> {
  const result = await client.query<{
    schema_name: string;
    object_name: string;
    object_type: OwnershipObjectType;
    current_owner: string;
    identity_arguments: string | null;
  }>(`
    SELECT schema_name, object_name, object_type, current_owner, identity_arguments
      FROM (
        SELECT n.nspname AS schema_name,
               n.nspname AS object_name,
               'schema'::text AS object_type,
               pg_get_userbyid(n.nspowner) AS current_owner,
               NULL::text AS identity_arguments
          FROM pg_namespace n
         WHERE n.nspname = 'public'

        UNION ALL

        SELECT n.nspname,
               c.relname,
               'relation'::text,
               pg_get_userbyid(c.relowner),
               NULL::text
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relkind IN ('r', 'p')
           AND c.relname = ANY($1::text[])

        UNION ALL

        SELECT n.nspname,
               c.relname,
               'sequence'::text,
               pg_get_userbyid(c.relowner),
               NULL::text
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relkind = 'S'
           AND (
             c.relname = ANY($2::text[])
             OR EXISTS (
               SELECT 1
                 FROM pg_depend dep
                 JOIN pg_class table_obj ON table_obj.oid = dep.refobjid
                WHERE dep.objid = c.oid
                  AND dep.deptype = 'a'
                  AND table_obj.relnamespace = n.oid
                  AND table_obj.relkind IN ('r', 'p')
                  AND table_obj.relname = ANY($1::text[])
             )
           )

        UNION ALL

        SELECT n.nspname,
               t.typname,
               'type'::text,
               pg_get_userbyid(t.typowner),
               NULL::text
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public'
           AND t.typtype <> 'c'
           AND t.typname = ANY($3::text[])

        UNION ALL

        SELECT n.nspname,
               p.proname,
               'function'::text,
               pg_get_userbyid(p.proowner),
               pg_get_function_identity_arguments(p.oid)
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = ANY($4::text[])
      ) AS onesoft_objects
     ORDER BY object_type, object_name, identity_arguments NULLS FIRST
  `, [TABLE_ALLOWLIST, SEQUENCE_ALLOWLIST, TYPE_ALLOWLIST, FUNCTION_ALLOWLIST]);

  return result.rows.map((row) => ({
    schema: row.schema_name,
    objectName: row.object_name,
    objectType: row.object_type,
    currentOwner: row.current_owner,
    expectedOwner: SCHEMA_OWNER_ROLE,
    ...(row.identity_arguments !== null ? { identityArguments: row.identity_arguments } : {}),
  }));
}

function randomPassword(): string {
  return randomBytes(32).toString('base64url');
}

export interface ProvisionedRoles {
  appPassword: string;
  migration: MigrationCredential;
}

export interface TransactionClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export interface ProvisionOptions {
  preserveRuntimePassword?: boolean;
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function rollbackTransaction(client: TransactionClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original PostgreSQL error.
  }
}

/**
 * PostgreSQL role DDL is transactional. Keeping this whole batch on one
 * connection means a failure cannot leave a newly-created role, membership,
 * grant, or role attribute from this bootstrap attempt.
 */
export async function runRoleBootstrapTransaction(
  client: TransactionClient,
  dbName: string,
  appPassword: string,
  migrationPassword: string,
  options: ProvisionOptions = {},
): Promise<void> {
  await client.query('BEGIN');
  try {
    const appLiteral = sqlLiteral(appPassword);
    const migrationLiteral = sqlLiteral(migrationPassword);

    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${SCHEMA_OWNER_ROLE}') THEN
        CREATE ROLE ${quote(SCHEMA_OWNER_ROLE)} NOLOGIN;
      END IF;
    END $$;`);
    await client.query(`ALTER ROLE ${quote(SCHEMA_OWNER_ROLE)} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${MIGRATOR_ROLE}') THEN
        CREATE ROLE ${quote(MIGRATOR_ROLE)} LOGIN PASSWORD ${migrationLiteral};
      ELSE
        ALTER ROLE ${quote(MIGRATOR_ROLE)} LOGIN PASSWORD ${migrationLiteral};
      END IF;
    END $$;`);
    if (options.preserveRuntimePassword) {
      await client.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RUNTIME_ROLE}') THEN
          CREATE ROLE ${quote(RUNTIME_ROLE)} LOGIN PASSWORD ${appLiteral};
        END IF;
      END $$;`);
    } else {
      await client.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RUNTIME_ROLE}') THEN
          CREATE ROLE ${quote(RUNTIME_ROLE)} LOGIN PASSWORD ${appLiteral};
        ELSE
          ALTER ROLE ${quote(RUNTIME_ROLE)} LOGIN PASSWORD ${appLiteral};
        END IF;
      END $$;`);
    }
    await client.query(`GRANT ${quote(SCHEMA_OWNER_ROLE)} TO ${quote(MIGRATOR_ROLE)}`);
    await client.query(`GRANT CONNECT ON DATABASE ${quote(dbName)} TO ${quote(MIGRATOR_ROLE)}, ${quote(RUNTIME_ROLE)}`);
    await client.query(`ALTER DATABASE ${quote(dbName)} OWNER TO ${quote(SCHEMA_OWNER_ROLE)}`);
    await client.query(`ALTER ROLE ${quote(MIGRATOR_ROLE)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
    await client.query(`ALTER ROLE ${quote(RUNTIME_ROLE)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
    await client.query('COMMIT');
  } catch (error: unknown) {
    await rollbackTransaction(client);
    throw error;
  }
}

/**
 * Ownership repair is a separate transaction because PostgreSQL cannot make
 * DDL on the `postgres` database and DDL on the application database one
 * cross-database transaction. Every ownership/privilege change in the target
 * database is nevertheless atomic.
 */
export async function runOwnershipRepairTransaction(
  client: TransactionClient,
  admin: DatabaseConnectionOptions,
): Promise<void> {
  await client.query('BEGIN');
  try {
    const targets = await getOneSoftOwnershipTargets(client);
    const schemaTarget = targets.find((target) => target.objectType === 'schema');
    if (schemaTarget && schemaTarget.currentOwner !== SCHEMA_OWNER_ROLE) {
      await client.query(`ALTER SCHEMA ${quote(schemaTarget.schema)} OWNER TO ${quote(SCHEMA_OWNER_ROLE)}`);
    }
    await client.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
    await client.query(`REVOKE CREATE ON DATABASE ${quote(admin.database)} FROM PUBLIC`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${quote(MIGRATOR_ROLE)}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${quote(RUNTIME_ROLE)}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${quote(RUNTIME_ROLE)}`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quote(RUNTIME_ROLE)}`);
    await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${quote(RUNTIME_ROLE)}`);
    await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quote(SCHEMA_OWNER_ROLE)} IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${quote(RUNTIME_ROLE)}`);
    await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quote(SCHEMA_OWNER_ROLE)} IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO ${quote(RUNTIME_ROLE)}`);

    for (const target of targets) {
      if (target.currentOwner === SCHEMA_OWNER_ROLE || target.objectType === 'schema') continue;
      if (target.objectType === 'relation') {
        await client.query(`ALTER TABLE ${quote(target.schema)}.${quote(target.objectName)} OWNER TO ${quote(SCHEMA_OWNER_ROLE)}`);
      } else if (target.objectType === 'sequence') {
        await client.query(`ALTER SEQUENCE ${quote(target.schema)}.${quote(target.objectName)} OWNER TO ${quote(SCHEMA_OWNER_ROLE)}`);
      } else if (target.objectType === 'type') {
        await client.query(`ALTER TYPE ${quote(target.schema)}.${quote(target.objectName)} OWNER TO ${quote(SCHEMA_OWNER_ROLE)}`);
      } else if (target.objectType === 'function') {
        await client.query(
          `ALTER FUNCTION ${quote(target.schema)}.${quote(target.objectName)}(${target.identityArguments ?? ''}) OWNER TO ${quote(SCHEMA_OWNER_ROLE)}`,
        );
      }
    }
    await client.query('COMMIT');
  } catch (error: unknown) {
    await rollbackTransaction(client);
    throw error;
  }
}

/**
 * The DPAPI callback is intentionally last. This small orchestration helper
 * is also used by the focused atomicity tests.
 */
export async function provisionRepairThenSaveCredential(
  provision: () => Promise<ProvisionedRoles>,
  repair: () => Promise<void>,
  save: (credential: MigrationCredential) => void,
): Promise<ProvisionedRoles> {
  const provisioned = await provision();
  await repair();
  save(provisioned.migration);
  return provisioned;
}

export class DatabaseRoleManager {
  async provision(
    admin: DatabaseConnectionOptions,
    dbName: string,
    appPassword = randomPassword(),
    options: ProvisionOptions = {},
  ): Promise<ProvisionedRoles> {
    const migrationPassword = randomPassword();
    const pool = new Pool({ ...admin, database: 'postgres', connectionTimeoutMillis: 15_000 });
    const client = await pool.connect();
    try {
      if (options.preserveRuntimePassword) {
        const runtimeRole = await client.query<{ exists: boolean }>(
          `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists`,
          [RUNTIME_ROLE],
        );
        if (runtimeRole.rows[0]?.exists === true) {
          const runtimeClient = new Client({
            ...admin,
            database: dbName,
            user: RUNTIME_ROLE,
            password: appPassword,
            connectionTimeoutMillis: 15_000,
          });
          try {
            await runtimeClient.connect();
            await runtimeClient.query('SELECT 1');
          } catch {
            throw new Error(
              'كلمة مرور onesoft_app الحالية غير متاحة أو غير صحيحة — تم إيقاف الترقية دون تدوير كلمة المرور',
            );
          } finally {
            await runtimeClient.end().catch(() => {});
          }
        }
      }
      await runRoleBootstrapTransaction(client, dbName, appPassword, migrationPassword, options);
    } finally {
      client.release();
      await pool.end();
    }

    return {
      appPassword,
      migration: {
        host: admin.host,
        port: admin.port,
        database: dbName,
        user: MIGRATOR_ROLE,
        password: migrationPassword,
        role: MIGRATOR_ROLE,
        createdByVersion: APP_VERSION,
      },
    };
  }

  async adoptAllowlistedObjects(admin: DatabaseConnectionOptions): Promise<void> {
    const pool = new Pool({ ...admin, connectionTimeoutMillis: 15_000 });
    const client = await pool.connect();
    try {
      await runOwnershipRepairTransaction(client, admin);
    } finally {
      client.release();
      await pool.end();
    }
  }

  static saveCredential(credential: ProvisionedRoles['migration']): void {
    MigrationCredentialStore.save(credential);
  }
}