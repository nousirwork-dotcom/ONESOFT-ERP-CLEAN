/**
 * InvoicePrintModal.tsx — فاتورة ضريبية كلاسيكية بتصميم عربي احترافي
 */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { generateQrContent, type QrSettings, type QrInvoiceData } from "@/lib/qrUtils";

/* ── ثابت CSS للطباعة ── */
const tdPrint = "border:1px solid #000;padding:4px 5px;text-align:center;height:20px;font-size:10px";

export interface PrintInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceTime?: string;
  customerName: string;
  customerCode?: string;
  customerTaxNumber?: string;
  salesperson?: string;
  paymentType: "cash" | "credit";
  currency: string;
  notes?: string;
  lines: {
    productCode: string;
    productName: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    discountPct: string;
    taxPct: string;
    taxAmt: string;
    total: string;
  }[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidAmount: number;
  remainingAmount: number;
  sellerName: string;
  sellerTaxNumber: string;
  sellerAddress?: string;
  sellerPhone?: string;
}

interface InvoicePrintModalProps {
  open: boolean;
  onClose: () => void;
  data: PrintInvoiceData;
  qrSettings?: QrSettings | null;
}

/* ── تحويل الرقم إلى كلمات عربية ── */
function numberToArabicWords(n: number, currency = "ريال"): string {
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة",
    "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
    "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مئة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  function below1000(x: number): string {
    if (x === 0) return "";
    const h = Math.floor(x / 100);
    const rem = x % 100;
    const t = Math.floor(rem / 10);
    const o = rem % 10;
    const parts: string[] = [];
    if (h) parts.push(hundreds[h]);
    if (rem < 20 && rem > 0) parts.push(ones[rem]);
    else {
      if (t) parts.push(tens[t]);
      if (o) parts.push(ones[o]);
    }
    return parts.join(" و");
  }

  const intPart = Math.floor(n);
  const decPart = Math.round((n - intPart) * 100);
  if (intPart === 0 && decPart === 0) return `صفر ${currency}`;

  const parts: string[] = [];
  const millions = Math.floor(intPart / 1_000_000);
  const thousands = Math.floor((intPart % 1_000_000) / 1000);
  const rest = intPart % 1000;

  if (millions) parts.push(`${below1000(millions)} مليون`);
  if (thousands === 1) parts.push("ألف");
  else if (thousands === 2) parts.push("ألفان");
  else if (thousands > 2) parts.push(`${below1000(thousands)} آلاف`);
  if (rest) parts.push(below1000(rest));

  let result = `فقط ${parts.join(" و")} ${currency}`;
  if (decPart) result += ` و${below1000(decPart)} هللة`;
  return result + " لا غير";
}

