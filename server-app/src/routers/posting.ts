import { z } from 'zod';
import { eq, and, desc, inArray, gte, lte, isNull } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import {
  salesInvoices, purchaseInvoices, purchaseInvoiceItems,
  journalEntries, journalEntryLines,
  documentJournals, chartOfAccounts, documentTypes, warehouseAccountLinks,
} from '../schema.js';

// ─── مساعد: تحليل حسابات نوع المستند عبر warehouseAccountLinks ─────────────
async function resolveDocTypeAccounts(docTypeId: number, orgId: number) {
  const docType = await db.query.documentTypes.findFirst({
    where: and(eq(documentTypes.id, docTypeId), eq(documentTypes.orgId, orgId)),
  });
  if (!docType) return null;

  const rawIds = [
    docType.acctCash, docType.acctDebit, docType.acctCredit,
    docType.acctTax, docType.acctDiscount,
    docType.acctInventory, docType.acctCogs,
  ];
  const linkIds = rawIds.map(v => (v ? parseInt(v) : NaN)).filter(v => !isNaN(v));

  const walById = new Map<number, { accountId: number | null }>();
  if (linkIds.length > 0) {
    const walRows = await db.query.warehouseAccountLinks.findMany({
      where: inArray(warehouseAccountLinks.id, linkIds),
    });
    walRows.forEach(w => walById.set(w.id, w));
  }

  const getAccId = (code: string | null | undefined): number | null => {
    if (!code) return null;
    const id = parseInt(code);
    return isNaN(id) ? null : (walById.get(id)?.accountId ?? null);
  };

  return {
    docType,
    cashAccountId:      docType.cashAccountId     ?? getAccId(docType.acctCash)     ?? null,
    creditAccountId:    docType.creditAccountId   ?? getAccId(docType.acctDebit)    ?? null,
    salesAccountId:     docType.salesAccountId    ?? getAccId(docType.acctCredit)   ?? null,
    taxAccountId:       docType.taxAccountId      ?? getAccId(docType.acctTax)      ?? null,
    discountAccountId:  docType.discountAccountId ?? getAccId(docType.acctDiscount) ?? null,
    purchaseAccountId:  docType.purchaseAccountId ?? getAccId(docType.acctDebit)    ?? null,
    supplierAccountId:  docType.supplierAccountId ?? getAccId(docType.acctCredit)   ?? null,
    inventoryAccountId: getAccId(docType.acctInventory),
    cogsAccountId:      getAccId(docType.acctCogs),
  };
}

// ─── مساعد: التحقق من سلامة الحسابات ────────────────────────────────────────
async function validateAccounts(accountIds: (number | null)[]): Promise<void> {
  const ids = accountIds.filter((id): id is number => id !== null);
  if (!ids.length) return;
  const accs = await db.query.chartOfAccounts.findMany({
    where: inArray(chartOfAccounts.id, ids),
  });
  for (const acc of accs) {
    if (!acc.isActive)
      throw new Error(`الحساب "${acc.code} - ${acc.name}" موقوف ولا يمكن الترحيل عليه`);
    if (acc.isParent)
      throw new Error(`الحساب "${acc.code} - ${acc.name}" تجميعي ولا يمكن الترحيل عليه — يجب اختيار حساب فرعي`);
    if (acc.allowPosting === false)
      throw new Error(`الحساب "${acc.code} - ${acc.name}" لا يسمح بالترحيل`);
  }
}

// ─── مساعد: رقم قيد تسلسلي ──────────────────────────────────────────────────
async function nextEntryNumber(orgId: number): Promise<string> {
  const last = await db.query.journalEntries.findFirst({
    where: eq(journalEntries.orgId, orgId),
    orderBy: [desc(journalEntries.id)],
  });
  const n = last ? parseInt(last.entryNumber.replace(/\D/g, '') || '0') + 1 : 1;
  return `JE-${String(n).padStart(4, '0')}`;
}

