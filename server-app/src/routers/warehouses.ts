import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { warehouses, warehouseAccountLinks, chartOfAccounts } from '../schema.js';
import { eq, and, asc } from 'drizzle-orm';
import { assertCanUpdate, assertCanDelete } from '../lib/foundation-framework.js';
import { checkWarehouseDeletion, recordWarehouseTombstone } from '../lib/delete-validation.js';

export const warehousesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.warehouses.findMany({
      where: and(eq(warehouses.orgId, ctx.user.orgId), eq(warehouses.isActive, true)),
      orderBy: (w, { asc }) => [asc(w.name)],
    });
  }),

  create: protectedProcedure
    .input(z.object({
      name:               z.string().min(1),
      code:               z.string().optional(),
      branchId:           z.number().optional(),
      name2:              z.string().optional(),
      fullName1:          z.string().optional(),
      fullName2:          z.string().optional(),
      description:        z.string().optional(),
      invAccountId:       z.number().optional(),
      cogsAccount1Id:     z.number().optional(),
      cogsAccount2Id:     z.number().optional(),
      cashAccountId:      z.number().optional(),
      bankAccountId:      z.number().optional(),
      salesAccount1Id:    z.number().optional(),
      allowedUserId:      z.number().optional(),
      allowedUserGroup:   z.string().optional(),
      copyFromWarehouseId:z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { description, ...rest } = input;
      const [w] = await db.insert(warehouses).values({ ...rest, address: description, orgId: ctx.user.orgId, isActive: true }).returning();
      return w;
    }),

  update: protectedProcedure
    .input(z.object({
      id:                 z.number(),
      name:               z.string().optional(),
      code:               z.string().optional(),
      branchId:           z.number().optional(),
      name2:              z.string().optional(),
      fullName1:          z.string().optional(),
      fullName2:          z.string().optional(),
      description:        z.string().optional(),
      invAccountId:       z.number().optional(),
      cogsAccount1Id:     z.number().optional(),
      cogsAccount2Id:     z.number().optional(),
      cashAccountId:      z.number().optional(),
      bankAccountId:      z.number().optional(),
      salesAccount1Id:    z.number().optional(),
      allowedUserId:      z.number().optional(),
      allowedUserGroup:   z.string().optional(),
      copyFromWarehouseId:z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, description, ...rest } = input;
      const current = await db.query.warehouses.findFirst({
        where: and(eq(warehouses.id, id), eq(warehouses.orgId, ctx.user.orgId)),
      });
      if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'المخزن غير موجود' });
      assertCanUpdate(current.recordPolicy, current.name, ctx.user.role === 'superadmin');
      await db.update(warehouses).set({ ...rest, address: description } as any)
        .where(and(eq(warehouses.id, id), eq(warehouses.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const current = await db.query.warehouses.findFirst({
        where: and(eq(warehouses.id, input.id), eq(warehouses.orgId, ctx.user.orgId)),
      });
      if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'المخزن غير موجود' });
      assertCanDelete(current.recordPolicy, current.name, ctx.user.role === 'superadmin');

      const check = await checkWarehouseDeletion(input.id, ctx.user.orgId);

      // حالة 1: هناك حركات فعلية → امنع الحذف، اعرض التفاصيل
      if (check.hasMovements) {
        const details = check.movements.map(m => `${m.label}: ${m.count}`).join('، ');
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `لا يمكن حذف المخزن "${current.name}" لوجود حركات مرتبطة به:\n${details}\n\nيمكنك تعطيل المخزن بدلاً من حذفه.`,
        });
      }

      // حالة 2: هناك روابط فقط → اسمح بعد تأكيد المستخدم
      if (check.hasLinksOnly) {
        const details = check.links.map(l => `${l.label}: ${l.count}`).join('، ');
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `المخزن "${current.name}" مرتبط بـ:\n${details}\n\nيجب نقل هذه الارتباطات إلى مخزن آخر قبل الحذف.`,
        });
      }

      // حالة 3: لا شيء → احذف وسجّل Tombstone
      await db.update(warehouses).set({ isActive: false } as any)
        .where(and(eq(warehouses.id, input.id), eq(warehouses.orgId, ctx.user.orgId)));

      // سجّل Tombstone للدفاتر التأسيسية
      if (current.foundationKey && current.includeInFoundation) {
        await recordWarehouseTombstone(input.id, ctx.user.orgId, ctx.user.id);
      }

      return { success: true };
    }),

  accountLinks: router({
    list: protectedProcedure
      .input(z.object({ warehouseId: z.number() }))
      .query(async ({ input }) => {
        return db.select().from(warehouseAccountLinks)
          .where(eq(warehouseAccountLinks.warehouseId, input.warehouseId))
          .orderBy(warehouseAccountLinks.sortOrder);
      }),

    listAll: protectedProcedure.query(async ({ ctx }) => {
      return db
        .select({
          id:            warehouseAccountLinks.id,
          warehouseId:   warehouseAccountLinks.warehouseId,
          label:         warehouseAccountLinks.label,
          accountId:     warehouseAccountLinks.accountId,
          sortOrder:     warehouseAccountLinks.sortOrder,
          accountCode:   chartOfAccounts.code,
          accountName:   chartOfAccounts.name,
          warehouseName: warehouses.name,
        })
        .from(warehouseAccountLinks)
        .innerJoin(warehouses, and(
          eq(warehouses.id, warehouseAccountLinks.warehouseId),
          eq(warehouses.orgId, ctx.user.orgId),
        ))
        .leftJoin(chartOfAccounts, eq(chartOfAccounts.id, warehouseAccountLinks.accountId))
        .orderBy(warehouses.name, warehouseAccountLinks.sortOrder);
    }),

    save: protectedProcedure
      .input(z.object({
        warehouseId: z.number(),
        links: z.array(z.object({
          id:        z.number().optional(),
          label:     z.string().min(1),
          accountId: z.number().nullable().optional(),
          sortOrder: z.number().default(0),
        })),
      }))
      .mutation(async ({ input }) => {
        await db.delete(warehouseAccountLinks).where(eq(warehouseAccountLinks.warehouseId, input.warehouseId));
        if (input.links.length > 0) {
          await db.insert(warehouseAccountLinks).values(
            input.links.map((l, i) => ({
              warehouseId: input.warehouseId,
              label:       l.label,
              accountId:   l.accountId ?? null,
              sortOrder:   i,
            }))
          );
        }
        return { success: true };
      }),
  }),
});
