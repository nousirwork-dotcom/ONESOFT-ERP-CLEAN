import type { CartLine, OrderTotals } from './types';

const BPS_DENOMINATOR = 10_000;

export function clampMinor(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function multiplyMinor(unitMinor: number, quantity: number): number {
  return Math.round(unitMinor * quantity);
}

export function formatMoney(minor: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function parseMoneyInput(value: string): number {
  const normalized = value
    .trim()
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[٬,]/g, '')
    .replace('٫', '.');

  if (!normalized) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return clampMinor(parsed * 100);
}

export function modifierUnitTotalMinor(line: CartLine): number {
  return line.selectedModifiers.reduce((sum, option) => sum + option.priceDeltaMinor, 0);
}

export function lineGrossBeforeDiscountMinor(line: CartLine): number {
  const unit = line.unitPriceMinor + modifierUnitTotalMinor(line);
  return multiplyMinor(unit, line.quantity);
}

export interface LineAmounts {
  grossBeforeDiscountMinor: number;
  discountMinor: number;
  netBeforeTaxMinor: number;
  taxMinor: number;
  grandTotalMinor: number;
}

export function calculateLineAmounts(line: CartLine): LineAmounts {
  const gross = lineGrossBeforeDiscountMinor(line);
  const discount = Math.min(clampMinor(line.discountMinor), gross);
  const afterDiscount = gross - discount;
  const rate = Math.max(0, Math.round(line.taxRateBps));

  if (rate === 0) {
    return {
      grossBeforeDiscountMinor: gross,
      discountMinor: discount,
      netBeforeTaxMinor: afterDiscount,
      taxMinor: 0,
      grandTotalMinor: afterDiscount,
    };
  }

  if (line.isTaxInclusive) {
    const net = Math.round((afterDiscount * BPS_DENOMINATOR) / (BPS_DENOMINATOR + rate));
    const tax = afterDiscount - net;
    return {
      grossBeforeDiscountMinor: gross,
      discountMinor: discount,
      netBeforeTaxMinor: net,
      taxMinor: tax,
      grandTotalMinor: afterDiscount,
    };
  }

  const tax = Math.round((afterDiscount * rate) / BPS_DENOMINATOR);
  return {
    grossBeforeDiscountMinor: gross,
    discountMinor: discount,
    netBeforeTaxMinor: afterDiscount,
    taxMinor: tax,
    grandTotalMinor: afterDiscount + tax,
  };
}

export function calculateOrderTotals(lines: CartLine[], orderDiscountMinor = 0): OrderTotals {
  const lineTotals = lines.reduce(
    (acc, line) => {
      const current = calculateLineAmounts(line);
      acc.subtotalBeforeDiscountMinor += current.grossBeforeDiscountMinor;
      acc.discountMinor += current.discountMinor;
      acc.netBeforeTaxMinor += current.netBeforeTaxMinor;
      acc.taxMinor += current.taxMinor;
      acc.grandTotalMinor += current.grandTotalMinor;
      return acc;
    },
    {
      subtotalBeforeDiscountMinor: 0,
      discountMinor: 0,
      netBeforeTaxMinor: 0,
      taxMinor: 0,
      grandTotalMinor: 0,
    },
  );

  const orderDiscount = Math.min(clampMinor(orderDiscountMinor), lineTotals.grandTotalMinor);
  if (orderDiscount === 0) return lineTotals;

  // توزيع خصم الطلب نسبيًا على صافي وضريبة الإجمالي لمنع عدم التطابق.
  const originalGrand = lineTotals.grandTotalMinor;
  const newGrand = originalGrand - orderDiscount;
  const ratio = originalGrand === 0 ? 0 : newGrand / originalGrand;
  const newNet = Math.round(lineTotals.netBeforeTaxMinor * ratio);
  const newTax = newGrand - newNet;

  return {
    subtotalBeforeDiscountMinor: lineTotals.subtotalBeforeDiscountMinor,
    discountMinor: lineTotals.discountMinor + orderDiscount,
    netBeforeTaxMinor: newNet,
    taxMinor: newTax,
    grandTotalMinor: newGrand,
  };
}
