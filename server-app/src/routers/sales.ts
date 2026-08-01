import { z } from 'zod';
import { eq, and, desc, like, or, sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { salesInvoices, salesInvoiceItems, salesInvoicePayments, paymentMethods, products, customers, stockVouchers, stockVoucherItems, documentJournals, warehouses, users, zatcaPosUnits } from '../schema.js';
import { autoPostSalesInvoice } from './posting.js';
import { TRPCError } from '@trpc/server';
import { validateSalesInvoiceWarehouseContext } from '../lib/salesWarehouseValidation.js';

// ── تحقق أن جميع بنود الفاتورة تُشير إلى أصناف مسجلة في النظام ──────────────────
async function validateInvoiceItems(items: { productId?: number; productName: string; productCode?: string }[], orgId: number) {
  if (!items || items.length === 0) return;
  for (const item of items) {
    if (!item.productId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'الصنف غير مسجل، يرجى اختيار صنف من القائمة.' });
    }
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, item.productId), eq(products.orgId, orgId)),
    });
    if (!product) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `الصنف "${item.productName || item.productCode || ''}" غير مسجل في النظام.` });
    }
  }
}

async function validateSalesReturnReference(opts: {
  orgId: number;
  sourceDocumentId?: number;
  basedOnNumber?: string;
}) {
  const { orgId, sourceDocumentId, basedOnNumber } = opts;
  const tx = db;
  const original = sourceDocumentId
    ? await tx.query.salesInvoices.findFirst({
        where: and(eq(salesInvoices.id, sourceDocumentId), eq(salesInvoices.orgId, orgId)),
      })
    : basedOnNumber
      ? await tx.query.salesInvoices.findFirst({
          where: and(
            eq(salesInvoices.orgId, orgId),
            eq(salesInvoices.invoiceNumber, basedOnNumber),
            eq(salesInvoices.invoiceType, 'sale'),
          ),
        })
      : null;

  if (
    !original ||
    original.invoiceType !== 'sale' ||
    !original.isPosted ||
    original.status === 'draft' ||
    original.status === 'cancelled'
  ) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'مردود المبيعات يجب أن يرتبط بفاتورة مبيعات أصلية مرحّلة',
    });
  }
  return original;
}

// ── توليد رقم فاتورة المبيعات من دفتر المستندات داخل transaction ───────────────
// القواعد:
// - آخر رقم مستخدم = currentSeq (0 = لم يُستخدم شيء بعد).
// - الرقم التالي = max(آخر رقم مستخدم + increment, أول رقم).
// - حقل "آخر رقم" (lastNumber) هو الحد الأقصى فقط، وليس الرقم التالي.
async function generateInvoiceNumberForJournal(tx: any, journalId: number, orgId: number): Promise<string> {
  const journal = await tx.query.documentJournals.findFirst({
    where: and(eq(documentJournals.id, journalId), eq(documentJournals.orgId, orgId)),
  });
  if (!journal) throw new Error('الدفتر غير موجود');

  const firstNumber = journal.firstNumber ?? 1;
  const increment   = journal.increment ?? 1;
  const lastNumber  = journal.lastNumber ?? 999999;

  let lastUsed = journal.currentSeq ?? 0;
  if (lastUsed === 0) {
    // لم يُستخدم شيء بعد: نبدأ من قبل أول رقم بمقدار increment ليصبح الرقم التالي = firstNumber
    lastUsed = firstNumber - increment;
  }

  let nextSeq = lastUsed + increment;
  if (nextSeq < firstNumber) nextSeq = firstNumber;
  if (nextSeq > lastNumber) throw new Error('تم استنفاد أرقام دفتر المستندات');

  await tx.update(documentJournals)
    .set({ currentSeq: nextSeq, updatedAt: new Date() })
    .where(eq(documentJournals.id, journalId));

  const prefix  = journal.numberPrefix ?? 'INV';
  const digits  = journal.numDigits ?? 6;
  const numPart = String(nextSeq).padStart(digits, '0');
  if (journal.includeYear) return `${prefix}${new Date().getFullYear()}-${numPart}`;
  return `${prefix}${numPart}`;
}

