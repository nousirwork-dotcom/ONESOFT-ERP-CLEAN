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

      // ── ضمان دفاعي: تأكّد من وجود الأعمدة الحيوية حتى لو جاءت الـ migrations ناقصة
      // (يحدث عند إعادة التثبيت على قاعدة بيانات فيها بيانات متبقية من محاولة سابقة فاشلة)
      await client.query(`
        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS password_status       VARCHAR(20)  NOT NULL DEFAULT 'set',
          ADD COLUMN IF NOT EXISTS extra_permissions     JSONB                 DEFAULT '{}'::jsonb,
          ADD COLUMN IF NOT EXISTS phone_verified_at     TIMESTAMP,
          ADD COLUMN IF NOT EXISTS email_verified_at     TIMESTAMP,
          ADD COLUMN IF NOT EXISTS password_changed_at   TIMESTAMP,
          ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN      NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS recovery_enabled_phone BOOLEAN     NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS recovery_enabled_email BOOLEAN     NOT NULL DEFAULT FALSE
      `);

      // كلمة المرور اختيارية — إذا كانت فارغة → password_status = 'not_set' (auto-login)
      const hasPassword    = (user.password ?? '').length > 0;
      const passwordHash   = hashSync(user.password ?? '', 10);
      const passwordStatus = hasPassword ? 'set' : 'not_set';

      const result = await client.query<{ id: number }>(`
        INSERT INTO users (org_id, username, password_hash, name, role, is_active, password_status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'admin', true, $5, NOW(), NOW())
        RETURNING id
      `, [orgId, user.username, passwordHash, user.fullName, passwordStatus]);

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
