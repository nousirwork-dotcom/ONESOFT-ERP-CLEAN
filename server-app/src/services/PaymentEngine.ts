/**
 * PaymentEngine — محرك معالجة المدفوعات
 *
 * مسؤول عن:
 * - حساب توزيع المدفوعات (paymentBreakdown) من وسائل الدفع وقيمها
 * - التحقق من صحة التوزيع (لا يتجاوز إجمالي الفاتورة)
 * - تحويل breakdown keys من PM.code إلى PM.fieldCode
 * - منطق "ترحيل المتبقي على حساب العميل"
 * - حساب حالة الدفع: paid | partial | unpaid | credit
 *
 * القاعدة: أي منطق متعلق بالدفع يُضاف هنا، ثم يُستدعى من router.
 */

import { db } from '../db.js';
import { paymentMethods } from '../schema.js';
import { eq, and } from 'drizzle-orm';

// ─── أنواع ─────────────────────────────────────────────────────────────────────

export type PaymentBreakdown = Record<string, number>;

export type PaymentSummary = {
  breakdown:       PaymentBreakdown;
  totalPaid:       number;
  remaining:       number;
  isFullyPaid:     boolean;
  isOverPaid:      boolean;
  status:          'paid' | 'partial' | 'unpaid' | 'credit';
};

export type PaymentMethodRecord = {
  id:        number;
  code:      string;
  fieldCode: string | null;
  nameAr:    string;
  nameEn:    string | null;
  isActive:  boolean;
};

// ─── getActivePaymentMethods ───────────────────────────────────────────────────
/**
 * يجلب وسائل الدفع الفعّالة للمنظمة.
 * fieldCode يُستخدم كمفتاح في paymentBreakdown.
 */
export async function getActivePaymentMethods(orgId: number): Promise<PaymentMethodRecord[]> {
  const rows = await db.query.paymentMethods.findMany({
    where: and(eq(paymentMethods.orgId, orgId), eq(paymentMethods.isActive, true)),
    orderBy: (pm, { asc }) => [asc(pm.sortOrder), asc(pm.id)],
  });
  return rows.map(r => ({
    id:        r.id,
    code:      r.code,
    fieldCode: (r as any).fieldCode ?? r.code,
    nameAr:    r.nameAr,
    nameEn:    r.nameEn ?? null,
    isActive:  r.isActive,
  }));
}

// ─── resolveBreakdownKey ───────────────────────────────────────────────────────
/**
 * يُحدّد مفتاح التوزيع الصحيح لوسيلة الدفع.
 * الأولوية: fieldCode → code
 *
 * هذا يضمن أن الـ breakdown يُبنى دائماً بـ fieldCode
 * بما يتطابق مع postingName في الروابط المحاسبية.
 */
export function resolveBreakdownKey(pm: PaymentMethodRecord): string {
  return pm.fieldCode ?? pm.code;
}

// ─── summarizePayment ─────────────────────────────────────────────────────────
/**
 * يُلخّص بيانات الدفع من breakdown خام.
 *
 * @param rawBreakdown  { [fieldCode]: amount }
 * @param invoiceTotal  إجمالي الفاتورة
 * @param isCredit      هل هي فاتورة آجلة
 */
export function summarizePayment(
  rawBreakdown: PaymentBreakdown,
  invoiceTotal: number,
  isCredit = false,
): PaymentSummary {
  const breakdown: PaymentBreakdown = {};
  let totalPaid = 0;

  for (const [key, val] of Object.entries(rawBreakdown)) {
    const n = Number(val) || 0;
    if (n > 0) {
      breakdown[key] = n;
      totalPaid += n;
    }
  }

  const remaining   = Math.max(0, invoiceTotal - totalPaid);
  const isFullyPaid = Math.abs(totalPaid - invoiceTotal) < 0.005;
  const isOverPaid  = totalPaid > invoiceTotal + 0.005;

  let status: PaymentSummary['status'] = 'unpaid';
  if (isCredit)      status = 'credit';
  else if (isFullyPaid) status = 'paid';
  else if (totalPaid > 0) status = 'partial';

  return { breakdown, totalPaid, remaining, isFullyPaid, isOverPaid, status };
}

// ─── validateBreakdown ────────────────────────────────────────────────────────
/**
 * يتحقق من صحة توزيع المدفوعات.
 * يعيد قائمة بالأخطاء (فارغة إذا كان صحيحاً).
 */
export function validateBreakdown(
  breakdown: PaymentBreakdown,
  invoiceTotal: number,
  allowOverpay = false,
): string[] {
  const errors: string[] = [];
  const total = Object.values(breakdown).reduce((s, v) => s + (Number(v) || 0), 0);

  for (const [key, val] of Object.entries(breakdown)) {
    if (Number(val) < 0) errors.push(`قيمة سالبة في وسيلة الدفع: ${key}`);
  }
  if (!allowOverpay && total > invoiceTotal + 0.005) {
    errors.push(`المبلغ المدفوع (${total.toFixed(2)}) يتجاوز إجمالي الفاتورة (${invoiceTotal.toFixed(2)})`);
  }
  return errors;
}

// ─── moveRemainingToAccount ───────────────────────────────────────────────────
/**
 * يُضيف المبلغ المتبقي على وسيلة "حساب العميل" في التوزيع.
 *
 * @param breakdown       التوزيع الحالي
 * @param remaining       المبلغ المتبقي
 * @param accountFieldCode fieldCode لوسيلة "حساب العميل" (افتراضي: ACCOUNT)
 */
export function moveRemainingToAccount(
  breakdown: PaymentBreakdown,
  remaining: number,
  accountFieldCode = 'ACCOUNT',
): PaymentBreakdown {
  const current = Number(breakdown[accountFieldCode] ?? 0);
  return { ...breakdown, [accountFieldCode]: current + remaining };
}
