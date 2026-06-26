import pg from 'pg';
import { REQUIRED_SCHEMA_VERSION } from '../src/schema-version.js';
import { ENV } from '../src/env.js';

const { Pool } = pg;

const pool = new Pool({ connectionString: ENV.dbUrl });

async function stampMigration() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_version (
        id      INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        version TEXT    NOT NULL,
        stamped_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(
      `INSERT INTO _schema_version (id, version, stamped_at)
       VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE SET version = $1, stamped_at = NOW()`,
      [REQUIRED_SCHEMA_VERSION]
    );

    console.log(`[stamp-migration] Stamped schema version: ${REQUIRED_SCHEMA_VERSION}`);
  } finally {
    client.release();
    await pool.end();
  }
}

stampMigration().catch((err) => {
  console.error('[stamp-migration] Failed to stamp schema version:', err);
  process.exit(1);
});
