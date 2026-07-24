import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { db } from '../db.js';
import { users, organizations, appSettings } from '../schema.js';
import { and, eq } from 'drizzle-orm';
import { verifyPassword, getAuthCookieOptions } from '../auth.js';
import { ENV } from '../env.js';

export const authRouter = router({

  me: publicProcedure.query(async ({ ctx }) => {
    return ctx.user ? {
      id:               ctx.user.id,
      name:             ctx.user.name,
      username:         ctx.user.username,
      role:             ctx.user.role,
      orgId:            ctx.user.orgId,
      extraPermissions: (ctx.user.extraPermissions ?? {}) as Record<string, boolean>,
      canBeSalesperson: ctx.user.canBeSalesperson ?? false,
      defaultWarehouseId: ctx.user.defaultWarehouseId ?? null,
    } : null;
  }),

  // ── حالة كلمة مرور المدير (هل تم تعيينها؟) ──────────────────────────────
  adminPasswordStatus: protectedProcedure.query(async ({ ctx }) => {
    const [user, org] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, ctx.user.id) }),
      db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.user.orgId),
        columns: { status: true, subscriptionExpiry: true },
      }),
    ]);

    let trialDaysLeft: number | null = null;
    let isTrial = false;
    if (org?.status === 'trial' && org.subscriptionExpiry) {
      isTrial = true;
      const msLeft = new Date(org.subscriptionExpiry).getTime() - Date.now();
      trialDaysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    }

    return {
      passwordStatus: (user?.passwordStatus ?? 'set') as 'not_set' | 'set',
      isAdmin:        ctx.user.role === 'admin' || ctx.user.role === 'superadmin',
      isTrial,
      trialDaysLeft,
    };
  }),

  // ── تسجيل الخروج ─────────────────────────────────────────────────────────────
  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(ENV.cookieName, getAuthCookieOptions());
    return { success: true };
  }),

  // ── إعدادات تسجيل الدخول (عامة — لشاشة الدخول) ─────────────────────────────
  getLoginSettings: publicProcedure
    .input(z.object({ orgCode: z.string().optional() }))
    .query(async ({ input }) => {
      const dflt = 'username' as const;
      if (!input.orgCode) return { loginMethod: dflt };
      try {
        const org = await db.query.organizations.findFirst({
          where: eq(organizations.code, input.orgCode.toUpperCase()),
          columns: { id: true },
        });
        if (!org) return { loginMethod: dflt };
        const row = await db.query.appSettings.findFirst({
          where: and(eq(appSettings.orgId, org.id), eq(appSettings.key, 'security.login_method')),
        });
        if (!row?.value) return { loginMethod: dflt };
        return { loginMethod: JSON.parse(row.value) as 'username' | 'username_or_email' | 'email' };
      } catch {
        return { loginMethod: dflt };
      }
    }),

  // ── التحقق من صلاحية المسؤول (بدون إنشاء جلسة) ────────────────────────────
  // يُستخدم لحماية زر "تغيير المؤسسة" في شاشة الدخول
  verifyAdminPassword: publicProcedure
    .input(z.object({
      username: z.string().min(1),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const user = await db.query.users.findFirst({
        where: and(
          eq(users.username, input.username),
          eq(users.isActive, true),
        ),
      });

      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        throw new TRPCError({
          code:    'UNAUTHORIZED',
          message: 'المستخدم غير موجود أو لا يملك صلاحية المسؤول',
        });
      }

      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code:    'UNAUTHORIZED',
          message: 'كلمة المرور غير صحيحة',
        });
      }

      return { ok: true, name: user.name };
    }),
});
