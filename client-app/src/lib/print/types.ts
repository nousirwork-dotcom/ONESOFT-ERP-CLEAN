/**
 * print/types.ts — أنواع محرك الطباعة المشتركة
 */
import type { InvDocTemplateConfig, InvPrintData } from "@/lib/buildInvoiceHtml";

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
