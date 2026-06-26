/**
 * PostingEngine — محرك الترحيل المحاسبي
 *
 * مسؤول عن:
 * - بناء أسطر القيد من الروابط المحاسبية (account links)
 * - حساب قيم الحقول بناءً على Field Code
 * - ترحيل المستندات وإلغاء الترحيل
 * - التوازن التلقائي للقيود
 *
 * القاعدة: أي منطق محاسبي جديد يُضاف هنا، ثم يُستدعى من posting.ts
 */

import { db } from '../db.js';
import { salesInvoices, documentJournals, journalEntries, journalEntryLines, chartOfAccounts } from '../schema.js';
import { eq, and } from 'drizzle-orm';

// ─── أنواع مشتركة ──────────────────────────────────────────────────────────────

export type PostingLine = {
  accountId:   number | null;
  accountCode: string;
  accountName: string;
  debit:       string;
  credit:      string;
  description: string;
};

export type PostingResult = {
  lines:        PostingLine[];
  warnings:     string[];
  totalDebit:   string;
  totalCredit:  string;
  isBalanced:   boolean;
};

export type AccountLinkConfig = {
  accountId:    number | null;
  postingName:  string;
  postingSide:  string;
  description:  string;
};

// ─── resolveFieldValue ─────────────────────────────────────────────────────────
/**
 * يُحسب قيمة حقل محدد بـ Field Code من بيانات الفاتورة.
 * أي Field Code جديد يُضاف هنا.
 *
 * @param fieldCode  كود الحقل من قاموس الحقول (مثال: CASH, TOTAL, BANK_TRANSFER)
 * @param invoice    بيانات الفاتورة كاملة
 */
export function resolveFieldValue(
  fieldCode: string,
  invoice: typeof salesInvoices.$inferSelect,
): number {
  const total      = Number(invoice.totalAmount  ?? 0);
  const subtotal   = Number(invoice.subtotal     ?? 0);
  const taxAmount  = Number(invoice.taxAmount    ?? 0);
  const discAmt    = Number(invoice.discountAmount ?? 0);
  const paidAmount = Number(invoice.paidAmount   ?? 0);
  const isCredit   = invoice.paymentStatus === 'credit';
  const breakdown  = invoice.paymentBreakdown as Record<string, number> | null | undefined;

  const fc = fieldCode.toUpperCase();

  // ── حقول الإجماليات ──────────────────────────────────────────────────────
  if (fc === 'TOTAL' || fc === 'INVOICE_TOTAL')         return total;
  if (fc === 'NETSALES' || fc === 'TOTAL_EXCLUSIVE_VAT') return subtotal;
  if (fc === 'TAX' || fc === 'TOTAL_VAT')               return taxAmount;
  if (fc === 'DISCOUNT' || fc === 'DISCOUNT_AMOUNT')    return discAmt;
  if (fc === 'PAID' || fc === 'PAYMENT_TOTAL')          return paidAmount;
  if (fc === 'REMAINING') return Math.max(0, total - paidAmount);

  // ── حقول الدفع (تقرأ من paymentBreakdown مباشرةً بـ fieldCode) ───────────
  if (breakdown) {
    const direct = breakdown[fc] ?? breakdown[fc.replace(/_AMOUNT$/, '')] ?? null;
    if (direct !== null) return Number(direct);
  }

  // ── CASH بدون breakdown = إجمالي الفاتورة (نقدي بالكامل) ─────────────────
  if (fc === 'CASH' && !breakdown) return isCredit ? 0 : total;

  // ── CUSTOMER_RECEIVABLE بدون breakdown = مبيعات آجلة ──────────────────────
  if ((fc === 'CUSTOMER_RECEIVABLE' || fc === 'CUSTOMER_CODE') && !breakdown)
    return isCredit ? total : 0;

  return 0;
}

// ─── buildLinesFromAccountLinks ────────────────────────────────────────────────
/**
 * يبني أسطر القيد المحاسبي من قائمة الروابط المحاسبية وبيانات الفاتورة.
 * تعتمد بالكامل على resolveFieldValue — لا hardcoded names.
 */
export async function buildLinesFromAccountLinks(
  accountLinks: AccountLinkConfig[],
  invoice: typeof salesInvoices.$inferSelect,
): Promise<PostingResult> {
  const accIds = accountLinks
    .map(l => l.accountId)
    .filter((id): id is number => typeof id === 'number' && id > 0);

  const accs = accIds.length
    ? await db.query.chartOfAccounts.findMany({
        where: (a, { inArray }) => inArray(a.id, accIds),
      })
    : [];
  const accMap = new Map(accs.map(a => [a.id, a]));

  const lines: PostingLine[] = [];
  const warnings: string[]   = [];

  for (const link of accountLinks) {
    if (!link.accountId || !link.postingName || !link.postingSide) continue;
    const value = resolveFieldValue(link.postingName, invoice);
    if (value === 0) continue;

    const acc     = accMap.get(link.accountId);
    const isDebit = link.postingSide === 'debit';
    const desc    = link.description
      ? `${link.description} - ${invoice.invoiceNumber}`
      : invoice.invoiceNumber;

    lines.push({
      accountId:   link.accountId,
      accountCode: acc?.code ?? '---',
      accountName: acc?.name ?? link.description ?? '',
      debit:  isDebit ? value.toFixed(4) : '0.0000',
      credit: isDebit ? '0.0000' : value.toFixed(4),
      description: desc,
    });
  }

  const totalDebit  = lines.reduce((s, l) => s + Number(l.debit),  0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);

  return {
    lines,
    warnings,
    totalDebit:  totalDebit.toFixed(4),
    totalCredit: totalCredit.toFixed(4),
    isBalanced:  Math.abs(totalDebit - totalCredit) < 0.01,
  };
}

// ─── getJournalForDoc ──────────────────────────────────────────────────────────
/**
 * يجلب دفتر المستند المرتبط بالفاتورة.
 */
export async function getJournalForDoc(
  journalId: number | null | undefined,
  orgId: number,
): Promise<typeof documentJournals.$inferSelect | null> {
  if (!journalId) return null;
  return db.query.documentJournals.findFirst({
    where: and(eq(documentJournals.id, journalId), eq(documentJournals.orgId, orgId)),
  }) ?? null;
}