// ─── مساعد: بناء أسطر قيد فاتورة المبيعات ──────────────────────────────────
export async function buildSalesInvoiceLines(
  invoice: typeof salesInvoices.$inferSelect,
  journal: typeof documentJournals.$inferSelect | null,
  orgId: number,
) {
  const accIds = [
    journal?.cashAccountId,
    journal?.creditAccountId,
    journal?.salesAccountId,
    journal?.taxAccountId,
    journal?.discountAccountId,
  ].filter(Boolean) as number[];

  const accs = accIds.length
    ? await db.query.chartOfAccounts.findMany({
        where: (a, { inArray }) => inArray(a.id, accIds),
      })
    : [];
  const accMap = new Map(accs.map(a => [a.id, a]));

  const total = Number(invoice.total ?? 0);
  const subtotal = Number(invoice.subtotal ?? 0);
  const taxAmount = Number(invoice.taxAmount ?? 0);
  const discountAmount = Number(invoice.discountAmount ?? 0);

  const isCredit = invoice.paymentMethod === 'credit';

  const lines: {
    accountId: number | null;
    accountCode: string;
    accountName: string;
    debit: string;
    credit: string;
    description: string;
  }[] = [];

  const warnings: string[] = [];

  const debitAccId = isCredit ? journal?.creditAccountId : journal?.cashAccountId;
  const debitAcc = debitAccId ? accMap.get(debitAccId) : null;
  const defaultDebitName = isCredit ? 'ذمم العملاء' : 'الصندوق / النقد';
  if (!debitAccId) warnings.push(isCredit ? 'حساب ذمم العملاء غير محدد في الدفتر' : 'حساب الصندوق غير محدد في الدفتر');
  lines.push({
    accountId: debitAccId ?? null,
    accountCode: debitAcc?.code ?? '---',
    accountName: debitAcc?.name ?? defaultDebitName,
    debit: total.toFixed(4),
    credit: '0.0000',
    description: `فاتورة مبيعات ${invoice.invoiceNumber}`,
  });

  const salesAccId = journal?.salesAccountId;
  const salesAcc = salesAccId ? accMap.get(salesAccId) : null;
  if (!salesAccId) warnings.push('حساب إيرادات المبيعات غير محدد في الدفتر');
  lines.push({
    accountId: salesAccId ?? null,
    accountCode: salesAcc?.code ?? '---',
    accountName: salesAcc?.name ?? 'إيرادات المبيعات',
    debit: '0.0000',
    credit: subtotal.toFixed(4),
    description: `مبيعات - ${invoice.invoiceNumber}`,
  });

  if (discountAmount > 0) {
    const discAccId = journal?.discountAccountId;
    const discAcc = discAccId ? accMap.get(discAccId) : null;
    if (!discAccId) warnings.push('حساب الخصم غير محدد في الدفتر');
    lines.push({
      accountId: discAccId ?? null,
      accountCode: discAcc?.code ?? '---',
      accountName: discAcc?.name ?? 'خصومات المبيعات',
      debit: discountAmount.toFixed(4),
      credit: '0.0000',
      description: `خصم - ${invoice.invoiceNumber}`,
    });
  }

  if (taxAmount > 0) {
    const taxAccId = journal?.taxAccountId;
    const taxAcc = taxAccId ? accMap.get(taxAccId) : null;
    if (!taxAccId) warnings.push('حساب الضريبة غير محدد في الدفتر');
    lines.push({
      accountId: taxAccId ?? null,
      accountCode: taxAcc?.code ?? '---',
      accountName: taxAcc?.name ?? 'ضريبة القيمة المضافة',
      debit: '0.0000',
      credit: taxAmount.toFixed(4),
      description: `ضريبة - ${invoice.invoiceNumber}`,
    });
  }

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

  return { lines, warnings, totalDebit: totalDebit.toFixed(4), totalCredit: totalCredit.toFixed(4), isBalanced };
}

