/**
 * InvoicePrintModal.tsx — فاتورة ضريبية ثنائية اللغة (عربي / إنجليزي)
 * تصميم احترافي مطابق لمعيار ZATCA
 */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Printer, X, FileText } from "lucide-react";
import { generateQrContent, type QrSettings, type QrInvoiceData } from "@/lib/qrUtils";

/* ═══════════════════ Types ═══════════════════ */
export type DocTemplateConfig = {
  type: "config_v1";
  language: "ar" | "bilingual";
  primaryColor: string;
  columns: {
    num: boolean; code: boolean; name: boolean; unit: boolean;
    qty: boolean; price: boolean; discount: boolean;
    taxable: boolean; taxRate: boolean; taxAmt: boolean; total: boolean;
  };
  minRows: number;
  sections: {
    sellerInfo: boolean; customerInfo: boolean;
    amountInWords: boolean; pageNumber: boolean; signatures: boolean;
  };
};

const DEFAULT_CFG: DocTemplateConfig = {
  type: "config_v1",
  language: "bilingual",
  primaryColor: "#406B93",
  columns: { num: true, code: true, name: true, unit: false, qty: true, price: true,
    discount: true, taxable: true, taxRate: true, taxAmt: true, total: true },
  minRows: 5,
  sections: { sellerInfo: true, customerInfo: true, amountInWords: true, pageNumber: true, signatures: false },
};

export interface PrintInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceTime?: string;
  customerName: string;
  customerCode?: string;
  customerTaxNumber?: string;
  customerBuildingNo?: string;
  customerStreet?: string;
  customerDistrict?: string;
  customerCity?: string;
  customerCountry?: string;
  customerPostalCode?: string;
  customerAdditionalNo?: string;
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
  sellerNameEn?: string;
  sellerTaxNumber: string;
  sellerCommercialReg?: string;
  sellerCity?: string;
  sellerCountry?: string;
  sellerBuildingNo?: string;
  sellerStreet?: string;
  sellerDistrict?: string;
  sellerPostalCode?: string;
  sellerAdditionalNo?: string;
  sellerAddress?: string;
  sellerPhone?: string;
}

interface InvoicePrintModalProps {
  open: boolean;
  onClose: () => void;
  data: PrintInvoiceData;
  qrSettings?: QrSettings | null;
  templateConfig?: DocTemplateConfig | null;
}

/* ═══════════════════ Column helpers ═══════════════════ */
type ColKey = keyof DocTemplateConfig["columns"];

type LineCalc = { discountAmt: number; beforeTax: number; taxAmt: number; lineTotal: number };

const COL_DEFS: { key: ColKey; arH: string; enH: string; w?: number; alignRight?: boolean }[] = [
  { key: "num",      arH: "م",                              enH: "No.",                  w: 28  },
  { key: "code",     arH: "رقم الصنف",                     enH: "Item Code",            w: 65  },
  { key: "name",     arH: "تفاصيل السلع/خدمات",            enH: "Item Name",            alignRight: true },
  { key: "unit",     arH: "وحدة",                          enH: "Unit",                 w: 40  },
  { key: "qty",      arH: "كمية",                          enH: "Quantity",             w: 45  },
  { key: "price",    arH: "سعر الوحدة",                    enH: "Unit Price",           w: 65  },
  { key: "discount", arH: "خصومات",                        enH: "Discount",             w: 55  },
  { key: "taxable",  arH: "المبلغ الخاضع للضريبة",        enH: "Taxable Amount",       w: 70  },
  { key: "taxRate",  arH: "نسبة الضريبة",                  enH: "Tax Rate",             w: 42  },
  { key: "taxAmt",   arH: "مبلغ الضريبة",                  enH: "Tax Amount",           w: 65  },
  { key: "total",    arH: "المجموع (شامل ضريبة)",          enH: "SubTotal Incl. VAT",   w: 80  },
];

