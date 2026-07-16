/**
 * POSReceiptModal.tsx — إيصال نقاط البيع الحراري
 * يدعم طابعات 80mm و 58mm — ZATCA / ETA QR
 */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/core/ui/button";
import { Printer, X, Receipt } from "lucide-react";
import { generateQrContent, type QrSettings, type QrInvoiceData } from "@/shared/lib/qrUtils";

/* ══════════════════════════════════════════════════════════
   Types
══════════════════════════════════════════════════════════ */
export type PosTemplateConfig = {
  type: "pos_config_v1";
  paperWidth: "80mm" | "58mm";
  primaryColor: string;
  taxPct: number;
  taxInclusive: boolean;
  show: {
    logo: boolean;
    taxNumber: boolean;
    commercialReg: boolean;
    address: boolean;
    phone: boolean;
    customerName: boolean;
    cashierName: boolean;
    itemCode: boolean;
    discount: boolean;
    prices: boolean;
    branchName: boolean;
    qr: boolean;
    amountInWords: boolean;
    thankYou: boolean;
    paymentMethod: boolean;
    changeAmount: boolean;
  };
  printMode: "detailed" | "compact";
  thankYouMsg: string;
  copies: 1 | 2;
};

export interface POSReceiptData {
  invoiceNumber: string | number;
  invoiceDate: string;
  invoiceTime: string;
  cashierName?: string;
  branchName?: string;
  customerName?: string;
  paymentMethod?: string;
  lines: {
    productCode?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }[];
  subtotal: number;      // مجموع الأصناف (بعد الخصم الجزئي)
  discountTotal: number; // الخصم الكلي
  grandTotal: number;    // الإجمالي النهائي
  paidAmount: number;
  changeAmount: number;
  sellerName: string;
  sellerTaxNumber?: string;
  sellerCommercialReg?: string;
  sellerAddress?: string;
  sellerPhone?: string;
  currency?: string;
}

interface POSReceiptModalProps {
  open: boolean;
  onClose: () => void;
  data: POSReceiptData;
  qrSettings?: QrSettings | null;
  templateConfig?: PosTemplateConfig | null;
}

/* ══════════════════════════════════════════════════════════
   Defaults
══════════════════════════════════════════════════════════ */
export const DEFAULT_POS_CFG: PosTemplateConfig = {
  type: "pos_config_v1",
  paperWidth: "80mm",
  primaryColor: "#406B93",
  taxPct: 15,
  taxInclusive: true,
  show: {
    logo: false, taxNumber: true, commercialReg: true,
    address: true, phone: true, customerName: false,
    cashierName: true, itemCode: false, discount: true,
    prices: true, branchName: true, qr: true,
    amountInWords: false, thankYou: true,
    paymentMethod: true, changeAmount: true,
  },
  printMode: "detailed",
  thankYouMsg: "شكراً لتسوقكم معنا 🌟",
  copies: 1,
};

/* ══════════════════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════════════════ */
const payMethodLabel = (m?: string) => {
  const map: Record<string, string> = {
    cash: "نقداً", card: "بطاقة", transfer: "تحويل بنكي", credit: "آجل",
  };
  return m ? (map[m] ?? m) : "—";
};

const fmt2 = (n: number) => n.toFixed(2);

function calcTax(grandTotal: number, taxPct: number, inclusive: boolean) {
  if (taxPct <= 0) return { taxTotal: 0, netBeforeTax: grandTotal };
  if (inclusive) {
    const taxTotal = grandTotal * taxPct / (100 + taxPct);
    return { taxTotal, netBeforeTax: grandTotal - taxTotal };
  }
  const taxTotal = grandTotal * taxPct / 100;
  return { taxTotal, netBeforeTax: grandTotal };
}

