import { z } from 'zod';
import { and, eq, sql, asc, ilike, or } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { hsLinkSections, hsLinks } from '../schema.js';

// ─── فحص صلاحية عرض شاشة الروابط والخدمات ────────────────────────────────────
function assertViewPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (!isAdmin && user.extraPermissions?.['hs_gov_links'] !== true) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية الوصول إلى شاشة الروابط والخدمات' });
  }
}

function assertManagePerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }, action: 'add' | 'edit' | 'delete' | 'sections') {
  assertViewPerm(user);
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return;
  const permMap: Record<string, string> = {
    add:      'hs_links_add',
    edit:     'hs_links_edit',
    delete:   'hs_links_delete',
    sections: 'hs_links_manage_sections',
  };
  if (user.extraPermissions?.[permMap[action]] !== true) {
    const labels: Record<string, string> = {
      add: 'إضافة الروابط', edit: 'تعديل الروابط',
      delete: 'حذف الروابط', sections: 'إدارة الأقسام',
    };
    throw new TRPCError({ code: 'FORBIDDEN', message: `ليس لديك صلاحية ${labels[action]}` });
  }
}

// ─── Schemas ──────────────────────────────────────────────────────────────────
const sectionInputSchema = z.object({
  name:      z.string().min(1).max(200),
  icon:      z.string().max(50).nullable().optional(),
  color:     z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().default(0),
});

const linkInputSchema = z.object({
  name:        z.string().min(1).max(200),
  url:         z.string().min(1),
  description: z.string().nullable().optional(),
  sectionId:   z.number().int().nullable().optional(),
  icon:        z.string().max(50).nullable().optional(),
  cardColor:   z.string().max(20).nullable().optional(),
  openMode:    z.enum(['internal', 'external']).default('external'),
  browserType: z.enum(['default', 'chrome', 'edge', 'firefox', 'custom']).default('default'),
  browserPath: z.string().nullable().optional(),
  isActive:    z.boolean().default(true),
  isFavorite:  z.boolean().default(false),
  isPinned:    z.boolean().default(false),
  sortOrder:   z.number().int().default(0),
});

