import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { purchaseInvoiceItems, products, salesInvoiceItems, taxDefinitions } from '../schema.js';
import { and, asc, eq, ne, sql } from 'drizzle-orm';

const taxInput = z.object({
  name: z.string().trim().min(1, 'يرجى إدخال اسم الضريبة أو الرسم'),
  code: z.string().trim().min(1, 'يرجى إدخال كود الضريبة أو الرسم').max(50),
  category: z.enum(['tax', 'withholding', 'fee']).default('tax'),
  // Fixed values are not supported by the invoice calculation engine yet.
  valueType: z.literal('percentage').default('percentage'),
  value: z.string().trim().regex(/^\d+(\.\d{1,4})?$/, 'أدخل قيمة رقمية صحيحة'),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
  effectiveFrom: z.string().optional(),
});

async function assertCodeAvailable(orgId: number, code: string, excludeId?: number) {
  const existing = await db.query.taxDefinitions.findFirst({
    where: and(
      eq(taxDefinitions.orgId, orgId),
      eq(taxDefinitions.code, code),
      excludeId ? ne(taxDefinitions.id, excludeId) : undefined,
    ),
    columns: { id: true },
  });
  if (existing) {
    throw new TRPCError({ code: 'CONFLICT', message: 'كود الضريبة أو الرسم مستخدم من قبل' });
  }
}

async function getUsage(id: number, orgId: number) {
  const [productUsage, salesUsage, purchaseUsage] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(products)
      .where(and(eq(products.orgId, orgId), eq(products.taxId, id))),
    db.select({ count: sql<number>`count(*)::int` }).from(salesInvoiceItems)
      .where(and(eq(salesInvoiceItems.orgId, orgId), eq(salesInvoiceItems.taxId, id))),
    db.select({ count: sql<number>`count(*)::int` }).from(purchaseInvoiceItems)
      .where(and(eq(purchaseInvoiceItems.orgId, orgId), eq(purchaseInvoiceItems.taxId, id))),
  ]);
  return {
    products: Number(productUsage[0]?.count ?? 0),
    salesInvoices: Number(salesUsage[0]?.count ?? 0),
    purchaseInvoices: Number(purchaseUsage[0]?.count ?? 0),
  };
}

export const taxDefinitionsRouter = router({
  list: protectedProcedure
    .input(z.object({ activeOnly: z.boolean().optional().default(false) }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await db.query.taxDefinitions.findMany({
        where: and(
          eq(taxDefinitions.orgId, ctx.user.orgId),
          input?.activeOnly ? eq(taxDefinitions.isActive, true) : undefined,
        ),
        orderBy: [asc(taxDefinitions.name), asc(taxDefinitions.id)],
      });
      const usages = await Promise.all(rows.map(row => getUsage(row.id, ctx.user.orgId)));
      return rows.map((row, index) => ({ ...row, usage: usages[index] }));
    }),

  create: protectedProcedure
    .input(taxInput)
    .mutation(async ({ ctx, input }) => {
      const code = input.code.toUpperCase();
      await assertCodeAvailable(ctx.user.orgId, code);
      const [row] = await db.insert(taxDefinitions).values({
        orgId: ctx.user.orgId,
        name: input.name,
        code,
        category: input.category,
        valueType: input.valueType,
        value: input.value,
        isActive: input.isActive,
        notes: input.notes?.trim() || null,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      }).returning();
      return row;
    }),

  update: protectedProcedure
    .input(taxInput.extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.taxDefinitions.findFirst({
        where: and(eq(taxDefinitions.id, input.id), eq(taxDefinitions.orgId, ctx.user.orgId)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'الضريبة أو الرسم غير موجود' });
      const code = input.code.toUpperCase();
      await assertCodeAvailable(ctx.user.orgId, code, input.id);
      const [row] = await db.update(taxDefinitions).set({
        name: input.name,
        code,
        category: input.category,
        valueType: input.valueType,
        value: input.value,
        isActive: input.isActive,
        notes: input.notes?.trim() || null,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
        updatedAt: new Date(),
      }).where(and(eq(taxDefinitions.id, input.id), eq(taxDefinitions.orgId, ctx.user.orgId))).returning();

      // Product cards use the legacy taxRate for compatibility. Keep that
      // current for future documents while invoice item taxPercent stays fixed.
      if (input.valueType === 'percentage') {
        await db.update(products).set({ taxRate: input.value }).where(
          and(eq(products.orgId, ctx.user.orgId), eq(products.taxId, input.id)),
        );
      }
      return row;
    }),

  setActive: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db.update(taxDefinitions).set({
        isActive: input.isActive,
        updatedAt: new Date(),
      }).where(and(eq(taxDefinitions.id, input.id), eq(taxDefinitions.orgId, ctx.user.orgId))).returning();
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'الضريبة أو الرسم غير موجود' });
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.taxDefinitions.findFirst({
        where: and(eq(taxDefinitions.id, input.id), eq(taxDefinitions.orgId, ctx.user.orgId)),
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'الضريبة أو الرسم غير موجود' });
      const usage = await getUsage(input.id, ctx.user.orgId);
      const totalUsage = usage.products + usage.salesInvoices + usage.purchaseInvoices;
      if (existing.isSystem || totalUsage > 0) {
        const details = [
          usage.products ? `${usage.products} بطاقة صنف` : '',
          usage.salesInvoices ? `${usage.salesInvoices} بند مبيعات` : '',
          usage.purchaseInvoices ? `${usage.purchaseInvoices} بند مشتريات` : '',
        ].filter(Boolean).join('، ');
        throw new TRPCError({
          code: 'CONFLICT',
          message: existing.isSystem
            ? 'هذه ضريبة نظامية ولا يمكن حذفها؛ يمكنك إيقافها فقط'
            : `لا يمكن حذف الضريبة لأنها مستخدمة في ${details}؛ أوقفها بدلًا من حذفها`,
        });
      }
      await db.delete(taxDefinitions).where(and(eq(taxDefinitions.id, input.id), eq(taxDefinitions.orgId, ctx.user.orgId)));
      return { success: true };
    }),
});