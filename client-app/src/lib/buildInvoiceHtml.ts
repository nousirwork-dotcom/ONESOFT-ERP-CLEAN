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
  paymentType: "cash" | "credit" | "partial";
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
  { key: "num",      arH: "م",                         enH: "No",                w: 26 },
  { key: "code",     arH: "رمز الصنف",                 enH: "Item Code",         w: 66 },
  { key: "name",     arH: "تفاصيل السلع / الخدمات",    enH: "Description",       alignRight: true },
  { key: "unit",     arH: "وحدة",                      enH: "Unit",              w: 40 },
  { key: "qty",      arH: "الكمية",                    enH: "Qty",               w: 48 },
  { key: "price",    arH: "سعر الوحدة",                enH: "Unit Price",        w: 60 },
  { key: "discount", arH: "الخصم",                     enH: "Discount",          w: 54 },
  { key: "taxable",  arH: "المبلغ الخاضع",             enH: "Taxable",           w: 66 },
  { key: "taxRate",  arH: "نسبة الضريبة",              enH: "Tax %",             w: 48 },
  { key: "taxAmt",   arH: "مبلغ الضريبة",              enH: "VAT Amount",        w: 62 },
  { key: "total",    arH: "الإجمالي (شامل ضريبة)",     enH: "Total Incl. VAT",   w: 76 },
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

/* ══════════════ Helpers ══════════════ */
function hex2rgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

