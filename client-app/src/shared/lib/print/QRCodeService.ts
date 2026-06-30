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
    docType: "sales_invoice" | "purchase_invoice" | "receipt_voucher" = "sales_invoice",
  ): Promise<{ dataUrl: string; content: string; label: string; size: number; show: boolean }> {
    if (!settings?.isEnabled) {
      return { dataUrl: "", content: "", label: "", size: 100, show: false };
    }

    const show =
      docType === "purchase_invoice"
        ? !!settings.showOnPurchaseInvoice
        : docType === "receipt_voucher"
          ? !!settings.showOnReceiptVoucher
          : !!settings.showOnSalesInvoice;

    if (!show) return { dataUrl: "", content: "", label: "", size: settings.qrSize ?? 100, show: false };

    const label =
      settings.countrySystem === "zatca" ? "ZATCA QR" :
      settings.countrySystem === "eta"   ? "ETA QR"   : "QR Code";

    const content = generateQrContent(
      settings.countrySystem,
      invoiceData,
      settings.customFormat,
    );

    const size    = settings.qrSize ?? 100;
    const dataUrl = await QRCodeService.generateDataUrl(content, size);

    return { dataUrl, content, label, size, show: true };
  },
};
