import { Pool } from 'pg';
import { randomBytes } from 'crypto';
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
] as const;

export const TYPE_ALLOWLIST = [
  'inventory_count_status','invoice_status','invoice_type','journal_status','org_status','payment_method',
  'stock_voucher_type','user_role','voucher_type','pending_movement_status','lc_device_status',
  'lc_license_status','lc_license_type','lc_op_type',
] as const;

export const FUNCTION_ALLOWLIST = ['update_re_purchase_statements_timestamp'] as const;

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;

function randomPassword(): string {
  return randomBytes(32).toString('base64url');
}

export interface ProvisionedRoles {
  appPassword: string;
  migration: MigrationCredential;
}

export class DatabaseRoleManager {
  async provision(
    admin: DatabaseConnectionOptions,
    dbName: string,
    appPassword = randomPassword(),
  ): Promise<ProvisionedRoles> {
    const migrationPassword = randomPassword();
    const pool = new Pool({ ...admin, database: 'postgres', connectionTimeoutMillis: 15_000 });
    const client = await pool.connect();
    try {
      const appLiteral = client.escapeLiteral(appPassword);
      const migrationLiteral = client.escapeLiteral(migrationPassword);

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
      await client.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RUNTIME_ROLE}') THEN
          CREATE ROLE ${quote(RUNTIME_ROLE)} LOGIN PASSWORD ${appLiteral};
        ELSE
          ALTER ROLE ${quote(RUNTIME_ROLE)} LOGIN PASSWORD ${appLiteral};
        END IF;
      END $$;`);
      await client.query(`GRANT ${quote(SCHEMA_OWNER_ROLE)} TO ${quote(MIGRATOR_ROLE)}`);
      await client.query(`GRANT CONNECT ON DATABASE ${quote(dbName)} TO ${quote(MIGRATOR_ROLE)}, ${quote(RUNTIME_ROLE)}`);
      await client.query(`ALTER ROLE ${quote(MIGRATOR_ROLE)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
      await client.query(`ALTER ROLE ${quote(RUNTIME_ROLE)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
    } finally {
      client.release();
      await pool.end();
    }

    const dbPool = new Pool({ ...admin, database: dbName, connectionTimeoutMillis: 15_000 });
    const dbClient = await dbPool.connect();
    try {
      await dbClient.query(`ALTER SCHEMA public OWNER TO ${quote(SCHEMA_OWNER_ROLE)}`);
      await dbClient.query(`GRANT USAGE ON SCHEMA public TO ${quote(RUNTIME_ROLE)}`);
      await dbClient.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${quote(RUNTIME_ROLE)}`);
      await dbClient.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quote(RUNTIME_ROLE)}`);
      await dbClient.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${quote(RUNTIME_ROLE)}`);
      await dbClient.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quote(SCHEMA_OWNER_ROLE)} IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${quote(RUNTIME_ROLE)}`);
      await dbClient.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quote(SCHEMA_OWNER_ROLE)} IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO ${quote(RUNTIME_ROLE)}`);
    } finally {
      dbClient.release();
      await dbPool.end();
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
      // The public schema is the namespace in which migrations execute. Its
      // owner is therefore part of the migration-role invariant, even though
      // it is not included in the table/type allowlists below.
      await client.query(`ALTER SCHEMA public OWNER TO ${quote(SCHEMA_OWNER_ROLE)}`);
      await client.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
      await client.query(`REVOKE CREATE ON DATABASE ${quote(admin.database)} FROM PUBLIC`);
      await client.query(`GRANT USAGE ON SCHEMA public TO ${quote(MIGRATOR_ROLE)}`);
      for (const table of TABLE_ALLOWLIST) {
        const exists = await client.query(
          `SELECT to_regclass($1) IS NOT NULL AS exists`, [`public.${table}`],
        );
        if (exists.rows[0]?.exists) {
          await client.query(`ALTER TABLE public.${quote(table)} OWNER TO ${quote(SCHEMA_OWNER_ROLE)}`);
        }
      }
      const sequences = await client.query<{ relname: string }>(
        `SELECT seq.relname
           FROM pg_class seq
           JOIN pg_namespace seq_ns ON seq_ns.oid = seq.relnamespace
           JOIN pg_depend dep ON dep.objid = seq.oid AND dep.deptype = 'a'
           JOIN pg_class tbl ON tbl.oid = dep.refobjid
           JOIN pg_namespace tbl_ns ON tbl_ns.oid = tbl.relnamespace
          WHERE seq.relkind = 'S'
            AND seq_ns.nspname = 'public'
            AND tbl_ns.nspname = 'public'
            AND tbl.relname = ANY($1::text[])`,
        [TABLE_ALLOWLIST],
      );
      for (const row of sequences.rows) {
        await client.query(`ALTER SEQUENCE public.${quote(row.relname)} OWNER TO ${quote(SCHEMA_OWNER_ROLE)}`);
      }
      for (const type of TYPE_ALLOWLIST) {
        const exists = await client.query(
          `SELECT to_regtype($1) IS NOT NULL AS exists`, [`public.${type}`],
        );
        if (exists.rows[0]?.exists) {
          await client.query(`ALTER TYPE public.${quote(type)} OWNER TO ${quote(SCHEMA_OWNER_ROLE)}`);
        }
      }
      for (const fn of FUNCTION_ALLOWLIST) {
        const functions = await client.query<{ identity: string }>(
          `SELECT pg_get_function_identity_arguments(p.oid) AS identity
             FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = $1`, [fn],
        );
        for (const row of functions.rows) {
          await client.query(`ALTER FUNCTION public.${quote(fn)}(${row.identity}) OWNER TO ${quote(SCHEMA_OWNER_ROLE)}`);
        }
      }
    } finally {
      client.release();
      await pool.end();
    }
  }

  static saveCredential(credential: ProvisionedRoles['migration']): void {
    MigrationCredentialStore.save(credential);
  }
}