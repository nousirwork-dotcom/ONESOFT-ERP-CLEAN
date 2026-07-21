import type { Pool } from 'pg';
import { REQUIRED_SCHEMA_VERSION } from './schema-version.js';

const EXPECTED_TABLES = [
  'organizations',
  'users',
  'user_groups',
  'user_categories',
  'user_group_members',
  'branches',
  'warehouses',
  'warehouse_account_links',
  'units',
  'product_groups',
  'products',
  'customers',
  'suppliers',
  'chart_of_accounts',
  'sales_invoices',
  'sales_invoice_items',
  'purchase_invoices',
  'purchase_invoice_items',
  'journal_entries',
  'journal_entry_lines',
  'vouchers',
  'receipt_vouchers',
  'payment_vouchers',
  'inventory',
  'stock_vouchers',
  'stock_voucher_items',
  'inventory_counts',
  'inventory_count_items',
  'free_products',
  'messages',
  'document_journals',
  'document_types',
  'document_templates',
  'cost_centers',
  'qr_settings',
  'document_send_logs',
  'waba_message_templates',
  'send_settings',
  'app_settings',
  'currencies',
  'posting_definitions',
  'posting_definition_lines',
  'field_dictionary',
  'payment_methods',
  'sales_invoice_payments',
  // ZATCA Database Architecture (0012)
  'zatca_environments',
  'zatca_devices',
  'zatca_certificates',
  'zatca_csid',
  'zatca_keys',
  'zatca_csr_requests',
  'zatca_invoice_transactions',
  'zatca_request_log',
  'zatca_response_log',
  'zatca_error_log',
  'zatca_xml_documents',
  'zatca_qr_codes',
  'zatca_settings',
  'zatca_api_history',
  // Password Recovery (0017)
  'verification_tokens',
  'password_reset_tokens',
  'security_events',
  // Real Estate Purchases (0025 + 0026 + 0027)
  're_purchases',
  're_purchase_statements',
  // Warehouse-as-Branch unification (0043)
  'user_warehouse_assignments',
  // User Audit Log (0044)
  'user_audit_logs',
  // User Group Members FK upgrade (0045)
  'user_group_migration_log',
];

export async function checkSchema(pool: Pool): Promise<boolean> {
  // ── تشخيص: طباعة بيئة الاتصال قبل أي محاولة ──────────────────────────────
  console.log('[schema-check] ── Connection Diagnostics ──');
  console.log(`[schema-check]   NODE_ENV       = ${process.env['NODE_ENV'] ?? '(غير محدد)'}`);
  console.log(`[schema-check]   DATABASE_URL   = ${
    process.env['DATABASE_URL']
      ? process.env['DATABASE_URL'].replace(/:([^:@]+)@/, ':***@')  // إخفاء كلمة المرور
      : '(غير محدد)'
  }`);
  console.log(`[schema-check]   CONFIG_PATH    = ${process.env['ONESOFT_CONFIG'] ?? 'default path'}`);
  // ── نهاية التشخيص ────────────────────────────────────────────────────────

  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error('[schema-check] Cannot connect to database:', err);
    return false;
  }

  try {
    // ── 1. Verify all expected tables exist ───────────────────────────────────
    const tableResult = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'`
    );
    const existingTables = new Set(tableResult.rows.map((r) => r.table_name));

    const missingTables = EXPECTED_TABLES.filter((t) => !existingTables.has(t));
    if (missingTables.length > 0) {
      console.error(
        '[schema-check] FATAL: The following tables are missing from the database:\n  ' +
          missingTables.join('\n  ')
      );
      console.error('[schema-check] Run "pnpm migrate" to bring the schema up to date.');
      return false;
    }

    // ── 2. Verify the migration version stamp matches this build ─────────────
    // `_schema_version` is written by `pnpm migrate` via scripts/stamp-migration.ts.
    // If it is absent, or its version does not match REQUIRED_SCHEMA_VERSION,
    // the database has not been fully migrated for this release.
    const versionResult = await client.query(
      `SELECT version FROM _schema_version WHERE id = 1`
    );

    if (versionResult.rowCount === 0) {
      console.error(
        `[schema-check] FATAL: _schema_version table is empty. ` +
          `Run "pnpm migrate" to stamp the database with the current schema version.`
      );
      return false;
    }

    const dbVersion = versionResult.rows[0].version;
    if (dbVersion !== REQUIRED_SCHEMA_VERSION) {
      console.error(
        `[schema-check] FATAL: Schema version mismatch. ` +
          `Database has "${dbVersion}", this build requires "${REQUIRED_SCHEMA_VERSION}". ` +
          `Run "pnpm migrate" to apply pending migrations.`
      );
      return false;
    }

    console.log(
      `[schema-check] Schema is up to date (version: ${REQUIRED_SCHEMA_VERSION}).`
    );
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('_schema_version') && message.includes('does not exist')) {
      console.error(
        `[schema-check] FATAL: _schema_version table does not exist. ` +
          `Run "pnpm migrate" to initialise schema version tracking.`
      );
    } else {
      console.error('[schema-check] Error while checking schema:', err);
    }
    return false;
  } finally {
    client.release();
  }
}
