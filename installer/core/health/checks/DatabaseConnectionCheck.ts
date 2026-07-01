import { Pool } from 'pg';
import type { HealthCheckResult, DatabaseConnectionOptions } from '../../types.js';

export async function checkDatabaseConnection(opts: DatabaseConnectionOptions): Promise<HealthCheckResult> {
  const id = 'db-connection';
  const label = `Database Connection (${opts.name})`;
  const start = Date.now();

  const pool = new Pool({
    host: opts.host,
    port: opts.port,
    database: opts.name,
    user: opts.user,
    password: opts.password,
    connectionTimeoutMillis: 5000,
    max: 1,
  });

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    const ms = Date.now() - start;
    return { id, label, status: 'healthy', detail: `${opts.name} @ ${opts.host}:${opts.port}`, responseMs: ms };
  } catch (e: unknown) {
    return { id, label, status: 'unhealthy', detail: e instanceof Error ? e.message : String(e) };
  } finally {
    await pool.end().catch(() => {});
  }
}
