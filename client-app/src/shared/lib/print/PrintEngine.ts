/**
 * PrintEngine.ts — المنسق المركزي لعمليات الطباعة
 *
 * مبدأ التصميم: Open/Closed
 *   - PrintEngine مغلق للتعديل — لا يحتوي على أي if أو switch خاص بنوع المستند.
 *   - مفتوح للتوسعة — يكفي تسجيل Builder جديد عبر registerBuilder().
 *
 * الاستخدام الموحد:
 *   import { PrintEngine } from "@/shared/lib/print";
 *
 *   PrintEngine.buildAndPrint({ documentType: "sales_invoice",    data, templateConfig })
 *   PrintEngine.buildAndPrint({ documentType: "purchase_invoice", data, templateConfig })
 *   PrintEngine.buildAndPrint({ documentType: "receipt_voucher",  data, templateConfig })
 *   PrintEngine.buildAndPrint({ documentType: "product_label",    data })
 *   PrintEngine.buildAndPrint({ documentType: "trial_balance",    data })
 *
 * إضافة مستند جديد:
 *   1. أنشئ builders/MyDocBuilder.ts وسجّل registerBuilder("my_doc", MyDocBuilder)
 *   2. أضف import في index.ts
 *   — PrintEngine نفسه لا يُعدَّل أبداً.
 */
import type { PrintJob, PrintDocumentType, DocumentBuilder } from "./types";
import { PdfExporter } from "./PdfExporter";

/* ── Registry ──────────────────────────────────────────────────────────────── */
const _registry = new Map<PrintDocumentType, DocumentBuilder>();

/**
 * يُسجّل Builder لنوع مستند محدد.
 * يُستدعى مرة واحدة عند تحميل ملف الـ Builder (side-effect import).
 */
export function registerBuilder(
  docType: PrintDocumentType,
  builder: DocumentBuilder,
): void {
  _registry.set(docType, builder);
}

/* ── Engine ────────────────────────────────────────────────────────────────── */
export const PrintEngine = {
  /**
   * يبحث في الـ Registry عن الـ Builder المناسب ويستدعي buildHtml.
   * لا يوجد أي منطق خاص بنوع المستند هنا.
   */
  buildHtml(job: PrintJob): string {
    const builder = _registry.get(job.documentType);
    if (!builder) throw new Error(
      `[PrintEngine] No builder registered for "${job.documentType}". ` +
      `Import from "@/shared/lib/print" to ensure all builders are loaded.`,
    );
    return builder.buildHtml(job);
  },

  /**
   * يفتح نافذة جديدة ويطبع HTML فيها.
   * يُعيد true في حالة النجاح، false إذا حجب المتصفح النافذة المنبثقة.
   */
  print(html: string): boolean {
    return PdfExporter.print(html);
  },

  /**
   * يبني HTML ثم يطبعه مباشرةً — الطريقة الرئيسية لأي مستند.
   */
  buildAndPrint(job: PrintJob): boolean {
    const html = this.buildHtml(job);
    return this.print(html);
  },

  /**
   * يفتح معاينة في تبويب جديد بدون طباعة تلقائية.
   */
  preview(job: PrintJob): boolean {
    const html = this.buildHtml(job);
    return PdfExporter.preview(html);
  },

  /**
   * يُصدّر HTML كملف قابل للتحميل.
   */
  exportHtml(job: PrintJob, filename?: string): void {
    const html = this.buildHtml(job);
    PdfExporter.downloadHtml(html, filename ?? job.title ?? "document");
  },

  /**
   * يُعيد true إذا كان نوع المستند مسجلاً.
   */
  hasBuilder(docType: PrintDocumentType): boolean {
    return _registry.has(docType);
  },

  /**
   * يُعيد قائمة بجميع أنواع المستندات المسجلة.
   */
  getRegisteredTypes(): PrintDocumentType[] {
    return Array.from(_registry.keys());
  },
};
