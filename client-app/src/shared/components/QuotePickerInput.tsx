/**
 * QuotePickerInput — منتقي عروض الأسعار بثلاث طرق
 *
 * الطريقة 1: كتابة الرقم كاملاً ثم Enter
 * الطريقة 2: اختيار سلسلة الترقيم ثم كتابة الرقم القصير فقط
 * الطريقة 3: زر البحث 🔍 → نافذة جميع عروض الأسعار
 */
import React, { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/shared/lib/trpc";

interface Props {
  value:       string;
  onChange:    (v: string) => void;
  onPick:      (num: string) => void;
  warehouseId?: number | null;
  isFetching:  boolean;
  trigger:     string;
  isFound:     boolean | null;
}

const STATUS_LABEL: Record<string, string> = {
  draft:     "مسودة",
  confirmed: "مرسل",
  cancelled: "ملغي",
  paid:      "معتمد",
};
const STATUS_BG: Record<string, string> = {
  draft:     "#f5f5f5",
  confirmed: "#dbeafe",
  cancelled: "#fee2e2",
  paid:      "#dcfce7",
};
const STATUS_COLOR: Record<string, string> = {
  draft:     "#666",
  confirmed: "#1a7fd4",
  cancelled: "#cc2222",
  paid:      "#1a8f3a",
};

export default function QuotePickerInput({
  value, onChange, onPick, warehouseId, isFetching, trigger, isFound,
}: Props) {

  const [selectedSeries, setSelectedSeries] = useState("");
  const [shortNum,        setShortNum]       = useState("");
  const [showSearch,      setShowSearch]     = useState(false);
  const [searchText,      setSearchText]     = useState("");
  const [highlightIdx,    setHighlightIdx]   = useState(0);

  const shortNumRef = useRef<HTMLInputElement>(null);
  const searchRef   = useRef<HTMLInputElement>(null);
  const rowRefs     = useRef<(HTMLTableRowElement | null)[]>([]);

  /* ── Fetch all quotes ─────────────────────────────────────────────────── */
  const quotesQuery = trpc.salesInvoices.list.useQuery(
    { invoiceType: "quote", ...(warehouseId ? { warehouseId } : {}) },
    { staleTime: 60_000 }
  );
  const quotes = quotesQuery.data ?? [];

  /* ── Derive series prefixes from existing quote numbers ───────────────── */
  const seriesList = useMemo(() => {
    const map = new Map<string, number>(); // prefix → padLen
    quotes.forEach(q => {
      const num = q.invoiceNumber;
      if (!num) return;
      const m = num.match(/^(.*[-.])\d+$/);
      if (!m) return;
      const padLen = num.length - m[1].length;
      map.set(m[1], Math.max(map.get(m[1]) ?? 0, padLen));
    });
    return [...map.entries()]
      .map(([prefix, padLen]) => ({ prefix, padLen }))
      .sort((a, b) => a.prefix.localeCompare(b.prefix));
  }, [quotes]);

  /* ── Focus short-num when series changes ──────────────────────────────── */
  useEffect(() => {
    if (selectedSeries) shortNumRef.current?.focus();
  }, [selectedSeries]);

  /* ── Open search modal ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!showSearch) return;
    setHighlightIdx(0);
    rowRefs.current = [];
    const t = setTimeout(() => searchRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [showSearch]);

  /* ── Scroll highlighted row into view ────────────────────────────────── */
  useEffect(() => {
    rowRefs.current[highlightIdx]?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  /* ── Confirm pick ─────────────────────────────────────────────────────── */
  function doPick(num: string) {
    onChange(num);
    onPick(num);
  }

  /* ── Method 2: shortNum → full number ────────────────────────────────── */
  function handleShortNumKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const raw = shortNum.trim();
    if (!raw) return;
    const series = seriesList.find(s => s.prefix === selectedSeries);
    const padLen = series?.padLen ?? 6;
    const fullNum = selectedSeries + raw.padStart(padLen, "0");
    doPick(fullNum);
  }

  /* ── Method 1: full number → pick ────────────────────────────────────── */
  function handleFullNumKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && value.trim()) doPick(value.trim());
  }

  /* ── Filtered quotes for search modal ────────────────────────────────── */
  const filteredQuotes = useMemo(() => {
    const visible = quotes.filter(q => q.status !== "cancelled");
    if (!searchText.trim()) return visible;
    const q = searchText.toLowerCase();
    return visible.filter(r =>
      r.invoiceNumber?.toLowerCase().includes(q) ||
      r.customerName?.toLowerCase().includes(q)
    );
  }, [quotes, searchText]);

  /* ── Select from search modal ─────────────────────────────────────────── */
  function selectQuote(q: typeof quotes[number]) {
    doPick(q.invoiceNumber);
    setShowSearch(false);
    setSearchText("");
  }

  /* ── Keyboard nav inside search modal ───────────────────────────────── */
  function handleSearchKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      setHighlightIdx(i => Math.min(i + 1, filteredQuotes.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setHighlightIdx(i => Math.max(i - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (filteredQuotes[highlightIdx]) selectQuote(filteredQuotes[highlightIdx]);
    } else if (e.key === "Escape") {
      setShowSearch(false);
    }
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <>
      {/* ── Series dropdown (Method 2) ── */}
      {seriesList.length > 0 && (
        <select
          value={selectedSeries}
          onChange={e => {
            setSelectedSeries(e.target.value);
            setShortNum("");
            onChange("");
          }}
          className="classic-input flex-shrink-0"
          style={{ height: 26, fontSize: 11, maxWidth: 110 }}
          title="سلسلة الترقيم — اختر ثم اكتب الرقم فقط"
        >
          <option value="">— سلسلة —</option>
          {seriesList.map(s => (
            <option key={s.prefix} value={s.prefix}>{s.prefix}</option>
          ))}
        </select>
      )}

      {/* ── Number input — full or short ── */}
      <div className="relative flex-1 min-w-0">
        {selectedSeries ? (
          /* Short-number mode */
          <div className="flex items-center classic-input w-full" style={{ height: 26, padding: 0, gap: 0 }}>
            <span style={{
              padding: "0 5px", fontSize: 10, fontWeight: 700, color: "#1a7fd4",
              borderRight: "1px solid #ccc", whiteSpace: "nowrap", flexShrink: 0,
              fontFamily: "monospace", direction: "ltr",
            }}>{selectedSeries}</span>
            <input
              ref={shortNumRef}
              type="text"
              inputMode="numeric"
              value={shortNum}
              onChange={e => { setShortNum(e.target.value); onChange(""); }}
              onKeyDown={handleShortNumKey}
              placeholder="رقم"
              style={{
                border: "none", outline: "none", background: "transparent",
                height: "100%", flex: 1, minWidth: 0, padding: "0 5px",
                direction: "ltr", textAlign: "left", fontSize: 12,
              }}
            />
          </div>
        ) : (
          /* Full-number mode */
          <input
            type="text"
            value={value}
            onChange={e => { onChange(e.target.value); }}
            onBlur={() => { if (value.trim()) onPick(value.trim()); }}
            onKeyDown={handleFullNumKey}
            placeholder="رقم عرض السعر ثم Enter ↵"
            className="classic-input w-full"
            style={{ height: 26, direction: "ltr", paddingLeft: 28 }}
          />
        )}

        {/* Status icons */}
        {isFetching && (
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-blue-500">⏳</span>
        )}
        {trigger && !isFetching && isFound === false && (
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-red-500 font-bold">✗</span>
        )}
        {trigger && !isFetching && isFound === true && (
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-green-600 font-bold">✓</span>
        )}
      </div>

      {/* ── Search button (Method 3) ── */}
      <button
        type="button"
        onClick={() => setShowSearch(true)}
        title="بحث في عروض الأسعار"
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          height: 26, width: 26, border: "1px solid #bbb", borderRadius: 4,
          background: "#f5f8fc", cursor: "pointer", fontSize: 13, color: "#1a7fd4",
          padding: 0, flexShrink: 0,
        }}
      >
        🔍
      </button>

      {/* ════════════════════════════════════════════════════════════════════
          Search Modal (Method 3)
          ════════════════════════════════════════════════════════════════════ */}
      {showSearch && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowSearch(false); }}
        >
          <div
            className="bg-white rounded-lg shadow-2xl flex flex-col"
            style={{ width: 740, maxHeight: "78vh", direction: "rtl" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b rounded-t-lg"
              style={{ background: "linear-gradient(135deg,#1a7fd4 0%,#2563ab 100%)", color: "#fff" }}
            >
              <span style={{ fontWeight: 700, fontSize: 13 }}>🔍 بحث في عروض الأسعار</span>
              <button
                type="button"
                onClick={() => setShowSearch(false)}
                style={{ background: "none", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
              >✕</button>
            </div>

            {/* Search input */}
            <div className="px-4 py-2.5 border-b" style={{ background: "#f8fafc" }}>
              <input
                ref={searchRef}
                type="text"
                value={searchText}
                onChange={e => { setSearchText(e.target.value); setHighlightIdx(0); }}
                onKeyDown={handleSearchKey}
                placeholder="ابحث برقم العرض أو اسم العميل..."
                className="classic-input w-full"
                style={{ height: 30 }}
              />
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1">
              {quotesQuery.isFetching ? (
                <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                  ⏳ جاري التحميل...
                </div>
              ) : filteredQuotes.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                  لا توجد عروض أسعار مطابقة
                </div>
              ) : (
                <table className="w-full" style={{ fontSize: 12, borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr style={{ background: "#f0f4fa", borderBottom: "2px solid #d1d5db" }}>
                      <th className="px-3 py-2 text-right font-bold text-gray-600" style={{ width: 160 }}>رقم العرض</th>
                      <th className="px-3 py-2 text-right font-bold text-gray-600" style={{ width: 90 }}>التاريخ</th>
                      <th className="px-3 py-2 text-right font-bold text-gray-600">العميل</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-600" style={{ width: 110 }}>الإجمالي</th>
                      <th className="px-3 py-2 text-center font-bold text-gray-600" style={{ width: 80 }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotes.map((q, idx) => (
                      <tr
                        key={q.id}
                        ref={el => { rowRefs.current[idx] = el; }}
                        onClick={() => setHighlightIdx(idx)}
                        onDoubleClick={() => selectQuote(q)}
                        style={{
                          background: idx === highlightIdx ? "#dbeafe" : idx % 2 === 0 ? "#fff" : "#f9fafb",
                          cursor: "pointer",
                          borderBottom: "1px solid #eee",
                          outline: "none",
                        }}
                      >
                        <td className="px-3 py-1.5 font-bold" style={{ color: "#1a7fd4", fontFamily: "monospace", direction: "ltr", textAlign: "left" }}>
                          {q.invoiceNumber}
                        </td>
                        <td className="px-3 py-1.5 text-gray-500" style={{ whiteSpace: "nowrap" }}>
                          {q.invoiceDate ? new Date(q.invoiceDate).toLocaleDateString("ar-SA") : "—"}
                        </td>
                        <td className="px-3 py-1.5" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {q.customerName ?? "—"}
                        </td>
                        <td className="px-3 py-1.5 text-left font-mono" style={{ color: "#1a3f6f" }}>
                          {q.total != null ? Number(q.total).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <span style={{
                            padding: "2px 7px", borderRadius: 10, fontWeight: 600, fontSize: 10,
                            background: STATUS_BG[q.status ?? "draft"],
                            color: STATUS_COLOR[q.status ?? "draft"],
                          }}>
                            {STATUS_LABEL[q.status ?? "draft"] ?? q.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-4 py-2 border-t flex items-center justify-between rounded-b-lg"
              style={{ background: "#f8fafc", fontSize: 10.5, color: "#888" }}
            >
              <span>نقر مزدوج أو Enter للاختيار &nbsp;•&nbsp; ↑↓ للتنقل &nbsp;•&nbsp; Esc للإغلاق</span>
              <span style={{ fontWeight: 600, color: "#555" }}>{filteredQuotes.length} عرض سعر</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