function computeLines(data: PrintInvoiceData): LineCalc[] {
  return data.lines.map(ln => {
    const qty      = parseFloat(ln.quantity)    || 0;
    const price    = parseFloat(ln.unitPrice)   || 0;
    const discPct  = parseFloat(ln.discountPct) || 0;
    const taxPct   = parseFloat(ln.taxPct)      || 0;
    const gross    = qty * price;
    const discAmt  = gross * discPct / 100;
    const beforeTax = gross - discAmt;
    const taxAmt   = parseFloat(ln.taxAmt) || (beforeTax * taxPct / 100);
    const lineTotal = parseFloat(ln.total)  || (beforeTax + taxAmt);
    return { discountAmt: discAmt, beforeTax, taxAmt, lineTotal };
  });
}

function getColVal(
  key: ColKey,
  ln: PrintInvoiceData["lines"][0],
  calc: LineCalc,
  idx: number,
): string {
  switch (key) {
    case "num":      return String(idx + 1);
    case "code":     return ln.productCode;
    case "name":     return ln.productName;
    case "unit":     return ln.unit;
    case "qty":      return (parseFloat(ln.quantity) || 0).toFixed(2);
    case "price":    return (parseFloat(ln.unitPrice) || 0).toFixed(2);
    case "discount": return calc.discountAmt.toFixed(2);
    case "taxable":  return calc.beforeTax.toFixed(2);
    case "taxRate":  return `${ln.taxPct}%`;
    case "taxAmt":   return calc.taxAmt.toFixed(2);
    case "total":    return calc.lineTotal.toFixed(2);
    default:         return "";
  }
}

/* ═══════════════════ Amount in words ═══════════════════ */
function toArabicWords(n: number, currency = "ريال"): string {
  const ones    = ["","واحد","اثنان","ثلاثة","أربعة","خمسة","ستة","سبعة","ثمانية","تسعة","عشرة",
    "أحد عشر","اثنا عشر","ثلاثة عشر","أربعة عشر","خمسة عشر","ستة عشر","سبعة عشر","ثمانية عشر","تسعة عشر"];
  const tens    = ["","","عشرون","ثلاثون","أربعون","خمسون","ستون","سبعون","ثمانون","تسعون"];
  const hundreds= ["","مئة","مئتان","ثلاثمائة","أربعمائة","خمسمائة","ستمائة","سبعمائة","ثمانمائة","تسعمائة"];
  function b1000(x: number): string {
    if (!x) return "";
    const h = Math.floor(x/100), rem = x%100, t = Math.floor(rem/10), o = rem%10;
    const p: string[] = [];
    if (h) p.push(hundreds[h]);
    if (rem < 20 && rem > 0) p.push(ones[rem]);
    else { if (t) p.push(tens[t]); if (o) p.push(ones[o]); }
    return p.join(" و");
  }
  const intPart = Math.floor(n);
  const decPart = Math.round((n - intPart) * 100);
  if (!intPart && !decPart) return `صفر ${currency}`;
  const parts: string[] = [];
  const M = Math.floor(intPart / 1_000_000), K = Math.floor((intPart % 1_000_000) / 1000), R = intPart % 1000;
  if (M) parts.push(`${b1000(M)} مليون`);
  if (K === 1) parts.push("ألف"); else if (K === 2) parts.push("ألفان"); else if (K > 2) parts.push(`${b1000(K)} آلاف`);
  if (R) parts.push(b1000(R));
  let result = `فقط ${parts.join(" و")} ${currency}`;
  if (decPart) result += ` و${b1000(decPart)} هللة`;
  return result + " لا غير";
}

