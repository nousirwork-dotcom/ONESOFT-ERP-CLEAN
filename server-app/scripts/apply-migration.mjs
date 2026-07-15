import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  // Stamp _schema_version with the EXACT schema that auto-migrate expects:
  // id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), version TEXT NOT NULL, stamped_at TIMESTAMP NOT NULL DEFAULT NOW()
  await client.query(`
    CREATE TABLE IF NOT EXISTS _schema_version (
      id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      version    TEXT    NOT NULL,
      stamped_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(
    `INSERT INTO _schema_version (id, version, stamped_at) VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET version = $1, stamped_at = NOW()`,
    ['0031_re_housing_units']
  );

  // Ensure __drizzle_migrations exists and is stamped
  await client.query(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id SERIAL PRIMARY KEY,
      tag TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const allTags = [
    '0000_set_null_inventory_counts_warehouse_id',
    '0001_set_null_warehouse_references',
    '0002_robust_black_bolt',
    '0003_add_entity_type_to_document_journals',
    '0004_add_waba_fields_to_send_settings',
    '0005_add_waba_advanced',
    '0006_add_currencies',
    '0007_add_app_settings',
    '0008_unique_journal_entry_number',
    '0009_add_payment_breakdown',
    '0010_add_item_type_to_products',
    '0011_add_zatca_integration',
    '0012_zatca_database_architecture',
    '0013_add_missing_tables',
    '0014_add_theme_settings',
    '0015_add_user_permissions',
    '0016_lc_clients_extended',
    '0017_password_recovery',
    '0018_trial_first_run',
    '0019_fix_active_orgs_to_trial',
    '0020_ai_assistant',
    '0021_support_tickets',
    '0022_custody_tracking',
    '0023_custody_records',
    '0024_links_services',
    '0025_re_purchases',
    '0026_re_purchase_statements',
    '0027_re_purchases_enhancements',
    '0028_re_documents',
    '0029_re_trial_balance',
    '0030_add_settlement_account_id',
    '0031_re_housing_units',
  ];
  for (const tag of allTags) {
    await client.query(`
      INSERT INTO __drizzle_migrations (tag, applied_at)
      VALUES ($1, now())
      ON CONFLICT (tag) DO NOTHING
    `, [tag]);
  }

  const check = await client.query(`SELECT to_regclass('public.re_housing_units') AS tbl`);
  const ver = await client.query(`SELECT version FROM _schema_version WHERE id = 1`);
  console.log('re_housing_units table exists:', check.rows[0].tbl !== null);
  console.log('Schema version stamped to:', ver.rows[0]?.version);
} catch (e) {
  console.error('Stamp failed:', e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
