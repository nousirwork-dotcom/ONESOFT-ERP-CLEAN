/**
 * reUnits.ts — الوحدات السكنية (مرحلة 1 من المطور العقاري)
 * CRUD للوحدات السكنية مع البحث والتصفية والإجراءات
 */
import { z } from 'zod';
import { and, eq, desc, ilike, or, count, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { reHousingUnits, reProjects } from '../schema.js';

// ─── Permissions ─────────────────────────────────────────────────────────
function assertViewPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_units'] !== true && user.extraPermissions?.['help_services'] !== true) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية الوصول إلى الوحدات السكنية' });
  }
}
function assertAddPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user); const isAdmin = ['admin', 'superadmin'].includes(user.role); if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_units_add'] !== true) throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية الإضافة' });
}
function assertEditPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user); const isAdmin = ['admin', 'superadmin'].includes(user.role); if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_units_edit'] !== true) throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية التعديل' });
}
function assertDeletePerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user); const isAdmin = ['admin', 'superadmin'].includes(user.role); if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_units_delete'] !== true) throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية الحذف' });
}

// ─── Input schemas ─────────────────────────────────────────────────────────────
const unitInputSchema = z.object({
  projectId:    z.number().nullable().optional(),
  unitNo:         z.string().min(1).max(50),
  unitType:       z.string().max(30).default('apartment'),
  status:         z.string().max(20).default('available'),
  area:           z.number().nullable().optional(),
  price:          z.number().nullable().optional(),
  floor:          z.string().max(20).nullable().optional(),
  block:          z.string().max(30).nullable().optional(),
  building:       z.string().max(30).nullable().optional(),
  notes:          z.string().nullable().optional(),
});

// ─── Router ─────────────────────────────────────────────────────────────────
export const reUnitsRouter = router({
  list: protectedProcedure
    .input(z.object({
      q: z.string().optional(),
      projectId: z.number().nullable().optional(),
      status: z.string().optional(),
      unitType: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      const orgId = ctx.user.orgId;
      const conditions: any[] = [eq(reHousingUnits.orgId, orgId)];
      if (input?.projectId !== undefined && input.projectId !== null) {
        conditions.push(eq(reHousingUnits.projectId, input.projectId));
      }
      if (input?.status) conditions.push(eq(reHousingUnits.status, input.status));
      if (input?.unitType) conditions.push(eq(reHousingUnits.unitType, input.unitType));
      if (input?.q?.trim()) {
        const q = `%${input.q.trim()}%`;
        conditions.push(or(
          ilike(reHousingUnits.unitNo, q),
          ilike(reHousingUnits.block, q),
          ilike(reHousingUnits.building, q),
          ilike(reHousingUnits.floor, q),
          ilike(reHousingUnits.notes, q),
        ));
      }
      const total = await db.select({ count: count() }).from(reHousingUnits).where(and(...conditions)).then(r => Number(r[0]?.count ?? 0));
      const items = await db.select().from(reHousingUnits)
        .where(and(...conditions))
        .orderBy(desc(reHousingUnits.createdAt))
        .limit(input?.limit ?? 100)
        .offset(input?.offset ?? 0);
      return { items, total };
    }),

  getById: protectedProcedure
    .input(z.number())
    .query(async ({ ctx, input: id }) => {
      assertViewPerm(ctx.user);
      const rows = await db.select().from(reHousingUnits)
        .where(and(eq(reHousingUnits.id, id), eq(reHousingUnits.orgId, ctx.user.orgId)))
        .limit(1);
      if (!rows[0]) throw new TRPCError({ code: 'NOT_FOUND', message: 'الوحدة غير موجودة' });
      return rows[0];
    }),

  create: protectedProcedure
    .input(unitInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertAddPerm(ctx.user);
      const orgId = ctx.user.orgId;
      const userId = ctx.user.id;
      const [row] = await db.insert(reHousingUnits).values({
        orgId,
        projectId: input.projectId ?? null,
        unitNo: input.unitNo,
        unitType: input.unitType,
        status: input.status,
        area: input.area !== undefined && input.area !== null ? String(input.area) : null,
        price: input.price !== undefined && input.price !== null ? String(input.price) : null,
        floor: input.floor ?? null,
        block: input.block ?? null,
        building: input.building ?? null,
        notes: input.notes ?? null,
        createdBy: userId,
        updatedBy: userId,
      }).returning();
      return row;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number() }).merge(unitInputSchema.partial()))
    .mutation(async ({ ctx, input }) => {
      assertEditPerm(ctx.user);
      const orgId = ctx.user.orgId;
      const userId = ctx.user.id;
      const { id, ...patch } = input;
      const existing = await db.select().from(reHousingUnits)
        .where(and(eq(reHousingUnits.id, id), eq(reHousingUnits.orgId, orgId)))
        .limit(1);
      if (!existing[0]) throw new TRPCError({ code: 'NOT_FOUND', message: 'الوحدة غير موجودة' });
      const setData: any = { updatedBy: userId };
      if (patch.projectId !== undefined) setData.projectId = patch.projectId ?? null;
      if (patch.unitNo !== undefined) setData.unitNo = patch.unitNo;
      if (patch.unitType !== undefined) setData.unitType = patch.unitType;
      if (patch.status !== undefined) setData.status = patch.status;
      if (patch.area !== undefined) setData.area = patch.area !== null ? String(patch.area) : null;
      if (patch.price !== undefined) setData.price = patch.price !== null ? String(patch.price) : null;
      if (patch.floor !== undefined) setData.floor = patch.floor ?? null;
      if (patch.block !== undefined) setData.block = patch.block ?? null;
      if (patch.building !== undefined) setData.building = patch.building ?? null;
      if (patch.notes !== undefined) setData.notes = patch.notes ?? null;
      const [row] = await db.update(reHousingUnits).set(setData).where(eq(reHousingUnits.id, id)).returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: id }) => {
      assertDeletePerm(ctx.user);
      const orgId = ctx.user.orgId;
      const existing = await db.select().from(reHousingUnits)
        .where(and(eq(reHousingUnits.id, id), eq(reHousingUnits.orgId, orgId)))
        .limit(1);
      if (!existing[0]) throw new TRPCError({ code: 'NOT_FOUND', message: 'الوحدة غير موجودة' });
      await db.delete(reHousingUnits).where(eq(reHousingUnits.id, id));
      return { id };
    }),

  projects: protectedProcedure.query(async ({ ctx }) => {
    assertViewPerm(ctx.user);
    const rows = await db.select({ id: reProjects.id, name: reProjects.name, code: reProjects.code })
      .from(reProjects)
      .where(eq(reProjects.orgId, ctx.user.orgId))
      .orderBy(desc(reProjects.createdAt));
    return rows;
  }),
});
