import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { db } from '../db.js';
import { users } from '../schema.js';
import { and, eq } from 'drizzle-orm';
import { verifyPassword } from '../auth.js';

export const authRouter = router({

  me: publicProcedure.query(async ({ ctx }) => {
    return ctx.user ? {
      id:               ctx.user.id,
      name:             ctx.user.name,
      username:         ctx.user.username,
      role:             ctx.user.role,
      orgId:            ctx.user.orgId,
      extraPermissions: (ctx.user.extraPermissions ?? {}) as Record<string, boolean>,
    } : null;
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
