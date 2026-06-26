import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { stockVouchers, stockVoucherItems, inventory, inventoryCounts, inventoryCountItems, products } from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';

export const stockVouchersRouter = router({
  list: protectedProcedure
    .input(z.object({ type: z.enum(['receipt', 'issue', 'transfer']).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [eq(stockVouchers.orgId, ctx.user.orgId)];
      if (input?.type) conds.push(eq(stockVouchers.type, input.type));
      return db.query.stockVouchers.findMany({
        where: and(...conds),
        orderBy: [desc(stockVouchers.createdAt)],
        limit: 200,
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const v = await db.query.stockVouchers.findFirst({
        where: and(eq(stockVouchers.id, input.id), eq(stockVouchers.orgId, ctx.user.orgId)),
      });
      if (!v) throw new Error('السند غير موجود');
      const items = await db.query.stockVoucherItems.findMany({ where: eq(stockVoucherItems.voucherId, input.id) });
      return { ...v, items };
    }),

  create: protectedProcedure
    .input(z.object({
      type:        z.enum(['receipt', 'issue', 'transfer']),
      warehouseId: z.number(),
      branchId:    z.number(),
      supplierId:  z.number().optional(),
      reason:      z.string().optional(),
      notes:       z.string().optional(),
      items: z.array(z.object({
        productId:   z.number(),
        productName: z.string(),
        quantity:    z.string(),
        unitCost:    z.string(),
        totalCost:   z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { items, ...rest } = input;
      const totalCost = items.reduce((s, i) => s + Number(i.totalCost), 0).toFixed(4);

      const last = await db.query.stockVouchers.findFirst({
        where: eq(stockVouchers.orgId, ctx.user.orgId),
        orderBy: [desc(stockVouchers.id)],
      });
      const num    = last ? parseInt(last.voucherNumber.replace(/\D/g, '') || '0') + 1 : 1;
      const prefix = rest.type === 'receipt' ? 'SV-IN' : rest.type === 'issue' ? 'SV-OUT' : 'SV-TR';
      const voucherNumber = `${prefix}-${String(num).padStart(4, '0')}`;

      const [v] = await db.insert(stockVouchers).values({
        ...rest, orgId: ctx.user.orgId, userId: ctx.user.id, voucherNumber, totalCost, status: 'confirmed',
      }).returning();

      if (items.length > 0) {
        await db.insert(stockVoucherItems).values(
          items.map((item, i) => ({ ...item, voucherId: v.id, orgId: ctx.user.orgId, sortOrder: i }))
        );
      }

      // تحديث المخزون
      for (const item of items) {
        const existing = await db.query.inventory.findFirst({
          where: and(eq(inventory.orgId, ctx.user.orgId), eq(inventory.productId, item.productId), eq(inventory.warehouseId, rest.warehouseId)),
        });
        const qty  = Number(item.quantity);
        const diff = rest.type === 'receipt' ? qty : -qty;
        if (existing) {
          await db.update(inventory)
            .set({ quantity: String(Number(existing.quantity) + diff), updatedAt: new Date() })
            .where(eq(inventory.id, existing.id));
        } else {
          await db.insert(inventory).values({
            orgId: ctx.user.orgId, productId: item.productId,
            warehouseId: rest.warehouseId, quantity: String(Math.max(0, diff)), avgCost: item.unitCost,
          });
        }
      }
      return v;
    }),
});

export const inventoryCountRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.inventoryCounts.findMany({
      where: eq(inventoryCounts.orgId, ctx.user.orgId),
      orderBy: [desc(inventoryCounts.createdAt)],
      limit: 100,
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const count = await db.query.inventoryCounts.findFirst({
        where: and(eq(inventoryCounts.id, input.id), eq(inventoryCounts.orgId, ctx.user.orgId)),
      });
      if (!count) throw new Error('جلسة الجرد غير موجودة');
      const items = await db.query.inventoryCountItems.findMany({
        where: eq(inventoryCountItems.countId, input.id),
        orderBy: (i, { asc }) => [asc(i.sortOrder)],
      });
      return { ...count, items };
    }),

  create: protectedProcedure
    .input(z.object({
      warehouseId: z.number(),
      branchId:    z.number().optional(),
      notes:       z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const last = await db.query.inventoryCounts.findFirst({
        where: eq(inventoryCounts.orgId, ctx.user.orgId),
        orderBy: [desc(inventoryCounts.id)],
      });
      const num         = last ? parseInt(last.countNumber.replace(/\D/g, '') || '0') + 1 : 1;
      const countNumber = `CNT-${String(num).padStart(4, '0')}`;
      const [count]     = await db.insert(inventoryCounts).values({
        ...input, orgId: ctx.user.orgId, userId: ctx.user.id, countNumber, status: 'draft',
      }).returning();

      const invItems = await db.query.inventory.findMany({
        where: and(eq(inventory.orgId, ctx.user.orgId), eq(inventory.warehouseId, input.warehouseId)),
      });
      if (invItems.length > 0) {
        const prods   = await db.query.products.findMany({ where: eq(products.orgId, ctx.user.orgId) });
        const prodMap = new Map(prods.map(p => [p.id, p]));
        await db.insert(inventoryCountItems).values(
          invItems.map((inv, i) => ({
            countId:        count.id,
            orgId:          ctx.user.orgId,
            productId:      inv.productId,
            productName:    prodMap.get(inv.productId)?.name ?? `#${inv.productId}`,
            systemQuantity: inv.quantity,
            actualQuantity: inv.quantity,
            difference:     '0',
            sortOrder:      i,
          }))
        );
      }
      return count.id;
    }),

  updateItem: protectedProcedure
    .input(z.object({ id: z.number(), actualQuantity: z.string() }))
    .mutation(async ({ input }) => {
      const item = await db.query.inventoryCountItems.findFirst({ where: eq(inventoryCountItems.id, input.id) });
      if (!item) throw new Error('العنصر غير موجود');
      const diff = (Number(input.actualQuantity) - Number(item.systemQuantity)).toFixed(4);
      await db.update(inventoryCountItems)
        .set({ actualQuantity: input.actualQuantity, difference: diff })
        .where(eq(inventoryCountItems.id, input.id));
      return { success: true };
    }),

  confirm: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const count = await db.query.inventoryCounts.findFirst({
        where: and(eq(inventoryCounts.id, input.id), eq(inventoryCounts.orgId, ctx.user.orgId)),
      });
      if (!count) throw new Error('جلسة الجرد غير موجودة');
      if (count.status !== 'draft') throw new Error('تم تأكيد الجرد مسبقاً');
      const items = await db.query.inventoryCountItems.findMany({ where: eq(inventoryCountItems.countId, input.id) });
      for (const item of items) {
        if (!item.productId || !count.warehouseId) continue;
        const existing = await db.query.inventory.findFirst({
          where: and(eq(inventory.orgId, ctx.user.orgId), eq(inventory.productId, item.productId), eq(inventory.warehouseId, count.warehouseId)),
        });
        if (existing) {
          await db.update(inventory).set({ quantity: item.actualQuantity, updatedAt: new Date() }).where(eq(inventory.id, existing.id));
        } else {
          await db.insert(inventory).values({ orgId: ctx.user.orgId, productId: item.productId, warehouseId: count.warehouseId, quantity: item.actualQuantity });
        }
      }
      await db.update(inventoryCounts).set({ status: 'confirmed', confirmedAt: new Date() }).where(eq(inventoryCounts.id, input.id));
      return { success: true };
    }),
});
