/**
 * print/index.ts — نقطة دخول موحّدة لمحرك الطباعة
 *
 * استورد من هنا دائماً:
 *   import { PrintEngine } from "@/shared/lib/print";
 *
 * هذا الملف يستورد كل الـ Builders ليُشغّل تسجيلها التلقائي
 * قبل أي استخدام لـ PrintEngine.buildHtml().
 *
 * ══════════════════════════════════════════════════
 * إضافة Builder جديد:
 *   1. أنشئ builders/MyDocBuilder.ts
 *   2. نفّذ DocumentBuilder interface
 *   3. سجّل: registerBuilder("my_doc_type", MyDocBuilder)
 *   4. أضف سطر import هنا فقط
 *   — لا تعديل على PrintEngine أو أي ملف آخر.
 * ══════════════════════════════════════════════════
 */

/* ── تسجيل الـ Builders (side-effect imports) ─────────────────────────────── */
import "./builders/InvoiceBuilder";   // sales_invoice | purchase_invoice | sales_return | purchase_return
import "./builders/ReceiptBuilder";   // receipt_voucher | payment_voucher
import "./builders/ReportBuilder";    // statement | trial_balance | ledger_report | stock_report
import "./builders/LabelBuilder";     // product_label

/* ── Core Engine ──────────────────────────────────────────────────────────── */
export { PrintEngine, registerBuilder }  from "./PrintEngine";
export { PreviewEngine }                 from "./PreviewEngine";

/* ── Services ─────────────────────────────────────────────────────────────── */
export { TemplateEngine, DEFAULT_TEMPLATE_CONFIG } from "./TemplateEngine";
export { QRCodeService }                 from "./QRCodeService";
export { BarcodeService }                from "./BarcodeService";
export { CssEngine }                     from "./CssEngine";
export { HtmlRenderer }                  from "./HtmlRenderer";
export { PdfExporter }                   from "./PdfExporter";
export { PrinterService, DEFAULT_PRINTER_CONFIG } from "./PrinterService";

/* ── Types ────────────────────────────────────────────────────────────────── */
export type {
  PrintDocumentType,
  PrintJob,
  DocumentBuilder,
  PrinterConfig,
  InvDocTemplateConfig,
  InvPrintData,
  VoucherPrintData,
  ReportPrintData,
  ReportColumn,
  ReportRow,
  LabelPrintData,
} from "./types";
