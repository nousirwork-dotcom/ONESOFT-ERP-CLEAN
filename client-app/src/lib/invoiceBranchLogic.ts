/**
 * منطق تغيير الفرع في فاتورة المبيعات — دوال نقية بدون React
 *
 * مُستخرَج من SalesInvoicePage.doSelectBranch لإتاحة الاختبار المعزول.
 * جميع الحقول في هذا الملف خالية من أي اعتماديات على React أو DOM.
 */

/** الحقول التابعة للفرع التي تُمسح عند اختيار فرع جديد */
export type BranchDependentFields = {
  basedOnType:   string;
  basedOnNumber: string;
  sellerUserId:  number | null;
  lines:         unknown[];
};

/**
 * تُعيد نسخة جديدة من الحالة مع مسح جميع الحقول التابعة للفرع.
 * تُستدعى داخل SalesInvoicePage.doSelectBranch عند تغيير الفرع.
 */
export function clearBranchDependentFields<T extends BranchDependentFields>(
  state: T,
): T {
  return {
    ...state,
    basedOnType:   '',
    basedOnNumber: '',
    sellerUserId:  null,
    lines:         [],
  };
}
