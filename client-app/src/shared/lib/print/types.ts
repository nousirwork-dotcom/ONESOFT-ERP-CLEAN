/**
 * print/types.ts — أنواع محرك الطباعة المشتركة
 */
import type { InvDocTemplateConfig, InvPrintData } from "@/shared/lib/buildInvoiceHtml";

export type { InvDocTemplateConfig, InvPrintData };

export type PrintDocumentType =
  | "sales_invoice"
  | "purchase_invoice"
  | "sales_return"
  | "purchase_return"
  | "receipt_voucher"
  | "payment_voucher";

export interface PrintJob {
  documentType:    PrintDocumentType;
  data:            InvPrintData;
  templateConfig?: InvDocTemplateConfig | null;
  qrDataUrl?:      string;
  qrLabel?:        string;
  qrSize?:         number;
}

/**
 * واجهة يجب على كل Builder تنفيذها.
 * يُسجَّل كل Builder عبر registerBuilder() ويُستدعى تلقائياً من PrintEngine.
 */
export interface DocumentBuilder {
  buildHtml(job: PrintJob): string;
}
