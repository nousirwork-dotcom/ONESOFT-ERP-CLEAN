import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { appSettings } from '../schema.js';
import { eq, and } from 'drizzle-orm';

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
      const orgId = ctx.user.orgId;
      const serialized = JSON.stringify(input.value);
      const existing = await db.select({ id: appSettings.id }).from(appSettings)
        .where(and(eq(appSettings.orgId, orgId), eq(appSettings.key, input.key)))
        .limit(1);
      if (existing.length) {
        await db.update(appSettings)
          .set({ value: serialized, updatedAt: new Date() })
          .where(and(eq(appSettings.orgId, orgId), eq(appSettings.key, input.key)));
      } else {
        await db.insert(appSettings).values({ orgId, key: input.key, value: serialized });
      }
      return { success: true };
    }),
});
