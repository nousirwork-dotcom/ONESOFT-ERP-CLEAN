import { Pool } from 'pg';
import type { DatabaseConnectionOptions, ProgressEvent } from '../types.js';
import { DatabaseRoleManager, SCHEMA_OWNER_ROLE } from './DatabaseRoleManager.js';

type Emit = (e: ProgressEvent) => void;

const IDENTIFIER_RE = /^[a-z][a-z0-9_]{0,62}$/i;

function validateIdentifier(value: string, label: string): void {
  if (!IDENTIFIER_RE.test(value)) {
    throw new Error(
      `Invalid ${label}: "${value}". Only letters, digits, and underscores are allowed (max 63 chars, must start with a letter).`
    );
  }
}

export class DatabaseInstaller {
  async createDatabase(
    adminOpts: DatabaseConnectionOptions,
    dbName: string,
    appUser: string,
    appPassword: string,
    emit: Emit,
  ): Promise<{ appPassword: string }> {
    validateIdentifier(dbName, 'database name');
    validateIdentifier(appUser, 'application user');

    const pool = new Pool({
      host: adminOpts.host,
      port: adminOpts.port,
      database: 'postgres',
      user: adminOpts.user,
      password: adminOpts.password,
    });

    const client = await pool.connect();
    try {
      emit({ level: 'info', message: `Creating database "${dbName}"...`, timestamp: now() });

      const dbExists = await client.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]
      );
      if (dbExists.rowCount === 0) {
        const safeDb = client.escapeIdentifier(dbName);
        await client.query(
          `CREATE DATABASE ${safeDb} ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8' TEMPLATE template0`
        );
        emit({ level: 'success', message: `Database "${dbName}" created`, timestamp: now() });
      } else {
        emit({ level: 'info', message: `Database "${dbName}" already exists`, timestamp: now() });
      }

      emit({ level: 'info', message: `Preparing application user "${appUser}"...`, timestamp: now() });
      const userExists = await client.query(
        `SELECT 1 FROM pg_roles WHERE rolname = $1`, [appUser]
      );

      const safeUser = client.escapeIdentifier(appUser);
      const safePass = appPassword.trim() ? client.escapeLiteral(appPassword) : null;

      if (safePass && userExists.rowCount === 0) {
        await client.query(`CREATE USER ${safeUser} WITH PASSWORD ${safePass}`);
        emit({ level: 'success', message: `User "${appUser}" created`, timestamp: now() });
      } else if (safePass) {
        await client.query(`ALTER USER ${safeUser} WITH PASSWORD ${safePass}`);
        emit({ level: 'info', message: `Password updated for user "${appUser}"`, timestamp: now() });
      }

      const roleManager = new DatabaseRoleManager();
      const provisioned = await roleManager.provision({
        ...adminOpts,
        database: dbName,
      }, dbName, appPassword.trim() || undefined);
      await client.query(`ALTER DATABASE ${client.escapeIdentifier(dbName)} OWNER TO ${client.escapeIdentifier(SCHEMA_OWNER_ROLE)}`);
      await roleManager.adoptAllowlistedObjects({
        ...adminOpts,
        database: dbName,
      });
      const { MigrationCredentialStore } = await import('../security/MigrationCredentialStore.js');
      MigrationCredentialStore.save(provisioned.migration);
      emit({ level: 'success', message: 'أدوار قاعدة البيانات الآمنة جاهزة وتم حفظ اعتماد الترحيل محلياً', timestamp: now() });
      return { appPassword: provisioned.appPassword };

    } finally {
      client.release();
      await pool.end();
    }
  }
}

function now() { return new Date().toISOString(); }
