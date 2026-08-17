import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { eq, and, inArray, gte, lte, sql, isNull } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import {
  salesInvoices, salesInvoiceItems, purchaseInvoices,
  journalEntries, journalEntryLines,
  documentJournals, chartOfAccounts,
  documentRelations, unpostAudit,
  pendingAccountMovements, pendingStockMovements,
  stockVouchers, stockVoucherItems, purchaseInvoiceItems, warehouses,
} from '../schema.js';

// ── PostingEngine: كل Business Logic هنا ──────────────────────────────────────
import {
  resolveDocTypeAccounts,
  resolveDocTypeAccountsByJournal,
  buildSalesInvoiceLines,
  buildSalesPostingLines,
  buildPurchaseInvoiceLines,
  autoPostSalesInvoice,
  autoPostPurchaseInvoice,
  validateAccounts,
  insertJournalEntry,
  reserveDocumentNumber,
  getConfiguredAccountLinks,
  type AccountLinkConfig,
  type PaymentTypesConfig,
} from '../services/PostingEngine.js';
import {
  deleteSalesStockMovement,
  postSalesStockMovement,
  syncUnpostedSalesEffects,
} from '../services/salesPostingEffects.js';
import { assertJournalAccess, assertSalesPermission, assertWarehouseAccess } from '../lib/salesPermissions.js';

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

function parseSalesIssuanceConfig(value: unknown): Required<Pick<IssuanceConfig, 'journalEntryType' | 'journalBookId'>> {
  const config = (value && typeof value === 'object' ? value : {}) as IssuanceConfig;
  const journalBookId = Number(config.journalBookId);
  if (!config.journalEntryType || !Number.isInteger(journalBookId)) {
    throw new Error('لا يمكن الترحيل: دفتر فاتورة المبيعات لا يحدد Target Journal لقيد المبيعات');
  }
  return {
    journalEntryType: config.journalEntryType,
    journalBookId,
  };
}

function isSalesReturnType(value: string | null | undefined): boolean {
  return value === 'return' || value === 'credit_note';
}

