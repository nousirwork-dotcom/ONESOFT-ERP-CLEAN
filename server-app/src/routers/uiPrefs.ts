import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { db } from '../db.js';
import { appSettings } from '../schema.js';
import { eq, and, sql } from 'drizzle-orm';

// ─── تفضيلات واجهة المستخدم (لكل مستخدم) ────────────────────────────────────
// تُخزَّن في app_settings بمفتاح مشتق من هوية المستخدم على الخادم
// (لا يستطيع المستخدم الكتابة على تفضيلات مستخدم آخر).

const LAYOUT_MODES = ['vertical', 'horizontal', 'apps'] as const;

const uiPrefsSchema = z.object({
  layoutMode: z.enum(LAYOUT_MODES).optional(),
  favorites: z.array(z.object({
    path: z.string().max(200),
    label: z.string().max(200),
  })).max(50).optional(),
  recents: z.array(z.object({
    path: z.string().max(200),
    label: z.string().max(200),
    ts: z.number(),
  })).max(20).optional(),
});

const userKey = (userId: number) => `ui_prefs.user.${userId}`;
const ORG_DEFAULT_KEY = 'ui.default_layout_mode';

async function readSetting(orgId: number, key: string): Promise<unknown> {
  const rows = await db.select().from(appSettings)
    .where(and(eq(appSettings.orgId, orgId), eq(appSettings.key, key)))
    .limit(1);
  if (!rows.length) return null;
  try { return JSON.parse(rows[0].value ?? 'null'); } catch { return null; }
}

async function writeSetting(orgId: number, key: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value);
  await db.insert(appSettings)
    .values({ orgId, key, value: serialized })
    .onConflictDoUpdate({
      target: [appSettings.orgId, appSettings.key],
      set: { value: serialized, updatedAt: sql`now()` },
    });
}

export const uiPrefsRouter = router({

  get: protectedProcedure.query(async ({ ctx }) => {
    const [prefs, orgDefault] = await Promise.all([
      readSetting(ctx.user.orgId, userKey(ctx.user.id)),
      readSetting(ctx.user.orgId, ORG_DEFAULT_KEY),
    ]);
    const parsed = uiPrefsSchema.safeParse(prefs ?? {});
    return {
      prefs: parsed.success ? parsed.data : {},
      orgDefaultLayoutMode: LAYOUT_MODES.includes(orgDefault as any)
        ? (orgDefault as typeof LAYOUT_MODES[number])
        : null,
    };
  }),

  save: protectedProcedure
    .input(uiPrefsSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await readSetting(ctx.user.orgId, userKey(ctx.user.id));
      const parsed = uiPrefsSchema.safeParse(existing ?? {});
      const merged = { ...(parsed.success ? parsed.data : {}), ...input };
      await writeSetting(ctx.user.orgId, userKey(ctx.user.id), merged);
      return { success: true };
    }),

  setOrgDefault: protectedProcedure
    .input(z.object({ layoutMode: z.enum(LAYOUT_MODES) }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'تحديد طريقة العرض الافتراضية متاح لمديري النظام فقط',
        });
      }
      await writeSetting(ctx.user.orgId, ORG_DEFAULT_KEY, input.layoutMode);
      return { success: true };
    }),
});
