import { z } from 'zod';
import { eq, and, desc, like, or } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { salesInvoices, salesInvoiceItems, products, customers } from '../schema.js';

export const salesRouter = router({
  // قائمة الفواتير/عروض الأسعار
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
      search: z.string().optional(),
      status: z.string().optional(),
      invoiceType: z.enum(['sale', 'return', 'quote']).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const allRecords = await db.query.salesInvoices.findMany({
        where: eq(salesInvoices.orgId, orgId),
        orderBy: [desc(salesInvoices.createdAt)],
      });
      let filtered = allRecords;
      if (input?.invoiceType) {
        filtered = filtered.filter(r => r.invoiceType === input.invoiceType);
      }
      if (input?.status) {
        filtered = filtered.filter(r => r.status === input.status);
      }
      if (input?.search) {
        const q = input.search.toLowerCase();
        filtered = filtered.filter(r =>
          r.invoiceNumber?.toLowerCase().includes(q) ||
          r.customerName?.toLowerCase().includes(q)
        );
      }
      const limit = input?.limit || 50;
      const page = input?.page || 1;
      return filtered.slice((page - 1) * limit, page * limit);
    }),

  // رقم المستند التالي — تنسيق: INV-YYYY-XXXXXX
  nextNumber: protectedProcedure
    .input(z.object({ prefix: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const prefix = input?.prefix || 'INV';
      const year = new Date().getFullYear();
      const yearPrefix = `${prefix}-${year}-`;
      const last = await db.query.salesInvoices.findFirst({
        where: eq(salesInvoices.orgId, ctx.user.orgId),
        orderBy: [desc(salesInvoices.id)],
      });
      if (!last) return `${yearPrefix}000001`;
      // استخراج الرقم من آخر فاتورة في نفس السنة
      const match = last.invoiceNumber.match(new RegExp(`${prefix}-(\\d{4})-(\\d+)`));
      if (match && parseInt(match[1]) === year) {
        const num = parseInt(match[2]) + 1;
        return `${yearPrefix}${String(num).padStart(6, '0')}`;
      }
      // سنة مختلفة أو تنسيق قديم — ابدأ من 1
      return `${yearPrefix}000001`;
    }),

  // تفاصيل مستند
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const invoice = await db.query.salesInvoices.findFirst({
        where: and(eq(salesInvoices.id, input.id), eq(salesInvoices.orgId, ctx.user.orgId)),
      });
      if (!invoice) throw new Error('المستند غير موجود');
      const items = await db.query.salesInvoiceItems.findMany({
        where: eq(salesInvoiceItems.invoiceId, input.id),
        orderBy: (i, { asc }) => [asc(i.sortOrder)],
      });
      return { ...invoice, items };
    }),

  // إنشاء فاتورة/عرض سعر
  create: protectedProcedure
    .input(z.object({
      invoiceNumber: z.string(),
      invoiceType: z.enum(['sale', 'return', 'quote']).default('sale'),
      invoiceDate: z.string(),
      dueDate: z.string().optional(),
      customerId: z.number().optional(),
      customerName: z.string().optional(),
      warehouseId: z.number().optional(),
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
      const [invoice] = await db.insert(salesInvoices).values({
        ...invoiceData,
        orgId,
        userId: ctx.user.id,
        invoiceDate: new Date(invoiceData.invoiceDate),
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      }).returning();
      if (items.length > 0) {
        await db.insert(salesInvoiceItems).values(
          items.map((item, idx) => ({
            ...item,
            invoiceId: invoice.id,
            orgId,
            sortOrder: item.sortOrder ?? idx,
          }))
        );
      }
      return invoice;
    }),

  // تعديل مستند
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      invoiceDate: z.string().optional(),
      customerId: z.number().optional(),
      customerName: z.string().optional(),
      subtotal: z.string().optional(),
      discountAmount: z.string().optional(),
      taxAmount: z.string().optional(),
      total: z.string().optional(),
      paidAmount: z.string().optional(),
      remainingAmount: z.string().optional(),
      status: z.enum(['draft', 'confirmed', 'cancelled', 'paid']).optional(),
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
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, items, invoiceDate, ...rest } = input;
      await db.update(salesInvoices).set({
        ...rest,
        ...(invoiceDate ? { invoiceDate: new Date(invoiceDate) } : {}),
        updatedAt: new Date(),
      }).where(and(eq(salesInvoices.id, id), eq(salesInvoices.orgId, ctx.user.orgId)));
      if (items) {
        await db.delete(salesInvoiceItems).where(eq(salesInvoiceItems.invoiceId, id));
        if (items.length > 0) {
          await db.insert(salesInvoiceItems).values(
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
      await db.delete(salesInvoiceItems).where(eq(salesInvoiceItems.invoiceId, input.id));
      await db.delete(salesInvoices).where(
        and(eq(salesInvoices.id, input.id), eq(salesInvoices.orgId, ctx.user.orgId))
      );
      return { success: true };
    }),

  // بحث عن عملاء
  searchCustomers: protectedProcedure
    .input(z.object({ q: z.string() }))
    .query(async ({ ctx, input }) => {
      return db.query.customers.findMany({
        where: and(
          eq(customers.orgId, ctx.user.orgId),
          eq(customers.isActive, true),
          or(
            like(customers.name, `%${input.q}%`),
            like(customers.code, `%${input.q}%`),
          )
        ),
        limit: 10,
      });
    }),

  // بحث عن أصناف
  searchProducts: protectedProcedure
    .input(z.object({ q: z.string() }))
    .query(async ({ ctx, input }) => {
      return db.query.products.findMany({
        where: and(
          eq(products.orgId, ctx.user.orgId),
          eq(products.isActive, true),
          or(
            like(products.name, `%${input.q}%`),
            like(products.code, `%${input.q}%`),
          )
        ),
        limit: 20,
      });
    }),
});
