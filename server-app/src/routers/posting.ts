import { z } from 'zod';
import { eq, and, inArray, gte, lte, sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import {
  salesInvoices, purchaseInvoices,
  journalEntries, journalEntryLines,
  documentJournals, chartOfAccounts,
  pendingAccountMovements, pendingStockMovements,
  stockVouchers, stockVoucherItems, purchaseInvoiceItems, warehouses,
} from '../schema.js';

// ── PostingEngine: كل Business Logic هنا ──────────────────────────────────────
import {
  resolveDocTypeAccounts,
  resolveDocTypeAccountsByJournal,
  buildSalesInvoiceLines,
  buildPurchaseInvoiceLines,
  autoPostSalesInvoice,
  autoPostPurchaseInvoice,
  postSalesReturnStock,
  reverseSalesReturnStock,
  validateAccounts,
  insertJournalEntry,
  reserveDocumentNumber,
  type AccountLinkConfig,
} from '../services/PostingEngine.js';

type IssuanceConfig = {
  journalEntryType?: string | null;
  journalBookId?: string | number | null;
  inventoryDocType?: string | null;
  inventoryDocBookId?: string | number | null;
};

function parseIssuanceConfig(value: unknown): Required<IssuanceConfig> {
  const config = (value && typeof value === 'object' ? value : {}) as IssuanceConfig;
  const journalBookId = Number(config.journalBookId);
  const inventoryDocBookId = Number(config.inventoryDocBookId);
  if (!config.journalEntryType || !Number.isInteger(journalBookId) ||
      !config.inventoryDocType || !Number.isInteger(inventoryDocBookId)) {
    throw new Error('لا يمكن الترحيل: خصائص السندات المصدرة غير مكتملة في دفتر فاتورة المشتريات');
  }
  if (!config.inventoryDocType.includes('receipt')) {
    throw new Error('لا يمكن ترحيل فاتورة مشتريات إلى نوع مستند مخزون غير توريد');
  }
  return {
    journalEntryType: config.journalEntryType,
    journalBookId,
    inventoryDocType: config.inventoryDocType,
    inventoryDocBookId,
  };
}

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
         journalName:   journal?.name ?? null,
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

      return db.transaction(async (tx) => {
        const locked = await tx.query.salesInvoices.findFirst({
          where: and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, orgId)),
        });
        if (!locked || locked.isPosted) throw new Error('الفاتورة مرحَّلة مسبقاً أو غير موجودة');

        const entry = await insertJournalEntry({
          orgId,
          userId: ctx.user.id,
          date: locked.invoiceDate,
          description: `ترحيل ${locked.invoiceType === 'debit_note' ? 'إشعار مدين' : 'مستند مبيعات'} ${locked.invoiceNumber}`,
          reference: locked.invoiceNumber,
          sourceDocType: locked.invoiceType === 'debit_note'
            ? 'debit_note'
            : locked.invoiceType === 'credit_note'
              ? 'credit_note'
              : locked.invoiceType === 'return'
                ? 'sales_return'
                : 'sales_invoice',
          sourceDocId: locked.id,
          sourceDocNumber: locked.invoiceNumber,
          lines,
          tx,
        });
        const stockVoucher = locked.invoiceType === 'return'
          ? await postSalesReturnStock(locked, orgId, ctx.user.id, tx)
          : null;

        await tx.update(salesInvoices)
          .set({
            isPosted: true,
            postedAt: new Date(),
            postedJournalEntryId: entry.id,
            ...(stockVoucher ? { generatedStockVoucherId: stockVoucher.id } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, orgId)));

        return { success: true, journalEntryId: entry.id, entryNumber: entry.entryNumber };
      });
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

      return db.transaction(async (tx) => {
        const locked = await tx.query.salesInvoices.findFirst({
          where: and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, orgId)),
        });
        if (!locked || !locked.isPosted) throw new Error('الفاتورة ليست مرحَّلة');

        if (locked.invoiceType === 'return') {
          await reverseSalesReturnStock(locked, orgId, tx);
        }
        if (locked.postedJournalEntryId) {
          await tx.delete(journalEntryLines)
            .where(eq(journalEntryLines.entryId, locked.postedJournalEntryId));
          await tx.delete(journalEntries)
            .where(and(eq(journalEntries.id, locked.postedJournalEntryId), eq(journalEntries.orgId, orgId)));
        }

        await tx.update(salesInvoices)
          .set({
            isPosted: false,
            postedAt: null,
            postedJournalEntryId: null,
            generatedStockVoucherId: null,
            generatedStockJournalEntryId: null,
            updatedAt: new Date(),
          })
          .where(and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, orgId)));

        return { success: true };
      });
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

      const effectiveJournal = {
        purchaseAccountId: journal?.purchaseAccountId ?? null,
        supplierAccountId: journal?.supplierAccountId ?? null,
        cashAccountId:     journal?.cashAccountId     ?? null,
        taxAccountId:      journal?.taxAccountId      ?? null,
        discountAccountId: journal?.discountAccountId ?? null,
      };

      const { lines, warnings, totalDebit, totalCredit, isBalanced } =
        await buildPurchaseInvoiceLines(invoice, effectiveJournal, orgId);

      return {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate:   invoice.invoiceDate,
        supplierName:  invoice.supplierName,
        total:         invoice.total,
        paymentMethod: invoice.paymentMethod,
        journalName:   journal?.name ?? null,
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

      const effectiveJournal = {
        purchaseAccountId: journal?.purchaseAccountId ?? null,
        supplierAccountId: journal?.supplierAccountId ?? null,
        cashAccountId:     journal?.cashAccountId     ?? null,
        taxAccountId:      journal?.taxAccountId      ?? null,
        discountAccountId: journal?.discountAccountId ?? null,
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

      return db.transaction(async (tx) => {
        const locked = await tx.execute(sql`
          SELECT id, is_posted AS "isPosted"
          FROM purchase_invoices
          WHERE id = ${input.invoiceId} AND org_id = ${orgId}
          FOR UPDATE
        `);
        const lockedRow = locked.rows[0] as { id: number; isPosted: boolean } | undefined;
        if (!lockedRow) throw new Error('الفاتورة غير موجودة');
        if (lockedRow.isPosted) throw new Error('الفاتورة مرحَّلة مسبقاً');

        if (invoice.invoiceType === 'debit_note') {
          throw new Error('إشعار المدين مستند مبيعات صادر ولا يجوز ترحيله من مسار المشتريات');
        }

        const issuance = parseIssuanceConfig(journal?.issuanceConfig);
        const outputJournal = await tx.query.documentJournals.findFirst({
          where: and(
            eq(documentJournals.id, Number(issuance.journalBookId)),
            eq(documentJournals.orgId, orgId),
            eq(documentJournals.isActive, true),
          ),
        });
        const stockBook = await tx.query.documentJournals.findFirst({
          where: and(
            eq(documentJournals.id, Number(issuance.inventoryDocBookId)),
            eq(documentJournals.orgId, orgId),
            eq(documentJournals.isActive, true),
          ),
        });
        if (!outputJournal || outputJournal.docType !== issuance.journalEntryType) {
          throw new Error('دفتر القيد الناتج لا يطابق نوع القيد المحدد في خصائص السندات المصدرة');
        }
        if (!stockBook || stockBook.docType !== issuance.inventoryDocType) {
          throw new Error('دفتر مستند المخزون الناتج لا يطابق نوع المستند المحدد في خصائص السندات المصدرة');
        }
        if (!stockBook.warehouseId || stockBook.warehouseId !== invoice.warehouseId) {
          throw new Error('دفتر سند التوريد يجب أن يكون مرتبطًا بنفس مخزن فاتورة المشتريات');
        }
        const stockDocTypeAccs = await resolveDocTypeAccountsByJournal(stockBook.id, orgId);
        const stockAccounts = {
          inventoryAccountId: stockDocTypeAccs?.inventoryAccountId ?? stockBook.inventoryAccountId ?? null,
          purchaseAccountId: stockDocTypeAccs?.purchaseAccountId ?? stockBook.purchaseAccountId ?? null,
        };
        if (!stockAccounts.inventoryAccountId || !stockAccounts.purchaseAccountId) {
          throw new Error('دفتر/تعريف ترحيل سند التوريد يجب أن يحدد حساب المخزون وحساب المشتريات');
        }
        await validateAccounts([stockAccounts.inventoryAccountId, stockAccounts.purchaseAccountId]);

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
          journalId: outputJournal.id,
          generatedDocType: issuance.journalEntryType,
          tx,
        });

        const { number: stockNumber } = await reserveDocumentNumber(stockBook.id, orgId, tx);
        const invoiceItems = await tx.query.purchaseInvoiceItems.findMany({
          where: eq(purchaseInvoiceItems.invoiceId, invoice.id),
        });
        const stockItems = invoiceItems.filter((item) => item.productId && Number(item.quantity) !== 0);
        if (!stockItems.length) throw new Error('لا يمكن إنشاء سند توريد: الفاتورة لا تحتوي أصنافًا مخزنية');
        const stockTotal = stockItems.reduce((sum, item) => sum + Number(item.total), 0).toFixed(4);
        const [stockVoucher] = await tx.insert(stockVouchers).values({
          orgId,
          voucherNumber: stockNumber,
          type: 'receipt',
          voucherDate: invoice.invoiceDate,
          warehouseId: invoice.warehouseId,
          branchId: null,
          supplierId: invoice.supplierId,
          reason: `توريد أصناف من فاتورة مشتريات ${invoice.invoiceNumber}`,
          notes: invoice.notes,
          totalCost: stockTotal,
          status: 'confirmed',
          userId: ctx.user.id,
          sourceDocType: 'purchase_invoice',
          sourceDocId: invoice.id,
          sourceDocNumber: invoice.invoiceNumber,
          sourceJournalId: stockBook.id,
        }).returning();
        await tx.insert(stockVoucherItems).values(stockItems.map((item, index) => ({
          voucherId: stockVoucher.id,
          orgId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitCost: item.unitPrice,
          totalCost: item.total,
          sortOrder: index,
        })));

        const stockLines = [
          {
            accountId: stockAccounts.inventoryAccountId,
            accountCode: '',
            accountName: 'المخزون',
            debit: stockTotal,
            credit: '0.0000',
            description: `مخزون سند التوريد ${stockNumber}`,
          },
          {
            accountId: stockAccounts.purchaseAccountId,
            accountCode: '',
            accountName: 'إجمالي المشتريات',
            debit: '0.0000',
            credit: stockTotal,
            description: `تسوية مشتريات سند التوريد ${stockNumber}`,
          },
        ];
        const stockEntry = await insertJournalEntry({
          orgId,
          userId: ctx.user.id,
          date: invoice.invoiceDate,
          description: `قيد سند توريد ${stockNumber} من فاتورة ${invoice.invoiceNumber}`,
          reference: stockNumber,
          sourceDocType: 'stock_receipt',
          sourceDocId: stockVoucher.id,
          sourceDocNumber: stockNumber,
          lines: stockLines,
          journalId: stockBook.id,
          generatedDocType: issuance.inventoryDocType,
          tx,
        });
        await tx.update(stockVouchers).set({ generatedJournalEntryId: stockEntry.id }).where(eq(stockVouchers.id, stockVoucher.id));

        const [updatedInvoice] = await tx.update(purchaseInvoices)
          .set({
            isPosted: true,
            postedAt: new Date(),
            postedJournalEntryId: entry.id,
            generatedStockVoucherId: stockVoucher.id,
            generatedStockJournalEntryId: stockEntry.id,
            updatedAt: new Date(),
          })
          .where(and(eq(purchaseInvoices.id, invoice.id), eq(purchaseInvoices.orgId, orgId), eq(purchaseInvoices.isPosted, false)))
          .returning({ id: purchaseInvoices.id });
        if (!updatedInvoice) throw new Error('الفاتورة تغيرت حالتها أثناء الترحيل');

        await tx.update(pendingAccountMovements)
          .set({ status: 'linked', linkedJournalEntryId: entry.id, linkedStockVoucherId: stockVoucher.id, updatedAt: new Date() })
          .where(and(
            eq(pendingAccountMovements.orgId, orgId),
            eq(pendingAccountMovements.sourceDocType, 'purchase_invoice'),
            eq(pendingAccountMovements.sourceDocId, invoice.id),
            eq(pendingAccountMovements.status, 'unposted'),
          ));
        await tx.update(pendingStockMovements)
          .set({ status: 'linked', linkedJournalEntryId: stockEntry.id, linkedStockVoucherId: stockVoucher.id, updatedAt: new Date() })
          .where(and(
            eq(pendingStockMovements.orgId, orgId),
            eq(pendingStockMovements.sourceDocType, 'purchase_invoice'),
            eq(pendingStockMovements.sourceDocId, invoice.id),
            eq(pendingStockMovements.status, 'unposted'),
          ));

        return {
          success: true,
          journalEntryId: entry.id,
          entryNumber: entry.entryNumber,
          stockVoucherId: stockVoucher.id,
          stockVoucherNumber: stockNumber,
          stockJournalEntryId: stockEntry.id,
          stockEntryNumber: stockEntry.entryNumber,
        };
      });
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

      return db.transaction(async (tx) => {
        if (invoice.postedJournalEntryId) {
          await tx.delete(journalEntryLines)
            .where(eq(journalEntryLines.entryId, invoice.postedJournalEntryId));
          await tx.update(journalEntries)
            .set({ status: 'cancelled' })
            .where(and(eq(journalEntries.id, invoice.postedJournalEntryId), eq(journalEntries.orgId, orgId)));
        }
        if (invoice.generatedStockJournalEntryId) {
          await tx.delete(journalEntryLines)
            .where(eq(journalEntryLines.entryId, invoice.generatedStockJournalEntryId));
          await tx.update(journalEntries)
            .set({ status: 'cancelled' })
            .where(and(eq(journalEntries.id, invoice.generatedStockJournalEntryId), eq(journalEntries.orgId, orgId)));
        }
        if (invoice.generatedStockVoucherId) {
          await tx.update(stockVouchers)
            .set({ status: 'cancelled' })
            .where(and(eq(stockVouchers.id, invoice.generatedStockVoucherId), eq(stockVouchers.orgId, orgId)));
        }

        await tx.update(purchaseInvoices)
          .set({
            isPosted: false,
            postedAt: null,
            postedJournalEntryId: null,
            generatedStockVoucherId: null,
            generatedStockJournalEntryId: null,
            updatedAt: new Date(),
          })
          .where(and(eq(purchaseInvoices.id, input.invoiceId), eq(purchaseInvoices.orgId, orgId)));

        await tx.update(pendingAccountMovements)
          .set({ status: 'unposted', linkedJournalEntryId: null, linkedStockVoucherId: null, updatedAt: new Date() })
          .where(and(
            eq(pendingAccountMovements.orgId, orgId),
            eq(pendingAccountMovements.sourceDocType, 'purchase_invoice'),
            eq(pendingAccountMovements.sourceDocId, invoice.id),
            eq(pendingAccountMovements.linkedJournalEntryId, invoice.postedJournalEntryId),
          ));
        await tx.update(pendingStockMovements)
          .set({ status: 'unposted', linkedJournalEntryId: null, linkedStockVoucherId: null, updatedAt: new Date() })
          .where(and(
            eq(pendingStockMovements.orgId, orgId),
            eq(pendingStockMovements.sourceDocType, 'purchase_invoice'),
            eq(pendingStockMovements.sourceDocId, invoice.id),
            eq(pendingStockMovements.linkedJournalEntryId, invoice.generatedStockJournalEntryId),
          ));

        return { success: true };
      });
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
