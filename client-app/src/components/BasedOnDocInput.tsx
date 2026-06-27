/**
 * BasedOnDocInput — حقل رقم المستند المصدر (بناءً على)
 *
 * كليك يمين → قائمة سلاسل الترقيم المُشتقّة من:
 *   1) دفاتر المستندات المُعدَّة (تظهر حتى لو لا يوجد أي مستند بعد)
 *   2) المستندات الفعلية الموجودة في قاعدة البيانات
 *
 * زر 🔍 → نافذة بحث كاملة في مستندات النوع المحدد
 *   - بحث نصي، ترتيب بالأعمدة، تنقل بـ ↑↓ Enter Esc
 *   - نقر مزدوج أو Enter لتحميل المستند مباشرةً
 *
 * اختر سلسلة → يظهر البادئة الثابتة، اكتب الرقم الباقي + Enter → تحميل.
 * رسالة خطأ عند عدم العثور على المستند.
 *
 * يعمل مع: عرض أسعار | أمر بيع | فاتورة مبيعات | تحويل داخلي
 */
import React, {
  useState, useMemo, useRef, useEffect,
  type KeyboardEvent, type MouseEvent,
} from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Search, X, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────────────── */
type DocType = 'quote' | 'order' | 'sale' | 'transfer' | '';

interface Series { prefix: string; padLen: number; count: number; fromJournal: boolean; }

interface Props {
  docType:     DocType;
  value:       string;
  onChange:    (v: string) => void;
  onPick:      (num: string) => void;
  warehouseId?: number | null;
  isFetching:  boolean;
  trigger:     string;
  isFound:     boolean | null;
}

/* ── Mapping basedOnType → journal docType ──────────────────────────────── */
const JOURNAL_DOC_TYPE: Record<string, string> = {
  quote:    'sales_invoice',
  order:    'sales_invoice',
  sale:     'sales_invoice',
  transfer: 'stock_transfer',
};

/* ── Extract series from existing document numbers ─────────────────────── */
function extractFromDocs(numbers: (string | null | undefined)[]): Map<string, { padLen: number; count: number }> {
  const map = new Map<string, { padLen: number; count: number }>();
  for (const num of numbers) {
    if (!num) continue;
    const m = num.match(/^(.*[-.])\d+$/);
    if (!m) continue;
    const suffix = num.slice(m[1].length);
    const cur = map.get(m[1]);
    map.set(m[1], { padLen: Math.max(cur?.padLen ?? 0, suffix.length), count: (cur?.count ?? 0) + 1 });
  }
  return map;
}

/* ── Build series from journal configuration ────────────────────────────── */
function seriesFromJournal(j: { numberPrefix: string; includeYear: boolean; numDigits: number; name: string }): { prefix: string; padLen: number } {
  const year = new Date().getFullYear();
  const prefix = j.includeYear ? `${j.numberPrefix}${year}-` : `${j.numberPrefix}`;
  return { prefix, padLen: j.numDigits || 6 };
}

/* ── Status badge ─────────────────────────────────────────────────────── */
const STATUS_MAP: Record<string, { ar: string; color: string; bg: string }> = {
  draft:     { ar: "مسودة",    color: "#92400e", bg: "#fef3c7" },
  pending:   { ar: "معلّقة",   color: "#1e40af", bg: "#dbeafe" },
  confirmed: { ar: "مؤكدة",   color: "#065f46", bg: "#d1fae5" },
  posted:    { ar: "مُرحَّلة", color: "#1e3a5f", bg: "#bfdbfe" },
  cancelled: { ar: "ملغاة",   color: "#991b1b", bg: "#fee2e2" },
};

/* ── Dialog title per doc type ──────────────────────────────────────────── */
const DOC_TITLE: Record<string, string> = {
  quote:    "عروض الأسعار",
  order:    "أوامر البيع",
  sale:     "فواتير المبيعات",
  transfer: "تحويلات المخزون",
};

