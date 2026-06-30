/**
 * PreviewEngine.ts — محرك المعاينة المركزي
 *
 * يُوفر واجهة موحدة لعرض أي مستند في معاينة داخل الصفحة أو نافذة خارجية.
 * يُستخدم من InvoicePrintModal وأي مكوّن معاينة آخر.
 */
import { PrintEngine } from "./PrintEngine";
import { PdfExporter } from "./PdfExporter";
import type { PrintJob } from "./types";

export interface PreviewState {
  html:      string;
  isReady:   boolean;
  error?:    string;
}

export const PreviewEngine = {
  /**
   * يبني HTML جاهز للمعاينة من PrintJob.
   * يُعيد HTML string أو يرمي خطأ إذا لم يوجد Builder.
   */
  buildPreviewHtml(job: PrintJob): PreviewState {
    try {
      const html = PrintEngine.buildHtml(job);
      return { html, isReady: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { html: "", isReady: false, error };
    }
  },

  /**
   * يفتح معاينة في نافذة / تبويب خارجي.
   */
  openInWindow(job: PrintJob): boolean {
    const { html, isReady } = this.buildPreviewHtml(job);
    if (!isReady) return false;
    return PdfExporter.preview(html);
  },

  /**
   * يطبع مباشرةً من PrintJob.
   */
  printJob(job: PrintJob): boolean {
    const { html, isReady } = this.buildPreviewHtml(job);
    if (!isReady) return false;
    return PdfExporter.print(html);
  },

  /**
   * يُصدّر HTML من PrintJob كملف قابل للتحميل.
   */
  exportHtml(job: PrintJob, filename?: string): void {
    const { html, isReady } = this.buildPreviewHtml(job);
    if (!isReady) return;
    PdfExporter.downloadHtml(html, filename ?? job.title ?? "document");
  },
};
