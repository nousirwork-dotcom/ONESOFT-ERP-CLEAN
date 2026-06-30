/**
 * print/index.ts — نقطة دخول موحّدة لمحرك الطباعة
 *
 * استورد من هنا دائماً:
 *   import { PrintEngine } from "@/shared/lib/print";
 *
 * هذا الملف يستورد كل الـ Builders ليُشغّل تسجيلها التلقائي
 * قبل أي استخدام لـ PrintEngine.buildHtml().
 *
 * إضافة Builder جديد:
 *   1. أنشئ builders/ReceiptBuilder.ts
 *   2. أضف: import "./builders/ReceiptBuilder";
 *   — لا تعديل على PrintEngine أو أي ملف آخر.
 */

/* ── تسجيل الـ Builders (side-effect imports) ── */
import "./builders/InvoiceBuilder";
// import "./builders/ReceiptBuilder";    // سند قبض — مستقبلاً
// import "./builders/VoucherBuilder";   // سند صرف — مستقبلاً
// import "./builders/PosReceiptBuilder"; // إيصال POS — مستقبلاً

/* ── Exports ── */
export { PrintEngine, registerBuilder } from "./PrintEngine";
export { TemplateEngine, DEFAULT_TEMPLATE_CONFIG } from "./TemplateEngine";
export type { PrintDocumentType, PrintJob, DocumentBuilder, InvDocTemplateConfig, InvPrintData } from "./types";
