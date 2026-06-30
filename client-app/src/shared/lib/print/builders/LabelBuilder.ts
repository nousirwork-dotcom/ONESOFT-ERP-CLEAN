/**
 * LabelBuilder.ts — بناء HTML ملصقات المنتجات (باركود + QR)
 *
 * يُسجّل نفسه لنوع:
 *   - product_label (ملصق منتج)
 *
 * يدعم:
 *   - باركود Code128 عبر BarcodeService
 *   - QR Code عبر data URL مُمرَّر في PrintJob.qrDataUrl
 *   - طباعة عدة نسخ (count) في صفحة واحدة
 */
import { registerBuilder }  from "@/shared/lib/print/PrintEngine";
import { CssEngine }        from "@/shared/lib/print/CssEngine";
import { HtmlRenderer }     from "@/shared/lib/print/HtmlRenderer";
import { BarcodeService }   from "@/shared/lib/print/BarcodeService";
import type { DocumentBuilder, PrintJob, LabelPrintData } from "@/shared/lib/print/types";

const LabelBuilder: DocumentBuilder = {
  buildHtml(job: PrintJob): string {
    const data  = job.data as LabelPrintData;
    const count = data.count ?? 1;
    const css   = CssEngine.buildLabelCss("thermal80");
    const body  = Array.from({ length: count }, () => buildLabelCard(data, job.qrDataUrl)).join("");

    return HtmlRenderer.buildPage(body, {
      title:     data.productName,
      css,
      dir:       "rtl",
      lang:      "ar",
      bodyClass: "",
    });
  },
};

function buildLabelCard(data: LabelPrintData, qrDataUrl?: string): string {
  const barcodeHtml = data.barcode
    ? `<div class="label-barcode">
         ${BarcodeService.generateSvg(data.barcode, { height: 40, barWidth: 1.5, showText: true, textSize: 9 })}
       </div>`
    : "";

  const qrHtml = qrDataUrl
    ? `<div style="text-align:center;margin:2mm 0">
         <img src="${qrDataUrl}" width="60" height="60" alt="QR"/>
       </div>`
    : "";

  const price = data.price !== undefined
    ? `<div class="label-price">
         ${Number(data.price).toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
         <small>${data.currency ?? "ر.س"}</small>
       </div>`
    : "";

  const unit = data.unit
    ? `<div class="label-sku">الوحدة: ${data.unit}</div>`
    : "";

  const expiry = data.expiryDate
    ? `<div class="label-sku">ص: ${data.expiryDate}</div>`
    : "";

  const sku = data.sku
    ? `<div class="label-sku">الكود: ${data.sku}</div>`
    : "";

  return `
<div class="label-card">
  <div class="label-name">${data.productName}</div>
  ${data.productNameEn ? `<div class="label-sku" style="direction:ltr;text-align:center">${data.productNameEn}</div>` : ""}
  ${barcodeHtml}
  ${qrHtml}
  ${price}
  ${unit}
  ${sku}
  ${expiry}
</div>`;
}

registerBuilder("product_label", LabelBuilder);