export const linksServicesRouter = router({

  // ──────────────────────────── SECTIONS ──────────────────────────────────────

  listSections: protectedProcedure.query(async ({ ctx }) => {
    assertViewPerm(ctx.user);
    const rows = await db.execute(sql`
      SELECT
        s.id, s.name, s.icon, s.color, s.sort_order,
        s.created_at, s.updated_at,
        COUNT(l.id)::int AS link_count
      FROM hs_link_sections s
      LEFT JOIN hs_links l ON l.section_id = s.id AND l.org_id = ${ctx.user.orgId}
      WHERE s.org_id = ${ctx.user.orgId}
      GROUP BY s.id
      ORDER BY s.sort_order ASC, s.id ASC
    `);
    return rows.rows as Array<{
      id: number; name: string; icon: string | null; color: string | null;
      sort_order: number; created_at: string; updated_at: string; link_count: number;
    }>;
  }),

  createSection: protectedProcedure
    .input(sectionInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertManagePerm(ctx.user, 'sections');
      const [row] = await db.insert(hsLinkSections).values({
        orgId:     ctx.user.orgId,
        name:      input.name,
        icon:      input.icon ?? null,
        color:     input.color ?? null,
        sortOrder: input.sortOrder,
        createdBy: ctx.user.id,
      }).returning();
      return row;
    }),

  updateSection: protectedProcedure
    .input(z.object({ id: z.number().int() }).merge(sectionInputSchema))
    .mutation(async ({ ctx, input }) => {
      assertManagePerm(ctx.user, 'sections');
      const [row] = await db.update(hsLinkSections)
        .set({ name: input.name, icon: input.icon ?? null, color: input.color ?? null, sortOrder: input.sortOrder, updatedAt: new Date() })
        .where(and(eq(hsLinkSections.id, input.id), eq(hsLinkSections.orgId, ctx.user.orgId)))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'القسم غير موجود' });
      return row;
    }),

  deleteSection: protectedProcedure
    .input(z.object({ id: z.number().int(), force: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      assertManagePerm(ctx.user, 'sections');
      const count = await db.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM hs_links
        WHERE section_id = ${input.id} AND org_id = ${ctx.user.orgId}
      `);
      const cnt = (count.rows[0] as any).cnt as number;
      if (cnt > 0 && !input.force) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: `هذا القسم يحتوي على ${cnt} رابط. أكد الحذف لنقل الروابط إلى غير مصنف.` });
      }
      if (cnt > 0 && input.force) {
        await db.execute(sql`UPDATE hs_links SET section_id = NULL WHERE section_id = ${input.id} AND org_id = ${ctx.user.orgId}`);
      }
      await db.delete(hsLinkSections)
        .where(and(eq(hsLinkSections.id, input.id), eq(hsLinkSections.orgId, ctx.user.orgId)));
      return { ok: true };
    }),

  reorderSections: protectedProcedure
    .input(z.array(z.object({ id: z.number().int(), sortOrder: z.number().int() })))
    .mutation(async ({ ctx, input }) => {
      assertManagePerm(ctx.user, 'sections');
      for (const item of input) {
        await db.update(hsLinkSections)
          .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
          .where(and(eq(hsLinkSections.id, item.id), eq(hsLinkSections.orgId, ctx.user.orgId)));
      }
      return { ok: true };
    }),

  // ──────────────────────────── LINKS ─────────────────────────────────────────

  listLinks: protectedProcedure
    .input(z.object({
      sectionId: z.number().int().nullable().optional(),
      search:    z.string().optional(),
      filter:    z.enum(['all', 'active', 'inactive', 'favorite', 'pinned']).default('all'),
    }).optional())
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      const rows = await db.execute(sql`
        SELECT
          l.id, l.section_id, l.name, l.url, l.description,
          l.icon, l.card_color, l.open_mode, l.browser_type, l.browser_path,
          l.is_active, l.is_favorite, l.is_pinned, l.sort_order,
          l.created_at, l.updated_at,
          s.name AS section_name, s.color AS section_color, s.icon AS section_icon
        FROM hs_links l
        LEFT JOIN hs_link_sections s ON s.id = l.section_id
        WHERE l.org_id = ${ctx.user.orgId}
          ${input?.sectionId !== undefined
            ? (input.sectionId === null
              ? sql`AND l.section_id IS NULL`
              : sql`AND l.section_id = ${input.sectionId}`)
            : sql``}
          ${input?.filter === 'active'   ? sql`AND l.is_active = TRUE`   : sql``}
          ${input?.filter === 'inactive' ? sql`AND l.is_active = FALSE`  : sql``}
          ${input?.filter === 'favorite' ? sql`AND l.is_favorite = TRUE` : sql``}
          ${input?.filter === 'pinned'   ? sql`AND l.is_pinned = TRUE`   : sql``}
          ${input?.search ? sql`AND (l.name ILIKE ${'%' + input.search + '%'} OR l.description ILIKE ${'%' + input.search + '%'} OR l.url ILIKE ${'%' + input.search + '%'})` : sql``}
        ORDER BY l.is_pinned DESC, l.sort_order ASC, l.id ASC
      `);
      return rows.rows as Array<{
        id: number; section_id: number | null; name: string; url: string;
        description: string | null; icon: string | null; card_color: string | null;
        open_mode: string; browser_type: string; browser_path: string | null;
        is_active: boolean; is_favorite: boolean; is_pinned: boolean;
        sort_order: number; created_at: string; updated_at: string;
        section_name: string | null; section_color: string | null; section_icon: string | null;
      }>;
    }),

  getLink: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      const [row] = await db.select().from(hsLinks)
        .where(and(eq(hsLinks.id, input.id), eq(hsLinks.orgId, ctx.user.orgId)));
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'الرابط غير موجود' });
      return row;
    }),

  createLink: protectedProcedure
    .input(linkInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertManagePerm(ctx.user, 'add');
      const [row] = await db.insert(hsLinks).values({
        orgId:       ctx.user.orgId,
        sectionId:   input.sectionId ?? null,
        name:        input.name,
        url:         input.url,
        description: input.description ?? null,
        icon:        input.icon ?? null,
        cardColor:   input.cardColor ?? null,
        openMode:    input.openMode,
        browserType: input.browserType,
        browserPath: input.browserPath ?? null,
        isActive:    input.isActive,
        isFavorite:  input.isFavorite,
        isPinned:    input.isPinned,
        sortOrder:   input.sortOrder,
        createdBy:   ctx.user.id,
      }).returning();
      return row;
    }),

  updateLink: protectedProcedure
    .input(z.object({ id: z.number().int() }).merge(linkInputSchema))
    .mutation(async ({ ctx, input }) => {
      assertManagePerm(ctx.user, 'edit');
      const [row] = await db.update(hsLinks)
        .set({
          sectionId:   input.sectionId ?? null,
          name:        input.name,
          url:         input.url,
          description: input.description ?? null,
          icon:        input.icon ?? null,
          cardColor:   input.cardColor ?? null,
          openMode:    input.openMode,
          browserType: input.browserType,
          browserPath: input.browserPath ?? null,
          isActive:    input.isActive,
          isFavorite:  input.isFavorite,
          isPinned:    input.isPinned,
          sortOrder:   input.sortOrder,
          updatedAt:   new Date(),
        })
        .where(and(eq(hsLinks.id, input.id), eq(hsLinks.orgId, ctx.user.orgId)))
        .returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'الرابط غير موجود' });
      return row;
    }),

  deleteLink: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertManagePerm(ctx.user, 'delete');
      await db.delete(hsLinks)
        .where(and(eq(hsLinks.id, input.id), eq(hsLinks.orgId, ctx.user.orgId)));
      return { ok: true };
    }),

  toggleFavorite: protectedProcedure
    .input(z.object({ id: z.number().int(), isFavorite: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      await db.update(hsLinks)
        .set({ isFavorite: input.isFavorite, updatedAt: new Date() })
        .where(and(eq(hsLinks.id, input.id), eq(hsLinks.orgId, ctx.user.orgId)));
      return { ok: true };
    }),

  toggleActive: protectedProcedure
    .input(z.object({ id: z.number().int(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertManagePerm(ctx.user, 'edit');
      await db.update(hsLinks)
        .set({ isActive: input.isActive, updatedAt: new Date() })
        .where(and(eq(hsLinks.id, input.id), eq(hsLinks.orgId, ctx.user.orgId)));
      return { ok: true };
    }),

  togglePinned: protectedProcedure
    .input(z.object({ id: z.number().int(), isPinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      await db.update(hsLinks)
        .set({ isPinned: input.isPinned, updatedAt: new Date() })
        .where(and(eq(hsLinks.id, input.id), eq(hsLinks.orgId, ctx.user.orgId)));
      return { ok: true };
    }),

  moveToSection: protectedProcedure
    .input(z.object({ id: z.number().int(), sectionId: z.number().int().nullable() }))
    .mutation(async ({ ctx, input }) => {
      assertManagePerm(ctx.user, 'edit');
      await db.update(hsLinks)
        .set({ sectionId: input.sectionId, updatedAt: new Date() })
        .where(and(eq(hsLinks.id, input.id), eq(hsLinks.orgId, ctx.user.orgId)));
      return { ok: true };
    }),

  reorderLinks: protectedProcedure
    .input(z.array(z.object({ id: z.number().int(), sortOrder: z.number().int() })))
    .mutation(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      for (const item of input) {
        await db.update(hsLinks)
          .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
          .where(and(eq(hsLinks.id, item.id), eq(hsLinks.orgId, ctx.user.orgId)));
      }
      return { ok: true };
    }),
});
