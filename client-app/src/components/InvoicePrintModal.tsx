/**
 * InvoicePrintModal.tsx — فاتورة ضريبية كلاسيكية بتصميم عربي احترافي
 */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { generateQrContent, type QrSettings, type QrInvoiceData } from "@/lib/qrUtils";

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

/* ── تحويل الرقم إلى كلمات عربية (مبسّط) ── */
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
  result += " لا غير";
  return result;
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

  const qrSize = qrSettings?.qrSize ?? 90;

  useEffect(() => {
    if (!showQR || !qrContent) { setQrDataUrl(""); return; }
    QRCode.toDataURL(qrContent, { width: qrSize, margin: 1, color: { dark: "#000", light: "#fff" }, errorCorrectionLevel: "M" })
      .then(url => setQrDataUrl(url))
      .catch(() => setQrDataUrl(""));
  }, [qrContent, qrSize, showQR]);

  /* ── حساب قيم الأسطر ── */
  const lineCalcs = data.lines.map(ln => {
    const qty = parseFloat(ln.quantity) || 0;
    const price = parseFloat(ln.unitPrice) || 0;
    const discPct = parseFloat(ln.discountPct) || 0;
    const preDist = qty * price;
    const discAmt = preDist * discPct / 100;
    const postDisc = preDist - discAmt;
    return { preDist, discAmt, postDisc };
  });

  const totalPreDisc  = lineCalcs.reduce((s, l) => s + l.preDist,  0);
  const totalDiscLine = lineCalcs.reduce((s, l) => s + l.discAmt,  0);
  const totalPostDisc = lineCalcs.reduce((s, l) => s + l.postDisc, 0);
  const taxableAmount = data.subtotal - data.discountTotal;
  const amountInWords = numberToArabicWords(data.grandTotal, data.currency);

  /* ── صفوف جدول الأصناف (أدنى 10 صفوف) ── */
  const MIN_ROWS = 10;
  const emptyRowCount = Math.max(0, MIN_ROWS - data.lines.length);

  /* ═══════════════════════════════════════════
     مكوّن صف الجدول — للمعاينة
  ════════════════════════════════════════════ */
  const PreviewLineRow = ({ ln, i, calc }: { ln: typeof data.lines[0]; i: number; calc: typeof lineCalcs[0] }) => (
    <tr style={{ background: "#fff" }}>
      <td style={tdS}>{i + 1}</td>
      <td style={tdS}>{ln.productCode}</td>
      <td style={{ ...tdS, textAlign: "right" }}>{ln.productName}</td>
      <td style={tdS}>{ln.unit}</td>
      <td style={tdS}>{ln.quantity}</td>
      <td style={tdS}>{parseFloat(ln.unitPrice).toFixed(2)}</td>
      <td style={tdS}>{calc.preDist.toFixed(2)}</td>
      <td style={tdS}>{calc.discAmt > 0 ? calc.discAmt.toFixed(2) : "-"}</td>
      <td style={tdS}>{calc.postDisc.toFixed(2)}</td>
    </tr>
  );

  /* ═══════════════════════════════════════════
     بناء HTML للطباعة
  ════════════════════════════════════════════ */
  const buildPrintHtml = () => {
    const linesHtml = data.lines.map((ln, i) => {
      const c = lineCalcs[i];
      return `<tr>
        <td style="${tdPrint}">${i + 1}</td>
        <td style="${tdPrint}">${ln.productCode}</td>
        <td style="${tdPrint};text-align:right">${ln.productName}</td>
        <td style="${tdPrint}">${ln.unit}</td>
        <td style="${tdPrint}">${ln.quantity}</td>
        <td style="${tdPrint}">${parseFloat(ln.unitPrice).toFixed(2)}</td>
        <td style="${tdPrint}">${c.preDist.toFixed(2)}</td>
        <td style="${tdPrint}">${c.discAmt > 0 ? c.discAmt.toFixed(2) : "-"}</td>
        <td style="${tdPrint}">${c.postDisc.toFixed(2)}</td>
      </tr>`;
    }).join("");

    const emptyHtml = Array(emptyRowCount).fill(`<tr>${Array(9).fill(`<td style="${tdPrint}">&nbsp;</td>`).join("")}</tr>`).join("");

    const sumRow = `<tr style="background:#f5f5f5;font-weight:bold">
      <td style="${tdPrint}" colspan="4">المجموع</td>
      <td style="${tdPrint}">-</td>
      <td style="${tdPrint}">-</td>
      <td style="${tdPrint}">${totalPreDisc.toFixed(2)}</td>
      <td style="${tdPrint}">${totalDiscLine > 0 ? totalDiscLine.toFixed(2) : "-"}</td>
      <td style="${tdPrint}">${totalPostDisc.toFixed(2)}</td>
    </tr>`;

    const qrHtml = showQR && qrDataUrl
      ? `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
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
  .page{padding:12px 16px;max-width:900px;margin:auto}
  .inv-header{display:flex;justify-content:space-between;align-items:flex-start;border:2px solid #000;padding:8px;margin-bottom:6px}
  .co-info h1{font-size:16px;color:#406B93;font-weight:bold}
  .co-info p{font-size:9px;color:#333;margin-top:1px}
  .inv-title{text-align:center}
  .inv-title h2{font-size:18px;font-weight:bold}
  .inv-title .no{font-size:13px;color:#406B93;font-weight:bold;margin-top:4px}
  .inv-meta{border:1px solid #000;margin-bottom:6px;font-size:9px}
  .meta-row{display:flex;border-bottom:1px solid #ccc}
  .meta-row:last-child{border-bottom:none}
  .meta-cell{padding:3px 6px;border-left:1px solid #ccc;flex:1}
  .meta-cell:last-child{border-left:none}
  .meta-label{color:#555}
  .meta-val{font-weight:bold}
  table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:6px}
  th{background:#d4e8a0;border:1px solid #000;padding:4px;text-align:center;font-size:10px;font-weight:bold}
  td{border:1px solid #000;padding:4px;text-align:center;height:18px}
  .sum-section{border:1px solid #000;margin-top:4px;margin-bottom:6px}
  .sum-row{display:flex;border-bottom:1px solid #000}
  .sum-row:last-child{border-bottom:none}
  .sum-label{flex:1;padding:4px 8px;text-align:center;border-left:1px solid #000;font-weight:bold}
  .sum-val{width:110px;padding:4px 8px;text-align:center;font-weight:bold}
  .sum-row.grand .sum-label,.sum-row.grand .sum-val{font-size:12px;background:#f0f0f0}
  .words-section{border:1px solid #000;padding:5px 8px;margin-bottom:4px;font-size:10px;font-weight:bold}
  .footer{display:flex;justify-content:space-between;font-size:9px;color:#555;margin-top:4px}
  @media print{body{margin:0}.page{padding:8px}}
</style>
</head>
<body>
<div class="page">
  <div class="inv-header">
    <div class="co-info">
      <h1>${data.sellerName}</h1>
      ${data.sellerAddress ? `<p>${data.sellerAddress}</p>` : ""}
      ${data.sellerPhone ? `<p>هاتف: ${data.sellerPhone}</p>` : ""}
      ${data.sellerTaxNumber ? `<p>الرقم الضريبي: ${data.sellerTaxNumber}</p>` : ""}
    </div>
    <div class="inv-title">
      <h2>فاتورة ضريبية</h2>
      <div class="no">#${data.invoiceNumber}</div>
    </div>
    <div>${qrHtml}</div>
  </div>

  <div class="inv-meta">
    <div class="meta-row">
      <div class="meta-cell"><span class="meta-label">العميل: </span><span class="meta-val">${data.customerName}</span></div>
      <div class="meta-cell"><span class="meta-label">كود: </span><span class="meta-val">${data.customerCode || "-"}</span></div>
      <div class="meta-cell"><span class="meta-label">التاريخ: </span><span class="meta-val">${data.invoiceDate}</span></div>
    </div>
    <div class="meta-row">
      <div class="meta-cell"><span class="meta-label">الرقم الضريبي: </span><span class="meta-val">${data.customerTaxNumber || "-"}</span></div>
      <div class="meta-cell"><span class="meta-label">نوع الدفع: </span><span class="meta-val">${data.paymentType === "cash" ? "نقداً" : "آجل"}</span></div>
      <div class="meta-cell"><span class="meta-label">العملة: </span><span class="meta-val">${data.currency}</span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>م</th>
        <th>رقم الصنف</th>
        <th>اسم الصنف</th>
        <th>العبوة</th>
        <th>الكمية</th>
        <th>السعر</th>
        <th>الإجمالي قبل الخصم</th>
        <th>خصم على الصنف</th>
        <th>الإجمالي بعد الخصم</th>
      </tr>
    </thead>
    <tbody>
      ${linesHtml}
      ${emptyHtml}
      ${sumRow}
    </tbody>
  </table>

  <div class="sum-section">
    <div class="sum-row">
      <div class="sum-label">الإجمالـــــي</div>
      <div class="sum-val">${data.subtotal.toFixed(2)}</div>
    </div>
    <div class="sum-row">
      <div class="sum-label">الخصـــم على الإجمالـــي</div>
      <div class="sum-val">${data.discountTotal.toFixed(2)}</div>
    </div>
    <div class="sum-row">
      <div class="sum-label">الإجمالي الخاضع للضريبة (غير شامل VAT)</div>
      <div class="sum-val">${taxableAmount.toFixed(2)}</div>
    </div>
    <div class="sum-row">
      <div class="sum-label">مجموع ضريبة القيمة المضافة</div>
      <div class="sum-val">${data.taxTotal.toFixed(2)}</div>
    </div>
    <div class="sum-row grand">
      <div class="sum-label">إجمالـــي المبالـــغ المستحق</div>
      <div class="sum-val">${data.grandTotal.toFixed(2)}</div>
    </div>
  </div>

  <div class="words-section"><u>${amountInWords}</u></div>

  ${data.notes ? `<div style="border:1px solid #000;padding:4px 8px;margin-bottom:4px;font-size:9px"><strong>ملاحظات:</strong> ${data.notes}</div>` : ""}

  <div class="footer">
    <span>تم إنشاء هذه الفاتورة بواسطة OneSoft ERP</span>
    <span>صفحة 1 من 1</span>
  </div>
</div>
</body>
</html>`;
  };

  const handlePrint = () => {
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;
    win.document.write(buildPrintHtml());
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  if (!open) return null;

  /* ── ثوابت تنسيق الجدول ── */
  const thS: React.CSSProperties = {
    background: "#d4e8a0", border: "1px solid #000", padding: "4px 3px",
    textAlign: "center", fontSize: "10px", fontWeight: "bold",
  };
  const tdS: React.CSSProperties = {
    border: "1px solid #000", padding: "4px 3px", textAlign: "center",
    fontSize: "10px", height: "20px",
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" dir="rtl">
      {/* شريط الأدوات */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#406B93] shrink-0 shadow-md">
        <span className="text-white font-bold text-base">معاينة الطباعة — فاتورة {data.invoiceNumber}</span>
        <div className="flex gap-2">
          <Button size="sm" onClick={handlePrint} className="bg-white text-[#406B93] hover:bg-gray-100 h-8 px-4 text-sm font-bold">
            <Printer className="w-4 h-4 ml-1" />طباعة / PDF
          </Button>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* منطقة المعاينة */}
      <div className="flex-1 overflow-y-auto bg-gray-200">
        <div
          className="bg-white shadow-xl my-6 mx-auto p-6 w-full max-w-5xl"
          style={{ fontFamily: "Tahoma, Arial, sans-serif", direction: "rtl", fontSize: "11px" }}
        >
          {/* رأس الفاتورة */}
          <div className="flex justify-between items-start border-2 border-black p-3 mb-2">
            <div>
              <h1 className="text-lg font-bold text-[#406B93]">{data.sellerName}</h1>
              {data.sellerAddress && <p className="text-[10px] text-gray-600 mt-0.5">{data.sellerAddress}</p>}
              {data.sellerPhone && <p className="text-[10px] text-gray-600">هاتف: {data.sellerPhone}</p>}
              {data.sellerTaxNumber && <p className="text-[10px] text-gray-600">الرقم الضريبي: {data.sellerTaxNumber}</p>}
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold">فاتورة ضريبية</h2>
              <div className="text-sm font-bold text-[#406B93] mt-1">#{data.invoiceNumber}</div>
            </div>
            <div className="flex flex-col items-center gap-1">
              {showQR && qrDataUrl && (
                <>
                  <img src={qrDataUrl} width={qrSize} height={qrSize} alt="QR" />
                  <span className="text-[8px] text-gray-400">{qrLabel}</span>
                </>
              )}
            </div>
          </div>

          {/* بيانات الفاتورة */}
          <div className="border border-black mb-2 text-[10px]">
            <div className="flex border-b border-gray-300">
              <div className="flex-1 px-2 py-1 border-l border-gray-300">
                <span className="text-gray-500">العميل: </span><strong>{data.customerName}</strong>
              </div>
              <div className="flex-1 px-2 py-1 border-l border-gray-300">
                <span className="text-gray-500">كود: </span><strong>{data.customerCode || "-"}</strong>
              </div>
              <div className="flex-1 px-2 py-1">
                <span className="text-gray-500">التاريخ: </span><strong>{data.invoiceDate}</strong>
              </div>
            </div>
            <div className="flex">
              <div className="flex-1 px-2 py-1 border-l border-gray-300">
                <span className="text-gray-500">الرقم الضريبي: </span><strong>{data.customerTaxNumber || "-"}</strong>
              </div>
              <div className="flex-1 px-2 py-1 border-l border-gray-300">
                <span className="text-gray-500">نوع الدفع: </span><strong>{data.paymentType === "cash" ? "نقداً" : "آجل"}</strong>
              </div>
              <div className="flex-1 px-2 py-1">
                <span className="text-gray-500">العملة: </span><strong>{data.currency}</strong>
              </div>
            </div>
          </div>

          {/* جدول الأصناف */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6px" }}>
            <thead>
              <tr>
                <th style={thS}>م</th>
                <th style={thS}>رقم الصنف</th>
                <th style={{ ...thS, textAlign: "right" }}>اسم الصنف</th>
                <th style={thS}>العبوة</th>
                <th style={thS}>الكمية</th>
                <th style={thS}>السعر</th>
                <th style={thS}>الإجمالي قبل الخصم</th>
                <th style={thS}>خصم على الصنف</th>
                <th style={thS}>الإجمالي بعد الخصم</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((ln, i) => (
                <PreviewLineRow key={i} ln={ln} i={i} calc={lineCalcs[i]} />
              ))}
              {Array(emptyRowCount).fill(null).map((_, i) => (
                <tr key={`empty-${i}`}>
                  {Array(9).fill(null).map((__, j) => (
                    <td key={j} style={tdS}>&nbsp;</td>
                  ))}
                </tr>
              ))}
              {/* صف المجموع */}
              <tr style={{ background: "#f5f5f5", fontWeight: "bold" }}>
                <td style={tdS} colSpan={4}>المجموع</td>
                <td style={tdS}>-</td>
                <td style={tdS}>-</td>
                <td style={tdS}>{totalPreDisc.toFixed(2)}</td>
                <td style={tdS}>{totalDiscLine > 0 ? totalDiscLine.toFixed(2) : "-"}</td>
                <td style={tdS}>{totalPostDisc.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {/* ملخص المبالغ */}
          <div className="border border-black mb-2 text-[11px]">
            {[
              { label: "الإجمالـــــي", val: data.subtotal.toFixed(2) },
              { label: "الخصـــم على الإجمالـــي", val: data.discountTotal.toFixed(2) },
              { label: "الإجمالي الخاضع للضريبة (غير شامل VAT)", val: taxableAmount.toFixed(2) },
              { label: "مجموع ضريبة القيمة المضافة", val: data.taxTotal.toFixed(2) },
              { label: "إجمالـــي المبالـــغ المستحق", val: data.grandTotal.toFixed(2), bold: true },
            ].map((row, i, arr) => (
              <div
                key={i}
                className="flex"
                style={{ borderBottom: i < arr.length - 1 ? "1px solid #000" : "none" }}
              >
                <div className="flex-1 px-3 py-1.5 text-center font-bold border-l border-black"
                  style={{ background: row.bold ? "#f0f0f0" : "transparent", fontSize: row.bold ? "12px" : "11px" }}>
                  {row.label}
                </div>
                <div className="text-center font-bold px-3 py-1.5"
                  style={{ minWidth: 110, background: row.bold ? "#f0f0f0" : "transparent", fontSize: row.bold ? "12px" : "11px" }}>
                  {row.val}
                </div>
              </div>
            ))}
          </div>

          {/* المبلغ بالكلمات */}
          <div className="border border-black px-3 py-1.5 mb-2 text-[10px] font-bold">
            <u>{amountInWords}</u>
          </div>

          {/* ملاحظات */}
          {data.notes && (
            <div className="border border-black px-3 py-1.5 mb-2 text-[10px]">
              <strong>ملاحظات:</strong> {data.notes}
            </div>
          )}

          {/* تذييل */}
          <div className="flex justify-between text-[9px] text-gray-500 mt-2">
            <span>تم إنشاء هذه الفاتورة بواسطة OneSoft ERP</span>
            <span>صفحة 1 من 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── مرجع CSS للطباعة ── */
const tdPrint = "border:1px solid #000;padding:4px;text-align:center;height:18px";
