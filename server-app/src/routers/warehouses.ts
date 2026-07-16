import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { warehouses, inventory, stockVouchers, inventoryCounts, salesInvoices, warehouseAccountLinks, chartOfAccounts } from '../schema.js';
import { eq, and, asc } from 'drizzle-orm';
import { assertCanUpdate, assertCanDelete } from '../lib/foundation-framework.js';

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

      const [hasInventory, hasVouchers, hasInventoryCounts, hasSalesInvoices] = await Promise.all([
        db.select({ id: inventory.id }).from(inventory)
          .where(and(eq(inventory.warehouseId, input.id), eq(inventory.orgId, ctx.user.orgId))).limit(1),
        db.select({ id: stockVouchers.id }).from(stockVouchers)
          .where(and(eq(stockVouchers.warehouseId, input.id), eq(stockVouchers.orgId, ctx.user.orgId))).limit(1),
        db.select({ id: inventoryCounts.id }).from(inventoryCounts)
          .where(and(eq(inventoryCounts.warehouseId, input.id), eq(inventoryCounts.orgId, ctx.user.orgId))).limit(1),
        db.select({ id: salesInvoices.id }).from(salesInvoices)
          .where(and(eq(salesInvoices.warehouseId, input.id), eq(salesInvoices.orgId, ctx.user.orgId))).limit(1),
      ]);
      if (hasInventory.length > 0)       throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف المخزن لأنه مرتبط بمنتجات في المخزون' });
      if (hasVouchers.length > 0)        throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف المخزن لأنه مرتبط بحركات مخزنية' });
      if (hasInventoryCounts.length > 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف المخزن لأنه مرتبط بعمليات جرد مخزني' });
      if (hasSalesInvoices.length > 0)   throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف المخزن لأنه مرتبط بفواتير مبيعات' });
      await db.update(warehouses).set({ isActive: false } as any)
        .where(and(eq(warehouses.id, input.id), eq(warehouses.orgId, ctx.user.orgId)));
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
