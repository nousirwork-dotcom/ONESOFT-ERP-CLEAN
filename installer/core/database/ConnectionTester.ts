import { Pool } from 'pg';
import type { DatabaseConnectionOptions } from '../types.js';

// ── أنواع أخطاء الاتصال ────────────────────────────────────────────────────
export type DbErrorType =
  | 'auth'       // كلمة مرور خاطئة
  | 'user'       // اسم مستخدم غير موجود
  | 'database'   // قاعدة البيانات غير موجودة
  | 'service'    // PostgreSQL غير مشغّل
  | 'network'    // عنوان غير قابل للوصول
  | 'timeout'    // انتهت المهلة
  | 'other';     // خطأ آخر

export interface ConnectionTestResult {
  ok:        boolean;
  detail:    string;    // رسالة عربية واضحة للمستخدم
  errorType?: DbErrorType;
  hint?:      string;   // تلميح للإصلاح
  rawError?:  string;   // الرسالة الأصلية لملف الـ Log
  ms:         number;
}

// ── ترجمة أخطاء PostgreSQL إلى رسائل عربية واضحة ─────────────────────────
function parsePostgresError(msg: string): { detail: string; errorType: DbErrorType; hint: string } {
  const m = msg.toLowerCase();

  if (m.includes('password authentication failed')) {
    return {
      detail:    'كلمة مرور PostgreSQL غير صحيحة',
      errorType: 'auth',
      hint:      'تحقق من كلمة المرور التي أدخلتها وتأكد أنها تطابق كلمة مرور المستخدم في PostgreSQL',
    };
  }

  if (m.includes('role') && m.includes('does not exist')) {
    const match = msg.match(/role "([^"]+)"/);
    const user  = match?.[1] ?? 'postgres';
    return {
      detail:    `المستخدم "${user}" غير موجود في PostgreSQL`,
      errorType: 'user',
      hint:      `تحقق من اسم المستخدم — الافتراضي عادةً هو "postgres"`,
    };
  }

  if (m.includes('database') && m.includes('does not exist')) {
    const match = msg.match(/database "([^"]+)"/);
    const db    = match?.[1] ?? 'onesoft_erp';
    return {
      detail:    `قاعدة البيانات "${db}" غير موجودة`,
      errorType: 'database',
      hint:      'ستقوم عملية التثبيت بإنشاء قاعدة البيانات تلقائياً — هذا ليس خطأً حرجاً',
    };
  }

  if (m.includes('econnrefused') || m.includes('connect econnrefused')) {
    return {
      detail:    'خدمة PostgreSQL غير متاحة أو لا تستمع على هذا المنفذ',
      errorType: 'service',
      hint:      'تأكد من أن خدمة PostgreSQL تعمل: ابحث في "الخدمات" عن postgresql ثم ابدأها',
    };
  }

  if (m.includes('etimedout') || m.includes('timeout') || m.includes('connection timeout')) {
    return {
      detail:    'انتهت مهلة الاتصال',
      errorType: 'timeout',
      hint:      'تحقق من عنوان السيرفر والمنفذ، وتأكد من عدم وجود جدار حماية يحجب الاتصال',
    };
  }

  if (m.includes('enotfound') || m.includes('getaddrinfo')) {
    return {
      detail:    'لا يمكن الوصول إلى عنوان السيرفر',
      errorType: 'network',
      hint:      'تحقق من عنوان السيرفر (IP أو Hostname) وتأكد من الاتصال بالشبكة',
    };
  }

  if (m.includes('enetunreach') || m.includes('network unreachable')) {
    return {
      detail:    'الشبكة غير متاحة',
      errorType: 'network',
      hint:      'تحقق من اتصالك بالشبكة',
    };
  }

  if (m.includes('ssl') || m.includes('tls')) {
    return {
      detail:    'خطأ في إعدادات SSL',
      errorType: 'other',
      hint:      'قد يتطلب هذا السيرفر اتصال SSL — راجع إعدادات SSL في PostgreSQL',
    };
  }

  return {
    detail:    `فشل الاتصال: ${msg}`,
    errorType: 'other',
    hint:      'راجع ملف السجل للتفاصيل التقنية',
  };
}

// ── ConnectionTester ──────────────────────────────────────────────────────────
export class ConnectionTester {
  async test(opts: DatabaseConnectionOptions): Promise<ConnectionTestResult> {
    const start = Date.now();
    const pool  = new Pool({
      host:                    opts.host,
      port:                    opts.port,
      database:                opts.database,
      user:                    opts.user,
      password:                opts.password,
      connectionTimeoutMillis: 5000,
      max:                     1,
    });

    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      const ms = Date.now() - start;
      return { ok: true, detail: `اتصال ناجح — استجابة ${ms}ms`, ms };

    } catch (e: unknown) {
      const rawError = e instanceof Error ? e.message : String(e);
      const parsed   = parsePostgresError(rawError);

      // قاعدة البيانات غير موجودة ليست خطأً حرجاً — ستُنشأ أثناء التثبيت
      const isNonFatal = parsed.errorType === 'database';

      return {
        ok:        isNonFatal,
        detail:    parsed.detail,
        errorType: parsed.errorType,
        hint:      parsed.hint,
        rawError,
        ms:        Date.now() - start,
      };

    } finally {
      await pool.end().catch(() => { /* تجاهل أخطاء إغلاق البول */ });
    }
  }

  async testPostgresAdmin(host: string, port: number, password: string): Promise<ConnectionTestResult> {
    return this.test({ host, port, database: 'postgres', user: 'postgres', password });
  }
}
