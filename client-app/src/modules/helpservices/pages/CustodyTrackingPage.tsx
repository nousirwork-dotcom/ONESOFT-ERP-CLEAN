import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/shared/lib/trpc";
import { useAuth } from "@/core/hooks/useAuth";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { toast } from "sonner";
import {
  Plus, Save, Printer, Download, Search, Trash2,
  AlertTriangle, ArrowRight, Loader2, RefreshCw, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";

// ─── النوع الأساسي للإدخال ────────────────────────────────────────────────────
type Entry = {
  _key:            string;   // مفتاح مؤقت في الواجهة
  id?:             number;
  entryDate:       string;
  description:     string;
  referenceNumber: string;
  incomeDue:       number;
  incomeCollected: number;
  incomeNote:      string;
  expenseDue:      number;
  expensePaid:     number;
  expenseNote:     string;
  sortOrder:       number;
  _dirty:          boolean;
  _isNew:          boolean;
};

let _keyCounter = 0;
function newKey() { return `row_${++_keyCounter}`; }

function emptyEntry(sortOrder: number): Entry {
  const today = new Date().toISOString().slice(0, 10);
  return {
    _key: newKey(), entryDate: today, description: "",
    referenceNumber: "", incomeDue: 0, incomeCollected: 0, incomeNote: "",
    expenseDue: 0, expensePaid: 0, expenseNote: "",
    sortOrder, _dirty: true, _isNew: true,
  };
}

function fromServer(row: any, idx: number): Entry {
  return {
    _key: newKey(),
    id: row.id,
    entryDate: row.entryDate ?? row.entry_date ?? "",
    description: row.description ?? "",
    referenceNumber: row.referenceNumber ?? row.reference_number ?? "",
    incomeDue: Number(row.incomeDue ?? row.income_due ?? 0),
    incomeCollected: Number(row.incomeCollected ?? row.income_collected ?? 0),
    incomeNote: row.incomeNote ?? row.income_note ?? "",
    expenseDue: Number(row.expenseDue ?? row.expense_due ?? 0),
    expensePaid: Number(row.expensePaid ?? row.expense_paid ?? 0),
    expenseNote: row.expenseNote ?? row.expense_note ?? "",
    sortOrder: row.sortOrder ?? row.sort_order ?? idx,
    _dirty: false, _isNew: false,
  };
}

function fmt(n: number) {
  if (!n) return "";
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function fmtNum(n: number) {
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ─── خلية قابلة للتعديل ───────────────────────────────────────────────────────
function EditCell({
  value, onChange, type = "text", align = "right",
  placeholder = "", className = "",
  onEnter, onTab, onShiftTab,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date";
  align?: "right" | "left" | "center";
  placeholder?: string;
  className?: string;
  onEnter?: () => void;
  onTab?: () => void;
  onShiftTab?: () => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      type={type === "number" ? "number" : type}
      value={focused && type === "number" && value === 0 ? "" : value}
      placeholder={placeholder}
      dir={type === "date" ? "ltr" : "rtl"}
      className={`w-full h-8 px-1.5 text-[12px] border-0 outline-none bg-transparent text-${align} ${className}
        focus:bg-blue-50/60 focus:ring-1 focus:ring-blue-400 rounded transition-colors`}
      style={{ minWidth: 0 }}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={e => {
        if (e.key === "Enter") { e.preventDefault(); onEnter?.(); }
        else if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); onTab?.(); }
        else if (e.key === "Tab" && e.shiftKey) { e.preventDefault(); onShiftTab?.(); }
      }}
    />
  );
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────────────────────
export default function CustodyTrackingPage() {
  const { openTab } = useTabManager();
  const { user } = useAuth();

  const [rows, setRows] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const listQ = trpc.custodyTracking.listEntries.useQuery(
    { search: search || undefined },
    { refetchOnWindowFocus: false }
  );
  const saveEntryM  = trpc.custodyTracking.saveEntry.useMutation();
  const deleteEntryM = trpc.custodyTracking.deleteEntry.useMutation();
  const saveBatchM  = trpc.custodyTracking.saveBatch.useMutation();

  useEffect(() => {
    if (listQ.data) {
      setRows((listQ.data as any[]).map((r, i) => fromServer(r, i)));
    }
  }, [listQ.data]);

  // ── إضافة صف ─────────────────────────────────────────────────────────────
  const addRow = useCallback(() => {
    setRows(prev => [...prev, emptyEntry(prev.length)]);
  }, []);

  // ── تعديل حقل في صف ─────────────────────────────────────────────────────
  const updateField = useCallback((key: string, field: keyof Entry, raw: string) => {
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r;
      const num = parseFloat(raw) || 0;
      const isNum = ["incomeDue","incomeCollected","expenseDue","expensePaid"].includes(field as string);
      return { ...r, [field]: isNum ? num : raw, _dirty: true };
    }));
  }, []);

  // ── حذف صف ────────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (key: string) => {
    const row = rows.find(r => r._key === key);
    if (!row) return;
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== key)); return; }
    if (!row.id) return;
    if (!confirm("هل تريد حذف هذا الإدخال؟")) return;
    setDeleting(key);
    try {
      await deleteEntryM.mutateAsync({ id: row.id });
      setRows(prev => prev.filter(r => r._key !== key));
      toast.success("تم الحذف");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحذف");
    } finally { setDeleting(null); }
  }, [rows, deleteEntryM]);

  // ── حفظ الكل ─────────────────────────────────────────────────────────────
  const saveAll = useCallback(async () => {
    const dirty = rows.filter(r => r._dirty);
    if (!dirty.length) { toast.info("لا توجد تغييرات للحفظ"); return; }
    setSaving(true);
    try {
      // حفظ كل صف على حدة لنحصل على الـ IDs
      const updated: Entry[] = [...rows];
      for (const entry of dirty) {
        const payload = {
          id: entry.id,
          entryDate: entry.entryDate,
          description: entry.description,
          referenceNumber: entry.referenceNumber || null,
          incomeDue: entry.incomeDue,
          incomeCollected: entry.incomeCollected,
          incomeNote: entry.incomeNote || null,
          expenseDue: entry.expenseDue,
          expensePaid: entry.expensePaid,
          expenseNote: entry.expenseNote || null,
          sortOrder: entry.sortOrder,
        };
        const saved = await saveEntryM.mutateAsync(payload);
        const idx = updated.findIndex(r => r._key === entry._key);
        if (idx !== -1 && saved) {
          updated[idx] = { ...updated[idx], id: (saved as any).id, _dirty: false, _isNew: false };
        }
      }
      setRows(updated);
      toast.success(`تم حفظ ${dirty.length} إدخال`);
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحفظ");
    } finally { setSaving(false); }
  }, [rows, saveEntryM]);

  // ── التنقل بين الخلايا ─────────────────────────────────────────────────────
  const COLS = ["entryDate","description","referenceNumber",
    "incomeDue","incomeCollected","incomeNote",
    "expenseDue","expensePaid","expenseNote"];

  function focusCell(rowKey: string, col: string) {
    const el = cellRefs.current.get(`${rowKey}__${col}`);
    el?.focus();
  }

  function nextCell(rowKey: string, col: string) {
    const colIdx = COLS.indexOf(col);
    const rowIdx = rows.findIndex(r => r._key === rowKey);
    if (colIdx < COLS.length - 1) {
      focusCell(rowKey, COLS[colIdx + 1]);
    } else if (rowIdx < rows.length - 1) {
      focusCell(rows[rowIdx + 1]._key, COLS[0]);
    } else {
      addRow();
      setTimeout(() => {
        const newRows = rows;
        if (newRows.length > 0) focusCell(newRows[newRows.length - 1]._key, COLS[0]);
      }, 50);
    }
  }
  function prevCell(rowKey: string, col: string) {
    const colIdx = COLS.indexOf(col);
    const rowIdx = rows.findIndex(r => r._key === rowKey);
    if (colIdx > 0) {
      focusCell(rowKey, COLS[colIdx - 1]);
    } else if (rowIdx > 0) {
      focusCell(rows[rowIdx - 1]._key, COLS[COLS.length - 1]);
    }
  }

  // ── الإجماليات ─────────────────────────────────────────────────────────────
  const filtered = search
    ? rows.filter(r =>
        r.description.toLowerCase().includes(search.toLowerCase()) ||
        r.entryDate.includes(search) ||
        r.referenceNumber.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  const totals = filtered.reduce((acc, r) => ({
    incomeDue:       acc.incomeDue       + r.incomeDue,
    incomeCollected: acc.incomeCollected + r.incomeCollected,
    expenseDue:      acc.expenseDue      + r.expenseDue,
    expensePaid:     acc.expensePaid     + r.expensePaid,
  }), { incomeDue: 0, incomeCollected: 0, expenseDue: 0, expensePaid: 0 });

  const balance = totals.incomeCollected - totals.expensePaid;
  const incomeRemaining  = totals.incomeDue  - totals.incomeCollected;
  const expenseRemaining = totals.expenseDue - totals.expensePaid;

  // ── طباعة ────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const css = `
      <style>
        @page { size: A4 landscape; margin: 15mm; }
        body { font-family: Arial, sans-serif; direction: rtl; }
        h2 { text-align: center; font-size: 16px; margin-bottom: 8px; }
        .warn { background:#FEF3C7; border:1px solid #F59E0B; padding:6px 12px; font-size:11px; margin-bottom:12px; border-radius:4px; color:#92400E; }
        table { width:100%; border-collapse:collapse; font-size:11px; }
        th,td { border:1px solid #ccc; padding:4px 6px; text-align:right; }
        th { background:#1B2B5C; color:white; }
        .group-th { background:#3B5EA6; color:white; text-align:center; }
        tr:nth-child(even) { background:#f8f8f8; }
        .totals { background:#E0E7FF; font-weight:bold; }
        .balance { text-align:center; font-size:13px; font-weight:bold; margin-top:10px; }
      </style>`;
    const rows_html = filtered.map((r, i) => `
      <tr>
        <td style="text-align:center">${i+1}</td>
        <td>${r.entryDate}</td>
        <td>${r.description}</td>
        <td>${r.referenceNumber}</td>
        <td style="text-align:left">${fmt(r.incomeDue)}</td>
        <td style="text-align:left">${fmt(r.incomeCollected)}</td>
        <td style="text-align:left">${fmt(r.incomeDue - r.incomeCollected)}</td>
        <td>${r.incomeNote}</td>
        <td style="text-align:left">${fmt(r.expenseDue)}</td>
        <td style="text-align:left">${fmt(r.expensePaid)}</td>
        <td style="text-align:left">${fmt(r.expenseDue - r.expensePaid)}</td>
        <td>${r.expenseNote}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">${css}</head><body>
      <h2>سجل عمليات العهدة</h2>
      <div class="warn">⚠ شاشة متابعة داخلية مستقلة — لا تؤثر على الحسابات أو الصندوق أو المخزون</div>
      <table>
        <thead>
          <tr>
            <th rowspan="2">م</th><th rowspan="2">التاريخ</th><th rowspan="2">البيان</th><th rowspan="2">رقم المرجع</th>
            <th class="group-th" colspan="4">الوارد</th>
            <th class="group-th" colspan="4">المنصرف</th>
          </tr>
          <tr>
            <th>المستحق</th><th>المحصل</th><th>المتبقي</th><th>ملاحظة</th>
            <th>المستحق</th><th>المسدد</th><th>المتبقي</th><th>ملاحظة</th>
          </tr>
        </thead>
        <tbody>${rows_html}
          <tr class="totals">
            <td colspan="4" style="text-align:center">الإجمالي</td>
            <td style="text-align:left">${fmtNum(totals.incomeDue)}</td>
            <td style="text-align:left">${fmtNum(totals.incomeCollected)}</td>
            <td style="text-align:left">${fmtNum(incomeRemaining)}</td>
            <td></td>
            <td style="text-align:left">${fmtNum(totals.expenseDue)}</td>
            <td style="text-align:left">${fmtNum(totals.expensePaid)}</td>
            <td style="text-align:left">${fmtNum(expenseRemaining)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <div class="balance">الرصيد النهائي: ${fmtNum(balance)} — ${balance >= 0 ? 'رصيد دائن' : 'رصيد مدين'}</div>
    </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("تعذّر فتح نافذة الطباعة"); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.print(); };
  };

  // ── تصدير Excel ──────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const wsData = [
        ["م","التاريخ","البيان","رقم المرجع","المستحق (وارد)","المحصل","متبقي الوارد","ملاحظة الوارد","المستحق (منصرف)","المسدد","متبقي المنصرف","ملاحظة المنصرف"],
        ...filtered.map((r, i) => [
          i+1, r.entryDate, r.description, r.referenceNumber,
          r.incomeDue, r.incomeCollected, r.incomeDue - r.incomeCollected, r.incomeNote,
          r.expenseDue, r.expensePaid, r.expenseDue - r.expensePaid, r.expenseNote,
        ]),
        [],
        ["","","","الإجمالي",
          totals.incomeDue, totals.incomeCollected, incomeRemaining, "",
          totals.expenseDue, totals.expensePaid, expenseRemaining, ""],
        ["","","","الرصيد النهائي","","","","","","","",balance],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [4,10,20,14,12,12,12,14,12,12,12,14].map(w => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "سجل العهدة");
      XLSX.writeFile(wb, "custody_tracking.xlsx");
      toast.success("تم تصدير Excel");
    } catch (e: any) {
      toast.error("فشل تصدير Excel: " + (e?.message ?? ""));
    }
  };

  // ── تصدير PDF ────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "landscape", format: "a4" });
      doc.setFont("helvetica");
      doc.text("Custody Tracking Register", 14, 14);
      const tableBody = filtered.map((r, i) => [
        i+1, r.entryDate, r.description, r.referenceNumber,
        fmt(r.incomeDue), fmt(r.incomeCollected), fmt(r.incomeDue - r.incomeCollected),
        fmt(r.expenseDue), fmt(r.expensePaid), fmt(r.expenseDue - r.expensePaid),
      ]);
      tableBody.push(["","","","Totals",
        fmtNum(totals.incomeDue), fmtNum(totals.incomeCollected), fmtNum(incomeRemaining),
        fmtNum(totals.expenseDue), fmtNum(totals.expensePaid), fmtNum(expenseRemaining),
      ] as any);
      autoTable(doc, {
        head: [["#","Date","Description","Ref","Due(in)","Collected","Rem(in)","Due(out)","Paid","Rem(out)"]],
        body: tableBody,
        startY: 22,
        styles: { fontSize: 8, halign: "right" },
        headStyles: { fillColor: [27, 43, 92] },
        foot: [[{ colSpan: 10, content: `Balance: ${fmtNum(balance)}`, styles: { halign: "center", fontStyle: "bold" } }]],
      });
      doc.save("custody_tracking.pdf");
      toast.success("تم تصدير PDF");
    } catch (e: any) {
      toast.error("فشل تصدير PDF: " + (e?.message ?? ""));
    }
  };

  const dirtyCount = rows.filter(r => r._dirty).length;
  const isLoading  = listQ.isLoading;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden" dir="rtl">

      {/* ── شريط التنبيه ─────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-tight">
          شاشة متابعة داخلية مستقلة، ولا تؤثر على الحسابات أو الصندوق أو المخزون أو أي عملية داخل OneSoft.
        </p>
      </div>

      {/* ── شريط الأدوات ─────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-muted/20 flex-wrap">
        <button
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => openTab("/help-services-module", "المساعدة والخدمات")}
        >
          <ArrowRight className="w-4 h-4" />
          <span className="text-xs">المساعدة والخدمات</span>
        </button>
        <span className="text-muted-foreground/40">/</span>
        <h1 className="text-sm font-bold text-foreground">متابعة العهد</h1>

        <div className="flex-1" />

        {/* بحث */}
        <div className="relative w-48">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="بحث بالتاريخ أو البيان..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-xs pr-8 text-right"
          />
        </div>

        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => listQ.refetch()} disabled={listQ.isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 ${listQ.isFetching ? "animate-spin" : ""}`} />
          تحديث
        </Button>

        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={addRow}>
          <Plus className="w-3.5 h-3.5" />
          إضافة صف
        </Button>

        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={saveAll}
          disabled={saving || dirtyCount === 0}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "جارٍ الحفظ..." : `حفظ${dirtyCount > 0 ? ` (${dirtyCount})` : ""}`}
        </Button>

        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handlePrint}>
          <Printer className="w-3.5 h-3.5" />
          طباعة
        </Button>

        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleExportExcel}>
          <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
          Excel
        </Button>

        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleExportPDF}>
          <Download className="w-3.5 h-3.5 text-red-600" />
          PDF
        </Button>
      </div>

      {/* ── الجدول الرئيسي ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            جارٍ التحميل...
          </div>
        ) : (
          <table ref={tableRef} className="w-full border-collapse text-[12px]" style={{ minWidth: 1100 }}>
            <thead className="sticky top-0 z-10">
              <tr>
                <th rowSpan={2} className="border border-gray-300 bg-[#1B2B5C] text-white px-2 py-1.5 text-center w-8 whitespace-nowrap">م</th>
                <th rowSpan={2} className="border border-gray-300 bg-[#1B2B5C] text-white px-2 py-1.5 whitespace-nowrap w-28">التاريخ</th>
                <th rowSpan={2} className="border border-gray-300 bg-[#1B2B5C] text-white px-2 py-1.5 whitespace-nowrap min-w-[160px]">البيان</th>
                <th rowSpan={2} className="border border-gray-300 bg-[#1B2B5C] text-white px-2 py-1.5 whitespace-nowrap w-24">رقم المرجع</th>
                <th colSpan={4} className="border border-gray-300 bg-[#2D4F9C] text-white px-2 py-1.5 text-center">الوارد</th>
                <th colSpan={4} className="border border-gray-300 bg-[#1E6B3A] text-white px-2 py-1.5 text-center">المنصرف</th>
                <th rowSpan={2} className="border border-gray-300 bg-[#1B2B5C] text-white px-2 py-1.5 text-center w-8"></th>
              </tr>
              <tr>
                <th className="border border-gray-300 bg-[#3B5EA6] text-white px-2 py-1 whitespace-nowrap w-24">المستحق</th>
                <th className="border border-gray-300 bg-[#3B5EA6] text-white px-2 py-1 whitespace-nowrap w-24">المحصل</th>
                <th className="border border-gray-300 bg-[#4A6DB5] text-white px-2 py-1 whitespace-nowrap w-24">المتبقي</th>
                <th className="border border-gray-300 bg-[#3B5EA6] text-white px-2 py-1 whitespace-nowrap w-28">ملاحظة</th>
                <th className="border border-gray-300 bg-[#2D7A4A] text-white px-2 py-1 whitespace-nowrap w-24">المستحق</th>
                <th className="border border-gray-300 bg-[#2D7A4A] text-white px-2 py-1 whitespace-nowrap w-24">المسدد</th>
                <th className="border border-gray-300 bg-[#3D8A5A] text-white px-2 py-1 whitespace-nowrap w-24">المتبقي</th>
                <th className="border border-gray-300 bg-[#2D7A4A] text-white px-2 py-1 whitespace-nowrap w-28">ملاحظة</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((row, idx) => {
                const incRem = row.incomeDue  - row.incomeCollected;
                const expRem = row.expenseDue - row.expensePaid;
                const isDirty = row._dirty;

                const mkRef = (col: string) => (el: HTMLInputElement | null) => {
                  if (el) cellRefs.current.set(`${row._key}__${col}`, el);
                  else cellRefs.current.delete(`${row._key}__${col}`);
                };

                return (
                  <tr
                    key={row._key}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"} ${isDirty ? "ring-1 ring-inset ring-amber-300/70" : ""} hover:bg-blue-50/30 transition-colors`}
                  >
                    <td className="border border-gray-200 text-center text-muted-foreground py-0.5 px-1 select-none">{idx + 1}</td>

                    <td className="border border-gray-200 p-0">
                      <input ref={mkRef("entryDate")} type="date" value={row.entryDate} dir="ltr"
                        className="w-full h-8 px-1.5 text-[11px] border-0 outline-none bg-transparent focus:bg-blue-50/60 focus:ring-1 focus:ring-blue-400 rounded"
                        onChange={e => updateField(row._key, "entryDate", e.target.value)}
                        onKeyDown={e => { if (e.key==="Tab"&&!e.shiftKey){e.preventDefault();nextCell(row._key,"entryDate");} if(e.key==="Tab"&&e.shiftKey){e.preventDefault();prevCell(row._key,"entryDate");} if(e.key==="Enter"){e.preventDefault();nextCell(row._key,"entryDate");} }}
                      />
                    </td>

                    <td className="border border-gray-200 p-0">
                      <input ref={mkRef("description")} type="text" value={row.description} dir="rtl" placeholder="البيان..."
                        className="w-full h-8 px-1.5 text-[12px] border-0 outline-none bg-transparent text-right focus:bg-blue-50/60 focus:ring-1 focus:ring-blue-400 rounded"
                        onChange={e => updateField(row._key, "description", e.target.value)}
                        onKeyDown={e => { if(e.key==="Tab"&&!e.shiftKey){e.preventDefault();nextCell(row._key,"description");} if(e.key==="Tab"&&e.shiftKey){e.preventDefault();prevCell(row._key,"description");} if(e.key==="Enter"){e.preventDefault();nextCell(row._key,"description");} }}
                      />
                    </td>

                    <td className="border border-gray-200 p-0">
                      <input ref={mkRef("referenceNumber")} type="text" value={row.referenceNumber} dir="rtl" placeholder="المرجع"
                        className="w-full h-8 px-1.5 text-[12px] border-0 outline-none bg-transparent text-right focus:bg-blue-50/60 focus:ring-1 focus:ring-blue-400 rounded"
                        onChange={e => updateField(row._key, "referenceNumber", e.target.value)}
                        onKeyDown={e => { if(e.key==="Tab"&&!e.shiftKey){e.preventDefault();nextCell(row._key,"referenceNumber");} if(e.key==="Tab"&&e.shiftKey){e.preventDefault();prevCell(row._key,"referenceNumber");} if(e.key==="Enter"){e.preventDefault();nextCell(row._key,"referenceNumber");} }}
                      />
                    </td>

                    {/* الوارد */}
                    <td className="border border-gray-200 p-0 bg-blue-50/20">
                      <input ref={mkRef("incomeDue")} type="number" value={row.incomeDue || ""} dir="ltr" placeholder="0"
                        className="w-full h-8 px-1.5 text-[12px] border-0 outline-none bg-transparent text-left focus:bg-blue-50/60 focus:ring-1 focus:ring-blue-400 rounded"
                        onChange={e => updateField(row._key, "incomeDue", e.target.value)}
                        onKeyDown={e => { if(e.key==="Tab"&&!e.shiftKey){e.preventDefault();nextCell(row._key,"incomeDue");} if(e.key==="Tab"&&e.shiftKey){e.preventDefault();prevCell(row._key,"incomeDue");} if(e.key==="Enter"){e.preventDefault();nextCell(row._key,"incomeDue");} }}
                      />
                    </td>
                    <td className="border border-gray-200 p-0 bg-blue-50/20">
                      <input ref={mkRef("incomeCollected")} type="number" value={row.incomeCollected || ""} dir="ltr" placeholder="0"
                        className="w-full h-8 px-1.5 text-[12px] border-0 outline-none bg-transparent text-left focus:bg-blue-50/60 focus:ring-1 focus:ring-blue-400 rounded"
                        onChange={e => updateField(row._key, "incomeCollected", e.target.value)}
                        onKeyDown={e => { if(e.key==="Tab"&&!e.shiftKey){e.preventDefault();nextCell(row._key,"incomeCollected");} if(e.key==="Tab"&&e.shiftKey){e.preventDefault();prevCell(row._key,"incomeCollected");} if(e.key==="Enter"){e.preventDefault();nextCell(row._key,"incomeCollected");} }}
                      />
                    </td>
                    <td className={`border border-gray-200 px-2 text-left font-semibold ${incRem < 0 ? "text-red-600" : incRem > 0 ? "text-orange-600" : "text-gray-400"} bg-blue-50/10`}>
                      {incRem !== 0 ? fmt(incRem) : "—"}
                    </td>
                    <td className="border border-gray-200 p-0 bg-blue-50/10">
                      <input ref={mkRef("incomeNote")} type="text" value={row.incomeNote} dir="rtl" placeholder="ملاحظة"
                        className="w-full h-8 px-1.5 text-[11px] border-0 outline-none bg-transparent text-right focus:bg-blue-50/60 focus:ring-1 focus:ring-blue-400 rounded"
                        onChange={e => updateField(row._key, "incomeNote", e.target.value)}
                        onKeyDown={e => { if(e.key==="Tab"&&!e.shiftKey){e.preventDefault();nextCell(row._key,"incomeNote");} if(e.key==="Tab"&&e.shiftKey){e.preventDefault();prevCell(row._key,"incomeNote");} if(e.key==="Enter"){e.preventDefault();nextCell(row._key,"incomeNote");} }}
                      />
                    </td>

                    {/* المنصرف */}
                    <td className="border border-gray-200 p-0 bg-green-50/20">
                      <input ref={mkRef("expenseDue")} type="number" value={row.expenseDue || ""} dir="ltr" placeholder="0"
                        className="w-full h-8 px-1.5 text-[12px] border-0 outline-none bg-transparent text-left focus:bg-green-50/80 focus:ring-1 focus:ring-green-400 rounded"
                        onChange={e => updateField(row._key, "expenseDue", e.target.value)}
                        onKeyDown={e => { if(e.key==="Tab"&&!e.shiftKey){e.preventDefault();nextCell(row._key,"expenseDue");} if(e.key==="Tab"&&e.shiftKey){e.preventDefault();prevCell(row._key,"expenseDue");} if(e.key==="Enter"){e.preventDefault();nextCell(row._key,"expenseDue");} }}
                      />
                    </td>
                    <td className="border border-gray-200 p-0 bg-green-50/20">
                      <input ref={mkRef("expensePaid")} type="number" value={row.expensePaid || ""} dir="ltr" placeholder="0"
                        className="w-full h-8 px-1.5 text-[12px] border-0 outline-none bg-transparent text-left focus:bg-green-50/80 focus:ring-1 focus:ring-green-400 rounded"
                        onChange={e => updateField(row._key, "expensePaid", e.target.value)}
                        onKeyDown={e => { if(e.key==="Tab"&&!e.shiftKey){e.preventDefault();nextCell(row._key,"expensePaid");} if(e.key==="Tab"&&e.shiftKey){e.preventDefault();prevCell(row._key,"expensePaid");} if(e.key==="Enter"){e.preventDefault();nextCell(row._key,"expensePaid");} }}
                      />
                    </td>
                    <td className={`border border-gray-200 px-2 text-left font-semibold ${expRem < 0 ? "text-red-600" : expRem > 0 ? "text-orange-600" : "text-gray-400"} bg-green-50/10`}>
                      {expRem !== 0 ? fmt(expRem) : "—"}
                    </td>
                    <td className="border border-gray-200 p-0 bg-green-50/10">
                      <input ref={mkRef("expenseNote")} type="text" value={row.expenseNote} dir="rtl" placeholder="ملاحظة"
                        className="w-full h-8 px-1.5 text-[11px] border-0 outline-none bg-transparent text-right focus:bg-green-50/80 focus:ring-1 focus:ring-green-400 rounded"
                        onChange={e => updateField(row._key, "expenseNote", e.target.value)}
                        onKeyDown={e => { if(e.key==="Tab"&&!e.shiftKey){e.preventDefault();nextCell(row._key,"expenseNote");} if(e.key==="Tab"&&e.shiftKey){e.preventDefault();prevCell(row._key,"expenseNote");} if(e.key==="Enter"){e.preventDefault();addRow();} }}
                      />
                    </td>

                    {/* حذف */}
                    <td className="border border-gray-200 text-center p-0">
                      <button
                        onClick={() => deleteRow(row._key)}
                        disabled={deleting === row._key}
                        className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors mx-auto"
                      >
                        {deleting === row._key
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={13} className="border border-gray-200 py-12 text-center text-muted-foreground text-sm">
                    لا توجد إدخالات. اضغط «إضافة صف» لبدء التسجيل.
                  </td>
                </tr>
              )}
            </tbody>

            {/* صف الإجماليات */}
            {filtered.length > 0 && (
              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-indigo-900 text-white font-bold text-[12px]">
                  <td colSpan={4} className="border border-indigo-700 px-3 py-2 text-center">الإجمالي</td>
                  <td className="border border-indigo-700 px-2 py-2 text-left">{fmtNum(totals.incomeDue)}</td>
                  <td className="border border-indigo-700 px-2 py-2 text-left">{fmtNum(totals.incomeCollected)}</td>
                  <td className={`border border-indigo-700 px-2 py-2 text-left ${incomeRemaining < 0 ? "text-red-300" : "text-yellow-200"}`}>
                    {fmtNum(incomeRemaining)}
                  </td>
                  <td className="border border-indigo-700 px-2 py-2" />
                  <td className="border border-indigo-700 px-2 py-2 text-left">{fmtNum(totals.expenseDue)}</td>
                  <td className="border border-indigo-700 px-2 py-2 text-left">{fmtNum(totals.expensePaid)}</td>
                  <td className={`border border-indigo-700 px-2 py-2 text-left ${expenseRemaining < 0 ? "text-red-300" : "text-yellow-200"}`}>
                    {fmtNum(expenseRemaining)}
                  </td>
                  <td className="border border-indigo-700 px-2 py-2" />
                  <td className="border border-indigo-700 px-2 py-2" />
                </tr>
                <tr className="bg-[#1B2B5C] text-white font-extrabold text-[13px]">
                  <td colSpan={4} className="border border-[#0F1D40] px-3 py-2.5 text-center">
                    الرصيد النهائي
                  </td>
                  <td colSpan={9} className={`border border-[#0F1D40] px-3 py-2.5 text-center text-lg ${balance >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    {fmtNum(Math.abs(balance))} — {balance >= 0 ? "رصيد دائن (فائض)" : "رصيد مدين (عجز)"}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {/* ── شريط سفلي: زر إضافة سريعة ───────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-t border-border/40 bg-muted/10">
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          إضافة صف جديد
        </button>
        <span className="text-muted-foreground/40 text-xs">|</span>
        <span className="text-xs text-muted-foreground">
          {filtered.length} صف{dirtyCount > 0 ? ` — ${dirtyCount} غير محفوظ` : ""}
        </span>
        {dirtyCount > 0 && (
          <Button size="sm" className="h-7 text-xs mr-auto gap-1" onClick={saveAll} disabled={saving}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            حفظ التغييرات
          </Button>
        )}
      </div>
    </div>
  );
}
