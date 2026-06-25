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
export async function resolveDocTypeAccountsByJournal(journalId: number, orgId: number) {
  const docType = await db.query.documentTypes.findFirst({
    where: and(eq(documentTypes.journal, String(journalId)), eq(documentTypes.orgId, orgId)),
  });
  if (!docType) return null;
  return resolveDocTypeAccounts(docType.id, orgId);
}

export async function resolveDocTypeAccounts(docTypeId: number, orgId: number) {
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

// ─── مساعد: تحليل قيمة حقل موحّد من فاتورة مبيعات ─────────────────────────
function resolveInvoiceFieldValue(
  fieldCode: string,
  invoice: typeof salesInvoices.$inferSelect,
): number {
  const total      = Number(invoice.total          ?? 0);
  const subtotal   = Number(invoice.subtotal       ?? 0);
  const taxAmount  = Number(invoice.taxAmount      ?? 0);
  const discAmt    = Number(invoice.discountAmount ?? 0);
  const paidAmount = Number(invoice.paidAmount     ?? 0);
  const isCredit   = invoice.paymentMethod === 'credit';

  const breakdown = invoice.paymentBreakdown as Record<string, number> | null | undefined;

  switch (fieldCode.toUpperCase()) {
    case 'TOTAL':         return total;
    case 'NETSALES':
    case 'TOTAL_EXCLUSIVE_VAT': return subtotal;
    case 'TAX':
    case 'TOTAL_VAT':     return taxAmount;
    case 'DISCOUNT':
    case 'DISCOUNT_AMOUNT': return discAmt;
    // نقدي: إذا وُجد تفصيل سداد يُعاد مبلغ الكاش فقط، وإلا الإجمالي
    case 'CASH':          return breakdown
                            ? Number(breakdown.CASH ?? breakdown.CASH_AMOUNT ?? 0)
                            : (isCredit ? 0 : total);
    case 'CUSTOMER_CODE':
    case 'CUSTOMER_RECEIVABLE': return Number(breakdown?.ACCOUNT ?? breakdown?.ACCOUNT_AMOUNT ?? (isCredit ? total : 0));
    case 'PAID':
    case 'PAYMENT_TOTAL': return paidAmount;
    case 'REMAINING':     return Math.max(0, total - paidAmount);
    // وسائل الدفع من تفصيل السداد
    case 'CASH_AMOUNT':    return Number(breakdown?.CASH    ?? breakdown?.CASH_AMOUNT    ?? 0);
    case 'CARD_AMOUNT':
    case 'VISA':           return Number(breakdown?.CARD    ?? breakdown?.VISA    ?? breakdown?.CARD_AMOUNT ?? 0);
    case 'BANK_AMOUNT':    return Number(breakdown?.BANK    ?? breakdown?.BANK_AMOUNT    ?? 0);
    case 'ACCOUNT_AMOUNT':
    case 'ACCOUNT':        return Number(breakdown?.ACCOUNT ?? breakdown?.ACCOUNT_AMOUNT ?? 0);
    case 'TAMARA':
    case 'TAMARA_AMOUNT':  return Number(breakdown?.TAMARA  ?? breakdown?.TAMARA_AMOUNT  ?? 0);
    case 'TABBY':
    case 'TABBY_AMOUNT':   return Number(breakdown?.TABBY   ?? breakdown?.TABBY_AMOUNT   ?? 0);
    case 'OTHER_AMOUNT':   return Number(breakdown?.OTHER   ?? breakdown?.OTHER_AMOUNT   ?? 0);
    default: {
      // ── بحث ديناميكي في تفصيل السداد لأي كود وسيلة دفع مخصصة ─────────
      if (breakdown) {
        const code = fieldCode.toUpperCase();
        const direct = breakdown[code] ?? breakdown[code.replace(/_AMOUNT$/, '')] ?? null;
        if (direct !== null) return Number(direct);
      }
      return 0;
    }
  }
}

// ─── مساعد: بناء أسطر القيد من الروابط المحاسبية المُضبَّطة في الدفتر ──────
type AccountLinkCfg = {
  accountId: number | null;
  postingName: string;
  postingSide: string;
  description: string;
};

async function buildLinesFromAccountLinks(
  accountLinks: AccountLinkCfg[],
  invoice: typeof salesInvoices.$inferSelect,
  orgId: number,
): Promise<{
  lines: { accountId: number | null; accountCode: string; accountName: string; debit: string; credit: string; description: string }[];
  warnings: string[];
  totalDebit: string;
  totalCredit: string;
  isBalanced: boolean;
}> {
  const accIds = accountLinks
    .map(l => l.accountId)
    .filter((id): id is number => typeof id === 'number' && id > 0);

  const accs = accIds.length
    ? await db.query.chartOfAccounts.findMany({
        where: (a, { inArray }) => inArray(a.id, accIds),
      })
    : [];
  const accMap = new Map(accs.map(a => [a.id, a]));

  const lines: { accountId: number | null; accountCode: string; accountName: string; debit: string; credit: string; description: string }[] = [];
  const warnings: string[] = [];

  for (const link of accountLinks) {
    if (!link.accountId || !link.postingName || !link.postingSide) continue;
    const value = resolveInvoiceFieldValue(link.postingName, invoice);
    if (value === 0) continue;

    const acc    = accMap.get(link.accountId);
    const isDebit = link.postingSide === 'debit';
    const lineDesc = link.description
      ? `${link.description} - ${invoice.invoiceNumber}`
      : invoice.invoiceNumber;

    lines.push({
      accountId:   link.accountId,
      accountCode: acc?.code ?? '---',
      accountName: acc?.name ?? link.description ?? '',
      debit:  isDebit ? value.toFixed(4) : '0.0000',
      credit: isDebit ? '0.0000' : value.toFixed(4),
      description: lineDesc,
    });
  }

  const totalDebit  = lines.reduce((s, l) => s + Number(l.debit),  0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;

  return {
    lines,
    warnings,
    totalDebit:  totalDebit.toFixed(4),
    totalCredit: totalCredit.toFixed(4),
    isBalanced,
  };
}

// ─── مساعد: بناء أسطر قيد فاتورة المبيعات ──────────────────────────────────
export async function buildSalesInvoiceLines(
  invoice: typeof salesInvoices.$inferSelect,
  journal: typeof documentJournals.$inferSelect | null,
  orgId: number,
) {
  // ── استخدام الروابط المحاسبية المُضبَّطة في الدفتر إن وُجدت ──────────────
  const ptCfg = journal?.paymentTypesConfig as { accountLinks?: AccountLinkCfg[] } | null | undefined;
  const configLinks: AccountLinkCfg[] = Array.isArray(ptCfg?.accountLinks) ? (ptCfg!.accountLinks as AccountLinkCfg[]) : [];
  const hasConfiguredLinks = configLinks.some(l => l.accountId && l.postingName && l.postingSide);

  if (hasConfiguredLinks) {
    const result = await buildLinesFromAccountLinks(configLinks, invoice, orgId);

    // ── توازن تلقائي: إذا كانت جهة الدائن > المدين، يعني هناك مدفوعات بلا حساب مُضبَّط ──
    if (!result.isBalanced) {
      const debit  = Number(result.totalDebit);
      const credit = Number(result.totalCredit);
      const shortfall = credit - debit;

      if (shortfall > 0.001) {
        // نحسب مجموع كل وسائل الدفع من تفصيل السداد
        const breakdown = invoice.paymentBreakdown as Record<string, number> | null | undefined;
        const paymentFieldCodes: Record<string, string[]> = {
          CASH:    ['CASH',    'CASH_AMOUNT'],
          CARD:    ['CARD',    'CARD_AMOUNT', 'VISA'],
          BANK:    ['BANK',    'BANK_AMOUNT'],
          ACCOUNT: ['ACCOUNT', 'ACCOUNT_AMOUNT', 'CUSTOMER_RECEIVABLE'],
          TAMARA:  ['TAMARA',  'TAMARA_AMOUNT'],
          TABBY:   ['TABBY',   'TABBY_AMOUNT'],
          OTHER:   ['OTHER',   'OTHER_AMOUNT'],
        };

        // نكتشف وسائل الدفع التي لها مبلغ في التفصيل لكن لا يوجد رابط محاسبي لها
        const uncoveredMethods: string[] = [];
        if (breakdown) {
          for (const [method, aliases] of Object.entries(paymentFieldCodes)) {
            const amt = Number(breakdown[method] ?? breakdown[method + '_AMOUNT'] ?? 0);
            if (amt > 0.001) {
              const isCovered = configLinks.some(l =>
                l.accountId && l.postingName &&
                aliases.some(a => a === l.postingName.toUpperCase())
              );
              if (!isCovered) uncoveredMethods.push(method);
            }
          }
        }

        // تحذير مفصّل يوضح وسائل الدفع غير المُربوطة
        const methodLabels: Record<string, string> = {
          CASH:    'نقدي',
          CARD:    'بطاقة',
          BANK:    'تحويل بنكي',
          ACCOUNT: 'آجل (حساب عميل)',
          TAMARA:  'تمارة',
          TABBY:   'تابي',
          OTHER:   'أخرى',
        };
        if (uncoveredMethods.length > 0) {
          const labels = uncoveredMethods.map(m => methodLabels[m] ?? m).join('، ');
          result.warnings.push(
            `وسائل الدفع التالية ليس لها حساب مُضبَّط في الدفتر: ${labels} — تمت إضافة القيد إلى حساب الصندوق الافتراضي (${shortfall.toFixed(3)})`
          );
        }

        // نضيف قيد موازن إلى حساب الصندوق الافتراضي
        const cashAccId = journal?.cashAccountId ?? null;
        if (cashAccId) {
          const cashAccs = await db.query.chartOfAccounts.findMany({
            where: (a, { eq }) => eq(a.id, cashAccId),
          });
          const cashAcc = cashAccs[0];
          result.lines.push({
            accountId:   cashAccId,
            accountCode: cashAcc?.code ?? '---',
            accountName: cashAcc?.name ?? 'الصندوق / النقد',
            debit:  shortfall.toFixed(4),
            credit: '0.0000',
            description: `مدفوعات إضافية - ${invoice.invoiceNumber}`,
          });
        } else {
          result.warnings.push('حساب الصندوق غير محدد في الدفتر — لا يمكن إضافة قيد التوازن التلقائي');
        }

        const newTotal = (debit + shortfall).toFixed(4);
        result.totalDebit  = cashAccId ? newTotal : result.totalDebit;
        result.isBalanced  = cashAccId ? true : false;
      }
    }

    return result;
  }

  // ── الاحتياط: المنطق الثابت (Legacy) ────────────────────────────────────
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
  const breakdown = invoice.paymentBreakdown as Record<string, number> | null | undefined;

  const lines: {
    accountId: number | null;
    accountCode: string;
    accountName: string;
    debit: string;
    credit: string;
    description: string;
  }[] = [];

  const warnings: string[] = [];

  // ── جانب المدين: نقدي + حساب العميل (دعم الدفع المختلط) ─────────────────
  const AR_CODE = 'ACCOUNT'; // كود وسيلة "حساب العميل (آجل)"
  const arAmount   = Number(breakdown?.[AR_CODE] ?? 0);
  const cashAmount = total - arAmount; // ما تبقى من إجمالي = نقدي/بطاقة/بنك

  if (breakdown && Object.keys(breakdown).length > 0) {
    // ── وضع تفصيل السداد: سطر لكل شق ────────────────────────────────────
    if (cashAmount > 0.001) {
      const cashAccId = journal?.cashAccountId ?? null;
      const cashAcc   = cashAccId ? accMap.get(cashAccId) : null;
      if (!cashAccId) warnings.push('حساب الصندوق غير محدد في الدفتر');
      lines.push({
        accountId:   cashAccId,
        accountCode: cashAcc?.code ?? '---',
        accountName: cashAcc?.name ?? 'الصندوق / النقد',
        debit:  cashAmount.toFixed(4),
        credit: '0.0000',
        description: `مدفوع نقداً - ${invoice.invoiceNumber}`,
      });
    }
    if (arAmount > 0.001) {
      const arAccId = journal?.creditAccountId ?? null;
      const arAcc   = arAccId ? accMap.get(arAccId) : null;
      if (!arAccId) warnings.push('حساب ذمم العملاء غير محدد في الدفتر');
      lines.push({
        accountId:   arAccId,
        accountCode: arAcc?.code ?? '---',
        accountName: arAcc?.name ?? 'ذمم العملاء',
        debit:  arAmount.toFixed(4),
        credit: '0.0000',
        description: `ذمة عميل (آجل) - ${invoice.invoiceNumber}`,
      });
    }
  } else {
    // ── وضع بسيط (لا تفصيل) ─────────────────────────────────────────────
    const debitAccId = isCredit ? journal?.creditAccountId : journal?.cashAccountId;
    const debitAcc   = debitAccId ? accMap.get(debitAccId) : null;
    const defaultDebitName = isCredit ? 'ذمم العملاء' : 'الصندوق / النقد';
    if (!debitAccId) warnings.push(isCredit ? 'حساب ذمم العملاء غير محدد في الدفتر' : 'حساب الصندوق غير محدد في الدفتر');
    lines.push({
      accountId:   debitAccId ?? null,
      accountCode: debitAcc?.code ?? '---',
      accountName: debitAcc?.name ?? defaultDebitName,
      debit:  total.toFixed(4),
      credit: '0.0000',
      description: `فاتورة مبيعات ${invoice.invoiceNumber}`,
    });
  }

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
// ─── ترحيل تلقائي فاتورة مبيعات / مردود مبيعات عند الحفظ ───────────────────
export async function autoPostSalesInvoice(
  invoiceId: number,
  orgId: number,
  userId: number,
): Promise<{ entryNumber: string } | null> {
  const invoice = await db.query.salesInvoices.findFirst({
    where: and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.orgId, orgId)),
  });
  if (!invoice || invoice.isPosted) return null;
  if (invoice.invoiceType !== 'sale' && invoice.invoiceType !== 'return') return null;
  if (!invoice.journalId && !invoice.docTypeId) return null;

  const journal = invoice.journalId
    ? await db.query.documentJournals.findFirst({
        where: and(eq(documentJournals.id, invoice.journalId), eq(documentJournals.orgId, orgId)),
      })
    : null;

  if (journal?.postingMode === 'disabled') return null;

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
    postingMode:       journal?.postingMode ?? 'auto',
  } as typeof documentJournals.$inferSelect;

  // التحقق: هل يوجد accountLinks مضبوطة (نهج حقول الكود) ؟
  const _ptCfgAuto = journal?.paymentTypesConfig as { accountLinks?: AccountLinkCfg[] } | null | undefined;
  const _hasFieldLinks = Array.isArray(_ptCfgAuto?.accountLinks) &&
    _ptCfgAuto!.accountLinks.some(l => l.accountId && l.postingName && l.postingSide);

  if (!_hasFieldLinks) {
    // لا ترحيل تلقائي إذا كانت الحسابات المباشرة ناقصة ولا يوجد accountLinks
    const isCredit = invoice.paymentMethod === 'credit';
    const hasDebitAcc = isCredit ? !!effectiveJournal.creditAccountId : !!effectiveJournal.cashAccountId;
    if (!effectiveJournal.salesAccountId || !hasDebitAcc) return null;
  }

  const { lines: rawLines, isBalanced } = await buildSalesInvoiceLines(invoice, effectiveJournal, orgId);
  if (!isBalanced || rawLines.length === 0) return null;

  // مردود المبيعات: عكس المدين/الدائن
  const isReturn = invoice.invoiceType === 'return';
  const reversedLines = isReturn
    ? rawLines.map(l => ({ ...l, debit: l.credit, credit: l.debit }))
    : rawLines;

  const docLabel = isReturn ? 'مردود مبيعات' : 'فاتورة مبيعات';
  const docTypeName = docTypeAccs?.docType?.nameAr ?? docLabel;
  const lineDesc = `${docTypeName} - ${invoice.invoiceNumber}`;
  const lines = reversedLines.map(l => ({ ...l, description: lineDesc }));

  const entry = await insertJournalEntry({
    orgId,
    userId,
    date: invoice.invoiceDate,
    description: docTypeName,
    reference: invoice.invoiceNumber,
    sourceDocType: isReturn ? 'sales_return' : 'sales_invoice',
    sourceDocId: invoice.id,
    sourceDocNumber: invoice.invoiceNumber,
    lines,
  });

  await db.update(salesInvoices)
    .set({ isPosted: true, postedAt: new Date(), postedJournalEntryId: entry.id, updatedAt: new Date() })
    .where(and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.orgId, orgId)));

  return { entryNumber: entry.entryNumber };
}

