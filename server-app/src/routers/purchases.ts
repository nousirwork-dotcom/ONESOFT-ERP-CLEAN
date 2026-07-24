import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { purchaseInvoices, purchaseInvoiceItems } from '../schema.js';
import { autoPostPurchaseInvoice } from './posting.js';

export const purchasesRouter = router({
  // قائمة فواتير المشتريات
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(200),
      search: z.string().optional(),
      invoiceType: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      warehouseId: z.number().optional(),
      numberPrefix: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const allRecords = await db.query.purchaseInvoices.findMany({
        where: eq(purchaseInvoices.orgId, orgId),
        orderBy: [desc(purchaseInvoices.invoiceDate)],
      });
      let filtered = allRecords;
      if (input?.invoiceType) filtered = filtered.filter(r => r.invoiceType === input.invoiceType);
      if (input?.warehouseId) filtered = filtered.filter(r => r.warehouseId === input.warehouseId);
      if (input?.search) {
        const q = input.search.toLowerCase();
        filtered = filtered.filter(r =>
          r.invoiceNumber?.toLowerCase().includes(q) ||
          r.supplierName?.toLowerCase().includes(q)
        );
      }
      if (input?.dateFrom) {
        const from = new Date(input.dateFrom); from.setHours(0, 0, 0, 0);
        filtered = filtered.filter(r => new Date(r.invoiceDate) >= from);
      }
      if (input?.dateTo) {
        const to = new Date(input.dateTo); to.setHours(23, 59, 59, 999);
        filtered = filtered.filter(r => new Date(r.invoiceDate) <= to);
      }
      if (input?.numberPrefix) {
        const pfx = input.numberPrefix.toLowerCase();
        filtered = filtered.filter(r => r.invoiceNumber?.toLowerCase().startsWith(pfx));
      }
      const limit = input?.limit || 200;
      const page = input?.page || 1;
      return filtered.slice((page - 1) * limit, page * limit);
    }),

  // الرقم التالي للمستند
  nextNumber: protectedProcedure
    .input(z.object({ prefix: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const prefix = input?.prefix || 'PUR';
      const year = new Date().getFullYear();
      const yearPrefix = `${prefix}-${year}-`;
      const last = await db.query.purchaseInvoices.findFirst({
        where: eq(purchaseInvoices.orgId, ctx.user.orgId),
        orderBy: [desc(purchaseInvoices.id)],
      });
      if (!last) return `${yearPrefix}000001`;
      const match = last.invoiceNumber.match(new RegExp(`${prefix}-(\\d{4})-(\\d+)`));
      if (match && parseInt(match[1]) === year) {
        const num = parseInt(match[2]) + 1;
        return `${yearPrefix}${String(num).padStart(6, '0')}`;
      }
      return `${yearPrefix}000001`;
    }),

  // تفاصيل مستند
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const invoice = await db.query.purchaseInvoices.findFirst({
        where: and(eq(purchaseInvoices.id, input.id), eq(purchaseInvoices.orgId, ctx.user.orgId)),
      });
      if (!invoice) throw new Error('المستند غير موجود');
      const items = await db.query.purchaseInvoiceItems.findMany({
        where: eq(purchaseInvoiceItems.invoiceId, input.id),
        orderBy: (i, { asc }) => [asc(i.sortOrder)],
      });
      return { ...invoice, items };
    }),

  // إنشاء مستند مشتريات
  create: protectedProcedure
    .input(z.object({
      invoiceNumber: z.string(),
      invoiceType: z.string().default('invoice'),
      invoiceDate: z.string(),
      dueDate: z.string().optional(),
      supplierId: z.number().optional(),
      supplierName: z.string().optional(),
      supplierInvoiceNumber: z.string().optional(),
      warehouseId: z.number().optional(),
      journalId: z.number().optional(),
      currency: z.string().default('SAR'),
      exchangeRate: z.string().default('1'),
      subtotal: z.string().default('0'),
      discountPercent: z.string().default('0'),
      discountAmount: z.string().default('0'),
      taxAmount: z.string().default('0'),
      total: z.string().default('0'),
      paidAmount: z.string().default('0'),
      remainingAmount: z.string().default('0'),
      paymentMethod: z.enum(['cash', 'bank', 'credit', 'check', 'other']).default('cash'),
      status: z.enum(['draft', 'confirmed', 'cancelled', 'paid']).default('confirmed'),
      notes: z.string().optional(),
      items: z.array(z.object({
        productId: z.number().optional(),
        productCode: z.string().optional(),
        productName: z.string(),
        unit: z.string().optional(),
        quantity: z.string(),
        unitPrice: z.string(),
        discountPercent: z.string().default('0'),
        discountAmount: z.string().default('0'),
        taxPercent: z.string().default('0'),
        taxAmount: z.string().default('0'),
        total: z.string(),
        sortOrder: z.number().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { items, dueDate, ...invoiceData } = input;
      const orgId = ctx.user.orgId;
      const isDraft = invoiceData.status === 'draft';
      const [invoice] = await db.insert(purchaseInvoices).values({
        ...invoiceData,
        orgId,
        userId: ctx.user.id,
        invoiceDate: new Date(invoiceData.invoiceDate),
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      }).returning();
      if (items.length > 0) {
        await db.insert(purchaseInvoiceItems).values(
          items.map((item, idx) => ({
            ...item,
            invoiceId: invoice.id,
            orgId,
            sortOrder: item.sortOrder ?? idx,
          }))
        );
      }

      // ترحيل تلقائي عند الحفظ (لا يُنفّذ للمسودة)
      if (!isDraft) {
        try {
          await autoPostPurchaseInvoice(invoice.id, orgId, ctx.user.id);
        } catch (e) {
          console.warn('[autoPostPurchaseInvoice] skipped:', e);
        }
      }

      return invoice;
    }),

  // تعديل مستند
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      invoiceDate: z.string().optional(),
      supplierId: z.number().optional(),
      supplierName: z.string().optional(),
      subtotal: z.string().optional(),
      discountAmount: z.string().optional(),
      taxAmount: z.string().optional(),
      total: z.string().optional(),
      paidAmount: z.string().optional(),
      remainingAmount: z.string().optional(),
      status: z.enum(['draft', 'confirmed', 'cancelled', 'paid']).optional(),
      notes: z.string().optional(),
      docTypeId: z.number().optional(),
      items: z.array(z.object({
        productId: z.number().optional(),
        productCode: z.string().optional(),
        productName: z.string(),
        unit: z.string().optional(),
        quantity: z.string(),
        unitPrice: z.string(),
        discountPercent: z.string().default('0'),
        discountAmount: z.string().default('0'),
        taxPercent: z.string().default('0'),
        taxAmount: z.string().default('0'),
        total: z.string(),
        sortOrder: z.number().optional(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, items, invoiceDate, ...rest } = input;
      const existing = await db.query.purchaseInvoices.findFirst({
        where: and(eq(purchaseInvoices.id, id), eq(purchaseInvoices.orgId, ctx.user.orgId)),
      });
      if (existing?.isPosted)
        throw new Error('لا يمكن تعديل مستند مرحَّل — يجب فك الترحيل أولاً');
      await db.update(purchaseInvoices).set({
        ...rest,
        ...(invoiceDate ? { invoiceDate: new Date(invoiceDate) } : {}),
        updatedAt: new Date(),
      }).where(and(eq(purchaseInvoices.id, id), eq(purchaseInvoices.orgId, ctx.user.orgId)));
      if (items) {
        await db.delete(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.invoiceId, id));
        if (items.length > 0) {
          await db.insert(purchaseInvoiceItems).values(
            items.map((item, idx) => ({
              ...item,
              invoiceId: id,
              orgId: ctx.user.orgId,
              sortOrder: item.sortOrder ?? idx,
            }))
          );
        }
      }
      return { success: true };
    }),

  // حذف مستند
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.purchaseInvoices.findFirst({
        where: and(eq(purchaseInvoices.id, input.id), eq(purchaseInvoices.orgId, ctx.user.orgId)),
      });
      if (existing?.isPosted)
        throw new Error('لا يمكن حذف مستند مرحَّل — يجب فك الترحيل أولاً');
      await db.delete(purchaseInvoices).where(
        and(eq(purchaseInvoices.id, input.id), eq(purchaseInvoices.orgId, ctx.user.orgId))
      );
      return { success: true };
    }),
});
