import { z } from 'zod';
import { eq, and, inArray, gte, lte } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import {
  salesInvoices, purchaseInvoices,
  journalEntries, journalEntryLines,
  documentJournals, chartOfAccounts,
} from '../schema.js';

// ── PostingEngine: كل Business Logic هنا ──────────────────────────────────────
import {
  resolveDocTypeAccounts,
  resolveDocTypeAccountsByJournal,
  buildSalesInvoiceLines,
  buildPurchaseInvoiceLines,
  autoPostSalesInvoice,
  autoPostPurchaseInvoice,
  validateAccounts,
  insertJournalEntry,
  type AccountLinkConfig,
} from '../services/PostingEngine.js';

// ── إعادة تصدير الدوال التي تستوردها روترات أخرى (sales.ts, purchases.ts) ────
export {
  resolveDocTypeAccounts,
  resolveDocTypeAccountsByJournal,
  buildSalesInvoiceLines,
  buildPurchaseInvoiceLines,
  autoPostSalesInvoice,
  autoPostPurchaseInvoice,
};

// ════════════════════════════════════════════════════════════════════════════
// Router
// ════════════════════════════════════════════════════════════════════════════
export const postingRouter = router({

  // ══════════════════════════════════════════════════════════════════════════
  // فاتورة المبيعات — معاينة + ترحيل + فك الترحيل
  // ══════════════════════════════════════════════════════════════════════════
  previewSalesInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const invoice = await db.query.salesInvoices.findFirst({
        where: and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, orgId)),
      });
      if (!invoice) throw new Error('الفاتورة غير موجودة');

      const journal = invoice.journalId
        ? await db.query.documentJournals.findFirst({
            where: and(eq(documentJournals.id, invoice.journalId), eq(documentJournals.orgId, orgId)),
          })
        : null;

      const docTypeAccs = invoice.docTypeId
        ? await resolveDocTypeAccounts(invoice.docTypeId, orgId)
        : invoice.journalId
          ? await resolveDocTypeAccountsByJournal(invoice.journalId, orgId)
          : null;

      const effectiveJournal = {
        ...(journal ?? {}),
        cashAccountId:     docTypeAccs?.cashAccountId     ?? journal?.cashAccountId     ?? null,
        salesAccountId:    docTypeAccs?.salesAccountId    ?? journal?.salesAccountId    ?? null,
        creditAccountId:   docTypeAccs?.creditAccountId   ?? journal?.creditAccountId   ?? null,
        taxAccountId:      docTypeAccs?.taxAccountId      ?? journal?.taxAccountId      ?? null,
        discountAccountId: docTypeAccs?.discountAccountId ?? journal?.discountAccountId ?? null,
        postingMode:       journal?.postingMode ?? 'manual',
      } as typeof documentJournals.$inferSelect;

      const { lines, warnings, totalDebit, totalCredit, isBalanced } =
        await buildSalesInvoiceLines(invoice, effectiveJournal, orgId);

      return {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate:   invoice.invoiceDate,
        customerName:  invoice.customerName,
        total:         invoice.total,
        paymentMethod: invoice.paymentMethod,
        journalName:   journal?.name ?? docTypeAccs?.docType?.nameAr ?? null,
        lines, warnings, totalDebit, totalCredit, isBalanced,
        canPost:  !invoice.isPosted,
        isPosted:  invoice.isPosted,
      };
    }),

  postSalesInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const invoice = await db.query.salesInvoices.findFirst({
        where: and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, orgId)),
      });
      if (!invoice) throw new Error('الفاتورة غير موجودة');
      if (invoice.isPosted) throw new Error('الفاتورة مرحَّلة مسبقاً');

      const journal = invoice.journalId
        ? await db.query.documentJournals.findFirst({
            where: and(eq(documentJournals.id, invoice.journalId), eq(documentJournals.orgId, orgId)),
          })
        : null;

      if (journal?.postingMode === 'disabled')
        throw new Error('الترحيل معطَّل لهذا الدفتر');

      const docTypeAccs = invoice.docTypeId
        ? await resolveDocTypeAccounts(invoice.docTypeId, orgId)
        : invoice.journalId
          ? await resolveDocTypeAccountsByJournal(invoice.journalId, orgId)
          : null;

      const effectiveJournal = {
        ...(journal ?? {}),
        cashAccountId:     docTypeAccs?.cashAccountId     ?? journal?.cashAccountId     ?? null,
        salesAccountId:    docTypeAccs?.salesAccountId    ?? journal?.salesAccountId    ?? null,
        creditAccountId:   docTypeAccs?.creditAccountId   ?? journal?.creditAccountId   ?? null,
        taxAccountId:      docTypeAccs?.taxAccountId      ?? journal?.taxAccountId      ?? null,
        discountAccountId: docTypeAccs?.discountAccountId ?? journal?.discountAccountId ?? null,
        postingMode:       journal?.postingMode ?? 'manual',
      } as typeof documentJournals.$inferSelect;

      const ptCfg = journal?.paymentTypesConfig as { accountLinks?: AccountLinkConfig[] } | null | undefined;
      const hasFieldLinks = Array.isArray(ptCfg?.accountLinks) &&
        ptCfg!.accountLinks.some(l => l.accountId && l.postingName && l.postingSide);

      if (!hasFieldLinks) {
        const isCredit = invoice.paymentMethod === 'credit';
        const missingAccounts: string[] = [];
        if (!effectiveJournal.salesAccountId) missingAccounts.push('حساب المبيعات/الإيرادات');
        if (isCredit  && !effectiveJournal.creditAccountId) missingAccounts.push('حساب ذمم العملاء (آجل)');
        if (!isCredit && !effectiveJournal.cashAccountId)   missingAccounts.push('حساب الصندوق/النقد');
        if (missingAccounts.length > 0)
          throw new Error(
            `لا يمكن ترحيل المستند لعدم اكتمال الروابط المحاسبية\nالحسابات الناقصة: ${missingAccounts.join('، ')}`
          );
      }

      const { lines, isBalanced } = await buildSalesInvoiceLines(invoice, effectiveJournal, orgId);
      if (!isBalanced) throw new Error('لا يمكن ترحيل المستند: المدين لا يساوي الدائن في القيد المحاسبي');

      await validateAccounts(lines.map(l => l.accountId));

      const entry = await insertJournalEntry({
        orgId,
        userId:          ctx.user.id,
        date:            invoice.invoiceDate,
        description:     `ترحيل فاتورة مبيعات ${invoice.invoiceNumber}`,
        reference:       invoice.invoiceNumber,
        sourceDocType:   'sales_invoice',
        sourceDocId:     invoice.id,
        sourceDocNumber: invoice.invoiceNumber,
        lines,
      });

      await db.update(salesInvoices)
        .set({ isPosted: true, postedAt: new Date(), postedJournalEntryId: entry.id, updatedAt: new Date() })
        .where(and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, orgId)));

      return { success: true, journalEntryId: entry.id, entryNumber: entry.entryNumber };
    }),

  unpostSalesInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const invoice = await db.query.salesInvoices.findFirst({
        where: and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, orgId)),
      });
      if (!invoice) throw new Error('الفاتورة غير موجودة');
      if (!invoice.isPosted) throw new Error('الفاتورة ليست مرحَّلة');

      const journal = invoice.journalId
        ? await db.query.documentJournals.findFirst({
            where: and(eq(documentJournals.id, invoice.journalId), eq(documentJournals.orgId, orgId)),
          })
        : null;

      if (journal && !journal.allowUnpost)
        throw new Error('إلغاء الترحيل غير مسموح به في هذا الدفتر');

      if (invoice.postedJournalEntryId) {
        await db.delete(journalEntryLines)
          .where(eq(journalEntryLines.entryId, invoice.postedJournalEntryId));
        await db.delete(journalEntries)
          .where(and(eq(journalEntries.id, invoice.postedJournalEntryId), eq(journalEntries.orgId, orgId)));
      }

      await db.update(salesInvoices)
        .set({ isPosted: false, postedAt: null, postedJournalEntryId: null, updatedAt: new Date() })
        .where(and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, orgId)));

      return { success: true };
    }),

  // ══════════════════════════════════════════════════════════════════════════
  // فاتورة المشتريات — معاينة + ترحيل + فك الترحيل
  // ══════════════════════════════════════════════════════════════════════════
  previewPurchaseInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const invoice = await db.query.purchaseInvoices.findFirst({
        where: and(eq(purchaseInvoices.id, input.invoiceId), eq(purchaseInvoices.orgId, orgId)),
      });
      if (!invoice) throw new Error('الفاتورة غير موجودة');

      const journal = invoice.journalId
        ? await db.query.documentJournals.findFirst({
            where: and(eq(documentJournals.id, invoice.journalId), eq(documentJournals.orgId, orgId)),
          })
        : null;

      const docTypeAccs = invoice.docTypeId
        ? await resolveDocTypeAccounts(invoice.docTypeId, orgId)
        : invoice.journalId
          ? await resolveDocTypeAccountsByJournal(invoice.journalId, orgId)
          : null;

      const effectiveJournal = {
        purchaseAccountId: docTypeAccs?.purchaseAccountId ?? journal?.purchaseAccountId ?? null,
        supplierAccountId: docTypeAccs?.supplierAccountId ?? journal?.supplierAccountId ?? null,
        cashAccountId:     docTypeAccs?.cashAccountId     ?? journal?.cashAccountId     ?? null,
        taxAccountId:      docTypeAccs?.taxAccountId      ?? journal?.taxAccountId      ?? null,
        discountAccountId: docTypeAccs?.discountAccountId ?? journal?.discountAccountId ?? null,
      };

      const { lines, warnings, totalDebit, totalCredit, isBalanced } =
        await buildPurchaseInvoiceLines(invoice, effectiveJournal, orgId);

      return {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate:   invoice.invoiceDate,
        supplierName:  invoice.supplierName,
        total:         invoice.total,
        paymentMethod: invoice.paymentMethod,
        journalName:   journal?.name ?? docTypeAccs?.docType?.nameAr ?? null,
        lines, warnings, totalDebit, totalCredit, isBalanced,
        canPost:  !invoice.isPosted,
        isPosted:  invoice.isPosted,
      };
    }),

  postPurchaseInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const invoice = await db.query.purchaseInvoices.findFirst({
        where: and(eq(purchaseInvoices.id, input.invoiceId), eq(purchaseInvoices.orgId, orgId)),
      });
      if (!invoice) throw new Error('الفاتورة غير موجودة');
      if (invoice.isPosted) throw new Error('الفاتورة مرحَّلة مسبقاً');

      const journal = invoice.journalId
        ? await db.query.documentJournals.findFirst({
            where: and(eq(documentJournals.id, invoice.journalId), eq(documentJournals.orgId, orgId)),
          })
        : null;

      if (journal?.postingMode === 'disabled')
        throw new Error('الترحيل معطَّل لهذا الدفتر');

      const docTypeAccs = invoice.docTypeId
        ? await resolveDocTypeAccounts(invoice.docTypeId, orgId)
        : invoice.journalId
          ? await resolveDocTypeAccountsByJournal(invoice.journalId, orgId)
          : null;

      const effectiveJournal = {
        purchaseAccountId: docTypeAccs?.purchaseAccountId ?? journal?.purchaseAccountId ?? null,
        supplierAccountId: docTypeAccs?.supplierAccountId ?? journal?.supplierAccountId ?? null,
        cashAccountId:     docTypeAccs?.cashAccountId     ?? journal?.cashAccountId     ?? null,
        taxAccountId:      docTypeAccs?.taxAccountId      ?? journal?.taxAccountId      ?? null,
        discountAccountId: docTypeAccs?.discountAccountId ?? journal?.discountAccountId ?? null,
      };

      const isCredit = invoice.paymentMethod === 'credit';
      const missingAccounts: string[] = [];
      if (!effectiveJournal.purchaseAccountId) missingAccounts.push('حساب المشتريات');
      if (isCredit  && !effectiveJournal.supplierAccountId) missingAccounts.push('حساب ذمم الموردين (آجل)');
      if (!isCredit && !effectiveJournal.cashAccountId)     missingAccounts.push('حساب الصندوق/النقد');
      if (missingAccounts.length > 0)
        throw new Error(
          `لا يمكن ترحيل المستند لعدم اكتمال الروابط المحاسبية\nالحسابات الناقصة: ${missingAccounts.join('، ')}`
        );

      const { lines, isBalanced } = await buildPurchaseInvoiceLines(invoice, effectiveJournal, orgId);
      if (!isBalanced) throw new Error('لا يمكن ترحيل المستند: المدين لا يساوي الدائن في القيد المحاسبي');

      await validateAccounts(lines.map(l => l.accountId));

      const entry = await insertJournalEntry({
        orgId,
        userId:          ctx.user.id,
        date:            invoice.invoiceDate,
        description:     `ترحيل فاتورة مشتريات ${invoice.invoiceNumber}`,
        reference:       invoice.invoiceNumber,
        sourceDocType:   'purchase_invoice',
        sourceDocId:     invoice.id,
        sourceDocNumber: invoice.invoiceNumber,
        lines,
      });

      await db.update(purchaseInvoices)
        .set({ isPosted: true, postedAt: new Date(), postedJournalEntryId: entry.id, updatedAt: new Date() })
        .where(and(eq(purchaseInvoices.id, input.invoiceId), eq(purchaseInvoices.orgId, orgId)));

      return { success: true, journalEntryId: entry.id, entryNumber: entry.entryNumber };
    }),

  unpostPurchaseInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const invoice = await db.query.purchaseInvoices.findFirst({
        where: and(eq(purchaseInvoices.id, input.invoiceId), eq(purchaseInvoices.orgId, orgId)),
      });
      if (!invoice) throw new Error('الفاتورة غير موجودة');
      if (!invoice.isPosted) throw new Error('الفاتورة ليست مرحَّلة');

      const journal = invoice.journalId
        ? await db.query.documentJournals.findFirst({
            where: and(eq(documentJournals.id, invoice.journalId), eq(documentJournals.orgId, orgId)),
          })
        : null;

      if (journal && !journal.allowUnpost)
        throw new Error('إلغاء الترحيل غير مسموح به في هذا الدفتر');

      if (invoice.postedJournalEntryId) {
        await db.delete(journalEntryLines)
          .where(eq(journalEntryLines.entryId, invoice.postedJournalEntryId));
        await db.delete(journalEntries)
          .where(and(eq(journalEntries.id, invoice.postedJournalEntryId), eq(journalEntries.orgId, orgId)));
      }

      await db.update(purchaseInvoices)
        .set({ isPosted: false, postedAt: null, postedJournalEntryId: null, updatedAt: new Date() })
        .where(and(eq(purchaseInvoices.id, input.invoiceId), eq(purchaseInvoices.orgId, orgId)));

      return { success: true };
    }),

  // ══════════════════════════════════════════════════════════════════════════
  // المرحلة الثانية: ترحيل المشتريات للمخزون
  // القيد: مدين المخزون / دائن حساب المشتريات
  // ══════════════════════════════════════════════════════════════════════════
  previewPostPurchasesToInventory: protectedProcedure
    .input(z.object({
      fromDate:    z.string().optional(),
      toDate:      z.string().optional(),
      warehouseId: z.number().optional(),
      journalId:   z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const conds = [
        eq(purchaseInvoices.orgId, orgId),
        eq(purchaseInvoices.isPosted, true),
        eq(purchaseInvoices.inventoryPosted, false),
      ];
      if (input.fromDate)    conds.push(gte(purchaseInvoices.invoiceDate, new Date(input.fromDate)));
      if (input.toDate)      conds.push(lte(purchaseInvoices.invoiceDate, new Date(input.toDate)));
      if (input.warehouseId) conds.push(eq(purchaseInvoices.warehouseId, input.warehouseId));
      if (input.journalId)   conds.push(eq(purchaseInvoices.journalId,   input.journalId));

      const invoices = await db.query.purchaseInvoices.findMany({ where: and(...conds) });
      const totalAmount = invoices.reduce((s, inv) => s + Number(inv.subtotal ?? 0), 0);
      return {
        count: invoices.length,
        totalAmount: totalAmount.toFixed(4),
        invoices: invoices.map(inv => ({
          id:            inv.id,
          invoiceNumber: inv.invoiceNumber,
          supplierName:  inv.supplierName,
          invoiceDate:   inv.invoiceDate,
          subtotal:      inv.subtotal,
        })),
      };
    }),

  postPurchasesToInventory: protectedProcedure
    .input(z.object({
      fromDate:           z.string().optional(),
      toDate:             z.string().optional(),
      warehouseId:        z.number().optional(),
      journalId:          z.number().optional(),
      inventoryAccountId: z.number(),
      purchasesAccountId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const conds = [
        eq(purchaseInvoices.orgId, orgId),
        eq(purchaseInvoices.isPosted, true),
        eq(purchaseInvoices.inventoryPosted, false),
      ];
      if (input.fromDate)    conds.push(gte(purchaseInvoices.invoiceDate, new Date(input.fromDate)));
      if (input.toDate)      conds.push(lte(purchaseInvoices.invoiceDate, new Date(input.toDate)));
      if (input.warehouseId) conds.push(eq(purchaseInvoices.warehouseId, input.warehouseId));
      if (input.journalId)   conds.push(eq(purchaseInvoices.journalId,   input.journalId));

      const invoices = await db.query.purchaseInvoices.findMany({ where: and(...conds) });
      if (!invoices.length) throw new Error('لا توجد فواتير مشتريات مرحَّلة وغير محوَّلة للمخزون في النطاق المحدد');

      await validateAccounts([input.inventoryAccountId, input.purchasesAccountId]);

      const [invAcc, purAcc] = await Promise.all([
        db.query.chartOfAccounts.findFirst({ where: eq(chartOfAccounts.id, input.inventoryAccountId) }),
        db.query.chartOfAccounts.findFirst({ where: eq(chartOfAccounts.id, input.purchasesAccountId) }),
      ]);

      const totalAmount = invoices.reduce((s, inv) => s + Number(inv.subtotal ?? 0), 0);

      const lines = [
        {
          accountId:   input.inventoryAccountId,
          accountCode: invAcc?.code ?? '---',
          accountName: invAcc?.name ?? 'المخزون',
          debit:       totalAmount.toFixed(4),
          credit:      '0.0000',
          description: `ترحيل المشتريات للمخزون — ${invoices.length} فاتورة`,
        },
        {
          accountId:   input.purchasesAccountId,
          accountCode: purAcc?.code ?? '---',
          accountName: purAcc?.name ?? 'المشتريات',
          debit:       '0.0000',
          credit:      totalAmount.toFixed(4),
          description: `تصفير حساب المشتريات — ${invoices.length} فاتورة`,
        },
      ];

      const entry = await insertJournalEntry({
        orgId,
        userId:          ctx.user.id,
        date:            new Date(),
        description:     `ترحيل المشتريات للمخزون — ${invoices.length} فاتورة — إجمالي ${totalAmount.toFixed(2)}`,
        reference:       `INV-XFER-${Date.now()}`,
        sourceDocType:   'purchase_to_inventory',
        sourceDocId:     0,
        sourceDocNumber: `PURCH-INV-${new Date().toISOString().slice(0, 10)}`,
        lines,
      });

      const invoiceIds = invoices.map(inv => inv.id);
      await db.update(purchaseInvoices)
        .set({ inventoryPosted: true, costPostedJournalEntryId: entry.id, updatedAt: new Date() })
        .where(and(eq(purchaseInvoices.orgId, orgId), inArray(purchaseInvoices.id, invoiceIds)));

      return { success: true, count: invoices.length, totalAmount: totalAmount.toFixed(4), entryNumber: entry.entryNumber };
    }),

  // ══════════════════════════════════════════════════════════════════════════
  // المرحلة الثانية: ترحيل تكلفة المبيعات (COGS)
  // القيد: مدين تكلفة المبيعات / دائن المخزون
  // ══════════════════════════════════════════════════════════════════════════
  previewPostSalesCOGS: protectedProcedure
    .input(z.object({
      fromDate:    z.string().optional(),
      toDate:      z.string().optional(),
      warehouseId: z.number().optional(),
      journalId:   z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const conds = [
        eq(salesInvoices.orgId, orgId),
        eq(salesInvoices.isPosted, true),
        eq(salesInvoices.costPosted, false),
      ];
      if (input.fromDate)  conds.push(gte(salesInvoices.invoiceDate, new Date(input.fromDate)));
      if (input.toDate)    conds.push(lte(salesInvoices.invoiceDate, new Date(input.toDate)));
      if (input.journalId) conds.push(eq(salesInvoices.journalId, input.journalId));

      const invoices = await db.query.salesInvoices.findMany({ where: and(...conds) });
      const totalCost = invoices.reduce((s, inv) => s + Number(inv.subtotal ?? 0), 0);
      return {
        count: invoices.length,
        totalCost: totalCost.toFixed(4),
        invoices: invoices.map(inv => ({
          id:            inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerName:  inv.customerName,
          invoiceDate:   inv.invoiceDate,
          subtotal:      inv.subtotal,
        })),
      };
    }),

  postSalesCOGS: protectedProcedure
    .input(z.object({
      fromDate:           z.string().optional(),
      toDate:             z.string().optional(),
      warehouseId:        z.number().optional(),
      journalId:          z.number().optional(),
      cogsAccountId:      z.number(),
      inventoryAccountId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const conds = [
        eq(salesInvoices.orgId, orgId),
        eq(salesInvoices.isPosted, true),
        eq(salesInvoices.costPosted, false),
      ];
      if (input.fromDate)  conds.push(gte(salesInvoices.invoiceDate, new Date(input.fromDate)));
      if (input.toDate)    conds.push(lte(salesInvoices.invoiceDate, new Date(input.toDate)));
      if (input.journalId) conds.push(eq(salesInvoices.journalId, input.journalId));

      const invoices = await db.query.salesInvoices.findMany({ where: and(...conds) });
      if (!invoices.length) throw new Error('لا توجد فواتير مبيعات مرحَّلة وغير محوَّل تكلفتها في النطاق المحدد');

      await validateAccounts([input.cogsAccountId, input.inventoryAccountId]);

      const [cogsAcc, invAcc] = await Promise.all([
        db.query.chartOfAccounts.findFirst({ where: eq(chartOfAccounts.id, input.cogsAccountId) }),
        db.query.chartOfAccounts.findFirst({ where: eq(chartOfAccounts.id, input.inventoryAccountId) }),
      ]);

      const totalCost = invoices.reduce((s, inv) => s + Number(inv.subtotal ?? 0), 0);

      const lines = [
        {
          accountId:   input.cogsAccountId,
          accountCode: cogsAcc?.code ?? '---',
          accountName: cogsAcc?.name ?? 'تكلفة المبيعات',
          debit:       totalCost.toFixed(4),
          credit:      '0.0000',
          description: `تكلفة المبيعات — ${invoices.length} فاتورة`,
        },
        {
          accountId:   input.inventoryAccountId,
          accountCode: invAcc?.code ?? '---',
          accountName: invAcc?.name ?? 'المخزون',
          debit:       '0.0000',
          credit:      totalCost.toFixed(4),
          description: `تخفيض المخزون — بتكلفة المبيعات — ${invoices.length} فاتورة`,
        },
      ];

      const entry = await insertJournalEntry({
        orgId,
        userId:          ctx.user.id,
        date:            new Date(),
        description:     `ترحيل تكلفة المبيعات — ${invoices.length} فاتورة — إجمالي ${totalCost.toFixed(2)}`,
        reference:       `COGS-${Date.now()}`,
        sourceDocType:   'sales_cogs',
        sourceDocId:     0,
        sourceDocNumber: `COGS-${new Date().toISOString().slice(0, 10)}`,
        lines,
      });

      const invoiceIds = invoices.map(inv => inv.id);
      await db.update(salesInvoices)
        .set({ costPosted: true, costPostedJournalEntryId: entry.id, updatedAt: new Date() })
        .where(and(eq(salesInvoices.orgId, orgId), inArray(salesInvoices.id, invoiceIds)));

      return { success: true, count: invoices.length, totalCost: totalCost.toFixed(4), entryNumber: entry.entryNumber };
    }),

  // ══════════════════════════════════════════════════════════════════════════
  // إعدادات الترحيل
  // ══════════════════════════════════════════════════════════════════════════
  listJournalSettings: protectedProcedure.query(async ({ ctx }) => {
    const journals = await db.query.documentJournals.findMany({
      where: eq(documentJournals.orgId, ctx.user.orgId),
      orderBy: [documentJournals.docType, documentJournals.sortOrder],
    });
    return journals.map(j => ({
      id:                  j.id,
      name:                j.name,
      code:                j.code,
      docType:             j.docType,
      postingMode:         j.postingMode ?? 'manual',
      allowUnpost:         j.allowUnpost ?? true,
      allowEditAfterPost:  j.allowEditAfterPost ?? false,
    }));
  }),

  updateJournalSettings: protectedProcedure
    .input(z.object({
      journalId:          z.number(),
      postingMode:        z.enum(['auto', 'manual', 'disabled']),
      allowUnpost:        z.boolean(),
      allowEditAfterPost: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.update(documentJournals)
        .set({
          postingMode:        input.postingMode,
          allowUnpost:        input.allowUnpost,
          allowEditAfterPost: input.allowEditAfterPost,
          updatedAt:          new Date(),
        })
        .where(and(eq(documentJournals.id, input.journalId), eq(documentJournals.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  getSalesInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.query.salesInvoices.findFirst({
        where: and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, ctx.user.orgId)),
      });
    }),
});
