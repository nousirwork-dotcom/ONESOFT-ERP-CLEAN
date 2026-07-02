import { Pool } from 'pg';
import { hashSync } from 'bcryptjs';
import type { FirstUserSetup, ProgressEvent } from '../types.js';

type Emit = (e: ProgressEvent) => void;

export class UserCreator {
  async create(
    databaseUrl: string,
    orgId: number,
    user: FirstUserSetup,
    emit: Emit,
  ): Promise<{ id: number }> {
    emit({ level: 'info', message: `جارٍ إنشاء المستخدم "${user.username}"...`, timestamp: now() });

    const pool = new Pool({ connectionString: databaseUrl });
    const client = await pool.connect();

    try {
      // التحقق من عدم وجود المستخدم
      const exists = await client.query(
        `SELECT id FROM users WHERE org_id = $1 AND username = $2`, [orgId, user.username]
      );
      if ((exists.rowCount ?? 0) > 0) {
        const row = exists.rows[0] as { id: number };
        emit({ level: 'info', message: `المستخدم "${user.username}" موجود بالفعل`, timestamp: now() });
        return row;
      }

      const passwordHash = hashSync(user.password, 10);

      const result = await client.query<{ id: number }>(`
        INSERT INTO users (org_id, username, password_hash, name, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'admin', true, NOW(), NOW())
        RETURNING id
      `, [orgId, user.username, passwordHash, user.fullName]);

      const row = result.rows[0]!;
      emit({ level: 'success', message: `تم إنشاء المستخدم الإداري "${user.username}"`, timestamp: now() });
      return row;

    } finally {
      client.release();
      await pool.end();
    }
  }
}

function now() { return new Date().toISOString(); }
