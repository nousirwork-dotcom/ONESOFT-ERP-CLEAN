/**
 * PrintEngine.ts — المنسق المركزي لعمليات الطباعة
 *
 * الاستخدام الآن:
 *   PrintEngine.buildAndPrint({ documentType: "sales_invoice", data, templateConfig, ... })
 *
 * الاستخدام المستقبلي:
 *   PrintEngine.buildAndPrint({ documentType: "purchase_invoice", ... })
 *   PrintEngine.buildAndPrint({ documentType: "receipt_voucher",  ... })
 */
import { buildInvoiceHtml } from "@/lib/buildInvoiceHtml";
import { DEFAULT_TEMPLATE_CONFIG } from "./TemplateEngine";
import type { PrintJob, PrintDocumentType } from "./types";

const INVOICE_BUILDER_TYPES: PrintDocumentType[] = [
  "sales_invoice",
  "purchase_invoice",
  "sales_return",
  "purchase_return",
];

export const PrintEngine = {
  /**
   * يبني HTML المستند بناءً على نوعه ويوجّه إلى الـ builder المناسب.
   */
  buildHtml(job: PrintJob): string {
    const { documentType, data, templateConfig, qrDataUrl, qrLabel, qrSize } = job;
    const cfg = templateConfig ?? DEFAULT_TEMPLATE_CONFIG;

    if (INVOICE_BUILDER_TYPES.includes(documentType)) {
      return buildInvoiceHtml(data, cfg, qrDataUrl, qrLabel, qrSize);
    }

    return buildInvoiceHtml(data, cfg, qrDataUrl, qrLabel, qrSize);
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
