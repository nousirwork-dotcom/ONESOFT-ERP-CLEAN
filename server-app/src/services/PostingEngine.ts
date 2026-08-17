/**
 * PostingEngine — محرك الترحيل المحاسبي
 *
 * يحتوي على كامل Business Logic للترحيل:
 * - تحليل حسابات نوع المستند
 * - بناء أسطر القيد (مبيعات + مشتريات)
 * - الترحيل التلقائي
 * - التحقق من صحة الحسابات
 * - إدراج القيد في قاعدة البيانات
 *
 * القاعدة: Router يستدعي هذا الملف فقط — لا يحتوي على منطق.
 */

import { db } from '../db.js';
import {
  salesInvoices, purchaseInvoices, purchaseInvoiceItems,
  journalEntries, journalEntryLines,
  documentJournals, chartOfAccounts, documentTypes,
  warehouseAccountLinks, paymentMethods,
} from '../schema.js';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  accountCode?: string | null;
  accountSystemKey?: string | null;
  postingName:  string;
  postingSide:  string;
  description:  string;
};

type PaymentTypeConfig = {
  id?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  codeAr?: string | null;
  codeEn?: string | null;
};

export type PaymentTypesConfig = {
  types?: PaymentTypeConfig[];
  /** Legacy flat list used by older journals. */
  accountLinks?: AccountLinkConfig[];
  /** New independent links keyed by payment/document type id. */
  accountLinksByType?: Record<string, AccountLinkConfig[]>;
};

function normalizePaymentTypeKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

/**
 * Select the accounting links for the invoice's payment/document type.
 * Journals created before per-type links existed continue using accountLinks.
 */
export function getConfiguredAccountLinks(
  config: PaymentTypesConfig | null | undefined,
  paymentMethod: unknown,
): AccountLinkConfig[] {
  const legacyLinks = Array.isArray(config?.accountLinks) ? config.accountLinks : [];
  const groups = config?.accountLinksByType;
  if (!groups || typeof groups !== 'object' || Array.isArray(groups)) return legacyLinks;

  const rawPaymentMethod = normalizePaymentTypeKey(paymentMethod);
  const candidates = new Set([rawPaymentMethod]);
  if (rawPaymentMethod === 'credit' || rawPaymentMethod === 'cridt' || rawPaymentMethod === 'اجل') {
    candidates.add('credit');
    candidates.add('cridt');
    candidates.add('اجل');
  }
  if (rawPaymentMethod === 'cash' || rawPaymentMethod === 'نقدا') {
    candidates.add('cash');
    candidates.add('نقدا');
  }

  const matchedType = Array.isArray(config?.types)
    ? config!.types.find(type =>
        [type.id, type.nameAr, type.nameEn, type.codeAr, type.codeEn]
          .some(value => value != null && candidates.has(normalizePaymentTypeKey(value))),
      )
    : undefined;

  if (matchedType?.id && Array.isArray(groups[matchedType.id])) {
    return groups[matchedType.id]!;
  }
  if (rawPaymentMethod && Array.isArray(groups[rawPaymentMethod])) {
    return groups[rawPaymentMethod]!;
  }
  return legacyLinks;
}

// ══════════════════════════════════════════════════════════════════════════════
// resolveDocTypeAccounts — تحليل حسابات نوع المستند
// ══════════════════════════════════════════════════════════════════════════════

export async function resolveDocTypeAccountsByJournal(journalId: number, orgId: number, tx: DbClient = db) {
  const docType = await tx.query.documentTypes.findFirst({
    where: and(eq(documentTypes.journal, String(journalId)), eq(documentTypes.orgId, orgId)),
  });
  if (!docType) return null;
  return resolveDocTypeAccounts(docType.id, orgId, tx);
}

