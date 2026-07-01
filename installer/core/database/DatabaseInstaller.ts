import { Pool, type PoolClient } from 'pg';
import type { DatabaseConnectionOptions, ProgressEvent } from '../types.js';

type Emit = (e: ProgressEvent) => void;

export class DatabaseInstaller {
  async createDatabase(
    adminOpts: DatabaseConnectionOptions,
    dbName: string,
    appUser: string,
    appPassword: string,
    emit: Emit,
  ): Promise<void> {
    const pool = new Pool({
      host: adminOpts.host,
      port: adminOpts.port,
      database: 'postgres',
      user: adminOpts.user,
      password: adminOpts.password,
    });

    const client = await pool.connect();
    try {
      emit({ level: 'info', message: `جارٍ إنشاء قاعدة البيانات "${dbName}"...`, timestamp: now() });

      // إنشاء قاعدة البيانات إذا لم تكن موجودة
      const dbExists = await client.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]
      );
      if (dbExists.rowCount === 0) {
        await client.query(`CREATE DATABASE "${dbName}" ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8' TEMPLATE template0`);
        emit({ level: 'success', message: `تم إنشاء قاعدة البيانات "${dbName}"`, timestamp: now() });
      } else {
        emit({ level: 'info', message: `قاعدة البيانات "${dbName}" موجودة بالفعل`, timestamp: now() });
      }

      // إنشاء مستخدم التطبيق إذا لم يكن موجوداً
      emit({ level: 'info', message: `جارٍ إنشاء مستخدم التطبيق "${appUser}"...`, timestamp: now() });
      const userExists = await client.query(
        `SELECT 1 FROM pg_roles WHERE rolname = $1`, [appUser]
      );
      if (userExists.rowCount === 0) {
        await client.query(`CREATE USER "${appUser}" WITH PASSWORD '${appPassword.replace(/'/g, "''")}'`);
        emit({ level: 'success', message: `تم إنشاء المستخدم "${appUser}"`, timestamp: now() });
      } else {
        await client.query(`ALTER USER "${appUser}" WITH PASSWORD '${appPassword.replace(/'/g, "''")}'`);
        emit({ level: 'info', message: `تم تحديث كلمة مرور المستخدم "${appUser}"`, timestamp: now() });
      }

      // منح الصلاحيات
      await client.query(`GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${appUser}"`);
      await client.query(`ALTER DATABASE "${dbName}" OWNER TO "${appUser}"`);
      emit({ level: 'success', message: 'تم منح الصلاحيات بنجاح', timestamp: now() });

    } finally {
      client.release();
      await pool.end();
    }
  }
}

function now() { return new Date().toISOString(); }
