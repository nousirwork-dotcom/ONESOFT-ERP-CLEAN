import { Pool } from 'pg';
import type { OrganizationSetup, ProgressEvent } from '../types.js';

type Emit = (e: ProgressEvent) => void;

export class OrganizationCreator {
  async create(
    databaseUrl: string,
    org: OrganizationSetup,
    emit: Emit,
  ): Promise<{ id: number; code: string }> {
    emit({ level: 'info', message: `جارٍ إنشاء المؤسسة "${org.name}"...`, timestamp: now() });

    const pool = new Pool({ connectionString: databaseUrl });
    const client = await pool.connect();

    try {
      // التحقق من عدم وجود المؤسسة مسبقاً
      const exists = await client.query(
        `SELECT id, code FROM organizations WHERE code = $1`, [org.code]
      );
      if ((exists.rowCount ?? 0) > 0) {
        const row = exists.rows[0] as { id: number; code: string };
        emit({ level: 'info', message: `المؤسسة "${org.code}" موجودة بالفعل`, timestamp: now() });
        return row;
      }

      // status = 'trial' مع subscription_expiry = 30 يوماً — يسمح بالاستخدام الكامل خلال التجربة
      // بعد انتهاء التجربة يُطلب ترخيص من License Center
      const result = await client.query<{ id: number; code: string }>(`
        INSERT INTO organizations (code, name, name_en, currency, status, subscription_expiry, max_users, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'trial', NOW() + INTERVAL '30 days', 10, NOW(), NOW())
        RETURNING id, code
      `, [org.code, org.name, org.nameEn ?? null, org.currency]);

      const row = result.rows[0]!;
      emit({ level: 'success', message: `تم إنشاء المؤسسة — كود: ${row.code}`, timestamp: now() });
      return row;

    } finally {
      client.release();
      await pool.end();
    }
  }
}

function now() { return new Date().toISOString(); }
