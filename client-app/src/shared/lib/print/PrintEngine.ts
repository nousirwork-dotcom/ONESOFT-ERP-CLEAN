/**
 * PrintEngine.ts — المنسق المركزي لعمليات الطباعة
 *
 * مبدأ التصميم: Open/Closed
 *   - PrintEngine مغلق للتعديل — لا يحتوي على أي if أو switch خاص بنوع المستند.
 *   - مفتوح للتوسعة — يكفي تسجيل Builder جديد عبر registerBuilder().
 *
 * الاستخدام:
 *   PrintEngine.buildAndPrint({ documentType: "sales_invoice",    data, templateConfig })
 *   PrintEngine.buildAndPrint({ documentType: "purchase_invoice", data, templateConfig })
 *   PrintEngine.buildAndPrint({ documentType: "receipt_voucher",  data, templateConfig })
 *
 * إضافة مستند جديد:
 *   1. أنشئ builders/ReceiptBuilder.ts وسجّل registerBuilder("receipt_voucher", ...)
 *   2. أضف import في index.ts
 *   — PrintEngine نفسه لا يُعدَّل أبداً.
 */
import type { PrintJob, PrintDocumentType, DocumentBuilder } from "./types";

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
    const win = window.open("", "_blank", "width=1040,height=1150");
    if (!win) return false;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
    return true;
  },

  /**
   * يبني HTML ثم يطبعه مباشرةً — الطريقة الرئيسية لأي مستند.
   */
  buildAndPrint(job: PrintJob): boolean {
    return this.print(this.buildHtml(job));
  },
};