// ─── مساعد: بناء أسطر قيد فاتورة المشتريات ─────────────────────────────────
export async function buildPurchaseInvoiceLines(
  invoice: typeof purchaseInvoices.$inferSelect,
  journal: { purchaseAccountId?: number | null; supplierAccountId?: number | null; cashAccountId?: number | null; taxAccountId?: number | null; discountAccountId?: number | null } | null,
  orgId: number,
) {
  const accIds = [
    journal?.purchaseAccountId,
    journal?.supplierAccountId,
    journal?.cashAccountId,
    journal?.taxAccountId,
    journal?.discountAccountId,
  ].filter(Boolean) as number[];

  const accs = accIds.length
    ? await db.query.chartOfAccounts.findMany({
        where: (a, { inArray }) => inArray(a.id, accIds),
      })
    : [];
  const accMap = new Map(accs.map(a => [a.id, a]));

  const total = Number(invoice.total ?? 0);
  const subtotal = Number(invoice.subtotal ?? 0);
  const taxAmount = Number(invoice.taxAmount ?? 0);
  const discountAmount = Number(invoice.discountAmount ?? 0);

  const isCredit = invoice.paymentMethod === 'credit';

  const lines: {
    accountId: number | null;
    accountCode: string;
    accountName: string;
    debit: string;
    credit: string;
    description: string;
  }[] = [];

  const warnings: string[] = [];

  // مدين: حساب المشتريات
  const purchaseAccId = journal?.purchaseAccountId ?? null;
  const purchaseAcc = purchaseAccId ? accMap.get(purchaseAccId) : null;
  if (!purchaseAccId) warnings.push('حساب المشتريات غير محدد في الدفتر');
  lines.push({
    accountId: purchaseAccId,
    accountCode: purchaseAcc?.code ?? '---',
    accountName: purchaseAcc?.name ?? 'المشتريات',
    debit: subtotal.toFixed(4),
    credit: '0.0000',
    description: `فاتورة مشتريات ${invoice.invoiceNumber}`,
  });

  // مدين: ضريبة المشتريات (إن وجدت)
  if (taxAmount > 0) {
    const taxAccId = journal?.taxAccountId ?? null;
    const taxAcc = taxAccId ? accMap.get(taxAccId) : null;
    if (!taxAccId) warnings.push('حساب ضريبة المشتريات غير محدد في الدفتر');
    lines.push({
      accountId: taxAccId,
      accountCode: taxAcc?.code ?? '---',
      accountName: taxAcc?.name ?? 'ضريبة القيمة المضافة',
      debit: taxAmount.toFixed(4),
      credit: '0.0000',
      description: `ضريبة مشتريات - ${invoice.invoiceNumber}`,
    });
  }

  // دائن: خصم المشتريات (إن وجد)
  if (discountAmount > 0) {
    const discAccId = journal?.discountAccountId ?? null;
    const discAcc = discAccId ? accMap.get(discAccId) : null;
    if (!discAccId) warnings.push('حساب خصم المشتريات غير محدد في الدفتر');
    lines.push({
      accountId: discAccId,
      accountCode: discAcc?.code ?? '---',
      accountName: discAcc?.name ?? 'خصومات المشتريات',
      debit: '0.0000',
      credit: discountAmount.toFixed(4),
      description: `خصم مشتريات - ${invoice.invoiceNumber}`,
    });
  }

  // دائن: المورد (آجل) أو الصندوق (نقدي)
  const creditAccId = isCredit
    ? (journal?.supplierAccountId ?? null)
    : (journal?.cashAccountId ?? null);
  const creditAcc = creditAccId ? accMap.get(creditAccId) : null;
  const defaultCreditName = isCredit ? 'ذمم الموردين' : 'الصندوق / النقد';
  if (!creditAccId) warnings.push(isCredit ? 'حساب ذمم الموردين غير محدد في الدفتر' : 'حساب الصندوق غير محدد في الدفتر');
  lines.push({
    accountId: creditAccId,
    accountCode: creditAcc?.code ?? '---',
    accountName: creditAcc?.name ?? defaultCreditName,
    debit: '0.0000',
    credit: total.toFixed(4),
    description: isCredit ? `مورد - ${invoice.supplierName ?? ''}` : `سداد نقدي - ${invoice.invoiceNumber}`,
  });

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

  return { lines, warnings, totalDebit: totalDebit.toFixed(4), totalCredit: totalCredit.toFixed(4), isBalanced };
}

