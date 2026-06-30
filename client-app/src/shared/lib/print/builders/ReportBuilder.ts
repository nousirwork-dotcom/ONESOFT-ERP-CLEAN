/**
 * ReportBuilder.ts — بناء HTML التقارير المحاسبية
 *
 * يُسجّل نفسه لأنواع التقارير:
 *   - statement      (كشف حساب)
 *   - trial_balance  (ميزان المراجعة)
 *   - ledger_report  (دفتر الأستاذ)
 *   - stock_report   (تقرير المخزون)
 *
 * إضافة تقرير جديد:
 *   registerBuilder("income_statement", ReportBuilder)
 */
import { registerBuilder }       from "@/shared/lib/print/PrintEngine";
import { CssEngine }             from "@/shared/lib/print/CssEngine";
import { HtmlRenderer }          from "@/shared/lib/print/HtmlRenderer";
import type { DocumentBuilder, PrintJob, ReportPrintData, ReportRow } from "@/shared/lib/print/types";

const ReportBuilder: DocumentBuilder = {
  buildHtml(job: PrintJob): string {
    const data  = job.data as ReportPrintData;
    const color = "#406B93";
    const css   = CssEngine.buildReportCss(color);
    const body  = buildReportBody(data, color);
    const title = data.title ?? "تقرير";

    return HtmlRenderer.buildPage(body, { title, css, dir: "rtl", lang: "ar", bodyClass: "" });
  },
};

function buildReportBody(data: ReportPrintData, color: string): string {
  const cols = data.columns ?? [];
  const rows = data.rows ?? [];

  const dateRange = (data.dateFrom || data.dateTo)
    ? `<span style="color:#666;font-size:11px">
        ${data.dateFrom ?? ""} — ${data.dateTo ?? ""}
       </span>`
    : "";

  const headerRow = cols.map(c =>
    `<th style="text-align:${c.align ?? "center"}">${c.label}${c.labelEn ? `<br/><small style="font-weight:normal;opacity:.8">${c.labelEn}</small>` : ""}</th>`
  ).join("");

  const dataRows = rows.map(row => buildRow(row, cols)).join("");

  const totalsRow = data.totals
    ? `<tr class="row-total">
        ${cols.map(c => {
          const v = data.totals![c.key];
          const formatted = typeof v === "number"
            ? v.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : (v ?? "");
          return `<td style="text-align:${c.align ?? "center"}" class="${typeof v === "number" ? "amount" : ""}">${formatted}</td>`;
        }).join("")}
       </tr>`
    : "";

  return `
<div style="padding:8mm">

  <!-- رأس التقرير -->
  <div class="report-header">
    ${data.companyName ? `<div style="font-size:14px;font-weight:bold;color:${color};margin-bottom:2px">${data.companyName}</div>` : ""}
    <div class="report-title">${data.title}</div>
    ${data.subtitle ? `<div class="report-subtitle">${data.subtitle}</div>` : ""}
    <div class="report-meta">
      ${dateRange}
      ${data.currency ? `<span style="margin-right:8px">العملة: ${data.currency}</span>` : ""}
      ${data.generatedAt ? `<span style="margin-right:8px;direction:ltr">${data.generatedAt}</span>` : ""}
    </div>
    <hr style="border:1px solid ${color};margin-top:4px"/>
  </div>

  <!-- جدول البيانات -->
  <table class="report-table">
    <thead>
      <tr>${headerRow}</tr>
    </thead>
    <tbody>
      ${dataRows}
      ${totalsRow}
    </tbody>
  </table>

</div>`;
}

function buildRow(row: ReportRow, cols: ReportPrintData["columns"]): string {
  const type = row._type ?? "data";
  const cls =
    type === "header"   ? "row-header"   :
    type === "subtotal" ? "row-subtotal" :
    type === "total"    ? "row-total"    : "";

  const indent = row._indent ? `padding-right:${row._indent * 8}px` : "";

  const cells = cols.map((c, i) => {
    let val = row[c.key];
    const isNum = c.type === "number" || c.type === "currency";
    const formatted = typeof val === "number"
      ? val.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(val ?? "");
    const style = [
      `text-align:${c.align ?? "center"}`,
      i === 0 && indent ? indent : "",
      row._bold ? "font-weight:bold" : "",
    ].filter(Boolean).join(";");

    return `<td class="${isNum ? "amount" : ""}" style="${style}">${formatted}</td>`;
  }).join("");

  return `<tr class="${cls}">${cells}</tr>`;
}

registerBuilder("statement",     ReportBuilder);
registerBuilder("trial_balance", ReportBuilder);
registerBuilder("ledger_report", ReportBuilder);
registerBuilder("stock_report",  ReportBuilder);
