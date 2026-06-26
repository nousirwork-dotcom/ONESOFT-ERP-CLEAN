import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { salesInvoices, salesInvoiceItems, products, stockVouchers } from '../schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';

export const dashboardRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const orgId     = ctx.user.orgId;
    const now       = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayRows, monthRows, productCountRow, pendingTransferRow] = await Promise.all([
      db.select({
        total: sql<string>`coalesce(sum(${salesInvoices.total}), 0)`,
        count: sql<string>`count(*)`,
      }).from(salesInvoices).where(and(
        eq(salesInvoices.orgId, orgId),
        sql`${salesInvoices.invoiceDate} >= ${todayStart}`,
        sql`${salesInvoices.invoiceType} = 'sale'`,
        sql`${salesInvoices.status} != 'cancelled'`,
      )),
      db.select({
        total: sql<string>`coalesce(sum(${salesInvoices.total}), 0)`,
        count: sql<string>`count(*)`,
      }).from(salesInvoices).where(and(
        eq(salesInvoices.orgId, orgId),
        sql`${salesInvoices.invoiceDate} >= ${monthStart}`,
        sql`${salesInvoices.invoiceType} = 'sale'`,
        sql`${salesInvoices.status} != 'cancelled'`,
      )),
      db.select({ count: sql<string>`count(*)` }).from(products)
        .where(and(eq(products.orgId, orgId), eq(products.isActive, true))),
      db.select({ count: sql<string>`count(*)` }).from(stockVouchers)
        .where(and(eq(stockVouchers.orgId, orgId), sql`${stockVouchers.type}::text = 'transfer'`, eq(stockVouchers.status, 'draft'))),
    ]);

    return {
      todaySales:       Number(todayRows[0]?.total   ?? 0),
      todayInvoices:    Number(todayRows[0]?.count   ?? 0),
      monthSales:       Number(monthRows[0]?.total   ?? 0),
      monthInvoices:    Number(monthRows[0]?.count   ?? 0),
      productCount:     Number(productCountRow[0]?.count ?? 0),
      pendingTransfers: Number(pendingTransferRow[0]?.count ?? 0),
    };
  }),

  salesChart: protectedProcedure
    .input(z.object({ days: z.number().default(7) }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const since = new Date();
      since.setDate(since.getDate() - input.days);
      const rows = await db.select({
        date:  sql<string>`date_trunc('day', ${salesInvoices.invoiceDate})::date`,
        total: sql<string>`coalesce(sum(${salesInvoices.total}), 0)`,
        count: sql<string>`count(*)`,
      }).from(salesInvoices).where(and(
        eq(salesInvoices.orgId, orgId),
        sql`${salesInvoices.invoiceDate} >= ${since}`,
        sql`${salesInvoices.invoiceType} = 'sale'`,
        sql`${salesInvoices.status} != 'cancelled'`,
      ))
        .groupBy(sql`date_trunc('day', ${salesInvoices.invoiceDate})::date`)
        .orderBy(sql`date_trunc('day', ${salesInvoices.invoiceDate})::date`);
      return rows.map(r => ({ date: r.date, total: Number(r.total), count: Number(r.count) }));
    }),

  topProducts: protectedProcedure
    .input(z.object({ limit: z.number().default(5) }))
    .query(async ({ ctx, input }) => {
      const orgId      = ctx.user.orgId;
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const rows = await db.select({
        productId:    salesInvoiceItems.productId,
        productName:  salesInvoiceItems.productName,
        totalQty:     sql<string>`sum(${salesInvoiceItems.quantity})`,
        totalRevenue: sql<string>`sum(${salesInvoiceItems.total})`,
      }).from(salesInvoiceItems)
        .innerJoin(salesInvoices, eq(salesInvoiceItems.invoiceId, salesInvoices.id))
        .where(and(
          eq(salesInvoices.orgId, orgId),
          sql`${salesInvoices.invoiceDate} >= ${monthStart}`,
          sql`${salesInvoices.invoiceType} = 'sale'`,
          sql`${salesInvoices.status} != 'cancelled'`,
        ))
        .groupBy(salesInvoiceItems.productId, salesInvoiceItems.productName)
        .orderBy(desc(sql`sum(${salesInvoiceItems.total})`))
        .limit(input.limit);
      return rows.map(r => ({
        productId:    r.productId,
        productName:  r.productName,
        totalQty:     Number(r.totalQty),
        totalRevenue: Number(r.totalRevenue),
      }));
    }),
});
