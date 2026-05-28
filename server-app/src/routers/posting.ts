import { z } from 'zod';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import {
  salesInvoices, journalEntries, journalEntryLines,
  documentJournals, chartOfAccounts, documentTypes, warehouseAccountLinks,
} from '../schema.js';

// مساعد: تحليل حسابات نوع المستند عبر warehouseAccountLinks
async function resolveDocTypeAccounts(docTypeId: number, orgId: number) {
  const docType = await db.query.documentTypes.findFirst({
    where: and(eq(documentTypes.id, docTypeId), eq(documentTypes.orgId, orgId)),
  });
  if (!docType) return null;

  const rawIds = [docType.acctCash, docType.acctDebit, docType.acctCredit, docType.acctTax, docType.acctDiscount];
  const linkIds = rawIds.map(v => (v ? parseInt(v) : NaN)).filter(v => !isNaN(v));
  if (!linkIds.length) return { docType, cashAccountId: null, creditAccountId: null, salesAccountId: null, taxAccountId: null, discountAccountId: null };

  const walRows = await db.query.warehouseAccountLinks.findMany({
    where: inArray(warehouseAccountLinks.id, linkIds),
  });
  const walById = new Map(walRows.map(w => [w.id, w]));
  const getAccId = (code: string | null | undefined): number | null => {
    if (!code) return null;
    const id = parseInt(code);
    return isNaN(id) ? null : (walById.get(id)?.accountId ?? null);
  };

  return {
    docType,
    cashAccountId:    getAccId(docType.acctCash),
    creditAccountId:  getAccId(docType.acctDebit),    // مدين آجل = ذمم عملاء
    salesAccountId:   getAccId(docType.acctCredit),   // دائن = إيرادات
    taxAccountId:     getAccId(docType.acctTax),
    discountAccountId:getAccId(docType.acctDiscount),
  };
}

// ── مساعد: بناء أسطر القيد من فاتورة مبيعات ─────────────────────────────────
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

  // تحديد حساب المدين حسب طريقة الدفع
  // - آجل (credit) → ذمم العملاء (creditAccountId)
  // - نقدي / بنك / شيك / أخرى → الصندوق أو البنك (cashAccountId)
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

  // مدين: الصندوق/البنك أو ذمم العملاء حسب طريقة الدفع
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

  // دائن: إيرادات المبيعات
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

  // مدين: الخصم المعطى (إن وجد)
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

  // دائن: ضريبة القيمة المضافة (إن وجدت)
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

// ── Router ───────────────────────────────────────────────────────────────────
export const postingRouter = router({

  // ── معاينة القيد قبل الترحيل ─────────────────────────────────────────────
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
        cashAccountId:    journal?.cashAccountId    ?? docTypeAccs?.cashAccountId    ?? null,
        salesAccountId:   journal?.salesAccountId   ?? docTypeAccs?.salesAccountId   ?? null,
        creditAccountId:  journal?.creditAccountId  ?? docTypeAccs?.creditAccountId  ?? null,
        taxAccountId:     journal?.taxAccountId     ?? docTypeAccs?.taxAccountId     ?? null,
        discountAccountId:journal?.discountAccountId?? docTypeAccs?.discountAccountId?? null,
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

  // ── ترحيل فاتورة مبيعات ─────────────────────────────────────────────────
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

      // تحقق من أن الترحيل غير محظور
      if (journal?.postingMode === 'disabled') {
        throw new Error('الترحيل معطَّل لهذا الدفتر');
      }

      // دمج حسابات الدفتر + حسابات نوع المستند (نوع المستند كـ fallback)
      const docTypeAccs = invoice.docTypeId
        ? await resolveDocTypeAccounts(invoice.docTypeId, orgId)
        : null;

      const effectiveJournal = {
        ...(journal ?? {}),
        cashAccountId:    journal?.cashAccountId    ?? docTypeAccs?.cashAccountId    ?? null,
        salesAccountId:   journal?.salesAccountId   ?? docTypeAccs?.salesAccountId   ?? null,
        creditAccountId:  journal?.creditAccountId  ?? docTypeAccs?.creditAccountId  ?? null,
        taxAccountId:     journal?.taxAccountId     ?? docTypeAccs?.taxAccountId     ?? null,
        discountAccountId:journal?.discountAccountId?? docTypeAccs?.discountAccountId?? null,
        postingMode:      journal?.postingMode ?? 'manual',
      } as typeof documentJournals.$inferSelect;

      const { lines, isBalanced } = await buildSalesInvoiceLines(invoice, effectiveJournal, orgId);

      // رقم القيد التالي
      const lastEntry = await db.query.journalEntries.findFirst({
        where: eq(journalEntries.orgId, orgId),
        orderBy: [desc(journalEntries.id)],
      });
      const nextNum = lastEntry
        ? parseInt(lastEntry.entryNumber.replace(/\D/g, '') || '0') + 1
        : 1;
      const entryNumber = `JE-${String(nextNum).padStart(4, '0')}`;

      const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);

      // إنشاء القيد المحاسبي
      const [entry] = await db.insert(journalEntries).values({
        orgId,
        entryNumber,
        entryDate: invoice.invoiceDate,
        description: `ترحيل فاتورة مبيعات ${invoice.invoiceNumber}`,
        reference: invoice.invoiceNumber,
        totalDebit: totalDebit.toFixed(4),
        totalCredit: totalCredit.toFixed(4),
        status: 'posted',
        userId: ctx.user.id,
        sourceDocType: 'sales_invoice',
        sourceDocId: invoice.id,
        sourceDocNumber: invoice.invoiceNumber,
        entryType: 'auto',
      }).returning();

      // أسطر القيد
      if (lines.length > 0) {
        await db.insert(journalEntryLines).values(
          lines.map((l, i) => ({
            entryId: entry.id,
            orgId,
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

      // تحديث الفاتورة — isPosted = true
      await db.update(salesInvoices)
        .set({
          isPosted: true,
          postedAt: new Date(),
          postedJournalEntryId: entry.id,
          updatedAt: new Date(),
        })
        .where(and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, orgId)));

      return { success: true, journalEntryId: entry.id, entryNumber };
    }),

  // ── إلغاء ترحيل فاتورة مبيعات ────────────────────────────────────────────
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

      if (journal && !journal.allowUnpost) {
        throw new Error('إلغاء الترحيل غير مسموح به في هذا الدفتر');
      }

      // حذف القيد المحاسبي المرتبط
      if (invoice.postedJournalEntryId) {
        await db.delete(journalEntryLines)
          .where(eq(journalEntryLines.entryId, invoice.postedJournalEntryId));
        await db.delete(journalEntries)
          .where(and(
            eq(journalEntries.id, invoice.postedJournalEntryId),
            eq(journalEntries.orgId, orgId)
          ));
      }

      // إعادة الفاتورة إلى غير مرحَّل
      await db.update(salesInvoices)
        .set({ isPosted: false, postedAt: null, postedJournalEntryId: null, updatedAt: new Date() })
        .where(and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, orgId)));

      return { success: true };
    }),

  // ── جلب إعدادات الترحيل لجميع الدفاتر ──────────────────────────────────
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

  // ── تحديث إعدادات الترحيل لدفتر ─────────────────────────────────────────
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
        .where(and(
          eq(documentJournals.id, input.journalId),
          eq(documentJournals.orgId, ctx.user.orgId)
        ));
      return { success: true };
    }),

  // ── جلب فاتورة بالـ ID (للقراءة بعد الحفظ) ──────────────────────────────
  getSalesInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.query.salesInvoices.findFirst({
        where: and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, ctx.user.orgId)),
      });
    }),
});