/* ═══════════════════ Main Component ═══════════════════ */
export default function InvoicePrintModal({ open, onClose, data, qrSettings, templateConfig }: InvoicePrintModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  const cfg = templateConfig ?? DEFAULT_CFG;
  const color = cfg.primaryColor;
  const isBilingual = cfg.language === "bilingual";
  const visibleCols = COL_DEFS.filter(c => cfg.columns[c.key]);
  /** أعمدة الأرقام التي تظهر في سطر المجموع (تُحسب ديناميكياً) */
  const METRIC_KEYS: ColKey[] = ["qty", "discount", "taxable", "taxRate", "taxAmt", "total"];
  const metricsCount = METRIC_KEYS.filter(k => visibleCols.some(c => c.key === k)).length;
  /** عدد الأعمدة التي يمتد عليها خلية "المجموع" = ما تبقى بعد أعمدة الأرقام */
  const labelColSpan = Math.max(1, visibleCols.length - metricsCount);
  const lineCalcs = computeLines(data);
  const minRows = cfg.minRows ?? 5;
  const emptyRows = Math.max(0, minRows - data.lines.length);
  const netExclVAT = data.subtotal - data.discountTotal;
  const amountInWords = cfg.sections.amountInWords ? toArabicWords(data.grandTotal, data.currency) : "";
  const paymentText = data.paymentType === "cash" ? (isBilingual ? "نقداً / Cash" : "نقداً") : (isBilingual ? "آجل / Credit" : "آجل");

  const showQR = !!(qrSettings?.isEnabled && qrSettings?.showOnSalesInvoice);
  const qrLabel = qrSettings?.countrySystem === "zatca" ? "ZATCA QR" : qrSettings?.countrySystem === "eta" ? "ETA QR" : "QR Code";
  const qrSize  = qrSettings?.qrSize ?? 100;

  const qrContent = showQR
    ? generateQrContent(qrSettings!.countrySystem, {
        sellerName: qrSettings?.sellerName || data.sellerName,
        taxNumber:  qrSettings?.taxNumber  || data.sellerTaxNumber,
        invoiceDateTime: `${data.invoiceDate}T${data.invoiceTime ?? "00:00:00"}`,
        totalAmount: data.grandTotal, vatAmount: data.taxTotal,
        invoiceNumber: data.invoiceNumber,
        buyerName: data.customerName, buyerTaxNumber: data.customerTaxNumber,
      } as QrInvoiceData, qrSettings?.customFormat)
    : "";

  useEffect(() => {
    if (!showQR || !qrContent) { setQrDataUrl(""); return; }
    QRCode.toDataURL(qrContent, { width: qrSize * 2, margin: 1, errorCorrectionLevel: "M" })
      .then(url => setQrDataUrl(url)).catch(() => setQrDataUrl(""));
  }, [qrContent, qrSize, showQR]);

  /* ═════════════════ buildPrintHtml ═════════════════ */
  const buildPrintHtml = () => {
    const qrImgHtml = showQR && qrDataUrl
      ? `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">
           <img src="${qrDataUrl}" width="${qrSize}" height="${qrSize}" style="display:block"/>
           <span style="font-size:7px;color:#888">${qrLabel}</span>
         </div>` : "";

    const thStyle = `border:1px solid #000;padding:4px 3px;text-align:center;background:${color};color:#fff;font-size:9px`;
    const tdStyle = `border:1px solid #000;padding:3px 4px;text-align:center;font-size:9px;height:20px`;

    const headersHtml = visibleCols.map(c =>
      `<th style="${thStyle}${c.w ? `;width:${c.w}px` : ""}">
        <div>${c.arH}</div>${isBilingual ? `<div style="font-size:7px;opacity:0.85">${c.enH}</div>` : ""}
      </th>`).join("");

    const linesHtml = data.lines.map((ln, i) => {
      const calc = lineCalcs[i];
      return `<tr>${visibleCols.map(c => {
        const v = getColVal(c.key, ln, calc, i);
        const align = c.alignRight ? "right;padding-right:5px" : "center";
        return `<td style="${tdStyle};text-align:${align}">${v}</td>`;
      }).join("")}</tr>`;
    }).join("");

    const emptyHtml = Array(emptyRows).fill(
      `<tr>${visibleCols.map(() => `<td style="${tdStyle}">&nbsp;</td>`).join("")}</tr>`
    ).join("");

    const sumColSpan = labelColSpan;
    const sumRow = `<tr style="background:#f5f5f5;font-weight:bold">
      <td style="${tdStyle}" colspan="${sumColSpan}">${isBilingual ? "المجموع / Total" : "المجموع"}</td>
      ${cfg.columns.qty ? `<td style="${tdStyle}">${data.lines.reduce((s,l)=>s+(parseFloat(l.quantity)||0),0).toFixed(2)}</td>` : ""}
      ${cfg.columns.discount ? `<td style="${tdStyle}">${data.discountTotal.toFixed(2)}</td>` : ""}
      ${cfg.columns.taxable ? `<td style="${tdStyle}">${netExclVAT.toFixed(2)}</td>` : ""}
      ${cfg.columns.taxRate ? `<td style="${tdStyle}">-</td>` : ""}
      ${cfg.columns.taxAmt ? `<td style="${tdStyle}">${data.taxTotal.toFixed(2)}</td>` : ""}
      ${cfg.columns.total ? `<td style="${tdStyle}">${data.grandTotal.toFixed(2)}</td>` : ""}
    </tr>`;

    const partyRows = (title_ar: string, title_en: string, rows: [string, string, string][]) =>
      `<div style="border:1px solid #ccc;padding:6px;flex:1">
        <div style="font-weight:bold;font-size:10px;color:${color};margin-bottom:4px">
          ${title_ar}${isBilingual ? ` <span style="font-size:8px;color:#888">/ ${title_en}</span>` : ""}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:8px">
          ${rows.map(([ar, en, val]) => `<tr>
            ${isBilingual ? `<td style="color:#888;width:80px;padding:1px 2px" dir="ltr">${en}</td>` : ""}
            <td style="color:#555;width:100px;padding:1px 2px">${ar}</td>
            <td style="font-weight:500;padding:1px 4px">${val}</td>
          </tr>`).join("")}
        </table>
      </div>`;

    const customerRows: [string, string, string][] = [
      ["الإسم", "Name", data.customerName],
      ["رقم المبنى", "Building No", data.customerBuildingNo || ""],
      ["إسم الشارع", "Street Name", data.customerStreet || ""],
      ["الحي", "District", data.customerDistrict || ""],
      ["المدينة", "City", data.customerCity || ""],
      ["البلد", "Country", data.customerCountry || ""],
      ["رقم البريد", "Postal Code", data.customerPostalCode || ""],
      ["رقم العنوان الإضافي", "Additional No", data.customerAdditionalNo || ""],
      ["رقم تسجيل ضريبة القيمة المضافة", "VAT Number", data.customerTaxNumber || ""],
      ["المعرف أخرى", "Other ID", data.customerCode || ""],
    ];
    const sellerRows: [string, string, string][] = [
      ["الإسم", "Name", data.sellerName],
      ["رقم المبنى", "Building No", data.sellerBuildingNo || ""],
      ["إسم الشارع", "Street Name", data.sellerStreet || ""],
      ["سجل تجاري", "Commercial Reg", data.sellerCommercialReg || ""],
      ["المدينة", "City", data.sellerCity || ""],
      ["البلد", "Country", data.sellerCountry || "المملكة العربية السعودية"],
      ["رقم البريد", "Postal Code", data.sellerPostalCode || ""],
      ["رقم العنوان الإضافي", "Additional No", data.sellerAdditionalNo || ""],
      ["رقم تسجيل ضريبة القيمة المضافة", "VAT Number", data.sellerTaxNumber || ""],
      ["المعرف أخرى", "Other ID", ""],
    ];

    const summaryRows = [
      { ar: "الإجمالي غير شامل ضريبة المضافة", en: "Total (Excluding VAT)", val: data.subtotal.toFixed(2) },
      { ar: "تخفيض", en: "Discount", val: data.discountTotal.toFixed(2) },
      { ar: "الصافي غير شامل ضريبة المضافة", en: "Net (Excluding VAT)", val: netExclVAT.toFixed(2) },
      { ar: "مجموعة ضريبة القيمة المضافة", en: "Total VAT", val: data.taxTotal.toFixed(2) },
      { ar: "إجمالي المبلغ المستحق", en: "Total Amount due", val: data.grandTotal.toFixed(2), grand: true },
    ];
    const summaryHtml = summaryRows.map(r =>
      `<tr style="${r.grand ? "background:#e8f5e8;font-weight:bold" : ""}">
        <td style="border:1px solid #000;padding:5px 8px;font-weight:bold;width:120px;text-align:center">${r.val}</td>
        <td style="border:1px solid #000;padding:5px 8px;text-align:right">
          ${r.ar}${isBilingual ? ` <span style="font-size:8px;color:#777;float:left">${r.en}</span>` : ""}
        </td>
      </tr>`).join("");

    return `<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="utf-8"/>
<title>فاتورة ${data.invoiceNumber}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Tahoma','Arial',sans-serif;font-size:10px;color:#000;background:#fff;direction:rtl}
  .page{padding:14px 18px;max-width:980px;margin:auto}
  @media print{body{margin:0}.page{padding:10px}}
</style>
</head>
<body><div class="page">

  <!-- رأس الفاتورة -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    ${isBilingual ? `<div style="text-align:left;flex:1">
      <div style="font-size:13px;font-weight:bold;color:${color}">${data.sellerNameEn || data.sellerName}</div>
      ${data.sellerAddress ? `<div style="font-size:8px;color:#555">${data.sellerAddress}</div>` : ""}
    </div>` : `<div></div>`}
    <div style="text-align:center;flex:1">
      <div style="font-size:18px;font-weight:bold;color:#111;border:2px solid ${color};padding:6px 18px;display:inline-block">
        فاتورة ضريبية${isBilingual ? `<br><span style="font-size:13px">TAX INVOICE</span>` : ""}
      </div>
    </div>
    <div style="text-align:right;flex:1">
      <div style="font-size:14px;font-weight:bold;color:${color}">${data.sellerName}</div>
      ${data.sellerPhone ? `<div style="font-size:8px;color:#555">Tel: ${data.sellerPhone}</div>` : ""}
    </div>
  </div>

  <!-- بيانات الفاتورة -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:6px;font-size:9px;border:1px solid #ccc">
    <tr>
      <td style="padding:3px 6px;border:1px solid #ccc;color:#888">${isBilingual ? "رقم الفاتورة / Invoice No" : "رقم الفاتورة"}</td>
      <td style="padding:3px 6px;border:1px solid #ccc;font-weight:bold">${data.invoiceNumber}</td>
      <td style="padding:3px 6px;border:1px solid #ccc;color:#888">${isBilingual ? "تاريخ التحرير / Issue Date" : "التاريخ"}</td>
      <td style="padding:3px 6px;border:1px solid #ccc;font-weight:bold">${data.invoiceDate}</td>
    </tr>
    <tr>
      <td style="padding:3px 6px;border:1px solid #ccc;color:#888">${isBilingual ? "نوع السند / Type" : "نوع الدفع"}</td>
      <td style="padding:3px 6px;border:1px solid #ccc;font-weight:bold">${paymentText}</td>
      <td style="padding:3px 6px;border:1px solid #ccc;color:#888">${isBilingual ? "بائع / Sales man" : "مندوب البيع"}</td>
      <td style="padding:3px 6px;border:1px solid #ccc;font-weight:bold">${data.salesperson || ""}</td>
    </tr>
  </table>

  <!-- العميل والبائع -->
  <div style="display:flex;gap:6px;margin-bottom:6px">
    ${cfg.sections.customerInfo ? partyRows("العميل", "Customer", customerRows) : ""}
    ${cfg.sections.sellerInfo   ? partyRows("البائع / المورد", "Seller", sellerRows) : ""}
  </div>

  ${data.notes ? `<div style="border:1px solid #ccc;padding:4px 8px;margin-bottom:6px;font-size:9px"><strong>ملحوظة / Remark:</strong> ${data.notes}</div>` : ""}

  <!-- جدول الأصناف -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:6px">
    <thead><tr>${headersHtml}</tr></thead>
    <tbody>${linesHtml}${emptyHtml}${sumRow}</tbody>
  </table>

  <!-- ملخص المبالغ -->
  <div style="display:flex;gap:0;margin-bottom:6px;border:1px solid #000">
    ${showQR && qrDataUrl ? `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;border-left:1px solid #000;min-width:${qrSize+20}px">${qrImgHtml}</div>` : ""}
    <div style="flex:1">
      <table style="width:100%;border-collapse:collapse">
        ${summaryHtml}
      </table>
    </div>
  </div>

  ${cfg.sections.amountInWords ? `<div style="border:1px solid #000;padding:5px 8px;margin-bottom:4px;font-size:10px;font-weight:bold"><u>${amountInWords}</u></div>` : ""}

  ${cfg.sections.signatures ? `
  <div style="display:flex;justify-content:space-around;margin-top:24px;padding-top:8px">
    ${["المدير", "المحاسب", "المستلم"].map(s => `
    <div style="text-align:center;width:180px">
      <div style="border-top:1px solid #999;padding-top:4px;font-size:9px;color:#555">${s}</div>
    </div>`).join("")}
  </div>` : ""}

  ${cfg.sections.pageNumber ? `<div style="display:flex;justify-content:space-between;font-size:9px;color:#888;margin-top:6px;border-top:1px solid #eee;padding-top:4px">
    <span>OneSoft ERP</span><span>صفحة 1 من 1 / Page 1 of 1</span>
  </div>` : ""}

</div></body></html>`;
  };

  /* ═════════════════ Print handler ═════════════════ */
  const handlePrint = () => {
    const win = window.open("", "_blank", "width=980,height=1100");
    if (!win) return;
    win.document.write(buildPrintHtml());
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  if (!open) return null;

  /* ═════════════════ JSX Preview ═════════════════ */
  const thStyle: React.CSSProperties = {
    border: "1px solid #000", padding: "4px 3px", textAlign: "center",
    background: color, color: "#fff", fontSize: 9, fontWeight: "bold",
  };
  const tdStyle: React.CSSProperties = {
    border: "1px solid #000", padding: "3px 4px", textAlign: "center", fontSize: 9, height: 20,
  };

  const PartyBox = ({ titleAr, titleEn, rows }: { titleAr: string; titleEn: string; rows: [string, string, string][] }) => (
    <div className="flex-1 border border-gray-300 rounded p-2">
      <div className="font-bold text-[10px] mb-1" style={{ color }}>
        {titleAr} {isBilingual && <span className="text-gray-400 font-normal text-[8px]">/ {titleEn}</span>}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 8 }}>
        <tbody>
          {rows.map(([ar, en, val], i) => (
            <tr key={i}>
              {isBilingual && <td className="text-gray-400 pr-1 py-0.5" style={{ width: 70 }} dir="ltr">{en}</td>}
              <td className="text-gray-500 py-0.5" style={{ width: 90 }}>{ar}</td>
              <td className="font-medium py-0.5 px-1">{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const customerRows: [string, string, string][] = [
    ["الإسم", "Name", data.customerName],
    ["رقم المبنى", "Building No", data.customerBuildingNo || ""],
    ["إسم الشارع", "Street Name", data.customerStreet || ""],
    ["الحي", "District", data.customerDistrict || ""],
    ["المدينة", "City", data.customerCity || ""],
    ["البلد", "Country", data.customerCountry || ""],
    ["رقم البريد", "Postal Code", data.customerPostalCode || ""],
    ["رقم العنوان الإضافي", "Additional No", data.customerAdditionalNo || ""],
    ["رقم تسجيل ضريبة القيمة المضافة", "VAT Number", data.customerTaxNumber || ""],
    ["المعرف أخرى", "Other ID", data.customerCode || ""],
  ];
  const sellerRows: [string, string, string][] = [
    ["الإسم", "Name", data.sellerName],
    ["رقم المبنى", "Building No", data.sellerBuildingNo || ""],
    ["إسم الشارع", "Street Name", data.sellerStreet || ""],
    ["سجل تجاري", "Commercial Reg", data.sellerCommercialReg || ""],
    ["المدينة", "City", data.sellerCity || ""],
    ["البلد", "Country", data.sellerCountry || "المملكة العربية السعودية"],
    ["رقم البريد", "Postal Code", data.sellerPostalCode || ""],
    ["رقم العنوان الإضافي", "Additional No", data.sellerAdditionalNo || ""],
    ["رقم تسجيل ضريبة القيمة المضافة", "VAT Number", data.sellerTaxNumber || ""],
    ["المعرف أخرى", "Other ID", ""],
  ];

  const summaryRows = [
    { ar: "الإجمالي غير شامل ضريبة المضافة", en: "Total (Excluding VAT)", val: data.subtotal.toFixed(2) },
    { ar: "تخفيض", en: "Discount", val: data.discountTotal.toFixed(2) },
    { ar: "الصافي غير شامل ضريبة المضافة", en: "Net (Excluding VAT)", val: netExclVAT.toFixed(2) },
    { ar: "مجموعة ضريبة القيمة المضافة", en: "Total VAT", val: data.taxTotal.toFixed(2) },
    { ar: "إجمالي المبلغ المستحق", en: "Total Amount due", val: data.grandTotal.toFixed(2), grand: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 shrink-0 shadow-md" style={{ background: color }}>
        <FileText className="w-5 h-5 text-white/80" />
        <span className="text-white font-bold text-base flex-1">
          معاينة الطباعة — فاتورة {data.invoiceNumber}
          {cfg.language === "bilingual" && <span className="text-white/60 font-normal text-sm mr-2">| INV01 ثنائي اللغة</span>}
        </span>
        <Button size="sm" onClick={handlePrint}
          className="bg-white hover:bg-gray-100 h-8 px-4 text-sm font-bold gap-1"
          style={{ color }}>
          <Printer className="w-4 h-4" />طباعة / PDF
        </Button>
        <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-y-auto bg-gray-300">
        <div className="bg-white shadow-xl my-6 mx-auto p-6 w-full max-w-5xl"
          style={{ fontFamily: "Tahoma, Arial, sans-serif", direction: "rtl", fontSize: 10 }}>

          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            {isBilingual && (
              <div className="text-left flex-1">
                <div className="font-bold text-[13px]" style={{ color }}>{data.sellerNameEn || data.sellerName}</div>
                {data.sellerAddress && <div className="text-[8px] text-gray-500">{data.sellerAddress}</div>}
              </div>
            )}
            <div className="flex-1 flex flex-col items-center">
              <div className="font-bold text-[18px] text-center border-2 px-5 py-1.5 leading-tight" style={{ borderColor: color }}>
                <div>فاتورة ضريبية</div>
                {isBilingual && <div className="text-[13px]">TAX INVOICE</div>}
              </div>
            </div>
            <div className="text-right flex-1">
              <div className="font-bold text-[14px]" style={{ color }}>{data.sellerName}</div>
              {data.sellerPhone && <div className="text-[8px] text-gray-500">Tel: {data.sellerPhone}</div>}
            </div>
          </div>

          {/* Invoice Metadata */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6, fontSize: 9, border: "1px solid #ccc" }}>
            <tbody>
              <tr>
                <td className="px-2 py-1 border border-gray-200 text-gray-400">
                  {isBilingual ? "رقم الفاتورة / Invoice No" : "رقم الفاتورة"}
                </td>
                <td className="px-2 py-1 border border-gray-200 font-bold">{data.invoiceNumber}</td>
                <td className="px-2 py-1 border border-gray-200 text-gray-400">
                  {isBilingual ? "تاريخ التحرير / Issue Date" : "التاريخ"}
                </td>
                <td className="px-2 py-1 border border-gray-200 font-bold">{data.invoiceDate}</td>
              </tr>
              <tr>
                <td className="px-2 py-1 border border-gray-200 text-gray-400">
                  {isBilingual ? "نوع السند / Type" : "نوع الدفع"}
                </td>
                <td className="px-2 py-1 border border-gray-200 font-bold">{paymentText}</td>
                <td className="px-2 py-1 border border-gray-200 text-gray-400">
                  {isBilingual ? "بائع / Sales man" : "مندوب البيع"}
                </td>
                <td className="px-2 py-1 border border-gray-200 font-bold">{data.salesperson || ""}</td>
              </tr>
            </tbody>
          </table>

          {/* Customer & Seller */}
          <div className="flex gap-2 mb-3">
            {cfg.sections.customerInfo && (
              <PartyBox titleAr="العميل" titleEn="Customer" rows={customerRows} />
            )}
            {cfg.sections.sellerInfo && (
              <PartyBox titleAr="البائع / المورد" titleEn="Seller" rows={sellerRows} />
            )}
          </div>

          {data.notes && (
            <div className="border border-gray-200 px-3 py-1.5 mb-3 text-[9px] rounded">
              <strong>{isBilingual ? "ملحوظة / Remark:" : "ملاحظات:"}</strong> {data.notes}
            </div>
          )}

          {/* Items Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6 }}>
            <thead>
              <tr>
                {visibleCols.map(c => (
                  <th key={c.key} style={{ ...thStyle, width: c.w || undefined }}>
                    <div>{c.arH}</div>
                    {isBilingual && <div style={{ fontSize: 7, opacity: 0.85 }}>{c.enH}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.lines.map((ln, i) => (
                <tr key={i}>
                  {visibleCols.map(c => (
                    <td key={c.key} style={{ ...tdStyle, textAlign: c.alignRight ? "right" : "center", paddingRight: c.alignRight ? 5 : undefined }}>
                      {getColVal(c.key, ln, lineCalcs[i], i)}
                    </td>
                  ))}
                </tr>
              ))}
              {Array(emptyRows).fill(null).map((_, i) => (
                <tr key={`e-${i}`}>
                  {visibleCols.map(c => <td key={c.key} style={tdStyle}>&nbsp;</td>)}
                </tr>
              ))}
              <tr style={{ background: "#f5f5f5", fontWeight: "bold" }}>
                <td style={tdStyle} colSpan={labelColSpan}>
                  {isBilingual ? "المجموع / Total" : "المجموع"}
                </td>
                {cfg.columns.qty      && <td style={tdStyle}>{data.lines.reduce((s,l)=>s+(parseFloat(l.quantity)||0),0).toFixed(2)}</td>}
                {cfg.columns.discount && <td style={tdStyle}>{data.discountTotal.toFixed(2)}</td>}
                {cfg.columns.taxable  && <td style={tdStyle}>{netExclVAT.toFixed(2)}</td>}
                {cfg.columns.taxRate  && <td style={tdStyle}>-</td>}
                {cfg.columns.taxAmt   && <td style={tdStyle}>{data.taxTotal.toFixed(2)}</td>}
                {cfg.columns.total    && <td style={tdStyle}>{data.grandTotal.toFixed(2)}</td>}
              </tr>
            </tbody>
          </table>

          {/* Summary + QR */}
          <div className="flex mb-2" style={{ border: "1px solid #000" }}>
            {showQR && qrDataUrl && (
              <div className="flex flex-col items-center justify-center gap-1 p-3" style={{ borderLeft: "1px solid #000", minWidth: 120 }}>
                <img src={qrDataUrl} width={qrSize} height={qrSize} alt="QR" />
                <span className="text-[7px] text-gray-400">{qrLabel}</span>
              </div>
            )}
            <table style={{ flex: 1, borderCollapse: "collapse", width: "100%" }}>
              <tbody>
                {summaryRows.map((row, i) => (
                  <tr key={i} style={row.grand ? { background: "#e8f5e8", fontWeight: "bold" } : {}}>
                    <td style={{ border: "1px solid #000", padding: "5px 8px", textAlign: "center", fontWeight: "bold", width: 120, fontSize: row.grand ? 12 : 10 }}>
                      {row.val}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "5px 10px", textAlign: "right", fontSize: row.grand ? 12 : 10 }}>
                      {row.ar}
                      {isBilingual && <span className="float-left text-[8px] text-gray-500">{row.en}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Amount in Words */}
          {cfg.sections.amountInWords && (
            <div className="px-3 py-2 mb-2 text-[10px] font-bold" style={{ border: "1px solid #000" }}>
              <u>{amountInWords}</u>
            </div>
          )}

          {/* Signatures */}
          {cfg.sections.signatures && (
            <div className="flex justify-around mt-6 pt-3">
              {["المدير", "المحاسب", "المستلم"].map(s => (
                <div key={s} className="text-center w-44">
                  <div className="border-t border-gray-400 pt-1 text-[9px] text-gray-500">{s}</div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {cfg.sections.pageNumber && (
            <div className="flex justify-between text-[8px] text-gray-400 mt-3 pt-2 border-t border-gray-200">
              <span>OneSoft ERP</span>
              <span>صفحة 1 من 1 {isBilingual ? "/ Page 1 of 1" : ""}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
