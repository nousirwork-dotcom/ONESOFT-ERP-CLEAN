import { Pool } from 'pg';
import type { DatabaseConnectionOptions } from '../types.js';

/**
 * ExistingDbDetector — يكتشف ما إذا كانت قاعدة بيانات OneSoft موجودة ومهيّأة
 * مسبقاً على الاتصال المُعطى، حتى يستطيع المُثبِّت عرض خيار "الاتصال بالقاعدة
 * الموجودة" بدلاً من إنشاء مؤسسة/مستخدم جدد أو بذر شجرة الحسابات.
 *
 * لا يُجري أي تعديل على قاعدة البيانات — قراءة فقط.
 */
export interface ExistingDbInfo {
  /** true فقط إذا كانت قاعدة OneSoft موجودة ومهيّأة (organizations + مؤسسة واحدة على الأقل) */
  exists: boolean;
  /** هل تم الوصول إلى قاعدة البيانات المطلوبة أصلاً */
  reachable: boolean;
  /** هل قاعدة البيانات المطلوبة (dbName) موجودة على السيرفر */
  databaseExists: boolean;
  hasOrganizations: boolean;
  hasUsers: boolean;
  hasSchemaVersion: boolean;
  orgCount: number;
  userCount: number;
  /** أحدث نسخة مخطط مختومة في _schema_version — إن وُجدت */
  schemaVersion: string | null;
  /** رسالة عربية توضح النتيجة */
  detail: string;
  /** خطأ خام (للـ Log فقط) */
  rawError?: string;
}

export class ExistingDbDetector {
  /**
   * يحاول الاتصال بقاعدة البيانات المطلوبة مباشرة ويفحص جداول OneSoft.
   * @param opts بيانات الاتصال — يجب أن يكون `database` هو اسم قاعدة OneSoft المستهدفة.
   */
  async detect(opts: DatabaseConnectionOptions): Promise<ExistingDbInfo> {
    const base: ExistingDbInfo = {
      exists: false,
      reachable: false,
      databaseExists: false,
      hasOrganizations: false,
      hasUsers: false,
      hasSchemaVersion: false,
      orgCount: 0,
      userCount: 0,
      schemaVersion: null,
      detail: '',
    };

    const dbName = (opts.database ?? '').trim();
    if (!dbName) {
      return { ...base, detail: 'لم يُحدَّد اسم قاعدة البيانات' };
    }

    // 1) تحقق من وجود قاعدة البيانات على السيرفر (اتصال بـ postgres)
    const adminPool = new Pool({
      host: opts.host,
      port: opts.port,
      database: 'postgres',
      user: opts.user,
      password: opts.password,
      connectionTimeoutMillis: 10_000,
    });
    try {
      const client = await adminPool.connect();
      try {
        base.reachable = true;
        const dbRes = await client.query(
          `SELECT 1 FROM pg_database WHERE datname = $1`,
          [dbName],
        );
        base.databaseExists = (dbRes.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    } catch (e: unknown) {
      return {
        ...base,
        detail: 'تعذّر الاتصال بخادم PostgreSQL للتحقق من وجود قاعدة البيانات',
        rawError: e instanceof Error ? e.message : String(e),
      };
    } finally {
      await adminPool.end().catch(() => {});
    }

    if (!base.databaseExists) {
      return {
        ...base,
        detail: `قاعدة البيانات "${dbName}" غير موجودة — سيتم إنشاؤها كتثبيت جديد`,
      };
    }

    // 2) اتصل بقاعدة البيانات المستهدفة وافحص جداول OneSoft
    const targetPool = new Pool({
      host: opts.host,
      port: opts.port,
      database: dbName,
      user: opts.user,
      password: opts.password,
      connectionTimeoutMillis: 10_000,
    });
    try {
      const client = await targetPool.connect();
      try {
        const reg = await client.query<{
          has_orgs: boolean;
          has_users: boolean;
          has_schema_version: boolean;
        }>(
          `SELECT
             to_regclass('public.organizations')  IS NOT NULL AS has_orgs,
             to_regclass('public.users')          IS NOT NULL AS has_users,
             to_regclass('public._schema_version') IS NOT NULL AS has_schema_version`,
        );
        const row = reg.rows[0];
        base.hasOrganizations = row?.has_orgs ?? false;
        base.hasUsers = row?.has_users ?? false;
        base.hasSchemaVersion = row?.has_schema_version ?? false;

        if (base.hasOrganizations) {
          const orgRes = await client.query<{ cnt: number }>(
            `SELECT count(*)::int AS cnt FROM organizations`,
          );
          base.orgCount = orgRes.rows[0]?.cnt ?? 0;
        }
        if (base.hasUsers) {
          const userRes = await client.query<{ cnt: number }>(
            `SELECT count(*)::int AS cnt FROM users`,
          );
          base.userCount = userRes.rows[0]?.cnt ?? 0;
        }
        if (base.hasSchemaVersion) {
          try {
            const svRes = await client.query<{ version: string }>(
              `SELECT version FROM _schema_version WHERE id = 1`,
            );
            base.schemaVersion = svRes.rows[0]?.version ?? null;
          } catch {
            base.schemaVersion = null;
          }
        }
      } finally {
        client.release();
      }
    } catch (e: unknown) {
      return {
        ...base,
        detail: `قاعدة البيانات "${dbName}" موجودة لكن تعذّر فحص جداولها`,
        rawError: e instanceof Error ? e.message : String(e),
      };
    } finally {
      await targetPool.end().catch(() => {});
    }

    // 3) القرار: قاعدة OneSoft "موجودة" فقط إذا كان جدول المؤسسات به مؤسسة واحدة على الأقل
    base.exists = base.hasOrganizations && base.orgCount > 0;
    base.detail = base.exists
      ? `تم العثور على قاعدة بيانات OneSoft موجودة (${base.orgCount} مؤسسة، ${base.userCount} مستخدم)`
      : base.hasOrganizations
        ? `قاعدة البيانات "${dbName}" موجودة لكنها فارغة — ستُعامَل كتثبيت جديد`
        : `قاعدة البيانات "${dbName}" موجودة لكنها لا تحتوي مخطط OneSoft — ستُهيَّأ كتثبيت جديد`;

    return base;
  }
}