// ── توليد رقم مسودة من دفتر المستندات داخل transaction ───────────────────────────
async function generateDraftNumberForJournal(tx: any, journalId: number, orgId: number): Promise<string> {
  const journal = await tx.query.documentJournals.findFirst({
    where: and(eq(documentJournals.id, journalId), eq(documentJournals.orgId, orgId)),
  });
  if (!journal) throw new Error('الدفتر غير موجود');

  const firstNumber = journal.draftFirstNumber ?? 1;
  const lastNumber  = journal.draftLastNumber ?? 999999;

  let lastUsed = journal.draftCurrentSeq ?? 0;
  if (lastUsed === 0) {
    lastUsed = firstNumber - 1;
  }

  let nextSeq = lastUsed + 1;
  if (nextSeq < firstNumber) nextSeq = firstNumber;
  if (nextSeq > lastNumber) throw new Error('تم استنفاد أرقام مسودات دفتر المستندات');

  await tx.update(documentJournals)
    .set({ draftCurrentSeq: nextSeq, updatedAt: new Date() })
    .where(eq(documentJournals.id, journalId));

  const prefix = journal.draftNumberPrefix ?? 'DRAFT';
  const digits = journal.draftNumDigits ?? 6;
  const numPart = String(nextSeq).padStart(digits, '0');
  return `${prefix}${numPart}`;
}

// ── تحديد المخزن/الفرع الصحيح: إذا لم يُرسل warehouseId نحله من دفتر المستندات ──
async function resolveInvoiceWarehouseId(
  tx: any,
  inputWarehouseId: number | null | undefined,
  journalId: number | null | undefined,
  orgId: number,
): Promise<number> {
  if (inputWarehouseId) return inputWarehouseId;

  if (journalId) {
    const journal = await tx.query.documentJournals.findFirst({
      where: and(eq(documentJournals.id, journalId), eq(documentJournals.orgId, orgId)),
    });
    if (journal?.warehouseId) return journal.warehouseId;
  }

  throw new Error('لم يتم تحديد المخزن/الفرع — يجب اختيار دفتر مرتبط بمخزن');
}