/* ══════════════════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════════════════ */
export default function POSReceiptModal({ open, onClose, data, qrSettings, templateConfig }: POSReceiptModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  const cfg  = templateConfig ?? DEFAULT_POS_CFG;
  const show = cfg.show;
  const color = cfg.primaryColor;
  const isCompact = cfg.printMode === "compact";
  const paperPx = cfg.paperWidth === "80mm" ? 295 : 210;
  const { taxTotal, netBeforeTax } = calcTax(data.grandTotal, cfg.taxPct, cfg.taxInclusive);

  const showQR  = !!(show.qr && qrSettings?.isEnabled && qrSettings?.showOnSalesInvoice);
  const qrLabel = qrSettings?.countrySystem === "zatca" ? "ZATCA QR" : qrSettings?.countrySystem === "eta" ? "ETA QR" : "QR";
  const qrSize  = 90;

  const qrContent = showQR
    ? generateQrContent(qrSettings!.countrySystem, {
        sellerName: qrSettings?.sellerName || data.sellerName,
        taxNumber:  qrSettings?.taxNumber  || data.sellerTaxNumber,
        invoiceDateTime: `${data.invoiceDate}T${data.invoiceTime ?? "00:00:00"}`,
        totalAmount: data.grandTotal, vatAmount: taxTotal,
        invoiceNumber: String(data.invoiceNumber),
      } as QrInvoiceData, qrSettings?.customFormat)
    : "";

  useEffect(() => {
    if (!showQR || !qrContent) { setQrDataUrl(""); return; }
    QRCode.toDataURL(qrContent, { width: qrSize * 2, margin: 1, errorCorrectionLevel: "M" })
      .then(url => setQrDataUrl(url)).catch(() => setQrDataUrl(""));
  }, [qrContent, showQR]);

  /* ════════════════ buildPrintHtml ════════════════ */
  const buildPrintHtml = () => {
    const w = cfg.paperWidth === "80mm" ? "76mm" : "54mm";
    const fs = cfg.paperWidth === "80mm" ? 11 : 10;

    const dash = (ch = "─") => `<div style="text-align:center;color:#999;font-size:9px;letter-spacing:-1px;margin:3px 0">${ch.repeat(cfg.paperWidth === "80mm" ? 38 : 28)}</div>`;
    const row  = (l: string, r: string, bold = false) =>
      `<div style="display:flex;justify-content:space-between;${bold ? "font-weight:bold;" : ""}padding:1px 0">
         <span>${l}</span><span>${r}</span></div>`;

    const linesHtml = data.lines.map(ln => {
      if (isCompact) {
        return `<div style="padding:2px 0">
          <div style="font-weight:bold">${ln.productName}</div>
          <div style="display:flex;justify-content:space-between">
            ${show.prices ? `<span>${ln.quantity} × ${fmt2(ln.unitPrice)}</span>` : `<span>× ${ln.quantity}</span>`}
            ${show.discount && ln.discount > 0 ? `<span style="color:#666">خصم: ${fmt2(ln.discount)}</span>` : ""}
            <span style="font-weight:bold">${fmt2(ln.total)}</span>
          </div>
        </div>`;
      }
      return `<div style="padding:2px 0">
        ${show.itemCode && ln.productCode ? `<span style="color:#888;font-size:9px">${ln.productCode}</span> ` : ""}
        <div style="font-weight:bold">${ln.productName}</div>
        ${show.prices ? `<div style="display:flex;justify-content:space-between">
          <span>${ln.quantity} × ${fmt2(ln.unitPrice)}</span>
          ${show.discount && ln.discount > 0 ? `<span style="color:#d44">- ${fmt2(ln.discount)}</span>` : ""}
          <span style="font-weight:bold">${fmt2(ln.total)}</span>
        </div>` : `<div style="display:flex;justify-content:space-between"><span>× ${ln.quantity}</span></div>`}
      </div>`;
    }).join("");

    const qrHtml = showQR && qrDataUrl
      ? `<div style="text-align:center;margin:4px 0">
           <img src="${qrDataUrl}" width="${qrSize}" height="${qrSize}" style="display:block;margin:0 auto"/>
           <div style="font-size:8px;color:#888;margin-top:2px">${qrLabel}</div>
         </div>` : "";

    return `<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="utf-8"/>
<title>إيصال ${data.invoiceNumber}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    font-family:'Tahoma','Arial',sans-serif;
    font-size:${fs}px;color:#000;background:#fff;
    direction:rtl;width:${w};margin:0 auto;padding:3px 2px;
  }
  @media print{
    @page{size:${cfg.paperWidth} auto;margin:2mm}
    body{width:${cfg.paperWidth === "80mm" ? "76mm" : "54mm"}}
  }
</style>
</head>
<body>

<div style="text-align:center;margin-bottom:4px">
  <div style="font-size:${fs + 4}px;font-weight:bold">${data.sellerName}</div>
  ${show.taxNumber && data.sellerTaxNumber ? `<div style="font-size:9px;color:#555">الرقم الضريبي: ${data.sellerTaxNumber}</div>` : ""}
  ${show.commercialReg && data.sellerCommercialReg ? `<div style="font-size:9px;color:#555">السجل التجاري: ${data.sellerCommercialReg}</div>` : ""}
  ${show.address && data.sellerAddress ? `<div style="font-size:9px;color:#555">${data.sellerAddress}</div>` : ""}
  ${show.phone && data.sellerPhone ? `<div style="font-size:9px;color:#555">Tel: ${data.sellerPhone}</div>` : ""}
</div>

${dash("=")}
${row("رقم الفاتورة:", String(data.invoiceNumber))}
${row("التاريخ:", `${data.invoiceDate}  ${data.invoiceTime}`)}
${show.cashierName && data.cashierName ? row("الكاشير:", data.cashierName) : ""}
${show.branchName && data.branchName ? row("الفرع:", data.branchName) : ""}
${show.customerName && data.customerName ? row("العميل:", data.customerName) : ""}
${dash()}

${linesHtml}
${dash()}

${cfg.taxPct > 0 ? row(`إجمالي قبل الضريبة ${cfg.taxInclusive ? "(شامل)" : ""}:`, fmt2(data.grandTotal)) : ""}
${show.discount && data.discountTotal > 0 ? row("إجمالي الخصومات:", `- ${fmt2(data.discountTotal)}`) : ""}
${cfg.taxPct > 0 ? row(`ضريبة القيمة المضافة (${cfg.taxPct}%):`, fmt2(taxTotal)) : ""}
${!cfg.taxInclusive && cfg.taxPct > 0 ? row("الإجمالي شامل الضريبة:", fmt2(data.grandTotal + taxTotal), true) : ""}
<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:${fs + 3}px;border-top:1px solid #000;border-bottom:1px solid #000;padding:3px 0;margin:3px 0">
  <span>الإجمالي النهائي</span><span>${fmt2(data.grandTotal)}</span>
</div>
${show.paymentMethod ? row("طريقة الدفع:", payMethodLabel(data.paymentMethod)) : ""}
${data.paidAmount > 0 ? row("المبلغ المدفوع:", fmt2(data.paidAmount)) : ""}
${show.changeAmount && data.changeAmount > 0 ? row("الباقي للعميل:", fmt2(data.changeAmount), true) : ""}

${qrHtml ? `${dash("=")}${qrHtml}` : ""}
${show.thankYou ? `${dash("=")}<div style="text-align:center;font-weight:bold;padding:4px 0">${cfg.thankYouMsg}</div>` : ""}

</body></html>`;
  };

  /* ════════════════ Print handler ════════════════ */
  const handlePrint = () => {
    const win = window.open("", "_blank", `width=${paperPx + 40},height=800`);
    if (!win) return;
    win.document.write(buildPrintHtml());
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  if (!open) return null;

  /* ════════════════ JSX Preview ════════════════ */
  const { taxTotal: taxTotalPreview } = calcTax(data.grandTotal, cfg.taxPct, cfg.taxInclusive);

  const ReceiptRow = ({ label, value, bold, large }: { label: string; value: string; bold?: boolean; large?: boolean }) => (
    <div className={`flex justify-between py-0.5 ${bold ? "font-bold" : ""} ${large ? "text-[13px] border-t border-b border-black py-1 my-1" : "text-[10px]"}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 shrink-0 shadow-md" style={{ background: color }}>
        <Receipt className="w-5 h-5 text-white/80" />
        <span className="text-white font-bold text-base flex-1">
          إيصال POS — #{data.invoiceNumber}
          <span className="text-white/60 font-normal text-sm mr-3">{cfg.paperWidth} حراري</span>
        </span>
        <Button size="sm" onClick={handlePrint}
          className="bg-white hover:bg-gray-100 h-8 px-4 text-sm font-bold gap-1"
          style={{ color }}>
          <Printer className="w-4 h-4" />طباعة
        </Button>
        <button onClick={onClose} className="text-white/70 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-y-auto bg-background flex items-start justify-center py-6">
        {/* Receipt Paper */}
        <div
          className="bg-white shadow-2xl"
          style={{
            width: paperPx, minHeight: 300,
            fontFamily: "Tahoma, Arial, sans-serif", fontSize: 11,
            padding: "10px 8px", direction: "rtl",
          }}
        >
          {/* Header */}
          <div className="text-center mb-2">
            <div className="font-bold" style={{ fontSize: 15 }}>{data.sellerName}</div>
            {show.taxNumber && data.sellerTaxNumber && (
              <div className="text-[9px] text-gray-500">الرقم الضريبي: {data.sellerTaxNumber}</div>
            )}
            {show.commercialReg && data.sellerCommercialReg && (
              <div className="text-[9px] text-gray-500">السجل التجاري: {data.sellerCommercialReg}</div>
            )}
            {show.address && data.sellerAddress && (
              <div className="text-[9px] text-gray-500">{data.sellerAddress}</div>
            )}
            {show.phone && data.sellerPhone && (
              <div className="text-[9px] text-gray-500">Tel: {data.sellerPhone}</div>
            )}
          </div>

          <div className="border-t border-dashed border-gray-400 my-1"/>

          {/* Invoice info */}
          <ReceiptRow label="رقم الفاتورة:" value={String(data.invoiceNumber)} />
          <ReceiptRow label="التاريخ:" value={`${data.invoiceDate}  ${data.invoiceTime}`} />
          {show.cashierName && data.cashierName && <ReceiptRow label="الكاشير:" value={data.cashierName} />}
          {show.branchName  && data.branchName  && <ReceiptRow label="الفرع:" value={data.branchName} />}
          {show.customerName && data.customerName && <ReceiptRow label="العميل:" value={data.customerName} />}

          <div className="border-t border-dashed border-gray-400 my-1"/>

          {/* Items */}
          {data.lines.map((ln, i) => (
            <div key={i} className="py-0.5">
              <div className="font-bold text-[11px]">
                {show.itemCode && ln.productCode && <span className="text-gray-400 text-[9px] ml-1">{ln.productCode}</span>}
                {ln.productName}
              </div>
              {show.prices && (
                <div className="flex justify-between text-[10px]">
                  <span>{ln.quantity} × {fmt2(ln.unitPrice)}</span>
                  {show.discount && ln.discount > 0 && (
                    <span className="text-red-500">- {fmt2(ln.discount)}</span>
                  )}
                  <span className="font-bold">{fmt2(ln.total)}</span>
                </div>
              )}
              {!show.prices && (
                <div className="flex justify-between text-[10px]">
                  <span>× {ln.quantity}</span>
                </div>
              )}
            </div>
          ))}

          <div className="border-t border-dashed border-gray-400 my-1"/>

          {/* Totals */}
          {cfg.taxPct > 0 && (
            <ReceiptRow
              label={`إجمالي قبل الضريبة${cfg.taxInclusive ? " (شامل)" : ""}:`}
              value={fmt2(data.grandTotal)}
            />
          )}
          {show.discount && data.discountTotal > 0 && (
            <ReceiptRow label="إجمالي الخصومات:" value={`- ${fmt2(data.discountTotal)}`} />
          )}
          {cfg.taxPct > 0 && (
            <ReceiptRow label={`ضريبة القيمة المضافة (${cfg.taxPct}%):`} value={fmt2(taxTotalPreview)} />
          )}
          <ReceiptRow label="الإجمالي النهائي" value={fmt2(data.grandTotal)} bold large />
          {show.paymentMethod && (
            <ReceiptRow label="طريقة الدفع:" value={payMethodLabel(data.paymentMethod)} />
          )}
          {data.paidAmount > 0 && (
            <ReceiptRow label="المبلغ المدفوع:" value={fmt2(data.paidAmount)} />
          )}
          {show.changeAmount && data.changeAmount > 0 && (
            <ReceiptRow label="الباقي للعميل:" value={fmt2(data.changeAmount)} bold />
          )}

          {/* QR */}
          {showQR && qrDataUrl && (
            <>
              <div className="border-t border-dashed border-gray-400 my-2"/>
              <div className="flex flex-col items-center gap-1">
                <img src={qrDataUrl} width={qrSize} height={qrSize} alt="QR" />
                <span className="text-[8px] text-gray-400">{qrLabel}</span>
              </div>
            </>
          )}

          {/* Thank you */}
          {show.thankYou && (
            <>
              <div className="border-t border-dashed border-gray-400 my-2"/>
              <div className="text-center font-bold text-[11px] py-1">{cfg.thankYouMsg}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Helper: parse layoutJson → PosTemplateConfig
══════════════════════════════════════════════════════════ */
export function parsePosConfig(layoutJson: string | null | undefined): PosTemplateConfig | null {
  if (!layoutJson) return null;
  try {
    const p = JSON.parse(layoutJson);
    return p?.type === "pos_config_v1" ? (p as PosTemplateConfig) : null;
  } catch { return null; }
}
