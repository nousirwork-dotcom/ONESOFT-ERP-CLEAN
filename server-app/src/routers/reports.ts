import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { inventory, products, warehouses, stockVouchers } from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';

export const reportsRouter = router({
  stockByWarehouse: protectedProcedure
    .input(z.object({ warehouseId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [eq(inventory.orgId, ctx.user.orgId)];
      if (input?.warehouseId) conds.push(eq(inventory.warehouseId, input.warehouseId));
      const [invRows, prods, warehouseList] = await Promise.all([
        db.query.inventory.findMany({ where: and(...conds) }),
        db.query.products.findMany({ where: eq(products.orgId, ctx.user.orgId) }),
        db.query.warehouses.findMany({ where: eq(warehouses.orgId, ctx.user.orgId) }),
      ]);
      const prodMap = new Map(prods.map(p => [p.id, p]));
      const whMap   = new Map(warehouseList.map(w => [w.id, w]));
      return invRows.map(r => {
        const p          = prodMap.get(r.productId);
        const costPrice  = r.avgCost ?? p?.purchasePrice ?? '0';
        const totalValue = Number(r.quantity) * Number(costPrice);
        return {
          productId:     r.productId,
          productName:   p?.name ?? `#${r.productId}`,
          warehouseId:   r.warehouseId,
          warehouseName: whMap.get(r.warehouseId ?? 0)?.name ?? `#${r.warehouseId}`,
          totalQuantity: r.quantity,
          costPrice,
          totalValue:    totalValue.toFixed(4),
          minStock:      p?.minStock ?? '0',
          isLow:         Number(r.quantity) < Number(p?.minStock ?? 0),
        };
      });
    }),

  voucherSummary: protectedProcedure.query(async ({ ctx }) => {
    const all = await db.query.stockVouchers.findMany({ where: eq(stockVouchers.orgId, ctx.user.orgId) });
    const grouped: Record<string, { type: string; count: number; totalCost: number }> = {};
    for (const v of all) {
      if (!grouped[v.type]) grouped[v.type] = { type: v.type, count: 0, totalCost: 0 };
      grouped[v.type].count++;
      grouped[v.type].totalCost += Number(v.totalCost ?? 0);
    }
    return Object.values(grouped).map(g => ({ ...g, totalCost: g.totalCost.toFixed(4) }));
  }),

  lowStockAlert: protectedProcedure.query(async ({ ctx }) => {
    const [invRows, prods, warehouseList] = await Promise.all([
      db.query.inventory.findMany({ where: eq(inventory.orgId, ctx.user.orgId) }),
      db.query.products.findMany({ where: and(eq(products.orgId, ctx.user.orgId), eq(products.isActive, true)) }),
      db.query.warehouses.findMany({ where: eq(warehouses.orgId, ctx.user.orgId) }),
    ]);
    const prodMap = new Map(prods.map(p => [p.id, p]));
    const whMap   = new Map(warehouseList.map(w => [w.id, w]));
    return invRows.filter(r => {
      const p = prodMap.get(r.productId);
      return p && Number(r.quantity) < Number(p.minStock ?? 0);
    }).map(r => {
      const p = prodMap.get(r.productId)!;
      return {
        productId:    r.productId,
        productName:  p.name,
        warehouseName:whMap.get(r.warehouseId ?? 0)?.name ?? `#${r.warehouseId}`,
        quantity:     r.quantity,
        minQuantity:  p.minStock,
      };
    });
  }),
});
