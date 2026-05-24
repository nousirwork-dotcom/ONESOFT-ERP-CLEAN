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