/* ══════════════ Main Export ══════════════ */
export function buildInvoiceHtml(
  data: InvPrintData,
  cfg?: InvDocTemplateConfig | null,
  qrDataUrl?: string,
  qrLabel = "QR Code",
  qrSize = 100,
): string {
  const C        = cfg ?? DEFAULT_CFG;
  const color    = C.primaryColor;
  const colorRgb = hex2rgb(color);
  const isBi     = C.language === "bilingual";
  const visibleCols  = COL_DEFS.filter(c => C.columns[c.key]);
  const METRIC_KEYS: ColKey[] = ["qty", "discount", "taxable", "taxRate", "taxAmt", "total"];
  const metricsCount = METRIC_KEYS.filter(k => visibleCols.some(c => c.key === k)).length;
  const labelColSpan = Math.max(1, visibleCols.length - metricsCount);
  const lineCalcs    = computeLines(data);
  const minRows      = C.minRows ?? 5;
  const emptyRows    = Math.max(0, minRows - data.lines.length);
  const netExclVAT   = data.subtotal - data.discountTotal;
  const amountWords  = C.sections.amountInWords ? toArabicWords(data.grandTotal, data.currency || "ريال") : "";

  const paymentText =
    data.paymentType === "cash"    ? (isBi ? "نقداً / Cash"       : "نقداً") :
    data.paymentType === "partial" ? (isBi ? "جزئي / Partial"     : "جزئي") :
                                     (isBi ? "آجل / Credit"       : "آجل");

  /* ─── Items table HTML ─── */
  const thS  = `border:1px solid rgba(${colorRgb},0.8);padding:4px 3px;text-align:center;background:${color};color:#fff;font-size:8.5px;vertical-align:middle`;
  const tdS  = `border:1px solid #d0d5dd;padding:2.5px 3px;text-align:center;font-size:8.5px;height:19px;vertical-align:middle`;
  const tdSR = `${tdS};text-align:right;padding-right:5px`;

  const headersHtml = visibleCols.map(c =>
    `<th style="${thS}${c.w ? `;width:${c.w}px` : ""}">
      <div style="font-weight:bold">${c.arH}</div>
      ${isBi ? `<div style="font-size:7px;opacity:0.82;font-weight:normal">${c.enH}</div>` : ""}
    </th>`
  ).join("");

  const linesHtml = data.lines.map((ln, i) => {
    const calc = lineCalcs[i];
    const bg   = i % 2 === 1 ? "background:#f7f9fc" : "";
    return `<tr style="${bg}">${visibleCols.map(c => {
      const v   = getColVal(c.key, ln, calc, i);
      const sty = c.alignRight ? tdSR : tdS;
      return `<td style="${sty}">${v}</td>`;
    }).join("")}</tr>`;
  }).join("");

  const emptyHtml = Array(emptyRows).fill(null).map((_, i) => {
    const bg = (data.lines.length + i) % 2 === 1 ? "background:#f7f9fc" : "";
    return `<tr style="${bg}">${visibleCols.map(() => `<td style="${tdS}">&nbsp;</td>`).join("")}</tr>`;
  }).join("");

  const sumRowStyle = `background:#eef2f8;font-weight:bold;font-size:8.5px`;
  const sumRow = `<tr style="${sumRowStyle}">
    <td style="${tdSR};border:1px solid #d0d5dd" colspan="${labelColSpan}">${isBi ? "المجموع / Total" : "المجموع"}</td>
    ${C.columns.qty      ? `<td style="${tdS}">${data.lines.reduce((s,l)=>s+(parseFloat(l.quantity)||0),0).toFixed(2)}</td>` : ""}
    ${C.columns.discount ? `<td style="${tdS}">${data.discountTotal.toFixed(2)}</td>` : ""}
    ${C.columns.taxable  ? `<td style="${tdS}">${netExclVAT.toFixed(2)}</td>` : ""}
    ${C.columns.taxRate  ? `<td style="${tdS}">—</td>` : ""}
    ${C.columns.taxAmt   ? `<td style="${tdS}">${data.taxTotal.toFixed(2)}</td>` : ""}
    ${C.columns.total    ? `<td style="${tdS}">${data.grandTotal.toFixed(2)}</td>` : ""}
  </tr>`;

  /* ─── Party box builder ─── */
  type Row3 = [string, string, string];
  const partyBox = (titleAr: string, titleEn: string, rows: Row3[]) => {
    const filtered = rows.filter(r => r[2]);
    return `<div style="flex:1;border:1px solid #ccc;overflow:hidden;border-radius:3px">
      <div style="background:${color};color:#fff;padding:3px 8px;font-size:9.5px;font-weight:bold">
        ${titleAr}${isBi ? ` <span style="font-size:8px;font-weight:normal;opacity:0.85">/ ${titleEn}</span>` : ""}
      </div>
      <div style="padding:5px 8px">
        <table style="width:100%;border-collapse:collapse;font-size:8px">
          ${filtered.map(([ar, en, val]) => `<tr>
            ${isBi ? `<td style="color:#888;width:82px;padding:1.5px 2px;vertical-align:top" dir="ltr">${en}:</td>` : ""}
            <td style="color:#555;width:${isBi ? 85 : 100}px;padding:1.5px 2px;vertical-align:top">${ar}:</td>
            <td style="font-weight:500;padding:1.5px 4px;vertical-align:top">${val}</td>
          </tr>`).join("")}
        </table>
      </div>
    </div>`;
  };

  const customerRows: Row3[] = [
    ["الإسم",                    "Name",           data.customerName],
    ["رقم تسجيل ضريبة القيمة المضافة", "VAT Number", data.customerTaxNumber || ""],
    ["رقم المبنى",               "Building No",    data.customerBuildingNo || ""],
    ["إسم الشارع",               "Street",         data.customerStreet || ""],
    ["الحي",                     "District",       data.customerDistrict || ""],
    ["المدينة",                  "City",           data.customerCity || ""],
    ["الدولة",                   "Country",        data.customerCountry || ""],
    ["الرمز البريدي",            "Postal Code",    data.customerPostalCode || ""],
    ["الرقم الإضافي",            "Additional No",  data.customerAdditionalNo || ""],
    ["رقم / كود العميل",         "Customer ID",    data.customerCode || ""],
  ];

  const sellerRows: Row3[] = [
    ["الإسم",                    "Name",           data.sellerName],
    ["رقم تسجيل ضريبة القيمة المضافة", "VAT Number", data.sellerTaxNumber || ""],
    ["السجل التجاري",             "Comm. Reg",      data.sellerCommercialReg || ""],
    ["رقم المبنى",               "Building No",    data.sellerBuildingNo || ""],
    ["إسم الشارع",               "Street",         data.sellerStreet || ""],
    ["الحي",                     "District",       data.sellerDistrict || ""],
    ["المدينة",                  "City",           data.sellerCity || ""],
    ["الدولة",                   "Country",        data.sellerCountry || "المملكة العربية السعودية"],
    ["الرمز البريدي",            "Postal Code",    data.sellerPostalCode || ""],
    ["هاتف",                     "Phone",          data.sellerPhone || ""],
  ];

  /* ─── Summary rows ─── */
  const summaryRows = [
    { ar: "الإجمالي (غير شامل ضريبة القيمة المضافة)", en: "Total (Excl. VAT)",  val: data.subtotal.toFixed(2),      grand: false },
    { ar: "الخصم",                                    en: "Discount",           val: `(${data.discountTotal.toFixed(2)})`, grand: false },
    { ar: "الصافي (غير شامل ضريبة القيمة المضافة)",  en: "Net Amount (Excl.)", val: netExclVAT.toFixed(2),         grand: false },
    { ar: "ضريبة القيمة المضافة (15%)",              en: "VAT Amount (15%)",   val: data.taxTotal.toFixed(2),      grand: false },
    { ar: "إجمالي المبلغ المستحق",                   en: "Total Amount Due",   val: data.grandTotal.toFixed(2),    grand: true  },
  ];
  const sumTdLbl = `border:1px solid #ccc;padding:4px 8px;font-size:9px`;
  const sumTdVal = `border:1px solid #ccc;padding:4px 8px;font-size:9px;font-weight:bold;text-align:center;white-space:nowrap`;
  const summaryHtml = summaryRows.map(r =>
    `<tr style="${r.grand ? `background:${color};color:#fff` : ""}">
      <td style="${sumTdVal}${r.grand ? ";color:#fff" : ""}">${r.val}</td>
      <td style="${sumTdLbl}${r.grand ? ";color:#fff;font-weight:bold" : ""}">
        ${r.ar}${isBi ? `<span style="font-size:7.5px;opacity:0.75;margin-right:6px"> ${r.en}</span>` : ""}
      </td>
    </tr>`
  ).join("");

  /* ─── QR section ─── */
  const qrHtml = qrDataUrl
    ? `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px;border:1px solid #ddd;border-radius:3px;margin-left:8px">
         <img src="${qrDataUrl}" width="${qrSize}" height="${qrSize}" style="display:block"/>
         <span style="font-size:7px;color:#888">${qrLabel}</span>
       </div>`
    : "";

  /* ─── Full HTML ─── */
  return `<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="utf-8"/>
<title>فاتورة ${data.invoiceNumber}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Tahoma','Arial',sans-serif;font-size:10px;color:#111;background:#fff;direction:rtl}
  .page{max-width:980px;margin:auto}
  @media print{body{margin:0}.page{padding:0}}
</style>
</head>
<body><div class="page">

  <!-- ══ شريط لوني علوي ══ -->
  <div style="height:6px;background:${color}"></div>

  <!-- ══ رأس الفاتورة ══ -->
  <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 18px 8px;border-bottom:2px solid ${color};gap:8px">

    <!-- يسار: اسم الشركة بالإنجليزية -->
    ${isBi ? `<div style="flex:1;text-align:left;direction:ltr">
      <div style="font-size:14px;font-weight:bold;color:${color};line-height:1.3">${data.sellerNameEn || data.sellerName}</div>
      ${data.sellerPhone ? `<div style="font-size:8px;color:#666;margin-top:2px">Tel: ${data.sellerPhone}</div>` : ""}
      ${data.sellerTaxNumber ? `<div style="font-size:8px;color:#666">VAT No: ${data.sellerTaxNumber}</div>` : ""}
    </div>` : `<div style="flex:1"></div>`}

    <!-- وسط: عنوان الفاتورة -->
    <div style="flex:1;text-align:center">
      <div style="display:inline-block;border:2.5px solid ${color};padding:5px 22px;border-radius:2px;line-height:1.5">
        <div style="font-size:16px;font-weight:bold;color:${color}">فاتورة ضريبية</div>
        ${isBi ? `<div style="font-size:11px;font-weight:bold;color:${color};opacity:0.85;letter-spacing:0.5px">TAX INVOICE</div>` : ""}
      </div>
    </div>

    <!-- يمين: اسم الشركة بالعربية -->
    <div style="flex:1;text-align:right">
      <div style="font-size:15px;font-weight:bold;color:${color};line-height:1.3">${data.sellerName}</div>
      ${data.sellerCommercialReg ? `<div style="font-size:8px;color:#666;margin-top:2px">س.ت: ${data.sellerCommercialReg}</div>` : ""}
      ${data.sellerCity ? `<div style="font-size:8px;color:#666">${data.sellerCity}${data.sellerCountry ? "، " + data.sellerCountry : ""}</div>` : ""}
    </div>
  </div>

  <!-- ══ بيانات الفاتورة ══ -->
  <div style="padding:6px 18px">
    <table style="width:100%;border-collapse:collapse;font-size:9px">
      <tr style="background:#f5f7fb">
        <td style="border:1px solid #ddd;padding:3.5px 7px;color:#666;width:90px">
          رقم الفاتورة${isBi ? `<br><span style="font-size:7.5px;color:#aaa">Invoice No</span>` : ""}
        </td>
        <td style="border:1px solid #ddd;padding:3.5px 7px;font-weight:bold;width:130px">${data.invoiceNumber}</td>
        <td style="border:1px solid #ddd;padding:3.5px 7px;color:#666;width:90px">
          تاريخ التحرير${isBi ? `<br><span style="font-size:7.5px;color:#aaa">Issue Date</span>` : ""}
        </td>
        <td style="border:1px solid #ddd;padding:3.5px 7px;font-weight:bold;width:110px">${data.invoiceDate}${data.invoiceTime ? " " + data.invoiceTime.slice(0,5) : ""}</td>
        <td style="border:1px solid #ddd;padding:3.5px 7px;color:#666;width:80px">
          نوع السند${isBi ? `<br><span style="font-size:7.5px;color:#aaa">Type</span>` : ""}
        </td>
        <td style="border:1px solid #ddd;padding:3.5px 7px;font-weight:bold">${paymentText}</td>
      </tr>
      <tr>
        <td style="border:1px solid #ddd;padding:3.5px 7px;color:#666">
          مندوب المبيعات${isBi ? `<br><span style="font-size:7.5px;color:#aaa">Salesperson</span>` : ""}
        </td>
        <td style="border:1px solid #ddd;padding:3.5px 7px;font-weight:bold">${data.salesperson || "—"}</td>
        <td style="border:1px solid #ddd;padding:3.5px 7px;color:#666">
          العملة${isBi ? `<br><span style="font-size:7.5px;color:#aaa">Currency</span>` : ""}
        </td>
        <td style="border:1px solid #ddd;padding:3.5px 7px;font-weight:bold">${data.currency || "SAR"}</td>
        <td style="border:1px solid #ddd;padding:3.5px 7px;color:#666" colspan="2"></td>
      </tr>
    </table>
  </div>

  <!-- ══ بيانات الأطراف ══ -->
  ${(C.sections.customerInfo || C.sections.sellerInfo) ? `
  <div style="display:flex;gap:8px;padding:0 18px 8px">
    ${C.sections.customerInfo ? partyBox("العميل", "Customer", customerRows) : ""}
    ${C.sections.sellerInfo   ? partyBox("البائع", "Seller",   sellerRows)   : ""}
  </div>` : ""}

  <!-- ══ ملاحظة ══ -->
  ${data.notes ? `<div style="border-right:3px solid ${color};background:#fffbe8;padding:4px 10px;margin:0 18px 6px;font-size:9px">
    <strong>${isBi ? "ملحوظة / Note:" : "ملحوظة:"}</strong> ${data.notes}
  </div>` : ""}

  <!-- ══ جدول الأصناف ══ -->
  <div style="padding:0 18px;margin-bottom:8px">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>${headersHtml}</tr></thead>
      <tbody>${linesHtml}${emptyHtml}${sumRow}</tbody>
    </table>
  </div>

  <!-- ══ ملخص + QR ══ -->
  <div style="padding:0 18px;margin-bottom:6px">
    <div style="display:flex;align-items:flex-start;gap:10px">
      <!-- QR (إذا وجد) -->
      ${qrHtml}
      <!-- الإجماليات -->
      <div style="margin-right:auto;min-width:310px">
        <table style="width:100%;border-collapse:collapse">
          ${summaryHtml}
        </table>
      </div>
    </div>
  </div>

  <!-- ══ المبلغ كتابةً ══ -->
  ${C.sections.amountInWords && amountWords ? `
  <div style="border:1px solid #ccc;padding:5px 12px;margin:0 18px 5px;border-radius:2px;font-size:9.5px">
    <strong style="color:${color}">${isBi ? "المبلغ كتابةً / Amount in Words:" : "المبلغ كتابةً:"}</strong>
    <span style="font-weight:bold"> ${amountWords}</span>
  </div>` : ""}

  <!-- ══ توقيعات ══ -->
  ${C.sections.signatures ? `
  <div style="display:flex;justify-content:space-around;padding:0 18px;margin-top:22px;margin-bottom:6px">
    ${[
      isBi ? "المدير / Manager"    : "المدير",
      isBi ? "المحاسب / Accountant": "المحاسب",
      isBi ? "المستلم / Receiver"  : "المستلم",
    ].map(s => `<div style="text-align:center;width:170px">
      <div style="border-top:1px solid #999;padding-top:4px;font-size:8px;color:#666;margin-top:28px">${s}</div>
    </div>`).join("")}
  </div>` : ""}

  <!-- ══ تذييل ══ -->
  ${C.sections.pageNumber ? `
  <div style="display:flex;justify-content:space-between;font-size:8px;color:#888;margin:4px 18px 0;border-top:1px solid #e0e0e0;padding-top:3px">
    <span>OneSoft ERP</span>
    <span>${isBi ? "صفحة 1 من 1 / Page 1 of 1" : "صفحة 1 من 1"}</span>
  </div>` : ""}

  <!-- ══ شريط لوني سفلي ══ -->
  <div style="height:4px;background:${color};margin-top:5px"></div>

</div></body></html>`;
}