export async function resolveDocTypeAccounts(docTypeId: number, orgId: number, tx: DbClient = db) {
  const docType = await tx.query.documentTypes.findFirst({
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
    const walRows = await tx.query.warehouseAccountLinks.findMany({
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

// ══════════════════════════════════════════════════════════════════════════════
// validateAccounts — التحقق من صحة الحسابات
// ══════════════════════════════════════════════════════════════════════════════

export async function validateAccounts(accountIds: (number | null)[], tx: DbClient = db): Promise<void> {
  const ids = accountIds.filter((id): id is number => id !== null);
  if (!ids.length) return;
  const accs = await tx.query.chartOfAccounts.findMany({
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

// ══════════════════════════════════════════════════════════════════════════════
// nextEntryNumber — رقم قيد تسلسلي
// ══════════════════════════════════════════════════════════════════════════════

export async function nextEntryNumber(orgId: number, tx?: DbClient): Promise<string> {
  const client = tx ?? db;
  const last = await client.query.journalEntries.findFirst({
    where: eq(journalEntries.orgId, orgId),
    orderBy: [desc(journalEntries.id)],
  });
  const n = last ? parseInt(last.entryNumber.replace(/\D/g, '') || '0') + 1 : 1;
  return `JE-${String(n).padStart(4, '0')}`;
}

export async function reserveDocumentNumber(
  journalId: number,
  orgId: number,
  tx: DbClient,
): Promise<{ number: string; journal: typeof documentJournals.$inferSelect }> {
  const [journal] = await tx.update(documentJournals)
    .set({ currentSeq: sql`${documentJournals.currentSeq} + ${documentJournals.increment}` })
    .where(and(eq(documentJournals.id, journalId), eq(documentJournals.orgId, orgId), eq(documentJournals.isActive, true)))
    .returning();
  if (!journal) throw new Error('دفتر المستند الناتج غير موجود أو غير فعال');
  const seq = journal.currentSeq;
  if (seq > journal.lastNumber) throw new Error(`انتهى تسلسل دفتر المستند: ${journal.name}`);
  const year = journal.includeYear ? `${new Date().getFullYear()}-` : '';
  return {
    number: `${journal.numberPrefix}${year}${String(seq).padStart(journal.numDigits, '0')}`,
    journal,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// resolveInvoiceFieldValue — تحليل قيمة حقل من فاتورة مبيعات
// ══════════════════════════════════════════════════════════════════════════════

export function resolveInvoiceFieldValue(
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
    case 'CASH':          return breakdown
                            ? Number(breakdown.CASH ?? breakdown.CASH_AMOUNT ?? 0)
                            : (isCredit ? 0 : total);
    case 'CUSTOMER_CODE':
    case 'CUSTOMER_RECEIVABLE': return Number(breakdown?.ACCOUNT ?? breakdown?.ACCOUNT_AMOUNT ?? (isCredit ? total : 0));
    case 'PAID':
    case 'PAYMENT_TOTAL': return paidAmount;
    case 'REMAINING':     return Math.max(0, total - paidAmount);
    case 'CASH_AMOUNT':    return Number(breakdown?.CASH    ?? breakdown?.CASH_AMOUNT    ?? 0);
    case 'CARD_AMOUNT':
    case 'VISA':           return Number(breakdown?.CARD    ?? breakdown?.VISA    ?? breakdown?.CARD_AMOUNT ?? 0);
    case 'BANK_AMOUNT':
    case 'BANK_TRANSFER':  return Number(breakdown?.BANK    ?? breakdown?.BANK_AMOUNT    ?? 0);
    case 'ACCOUNT_AMOUNT':
    case 'ACCOUNT':        return Number(breakdown?.ACCOUNT ?? breakdown?.ACCOUNT_AMOUNT ?? 0);
    case 'TAMARA':
    case 'TAMARA_AMOUNT':  return Number(breakdown?.TAMARA  ?? breakdown?.TAMARA_AMOUNT  ?? 0);
    case 'TABBY':
    case 'TABBY_AMOUNT':   return Number(breakdown?.TABBY   ?? breakdown?.TABBY_AMOUNT   ?? 0);
    case 'OTHER_AMOUNT':   return Number(breakdown?.OTHER   ?? breakdown?.OTHER_AMOUNT   ?? 0);
    default: {
      if (breakdown) {
        const code = fieldCode.toUpperCase();
        const direct = breakdown[code] ?? breakdown[code.replace(/_AMOUNT$/, '')] ?? null;
        if (direct !== null) return Number(direct);
      }
      return 0;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// buildLinesFromAccountLinks — بناء أسطر القيد من الروابط المحاسبية
// ══════════════════════════════════════════════════════════════════════════════

export async function buildLinesFromAccountLinks(
  accountLinks: AccountLinkConfig[],
  invoice: typeof salesInvoices.$inferSelect,
  orgId: number,
): Promise<PostingResult> {
  const accIds = accountLinks
    .map(l => l.accountId)
    .filter((id): id is number => typeof id === 'number' && id > 0);

  const accs = accIds.length
    ? await db.query.chartOfAccounts.findMany({
        where: (a, { and, eq, inArray }) => and(
          inArray(a.id, accIds),
          eq(a.orgId, orgId),
        ),
      })
    : [];
  const accMap = new Map(accs.map(a => [a.id, a]));

  const lines: PostingLine[] = [];
  const warnings: string[] = [];

  for (const link of accountLinks) {
    if (!link.accountId || !link.postingName || !link.postingSide) continue;
    const value = resolveInvoiceFieldValue(link.postingName, invoice);
    if (value === 0) continue;

    const acc    = accMap.get(link.accountId);
    if (!acc) {
      throw new Error(`الحساب المرتبط "${link.accountId}" غير موجود في المنظمة الحالية`);
    }
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

// ══════════════════════════════════════════════════════════════════════════════
// buildSalesInvoiceLines — بناء أسطر قيد فاتورة المبيعات
// ══════════════════════════════════════════════════════════════════════════════

export async function buildSalesInvoiceLines(
  invoice: typeof salesInvoices.$inferSelect,
  journal: typeof documentJournals.$inferSelect | null,
  orgId: number,
) {
  // A sales debit note increases the customer's receivable. It is not a
  // payment/settlement document, so account-links and the legacy fallback must
  // resolve its debit side as customer receivable.
  if (invoice.invoiceType === 'debit_note') {
    invoice = {
      ...invoice,
      paymentMethod: 'credit',
      paymentBreakdown: null,
      paidAmount: '0',
    };
  }
  const ptCfg = journal?.paymentTypesConfig as PaymentTypesConfig | null | undefined;
  const configLinks = getConfiguredAccountLinks(ptCfg, invoice.paymentMethod);
  const hasConfiguredLinks = configLinks.some(l => l.accountId && l.postingName && l.postingSide);

  if (hasConfiguredLinks) {
    const result = await buildLinesFromAccountLinks(configLinks, invoice, orgId);

    if (!result.isBalanced) {
      const debit  = Number(result.totalDebit);
      const credit = Number(result.totalCredit);
      const shortfall = credit - debit;

      if (shortfall > 0.001) {
        const breakdown = invoice.paymentBreakdown as Record<string, number> | null | undefined;

        const orgPayMethods = await db.select({ code: paymentMethods.code, nameAr: paymentMethods.nameAr })
          .from(paymentMethods)
          .where(eq(paymentMethods.orgId, orgId));

        const uncoveredMethods: string[] = [];
        if (breakdown) {
          for (const pm of orgPayMethods) {
            const amt = Number(breakdown[pm.code] ?? 0);
            if (amt > 0.001) {
              const knownAliases: Record<string, string[]> = {
                CASH:    ['CASH', 'CASH_AMOUNT'],
                CARD:    ['CARD', 'CARD_AMOUNT', 'VISA'],
                BANK:    ['BANK', 'BANK_AMOUNT', 'BANK_TRANSFER'],
                ACCOUNT: ['ACCOUNT', 'ACCOUNT_AMOUNT', 'CUSTOMER_RECEIVABLE', 'CUSTOMER_CODE'],
                TAMARA:  ['TAMARA', 'TAMARA_AMOUNT'],
                TABBY:   ['TABBY', 'TABBY_AMOUNT'],
                OTHER:   ['OTHER', 'OTHER_AMOUNT'],
              };
              const aliases = knownAliases[pm.code] ?? [pm.code];
              const isCovered = configLinks.some(l =>
                l.accountId && l.postingName &&
                aliases.some(a => a === l.postingName.toUpperCase())
              );
              if (!isCovered) uncoveredMethods.push(pm.nameAr ?? pm.code);
            }
          }
        }

        if (uncoveredMethods.length > 0) {
          const labels = uncoveredMethods.join('، ');
          const cashAccId = journal?.cashAccountId ?? null;
          if (cashAccId) {
            result.warnings.push(
              `وسائل الدفع التالية ليس لها حساب مُضبَّط في الدفتر: ${labels} — تمت إضافة الفرق (${shortfall.toFixed(3)}) إلى حساب الصندوق الافتراضي`
            );
          } else {
            result.warnings.push(
              `وسائل الدفع التالية ليس لها حساب مُضبَّط في الدفتر: ${labels} (${shortfall.toFixed(3)}) — يُرجى إضافة رابط محاسبي لكل وسيلة في إعدادات الدفتر`
            );
          }
        }

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
        }

        const newTotal = (debit + shortfall).toFixed(4);
        result.totalDebit  = cashAccId ? newTotal : result.totalDebit;
        result.isBalanced  = cashAccId ? true : false;
      }
    }

    return result;
  }

  // ── Legacy: المنطق الثابت ──────────────────────────────────────────────────
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

  const lines: PostingLine[] = [];
  const warnings: string[] = [];

  const AR_CODE = 'ACCOUNT';
  const arAmount   = Number(breakdown?.[AR_CODE] ?? 0);
  const cashAmount = total - arAmount;

  if (breakdown && Object.keys(breakdown).length > 0) {
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

// ══════════════════════════════════════════════════════════════════════════════
// buildPurchaseInvoiceLines — بناء أسطر قيد فاتورة المشتريات
// ══════════════════════════════════════════════════════════════════════════════

export async function buildPurchaseInvoiceLines(
  invoice: typeof purchaseInvoices.$inferSelect,
  journal: {
    purchaseAccountId?: number | null;
    supplierAccountId?: number | null;
    cashAccountId?: number | null;
    taxAccountId?: number | null;
    discountAccountId?: number | null;
  } | null,
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

  const lines: PostingLine[] = [];
  const warnings: string[] = [];

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

// ══════════════════════════════════════════════════════════════════════════════
// insertJournalEntry — إدراج قيد محاسبي في قاعدة البيانات
// ══════════════════════════════════════════════════════════════════════════════

export async function insertJournalEntry(opts: {
  orgId: number;
  userId: number;
  date: Date;
  description: string;
  reference: string;
  sourceDocType: string;
  sourceDocId: number;
  sourceDocNumber: string;
  lines: PostingLine[];
  journalId?: number | null;
  generatedDocType?: string | null;
  tx?: DbClient;
}) {
  const client = opts.tx ?? db;
  const reserved = opts.journalId
    ? await reserveDocumentNumber(opts.journalId, opts.orgId, client)
    : null;
  const entryNumber = reserved?.number ?? await nextEntryNumber(opts.orgId, opts.tx);
  const totalDebit  = opts.lines.reduce((s, l) => s + Number(l.debit),  0);
  const totalCredit = opts.lines.reduce((s, l) => s + Number(l.credit), 0);

  const [entry] = await client.insert(journalEntries).values({
    orgId:           opts.orgId,
    entryNumber,
    entryDate:       opts.date,
    description:     opts.description,
    reference:       opts.reference,
    totalDebit:      totalDebit.toFixed(4),
    totalCredit:     totalCredit.toFixed(4),
    status:          'posted',
    userId:          opts.userId,
    sourceDocType:   opts.sourceDocType,
    sourceDocId:     opts.sourceDocId,
    sourceDocNumber: opts.sourceDocNumber,
    entryType:       'auto',
    journalId:       opts.journalId ?? null,
    generatedDocType: opts.generatedDocType ?? null,
  }).returning();

  if (opts.lines.length > 0) {
    await client.insert(journalEntryLines).values(
      opts.lines.map((l, i) => ({
        entryId:     entry.id,
        orgId:       opts.orgId,
        accountId:   l.accountId ?? undefined,
        accountCode: l.accountCode,
        accountName: l.accountName,
        description: l.description,
        debit:       l.debit,
        credit:      l.credit,
        sortOrder:   i,
      }))
    );
  }
  return entry;
}

// ══════════════════════════════════════════════════════════════════════════════
// autoPostSalesInvoice — ترحيل تلقائي فاتورة مبيعات / مردود
// ══════════════════════════════════════════════════════════════════════════════

export async function autoPostSalesInvoice(
  invoiceId: number,
  orgId: number,
  userId: number,
  tx?: DbClient,
): Promise<{ entryNumber: string } | null> {
  const client = tx ?? db;
  const invoice = await client.query.salesInvoices.findFirst({
    where: and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.orgId, orgId)),
  });
  if (!invoice || invoice.isPosted) return null;
  if (
    invoice.invoiceType !== 'sale' &&
    invoice.invoiceType !== 'return' &&
    invoice.invoiceType !== 'credit_note' &&
    invoice.invoiceType !== 'debit_note'
  ) return null;
  if (!invoice.journalId && !invoice.docTypeId) return null;

  const journal = invoice.journalId
    ? await client.query.documentJournals.findFirst({
        where: and(eq(documentJournals.id, invoice.journalId), eq(documentJournals.orgId, orgId)),
      })
    : null;

  if (journal?.postingMode === 'disabled') return null;

  const docTypeAccs = invoice.docTypeId
    ? await resolveDocTypeAccounts(invoice.docTypeId, orgId, client)
    : invoice.journalId
      ? await resolveDocTypeAccountsByJournal(invoice.journalId, orgId, client)
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

  const _ptCfgAuto = journal?.paymentTypesConfig as PaymentTypesConfig | null | undefined;
  const _configLinksAuto = getConfiguredAccountLinks(_ptCfgAuto, invoice.paymentMethod);
  const _hasFieldLinks = _configLinksAuto.some(l => l.accountId && l.postingName && l.postingSide);

  if (!_hasFieldLinks) {
    const isCredit = invoice.paymentMethod === 'credit';
    const hasDebitAcc = isCredit ? !!effectiveJournal.creditAccountId : !!effectiveJournal.cashAccountId;
    if (!effectiveJournal.salesAccountId || !hasDebitAcc) return null;
  }
  const { lines: rawLines, isBalanced } = await buildSalesInvoiceLines(invoice, effectiveJournal, orgId);
  if (!isBalanced || rawLines.length === 0) return null;

  const isDebitNote = (invoice.invoiceType as string) === 'debit_note';
  const isReturn = invoice.invoiceType === 'return' || invoice.invoiceType === 'credit_note';
  const reversedLines = isReturn
    ? rawLines.map(l => ({ ...l, debit: l.credit, credit: l.debit }))
    : rawLines;

  const docLabel    = isDebitNote
    ? 'إشعار مدين'
    : invoice.invoiceType === 'credit_note'
    ? 'إشعار دائن'
    : isReturn ? 'مردود مبيعات' : 'فاتورة مبيعات';
  const docTypeName = docTypeAccs?.docType?.nameAr ?? docLabel;
  const lineDesc    = `${docTypeName} - ${invoice.invoiceNumber}`;
  const lines       = reversedLines.map(l => ({ ...l, description: lineDesc }));

  const entry = await insertJournalEntry({
    orgId,
    userId,
    date:            invoice.invoiceDate,
    description:     docTypeName,
    reference:       invoice.invoiceNumber,
    sourceDocType:   isDebitNote
      ? 'debit_note'
      : invoice.invoiceType === 'credit_note'
      ? 'credit_note'
      : isReturn ? 'sales_return' : 'sales_invoice',
    sourceDocId:     invoice.id,
    sourceDocNumber: invoice.invoiceNumber,
    lines,
    tx,
  });

  await client.update(salesInvoices)
    .set({
      isPosted: true,
      postedAt: new Date(),
      postedJournalEntryId: entry.id,
      updatedAt: new Date(),
    })
    .where(and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.orgId, orgId)));

  return { entryNumber: entry.entryNumber };
}



// ══════════════════════════════════════════════════════════════════════════════
// autoPostPurchaseInvoice — ترحيل تلقائي فاتورة مشتريات / مردود
// ══════════════════════════════════════════════════════════════════════════════

export async function autoPostPurchaseInvoice(
  invoiceId: number,
  orgId: number,
  userId: number,
  tx?: DbClient,
): Promise<{ entryNumber: string } | null> {
  const client = tx ?? db;
  const invoice = await client.query.purchaseInvoices.findFirst({
    where: and(eq(purchaseInvoices.id, invoiceId), eq(purchaseInvoices.orgId, orgId)),
  });
  if (!invoice || invoice.isPosted) return null;
  if (!invoice.journalId && !invoice.docTypeId) return null;

  const journal = invoice.journalId
    ? await client.query.documentJournals.findFirst({
        where: and(eq(documentJournals.id, invoice.journalId), eq(documentJournals.orgId, orgId)),
      })
    : null;

  if (journal?.postingMode === 'disabled') return null;

  const docTypeAccs = invoice.docTypeId
    ? await resolveDocTypeAccounts(invoice.docTypeId, orgId, client)
    : invoice.journalId
      ? await resolveDocTypeAccountsByJournal(invoice.journalId, orgId, client)
      : null;

  const effectiveJournal = {
    purchaseAccountId: docTypeAccs?.purchaseAccountId ?? journal?.purchaseAccountId ?? null,
    supplierAccountId: docTypeAccs?.supplierAccountId ?? journal?.supplierAccountId ?? null,
    cashAccountId:     docTypeAccs?.cashAccountId     ?? journal?.cashAccountId     ?? null,
    taxAccountId:      docTypeAccs?.taxAccountId      ?? journal?.taxAccountId      ?? null,
    discountAccountId: docTypeAccs?.discountAccountId ?? journal?.discountAccountId ?? null,
  };

  const isCredit = invoice.paymentMethod === 'credit';
  const hasCounterAcc = isCredit ? !!effectiveJournal.supplierAccountId : !!effectiveJournal.cashAccountId;
  if (!effectiveJournal.purchaseAccountId || !hasCounterAcc) return null;
  await validateAccounts([
    effectiveJournal.purchaseAccountId,
    effectiveJournal.supplierAccountId,
    effectiveJournal.cashAccountId,
    effectiveJournal.taxAccountId,
    effectiveJournal.discountAccountId,
  ], client);

  const { lines: rawLines, isBalanced } = await buildPurchaseInvoiceLines(invoice, effectiveJournal, orgId);
  if (!isBalanced || rawLines.length === 0) return null;

  const isReturn    = invoice.invoiceType === 'return';
  if (invoice.invoiceType === 'debit_note') {
    throw new Error('إشعار المدين مستند مبيعات صادر ولا يجوز ترحيله من مسار المشتريات');
  }
  const reversedLines = isReturn
    ? rawLines.map(l => ({ ...l, debit: l.credit, credit: l.debit }))
    : rawLines;

  const docLabel    = isReturn ? 'مردود مشتريات' : 'فاتورة مشتريات';
  const docTypeName = docTypeAccs?.docType?.nameAr ?? docLabel;
  const lineDesc    = `${docTypeName} - ${invoice.invoiceNumber}`;
  const lines       = reversedLines.map(l => ({ ...l, description: lineDesc }));

  const entry = await insertJournalEntry({
    orgId,
    userId,
    date:            invoice.invoiceDate,
    description:     docTypeName,
    reference:       invoice.invoiceNumber,
    sourceDocType:   isReturn ? 'purchase_return' : 'purchase_invoice',
    sourceDocId:     invoice.id,
    sourceDocNumber: invoice.invoiceNumber,
    lines,
    tx,
  });

  await client.update(purchaseInvoices)
    .set({ isPosted: true, postedAt: new Date(), postedJournalEntryId: entry.id, updatedAt: new Date() })
    .where(and(eq(purchaseInvoices.id, invoiceId), eq(purchaseInvoices.orgId, orgId)));

  return { entryNumber: entry.entryNumber };
}

// ══════════════════════════════════════════════════════════════════════════════
// getJournalForDoc — جلب دفتر المستند
// ══════════════════════════════════════════════════════════════════════════════

export async function getJournalForDoc(
  journalId: number | null | undefined,
  orgId: number,
): Promise<typeof documentJournals.$inferSelect | null> {
  if (!journalId) return null;
  return (await db.query.documentJournals.findFirst({
    where: and(eq(documentJournals.id, journalId), eq(documentJournals.orgId, orgId)),
  })) ?? null;
}