// ─── مساعد: تنفيذ قيد وإدراجه في جدولي journalEntries + journalEntryLines ──
async function insertJournalEntry(opts: {
  orgId: number;
  userId: number;
  date: Date;
  description: string;
  reference: string;
  sourceDocType: string;
  sourceDocId: number;
  sourceDocNumber: string;
  lines: { accountId: number | null; accountCode: string; accountName: string; debit: string; credit: string; description: string }[];
}) {
  const entryNumber = await nextEntryNumber(opts.orgId);
  const totalDebit = opts.lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = opts.lines.reduce((s, l) => s + Number(l.credit), 0);

  const [entry] = await db.insert(journalEntries).values({
    orgId: opts.orgId,
    entryNumber,
    entryDate: opts.date,
    description: opts.description,
    reference: opts.reference,
    totalDebit: totalDebit.toFixed(4),
    totalCredit: totalCredit.toFixed(4),
    status: 'posted',
    userId: opts.userId,
    sourceDocType: opts.sourceDocType,
    sourceDocId: opts.sourceDocId,
    sourceDocNumber: opts.sourceDocNumber,
    entryType: 'auto',
  }).returning();

  if (opts.lines.length > 0) {
    await db.insert(journalEntryLines).values(
      opts.lines.map((l, i) => ({
        entryId: entry.id,
        orgId: opts.orgId,
        accountId: l.accountId ?? undefined,
        accountCode: l.accountCode,
        accountName: l.accountName,
        description: l.description,
        debit: l.debit,
        credit: l.credit,
        sortOrder: i,
      }))
    );
  }
  return entry;
}

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
        : null;

      const effectiveJournal = {
        ...(journal ?? {}),
        cashAccountId:    docTypeAccs?.cashAccountId    ?? journal?.cashAccountId    ?? null,
        salesAccountId:   docTypeAccs?.salesAccountId   ?? journal?.salesAccountId   ?? null,
        creditAccountId:  docTypeAccs?.creditAccountId  ?? journal?.creditAccountId  ?? null,
        taxAccountId:     docTypeAccs?.taxAccountId     ?? journal?.taxAccountId     ?? null,
        discountAccountId:docTypeAccs?.discountAccountId?? journal?.discountAccountId?? null,
        postingMode:      journal?.postingMode ?? 'manual',
      } as typeof documentJournals.$inferSelect;

      const { lines, warnings, totalDebit, totalCredit, isBalanced } = await buildSalesInvoiceLines(invoice, effectiveJournal, orgId);

      return {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        customerName: invoice.customerName,
        total: invoice.total,
        paymentMethod: invoice.paymentMethod,
        journalName: journal?.name ?? docTypeAccs?.docType?.nameAr ?? null,
        lines,
        warnings,
        totalDebit,
        totalCredit,
        isBalanced,
        canPost: !invoice.isPosted,
        isPosted: invoice.isPosted,
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
        : null;

      const effectiveJournal = {
        ...(journal ?? {}),
        cashAccountId:    docTypeAccs?.cashAccountId    ?? journal?.cashAccountId    ?? null,
        salesAccountId:   docTypeAccs?.salesAccountId   ?? journal?.salesAccountId   ?? null,
        creditAccountId:  docTypeAccs?.creditAccountId  ?? journal?.creditAccountId  ?? null,
        taxAccountId:     docTypeAccs?.taxAccountId     ?? journal?.taxAccountId     ?? null,
        discountAccountId:docTypeAccs?.discountAccountId?? journal?.discountAccountId?? null,
        postingMode:      journal?.postingMode ?? 'manual',
      } as typeof documentJournals.$inferSelect;

      const isCredit = invoice.paymentMethod === 'credit';
      const missingAccounts: string[] = [];
      if (!effectiveJournal.salesAccountId) missingAccounts.push('حساب المبيعات/الإيرادات');
      if (isCredit && !effectiveJournal.creditAccountId) missingAccounts.push('حساب ذمم العملاء (آجل)');
      if (!isCredit && !effectiveJournal.cashAccountId) missingAccounts.push('حساب الصندوق/النقد');
      if (missingAccounts.length > 0)
        throw new Error(
          `لا يمكن ترحيل المستند لعدم اكتمال الروابط المحاسبية\nالحسابات الناقصة: ${missingAccounts.join('، ')}`
        );

      const { lines, isBalanced } = await buildSalesInvoiceLines(invoice, effectiveJournal, orgId);
      if (!isBalanced) throw new Error('لا يمكن ترحيل المستند: المدين لا يساوي الدائن في القيد المحاسبي');

      await validateAccounts(lines.map(l => l.accountId));

      const entry = await insertJournalEntry({
        orgId,
        userId: ctx.user.id,
        date: invoice.invoiceDate,
        description: `ترحيل فاتورة مبيعات ${invoice.invoiceNumber}`,
        reference: invoice.invoiceNumber,
        sourceDocType: 'sales_invoice',
        sourceDocId: invoice.id,
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
        : null;

      const effectiveJournal = {
        purchaseAccountId: docTypeAccs?.purchaseAccountId ?? journal?.purchaseAccountId ?? null,
        supplierAccountId: docTypeAccs?.supplierAccountId ?? journal?.supplierAccountId ?? null,
        cashAccountId:     docTypeAccs?.cashAccountId     ?? journal?.cashAccountId     ?? null,
        taxAccountId:      docTypeAccs?.taxAccountId      ?? journal?.taxAccountId      ?? null,
        discountAccountId: docTypeAccs?.discountAccountId ?? journal?.discountAccountId ?? null,
      };

      const { lines, warnings, totalDebit, totalCredit, isBalanced } = await buildPurchaseInvoiceLines(invoice, effectiveJournal, orgId);

      return {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        supplierName: invoice.supplierName,
        total: invoice.total,
        paymentMethod: invoice.paymentMethod,
        journalName: journal?.name ?? docTypeAccs?.docType?.nameAr ?? null,
        lines,
        warnings,
        totalDebit,
        totalCredit,
        isBalanced,
        canPost: !invoice.isPosted,
        isPosted: invoice.isPosted,
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
      if (isCredit && !effectiveJournal.supplierAccountId) missingAccounts.push('حساب ذمم الموردين (آجل)');
      if (!isCredit && !effectiveJournal.cashAccountId) missingAccounts.push('حساب الصندوق/النقد');
      if (missingAccounts.length > 0)
        throw new Error(
          `لا يمكن ترحيل المستند لعدم اكتمال الروابط المحاسبية\nالحسابات الناقصة: ${missingAccounts.join('، ')}`
        );

      const { lines, isBalanced } = await buildPurchaseInvoiceLines(invoice, effectiveJournal, orgId);
      if (!isBalanced) throw new Error('لا يمكن ترحيل المستند: المدين لا يساوي الدائن في القيد المحاسبي');

      await validateAccounts(lines.map(l => l.accountId));

      const entry = await insertJournalEntry({
        orgId,
        userId: ctx.user.id,
        date: invoice.invoiceDate,
        description: `ترحيل فاتورة مشتريات ${invoice.invoiceNumber}`,
        reference: invoice.invoiceNumber,
        sourceDocType: 'purchase_invoice',
        sourceDocId: invoice.id,
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
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      warehouseId: z.number().optional(),
      journalId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const conds = [
        eq(purchaseInvoices.orgId, orgId),
        eq(purchaseInvoices.isPosted, true),
        eq(purchaseInvoices.inventoryPosted, false),
      ];
      if (input.fromDate) conds.push(gte(purchaseInvoices.invoiceDate, new Date(input.fromDate)));
      if (input.toDate) conds.push(lte(purchaseInvoices.invoiceDate, new Date(input.toDate)));
      if (input.warehouseId) conds.push(eq(purchaseInvoices.warehouseId, input.warehouseId));
      if (input.journalId) conds.push(eq(purchaseInvoices.journalId, input.journalId));

      const invoices = await db.query.purchaseInvoices.findMany({ where: and(...conds) });
      const totalAmount = invoices.reduce((s, inv) => s + Number(inv.subtotal ?? 0), 0);
      return {
        count: invoices.length,
        totalAmount: totalAmount.toFixed(4),
        invoices: invoices.map(inv => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          supplierName: inv.supplierName,
          invoiceDate: inv.invoiceDate,
          subtotal: inv.subtotal,
        })),
      };
    }),

  postPurchasesToInventory: protectedProcedure
    .input(z.object({
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      warehouseId: z.number().optional(),
      journalId: z.number().optional(),
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
      if (input.fromDate) conds.push(gte(purchaseInvoices.invoiceDate, new Date(input.fromDate)));
      if (input.toDate) conds.push(lte(purchaseInvoices.invoiceDate, new Date(input.toDate)));
      if (input.warehouseId) conds.push(eq(purchaseInvoices.warehouseId, input.warehouseId));
      if (input.journalId) conds.push(eq(purchaseInvoices.journalId, input.journalId));

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
          accountId: input.inventoryAccountId,
          accountCode: invAcc?.code ?? '---',
          accountName: invAcc?.name ?? 'المخزون',
          debit: totalAmount.toFixed(4),
          credit: '0.0000',
          description: `ترحيل المشتريات للمخزون — ${invoices.length} فاتورة`,
        },
        {
          accountId: input.purchasesAccountId,
          accountCode: purAcc?.code ?? '---',
          accountName: purAcc?.name ?? 'المشتريات',
          debit: '0.0000',
          credit: totalAmount.toFixed(4),
          description: `تصفير حساب المشتريات — ${invoices.length} فاتورة`,
        },
      ];

      const entry = await insertJournalEntry({
        orgId,
        userId: ctx.user.id,
        date: new Date(),
        description: `ترحيل المشتريات للمخزون — ${invoices.length} فاتورة — إجمالي ${totalAmount.toFixed(2)}`,
        reference: `INV-XFER-${Date.now()}`,
        sourceDocType: 'purchase_to_inventory',
        sourceDocId: 0,
        sourceDocNumber: `PURCH-INV-${new Date().toISOString().slice(0, 10)}`,
        lines,
      });

      // تحديث الفواتير — inventoryPosted = true
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
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      warehouseId: z.number().optional(),
      journalId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const conds = [
        eq(salesInvoices.orgId, orgId),
        eq(salesInvoices.isPosted, true),
        eq(salesInvoices.costPosted, false),
      ];
      if (input.fromDate) conds.push(gte(salesInvoices.invoiceDate, new Date(input.fromDate)));
      if (input.toDate) conds.push(lte(salesInvoices.invoiceDate, new Date(input.toDate)));
      if (input.journalId) conds.push(eq(salesInvoices.journalId, input.journalId));

      const invoices = await db.query.salesInvoices.findMany({ where: and(...conds) });
      const totalCost = invoices.reduce((s, inv) => s + Number(inv.subtotal ?? 0), 0);
      return {
        count: invoices.length,
        totalCost: totalCost.toFixed(4),
        invoices: invoices.map(inv => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customerName,
          invoiceDate: inv.invoiceDate,
          subtotal: inv.subtotal,
        })),
      };
    }),

  postSalesCOGS: protectedProcedure
    .input(z.object({
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      warehouseId: z.number().optional(),
      journalId: z.number().optional(),
      cogsAccountId: z.number(),
      inventoryAccountId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const conds = [
        eq(salesInvoices.orgId, orgId),
        eq(salesInvoices.isPosted, true),
        eq(salesInvoices.costPosted, false),
      ];
      if (input.fromDate) conds.push(gte(salesInvoices.invoiceDate, new Date(input.fromDate)));
      if (input.toDate) conds.push(lte(salesInvoices.invoiceDate, new Date(input.toDate)));
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
          accountId: input.cogsAccountId,
          accountCode: cogsAcc?.code ?? '---',
          accountName: cogsAcc?.name ?? 'تكلفة المبيعات',
          debit: totalCost.toFixed(4),
          credit: '0.0000',
          description: `تكلفة المبيعات — ${invoices.length} فاتورة`,
        },
        {
          accountId: input.inventoryAccountId,
          accountCode: invAcc?.code ?? '---',
          accountName: invAcc?.name ?? 'المخزون',
          debit: '0.0000',
          credit: totalCost.toFixed(4),
          description: `تخفيض المخزون — بتكلفة المبيعات — ${invoices.length} فاتورة`,
        },
      ];

      const entry = await insertJournalEntry({
        orgId,
        userId: ctx.user.id,
        date: new Date(),
        description: `ترحيل تكلفة المبيعات — ${invoices.length} فاتورة — إجمالي ${totalCost.toFixed(2)}`,
        reference: `COGS-${Date.now()}`,
        sourceDocType: 'sales_cogs',
        sourceDocId: 0,
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
      id: j.id,
      name: j.name,
      code: j.code,
      docType: j.docType,
      postingMode: j.postingMode ?? 'manual',
      allowUnpost: j.allowUnpost ?? true,
      allowEditAfterPost: j.allowEditAfterPost ?? false,
    }));
  }),

  updateJournalSettings: protectedProcedure
    .input(z.object({
      journalId: z.number(),
      postingMode: z.enum(['auto', 'manual', 'disabled']),
      allowUnpost: z.boolean(),
      allowEditAfterPost: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.update(documentJournals)
        .set({
          postingMode: input.postingMode,
          allowUnpost: input.allowUnpost,
          allowEditAfterPost: input.allowEditAfterPost,
          updatedAt: new Date(),
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