// ── إعادة تصدير الدوال التي تستوردها روترات أخرى (sales.ts, purchases.ts) ────
export {
  resolveDocTypeAccounts,
  resolveDocTypeAccountsByJournal,
  buildSalesInvoiceLines,
  buildSalesPostingLines,
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
        await buildSalesPostingLines(invoice, effectiveJournal, orgId);

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
      await assertSalesPermission(ctx.user, 'post');
      const invoice = await db.query.salesInvoices.findFirst({
        where: and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, orgId)),
      });
      if (!invoice) throw new Error('الفاتورة غير موجودة');
      if (invoice.isPosted) throw new Error('الفاتورة مرحَّلة مسبقاً');
      if (invoice.status === 'draft') throw new Error('لا يمكن ترحيل مسودة قبل اعتمادها');

      const journal = invoice.journalId
        ? await db.query.documentJournals.findFirst({
            where: and(eq(documentJournals.id, invoice.journalId), eq(documentJournals.orgId, orgId)),
          })
        : null;

      if (journal?.postingMode === 'disabled')
        throw new Error('الترحيل معطَّل لهذا الدفتر');
      await assertJournalAccess(ctx.user, invoice.journalId);
      await assertWarehouseAccess(ctx.user, invoice.warehouseId);
      const salesIssuance = parseSalesIssuanceConfig(journal?.issuanceConfig);
      await assertJournalAccess(ctx.user, Number(salesIssuance.journalBookId));

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

      const ptCfg = journal?.paymentTypesConfig as PaymentTypesConfig | null | undefined;
      const hasFieldLinks = getConfiguredAccountLinks(ptCfg, invoice.paymentMethod)
        .some(l => l.accountId && l.postingName && l.postingSide);

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

      const { lines, isBalanced } = await buildSalesPostingLines(invoice, effectiveJournal, orgId);
      if (!isBalanced) throw new Error('لا يمكن ترحيل المستند: المدين لا يساوي الدائن في القيد المحاسبي');

      await validateAccounts(lines.map(l => l.accountId));

      return db.transaction(async (tx) => {
        const locked = await tx.execute(sql`
          SELECT id, is_posted AS "isPosted", status
          FROM sales_invoices
          WHERE id = ${input.invoiceId} AND org_id = ${orgId}
          FOR UPDATE
        `);
        const lockedRow = locked.rows[0] as { id: number; isPosted: boolean; status: string } | undefined;
        if (!lockedRow) throw new Error('الفاتورة غير موجودة');
        if (lockedRow.isPosted) throw new Error('الفاتورة مرحَّلة مسبقاً');
        if (lockedRow.status === 'draft') throw new Error('لا يمكن ترحيل مسودة قبل اعتمادها');

        const txInvoice = await tx.query.salesInvoices.findFirst({
          where: and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, orgId)),
        });
        if (!txInvoice) throw new Error('الفاتورة غير موجودة');
        const txItems = await tx.query.salesInvoiceItems.findMany({
          where: eq(salesInvoiceItems.invoiceId, txInvoice.id),
        });
        const salesTargetJournal = await tx.query.documentJournals.findFirst({
          where: and(
            eq(documentJournals.id, Number(salesIssuance.journalBookId)),
            eq(documentJournals.orgId, orgId),
            eq(documentJournals.isActive, true),
          ),
        });
        if (!salesTargetJournal || salesTargetJournal.docType !== salesIssuance.journalEntryType) {
          throw new Error('Target Journal لقيد المبيعات غير صالح أو لا يطابق نوع القيد المحدد');
        }

        // يدعم السجلات القديمة التي لم تُنشئ آثاراً معلّقة، ويعيد بناء
        // الآثار بأمان داخل نفس قفل الترحيل دون تكرار تغيير المخزون.
        await syncUnpostedSalesEffects(tx, txInvoice, txItems, orgId);

        const sourceDocType = txInvoice.invoiceType === 'credit_note'
          ? 'credit_note'
          : txInvoice.invoiceType === 'debit_note'
            ? 'debit_note'
            : txInvoice.invoiceType === 'return'
              ? 'sales_return'
              : 'sales_invoice';
        const entry = await insertJournalEntry({
          orgId,
          userId:          ctx.user.id,
          date:            txInvoice.invoiceDate,
          description:     `ترحيل ${txInvoice.invoiceType === 'debit_note' ? 'إشعار مدين' : 'مستند مبيعات'} ${txInvoice.invoiceNumber}`,
          reference:       txInvoice.invoiceNumber,
          sourceDocType:   invoice.invoiceType === 'debit_note'
            ? 'debit_note'
            : invoice.invoiceType === 'credit_note'
              ? 'credit_note'
              : invoice.invoiceType === 'return'
                ? 'sales_return'
                : 'sales_invoice',
          sourceDocId:     txInvoice.id,
          sourceDocNumber: txInvoice.invoiceNumber,
           journalId:       salesTargetJournal.id,
           generatedDocType: salesTargetJournal.docType,
          lines,
          tx,
        });

        const stock = await postSalesStockMovement(tx, txInvoice, orgId, ctx.user);
         const postingBatchId = randomUUID();
         const sourceDocumentType = sourceDocType;
         const relations = [
           {
             orgId,
             sourceDocumentType,
             sourceDocumentId: txInvoice.id,
             generatedDocumentType: 'journal_entry',
             generatedDocumentId: entry.id,
             relationType: 'sales_journal',
             postingBatchId,
           },
           ...(stock ? [{
             orgId,
             sourceDocumentType,
             sourceDocumentId: txInvoice.id,
             generatedDocumentType: 'stock_voucher',
             generatedDocumentId: stock.id,
             relationType: isSalesReturnType(txInvoice.invoiceType) ? 'stock_receipt' : 'stock_issue',
             postingBatchId,
           }, {
             orgId,
             sourceDocumentType: 'stock_voucher',
             sourceDocumentId: stock.id,
             generatedDocumentType: 'journal_entry',
             generatedDocumentId: stock.generatedJournalEntryId,
             relationType: 'cogs_journal',
             postingBatchId,
           }] : []),
         ];
         await tx.insert(documentRelations).values(relations);

        await tx.update(salesInvoices)
          .set({
            isPosted: true,
            postedAt: new Date(),
            postedJournalEntryId: entry.id,
            generatedStockVoucherId: stock?.id ?? null,
            generatedStockJournalEntryId: stock?.generatedJournalEntryId ?? null,
            updatedAt: new Date(),
          })
          .where(and(
            eq(salesInvoices.id, input.invoiceId),
            eq(salesInvoices.orgId, orgId),
            eq(salesInvoices.isPosted, false),
          ));

        await tx.update(pendingAccountMovements)
          .set({ status: 'linked', linkedJournalEntryId: entry.id, updatedAt: new Date() })
          .where(and(
            eq(pendingAccountMovements.orgId, orgId),
            eq(pendingAccountMovements.sourceDocId, txInvoice.id),
            eq(pendingAccountMovements.status, 'unposted'),
          ));

        return {
          success: true,
          journalEntryId: entry.id,
          entryNumber: entry.entryNumber,
          stockVoucherId: stock?.id ?? null,
          stockVoucherNumber: stock?.voucherNumber ?? null,
          stockJournalEntryId: stock?.generatedJournalEntryId ?? null,
           postingBatchId,
        };
      });
    }),

  unpostSalesInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number(), reason: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      await assertSalesPermission(ctx.user, 'unpost');
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
      await assertJournalAccess(ctx.user, invoice.journalId);
      await assertWarehouseAccess(ctx.user, invoice.warehouseId);

      return db.transaction(async (tx) => {
        const locked = await tx.execute(sql`
          SELECT id, invoice_number AS "invoiceNumber", invoice_type AS "invoiceType",
                 is_posted AS "isPosted", posted_journal_entry_id AS "postedJournalEntryId",
                 generated_stock_voucher_id AS "generatedStockVoucherId",
                 generated_stock_journal_entry_id AS "generatedStockJournalEntryId"
          FROM sales_invoices
          WHERE id = ${input.invoiceId} AND org_id = ${orgId}
          FOR UPDATE
        `);
        const row = locked.rows[0] as {
          id: number; invoiceNumber: string; invoiceType: string; isPosted: boolean;
          postedJournalEntryId: number | null; generatedStockVoucherId: number | null;
          generatedStockJournalEntryId: number | null;
        } | undefined;
        if (!row?.isPosted) throw new Error('الفاتورة ليست مرحَّلة');

        const relations = await tx.query.documentRelations.findMany({
          where: and(
            eq(documentRelations.orgId, orgId),
            eq(documentRelations.sourceDocumentId, row.id),
          ),
        });
        const entryIds = Array.from(new Set([
          row.postedJournalEntryId,
          row.generatedStockJournalEntryId,
          ...relations
            .filter(relation => relation.generatedDocumentType === 'journal_entry')
            .map(relation => relation.generatedDocumentId),
        ].filter((value): value is number => Number.isInteger(value))));
        const stockVoucherIds = Array.from(new Set([
          row.generatedStockVoucherId,
          ...relations
            .filter(relation => relation.generatedDocumentType === 'stock_voucher')
            .map(relation => relation.generatedDocumentId),
        ].filter((value): value is number => Number.isInteger(value))));
        const stockRelations = stockVoucherIds.length > 0
          ? await tx.query.documentRelations.findMany({
              where: and(
                eq(documentRelations.orgId, orgId),
                eq(documentRelations.sourceDocumentType, 'stock_voucher'),
                inArray(documentRelations.sourceDocumentId, stockVoucherIds),
              ),
            })
          : [];
        const allRelations = [...relations, ...stockRelations];
        const allEntryIds = Array.from(new Set([
          ...entryIds,
          ...allRelations
            .filter(relation => relation.generatedDocumentType === 'journal_entry')
            .map(relation => relation.generatedDocumentId),
        ].filter((value): value is number => Number.isInteger(value))));

        const deletedDocuments: Array<Record<string, unknown>> = [];
        for (const entryId of allEntryIds) {
          const entry = await tx.query.journalEntries.findFirst({
            where: and(eq(journalEntries.id, entryId), eq(journalEntries.orgId, orgId)),
          });
          if (!entry) continue;
          deletedDocuments.push({
            documentType: 'journal_entry',
            documentId: entry.id,
            documentNumber: entry.entryNumber,
            journalId: entry.journalId,
            generatedDocumentType: entry.generatedDocType,
          });
          if (!entry.journalId) continue;
          const newer = await tx.execute(sql`
            SELECT id
            FROM journal_entries
            WHERE org_id = ${orgId}
              AND journal_id = ${entry.journalId}
              AND status = 'posted'
              AND id > ${entry.id}
            LIMIT 1
          `);
          if (newer.rows.length > 0) {
            throw new Error('لا يمكن فك الترحيل: توجد قيود لاحقة في نفس دفتر الترحيل');
          }
        }

        for (const voucherId of stockVoucherIds) {
          const voucher = await tx.query.stockVouchers.findFirst({
            where: and(eq(stockVouchers.id, voucherId), eq(stockVouchers.orgId, orgId)),
          });
          if (voucher) {
            deletedDocuments.push({
              documentType: 'stock_voucher',
              documentId: voucher.id,
              documentNumber: voucher.voucherNumber,
              journalId: voucher.sourceJournalId,
              generatedDocumentType: voucher.type,
            });
          }
        }

        const deletedStock = await deleteSalesStockMovement(tx, invoice, orgId);
        for (const deleted of deletedStock?.deletedDocuments ?? []) {
          deletedDocuments.push(deleted as Record<string, unknown>);
        }
        const costEntryId = deletedStock?.costEntry?.id;
        const entryIdsToDelete = allEntryIds.filter(entryId => entryId !== costEntryId);
        if (entryIdsToDelete.length > 0) {
          await tx.delete(journalEntries)
            .where(and(
              eq(journalEntries.orgId, orgId),
              inArray(journalEntries.id, entryIdsToDelete),
            ));
        }
        const relationIds = allRelations.map(relation => relation.id);
        if (relationIds.length > 0) {
          await tx.delete(documentRelations)
            .where(and(
              eq(documentRelations.orgId, orgId),
              inArray(documentRelations.id, relationIds),
            ));
        }
        await tx.update(pendingAccountMovements)
          .set({ status: 'unposted', linkedJournalEntryId: null, linkedStockVoucherId: null, updatedAt: new Date() })
          .where(and(
            eq(pendingAccountMovements.orgId, orgId),
            eq(pendingAccountMovements.sourceDocId, invoice.id),
            eq(pendingAccountMovements.status, 'linked'),
          ));
        await tx.update(pendingStockMovements)
          .set({ status: 'unposted', linkedJournalEntryId: null, linkedStockVoucherId: null, updatedAt: new Date() })
          .where(and(
            eq(pendingStockMovements.orgId, orgId),
            eq(pendingStockMovements.sourceDocId, invoice.id),
            eq(pendingStockMovements.status, 'linked'),
          ));

        const postingBatchId = allRelations[0]?.postingBatchId ?? randomUUID();
        const auditSnapshot = Array.from(new Map(
          deletedDocuments.map((document) => [
            `${document.documentType}:${document.documentId}`,
            document,
          ]),
        ).values());
        await tx.insert(unpostAudit).values({
          orgId,
          postingBatchId,
          sourceDocumentType: allRelations[0]?.sourceDocumentType ?? row.invoiceType,
          sourceDocumentId: row.id,
          sourceDocumentNumber: row.invoiceNumber,
          userId: ctx.user.id,
          reason: input.reason ?? null,
          deletedDocuments: auditSnapshot,
        });

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

        return { success: true, postingBatchId, deletedDocuments: auditSnapshot };
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

        const accountLinkCondition = invoice.postedJournalEntryId != null
          ? eq(pendingAccountMovements.linkedJournalEntryId, invoice.postedJournalEntryId)
          : isNull(pendingAccountMovements.linkedJournalEntryId);
        await tx.update(pendingAccountMovements)
          .set({ status: 'unposted', linkedJournalEntryId: null, linkedStockVoucherId: null, updatedAt: new Date() })
          .where(and(
            eq(pendingAccountMovements.orgId, orgId),
            eq(pendingAccountMovements.sourceDocType, 'purchase_invoice'),
            eq(pendingAccountMovements.sourceDocId, invoice.id),
            accountLinkCondition,
          ));
        const stockLinkCondition = invoice.generatedStockJournalEntryId != null
          ? eq(pendingStockMovements.linkedJournalEntryId, invoice.generatedStockJournalEntryId)
          : isNull(pendingStockMovements.linkedJournalEntryId);
        await tx.update(pendingStockMovements)
          .set({ status: 'unposted', linkedJournalEntryId: null, linkedStockVoucherId: null, updatedAt: new Date() })
          .where(and(
            eq(pendingStockMovements.orgId, orgId),
            eq(pendingStockMovements.sourceDocType, 'purchase_invoice'),
            eq(pendingStockMovements.sourceDocId, invoice.id),
            stockLinkCondition,
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
