import * as XLSX from "xlsx";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface AccountForExport {
  id: number;
  code: string | null;
  name: string | null;
  accountType: string | null;
  nature: string | null;
  level: number | null;
  isParent: boolean | null;
  allowPosting: boolean | null;
  parentId: number | null;
  isActive?: boolean | null;
}

export interface ExportOptions {
  activeOnly: boolean;
  maxLevel: number; // 0 = all levels
}

export interface FlatRow {
  code: string;
  name: string;
  accountType: string;
  nature: string;
  level: number;
  depth: number;
  prefix: string;
  isParent: boolean;
  allowPosting: boolean;
}

// ── Labels ────────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  assets: "أصول",
  liabilities: "خصوم",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expenses: "مصروفات",
};
const NATURE_LABELS: Record<string, string> = { debit: "مدين", credit: "دائن" };

// ── Build flat tree list ──────────────────────────────────────────────────────
export function buildTreeFlat(accounts: AccountForExport[], opts: ExportOptions): FlatRow[] {
  const sorted = [...accounts].sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));

  const filtered = sorted.filter(a => {
    if (opts.activeOnly && a.isActive === false) return false;
    if (opts.maxLevel > 0 && (a.level ?? 1) > opts.maxLevel) return false;
    return true;
  });

  const childMap = new Map<number | null, AccountForExport[]>();
  for (const a of filtered) {
    const pid = a.parentId ?? null;
    if (!childMap.has(pid)) childMap.set(pid, []);
    childMap.get(pid)!.push(a);
  }

  const result: FlatRow[] = [];

  function traverse(parentId: number | null, depth: number, isLastFlags: boolean[]) {
    const children = childMap.get(parentId) ?? [];
    for (let i = 0; i < children.length; i++) {
      const a = children[i];
      const isLast = i === children.length - 1;

      let prefix = "";
      if (depth > 0) {
        for (let j = 0; j < isLastFlags.length; j++) {
          prefix += isLastFlags[j] ? "    " : "│   ";
        }
        prefix += isLast ? "└── " : "├── ";
      }

      result.push({
        code: a.code ?? "",
        name: a.name ?? "",
        accountType: TYPE_LABELS[a.accountType ?? ""] ?? (a.accountType ?? ""),
        nature: NATURE_LABELS[a.nature ?? ""] ?? (a.nature ?? ""),
        level: a.level ?? 1,
        depth,
        prefix,
        isParent: !!a.isParent,
        allowPosting: !!a.allowPosting,
      });

      traverse(a.id, depth + 1, [...isLastFlags, isLast]);
    }
  }

  traverse(null, 0, []);
  return result;
}

// ── Excel Export ──────────────────────────────────────────────────────────────
export function exportToExcel(rows: FlatRow[], companyName: string, userName: string) {
  const dateStr = new Date().toLocaleDateString("ar-EG", {
    year: "numeric", month: "long", day: "numeric",
  });

  const headerRows: (string | number | null)[][] = [
    [companyName, "", "", "", "", "", ""],
    [`شجرة الحسابات — ${dateStr}`, "", "", "", "", "", ""],
    [`أعدّه: ${userName}`, "", "", "", "", "", ""],
    ["", "", "", "", "", "", ""],
    ["كود الحساب", "اسم الحساب", "النوع", "الطبيعة", "المستوى", "مجمّع", "يقبل ترحيل"],
  ];

  const dataRows: (string | number | null)[][] = rows.map(r => [
    r.code,
    "  ".repeat(r.depth) + r.name,
    r.accountType,
    r.nature,
    r.level,
    r.isParent ? "✓" : "",
    r.allowPosting ? "✓" : "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);

  ws["!cols"] = [
    { wch: 14 },
    { wch: 55 },
    { wch: 16 },
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
    { wch: 12 },
  ];

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
  ];

  // Row grouping (outline) for hierarchical collapsing
  const rowInfos: XLSX.RowInfo[] = [];
  for (let i = 0; i < 5; i++) rowInfos.push({ hpx: 20 });
  for (const r of rows) {
    const outLevel = r.depth > 0 ? Math.min(r.depth, 7) : undefined;
    rowInfos.push({ hpx: 18, level: outLevel });
  }
  ws["!rows"] = rowInfos;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "شجرة الحسابات");
  XLSX.writeFile(wb, `شجرة-الحسابات-${new Date().toISOString().split("T")[0]}.xlsx`);
}