export const salesRouter = router({
  // قائمة الفواتير/عروض الأسعار
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(200),
      search: z.string().optional(),
      status: z.string().optional(),
      invoiceType: z.enum(['sale', 'return', 'quote', 'order', 'credit_note', 'debit_note']).optional(),
      dateFrom: z.string().optional(),      // YYYY-MM-DD
      dateTo: z.string().optional(),        // YYYY-MM-DD
      warehouseId: z.number().optional(),    // فلتر المخزن
      customerSearch: z.string().optional(), // بحث باسم/كود العميل
      customerId: z.number().optional(),     // فلتر بـ ID العميل
      excludeReturns: z.boolean().optional(),// استثناء المردودات
      numberPrefix: z.string().optional(),   // فلتر دفتر المستند (بادئة الرقم)
      excludeCancelled: z.boolean().optional(), // استثناء الملغاة
      excludeFullyConverted: z.boolean().optional(), // استثناء أوامر البيع المحوّلة بالكامل
    }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const allRecords = await db.query.salesInvoices.findMany({
        where: eq(salesInvoices.orgId, orgId),
        orderBy: [desc(salesInvoices.invoiceDate)],
      });
      const [warehousesList, usersList] = await Promise.all([
        db.query.warehouses.findMany({ where: eq(warehouses.orgId, orgId) }),
        db.query.users.findMany({ where: eq(users.orgId, orgId) }),
      ]);
      const warehouseMap = new Map(warehousesList.map(w => [w.id, w.name]));
      const userMap = new Map(usersList.map(u => [u.id, u.name]));
      const records = allRecords.map(r => ({
        ...r,
        warehouseName: warehouseMap.get(r.warehouseId!) ?? null,
        userName: userMap.get(r.userId!) ?? null,
      }));
      let filtered = records;
      if (input?.invoiceType) {
        filtered = filtered.filter(r => r.invoiceType === input.invoiceType);
      }
      if (input?.excludeReturns) {
        filtered = filtered.filter(r => r.invoiceType !== 'return');
      }
      if (input?.excludeCancelled) {
        filtered = filtered.filter(r => r.status !== 'cancelled');
      }

      // ── استثناء المستندات المحوّلة بالكامل (أوامر البيع وعروض الأسعار) ────────
      if (input?.excludeFullyConverted && (input?.invoiceType === 'order' || input?.invoiceType === 'quote') && filtered.length > 0) {
        const sourceType = input.invoiceType; // 'order' | 'quote'
        // اجمع الفواتير التي تستند إلى هذا النوع من المستندات
        const referencingInvoices = await db.query.salesInvoices.findMany({
          where: and(
            eq(salesInvoices.orgId, orgId),
            eq(salesInvoices.basedOnType, sourceType),
          ),
        });
        // مجموعة أرقام الأوامر التي لها فاتورة مستندة
        const referencedNums = new Set(referencingInvoices.map(r => r.basedOnNumber).filter(Boolean) as string[]);

        if (referencedNums.size > 0) {
          const ordersToCheck = filtered.filter(o => referencedNums.has(o.invoiceNumber!));
          const fullyConvertedIds = new Set<number>();

          for (const order of ordersToCheck) {
            // أصناف الأمر
            const orderItems = await db.query.salesInvoiceItems.findMany({
              where: eq(salesInvoiceItems.invoiceId, order.id),
            });
            if (orderItems.length === 0) continue;

            // كميات المُحوَّل من الفواتير المستندة لهذا الأمر
            const refInvs = referencingInvoices.filter(r => r.basedOnNumber === order.invoiceNumber);
            const usedQty = new Map<number, number>();
            for (const inv of refInvs) {
              const invItems = await db.query.salesInvoiceItems.findMany({
                where: eq(salesInvoiceItems.invoiceId, inv.id),
              });
              for (const it of invItems) {
                if (it.productId) {
                  usedQty.set(it.productId, (usedQty.get(it.productId) ?? 0) + parseFloat(it.quantity as string));
                }
              }
            }

            // إذا جميع الأصناف تمت تغطيتها → الأمر مكتمل التحويل
            const allCovered = orderItems.every(i => {
              if (!i.productId) return false;
              const ordered = parseFloat(i.quantity as string);
              const used = usedQty.get(i.productId) ?? 0;
              return used >= ordered - 0.001;
            });
            if (allCovered) fullyConvertedIds.add(order.id);
          }

          if (fullyConvertedIds.size > 0) {
            filtered = filtered.filter(o => !fullyConvertedIds.has(o.id));
          }
        }
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

      // إرجاع اسم المخزن/الفرع مع المستند لتعبئة الحقل عند فتح سجل محفوظ
      let warehouseName: string | null = null;
      if (invoice.warehouseId) {
        const wh = await db.query.warehouses.findFirst({
          where: and(eq(warehouses.id, invoice.warehouseId), eq(warehouses.orgId, ctx.user.orgId)),
        });
        warehouseName = wh?.name ?? null;
      }

      return { ...invoice, warehouseName, items };
    }),

  // إنشاء فاتورة/عرض سعر
  create: protectedProcedure
    .input(z.object({
      invoiceNumber: z.string(),
      invoiceType: z.enum(['sale', 'return', 'quote', 'order', 'credit_note', 'debit_note']).default('sale'),
      invoiceDate: z.string(),
      dueDate: z.string().optional(),
      customerId: z.number().optional(),
      customerName: z.string().optional(),
      customerType: z.string().optional(),
      customerTaxNumber: z.string().optional(),
      sellerUserId: z.number().optional(),
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
      sourceDocumentId: z.number().optional(),
      zatcaInvoiceType: z.enum(['standard', 'simplified']).optional(),
      draftNumber: z.string().optional(),
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
      if (!isDraft && ['credit_note', 'debit_note'].includes(invoiceData.invoiceType)) {
        if (!invoiceData.basedOnNumber?.trim() && !invoiceData.sourceDocumentId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'الإشعار يتطلب مرجع فاتورة المبيعات الأصلية' });
        }
        if (!invoiceData.notes?.trim()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'الإشعار يتطلب سبب الإصدار' });
        }
        const original = invoiceData.sourceDocumentId
          ? await db.query.salesInvoices.findFirst({
              where: and(eq(salesInvoices.id, invoiceData.sourceDocumentId), eq(salesInvoices.orgId, orgId)),
              columns: {
                id: true, invoiceType: true, invoiceNumber: true, invoiceDate: true,
                customerId: true, customerName: true, currency: true, warehouseId: true,
                journalId: true, zatcaUuid: true, zatcaStatus: true, zatcaInvoiceType: true,
                status: true, total: true,
              },
            })
          : invoiceData.basedOnNumber
            ? await db.query.salesInvoices.findFirst({
                where: and(
                  eq(salesInvoices.orgId, orgId),
                  eq(salesInvoices.invoiceNumber, invoiceData.basedOnNumber),
                  eq(salesInvoices.invoiceType, 'sale'),
                ),
                columns: {
                  id: true, invoiceType: true, invoiceNumber: true, invoiceDate: true,
                  customerId: true, customerName: true, currency: true, warehouseId: true,
                  journalId: true, zatcaUuid: true, zatcaStatus: true, zatcaInvoiceType: true,
                  status: true, total: true,
                },
              })
            : null;
        if (
          !original ||
          original.invoiceType !== 'sale' ||
          original.status === 'draft' ||
          original.status === 'cancelled' ||
          original.customerId == null
        ) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'مرجع الإشعار يجب أن يكون فاتورة مبيعات أصلية، وليس مستند مشتريات أو إشعاراً آخر' });
        }
        invoiceData.sourceDocumentId = original.id;
        invoiceData.basedOnNumber = original.invoiceNumber;
        invoiceData.basedOnType = 'sale';
        invoiceData.zatcaInvoiceType = original.zatcaInvoiceType === 'standard' ? 'standard' : 'simplified';
        if (invoiceData.customerId !== original.customerId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'العميل يجب أن يطابق العميل في الفاتورة الأصلية' });
        }
        if (invoiceData.currency && invoiceData.currency !== (original.currency ?? 'SAR')) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'عملة الإشعار يجب أن تطابق عملة الفاتورة الأصلية' });
        }
        if (invoiceData.warehouseId != null && invoiceData.warehouseId !== original.warehouseId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'مخزن/فرع الإشعار يجب أن يطابق الفاتورة الأصلية' });
        }
        if (invoiceData.journalId != null) {
          const journal = await db.query.documentJournals.findFirst({
            where: and(eq(documentJournals.id, invoiceData.journalId), eq(documentJournals.orgId, orgId)),
            columns: { id: true, docType: true, warehouseId: true, zatcaPosUnitId: true },
          });
          if (!journal || journal.docType !== invoiceData.invoiceType) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'دفتر الإشعار يجب أن يكون من النوع الصحيح' });
          }
          if (journal.warehouseId !== original.warehouseId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'دفتر الإشعار يجب أن يكون مرتبطاً بمخزن/فرع الفاتورة الأصلية' });
          }
          if (original.journalId) {
            const sourceJournal = await db.query.documentJournals.findFirst({
              where: and(eq(documentJournals.id, original.journalId), eq(documentJournals.orgId, orgId)),
              columns: { zatcaPosUnitId: true },
            });
            if (sourceJournal?.zatcaPosUnitId !== journal.zatcaPosUnitId) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: 'دفتر الإشعار يجب أن يرتبط بوحدة ZATCA نفسها للفواتير الأصلية' });
            }
          }
        }
      }

      // ── تحقق: المسودة لا تخضع للتحققات المشددة (لا مخزن/فرع، لا أصناف) ─────
      if (!isDraft) {
        // ── تحقق: سياق المخزن/الفرع الموحد (المخزن = الفرع في مسار المستندات) ──
        await validateSalesInvoiceWarehouseContext({
          warehouseId: invoiceData.warehouseId,
          journalId: invoiceData.journalId,
          sellerUserId: invoiceData.sellerUserId,
          sourceDocumentId: invoiceData.sourceDocumentId,
          orgId,
        });

        // ── تحقق: جميع الأصناف مسجلة في النظام (لا يُقبل نص يدوي بدون productId) ──
        await validateInvoiceItems(items, orgId);

        if (invoiceData.invoiceType === 'return') {
          if (!invoiceData.notes?.trim()) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'مردود المبيعات يتطلب سبب الإصدار' });
          }
          const original = await validateSalesReturnReference({
            orgId,
            sourceDocumentId: invoiceData.sourceDocumentId,
            basedOnNumber: invoiceData.basedOnNumber,
          });
          invoiceData.sourceDocumentId = original.id;
          invoiceData.basedOnNumber = original.invoiceNumber;
          invoiceData.basedOnType = 'sale';
        }
      }
      const { invoice, finalInvoiceNumber, isPosted, autoPostedEntryNumber } = await db.transaction(async (tx) => {
        // حلّ warehouseId من الدفتر إذا لم يُرسل، أو رفض الحفظ إذا تعذّر
        const resolvedWarehouseId = await resolveInvoiceWarehouseId(
          tx,
          invoiceData.warehouseId,
          invoiceData.journalId,
          orgId,
        );

        if (!isDraft && invoiceData.invoiceType === 'return') {
          const original = await validateSalesReturnReference({
            orgId,
            sourceDocumentId: invoiceData.sourceDocumentId,
            basedOnNumber: invoiceData.basedOnNumber,
          });
          invoiceData.sourceDocumentId = original.id;
          invoiceData.basedOnNumber = original.invoiceNumber;
          invoiceData.basedOnType = 'sale';
        }

        // ── حجز الرقم التسلسلي داخل نفس transaction الحفظ ──────────────────
        // المسودة لا تستهلك الرقم الرسمي من دفتر المستندات.
        // قفل استشاري على الدفتر لمنع race conditions بين مستخدمين متعددين
        if (invoiceData.journalId && !isDraft) {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${invoiceData.journalId}::bigint)`);
        }
        let finalInvoiceNumber = invoiceData.invoiceNumber;
        let draftNumber: string | undefined = undefined;
        if (isDraft && invoiceData.journalId) {
          // المسودة تحصل على رقم من مسلسل مسودات الدفتر
          draftNumber = await generateDraftNumberForJournal(tx, invoiceData.journalId, orgId);
          finalInvoiceNumber = draftNumber;
        } else if (!isDraft && invoiceData.journalId) {
          finalInvoiceNumber = await generateInvoiceNumberForJournal(tx, invoiceData.journalId, orgId);
        }

        let invoice: typeof salesInvoices.$inferSelect;
        try {
          const [row] = await tx.insert(salesInvoices).values({
            ...invoiceData,
            warehouseId: resolvedWarehouseId,
            invoiceNumber: finalInvoiceNumber,
            draftNumber: draftNumber ?? invoiceData.draftNumber,
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
            data: { invoiceNumber: finalInvoiceNumber, orgId, paymentMethod: invoiceData.paymentMethod },
          });
          throw e;
        }
        if (items.length > 0) {
          await tx.insert(salesInvoiceItems).values(
            items.map((item, idx) => ({
              ...item,
              invoiceId: invoice.id,
              orgId,
              sortOrder: item.sortOrder ?? idx,
            }))
          );
        }

        // ── تسجيل تفاصيل الدفع داخل نفس transaction الإنشاء عند تأكيد الدفع ─────
        // يضمن ذلك عدم ترك فاتورة بدون دفع في قاعدة البيانات.
        if (!isDraft && invoiceData.paymentBreakdown != null) {
          const pmEntries = Object.entries(invoiceData.paymentBreakdown).filter(([, v]) => v > 0);
          if (pmEntries.length > 0) {
            const pms = await tx.query.paymentMethods.findMany({
              where: eq(paymentMethods.orgId, orgId),
            });
            const pmMap = new Map(pms.map(p => [p.code, p.nameAr]));
            await tx.insert(salesInvoicePayments).values(
              pmEntries.map(([code, amount]) => ({
                orgId,
                invoiceId: invoice.id,
                paymentMethodCode: code,
                paymentMethodName: pmMap.get(code) ?? code,
                amount: amount.toFixed(4),
              }))
            );
          }
        }

        // ── ترحيل تلقائي داخل نفس transaction الحفظ ───────────────────────────
        // المسودة لا تُرحّل ولا تُنشئ حركات مخزون أو قيود محاسبية.
        if (!isDraft) {
          try {
            const posted = await autoPostSalesInvoice(invoice.id, orgId, ctx.user.id, tx);
            if (posted) {
              return {
                invoice,
                finalInvoiceNumber,
                isPosted: true,
                autoPostedEntryNumber: posted.entryNumber,
              };
            }
          } catch (e) {
            console.error('[sales.create] autoPostSalesInvoice error — rolling back:', e);
            throw e;
          }
        }

        return {
          invoice,
          finalInvoiceNumber,
          isPosted: false,
          autoPostedEntryNumber: undefined,
        };
      });

      return {
        ...invoice,
        invoiceNumber: finalInvoiceNumber,
        isPosted,
        autoPostedEntryNumber,
      };
    }),

  // تعديل مستند
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      invoiceType: z.enum(['sale', 'return', 'quote', 'order', 'credit_note', 'debit_note']).optional(),
      // حقول السياق — اختيارية عند التعديل، الموجود يُستخدم كقيمة افتراضية
      warehouseId:     z.number().optional(),
      journalId:       z.number().optional(),
      sellerUserId:    z.number().optional(),
      invoiceDate: z.string().optional(),
      customerId: z.number().optional(),
      customerName: z.string().optional(),
      customerType: z.string().optional(),
      customerTaxNumber: z.string().optional(),
      currency: z.string().optional(),
      subtotal: z.string().optional(),
      discountAmount: z.string().optional(),
      taxAmount: z.string().optional(),
      total: z.string().optional(),
      paidAmount: z.string().optional(),
      remainingAmount: z.string().optional(),
      paymentBreakdown: z.record(z.string(), z.number()).optional().nullable(),
      paymentMethod: z.enum(['cash', 'bank', 'credit', 'check', 'other']).optional(),
      status: z.enum(['draft', 'confirmed', 'cancelled', 'paid']).optional(),
      notes: z.string().optional(),
      basedOnType: z.string().optional(),
      basedOnNumber: z.string().optional(),
      sourceDocumentId: z.number().optional(),
      zatcaInvoiceType: z.enum(['standard', 'simplified']).optional(),
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

      const wasDraft = existing?.status === 'draft';
      const isNowDraft = rest.status === 'draft';
      const isFinalizing = wasDraft && !isNowDraft;

      // ── الحالة النهائية الكاملة: دمج القيم الموجودة مع المدخلات الجديدة ─────
      const finalWarehouseId  = rest.warehouseId  ?? existing?.warehouseId  ?? undefined;
      const finalJournalId    = rest.journalId    ?? existing?.journalId    ?? undefined;
      const finalSellerUserId = rest.sellerUserId ?? existing?.sellerUserId ?? undefined;
      const finalSourceDocId  = rest.sourceDocumentId !== undefined
        ? rest.sourceDocumentId
        : existing?.sourceDocumentId ?? undefined;

      // التحقق من المخزن/الأصناف يُتخطى للمسودة فقط؛ عند تحويلها نهائية يجب التحقق
      if (!isNowDraft && ['credit_note', 'debit_note'].includes(rest.invoiceType ?? '')) {
        if (!rest.basedOnNumber?.trim() && !finalSourceDocId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'الإشعار يتطلب مرجع فاتورة المبيعات الأصلية' });
        }
        if (!rest.notes?.trim() && !existing?.notes?.trim()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'الإشعار يتطلب سبب الإصدار' });
        }
        const original = finalSourceDocId
          ? await db.query.salesInvoices.findFirst({
              where: and(eq(salesInvoices.id, finalSourceDocId), eq(salesInvoices.orgId, ctx.user.orgId)),
              columns: {
                id: true, invoiceType: true, invoiceNumber: true, invoiceDate: true,
                customerId: true, customerName: true, currency: true, warehouseId: true,
                journalId: true, zatcaUuid: true, zatcaStatus: true, zatcaInvoiceType: true,
                status: true, total: true,
              },
            })
          : rest.basedOnNumber
            ? await db.query.salesInvoices.findFirst({
                where: and(
                  eq(salesInvoices.orgId, ctx.user.orgId),
                  eq(salesInvoices.invoiceNumber, rest.basedOnNumber),
                  eq(salesInvoices.invoiceType, 'sale'),
                ),
                columns: {
                  id: true, invoiceType: true, invoiceNumber: true, invoiceDate: true,
                  customerId: true, customerName: true, currency: true, warehouseId: true,
                  journalId: true, zatcaUuid: true, zatcaStatus: true, zatcaInvoiceType: true,
                  status: true, total: true,
                },
              })
            : null;
        if (
          !original ||
          original.invoiceType !== 'sale' ||
          original.status === 'draft' ||
          original.status === 'cancelled' ||
          original.customerId == null
        ) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'مرجع الإشعار يجب أن يكون فاتورة مبيعات أصلية، وليس مستند مشتريات أو إشعاراً آخر' });
        }
        rest.sourceDocumentId = original.id;
        rest.basedOnNumber = original.invoiceNumber;
        rest.basedOnType = 'sale';
        rest.zatcaInvoiceType = original.zatcaInvoiceType === 'standard' ? 'standard' : 'simplified';
        if (rest.customerId !== undefined && rest.customerId !== original.customerId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'العميل يجب أن يطابق العميل في الفاتورة الأصلية' });
        }
        if (rest.currency && rest.currency !== (original.currency ?? 'SAR')) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'عملة الإشعار يجب أن تطابق عملة الفاتورة الأصلية' });
        }
        if (rest.warehouseId != null && rest.warehouseId !== original.warehouseId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'مخزن/فرع الإشعار يجب أن يطابق الفاتورة الأصلية' });
        }
        if (finalJournalId) {
          const journal = await db.query.documentJournals.findFirst({
            where: and(eq(documentJournals.id, finalJournalId), eq(documentJournals.orgId, ctx.user.orgId)),
            columns: { id: true, docType: true, warehouseId: true, zatcaPosUnitId: true },
          });
          if (!journal || journal.docType !== rest.invoiceType) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'دفتر الإشعار يجب أن يكون من النوع الصحيح' });
          }
          if (journal.warehouseId !== original.warehouseId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'دفتر الإشعار يجب أن يكون مرتبطاً بمخزن/فرع الفاتورة الأصلية' });
          }
          if (original.journalId) {
            const sourceJournal = await db.query.documentJournals.findFirst({
              where: and(eq(documentJournals.id, original.journalId), eq(documentJournals.orgId, ctx.user.orgId)),
              columns: { zatcaPosUnitId: true },
            });
            if (sourceJournal?.zatcaPosUnitId !== journal.zatcaPosUnitId) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: 'دفتر الإشعار يجب أن يرتبط بوحدة ZATCA نفسها للفواتير الأصلية' });
            }
          }
        }
      }
      if (!isNowDraft) {
        await validateSalesInvoiceWarehouseContext({
          warehouseId:      finalWarehouseId,
          journalId:        finalJournalId,
          sellerUserId:     finalSellerUserId,
          sourceDocumentId: finalSourceDocId,
          orgId: ctx.user.orgId,
        });

        // ── تحقق: جميع الأصناف مسجلة في النظام (لا يُقبل نص يدوي بدون productId) ──
        if (items) await validateInvoiceItems(items, ctx.user.orgId);

        if ((rest.invoiceType ?? existing?.invoiceType) === 'return') {
          if (!rest.notes?.trim() && !existing?.notes?.trim()) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'مردود المبيعات يتطلب سبب الإصدار' });
          }
          const original = await validateSalesReturnReference({
            orgId: ctx.user.orgId,
            sourceDocumentId: finalSourceDocId,
            basedOnNumber: rest.basedOnNumber ?? existing?.basedOnNumber ?? undefined,
          });
          rest.sourceDocumentId = original.id;
          rest.basedOnNumber = original.invoiceNumber;
          rest.basedOnType = 'sale';
        }
      }

      // تنفيذ التحديث داخل transaction؛ حجز القفل الاستشاري عند تحويل مسودة لمنع تضارب الأرقام
      const { finalInvoiceNumber, isPosted, autoPostedEntryNumber } = await db.transaction(async (tx) => {
        // حلّ warehouseId إذا كان فارغاً/غير مُرسل من الدفتر (السجلات القديمة)
        const resolvedWarehouseId = await resolveInvoiceWarehouseId(
          tx,
          finalWarehouseId,
          finalJournalId,
          ctx.user.orgId,
        );

        if (!isNowDraft && (rest.invoiceType ?? existing?.invoiceType) === 'return') {
          const original = await validateSalesReturnReference({
            orgId: ctx.user.orgId,
            sourceDocumentId: rest.sourceDocumentId ?? existing?.sourceDocumentId ?? undefined,
            basedOnNumber: rest.basedOnNumber ?? existing?.basedOnNumber ?? undefined,
          });
          rest.sourceDocumentId = original.id;
          rest.basedOnNumber = original.invoiceNumber;
          rest.basedOnType = 'sale';
        }

        if (isFinalizing && finalJournalId) {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${finalJournalId}::bigint)`);
        }

        // عند تحويل مسودة إلى مستند نهائي: استبدل رقم المسودة بالرقم الرسمي من دفتر المستندات
        let finalInvoiceNumber = existing?.invoiceNumber ?? '';
        let finalDraftNumber = existing?.draftNumber ?? null;
        if (isFinalizing && finalJournalId) {
          finalInvoiceNumber = await generateInvoiceNumberForJournal(tx, finalJournalId, ctx.user.orgId);
          // الاحتفاظ برقم المسودة الأصلي: إذا لم يكن موجوداً (بيانات قديمة)، نسجله من رقم المسودة السابق
          if (!finalDraftNumber && existing?.invoiceNumber) {
            finalDraftNumber = existing.invoiceNumber;
          }
        }

        await tx.update(salesInvoices).set({
          ...rest,
          ...(invoiceDate ? { invoiceDate: new Date(invoiceDate) } : {}),
          ...(isFinalizing ? { invoiceNumber: finalInvoiceNumber, draftNumber: finalDraftNumber } : {}),
          warehouseId: resolvedWarehouseId,
          updatedAt: new Date(),
        }).where(and(eq(salesInvoices.id, id), eq(salesInvoices.orgId, ctx.user.orgId)));
        if (items) {
          await tx.delete(salesInvoiceItems).where(eq(salesInvoiceItems.invoiceId, id));
          if (items.length > 0) {
            await tx.insert(salesInvoiceItems).values(
              items.map((item, idx) => ({
                ...item,
                invoiceId: id,
                orgId: ctx.user.orgId,
                sortOrder: item.sortOrder ?? idx,
              }))
            );
          }
        }

        // ── عند تحويل المسودة إلى مستند نهائي: سجّل تفاصيل الدفع داخل نفس transaction ──
        if (isFinalizing && rest.paymentBreakdown != null) {
          // امسح أي مدفوعات سابقة للمسودة (لا ينبغي أن تكون موجودة، لكن تأميناً)
          await tx.delete(salesInvoicePayments).where(
            and(eq(salesInvoicePayments.invoiceId, id), eq(salesInvoicePayments.orgId, ctx.user.orgId))
          );
          const pmEntries = Object.entries(rest.paymentBreakdown).filter(([, v]) => v > 0);
          if (pmEntries.length > 0) {
            const pms = await tx.query.paymentMethods.findMany({
              where: eq(paymentMethods.orgId, ctx.user.orgId),
            });
            const pmMap = new Map(pms.map(p => [p.code, p.nameAr]));
            await tx.insert(salesInvoicePayments).values(
              pmEntries.map(([code, amount]) => ({
                orgId: ctx.user.orgId,
                invoiceId: id,
                paymentMethodCode: code,
                paymentMethodName: pmMap.get(code) ?? code,
                amount: amount.toFixed(4),
              }))
            );
          }
        }

        // ── الترحيل التلقائي عند تحويل المسودة إلى مستند نهائي ─────────────────────
        if (isFinalizing) {
          try {
            const posted = await autoPostSalesInvoice(id, ctx.user.orgId, ctx.user.id, tx);
            if (posted) {
              return { finalInvoiceNumber, isPosted: true, autoPostedEntryNumber: posted.entryNumber };
            }
          } catch (e) {
            console.error('[sales.update] autoPostSalesInvoice error — rolling back:', e);
            throw e;
          }
        }

        return { finalInvoiceNumber, isPosted: false, autoPostedEntryNumber: undefined };
      });

      return { success: true, invoiceNumber: isFinalizing ? finalInvoiceNumber : undefined, isPosted, autoPostedEntryNumber };
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
      if (input.type === 'sale' && (invoice.status === 'draft' || invoice.status === 'cancelled' || invoice.customerId == null)) {
        return null;
      }

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

      const sourceJournal = invoice.journalId
        ? await db.query.documentJournals.findFirst({
            where: and(eq(documentJournals.id, invoice.journalId), eq(documentJournals.orgId, ctx.user.orgId)),
            columns: { id: true, code: true, name: true, docType: true, warehouseId: true, zatcaPosUnitId: true },
          })
        : null;
      let sourceZatcaUnit: { id: number; unitCode: string | null; unitName: string | null } | null = null;
      if (sourceJournal?.zatcaPosUnitId) {
        sourceZatcaUnit = await db.query.zatcaPosUnits.findFirst({
          where: and(eq(zatcaPosUnits.id, sourceJournal.zatcaPosUnitId), eq(zatcaPosUnits.orgId, ctx.user.orgId)),
          columns: { id: true, unitCode: true, unitName: true },
        }) ?? null;
      }
      return {
        id: invoice.id,
        sourceType: input.type,
        number: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        warehouseId: invoice.warehouseId,
        journalId: invoice.journalId,
        status: invoice.status,
        currency: invoice.currency ?? 'SAR',
        invoiceDate: invoice.invoiceDate,
        zatcaUuid: invoice.zatcaUuid,
        zatcaStatus: invoice.zatcaStatus,
        zatcaInvoiceType: invoice.zatcaInvoiceType ?? 'simplified',
        warehouseName: invoice.warehouseId
          ? (await db.query.warehouses.findFirst({
              where: and(eq(warehouses.id, invoice.warehouseId), eq(warehouses.orgId, ctx.user.orgId)),
              columns: { name: true },
            }))?.name ?? null
          : null,
        journal: sourceJournal,
        zatcaUnit: sourceZatcaUnit,
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

  // تحديث الدفع (PaymentModal)
  updatePayment: protectedProcedure
    .input(z.object({
      id: z.number(),
      paymentBreakdown: z.record(z.string(), z.number()).optional().nullable(),
      paidAmount: z.string(),
      remainingAmount: z.string(),
      status: z.enum(['paid', 'confirmed', 'draft']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, paymentBreakdown, paidAmount, remainingAmount, status } = input;
      const orgId = ctx.user.orgId;

      return db.transaction(async (tx) => {
        const invoice = await tx.query.salesInvoices.findFirst({
          where: and(eq(salesInvoices.id, id), eq(salesInvoices.orgId, orgId)),
        });
        if (!invoice) throw new Error('الفاتورة غير موجودة');
        if (invoice.isPosted) throw new Error('لا يمكن تعديل دفعة فاتورة مرحّلة');

        await tx.update(salesInvoices).set({
          paidAmount,
          remainingAmount,
          ...(status ? { status } : {}),
          updatedAt: new Date(),
        }).where(and(eq(salesInvoices.id, id), eq(salesInvoices.orgId, orgId)));

        if (paymentBreakdown != null) {
          await tx.delete(salesInvoicePayments).where(
            and(eq(salesInvoicePayments.invoiceId, id), eq(salesInvoicePayments.orgId, orgId))
          );
          const pmEntries = Object.entries(paymentBreakdown).filter(([, v]) => v > 0);
          if (pmEntries.length > 0) {
            const pms = await tx.query.paymentMethods.findMany({
              where: eq(paymentMethods.orgId, orgId),
            });
            const pmMap = new Map(pms.map(p => [p.code, p.nameAr]));
            await tx.insert(salesInvoicePayments).values(
              pmEntries.map(([code, amount]) => ({
                orgId,
                invoiceId: id,
                paymentMethodCode: code,
                paymentMethodName: pmMap.get(code) ?? code,
                amount: amount.toFixed(4),
              }))
            );
          }
        }
        return { success: true };
      });
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
