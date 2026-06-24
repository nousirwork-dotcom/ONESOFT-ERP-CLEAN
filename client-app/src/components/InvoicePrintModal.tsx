/**
 * InvoicePrintModal.tsx — معاينة وطباعة الفاتورة الضريبية
 * يستخدم buildInvoiceHtml مباشرةً لضمان تطابق المعاينة مع الطباعة تماماً
 */
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Printer, X, FileText } from "lucide-react";
import { generateQrContent, type QrSettings, type QrInvoiceData } from "@/lib/qrUtils";
import { buildInvoiceHtml } from "@/lib/buildInvoiceHtml";
import type { InvDocTemplateConfig, InvPrintData } from "@/lib/buildInvoiceHtml";

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
}

/* ═══════════════════ Default Config ═══════════════════ */
const DEFAULT_CFG: DocTemplateConfig = {
  type:         "config_v1",
  language:     "bilingual",
  primaryColor: "#406B93",
  columns: {
    num: true, code: true, name: true, unit: false,
    qty: true, price: true, discount: true,
    taxable: true, taxRate: true, taxAmt: true, total: true,
  },
  minRows:  5,
  sections: {
    sellerInfo: true, customerInfo: true,
    amountInWords: true, pageNumber: true, signatures: false,
  },
};

/* ═══════════════════ Component ═══════════════════ */
export default function InvoicePrintModal({
  open, onClose, data, qrSettings, templateConfig,
}: InvoicePrintModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  const cfg   = templateConfig ?? DEFAULT_CFG;
  const color = cfg.primaryColor;

  const showQR  = !!(qrSettings?.isEnabled && qrSettings?.showOnSalesInvoice);
  const qrLabel = qrSettings?.countrySystem === "zatca" ? "ZATCA QR"
                : qrSettings?.countrySystem === "eta"   ? "ETA QR"
                : "QR Code";
  const qrSize  = qrSettings?.qrSize ?? 100;

  const qrContent = showQR
    ? generateQrContent(
        qrSettings!.countrySystem,
        {
          sellerName:      qrSettings?.sellerName || data.sellerName,
          taxNumber:       qrSettings?.taxNumber  || data.sellerTaxNumber,
          invoiceDateTime: `${data.invoiceDate}T${data.invoiceTime ?? "00:00:00"}`,
          totalAmount:     data.grandTotal,
          vatAmount:       data.taxTotal,
          invoiceNumber:   data.invoiceNumber,
          buyerName:       data.customerName,
          buyerTaxNumber:  data.customerTaxNumber,
        } as QrInvoiceData,
        qrSettings?.customFormat,
      )
    : "";

  /* ── توليد QR كصورة base64 ── */
  useEffect(() => {
    if (!showQR || !qrContent) { setQrDataUrl(""); return; }
    QRCode.toDataURL(qrContent, { width: qrSize * 2, margin: 1, errorCorrectionLevel: "M" })
      .then(url => setQrDataUrl(url))
      .catch(() => setQrDataUrl(""));
  }, [qrContent, qrSize, showQR]);

  /* ── HTML الفاتورة — نفس المخرج للمعاينة والطباعة ── */
  const invoiceHtml = useMemo(
    () => buildInvoiceHtml(data, cfg, showQR ? qrDataUrl : undefined, qrLabel, qrSize),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, cfg, qrDataUrl, showQR, qrLabel, qrSize],
  );

  /* ── طباعة / تصدير PDF ── */
  const handlePrint = () => {
    const win = window.open("", "_blank", "width=1040,height=1150");
    if (!win) return;
    win.document.write(invoiceHtml);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" dir="rtl">

      {/* ── شريط الأدوات ── */}
      <div
        className="flex items-center gap-3 px-6 py-3 shrink-0 shadow-md"
        style={{ background: color }}
      >
        <FileText className="w-5 h-5 text-white/80" />
        <span className="text-white font-bold text-base flex-1">
          معاينة الطباعة — فاتورة {data.invoiceNumber}
          {cfg.language === "bilingual" && (
            <span className="text-white/60 font-normal text-sm mr-2">| INV01 ثنائي اللغة</span>
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
      <div className="flex-1 overflow-y-auto bg-gray-300 flex items-start justify-center py-6">
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