export default function InvoicePrintModal({ open, onClose, data, qrSettings }: InvoicePrintModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const showQR = !!(qrSettings?.isEnabled && qrSettings?.showOnSalesInvoice);

  const qrInvoiceData: QrInvoiceData = {
    sellerName: qrSettings?.sellerName || data.sellerName,
    taxNumber: qrSettings?.taxNumber || data.sellerTaxNumber,
    invoiceDateTime: `${data.invoiceDate}T${data.invoiceTime ?? "00:00:00"}`,
    totalAmount: data.grandTotal,
    vatAmount: data.taxTotal,
    invoiceNumber: data.invoiceNumber,
    buyerName: data.customerName,
    buyerTaxNumber: data.customerTaxNumber,
  };

  const qrContent = showQR
    ? generateQrContent(qrSettings!.countrySystem, qrInvoiceData, qrSettings?.customFormat)
    : "";

  const qrLabel =
    qrSettings?.countrySystem === "zatca" ? "ZATCA QR" :
    qrSettings?.countrySystem === "eta"   ? "ETA QR"   : "QR Code";

  const qrSize = qrSettings?.qrSize ?? 100;

  useEffect(() => {
    if (!showQR || !qrContent) { setQrDataUrl(""); return; }
    QRCode.toDataURL(qrContent, { width: qrSize * 2, margin: 1, color: { dark: "#000", light: "#fff" }, errorCorrectionLevel: "M" })
      .then(url => setQrDataUrl(url))
      .catch(() => setQrDataUrl(""));
  }, [qrContent, qrSize, showQR]);

  /* ── حساب قيم الأسطر ── */
  const lineCalcs = data.lines.map(ln => {
    const qty      = parseFloat(ln.quantity)  || 0;
    const price    = parseFloat(ln.unitPrice) || 0;
    const discPct  = parseFloat(ln.discountPct) || 0;
    const preDist  = qty * price;
    const discAmt  = preDist * discPct / 100;
    const postDisc = preDist - discAmt;
    return { preDist, discAmt, postDisc };
  });

  const totalPreDisc   = lineCalcs.reduce((s, l) => s + l.preDist,  0);
  const totalDiscLine  = lineCalcs.reduce((s, l) => s + l.discAmt,  0);
  const totalPostDisc  = lineCalcs.reduce((s, l) => s + l.postDisc, 0);
  const taxableAmount  = data.subtotal - data.discountTotal;
  const amountInWords  = numberToArabicWords(data.grandTotal, data.currency);

  const MIN_ROWS    = 10;
  const emptyRowCount = Math.max(0, MIN_ROWS - data.lines.length);

  /* ── ثوابت تنسيق جدول المعاينة ── */
  const thS: React.CSSProperties = {
    background: "#406B93", color: "#fff",
    border: "1px solid #000", padding: "5px 4px",
    textAlign: "center", fontSize: "10px", fontWeight: "bold",
  };
  const tdS: React.CSSProperties = {
    border: "1px solid #000", padding: "4px 5px",
    textAlign: "center", fontSize: "10px", height: "22px",
  };

  /* ── ملخص الأسطر ── */
  const summaryRows = [
    { label: "الإجمالـي", val: data.subtotal.toFixed(2) },
    { label: "الخصم على الإجمالي", val: data.discountTotal.toFixed(2) },
    { label: "الإجمالي الخاضع للضريبة  ( غير شامل VAT )", val: taxableAmount.toFixed(2) },
    { label: `مجموع ضريبة القيمة المضافة 15%`, val: data.taxTotal.toFixed(2) },
    { label: "إجمالي المبالغ المستحق", val: data.grandTotal.toFixed(2), grand: true },
  ];

  /* ═══════════════════════════════════════════
     بناء HTML للطباعة
  ════════════════════════════════════════════ */
  const buildPrintHtml = () => {
    const linesHtml = data.lines.map((ln, i) => {
      const c = lineCalcs[i];
      return `<tr>
        <td style="${tdPrint}">${i + 1}</td>
        <td style="${tdPrint}">${ln.productCode}</td>
        <td style="${tdPrint};text-align:right;padding-right:6px">${ln.productName}</td>
        <td style="${tdPrint}">${ln.unit}</td>
        <td style="${tdPrint}">${ln.quantity}</td>
        <td style="${tdPrint}">${parseFloat(ln.unitPrice).toFixed(2)}</td>
        <td style="${tdPrint}">${c.preDist.toFixed(2)}</td>
        <td style="${tdPrint}">${c.discAmt > 0 ? c.discAmt.toFixed(2) : "-"}</td>
        <td style="${tdPrint}">${c.postDisc.toFixed(2)}</td>
      </tr>`;
    }).join("");

    const emptyHtml = Array(emptyRowCount)
      .fill(`<tr>${Array(9).fill(`<td style="${tdPrint}">&nbsp;</td>`).join("")}</tr>`)
      .join("");

    const sumRow = `
      <tr style="background:#f0f0f0;font-weight:bold">
        <td style="${tdPrint}" colspan="4">المجموع</td>
        <td style="${tdPrint}">${data.lines.reduce((s, l) => s + (parseFloat(l.quantity)||0), 0).toFixed(2)}</td>
        <td style="${tdPrint}">-</td>
        <td style="${tdPrint}">${totalPreDisc.toFixed(2)}</td>
        <td style="${tdPrint}">${totalDiscLine > 0 ? totalDiscLine.toFixed(2) : "-"}</td>
        <td style="${tdPrint}">${totalPostDisc.toFixed(2)}</td>
      </tr>`;

    const summaryHtml = summaryRows.map(r => `
      <tr style="${r.grand ? "background:#e8f0e8;font-weight:bold;font-size:12px" : ""}">
        <td style="border:1px solid #000;padding:5px 8px;font-weight:bold;width:130px;text-align:center">${r.val}</td>
        <td style="border:1px solid #000;padding:5px 10px;text-align:right">${r.label}</td>
      </tr>`).join("");

    const qrHtml = showQR && qrDataUrl
      ? `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:8px">
           <img src="${qrDataUrl}" width="${qrSize}" height="${qrSize}" style="display:block"/>
           <span style="font-size:8px;color:#888">${qrLabel}</span>
         </div>`
      : "";

    return `<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="utf-8"/>
<title>فاتورة ${data.invoiceNumber}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Tahoma','Arial',sans-serif;font-size:10px;color:#000;background:#fff;direction:rtl}
  .page{padding:14px 18px;max-width:960px;margin:auto}
  .inv-header{display:flex;justify-content:space-between;align-items:flex-start;border:2px solid #406B93;border-radius:4px;padding:10px 12px;margin-bottom:8px;background:#f8fafd}
  .co-name{font-size:16px;font-weight:bold;color:#406B93}
  .co-sub{font-size:9px;color:#555;margin-top:2px}
  .inv-title-center{text-align:center}
  .inv-title-center h2{font-size:20px;font-weight:bold;color:#333}
  .inv-no{font-size:13px;font-weight:bold;color:#406B93;margin-top:4px}
  .meta-box{border:1px solid #ccc;margin-bottom:8px;font-size:9px;border-radius:2px}
  .meta-row{display:flex;border-bottom:1px solid #eee}
  .meta-row:last-child{border-bottom:none}
  .meta-cell{padding:4px 8px;border-left:1px solid #eee;flex:1}
  .meta-cell:last-child{border-left:none}
  .lbl{color:#777}
  .val{font-weight:bold}
  table.items{width:100%;border-collapse:collapse;margin-bottom:8px}
  table.items th{background:#406B93;color:#fff;border:1px solid #000;padding:5px 4px;text-align:center;font-size:10px}
  table.items td{border:1px solid #000;padding:4px 5px;text-align:center;height:20px;font-size:10px}
  .bottom-section{display:flex;gap:0;margin-bottom:8px;border:1px solid #000}
  .summary-table{flex:1;border-collapse:collapse}
  .summary-table td{border:1px solid #000;padding:5px 8px;font-size:10px}
  .qr-side{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 12px;border-right:1px solid #000;min-width:130px}
  .words-box{border:1px solid #000;padding:5px 8px;margin-bottom:6px;font-size:10px;font-weight:bold}
  .footer{display:flex;justify-content:space-between;font-size:9px;color:#777;margin-top:6px;padding-top:4px;border-top:1px solid #eee}
  @media print{body{margin:0}.page{padding:10px}}
</style>
</head>
<body>
<div class="page">

  <!-- رأس الفاتورة -->
  <div class="inv-header">
    <div>
      <div class="co-name">${data.sellerName}</div>
      ${data.sellerAddress ? `<div class="co-sub">${data.sellerAddress}</div>` : ""}
      ${data.sellerPhone   ? `<div class="co-sub">هاتف: ${data.sellerPhone}</div>` : ""}
      ${data.sellerTaxNumber ? `<div class="co-sub">الرقم الضريبي: ${data.sellerTaxNumber}</div>` : ""}
    </div>
    <div class="inv-title-center">
      <h2>فاتورة ضريبية</h2>
      <div class="inv-no"># ${data.invoiceNumber}</div>
    </div>
    <div style="width:80px"></div>
  </div>

  <!-- بيانات الفاتورة -->
  <div class="meta-box">
    <div class="meta-row">
      <div class="meta-cell"><span class="lbl">العميل: </span><span class="val">${data.customerName}</span></div>
      <div class="meta-cell"><span class="lbl">كود: </span><span class="val">${data.customerCode || "-"}</span></div>
      <div class="meta-cell"><span class="lbl">التاريخ: </span><span class="val">${data.invoiceDate}</span></div>
    </div>
    <div class="meta-row">
      <div class="meta-cell"><span class="lbl">الرقم الضريبي: </span><span class="val">${data.customerTaxNumber || "-"}</span></div>
      <div class="meta-cell"><span class="lbl">نوع الدفع: </span><span class="val">${data.paymentType === "cash" ? "نقداً" : "آجل"}</span></div>
      <div class="meta-cell"><span class="lbl">العملة: </span><span class="val">${data.currency}</span></div>
    </div>
  </div>

  <!-- جدول الأصناف -->
  <table class="items">
    <thead>
      <tr>
        <th style="width:28px">م</th>
        <th style="width:80px">رقم الصنف</th>
        <th>اسم الصنف</th>
        <th style="width:55px">العبوة</th>
        <th style="width:55px">الكمية</th>
        <th style="width:65px">السعر</th>
        <th style="width:90px">الإجمالي قبل الخصم</th>
        <th style="width:85px">خصم على الصنف</th>
        <th style="width:90px">الإجمالي بعد الخصم</th>
      </tr>
    </thead>
    <tbody>
      ${linesHtml}
      ${emptyHtml}
      ${sumRow}
    </tbody>
  </table>

  <!-- قسم الملخص + QR -->
  <div class="bottom-section">
    ${qrHtml ? `<div class="qr-side">${qrHtml}</div>` : ""}
    <div style="flex:1">
      <table class="summary-table" style="width:100%">
        ${summaryHtml}
      </table>
    </div>
  </div>

  <!-- المبلغ بالكلمات -->
  <div class="words-box"><u>${amountInWords}</u></div>

  ${data.notes ? `<div style="border:1px solid #ccc;padding:5px 8px;margin-bottom:6px;font-size:9px;border-radius:2px"><strong>ملاحظات:</strong> ${data.notes}</div>` : ""}

  <!-- تذييل -->
  <div class="footer">
    <span>تم إنشاء هذه الفاتورة بواسطة OneSoft ERP</span>
    <span>صفحة 1 من 1</span>
  </div>
</div>
</body>
</html>`;
  };

  const handlePrint = () => {
    const win = window.open("", "_blank", "width=960,height=1100");
    if (!win) return;
    win.document.write(buildPrintHtml());
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" dir="rtl">
      {/* شريط الأدوات */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#406B93] shrink-0 shadow-md">
        <span className="text-white font-bold text-base">
          معاينة الطباعة — فاتورة {data.invoiceNumber}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handlePrint}
            className="bg-white text-[#406B93] hover:bg-gray-100 h-8 px-4 text-sm font-bold"
          >
            <Printer className="w-4 h-4 ml-1" />طباعة / PDF
          </Button>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* منطقة المعاينة */}
      <div className="flex-1 overflow-y-auto bg-gray-300">
        <div
          className="bg-white shadow-xl my-6 mx-auto p-6 w-full max-w-5xl"
          style={{ fontFamily: "Tahoma, Arial, sans-serif", direction: "rtl", fontSize: "11px" }}
        >
          {/* رأس الفاتورة */}
          <div
            className="flex justify-between items-start mb-3 p-3 rounded"
            style={{ border: "2px solid #406B93", background: "#f8fafd" }}
          >
            <div>
              <div className="text-base font-bold text-[#406B93]">{data.sellerName}</div>
              {data.sellerAddress && <div className="text-[9px] text-gray-500 mt-0.5">{data.sellerAddress}</div>}
              {data.sellerPhone   && <div className="text-[9px] text-gray-500">هاتف: {data.sellerPhone}</div>}
              {data.sellerTaxNumber && <div className="text-[9px] text-gray-500">الرقم الضريبي: {data.sellerTaxNumber}</div>}
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-800">فاتورة ضريبية</h2>
              <div className="text-sm font-bold text-[#406B93] mt-1"># {data.invoiceNumber}</div>
            </div>
            <div className="w-20" />
          </div>

          {/* بيانات الفاتورة */}
          <div className="border border-gray-300 mb-3 text-[10px] rounded">
            <div className="flex border-b border-gray-200">
              <div className="flex-1 px-2 py-1.5 border-l border-gray-200">
                <span className="text-gray-500">العميل: </span><strong>{data.customerName}</strong>
              </div>
              <div className="flex-1 px-2 py-1.5 border-l border-gray-200">
                <span className="text-gray-500">كود: </span><strong>{data.customerCode || "-"}</strong>
              </div>
              <div className="flex-1 px-2 py-1.5">
                <span className="text-gray-500">التاريخ: </span><strong>{data.invoiceDate}</strong>
              </div>
            </div>
            <div className="flex">
              <div className="flex-1 px-2 py-1.5 border-l border-gray-200">
                <span className="text-gray-500">الرقم الضريبي: </span><strong>{data.customerTaxNumber || "-"}</strong>
              </div>
              <div className="flex-1 px-2 py-1.5 border-l border-gray-200">
                <span className="text-gray-500">نوع الدفع: </span><strong>{data.paymentType === "cash" ? "نقداً" : "آجل"}</strong>
              </div>
              <div className="flex-1 px-2 py-1.5">
                <span className="text-gray-500">العملة: </span><strong>{data.currency}</strong>
              </div>
            </div>
          </div>

          {/* جدول الأصناف */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px" }}>
            <thead>
              <tr>
                {[
                  { label: "م", w: 28 },
                  { label: "رقم الصنف", w: 80 },
                  { label: "اسم الصنف", w: 0 },
                  { label: "العبوة", w: 55 },
                  { label: "الكمية", w: 55 },
                  { label: "السعر", w: 65 },
                  { label: "الإجمالي قبل الخصم", w: 90 },
                  { label: "خصم على الصنف", w: 85 },
                  { label: "الإجمالي بعد الخصم", w: 90 },
                ].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      background: "#406B93", color: "#fff",
                      border: "1px solid #000", padding: "5px 4px",
                      textAlign: "center", fontSize: "10px", fontWeight: "bold",
                      width: h.w || undefined,
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.lines.map((ln, i) => {
                const c = lineCalcs[i];
                return (
                  <tr key={i}>
                    <td style={tdS}>{i + 1}</td>
                    <td style={tdS}>{ln.productCode}</td>
                    <td style={{ ...tdS, textAlign: "right", paddingRight: "6px" }}>{ln.productName}</td>
                    <td style={tdS}>{ln.unit}</td>
                    <td style={tdS}>{ln.quantity}</td>
                    <td style={tdS}>{parseFloat(ln.unitPrice).toFixed(2)}</td>
                    <td style={tdS}>{c.preDist.toFixed(2)}</td>
                    <td style={tdS}>{c.discAmt > 0 ? c.discAmt.toFixed(2) : "-"}</td>
                    <td style={tdS}>{c.postDisc.toFixed(2)}</td>
                  </tr>
                );
              })}
              {Array(emptyRowCount).fill(null).map((_, i) => (
                <tr key={`e-${i}`}>
                  {Array(9).fill(null).map((__, j) => (
                    <td key={j} style={tdS}>&nbsp;</td>
                  ))}
                </tr>
              ))}
              {/* صف المجموع */}
              <tr style={{ background: "#f0f0f0", fontWeight: "bold" }}>
                <td style={tdS} colSpan={4}>المجموع</td>
                <td style={tdS}>
                  {data.lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0).toFixed(2)}
                </td>
                <td style={tdS}>-</td>
                <td style={tdS}>{totalPreDisc.toFixed(2)}</td>
                <td style={tdS}>{totalDiscLine > 0 ? totalDiscLine.toFixed(2) : "-"}</td>
                <td style={tdS}>{totalPostDisc.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {/* ملخص المبالغ + QR */}
          <div className="flex mb-2" style={{ border: "1px solid #000" }}>
            {/* QR جانبي (يسار في RTL = أقصى اليسار فيزيائياً) */}
            {showQR && qrDataUrl && (
              <div
                className="flex flex-col items-center justify-center gap-1 p-3"
                style={{ borderRight: "1px solid #000", minWidth: 130 }}
              >
                <img src={qrDataUrl} width={qrSize} height={qrSize} alt="QR" />
                <span className="text-[8px] text-gray-400">{qrLabel}</span>
              </div>
            )}
            {/* جدول الملخص */}
            <table style={{ flex: 1, borderCollapse: "collapse", width: "100%" }}>
              <tbody>
                {summaryRows.map((row, i) => (
                  <tr
                    key={i}
                    style={row.grand ? { background: "#e8f0e8", fontWeight: "bold" } : {}}
                  >
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "5px 8px",
                        textAlign: "center",
                        fontWeight: "bold",
                        fontSize: row.grand ? "12px" : "10px",
                        width: 130,
                      }}
                    >
                      {row.val}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "5px 10px",
                        textAlign: "right",
                        fontSize: row.grand ? "12px" : "10px",
                        fontWeight: row.grand ? "bold" : "normal",
                      }}
                    >
                      {row.label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* المبلغ بالكلمات */}
          <div
            className="px-3 py-2 mb-2 text-[10px] font-bold"
            style={{ border: "1px solid #000" }}
          >
            <u>{amountInWords}</u>
          </div>

          {/* ملاحظات */}
          {data.notes && (
            <div
              className="px-3 py-1.5 mb-2 text-[9px] rounded"
              style={{ border: "1px solid #ccc" }}
            >
              <strong>ملاحظات:</strong> {data.notes}
            </div>
          )}

          {/* تذييل */}
          <div className="flex justify-between text-[9px] text-gray-400 mt-3 pt-2 border-t border-gray-200">
            <span>تم إنشاء هذه الفاتورة بواسطة OneSoft ERP</span>
            <span>صفحة 1 من 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
