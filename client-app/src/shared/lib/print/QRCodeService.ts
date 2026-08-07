/**
 * QRCodeService.ts — خدمة QR Code المركزية
 *
 * مصدر QR الوحيد في النظام.
 * يعتمد على مكتبة qrcode ويدعم ZATCA / ETA / Custom.
 */
import QRCode from "qrcode";
import {
  generateQrContent,
  type QrSystem,
  type QrSettings,
  type QrInvoiceData,
} from "@/shared/lib/qrUtils";

export type { QrSystem, QrSettings, QrInvoiceData };

export const QRCodeService = {
  /**
   * يُنشئ QR كـ Data URL (base64 PNG) — يُستخدم في المعاينة والطباعة.
   */
  async generateDataUrl(content: string, size = 100): Promise<string> {
    if (!content) return "";
    try {
      return await QRCode.toDataURL(content, {
        width: size * 2,
        margin: 1,
        errorCorrectionLevel: "M",
      });
    } catch {
      return "";
    }
  },

  /**
   * يُنشئ QR كـ SVG string — أسرع ولا يحتاج promise.
   */
  async generateSvg(content: string, size = 100): Promise<string> {
    if (!content) return "";
    try {
      return await QRCode.toString(content, {
        type: "svg",
        width: size,
        margin: 1,
        errorCorrectionLevel: "M",
      });
    } catch {
      return "";
    }
  },

  /**
   * يُنشئ محتوى QR من إعدادات الفاتورة ونوع النظام.
   */
  buildContent(
    system: QrSystem,
    invoiceData: QrInvoiceData,
    customFormat?: string,
  ): string {
    return generateQrContent(system, invoiceData, customFormat);
  },

  /**
   * يُنشئ QR كامل من إعدادات النظام وبيانات الفاتورة.
   * يُعيد { dataUrl, content } لإعادة الاستخدام.
   */
  async resolveForInvoice(
    settings: QrSettings | null | undefined,
    invoiceData: QrInvoiceData,
    docType:
      | "sales_invoice"
      | "pos_invoice"
      | "sales_return"
      | "credit_note"
      | "debit_note"
      | "purchase_invoice"
      | "purchase_order"
      | "purchase_return"
      | "receipt_voucher" = "sales_invoice",
    phase2Snapshot?: string | null,
    phase2Invoice = false,
  ): Promise<{ dataUrl: string; content: string; label: string; size: number; show: boolean }> {
    if (!settings?.isEnabled) {
      return { dataUrl: "", content: "", label: "", size: 100, show: false };
    }

    const show =
      docType === "purchase_invoice" ||
      docType === "purchase_order" ||
      docType === "purchase_return"
        ? !!settings.showOnPurchaseInvoice
        : docType === "receipt_voucher"
          ? !!settings.showOnReceiptVoucher
          : !!settings.showOnSalesInvoice;

    if (!show) return { dataUrl: "", content: "", label: "", size: 100, show: false };

    const label =
      settings.countrySystem === "zatca" ? "ZATCA QR" :
      settings.countrySystem === "eta"   ? "ETA QR"   : "QR Code";

    if (settings.countrySystem === "zatca" && phase2Invoice && !phase2Snapshot?.trim()) {
      // A linked Phase 2 invoice must not silently print a legacy Tags 1–5 QR.
      return { dataUrl: "", content: "", label, size: 100, show: false };
    }

    // For a Phase 2 ZATCA invoice the signed XML snapshot is authoritative.
    // Never rebuild it from current company/invoice settings.
    const content = settings.countrySystem === "zatca" && phase2Snapshot?.trim()
      ? phase2Snapshot.trim()
      : generateQrContent(
          settings.countrySystem,
          invoiceData,
          settings.customFormat,
        );

    // الحجم النهائي يحدده قالب الطباعة؛ هذا الحجم الداخلي ثابت للتوليد فقط.
    const size    = 100;
    const dataUrl = await QRCodeService.generateDataUrl(content, size);

    return { dataUrl, content, label, size, show: true };
  },
};
