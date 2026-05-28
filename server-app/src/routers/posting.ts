import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import {
  salesInvoices, journalEntries, journalEntryLines,
  documentJournals, chartOfAccounts,
} from '../schema.js';

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
  const isCash = invoice.paymentMethod === 'cash';

  const lines: {
    accountId: number | null;
    accountCode: string;
    accountName: string;
    debit: string;
    credit: string;
    description: string;
  }[] = [];

  const warnings: string[] = [];

  // مدين: الصندوق أو ذمم العملاء
  const debitAccId = isCash ? journal?.cashAccountId : journal?.creditAccountId;
  const debitAcc = debitAccId ? accMap.get(debitAccId) : null;
  if (!debitAccId) warnings.push(isCash ? 'حساب الصندوق غير محدد في الدفتر' : 'حساب ذمم العملاء غير محدد في الدفتر');
  lines.push({
    accountId: debitAccId ?? null,
    accountCode: debitAcc?.code ?? '---',
    accountName: debitAcc?.name ?? (isCash ? 'الصندوق / النقد' : 'ذمم العملاء'),
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

      const { lines, warnings, totalDebit, totalCredit, isBalanced } = await buildSalesInvoiceLines(invoice, journal ?? null, orgId);

      return {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        customerName: invoice.customerName,
        total: invoice.total,
        paymentMethod: invoice.paymentMethod,
        journalName: journal?.name ?? null,
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

      const { lines, isBalanced } = await buildSalesInvoiceLines(invoice, journal ?? null, orgId);

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
