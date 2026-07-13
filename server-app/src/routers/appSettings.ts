import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { db } from '../db.js';
import { appSettings } from '../schema.js';
import { eq, and, sql } from 'drizzle-orm';

export const appSettingsRouter = router({

  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input, ctx }) => {
      const rows = await db.select().from(appSettings)
        .where(and(eq(appSettings.orgId, ctx.user.orgId), eq(appSettings.key, input.key)))
        .limit(1);
      if (!rows.length) return null;
      try { return JSON.parse(rows[0].value ?? 'null'); } catch { return null; }
    }),

  set: protectedProcedure
    .input(z.object({ key: z.string(), value: z.any() }))
    .mutation(async ({ input, ctx }) => {
      // ── مفاتيح محجوزة: تُكتب فقط عبر راوتر uiPrefs (عزل لكل مستخدم) ─────────
      if (input.key.startsWith('ui_prefs.') || input.key === 'ui.default_layout_mode') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'هذا المفتاح محجوز لتفضيلات الواجهة ولا يُعدَّل مباشرة',
        });
      }

      // ── مفاتيح الأمان: للمديرين فقط ────────────────────────────────────────
      if (input.key.startsWith('security.') &&
          ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'إعدادات الأمان متاحة لمديري النظام فقط',
        });
      }

      const orgId = ctx.user.orgId;
      const serialized = JSON.stringify(input.value);
      // upsert ذرّي — يعتمد على القيد الفريد (org_id, key)
      await db.insert(appSettings)
        .values({ orgId, key: input.key, value: serialized })
        .onConflictDoUpdate({
          target: [appSettings.orgId, appSettings.key],
          set: { value: serialized, updatedAt: sql`now()` },
        });
      return { success: true };
    }),
});
