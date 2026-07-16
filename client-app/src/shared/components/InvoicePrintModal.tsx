/**
 * InvoicePrintModal.tsx — معاينة وطباعة الفاتورة الضريبية
 *
 * يستخدم PrintEngine + QRCodeService من "@/shared/lib/print"
 * ليكون متوافقاً مع نظام الطباعة الموحد.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/core/ui/button";
import { Printer, X, FileText } from "lucide-react";
import { buildInvoiceHtml } from "@/shared/lib/buildInvoiceHtml";
import {
  PrintEngine,
  QRCodeService,
  DEFAULT_TEMPLATE_CONFIG,
} from "@/shared/lib/print";
import type { InvDocTemplateConfig, InvPrintData } from "@/shared/lib/print";
import type { QrSettings, QrInvoiceData } from "@/shared/lib/qrUtils";

/* ═══════════════════ Re-exported Types (backward compat) ═══════════════════ */
export type DocTemplateConfig = InvDocTemplateConfig;
export type PrintInvoiceData  = InvPrintData;

/* ═══════════════════ Props ═══════════════════ */
interface InvoicePrintModalProps {
  open:            boolean;
  onClose:         () => void;
  data:            PrintInvoiceData;
  qrSettings?:     QrSettings | null;
  templateConfig?: DocTemplateConfig | null;
  docType?:        "sales_invoice" | "purchase_invoice" | "purchase_order" | "purchase_return";
}

/* ═══════════════════ Component ═══════════════════ */
export default function InvoicePrintModal({
  open, onClose, data, qrSettings, templateConfig, docType = "sales_invoice",
}: InvoicePrintModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  const cfg   = templateConfig ?? DEFAULT_TEMPLATE_CONFIG;
  const color = cfg.primaryColor;

  /* ── حل QR عبر QRCodeService ── */
  useEffect(() => {
    if (!open) return;

    const invoiceData: QrInvoiceData = {
      sellerName:      qrSettings?.sellerName || data.sellerName,
      taxNumber:       qrSettings?.taxNumber  || data.sellerTaxNumber || "",
      invoiceDateTime: `${data.invoiceDate}T${data.invoiceTime ?? "00:00:00"}`,
      totalAmount:     data.grandTotal,
      vatAmount:       data.taxTotal,
      invoiceNumber:   data.invoiceNumber,
      buyerName:       data.customerName,
      buyerTaxNumber:  data.customerTaxNumber,
    };

    QRCodeService.resolveForInvoice(qrSettings, invoiceData, docType)
      .then(result => setQrDataUrl(result.dataUrl))
      .catch(() => setQrDataUrl(""));
  }, [open, data, qrSettings, docType]);

  /* ── HTML الفاتورة — نفس المخرج للمعاينة والطباعة ── */
  const invoiceHtml = useMemo(() => {
    const isPurchaseDoc = docType === "purchase_invoice" || docType === "purchase_order" || docType === "purchase_return";
    const showQR = !!(qrSettings?.isEnabled && qrDataUrl && (
      isPurchaseDoc
        ? qrSettings?.showOnPurchaseInvoice
        : qrSettings?.showOnSalesInvoice
    ));
    const qrLabel = qrSettings?.countrySystem === "zatca" ? "ZATCA QR"
                  : qrSettings?.countrySystem === "eta"   ? "ETA QR"  : "QR Code";
    const qrSize  = qrSettings?.qrSize ?? 100;

    return buildInvoiceHtml(data, cfg, showQR ? qrDataUrl : undefined, qrLabel, qrSize, docType);
  }, [data, cfg, qrDataUrl, qrSettings, docType]);

  /* ── طباعة / تصدير PDF عبر PrintEngine ── */
  const handlePrint = () => { PrintEngine.print(invoiceHtml); };

  if (!open) return null;

  const docLabel = docType === "purchase_invoice" ? "فاتورة مشتريات"
                 : docType === "purchase_order"   ? "أمر شراء"
                 : docType === "purchase_return"  ? "مردود مشتريات"
                 : "فاتورة";

  return (
    <div className="fixed inset-0 z-50 flex flex-col" dir="rtl">

      {/* ── شريط الأدوات ── */}
      <div
        className="flex items-center gap-3 px-6 py-3 shrink-0 shadow-md"
        style={{ background: color }}
      >
        <FileText className="w-5 h-5 text-white/80" />
        <span className="text-white font-bold text-base flex-1">
          معاينة الطباعة — {docLabel} {data.invoiceNumber}
          {cfg.language === "bilingual" && (
            <span className="text-white/60 font-normal text-sm mr-2">
              | {docType === "purchase_invoice" ? "PINV01"
                : docType === "purchase_order"  ? "POD01"
                : docType === "purchase_return" ? "PRN01"
                : "INV01"} ثنائي اللغة
            </span>
          )}
        </span>
        <Button
          size="sm"
          onClick={handlePrint}
          className="bg-white hover:bg-gray-100 h-8 px-4 text-sm font-bold gap-1"
          style={{ color }}
        >
          <Printer className="w-4 h-4" />طباعة / PDF
        </Button>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── معاينة — iframe مطابق لمخرج الطباعة ── */}
      <div className="flex-1 overflow-y-auto bg-background flex items-start justify-center py-6">
        <iframe
          key={qrDataUrl}
          srcDoc={invoiceHtml}
          className="bg-white shadow-2xl"
          style={{
            width:     1020,
            minHeight: 1300,
            border:    "none",
            boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
          }}
          title="معاينة الفاتورة"
        />
      </div>

    </div>
  );
}
