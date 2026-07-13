const nf = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** تنسيق موحّد للمبالغ: "1,234.56 ر.س" — دائماً منزلتان عشريتان */
export function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${nf.format(Number.isFinite(n) ? n : 0)}\u00A0ر.س`;
}
