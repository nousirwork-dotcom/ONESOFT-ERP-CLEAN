import { z } from 'zod';
import { eq, and, desc, like, or } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { salesInvoices, salesInvoiceItems, salesInvoicePayments, paymentMethods, products, customers, stockVouchers, stockVoucherItems } from '../schema.js';
import { autoPostSalesInvoice } from './posting.js';

export const salesRouter = router({
  // قائمة الفواتير/عروض الأسعار
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(200),
      search: z.string().optional(),
      status: z.string().optional(),
      invoiceType: z.enum(['sale', 'return', 'quote', 'order']).optional(),
      dateFrom: z.string().optional(),      // YYYY-MM-DD
      dateTo: z.string().optional(),        // YYYY-MM-DD
      warehouseId: z.number().optional(),    // فلتر المخزن
      customerSearch: z.string().optional(), // بحث باسم/كود العميل
      customerId: z.number().optional(),     // فلتر بـ ID العميل
      excludeReturns: z.boolean().optional(),// استثناء المردودات
      numberPrefix: z.string().optional(),   // فلتر دفتر المستند (بادئة الرقم)
      excludeCancelled: z.boolean().optional(), // استثناء الملغاة
    }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const allRecords = await db.query.salesInvoices.findMany({
        where: eq(salesInvoices.orgId, orgId),
        orderBy: [desc(salesInvoices.invoiceDate)],
      });
      let filtered = allRecords;
      if (input?.invoiceType) {
        filtered = filtered.filter(r => r.invoiceType === input.invoiceType);
      }
      if (input?.excludeReturns) {
        filtered = filtered.filter(r => r.invoiceType !== 'return');
      }
      if (input?.excludeCancelled) {
        filtered = filtered.filter(r => r.status !== 'cancelled');
      }
      if (input?.status) {
        filtered = filtered.filter(r => r.status === input.status);
      }
      if (input?.warehouseId) {
        filtered = filtered.filter(r => r.warehouseId === input.warehouseId);
      }
      if (input?.search) {
        const q = input.search.toLowerCase();
        filtered = filtered.filter(r =>
          r.invoiceNumber?.toLowerCase().includes(q) ||
          r.customerName?.toLowerCase().includes(q)
        );
      }
      if (input?.customerId) {
        filtered = filtered.filter(r => r.customerId === input.customerId);
      }
      if (input?.customerSearch) {
        const q = input.customerSearch.toLowerCase();
        filtered = filtered.filter(r =>
          r.customerName?.toLowerCase().includes(q)
        );
      }
      if (input?.dateFrom) {
        const from = new Date(input.dateFrom);
        from.setHours(0, 0, 0, 0);
        filtered = filtered.filter(r => new Date(r.invoiceDate) >= from);
      }
      if (input?.dateTo) {
        const to = new Date(input.dateTo);
        to.setHours(23, 59, 59, 999);
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
      invoiceType: z.enum(['sale', 'return', 'quote', 'order']).default('sale'),
      invoiceDate: z.string(),
      dueDate: z.string().optional(),
      customerId: z.number().optional(),
      customerName: z.string().optional(),
      customerType: z.string().optional(),
      customerTaxNumber: z.string().optional(),
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
      paymentBreakdown: z.record(z.string(), z.number()).optional().nullable(),
      paymentMethod: z.enum(['cash', 'bank', 'credit', 'check', 'other']).default('cash'),
      status: z.enum(['draft', 'confirmed', 'cancelled', 'paid']).default('confirmed'),
      notes: z.string().optional(),
      docTypeId: z.number().optional(),
      basedOnType: z.string().optional(),
      basedOnNumber: z.string().optional(),
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
      let invoice: typeof salesInvoices.$inferSelect;
      try {
        const [row] = await db.insert(salesInvoices).values({
          ...invoiceData,
          orgId,
          userId: ctx.user.id,
          invoiceDate: new Date(invoiceData.invoiceDate),
          ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        }).returning();
        invoice = row;
      } catch (e: any) {
        console.error('[sales.create] INSERT ERROR:', {
          message: e?.message,
          code: e?.code,
          detail: e?.detail,
          constraint: e?.constraint,
          table: e?.table,
          data: { invoiceNumber: invoiceData.invoiceNumber, orgId, paymentMethod: invoiceData.paymentMethod },
        });
        throw e;
      }
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

      // ── ترحيل تلقائي فور الحفظ ──────────────────────────────────────────────
      try {
        const posted = await autoPostSalesInvoice(invoice.id, orgId, ctx.user.id);
        if (posted) {
          return { ...invoice, isPosted: true, autoPostedEntryNumber: posted.entryNumber };
        }
      } catch (e) {
        console.error('[sales.create] autoPostSalesInvoice error:', e);
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
      customerType: z.string().optional(),
      customerTaxNumber: z.string().optional(),
      subtotal: z.string().optional(),
      discountAmount: z.string().optional(),
      taxAmount: z.string().optional(),
      total: z.string().optional(),
      paidAmount: z.string().optional(),
      remainingAmount: z.string().optional(),
      paymentBreakdown: z.record(z.string(), z.number()).optional().nullable(),
      status: z.enum(['draft', 'confirmed', 'cancelled', 'paid']).optional(),
      notes: z.string().optional(),
      basedOnType: z.string().optional(),
      basedOnNumber: z.string().optional(),
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
      // القاعدة الخامسة: منع تعديل المستندات المرحّلة
      const existing = await db.query.salesInvoices.findFirst({
        where: and(eq(salesInvoices.id, id), eq(salesInvoices.orgId, ctx.user.orgId)),
      });
      if (existing?.isPosted)
        throw new Error('لا يمكن تعديل مستند مرحّل — يجب فك الترحيل أولاً');
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

  // جلب بيانات السداد المحفوظة لفاتورة معينة
  getPaymentBreakdown: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const payments = await db.query.salesInvoicePayments.findMany({
        where: and(
          eq(salesInvoicePayments.invoiceId, input.id),
          eq(salesInvoicePayments.orgId, orgId),
        ),
        orderBy: (t, { asc }) => [asc(t.id)],
      });
      const breakdown: Record<string, number> = {};
      for (const p of payments) {
        breakdown[p.paymentMethodCode] = parseFloat(p.amount as string);
      }
      return { payments, breakdown };
    }),

  // جلب مستند مصدر بالرقم (بناءً على)
  getByNumber: protectedProcedure
    .input(z.object({
      type: z.enum(['sale', 'quote', 'order', 'transfer']),
      number: z.string().min(1),
    }))
    .query(async ({ ctx, input }) => {
      if (input.type === 'transfer') {
        const voucher = await db.query.stockVouchers.findFirst({
          where: and(
            eq(stockVouchers.orgId, ctx.user.orgId),
            eq(stockVouchers.voucherNumber, input.number),
            eq(stockVouchers.type, 'transfer'),
          ),
        });
        if (!voucher) return null;
        const items = await db.query.stockVoucherItems.findMany({
          where: eq(stockVoucherItems.voucherId, voucher.id),
          orderBy: (i, { asc }) => [asc(i.sortOrder)],
        });
        return {
          sourceType: 'transfer' as const,
          number: voucher.voucherNumber,
          customerId: null as number | null,
          customerName: null as string | null,
          warehouseId: voucher.warehouseId,
          journalId: null as number | null,
          status: null as string | null,
          currency: 'SAR',
          notes: voucher.notes,
          items: items.map(i => ({
            productId: i.productId,
            productCode: '',
            productName: i.productName,
            unit: '',
            quantity: i.quantity,
            unitPrice: i.unitCost ?? '0',
            discountPct: '0',
            discountAmt: '0',
            taxPct: '0',
            taxAmt: '0',
            total: i.totalCost ?? '0',
          })),
        };
      }

      const typeFilter = input.type === 'order' ? 'order'
        : input.type === 'quote' ? 'quote'
        : 'sale';

      const invoice = await db.query.salesInvoices.findFirst({
        where: and(
          eq(salesInvoices.orgId, ctx.user.orgId),
          eq(salesInvoices.invoiceNumber, input.number),
          eq(salesInvoices.invoiceType, typeFilter as any),
        ),
      });
      if (!invoice) return null;

      // ── قواعد أمر البيع: رفض الملغاة ──────────────────────────────────────
      if (input.type === 'order' && invoice.status === 'cancelled') return null;

      const items = await db.query.salesInvoiceItems.findMany({
        where: eq(salesInvoiceItems.invoiceId, invoice.id),
        orderBy: (i, { asc }) => [asc(i.sortOrder)],
      });

      // ── حساب الكميات المتبقية لأوامر البيع ────────────────────────────────
      if (input.type === 'order') {
        // اجمع الكميات المُحوَّلة من الفواتير التي تستند إلى هذا الأمر
        const referencingInvoices = await db.query.salesInvoices.findMany({
          where: and(
            eq(salesInvoices.orgId, ctx.user.orgId),
            eq(salesInvoices.basedOnType, 'order'),
            eq(salesInvoices.basedOnNumber, invoice.invoiceNumber),
          ),
        });

        if (referencingInvoices.length > 0) {
          // اجمع كميات كل صنف من الفواتير المستندة
          const usedQtyByProduct = new Map<number, number>();
          for (const inv of referencingInvoices) {
            const invItems = await db.query.salesInvoiceItems.findMany({
              where: eq(salesInvoiceItems.invoiceId, inv.id),
            });
            for (const it of invItems) {
              if (it.productId) {
                const cur = usedQtyByProduct.get(it.productId) ?? 0;
                usedQtyByProduct.set(it.productId, cur + parseFloat(it.quantity as string));
              }
            }
          }

          // احسب الكميات المتبقية
          const remainingItems = items.map(i => {
            const ordered = parseFloat(i.quantity as string);
            const used = i.productId ? (usedQtyByProduct.get(i.productId) ?? 0) : 0;
            const remaining = Math.max(0, ordered - used);
            return { ...i, remainingQty: remaining };
          }).filter(i => i.remainingQty > 0);

          // محوَّل بالكامل
          if (remainingItems.length === 0) return null;

          return {
            sourceType: 'order' as const,
            number: invoice.invoiceNumber,
            customerId: invoice.customerId,
            customerName: invoice.customerName,
            warehouseId: invoice.warehouseId,
            journalId: invoice.journalId,
            status: invoice.status,
            currency: invoice.currency ?? 'SAR',
            notes: invoice.notes,
            items: remainingItems.map(i => ({
              productId: i.productId,
              productCode: i.productCode ?? '',
              productName: i.productName,
              unit: i.unit ?? '',
              quantity: String(i.remainingQty),
              unitPrice: i.unitPrice,
              discountPct: i.discountPercent ?? '0',
              discountAmt: i.discountAmount ?? '0',
              taxPct: i.taxPercent ?? '0',
              taxAmt: i.taxAmount ?? '0',
              total: i.total,
            })),
          };
        }
      }

      return {
        sourceType: input.type,
        number: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        warehouseId: invoice.warehouseId,
        journalId: invoice.journalId,
        status: invoice.status,
        currency: invoice.currency ?? 'SAR',
        notes: invoice.notes,
        items: items.map(i => ({
          productId: i.productId,
          productCode: i.productCode ?? '',
          productName: i.productName,
          unit: i.unit ?? '',
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountPct: i.discountPercent ?? '0',
          discountAmt: i.discountAmount ?? '0',
          taxPct: i.taxPercent ?? '0',
          taxAmt: i.taxAmount ?? '0',
          total: i.total,
        })),
      };
    }),

  // حذف مستند
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // القاعدة الخامسة: منع حذف المستندات المرحّلة
      const existing = await db.query.salesInvoices.findFirst({
        where: and(eq(salesInvoices.id, input.id), eq(salesInvoices.orgId, ctx.user.orgId)),
      });
      if (existing?.isPosted)
        throw new Error('لا يمكن حذف مستند مرحّل — يجب فك الترحيل أولاً');
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
