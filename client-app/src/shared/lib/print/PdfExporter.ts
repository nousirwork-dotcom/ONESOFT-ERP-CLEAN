/**
 * PdfExporter.ts — مُصدِّر PDF المركزي
 *
 * يفتح نافذة طباعة مع تفعيل حوار PDF تلقائياً.
 * لا يعتمد على مكتبات خارجية — يستخدم print API المتاح في المتصفح.
 *
 * لاستخدام PDF حقيقي (بدون حوار الطباعة) في المستقبل:
 *   استبدل buildAndSave() بمكتبة jsPDF أو html2pdf.
 */

export interface PdfExportOptions {
  filename?: string;
  autoClose?: boolean;
  delayMs?: number;
}

export const PdfExporter = {
  /**
   * يفتح HTML في نافذة جديدة ويُشغّل حوار الطباعة (يدعم "حفظ كـ PDF").
   * @returns true إذا نجحت العملية، false إذا حجب المتصفح النافذة
   */
  print(html: string, opts: PdfExportOptions = {}): boolean {
    const { autoClose = true, delayMs = 600 } = opts;

    const win = window.open("", "_blank", "width=1040,height=1150");
    if (!win) return false;

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();

    setTimeout(() => {
      win.print();
      if (autoClose) setTimeout(() => win.close(), 300);
    }, delayMs);

    return true;
  },

  /**
   * يفتح HTML في تبويب جديد للمعاينة فقط (بدون طباعة تلقائية).
   */
  preview(html: string): boolean {
    const win = window.open("", "_blank");
    if (!win) return false;

    win.document.open();
    win.document.write(html);
    win.document.close();
    return true;
  },

  /**
   * يُنشئ رابط تحميل HTML كملف.
   * @param html     محتوى HTML
   * @param filename اسم الملف (بدون امتداد)
   */
  downloadHtml(html: string, filename = "document"): void {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${filename}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
