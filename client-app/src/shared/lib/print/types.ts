/**
 * print/types.ts — أنواع محرك الطباعة الموحد
 */
import type { InvDocTemplateConfig, InvPrintData } from "@/shared/lib/buildInvoiceHtml";

export type { InvDocTemplateConfig, InvPrintData };

/* ── أنواع المستندات المدعومة ──────────────────────────────────────────────── */
export type PrintDocumentType =
  | "sales_invoice"
  | "purchase_invoice"
  | "sales_return"
  | "credit_note"
  | "debit_note"
  | "purchase_return"
  | "receipt_voucher"
  | "payment_voucher"
  | "journal_entry"
  | "statement"
  | "trial_balance"
  | "ledger_report"
  | "product_label"
  | "stock_report";

/* ── بيانات سند القبض / الصرف ─────────────────────────────────────────────── */
export interface VoucherPrintData {
  voucherNumber:  string;
  voucherDate:    string;
  voucherType:    "receipt" | "payment";
  entityName:     string;
  entityType?:    "customer" | "supplier" | "other";
  amount:         number;
  amountInWords?: string;
  paymentMethod?: string;
  reference?:     string;
  description?:   string;
  preparedBy?:    string;
  approvedBy?:    string;
  sellerName?:    string;
  sellerTaxNumber?: string;
  currency?:      string;
}

/* ── بيانات التقرير المحاسبي ──────────────────────────────────────────────── */
export interface ReportPrintData {
  title:          string;
  subtitle?:      string;
  dateFrom?:      string;
  dateTo?:        string;
  currency?:      string;
  columns:        ReportColumn[];
  rows:           ReportRow[];
  totals?:        Record<string, number | string>;
  companyName?:   string;
  generatedAt?:   string;
}

export interface ReportColumn {
  key:       string;
  label:     string;
  labelEn?:  string;
  align?:    "right" | "left" | "center";
  type?:     "text" | "number" | "date" | "currency";
}

export interface ReportRow {
  [key: string]: string | number | boolean | undefined;
  _bold?:  boolean;
  _indent?: number;
  _type?:  "header" | "data" | "subtotal" | "total";
}

/* ── بيانات ملصق المنتج ───────────────────────────────────────────────────── */
export interface LabelPrintData {
  productName:   string;
  productNameEn?: string;
  barcode?:      string;
  sku?:          string;
  price?:        number;
  currency?:     string;
  unit?:         string;
  expiryDate?:   string;
  qrContent?:    string;
  count?:        number;
}

/* ── إعدادات الطابعة ─────────────────────────────────────────────────────── */
export interface PrinterConfig {
  paperSize:   "A4" | "A5" | "thermal80" | "thermal57";
  orientation: "portrait" | "landscape";
  margins:     { top: number; right: number; bottom: number; left: number };
  scale?:      number;
}

/* ── وظيفة الطباعة ───────────────────────────────────────────────────────── */
export interface PrintJob {
  documentType:    PrintDocumentType;
  data:            InvPrintData | VoucherPrintData | ReportPrintData | LabelPrintData;
  templateConfig?: InvDocTemplateConfig | null;
  qrDataUrl?:      string;
  qrLabel?:        string;
  qrSize?:         number;
  printerConfig?:  PrinterConfig;
  title?:          string;
}

/* ── واجهة الـ Builder ───────────────────────────────────────────────────── */
export interface DocumentBuilder {
  buildHtml(job: PrintJob): string;
}
