import { z } from 'zod';
import { router, publicProcedure, adminProcedure, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { count, eq, and } from 'drizzle-orm';
import { db } from '../db.js';
import { users, branches } from '../schema.js';
import {
  getLicense,
  verifySignedLicense,
  saveLicense,
  invalidateLicenseCache,
  type SignedLicense,
} from '../lib/license.js';
import {
  getOrCreateDeviceId,
  getHardwareFingerprint,
} from '../lib/deviceId.js';

export const licenseRouter = router({

  // ── حالة الترخيص الحالي ────────────────────────────────────────────────────
  getStatus: protectedProcedure.query(() => {
    const status = getLicense();
    if (!status.valid || !status.payload) {
      return {
        valid:   false,
        error:   status.error,
        payload: null,
      };
    }
    const p = status.payload;
    return {
      valid: true,
      error: null,
      payload: {
        org_id:           p.org_id,
        customer_name:    p.customer_name,
        max_users:        p.max_users,
        max_pos:          p.max_pos,
        max_branches:     p.max_branches,
        max_devices:      p.max_devices,
        enabled_modules:  p.enabled_modules,
        start_date:       p.start_date,
        expiry_date:      p.expiry_date,
        license_id:       p.license_id,
        activation_id:    p.activation_id,
        issued_at:        p.issued_at,
        issued_by:        p.issued_by,
        license_type:     p.license_type,
        package_name:     p.package_name,
        web_allowed:      p.web_allowed,
        desktop_allowed:  p.desktop_allowed,
        offline_allowed:  p.offline_allowed,
      },
    };
  }),

  // ── إحصائيات الاستخدام الحالي ─────────────────────────────────────────────
  getCurrentStats: protectedProcedure.query(async ({ ctx }) => {
    const [[uRow], [bRow]] = await Promise.all([
      db.select({ cnt: count() }).from(users).where(and(eq(users.orgId, ctx.user.orgId), eq(users.isActive, true))),
      db.select({ cnt: count() }).from(branches).where(and(eq(branches.orgId, ctx.user.orgId), eq(branches.isActive, true))),
    ]);
    return {
      current_users:    uRow?.cnt ?? 0,
      current_branches: bRow?.cnt ?? 0,
      current_pos:      0, // POS terminals table not yet implemented
    };
  }),

  // ── معرّف الجهاز (للتفعيل) ─────────────────────────────────────────────────
  getDeviceInfo: publicProcedure.query(() => {
    return {
      device_id:    getOrCreateDeviceId(),
      hw_fingerprint: getHardwareFingerprint(),
    };
  }),

  // ── توليد Request Code (Phase 1 Offline) ───────────────────────────────────
  generateRequestCode: publicProcedure
    .input(z.object({
      org_id:      z.string().optional().default(''),
      license_key: z.string().optional().default(''),
    }))
    .mutation(({ input }) => {
      const device_id    = getOrCreateDeviceId();
      const hw_fp        = getHardwareFingerprint();
      const requestData  = {
        device_id,
        hw_fingerprint: hw_fp,
        org_id:        input.org_id    || undefined,
        license_key:   input.license_key || undefined,
        requested_at:  new Date().toISOString(),
      };
      const code = Buffer.from(JSON.stringify(requestData)).toString('base64url');
      return { code, device_id };
    }),

  // ── تفعيل عبر كود (Activation Code — base64url) ────────────────────────────
  activateByCode: adminProcedure
    .input(z.object({ code: z.string().min(10) }))
    .mutation(({ input }) => {
      let signed: SignedLicense;
      try {
        const decoded = Buffer.from(input.code.trim(), 'base64url').toString('utf-8');
        signed = JSON.parse(decoded) as SignedLicense;
      } catch {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'كود التفعيل غير صالح — تعذّر فك تشفيره',
        });
      }
      return _applyLicense(signed);
    }),

  // ── تفعيل عبر محتوى ملف license.ons ───────────────────────────────────────
  activateByFile: adminProcedure
    .input(z.object({ content: z.string().min(10) }))
    .mutation(({ input }) => {
      let signed: SignedLicense;
      try {
        signed = JSON.parse(input.content.trim()) as SignedLicense;
      } catch {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'ملف الترخيص غير صالح — تعذّر قراءة JSON',
        });
      }
      return _applyLicense(signed);
    }),
});

// ─── مساعد مشترك: التحقق + الحفظ ────────────────────────────────────────────
function _applyLicense(signed: SignedLicense) {
  const result = verifySignedLicense(signed);

  if (!result.valid) {
    const messages: Record<string, string> = {
      unknown_algorithm:           'الخوارزمية غير مدعومة',
      unknown_kid:                 'مفتاح الترخيص غير معروف',
      invalid_signature:           'التوقيع الرقمي غير صالح — قد يكون الترخيص مُعدَّلاً',
      expired:                     'انتهت صلاحية الترخيص',
      not_yet_valid:               'الترخيص لم يبدأ بعد',
      date_manipulation_suspected: 'تم اكتشاف تلاعب بتاريخ الجهاز',
      invalid_json:                'تنسيق الترخيص غير صالح',
    };
    throw new TRPCError({
      code:    'FORBIDDEN',
      message: messages[result.error ?? ''] ?? 'الترخيص غير صالح',
    });
  }

  // حفظ الترخيص وتحديث الكاش
  saveLicense(signed);
  invalidateLicenseCache();
  // إعادة قراءة للتأكد
  const fresh = getLicense();

  return {
    success:  true,
    customer: fresh.payload?.customer_name,
    expiry:   fresh.payload?.expiry_date,
    modules:  fresh.payload?.enabled_modules,
  };
}