// ─── ترحيل تلقائي فاتورة مشتريات / مردود مشتريات عند الحفظ ────────────────
export async function autoPostPurchaseInvoice(
  invoiceId: number,
  orgId: number,
  userId: number,
): Promise<{ entryNumber: string } | null> {
  const invoice = await db.query.purchaseInvoices.findFirst({
    where: and(eq(purchaseInvoices.id, invoiceId), eq(purchaseInvoices.orgId, orgId)),
  });
  if (!invoice || invoice.isPosted) return null;
  if (!invoice.journalId && !invoice.docTypeId) return null;

  const journal = invoice.journalId
    ? await db.query.documentJournals.findFirst({
        where: and(eq(documentJournals.id, invoice.journalId), eq(documentJournals.orgId, orgId)),
      })
    : null;

  if (journal?.postingMode === 'disabled') return null;

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

  // لا ترحيل إذا كانت الحسابات الأساسية ناقصة
  const isCredit = invoice.paymentMethod === 'credit';
  const hasCounterAcc = isCredit ? !!effectiveJournal.supplierAccountId : !!effectiveJournal.cashAccountId;
  if (!effectiveJournal.purchaseAccountId || !hasCounterAcc) return null;

  const { lines: rawLines, isBalanced } = await buildPurchaseInvoiceLines(invoice, effectiveJournal, orgId);
  if (!isBalanced || rawLines.length === 0) return null;

  // مردود المشتريات: عكس المدين/الدائن
  const isReturn = invoice.invoiceType === 'return';
  const reversedLines = isReturn
    ? rawLines.map(l => ({ ...l, debit: l.credit, credit: l.debit }))
    : rawLines;

  const docLabel = isReturn ? 'مردود مشتريات' : 'فاتورة مشتريات';
  const docTypeName = docTypeAccs?.docType?.nameAr ?? docLabel;
  const lineDesc = `${docTypeName} - ${invoice.invoiceNumber}`;
  const lines = reversedLines.map(l => ({ ...l, description: lineDesc }));

  const entry = await insertJournalEntry({
    orgId,
    userId,
    date: invoice.invoiceDate,
    description: docTypeName,
    reference: invoice.invoiceNumber,
    sourceDocType: isReturn ? 'purchase_return' : 'purchase_invoice',
    sourceDocId: invoice.id,
    sourceDocNumber: invoice.invoiceNumber,
    lines,
  });

  await db.update(purchaseInvoices)
    .set({ isPosted: true, postedAt: new Date(), postedJournalEntryId: entry.id, updatedAt: new Date() })
    .where(and(eq(purchaseInvoices.id, invoiceId), eq(purchaseInvoices.orgId, orgId)));

  return { entryNumber: entry.entryNumber };
}

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
        : invoice.journalId
          ? await resolveDocTypeAccountsByJournal(invoice.journalId, orgId)
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
        : invoice.journalId
          ? await resolveDocTypeAccountsByJournal(invoice.journalId, orgId)
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

      // التحقق: هل يوجد accountLinks مضبوطة (نهج حقول الكود) ؟
      const _ptCfgMan = journal?.paymentTypesConfig as { accountLinks?: AccountLinkCfg[] } | null | undefined;
      const _hasFieldLinksMan = Array.isArray(_ptCfgMan?.accountLinks) &&
        _ptCfgMan!.accountLinks.some(l => l.accountId && l.postingName && l.postingSide);

      if (!_hasFieldLinksMan) {
        // التحقق التقليدي: الحسابات المباشرة
        const isCredit = invoice.paymentMethod === 'credit';
        const missingAccounts: string[] = [];
        if (!effectiveJournal.salesAccountId) missingAccounts.push('حساب المبيعات/الإيرادات');
        if (isCredit && !effectiveJournal.creditAccountId) missingAccounts.push('حساب ذمم العملاء (آجل)');
        if (!isCredit && !effectiveJournal.cashAccountId) missingAccounts.push('حساب الصندوق/النقد');
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
