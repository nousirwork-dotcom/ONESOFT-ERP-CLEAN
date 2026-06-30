/**
 * CssEngine.ts — محرك CSS المركزي للطباعة
 *
 * مصدر CSS الوحيد لجميع مستندات الطباعة.
 * كل تعديل على أسلوب الطباعة يتم هنا فقط.
 */
import type { PrinterConfig } from "./types";

export type PaperSize = "A4" | "A5" | "thermal80" | "thermal57";

const PAPER_SIZES: Record<PaperSize, { width: string; height?: string }> = {
  A4:        { width: "210mm" },
  A5:        { width: "148mm" },
  thermal80: { width: "80mm" },
  thermal57: { width: "57mm" },
};

export const CssEngine = {
  /**
   * يُنشئ CSS الطباعة الأساسي لأي مستند.
   * @param paperSize  حجم الورقة
   * @param orientation الاتجاه (portrait | landscape)
   * @param extraCss  CSS إضافي خاص بالمستند
   */
  buildPrintCss(
    paperSize: PaperSize = "A4",
    orientation: "portrait" | "landscape" = "portrait",
    extraCss = "",
  ): string {
    const paper = PAPER_SIZES[paperSize] ?? PAPER_SIZES.A4;
    const sizeDecl = orientation === "landscape"
      ? `size: ${paperSize} landscape`
      : `size: ${paper.width}`;

    return `
      *, *::before, *::after { box-sizing: border-box; }

      body {
        margin: 0;
        padding: 0;
        font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
        font-size: 13px;
        color: #000;
        background: #fff;
        direction: rtl;
      }

      @media print {
        @page {
          ${sizeDecl};
          margin: 10mm 8mm;
        }
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .no-print { display: none !important; }
        .page-break { page-break-before: always; break-before: page; }
        .avoid-break { page-break-inside: avoid; break-inside: avoid; }
      }

      @media screen {
        body {
          background: #f5f5f5;
          padding: 12px;
        }
        .print-page {
          background: #fff;
          width: ${paper.width};
          max-width: 100%;
          margin: 0 auto;
          box-shadow: 0 2px 12px rgba(0,0,0,.15);
          padding: 12mm 10mm;
        }
      }

      table {
        border-collapse: collapse;
        width: 100%;
      }
      th, td {
        padding: 4px 6px;
        font-size: 12px;
        vertical-align: middle;
      }

      ${extraCss}
    `;
  },

  /**
   * CSS مخصص للملصقات الصغيرة (thermal/label).
   */
  buildLabelCss(paperSize: PaperSize = "thermal80"): string {
    return this.buildPrintCss(paperSize, "portrait", `
      body { font-size: 11px; }
      .label-card {
        border: 1px solid #000;
        padding: 4mm;
        margin-bottom: 3mm;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .label-barcode { text-align: center; margin: 2mm 0; }
      .label-name { font-weight: bold; font-size: 13px; text-align: center; }
      .label-price { font-size: 16px; font-weight: bold; text-align: center; color: #000; }
      .label-sku { font-size: 9px; color: #555; text-align: center; }
    `);
  },

  /**
   * CSS مخصص للتقارير المحاسبية.
   */
  buildReportCss(primaryColor = "#406B93"): string {
    return this.buildPrintCss("A4", "portrait", `
      .report-header { margin-bottom: 8mm; }
      .report-title { font-size: 18px; font-weight: bold; color: ${primaryColor}; }
      .report-subtitle { font-size: 12px; color: #555; margin-top: 2px; }
      .report-meta { font-size: 11px; color: #777; margin-top: 4px; }
      .report-table th {
        background: ${primaryColor};
        color: #fff;
        font-weight: bold;
        border: 1px solid ${primaryColor};
        text-align: center;
      }
      .report-table td { border: 1px solid #ddd; }
      .row-subtotal td { background: #f0f4f8; font-weight: bold; }
      .row-total td { background: ${primaryColor}22; font-weight: bold; border-top: 2px solid ${primaryColor}; }
      .row-header td { background: #e8ecf0; font-weight: bold; font-size: 13px; }
      .amount { direction: ltr; text-align: left; font-variant-numeric: tabular-nums; }
    `);
  },

  /**
   * CSS مخصص للسندات.
   */
  buildVoucherCss(primaryColor = "#406B93"): string {
    return this.buildPrintCss("A5", "portrait", `
      .voucher-box { border: 2px solid ${primaryColor}; padding: 8mm; }
      .voucher-header { text-align: center; border-bottom: 1px solid ${primaryColor}; padding-bottom: 4mm; margin-bottom: 4mm; }
      .voucher-title { font-size: 20px; font-weight: bold; color: ${primaryColor}; }
      .voucher-number { font-size: 14px; color: #555; }
      .voucher-field { display: flex; justify-content: space-between; margin-bottom: 3mm; font-size: 13px; }
      .voucher-label { color: #555; }
      .voucher-value { font-weight: bold; }
      .voucher-amount-box {
        background: ${primaryColor}11;
        border: 1px solid ${primaryColor};
        border-radius: 4px;
        padding: 3mm 5mm;
        margin: 4mm 0;
        text-align: center;
      }
      .voucher-amount { font-size: 22px; font-weight: bold; color: ${primaryColor}; direction: ltr; }
      .voucher-words { font-size: 12px; color: #333; margin-top: 2mm; }
      .voucher-signatures { display: flex; justify-content: space-around; margin-top: 8mm; }
      .signature-box { text-align: center; width: 35%; }
      .signature-line { border-top: 1px solid #000; padding-top: 2mm; font-size: 11px; color: #555; }
    `);
  },
};
