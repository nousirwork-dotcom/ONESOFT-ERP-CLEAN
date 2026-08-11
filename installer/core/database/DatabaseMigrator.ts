import type {
  DatabaseMigrationRequest,
  DatabaseMigrationResult,
  ProgressEvent,
} from '../types.js';
import { execFileSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { PostgreSQLToolsResolver } from './PostgreSQLToolsResolver.js';

type Emit = (e: ProgressEvent) => void;

const HOST_RE     = /^[a-zA-Z0-9._-]{1,253}$/;
const PORT_RE     = /^[0-9]{1,5}$/;
const DBNAME_RE   = /^[a-z][a-z0-9_]{0,62}$/i;
const USER_RE     = /^[a-z][a-z0-9_]{0,62}$/i;

function validateConnFields(db: { host: string; port: number; database: string; user: string }, label: string): void {
  if (!HOST_RE.test(db.host))       throw new Error(`${label}: invalid host "${db.host}"`);
  if (!PORT_RE.test(String(db.port)) || db.port < 1 || db.port > 65535)
    throw new Error(`${label}: invalid port ${db.port}`);
  if (!DBNAME_RE.test(db.database)) throw new Error(`${label}: invalid database name "${db.database}"`);
  if (!USER_RE.test(db.user))       throw new Error(`${label}: invalid user "${db.user}"`);
}

export class DatabaseMigrator {
  async migrate(
    req: DatabaseMigrationRequest,
    emit: Emit,
  ): Promise<DatabaseMigrationResult> {
    const dumpPath = path.join(
      process.env['TEMP'] ?? 'C:\\Temp',
      `onesoft_dump_${Date.now()}.sql`,
    );

    try {
      validateConnFields(req.sourceDb, 'source');
      validateConnFields(req.targetDb, 'target');

      emit({ level: 'info', message: 'Checking source connection...', timestamp: now() });
      await this._testConnection(req.sourceDb);
      emit({ level: 'success', message: 'Source connection: OK', timestamp: now() });

      emit({ level: 'info', message: 'Checking target connection...', timestamp: now() });
      await this._testConnection(req.targetDb);
      emit({ level: 'success', message: 'Target connection: OK', timestamp: now() });

      emit({ level: 'info', message: 'Exporting source database...', timestamp: now() });
      const { tablesTransferred, rowsTransferred } = await this._dump(
        req.sourceDb, dumpPath, req.includeData, emit,
      );
      emit({ level: 'success', message: `Export done — ~${tablesTransferred} tables`, timestamp: now() });

      emit({ level: 'info', message: 'Importing into target...', timestamp: now() });
      await this._restore(req.targetDb, dumpPath, emit);
      emit({ level: 'success', message: 'Import successful', timestamp: now() });

      if (req.dropSourceAfter) {
        emit({ level: 'warning', message: 'Dropping source database...', timestamp: now() });
        await this._dropSource(req.sourceDb, emit);
      }

      return { success: true, tablesTransferred, rowsTransferred, dumpPath };

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      emit({ level: 'error', message: `Migration failed: ${msg}`, timestamp: now() });
      return { success: false, tablesTransferred: 0, rowsTransferred: 0, error: msg };
    } finally {
      setTimeout(() => {
        try { if (fs.existsSync(dumpPath)) fs.unlinkSync(dumpPath); } catch { }
      }, 5 * 60 * 1000);
    }
  }

  private async _testConnection(db: DatabaseMigrationRequest['sourceDb']): Promise<void> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: db.host, port: db.port,
      database: db.database, user: db.user, password: db.password,
      connectionTimeoutMillis: 10_000,
    });
    try {
      const client = await pool.connect();
      client.release();
    } finally {
      await pool.end().catch(() => {});
    }
  }

  private async _dump(
    db: DatabaseMigrationRequest['sourceDb'],
    dumpPath: string,
    includeData: boolean,
    emit: Emit,
  ): Promise<{ tablesTransferred: number; rowsTransferred: number }> {
    const pgDump = new PostgreSQLToolsResolver().resolveAll(db).pgDump;
    const env = { ...process.env, PGPASSWORD: db.password };

    const args = [
      '-h', db.host,
      '-p', String(db.port),
      '-U', db.user,
      '-d', db.database,
      '--no-password',
      '-f', dumpPath,
    ];
    if (!includeData) args.push('--schema-only');

    emit({ level: 'info', message: `pg_dump: ${db.host}:${db.port}/${db.database}`, timestamp: now() });
    execFileSync(pgDump, args, { env, stdio: 'ignore' });

    const size = fs.statSync(dumpPath).size;
    return {
      tablesTransferred: Math.max(1, Math.floor(size / 5000)),
      rowsTransferred: 0,
    };
  }

  private async _restore(
    db: DatabaseMigrationRequest['targetDb'],
    dumpPath: string,
    emit: Emit,
  ): Promise<void> {
    const psql = new PostgreSQLToolsResolver().resolveAll(db).psql;

    const { Pool } = await import('pg');
    const pool = new Pool({
      host: db.host, port: db.port,
      database: 'postgres', user: db.user, password: db.password,
    });
    try {
      const client = await pool.connect();
      const safeDb = client.escapeIdentifier(db.database);
      await client.query(`CREATE DATABASE ${safeDb} WITH ENCODING='UTF8'`).catch(() => {});
      client.release();
    } finally {
      await pool.end().catch(() => {});
    }

    const env = { ...process.env, PGPASSWORD: db.password };
    const args = [
      '-h', db.host,
      '-p', String(db.port),
      '-U', db.user,
      '-d', db.database,
      '--no-password',
      '-f', dumpPath,
      '-q',
    ];

    emit({ level: 'info', message: `psql: ${db.host}:${db.port}/${db.database}`, timestamp: now() });
    execFileSync(psql, args, { env, stdio: 'ignore' });
  }

  private async _dropSource(
    db: DatabaseMigrationRequest['sourceDb'],
    emit: Emit,
  ): Promise<void> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: db.host, port: db.port,
      database: 'postgres', user: db.user, password: db.password,
    });
    try {
      const client = await pool.connect();
      await client.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
        [db.database],
      );
      const safeDb = client.escapeIdentifier(db.database);
      await client.query(`DROP DATABASE IF EXISTS ${safeDb}`);
      client.release();
      emit({ level: 'warning', message: `Source database dropped: ${db.database}`, timestamp: now() });
    } finally {
      await pool.end().catch(() => {});
    }
  }

}

function now() { return new Date().toISOString(); }
