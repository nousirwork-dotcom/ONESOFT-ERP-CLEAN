import { Pool } from 'pg';
import type { DatabaseConnectionOptions } from '../types.js';

export class ConnectionTester {
  async test(opts: DatabaseConnectionOptions): Promise<{ ok: boolean; detail: string; ms: number }> {
    const start = Date.now();
    const pool = new Pool({
      host: opts.host,
      port: opts.port,
      database: opts.database,
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
      return { ok: true, detail: `اتصال ناجح — استجابة ${ms}ms`, ms };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, detail: `فشل الاتصال: ${msg}`, ms: Date.now() - start };
    } finally {
      await pool.end();
    }
  }

  async testPostgresAdmin(host: string, port: number, password: string): Promise<{ ok: boolean; detail: string }> {
    return this.test({ host, port, database: 'postgres', user: 'postgres', password });
  }
}
