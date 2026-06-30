/**
 * ReceiptBuilder.ts — بناء HTML سندات القبض والصرف
 *
 * يُسجّل نفسه تلقائياً لنوعي:
 *   - receipt_voucher (سند قبض)
 *   - payment_voucher (سند صرف)
 *
 * لإضافة نوع سند جديد: registerBuilder("journal_voucher", ReceiptBuilder)
 */
import { registerBuilder }       from "@/shared/lib/print/PrintEngine";
import { CssEngine }             from "@/shared/lib/print/CssEngine";
import { HtmlRenderer }          from "@/shared/lib/print/HtmlRenderer";
import type { DocumentBuilder, PrintJob, VoucherPrintData } from "@/shared/lib/print/types";

const ReceiptBuilder: DocumentBuilder = {
  buildHtml(job: PrintJob): string {
    const data    = job.data as VoucherPrintData;
    const isReceipt = data.voucherType === "receipt";
    const color   = "#406B93";
    const title   = isReceipt
      ? `سند قبض — ${data.voucherNumber}`
      : `سند صرف — ${data.voucherNumber}`;

    const css  = CssEngine.buildVoucherCss(color);
    const body = buildVoucherBody(data, isReceipt, color);

    return HtmlRenderer.buildPage(body, { title, css, dir: "rtl", lang: "ar", bodyClass: "" });
  },
};

function buildVoucherBody(data: VoucherPrintData, isReceipt: boolean, color: string): string {
  const typeAr = isReceipt ? "سند قبض" : "سند صرف";
  const typeEn = isReceipt ? "RECEIPT VOUCHER" : "PAYMENT VOUCHER";

  const entityLabel = isReceipt ? "استلمنا من" : "صرفنا لـ";
  const entityLabelEn = isReceipt ? "Received From" : "Paid To";

  const amountFormatted = Number(data.amount ?? 0).toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const currency = data.currency ?? "ر.س";

  const qrImg = job_qr_placeholder();

  return `
<div class="voucher-box">

  <!-- الرأس -->
  <div class="voucher-header">
    ${data.sellerName ? `<div style="font-size:15px;font-weight:bold;color:${color};margin-bottom:4px">${data.sellerName}</div>` : ""}
    ${data.sellerTaxNumber ? `<div style="font-size:11px;color:#666">ر.ض: ${data.sellerTaxNumber}</div>` : ""}
    <div class="voucher-title">${typeAr}</div>
    <div style="font-size:13px;color:#888;letter-spacing:1px">${typeEn}</div>
    <div class="voucher-number" style="margin-top:4px">رقم: ${data.voucherNumber} | التاريخ: ${data.voucherDate}</div>
  </div>

  <!-- المبلغ -->
  <div class="voucher-amount-box">
    <div style="font-size:12px;color:#555;margin-bottom:2px">${entityLabel} / ${entityLabelEn}</div>
    <div style="font-size:15px;font-weight:bold">${data.entityName}</div>
    <div class="voucher-amount">${amountFormatted} ${currency}</div>
    ${data.amountInWords ? `<div class="voucher-words">فقط: ${data.amountInWords}</div>` : ""}
  </div>

  <!-- تفاصيل -->
  <div style="margin-top:4mm">
    ${data.paymentMethod ? `
    <div class="voucher-field">
      <span class="voucher-label">طريقة الدفع / Payment Method</span>
      <span class="voucher-value">${data.paymentMethod}</span>
    </div>` : ""}
    ${data.reference ? `
    <div class="voucher-field">
      <span class="voucher-label">المرجع / Reference</span>
      <span class="voucher-value">${data.reference}</span>
    </div>` : ""}
    ${data.description ? `
    <div class="voucher-field">
      <span class="voucher-label">البيان / Description</span>
      <span class="voucher-value">${data.description}</span>
    </div>` : ""}
  </div>

  <!-- التوقيعات -->
  <div class="voucher-signatures">
    <div class="signature-box">
      <div class="signature-line">${data.preparedBy ?? "المحاسب / Accountant"}</div>
    </div>
    <div class="signature-box">
      <div class="signature-line">${data.approvedBy ?? "المدير / Manager"}</div>
    </div>
    <div class="signature-box">
      <div class="signature-line">المستلم / Recipient</div>
    </div>
  </div>

</div>`;

  function job_qr_placeholder() { return ""; }
}

registerBuilder("receipt_voucher", ReceiptBuilder);
registerBuilder("payment_voucher", ReceiptBuilder);