// ── Word Export (HTML-based .doc) ─────────────────────────────────────────────
export function exportToWord(rows: FlatRow[], companyName: string, userName: string) {
  const dateStr = new Date().toLocaleDateString("ar-EG", {
    year: "numeric", month: "long", day: "numeric",
  });

  const levelBg: Record<number, string> = {
    1: "#dbeafe", 2: "#eff6ff", 3: "#f1f5f9", 4: "#ffffff", 5: "#ffffff",
  };
  const levelStyle: Record<number, string> = {
    1: "font-size:14pt;font-weight:900;color:#1e3a5f;",
    2: "font-size:13pt;font-weight:800;color:#1d4ed8;",
    3: "font-size:12pt;font-weight:700;color:#374151;",
    4: "font-size:11pt;color:#374151;",
    5: "font-size:10pt;color:#6b7280;",
  };

  const tableRows = rows.map(r => {
    const bg = levelBg[Math.min(r.level, 5)] ?? "#fff";
    const st = levelStyle[Math.min(r.level, 5)] ?? "font-size:11pt;";
    const padRight = 8 + r.depth * 18;
    return `<tr style="background:${bg};">
      <td style="font-family:Courier New;font-size:9.5pt;font-weight:700;color:#1d4ed8;padding:4px 8px;border:1px solid #e2e8f0;white-space:nowrap;">${esc(r.code)}</td>
      <td style="${st}padding:4px ${padRight}px 4px 8px;border:1px solid #e2e8f0;min-width:220px;">
        <span style="font-family:Courier New;color:#94a3b8;font-size:9pt;">${esc(r.prefix)}</span>${esc(r.name)}
      </td>
      <td style="font-size:10pt;padding:4px 6px;border:1px solid #e2e8f0;text-align:center;">${r.accountType}</td>
      <td style="font-size:10pt;padding:4px 6px;border:1px solid #e2e8f0;text-align:center;">${r.nature}</td>
      <td style="font-size:10pt;padding:4px 6px;border:1px solid #e2e8f0;text-align:center;">${r.level}</td>
    </tr>`;
  }).join("\n");

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word"
    xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8"/>
  <meta name="ProgId" content="Word.Document"/>
  <style>
    @page { size:A4; margin:2cm; }
    body { font-family:Tahoma,Arial,sans-serif; direction:rtl; background:#fff; }
    table { border-collapse:collapse; width:100%; }
    th { background:#1e40af; color:white; padding:7px 8px; font-size:10.5pt; }
    h1 { font-size:18pt; color:#1e3a5f; margin:0 0 4px 0; }
    h2 { font-size:15pt; color:#1d4ed8; margin:0 0 4px 0; }
    .meta { font-size:10pt; color:#64748b; }
    .footer { margin-top:20px; text-align:center; font-size:9pt; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:8px; }
  </style>
</head>
<body dir="rtl">
  <div style="text-align:center;margin-bottom:20px;">
    <h1>${esc(companyName)}</h1>
    <h2>شجرة الحسابات</h2>
    <p class="meta">تاريخ الطباعة: ${dateStr} &nbsp;|&nbsp; أعدّه: ${esc(userName)}</p>
    <hr style="border-top:2px solid #1d4ed8;margin:12px 0;"/>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:80px;">كود الحساب</th>
        <th>اسم الحساب</th>
        <th style="width:90px;">النوع</th>
        <th style="width:65px;">الطبيعة</th>
        <th style="width:55px;">المستوى</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">إجمالي عدد الحسابات: ${rows.length} حساب &nbsp;|&nbsp; OneSoft ERP</div>
</body></html>`;

  downloadBlob("\uFEFF" + html, `شجرة-الحسابات-${ts()}.doc`, "application/msword;charset=utf-8;");
}

// ── Print / PDF Preview ───────────────────────────────────────────────────────
export function openPrintPreview(
  rows: FlatRow[],
  companyName: string,
  userName: string,
  autoPrint = false,
) {
  const dateStr = new Date().toLocaleDateString("ar-EG", {
    year: "numeric", month: "long", day: "numeric",
  });

  const levelBg: Record<number, string> = {
    1: "#dbeafe", 2: "#eff6ff", 3: "#f1f5f9", 4: "#ffffff", 5: "#ffffff",
  };
  const levelSt: Record<number, string> = {
    1: "font-weight:900;font-size:13pt;color:#1e3a5f;",
    2: "font-weight:800;font-size:12pt;color:#1d4ed8;",
    3: "font-weight:700;font-size:11pt;color:#374151;",
    4: "font-size:11pt;color:#374151;",
    5: "font-size:10pt;color:#6b7280;",
  };

  const tableRows = rows.map((r, i) => {
    const bg = levelBg[Math.min(r.level, 5)] ?? "#fff";
    const st = levelSt[Math.min(r.level, 5)] ?? "font-size:11pt;";
    const alt = i % 2 === 1 && r.level > 2 ? "#fafafa" : bg;
    const padRight = 8 + r.depth * 14;
    return `<tr style="background:${alt};">
      <td class="code">${esc(r.code)}</td>
      <td class="name" style="${st}padding-right:${padRight}px;">
        <span class="pfx">${esc(r.prefix)}</span>${esc(r.name)}
      </td>
      <td class="ctr">${r.accountType}</td>
      <td class="ctr">${r.nature}</td>
      <td class="ctr">${r.level}</td>
      <td class="ctr">${r.isParent ? "◉" : "○"}</td>
    </tr>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"/>
<title>شجرة الحسابات — ${esc(companyName)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Tahoma,'Segoe UI',Arial,sans-serif;direction:rtl;background:#fff;color:#1e293b;font-size:11pt;}
.hdr{text-align:center;border-bottom:3px solid #1d4ed8;padding-bottom:14px;margin-bottom:18px;}
.co{font-size:18pt;font-weight:900;color:#1e3a5f;}
.ti{font-size:15pt;font-weight:700;color:#1d4ed8;margin:5px 0;}
.me{font-size:9.5pt;color:#64748b;margin-top:5px;}
.badge{display:inline-block;background:#dbeafe;color:#1e40af;border-radius:12px;padding:2px 12px;font-size:9pt;margin-top:6px;font-weight:600;}
table{width:100%;border-collapse:collapse;font-size:10.5pt;}
thead tr{background:#1e40af;color:white;}
thead th{padding:7px 8px;text-align:right;font-size:10pt;font-weight:700;border:1px solid #1e3a8a;}
tr{border-bottom:1px solid #e2e8f0;page-break-inside:avoid;}
.code{font-family:'Courier New',monospace;font-size:9.5pt;color:#1d4ed8;font-weight:700;padding:3px 8px;white-space:nowrap;border-left:1px solid #e2e8f0;}
.name{padding:4px 8px;word-break:break-word;min-width:200px;}
.pfx{font-family:'Courier New',monospace;color:#94a3b8;font-size:9pt;}
.ctr{text-align:center;padding:3px 6px;border-left:1px solid #e2e8f0;font-size:9.5pt;white-space:nowrap;}
.footer{margin-top:18px;border-top:1px solid #e2e8f0;padding-top:10px;text-align:center;font-size:9pt;color:#94a3b8;}
.bar{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:10px;background:white;padding:10px 20px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.15);border:1px solid #e2e8f0;}
.btn{padding:8px 20px;border:none;border-radius:8px;cursor:pointer;font-size:11pt;font-family:Tahoma;font-weight:600;}
.bp{background:#1d4ed8;color:white;}
.bc{background:#f1f5f9;color:#475569;}
.hint{font-size:9pt;color:#64748b;align-self:center;}
@media print{
  .bar{display:none;}
  thead{display:table-header-group;}
  tfoot{display:table-footer-group;}
  @page{size:A4;margin:1.5cm;}
}
</style>
</head><body>
<div class="hdr">
  <div class="co">${esc(companyName)}</div>
  <div class="ti">شجرة الحسابات</div>
  <div class="me">تاريخ الطباعة: ${dateStr} &nbsp;|&nbsp; أعدّه: ${esc(userName)}</div>
  <span class="badge">إجمالي: ${rows.length} حساب</span>
</div>
<table>
  <thead>
    <tr>
      <th style="width:85px;">كود الحساب</th>
      <th>اسم الحساب</th>
      <th style="width:90px;">النوع</th>
      <th style="width:65px;">الطبيعة</th>
      <th style="width:55px;">المستوى</th>
      <th style="width:55px;">مجمّع</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>
<div class="footer">OneSoft ERP &nbsp;•&nbsp; ${esc(companyName)} &nbsp;•&nbsp; ${dateStr}</div>
<div class="bar">
  <button class="btn bp" onclick="window.print()">🖨 طباعة / PDF</button>
  <span class="hint">لحفظ كـ PDF اختر "حفظ كـ PDF" من قائمة الطابعات</span>
  <button class="btn bc" onclick="window.close()">✕ إغلاق</button>
</div>
${autoPrint ? `<script>window.onload=function(){setTimeout(function(){window.print();},600);};<\/script>` : ""}
</body></html>`;

  const win = window.open("", "_blank", "width=1050,height=780,scrollbars=yes");
  if (win) { win.document.write(html); win.document.close(); }
}

// ── Trial Balance Export Types ────────────────────────────────────────────────
export interface TBExportRow {
  code: string;
  name: string;
  depth: number;
  aggOpenD: number; aggOpenC: number;
  aggMoveD: number; aggMoveC: number;
  aggCloseD: number; aggCloseC: number;
}
export interface TBExportTotals {
  openD: number; openC: number;
  moveD: number; moveC: number;
  closeD: number; closeC: number;
}

function fmtTBNum(n: number) {
  return n === 0 ? 0 : n;
}

// ── Trial Balance → Excel ─────────────────────────────────────────────────────
export function exportTBToExcel(
  rows: TBExportRow[],
  totals: TBExportTotals,
  tbMode: "full" | "simple",
  companyName: string,
  userName: string,
  fromDate: string,
  toDate: string,
) {
  const dateStr = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const period = `${fromDate || "—"} / ${toDate || "—"}`;

  if (tbMode === "full") {
    const cols = 8;
    const merge = (r: number) => ({ s: { r, c: 0 }, e: { r, c: cols - 1 } });
    const headerBlock: (string | number | null)[][] = [
      [companyName, ...Array(cols - 1).fill("")],
      [`ميزان المراجعة — ${period}`, ...Array(cols - 1).fill("")],
      [`أعدّه: ${userName} | ${dateStr}`, ...Array(cols - 1).fill("")],
      Array(cols).fill(""),
      ["كود", "اسم الحساب", "رصيد أول (مدين)", "رصيد أول (دائن)", "حركة مدين", "حركة دائن", "رصيد آخر (مدين)", "رصيد آخر (دائن)"],
    ];
    const dataRows = rows.map(r => [
      r.code, "  ".repeat(r.depth) + r.name,
      fmtTBNum(r.aggOpenD), fmtTBNum(r.aggOpenC),
      fmtTBNum(r.aggMoveD), fmtTBNum(r.aggMoveC),
      fmtTBNum(r.aggCloseD), fmtTBNum(r.aggCloseC),
    ]);
    const totalRow = ["الإجمالي الكلي", "",
      fmtTBNum(totals.openD), fmtTBNum(totals.openC),
      fmtTBNum(totals.moveD), fmtTBNum(totals.moveC),
      fmtTBNum(totals.closeD), fmtTBNum(totals.closeC),
    ];
    const ws = XLSX.utils.aoa_to_sheet([...headerBlock, ...dataRows, totalRow]);
    ws["!cols"] = [{ wch: 14 }, { wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    ws["!merges"] = [merge(0), merge(1), merge(2)];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ميزان المراجعة");
    XLSX.writeFile(wb, `ميزان-المراجعة-${ts()}.xlsx`);
  } else {
    const cols = 6;
    const merge = (r: number) => ({ s: { r, c: 0 }, e: { r, c: cols - 1 } });
    const netOpen = (r: TBExportRow) => r.aggOpenD > r.aggOpenC ? r.aggOpenD - r.aggOpenC : r.aggOpenC > r.aggOpenD ? -(r.aggOpenC - r.aggOpenD) : 0;
    const netClose = (r: TBExportRow) => r.aggCloseD > 0 ? r.aggCloseD : r.aggCloseC > 0 ? -r.aggCloseC : 0;
    const headerBlock: (string | number | null)[][] = [
      [companyName, ...Array(cols - 1).fill("")],
      [`ميزان المراجعة — ${period}`, ...Array(cols - 1).fill("")],
      [`أعدّه: ${userName} | ${dateStr}`, ...Array(cols - 1).fill("")],
      Array(cols).fill(""),
      ["كود", "اسم الحساب", "رصيد أول المدة", "حركة مدين", "حركة دائن", "رصيد آخر المدة"],
    ];
    const dataRows = rows.map(r => [
      r.code, "  ".repeat(r.depth) + r.name,
      netOpen(r), fmtTBNum(r.aggMoveD), fmtTBNum(r.aggMoveC), netClose(r),
    ]);
    const totalRow = ["الإجمالي الكلي", "",
      totals.openD - totals.openC,
      fmtTBNum(totals.moveD), fmtTBNum(totals.moveC),
      totals.closeD - totals.closeC,
    ];
    const ws = XLSX.utils.aoa_to_sheet([...headerBlock, ...dataRows, totalRow]);
    ws["!cols"] = [{ wch: 14 }, { wch: 40 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
    ws["!merges"] = [merge(0), merge(1), merge(2)];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ميزان المراجعة");
    XLSX.writeFile(wb, `ميزان-المراجعة-${ts()}.xlsx`);
  }
}

// ── Trial Balance → Word (.doc HTML) ──────────────────────────────────────────
export function exportTBToWord(
  rows: TBExportRow[],
  totals: TBExportTotals,
  tbMode: "full" | "simple",
  companyName: string,
  userName: string,
  fromDate: string,
  toDate: string,
) {
  const dateStr = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const period = `${fromDate || "—"} — ${toDate || "—"}`;
  const D = "#C0392B"; const C2 = "#1A7A4A";
  const numCell = (v: number, color: string) =>
    `<td style="text-align:center;padding:4px 6px;border:1px solid #e2e8f0;font-size:9.5pt;color:${v !== 0 ? color : "#9ca3af"};">${v !== 0 ? v.toLocaleString("ar-EG", { minimumFractionDigits: 2 }) : "—"}</td>`;

  const fullHeaders = `<tr style="background:#2D5F85;color:white;"><th colspan="2" style="padding:6px 8px;border:1px solid #1e4068;text-align:right;">الحساب</th><th colspan="2" style="padding:6px 8px;border:1px solid #1e4068;text-align:center;">رصيد أول المدة</th><th colspan="2" style="padding:6px 8px;border:1px solid #1e4068;text-align:center;">الحركة</th><th colspan="2" style="padding:6px 8px;border:1px solid #1e4068;text-align:center;">رصيد آخر المدة</th></tr><tr style="background:#406B93;color:white;"><th style="padding:4px 8px;border:1px solid #1e4068;width:80px;">كود</th><th style="padding:4px 8px;border:1px solid #1e4068;">اسم الحساب</th><th style="padding:4px 6px;border:1px solid #1e4068;width:80px;text-align:center;">مدين</th><th style="padding:4px 6px;border:1px solid #1e4068;width:80px;text-align:center;">دائن</th><th style="padding:4px 6px;border:1px solid #1e4068;width:80px;text-align:center;">مدين</th><th style="padding:4px 6px;border:1px solid #1e4068;width:80px;text-align:center;">دائن</th><th style="padding:4px 6px;border:1px solid #1e4068;width:80px;text-align:center;">مدين</th><th style="padding:4px 6px;border:1px solid #1e4068;width:80px;text-align:center;">دائن</th></tr>`;

  const simpleHeaders = `<tr style="background:#2D5F85;color:white;"><th style="padding:6px 8px;border:1px solid #1e4068;width:80px;">كود</th><th style="padding:6px 8px;border:1px solid #1e4068;">اسم الحساب</th><th style="padding:6px 8px;border:1px solid #1e4068;width:100px;text-align:center;">رصيد أول المدة</th><th style="padding:6px 8px;border:1px solid #1e4068;width:90px;text-align:center;">حركة مدين</th><th style="padding:6px 8px;border:1px solid #1e4068;width:90px;text-align:center;">حركة دائن</th><th style="padding:6px 8px;border:1px solid #1e4068;width:100px;text-align:center;">رصيد آخر المدة</th></tr>`;

  const tableRows = rows.map((r, i) => {
    const bg = i % 2 === 0 ? "#ffffff" : "#f5f7fa";
    const indent = `padding-right:${8 + r.depth * 14}px;`;
    if (tbMode === "full") {
      return `<tr style="background:${bg};">
        <td style="font-family:Courier New;font-size:9pt;font-weight:700;color:#2D5F85;padding:3px 6px;border:1px solid #e2e8f0;white-space:nowrap;">${esc(r.code)}</td>
        <td style="font-size:10pt;padding:3px 8px;${indent}border:1px solid #e2e8f0;">${esc(r.name)}</td>
        ${numCell(r.aggOpenD, D)}${numCell(r.aggOpenC, C2)}${numCell(r.aggMoveD, D)}${numCell(r.aggMoveC, C2)}${numCell(r.aggCloseD, D)}${numCell(r.aggCloseC, C2)}
      </tr>`;
    } else {
      const netOpen = r.aggOpenD > r.aggOpenC ? r.aggOpenD - r.aggOpenC : r.aggOpenC > r.aggOpenD ? -(r.aggOpenC - r.aggOpenD) : 0;
      const netClose = r.aggCloseD > 0 ? r.aggCloseD : r.aggCloseC > 0 ? -r.aggCloseC : 0;
      return `<tr style="background:${bg};">
        <td style="font-family:Courier New;font-size:9pt;font-weight:700;color:#2D5F85;padding:3px 6px;border:1px solid #e2e8f0;white-space:nowrap;">${esc(r.code)}</td>
        <td style="font-size:10pt;padding:3px 8px;${indent}border:1px solid #e2e8f0;">${esc(r.name)}</td>
        ${numCell(netOpen, netOpen >= 0 ? D : C2)}${numCell(r.aggMoveD, D)}${numCell(r.aggMoveC, C2)}${numCell(netClose, netClose >= 0 ? D : C2)}
      </tr>`;
    }
  }).join("\n");

  const colSpan = tbMode === "full" ? 8 : 6;
  const totalCells = tbMode === "full"
    ? `${numCell(totals.openD, D)}${numCell(totals.openC, C2)}${numCell(totals.moveD, D)}${numCell(totals.moveC, C2)}${numCell(totals.closeD, D)}${numCell(totals.closeC, C2)}`
    : `${numCell(totals.openD - totals.openC, D)}${numCell(totals.moveD, D)}${numCell(totals.moveC, C2)}${numCell(totals.closeD - totals.closeC, D)}`;

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"/><meta name="ProgId" content="Word.Document"/>
<style>@page{size:A4 landscape;margin:1.5cm;}body{font-family:Tahoma,Arial,sans-serif;direction:rtl;background:#fff;}table{border-collapse:collapse;width:100%;}h1{font-size:16pt;color:#1E3A5F;margin:0 0 4px 0;}h2{font-size:13pt;color:#2D5F85;margin:0 0 4px 0;}.meta{font-size:9.5pt;color:#64748b;}.footer{margin-top:14px;text-align:center;font-size:9pt;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:6px;}</style>
</head><body dir="rtl">
<div style="text-align:center;margin-bottom:16px;"><h1>${esc(companyName)}</h1><h2>ميزان مراجعة الأستاذ العام</h2><p class="meta">الفترة: ${esc(period)} &nbsp;|&nbsp; طُبع: ${dateStr} &nbsp;|&nbsp; أعدّه: ${esc(userName)}</p><hr style="border-top:2px solid #2D5F85;margin:10px 0;"/></div>
<table><thead>${tbMode === "full" ? fullHeaders : simpleHeaders}</thead>
<tbody>${tableRows}</tbody>
<tfoot><tr style="background:#E8E4DA;font-weight:700;"><td colspan="2" style="padding:5px 8px;border:1px solid #C8C3B8;">الإجمالي الكلي</td>${totalCells}</tr></tfoot>
</table>
<div class="footer">إجمالي عدد الحسابات: ${rows.length} &nbsp;|&nbsp; OneSoft ERP</div>
</body></html>`;

  downloadBlob("\uFEFF" + html, `ميزان-المراجعة-${ts()}.doc`, "application/msword;charset=utf-8;");
}

// ── Trial Balance → Print / PDF ───────────────────────────────────────────────
export function openTBPrintPreview(
  rows: TBExportRow[],
  totals: TBExportTotals,
  tbMode: "full" | "simple",
  companyName: string,
  userName: string,
  fromDate: string,
  toDate: string,
  autoPrint = false,
) {
  const dateStr = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const period = `${fromDate || "—"} — ${toDate || "—"}`;
  const D = "#C0392B"; const C2 = "#1A7A4A";
  const numTd = (v: number, col: string) =>
    `<td class="num" style="color:${v !== 0 ? col : "#9CA3AF"};">${v !== 0 ? v.toLocaleString("ar-EG", { minimumFractionDigits: 2 }) : "—"}</td>`;

  const fullHead = `<tr class="head1"><th colspan="2" class="hl">الحساب</th><th colspan="2" class="hl">رصيد أول المدة</th><th colspan="2" class="hl">الحركة</th><th colspan="2" class="hl">رصيد آخر المدة</th></tr><tr class="head2"><th class="hl" style="width:80px;">كود</th><th class="hl">اسم الحساب</th><th class="hl num">مدين</th><th class="hl num">دائن</th><th class="hl num">مدين</th><th class="hl num">دائن</th><th class="hl num">مدين</th><th class="hl num">دائن</th></tr>`;
  const simHead = `<tr class="head1"><th class="hl" style="width:80px;">كود</th><th class="hl">اسم الحساب</th><th class="hl num">رصيد أول المدة</th><th class="hl num">حركة مدين</th><th class="hl num">حركة دائن</th><th class="hl num">رصيد آخر المدة</th></tr>`;

  const tableRows = rows.map((r, i) => {
    const bg = i % 2 === 0 ? "#ffffff" : "#F5F7FA";
    const pad = 6 + r.depth * 12;
    if (tbMode === "full") {
      return `<tr style="background:${bg};">
        <td class="code">${esc(r.code)}</td>
        <td class="name" style="padding-right:${pad}px;">${esc(r.name)}</td>
        ${numTd(r.aggOpenD, D)}${numTd(r.aggOpenC, C2)}${numTd(r.aggMoveD, D)}${numTd(r.aggMoveC, C2)}${numTd(r.aggCloseD, D)}${numTd(r.aggCloseC, C2)}
      </tr>`;
    } else {
      const netOpen = r.aggOpenD > r.aggOpenC ? r.aggOpenD - r.aggOpenC : r.aggOpenC > r.aggOpenD ? -(r.aggOpenC - r.aggOpenD) : 0;
      const netClose = r.aggCloseD > 0 ? r.aggCloseD : r.aggCloseC > 0 ? -r.aggCloseC : 0;
      return `<tr style="background:${bg};">
        <td class="code">${esc(r.code)}</td>
        <td class="name" style="padding-right:${pad}px;">${esc(r.name)}</td>
        ${numTd(netOpen, netOpen >= 0 ? D : C2)}${numTd(r.aggMoveD, D)}${numTd(r.aggMoveC, C2)}${numTd(netClose, netClose >= 0 ? D : C2)}
      </tr>`;
    }
  }).join("\n");

  const totalCells = tbMode === "full"
    ? `${numTd(totals.openD, D)}${numTd(totals.openC, C2)}${numTd(totals.moveD, D)}${numTd(totals.moveC, C2)}${numTd(totals.closeD, D)}${numTd(totals.closeC, C2)}`
    : `${numTd(totals.openD - totals.openC, D)}${numTd(totals.moveD, D)}${numTd(totals.moveC, C2)}${numTd(totals.closeD - totals.closeC, D)}`;

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"/><title>ميزان المراجعة — ${esc(companyName)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Tahoma,'Segoe UI',Arial,sans-serif;direction:rtl;background:#fff;color:#1e293b;font-size:10.5pt;}
.hdr{text-align:center;border-bottom:3px solid #2D5F85;padding-bottom:12px;margin-bottom:16px;}
.co{font-size:17pt;font-weight:900;color:#1E3A5F;}
.ti{font-size:13pt;font-weight:700;color:#2D5F85;margin:4px 0;}
.me{font-size:9pt;color:#64748b;margin-top:4px;}
table{width:100%;border-collapse:collapse;font-size:9.5pt;}
.head1{background:#2D5F85;color:white;}
.head2{background:#406B93;color:white;}
.hl{padding:5px 7px;text-align:right;border:1px solid #1e4068;}
.hl.num{text-align:center;}
.code{font-family:'Courier New',monospace;font-size:9pt;font-weight:700;color:#2D5F85;padding:3px 6px;border:1px solid #e2e8f0;white-space:nowrap;}
.name{padding:3px 8px;border:1px solid #e2e8f0;min-width:140px;}
.num{text-align:center;padding:3px 6px;border:1px solid #e2e8f0;white-space:nowrap;}
.tot{background:#E8E4DA;font-weight:700;border-top:2px solid #C8C3B8;}
.tot td{padding:5px 6px;border:1px solid #C8C3B8;}
.footer{margin-top:14px;text-align:center;font-size:8.5pt;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;}
.bar{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:10px;background:white;padding:9px 18px;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.15);border:1px solid #e2e8f0;}
.btn{padding:7px 18px;border:none;border-radius:8px;cursor:pointer;font-size:11pt;font-family:Tahoma;font-weight:600;}
.bp{background:#2D5F85;color:white;}.bc{background:#f1f5f9;color:#475569;}
.hint{font-size:9pt;color:#64748b;align-self:center;}
@media print{.bar{display:none;}thead{display:table-header-group;}@page{size:A4 landscape;margin:1.5cm;}}
</style></head><body>
<div class="hdr"><div class="co">${esc(companyName)}</div><div class="ti">ميزان مراجعة الأستاذ العام</div><div class="me">الفترة: ${esc(period)} &nbsp;|&nbsp; ${dateStr} &nbsp;|&nbsp; أعدّه: ${esc(userName)}</div></div>
<table>
<thead>${tbMode === "full" ? fullHead : simHead}</thead>
<tbody>${tableRows}</tbody>
<tfoot><tr class="tot"><td colspan="2" style="padding:5px 8px;border:1px solid #C8C3B8;">الإجمالي الكلي</td>${totalCells}</tr></tfoot>
</table>
<div class="footer">عدد الحسابات: ${rows.length} &nbsp;•&nbsp; OneSoft ERP &nbsp;•&nbsp; ${esc(companyName)}</div>
<div class="bar">
  <button class="btn bp" onclick="window.print()">🖨 طباعة / PDF</button>
  <span class="hint">لحفظ كـ PDF اختر "حفظ كـ PDF" من قائمة الطابعات</span>
  <button class="btn bc" onclick="window.close()">✕ إغلاق</button>
</div>
${autoPrint ? `<script>window.onload=function(){setTimeout(function(){window.print();},600);};<\/script>` : ""}
</body></html>`;

  const win = window.open("", "_blank", "width=1100,height=820,scrollbars=yes");
  if (win) { win.document.write(html); win.document.close(); }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ts() {
  return new Date().toISOString().split("T")[0];
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
