import pg from 'pg';
import { ENV } from '../src/env.js';
import { autoMigrate } from '../src/auto-migrate.js';

const pool = new pg.Pool({ connectionString: ENV.dbUrl });

try {
  const result = await autoMigrate(pool);
  if (!result.ok) {
    console.error(`[migrate] فشل: ${result.error}`);
    process.exitCode = 1;
  } else {
    console.log('[migrate] اكتملت جميع migrations بنجاح');
  }
} finally {
  await pool.end();
}