/* ── Helpers ──────────────────────────────────────────────────────────── */
function fmtDate(d: any): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-SA", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch { return String(d).slice(0, 10); }
}

function fmtNum(v: any): string {
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function BasedOnDocInput({
  docType, value, onChange, onPick,
  warehouseId, isFetching, trigger, isFound,
}: Props) {

  /* ── Context menu state ── */
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos,     setMenuPos]     = useState({ x: 0, y: 0 });
  const [selPrefix,   setSelPrefix]   = useState("");
  const [selPadLen,   setSelPadLen]   = useState(6);
  const [prevTrigger, setPrevTrigger] = useState("");

  /* ── Search dialog state ── */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ,    setSearchQ]    = useState("");
  const [sortCol,    setSortCol]    = useState("invoiceDate");
  const [sortDir,    setSortDir]    = useState<"asc" | "desc">("desc");
  const [activeIdx,  setActiveIdx]  = useState(0);

  /* ── Refs ── */
  const inputRef       = useRef<HTMLInputElement>(null);
  const menuRef        = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowsRef        = useRef<(HTMLTableRowElement | null)[]>([]);

  /* ── Ref that always holds latest dialog state (for keyboard handler) ── */
  const dialogCtx = useRef({ activeIdx: 0, filteredDocs: [] as any[], pickDoc: (_: any) => {} });

  /* ── Toast on not found ─────────────────────────────────────────────── */
  useEffect(() => {
    if (trigger && trigger !== prevTrigger && !isFetching && isFound === false) {
      toast.error(`لا يمكن العثور على المستند: ${trigger}`, { duration: 3000 });
    }
    if (trigger !== prevTrigger) setPrevTrigger(trigger);
  }, [trigger, isFetching, isFound]);

  /* ── Fetch journals ─────────────────────────────────────────────────── */
  const journalDocType = docType ? JOURNAL_DOC_TYPE[docType] : null;
  const journalsQ = trpc.documentJournals.list.useQuery(
    { docType: journalDocType! },
    { enabled: !!journalDocType, staleTime: 300_000 }
  );

  /* ── Fetch existing docs ─────────────────────────────────────────────── */
  const isSales = docType === 'sale' || docType === 'quote' || docType === 'order';
  const salesQ  = trpc.salesInvoices.list.useQuery(
    { invoiceType: docType as 'sale' | 'quote' | 'order', ...(warehouseId ? { warehouseId } : {}), limit: 500 },
    { enabled: isSales && !!docType, staleTime: 60_000 }
  );
  const stockQ = trpc.stockVouchers.list.useQuery(
    { type: 'transfer' },
    { enabled: docType === 'transfer', staleTime: 60_000 }
  );

  /* ── Merged series list ─────────────────────────────────────────────── */
  const series: Series[] = useMemo(() => {
    const merged = new Map<string, Series>();
    for (const j of (journalsQ.data ?? [])) {
      const { prefix, padLen } = seriesFromJournal(j as any);
      if (!prefix) continue;
      merged.set(prefix, { prefix, padLen, count: 0, fromJournal: true });
    }
    const docNumbers = isSales
      ? (salesQ.data ?? []).map(r => r.invoiceNumber)
      : docType === 'transfer'
        ? (stockQ.data ?? []).map((r: any) => r.voucherNumber)
        : [];
    for (const [pfx, { padLen, count }] of extractFromDocs(docNumbers)) {
      const existing = merged.get(pfx);
      merged.set(pfx, {
        prefix: pfx,
        padLen: Math.max(existing?.padLen ?? 0, padLen),
        count,
        fromJournal: existing?.fromJournal ?? false,
      });
    }
    return [...merged.values()].sort((a, b) => a.prefix.localeCompare(b.prefix));
  }, [journalsQ.data, salesQ.data, stockQ.data, docType, isSales]);

  /* ── All documents for search dialog ───────────────────────────────── */
  const allDocs: any[] = useMemo(() => {
    if (isSales)             return salesQ.data ?? [];
    if (docType === 'transfer') return (stockQ.data ?? []) as any[];
    return [];
  }, [salesQ.data, stockQ.data, isSales, docType]);

  /* ── Filtered + sorted ──────────────────────────────────────────────── */
  const filteredDocs: any[] = useMemo(() => {
    let docs = [...allDocs];
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      docs = docs.filter(d => {
        const num  = (d.invoiceNumber ?? d.voucherNumber ?? "").toLowerCase();
        const cust = (d.customerName  ?? d.notes         ?? "").toLowerCase();
        return num.includes(q) || cust.includes(q);
      });
    }
    docs.sort((a, b) => {
      let av: any = a[sortCol] ?? "";
      let bv: any = b[sortCol] ?? "";
      if (sortCol === "total") { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; }
      else { av = String(av); bv = String(bv); }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return docs;
  }, [allDocs, searchQ, sortCol, sortDir]);

  /* ── Reset on type change ───────────────────────────────────────────── */
  useEffect(() => { setSelPrefix(""); setSelPadLen(6); }, [docType]);

  /* ── Focus & reset when dialog opens ───────────────────────────────── */
  useEffect(() => {
    if (searchOpen) {
      setActiveIdx(0);
      rowsRef.current = [];
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
  }, [searchOpen]);

  /* ── Scroll active row into view ────────────────────────────────────── */
  useEffect(() => {
    if (searchOpen) rowsRef.current[activeIdx]?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, searchOpen]);

  /* ── Keep dialogCtx ref in sync ─────────────────────────────────────── */
  useEffect(() => {
    dialogCtx.current.activeIdx   = activeIdx;
    dialogCtx.current.filteredDocs = filteredDocs;
  });

  /* ── Close context menu on outside click / Escape ───────────────────── */
  useEffect(() => {
    if (!menuVisible) return;
    const onMouse = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuVisible(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setMenuVisible(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown',   onKey);
    return () => { document.removeEventListener('mousedown', onMouse); document.removeEventListener('keydown', onKey); };
  }, [menuVisible]);

  /* ── Dialog keyboard handler ────────────────────────────────────────── */
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      const { activeIdx, filteredDocs, pickDoc } = dialogCtx.current;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, filteredDocs.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredDocs[activeIdx]) pickDoc(filteredDocs[activeIdx]);
      } else if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [searchOpen]);

  /* ── Right-click → context menu ─────────────────────────────────────── */
  function handleContextMenu(e: MouseEvent<HTMLInputElement>) {
    if (!docType) return;
    e.preventDefault();
    const vw = window.innerWidth, vh = window.innerHeight;
    const menuW = 220, menuH = Math.min(series.length * 38 + 70, 360);
    const x = e.clientX + menuW > vw ? e.clientX - menuW : e.clientX;
    const y = e.clientY + menuH > vh ? e.clientY - menuH : e.clientY;
    setMenuPos({ x, y });
    setMenuVisible(true);
  }

  /* ── Select a series ─────────────────────────────────────────────────── */
  function selectSeries(s: Series) {
    setSelPrefix(s.prefix);
    setSelPadLen(s.padLen || 6);
    setMenuVisible(false);
    onChange(s.prefix);
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(s.prefix.length, s.prefix.length);
    }, 0);
  }

  /* ── Construct full number then trigger load ─────────────────────────── */
  function doPick() {
    const raw = value.trim();
    if (!raw) return;
    let fullNum = raw;
    if (selPrefix && raw.startsWith(selPrefix)) {
      const suffix = raw.slice(selPrefix.length);
      if (/^\d+$/.test(suffix) && suffix.length > 0) {
        fullNum = selPrefix + suffix.padStart(selPadLen, '0');
      }
    }
    onChange(fullNum);
    onPick(fullNum);
  }

  /* ── Input keyboard ──────────────────────────────────────────────────── */
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') doPick();
  }

  /* ── Pick from search dialog ─────────────────────────────────────────── */
  function pickDoc(doc: any) {
    const num = doc.invoiceNumber ?? doc.voucherNumber;
    if (!num) return;
    onChange(num);
    onPick(num);
    setSearchOpen(false);
    setSearchQ("");
  }

  /* Keep pickDoc in ref for keyboard handler */
  dialogCtx.current.pickDoc = pickDoc;

  /* ── Sort column ─────────────────────────────────────────────────────── */
  function handleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
    setActiveIdx(0);
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronsUpDown style={{ width: 9, height: 9, opacity: 0.4, display: "inline", verticalAlign: "middle", marginRight: 2 }} />;
    return sortDir === "asc"
      ? <ChevronUp   style={{ width: 9, height: 9, display: "inline", verticalAlign: "middle", marginRight: 2 }} />
      : <ChevronDown style={{ width: 9, height: 9, display: "inline", verticalAlign: "middle", marginRight: 2 }} />;
  }

  const seriesLoading = journalsQ.isLoading || salesQ.isLoading || stockQ.isLoading;
  const isLoading     = salesQ.isLoading || stockQ.isLoading;
  const dialogTitle   = docType ? (DOC_TITLE[docType] ?? "مستندات") : "مستندات";

  /* ═══════════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Input ── */}
      <div className="relative flex-1 min-w-0">
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={!docType}
          onChange={e => {
            onChange(e.target.value);
            if (selPrefix && !e.target.value.startsWith(selPrefix)) setSelPrefix("");
          }}
          onBlur={() => { if (docType && value.trim()) doPick(); }}
          onKeyDown={handleKeyDown}
          onContextMenu={handleContextMenu}
          placeholder={docType
            ? (series.length > 0 ? "رقم المستند + Enter ↵  (كليك ⊞ للسلاسل)" : "رقم المستند ثم Enter ↵")
            : ""}
          title={series.length > 0 ? "كليك يمين لاختيار سلسلة الترقيم" : ""}
          className="classic-input w-full"
          style={{ height: 26, direction: "ltr" }}
          spellCheck={false}
          autoComplete="off"
        />

        {/* Status icons */}
        {isFetching && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-500">⏳</span>
        )}
        {trigger && !isFetching && isFound === false && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-red-500 font-bold">✗</span>
        )}
        {trigger && !isFetching && isFound === true && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-green-600 font-bold">✓</span>
        )}

        {/* Series available indicator */}
        {docType && series.length > 0 && !isFetching && (
          <span
            className="absolute top-1/2 -translate-y-1/2"
            style={{ right: 5, fontSize: 7, color: "#1a7fd4", opacity: 0.6, pointerEvents: "none", userSelect: "none" }}
          >⊞</span>
        )}
      </div>

      {/* ── (+) Search Button ── */}
      {docType && (
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          title={`بحث في ${dialogTitle}`}
          style={{
            width: 26, height: 26, flexShrink: 0,
            background: "linear-gradient(135deg,#1a7fd4,#1e40af)",
            border: "1px solid #1a5fad",
            borderRadius: 4,
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Search style={{ width: 13, height: 13 }} />
        </button>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Context Menu
          ════════════════════════════════════════════════════════════════════ */}
      {menuVisible && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top:  menuPos.y,
            left: menuPos.x,
            zIndex: 99999,
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            boxShadow: "0 4px 28px rgba(0,0,0,0.2)",
            minWidth: 220,
            maxHeight: 360,
            overflowY: "auto",
            direction: "rtl",
          }}
        >
          <div style={{
            padding: "7px 12px",
            background: "linear-gradient(135deg,#1a7fd4,#2563ab)",
            color: "#fff", fontSize: 11, fontWeight: 700,
            position: "sticky", top: 0,
          }}>
            سلاسل الترقيم — اختر بادئة
          </div>

          {seriesLoading && (
            <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#888" }}>
              ⏳ جاري التحميل...
            </div>
          )}

          {!seriesLoading && series.length === 0 && (
            <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#888" }}>
              لا توجد دفاتر مُعدَّة لهذا النوع
            </div>
          )}

          {series.map(s => (
            <div
              key={s.prefix}
              onClick={() => selectSeries(s)}
              style={{
                padding: "8px 14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 12,
                borderBottom: "1px solid #f3f4f6",
                gap: 10,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#eff6ff")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}
            >
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#1a3f6f", direction: "ltr" }}>
                {s.prefix}
              </span>
              <span style={{ fontSize: 10, color: s.count > 0 ? "#555" : "#aaa", flexShrink: 0, whiteSpace: "nowrap" }}>
                {s.count > 0 ? `${s.count} مستند` : "جديد"}
              </span>
            </div>
          ))}

          <div style={{
            padding: "5px 12px", fontSize: 10, color: "#aaa",
            background: "#f9fafb", borderTop: "1px solid #eee",
            position: "sticky", bottom: 0,
          }}>
            اختر السلسلة ثم اكتب الرقم + Enter
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Search Dialog
          ════════════════════════════════════════════════════════════════════ */}
      {searchOpen && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.5)",
            zIndex: 99998,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onMouseDown={e => { if (e.target === e.currentTarget) setSearchOpen(false); }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
              width: "min(820px, 96vw)",
              maxHeight: "82vh",
              display: "flex",
              flexDirection: "column",
              direction: "rtl",
              overflow: "hidden",
            }}
          >
            {/* ── Header ── */}
            <div style={{
              padding: "11px 16px",
              background: "linear-gradient(135deg,#1a7fd4,#1e3a8a)",
              color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Search style={{ width: 15, height: 15, opacity: 0.85 }} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>بحث في {dialogTitle}</span>
                {warehouseId && (
                  <span style={{
                    fontSize: 10, opacity: 0.8,
                    background: "rgba(255,255,255,0.18)",
                    borderRadius: 10, padding: "1px 8px",
                  }}>الفرع الحالي فقط</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", padding: 3, borderRadius: 4, lineHeight: 0 }}
              >
                <X style={{ width: 17, height: 17 }} />
              </button>
            </div>

            {/* ── Search bar ── */}
            <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <Search style={{
                  position: "absolute", right: 9, top: "50%",
                  transform: "translateY(-50%)", width: 13, height: 13, color: "#94a3b8",
                }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQ}
                  onChange={e => { setSearchQ(e.target.value); setActiveIdx(0); }}
                  placeholder="ابحث برقم المستند أو اسم العميل..."
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "7px 32px 7px 10px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6, fontSize: 13,
                    outline: "none", direction: "rtl",
                    background: "#fff",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#3b82f6")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#d1d5db")}
                />
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
                <span>
                  {isLoading
                    ? "⏳ جاري التحميل…"
                    : <><strong style={{ color: "#374151" }}>{filteredDocs.length}</strong> مستند{allDocs.length !== filteredDocs.length ? ` من ${allDocs.length}` : ""}</>
                  }
                </span>
                <span style={{ direction: "ltr", fontFamily: "monospace", fontSize: 10 }}>
                  ↑↓ للتنقل · Enter للاختيار · Esc للإغلاق
                </span>
              </div>
            </div>

            {/* ── Table ── */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {isLoading && (
                <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                  ⏳ جاري تحميل المستندات…
                </div>
              )}
              {!isLoading && filteredDocs.length === 0 && (
                <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                  {searchQ.trim() ? `لا توجد نتائج مطابقة لـ "${searchQ}"` : "لا توجد مستندات"}
                </div>
              )}
              {!isLoading && filteredDocs.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr style={{ background: "#f1f5f9" }}>
                      {[
                        { col: "invoiceNumber", label: "رقم المستند",  w: "19%" },
                        { col: "invoiceDate",   label: "التاريخ",       w: "13%" },
                        { col: "customerName",  label: "العميل",        w: "30%" },
                        { col: "total",         label: "الإجمالي",      w: "13%" },
                        { col: "status",        label: "الحالة",        w: "12%" },
                        { col: "invoiceType",   label: "النوع",         w: "13%" },
                      ].map(({ col, label, w }) => (
                        <th
                          key={col}
                          onClick={() => handleSort(col)}
                          style={{
                            width: w, padding: "8px 10px",
                            textAlign: "right", fontWeight: 600,
                            fontSize: 11, color: "#475569",
                            cursor: "pointer", userSelect: "none",
                            borderBottom: "2px solid #e2e8f0",
                            whiteSpace: "nowrap",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#e2e8f0")}
                          onMouseLeave={e => (e.currentTarget.style.background = "")}
                        >
                          {label} <SortIcon col={col} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map((doc: any, idx: number) => {
                      const num   = doc.invoiceNumber ?? doc.voucherNumber ?? "";
                      const st    = STATUS_MAP[doc.status] ?? { ar: doc.status ?? "—", color: "#555", bg: "#f3f4f6" };
                      const isAct = idx === activeIdx;
                      return (
                        <tr
                          key={doc.id ?? idx}
                          ref={el => { rowsRef.current[idx] = el; }}
                          onClick={() => setActiveIdx(idx)}
                          onDoubleClick={() => pickDoc(doc)}
                          style={{
                            background: isAct ? "#dbeafe" : idx % 2 === 0 ? "#fff" : "#f8fafc",
                            cursor: "pointer",
                            outline: isAct ? "2px solid #3b82f6" : "none",
                            outlineOffset: -1,
                            transition: "background 0.08s",
                          }}
                          onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = "#eff6ff"; }}
                          onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#f8fafc"; }}
                        >
                          {/* رقم المستند */}
                          <td style={{ padding: "7px 10px", fontFamily: "monospace", fontWeight: 700, color: "#1a3f6f", direction: "ltr", textAlign: "left" }}>
                            {num}
                          </td>
                          {/* التاريخ */}
                          <td style={{ padding: "7px 10px", color: "#374151", direction: "ltr", textAlign: "left", whiteSpace: "nowrap", fontSize: 11 }}>
                            {fmtDate(doc.invoiceDate ?? doc.voucherDate)}
                          </td>
                          {/* العميل */}
                          <td style={{ padding: "7px 10px", color: "#374151", maxWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {doc.customerName ?? doc.notes ?? "—"}
                          </td>
                          {/* الإجمالي */}
                          <td style={{ padding: "7px 10px", direction: "ltr", textAlign: "left", fontFamily: "monospace", color: "#065f46", fontWeight: 600 }}>
                            {fmtNum(doc.total ?? doc.totalAmount)}
                          </td>
                          {/* الحالة */}
                          <td style={{ padding: "7px 10px" }}>
                            <span style={{
                              display: "inline-block",
                              padding: "2px 8px", borderRadius: 10,
                              fontSize: 10, fontWeight: 600,
                              background: st.bg, color: st.color,
                              whiteSpace: "nowrap",
                            }}>{st.ar}</span>
                          </td>
                          {/* النوع */}
                          <td style={{ padding: "7px 10px", color: "#64748b", fontSize: 11 }}>
                            {doc.invoiceType === "quote"    ? "عرض أسعار"
                           : doc.invoiceType === "order"    ? "أمر بيع"
                           : doc.invoiceType === "sale"     ? "فاتورة مبيعات"
                           : doc.invoiceType === "return"   ? "مردود"
                           : doc.voucherType  === "transfer"? "تحويل مخزون"
                           : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Footer ── */}
            <div style={{
              padding: "8px 14px",
              background: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
              flexShrink: 0,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 11, color: "#94a3b8",
            }}>
              <span>انقر مرتين أو اضغط <kbd style={{ background: "#e2e8f0", borderRadius: 3, padding: "0 4px", fontSize: 10, color: "#374151" }}>Enter</kbd> لتحميل المستند</span>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                style={{
                  padding: "4px 16px",
                  background: "#e5e7eb",
                  border: "1px solid #d1d5db",
                  borderRadius: 5,
                  fontSize: 12, color: "#374151",
                  cursor: "pointer",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#d1d5db")}
                onMouseLeave={e => (e.currentTarget.style.background = "#e5e7eb")}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
