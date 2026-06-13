/**
 * buildInvoiceHtml.ts — دالة مستقلة لتوليد HTML الفاتورة الضريبية
 * تُستخدم في SalesInvoicePage لتوليد PDF قابل للطباعة
 * (مستقلة تماماً — لا تستورد من InvoicePrintModal)
 */

/* ══════════════ Types (نسخة مستقلة) ══════════════ */
export type InvDocTemplateConfig = {
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

export interface InvPrintData {
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

/* ══════════════ Arabic Words ══════════════ */
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

/* ══════════════ Column Definitions ══════════════ */
type ColKey = keyof InvDocTemplateConfig["columns"];
const COL_DEFS: { key: ColKey; arH: string; enH: string; w?: number; alignRight?: boolean }[] = [
  { key: "num",      arH: "م",                         enH: "No",                w: 28 },
  { key: "code",     arH: "رقم الصنف",                 enH: "Item Code",         w: 70 },
  { key: "name",     arH: "تفاصيل السلع/خدمات",        enH: "Item Name",         alignRight: true },
  { key: "unit",     arH: "وحدة",                      enH: "Unit",              w: 42 },
  { key: "qty",      arH: "كمية",                      enH: "Quantity",          w: 52 },
  { key: "price",    arH: "سعر الوحدة",                enH: "Unit Price",        w: 62 },
  { key: "discount", arH: "خصومات",                    enH: "Discount",          w: 58 },
  { key: "taxable",  arH: "المبلغ الخاضع للضريبة",     enH: "Taxable Amount",    w: 80 },
  { key: "taxRate",  arH: "نسبة الضريبة",              enH: "Tax Rate",          w: 52 },
  { key: "taxAmt",   arH: "مبلغ الضريبة",              enH: "Tax Amount",        w: 68 },
  { key: "total",    arH: "المجموع (شامل ضريبة)",      enH: "SubTotal Incl VAT", w: 80 },
];

/* ══════════════ Compute line values ══════════════ */
function computeLines(data: InvPrintData) {
  return data.lines.map(ln => {
    const qty     = parseFloat(ln.quantity)    || 0;
    const price   = parseFloat(ln.unitPrice)   || 0;
    const discPct = parseFloat(ln.discountPct) || 0;
    const taxPct  = parseFloat(ln.taxPct)      || 0;
    const preDisc = qty * price;
    const discAmt = preDisc * discPct / 100;
    const taxable = preDisc - discAmt;
    const taxAmt  = taxable * taxPct / 100;
    return { preDisc, discAmt, taxable, taxAmt, totalWithTax: taxable + taxAmt };
  });
}

function getColVal(key: ColKey, ln: InvPrintData["lines"][0], calc: ReturnType<typeof computeLines>[0], idx: number): string {
  switch (key) {
    case "num":      return String(idx + 1);
    case "code":     return ln.productCode;
    case "name":     return ln.productName;
    case "unit":     return ln.unit;
    case "qty":      return ln.quantity;
    case "price":    return parseFloat(ln.unitPrice).toFixed(2);
    case "discount": return calc.discAmt.toFixed(2);
    case "taxable":  return calc.taxable.toFixed(2);
    case "taxRate":  return ln.taxPct + "%";
    case "taxAmt":   return calc.taxAmt.toFixed(2);
    case "total":    return calc.totalWithTax.toFixed(2);
  }
}

const DEFAULT_CFG: InvDocTemplateConfig = {
  type: "config_v1",
  language: "bilingual",
  primaryColor: "#406B93",
  columns: { num: true, code: true, name: true, unit: false, qty: true, price: true,
    discount: true, taxable: true, taxRate: true, taxAmt: true, total: true },
  minRows: 5,
  sections: { sellerInfo: true, customerInfo: true, amountInWords: true, pageNumber: true, signatures: false },
};

/* ══════════════ Main Export ══════════════ */
export function buildInvoiceHtml(
  data: InvPrintData,
  cfg?: InvDocTemplateConfig | null,
  qrDataUrl?: string,
  qrLabel = "QR Code",
  qrSize = 100,
): string {
  const C = cfg ?? DEFAULT_CFG;
  const color = C.primaryColor;
  const isBilingual = C.language === "bilingual";
  const visibleCols = COL_DEFS.filter(c => C.columns[c.key]);
  const METRIC_KEYS: ColKey[] = ["qty", "discount", "taxable", "taxRate", "taxAmt", "total"];
  const metricsCount = METRIC_KEYS.filter(k => visibleCols.some(c => c.key === k)).length;
  const labelColSpan = Math.max(1, visibleCols.length - metricsCount);
  const lineCalcs = computeLines(data);
  const minRows = C.minRows ?? 5;
  const emptyRows = Math.max(0, minRows - data.lines.length);
  const netExclVAT = data.subtotal - data.discountTotal;
  const amountInWords = C.sections.amountInWords ? toArabicWords(data.grandTotal, data.currency) : "";
  const paymentText = data.paymentType === "cash"
    ? (isBilingual ? "نقداً / Cash" : "نقداً")
    : (isBilingual ? "آجل / Credit" : "آجل");

  const qrImgHtml = qrDataUrl
    ? `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">
         <img src="${qrDataUrl}" width="${qrSize}" height="${qrSize}" style="display:block"/>
         <span style="font-size:7px;color:#888">${qrLabel}</span>
       </div>` : "";

  const thS = `border:1px solid #000;padding:4px 3px;text-align:center;background:${color};color:#fff;font-size:9px`;
  const tdS = `border:1px solid #000;padding:3px 4px;text-align:center;font-size:9px;height:20px`;

  const headersHtml = visibleCols.map(c =>
    `<th style="${thS}${c.w ? `;width:${c.w}px` : ""}">
      <div>${c.arH}</div>${isBilingual ? `<div style="font-size:7px;opacity:0.85">${c.enH}</div>` : ""}
    </th>`).join("");

  const linesHtml = data.lines.map((ln, i) => {
    const calc = lineCalcs[i];
    return `<tr>${visibleCols.map(c => {
      const v = getColVal(c.key, ln, calc, i);
      const align = c.alignRight ? "right;padding-right:5px" : "center";
      return `<td style="${tdS};text-align:${align}">${v}</td>`;
    }).join("")}</tr>`;
  }).join("");

  const emptyHtml = Array(emptyRows).fill(
    `<tr>${visibleCols.map(() => `<td style="${tdS}">&nbsp;</td>`).join("")}</tr>`
  ).join("");

  const sumRow = `<tr style="background:#f5f5f5;font-weight:bold">
    <td style="${tdS}" colspan="${labelColSpan}">${isBilingual ? "المجموع / Total" : "المجموع"}</td>
    ${C.columns.qty      ? `<td style="${tdS}">${data.lines.reduce((s,l)=>s+(parseFloat(l.quantity)||0),0).toFixed(2)}</td>` : ""}
    ${C.columns.discount ? `<td style="${tdS}">${data.discountTotal.toFixed(2)}</td>` : ""}
    ${C.columns.taxable  ? `<td style="${tdS}">${netExclVAT.toFixed(2)}</td>` : ""}
    ${C.columns.taxRate  ? `<td style="${tdS}">-</td>` : ""}
    ${C.columns.taxAmt   ? `<td style="${tdS}">${data.taxTotal.toFixed(2)}</td>` : ""}
    ${C.columns.total    ? `<td style="${tdS}">${data.grandTotal.toFixed(2)}</td>` : ""}
  </tr>`;

  const partyBox = (titleAr: string, titleEn: string, rows: [string, string, string][]) =>
    `<div style="border:1px solid #ccc;padding:6px;flex:1">
      <div style="font-weight:bold;font-size:10px;color:${color};margin-bottom:4px">
        ${titleAr}${isBilingual ? ` <span style="font-size:8px;color:#888">/ ${titleEn}</span>` : ""}
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

  const summaryHtml = [
    { ar: "الإجمالي غير شامل ضريبة المضافة", en: "Total (Excluding VAT)", val: data.subtotal.toFixed(2) },
    { ar: "تخفيض", en: "Discount", val: data.discountTotal.toFixed(2) },
    { ar: "الصافي غير شامل ضريبة المضافة", en: "Net (Excluding VAT)", val: netExclVAT.toFixed(2) },
    { ar: "مجموعة ضريبة القيمة المضافة", en: "Total VAT", val: data.taxTotal.toFixed(2) },
    { ar: "إجمالي المبلغ المستحق", en: "Total Amount due", val: data.grandTotal.toFixed(2), grand: true },
  ].map(r =>
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

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    ${isBilingual ? `<div style="text-align:left;flex:1">
      <div style="font-size:13px;font-weight:bold;color:${color}">${data.sellerNameEn || data.sellerName}</div>
      ${data.sellerAddress ? `<div style="font-size:8px;color:#555">${data.sellerAddress}</div>` : ""}
    </div>` : `<div></div>`}
    <div style="text-align:center;flex:1">
      <div style="font-size:18px;font-weight:bold;border:2px solid ${color};padding:6px 18px;display:inline-block;line-height:1.4">
        فاتورة ضريبية${isBilingual ? `<br><span style="font-size:13px">TAX INVOICE</span>` : ""}
      </div>
    </div>
    <div style="text-align:right;flex:1">
      <div style="font-size:14px;font-weight:bold;color:${color}">${data.sellerName}</div>
      ${data.sellerPhone ? `<div style="font-size:8px;color:#555">Tel: ${data.sellerPhone}</div>` : ""}
    </div>
  </div>

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

  <div style="display:flex;gap:6px;margin-bottom:6px">
    ${C.sections.customerInfo ? partyBox("العميل", "Customer", customerRows) : ""}
    ${C.sections.sellerInfo   ? partyBox("البائع / المورد", "Seller", sellerRows) : ""}
  </div>

  ${data.notes ? `<div style="border:1px solid #ccc;padding:4px 8px;margin-bottom:6px;font-size:9px"><strong>ملحوظة / Remark:</strong> ${data.notes}</div>` : ""}

  <table style="width:100%;border-collapse:collapse;margin-bottom:6px">
    <thead><tr>${headersHtml}</tr></thead>
    <tbody>${linesHtml}${emptyHtml}${sumRow}</tbody>
  </table>

  <div style="display:flex;gap:0;margin-bottom:6px;border:1px solid #000">
    ${qrDataUrl ? `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;border-left:1px solid #000;min-width:${qrSize+20}px">${qrImgHtml}</div>` : ""}
    <div style="flex:1"><table style="width:100%;border-collapse:collapse">${summaryHtml}</table></div>
  </div>

  ${C.sections.amountInWords ? `<div style="border:1px solid #000;padding:5px 8px;margin-bottom:4px;font-size:10px;font-weight:bold"><u>${amountInWords}</u></div>` : ""}

  ${C.sections.signatures ? `<div style="display:flex;justify-content:space-around;margin-top:24px;padding-top:8px">
    ${["المدير","المحاسب","المستلم"].map(s=>`<div style="text-align:center;width:180px"><div style="border-top:1px solid #999;padding-top:4px;font-size:9px;color:#555">${s}</div></div>`).join("")}
  </div>` : ""}

  ${C.sections.pageNumber ? `<div style="display:flex;justify-content:space-between;font-size:9px;color:#888;margin-top:6px;border-top:1px solid #eee;padding-top:4px">
    <span>OneSoft ERP</span><span>صفحة 1 من 1 / Page 1 of 1</span>
  </div>` : ""}

</div></body></html>`;
}
