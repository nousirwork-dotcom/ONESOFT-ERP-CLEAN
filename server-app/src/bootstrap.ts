/**
 * bootstrap.ts — تهيئة أول تشغيل على قاعدة بيانات جديدة
 *
 * ensureDefaultAdmin():
 *   - يعمل مرة واحدة فقط عندما يكون جدول المستخدمين فارغاً (قاعدة بيانات جديدة).
 *   - يُنشئ مؤسسة تجريبية (30 يوماً) إن لم توجد مؤسسة صالحة.
 *   - يُنشئ مستخدم ADMIN بكلمة مرور فارغة (password_status='not_set') وصلاحيات مدير كاملة.
 *
 * إعادة التثبيت مع قاعدة بيانات موجودة:
 *   - جدول المستخدمين غير فارغ → لا يُنشئ ولا يُعدّل أي مستخدم أو صلاحية (no-op).
 */
import { db } from './db.js';
import { organizations, users } from './schema.js';
import { hashPassword } from './auth.js';
import { logger } from './logger.js';
import { sql } from 'drizzle-orm';
import { seedFoundationAccounts } from './seed-foundation.js';

// يُضبط true بعد انتهاء ensureDefaultAdmin (نجاحاً أو فشلاً).
// setup.isFirstRun يستخدمه لمنع ظهور معالج «إنشاء أول مدير» أثناء نافذة الإقلاع
// القصيرة قبل اكتمال التهيئة (وإلا قد تُقرأ الجداول فارغة قبل البذر).
let bootstrapComplete = false;
export function isBootstrapComplete(): boolean {
  return bootstrapComplete;
}

export async function ensureDefaultAdmin(): Promise<void> {
  try {
    const rows = await db.select({ cnt: sql<number>`count(*)::int` }).from(users);
    const userCount = rows[0]?.cnt ?? 0;

    // قاعدة بيانات موجودة مسبقاً — لا تُنشئ أو تُعدّل أي مستخدم إطلاقاً
    if (userCount > 0) return;

    // ── تأكد من وجود مؤسسة صالحة ──────────────────────────────────────────
    // نفضّل أي مؤسسة موجودة غير SYSTEM، وإلا نُنشئ مؤسسة تجريبية 30 يوماً
    const existing = await db.query.organizations.findMany({
      columns: { id: true, code: true },
    });
    let org = existing.find(o => o.code !== 'SYSTEM') ?? null;

    if (!org) {
      const trialExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const [created] = await db.insert(organizations).values({
        code:               'TRIAL',
        name:               'مؤسستي',
        nameEn:             '',
        taxNumber:          '',
        phone:              '',
        email:              '',
        address:            '',
        currency:           'SAR',
        status:             'trial',
        subscriptionExpiry: trialExpiry,
        maxUsers:           5,
      }).returning({ id: organizations.id, code: organizations.code });
      org = created;
      logger.info('bootstrap', `default trial org created (code=${created.code}, 30d)`);
    }

    // ── أنشئ مستخدم ADMIN بكلمة مرور فارغة ────────────────────────────────
    const emptyHash = await hashPassword('');
    await db.insert(users).values({
      orgId:          org.id,
      username:       'ADMIN',
      passwordHash:   emptyHash,
      passwordStatus: 'not_set',
      name:           'المدير',
      role:           'admin',
      isActive:       true,
    });
    logger.info('bootstrap', 'default ADMIN user created (empty password, password_status=not_set)');

    // ── بذر شجرة الحسابات الأساسية للمؤسسة الجديدة ──────────────────────────
    await seedFoundationAccounts(org.id);

    // ── تطبيق قالب التأسيس (إن وُجد) ──────────────────────────────────────
    try {
      const { seedFromFoundationTemplate } = await import('./foundation-update.js');
      await seedFromFoundationTemplate(org.id);
    } catch (ftErr) {
      logger.warn('bootstrap', `seedFromFoundationTemplate: ${(ftErr as Error).message}`);
    }
  } catch (err) {
    // لا نوقف الخادم — نسجّل الخطأ فقط؛ شاشة الدخول ستُظهر خطأً واضحاً بدل حلقة
    logger.error('bootstrap', `ensureDefaultAdmin failed: ${(err as Error).message}`);
  } finally {
    // نُعلن اكتمال التهيئة حتى في حالة الفشل حتى لا يعلّق العميل للأبد.
    bootstrapComplete = true;
  }
}
