/**
 * InvoiceBuilder.ts — بناء HTML الفواتير (مبيعات، مشتريات، مردودات)
 *
 * يُسجّل نفسه تلقائياً عند استيراد هذا الملف (side-effect import).
 * لإضافة نوع فاتورة جديد: أضف سطر registerBuilder("...", InvoiceBuilder).
 */
import { buildInvoiceHtml } from "@/shared/lib/buildInvoiceHtml";
import { DEFAULT_TEMPLATE_CONFIG } from "@/shared/lib/print/TemplateEngine";
import { registerBuilder } from "@/shared/lib/print/PrintEngine";
import type { DocumentBuilder, PrintJob } from "@/shared/lib/print/types";

const InvoiceBuilder: DocumentBuilder = {
  buildHtml(job: PrintJob): string {
    const cfg = job.templateConfig ?? DEFAULT_TEMPLATE_CONFIG;
    return buildInvoiceHtml(job.data, cfg, job.qrDataUrl, job.qrLabel, job.qrSize);
  },
};

registerBuilder("sales_invoice",    InvoiceBuilder);
registerBuilder("purchase_invoice", InvoiceBuilder);
registerBuilder("sales_return",     InvoiceBuilder);
registerBuilder("purchase_return",  InvoiceBuilder);
