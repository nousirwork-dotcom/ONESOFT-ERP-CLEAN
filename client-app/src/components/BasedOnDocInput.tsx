/**
 * BasedOnDocInput — حقل رقم المستند المصدر (بناءً على)
 *
 * كليك يمين → قائمة سلاسل الترقيم المُشتقّة من:
 *   1) دفاتر المستندات المُعدَّة (تظهر حتى لو لا يوجد أي مستند بعد)
 *   2) المستندات الفعلية الموجودة في قاعدة البيانات
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

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function BasedOnDocInput({
  docType, value, onChange, onPick,
  warehouseId, isFetching, trigger, isFound,
}: Props) {

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos,     setMenuPos]     = useState({ x: 0, y: 0 });
  const [selPrefix,   setSelPrefix]   = useState("");
  const [selPadLen,   setSelPadLen]   = useState(6);
  const [prevTrigger, setPrevTrigger] = useState("");  // لكشف تغيّر trigger

  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef  = useRef<HTMLDivElement>(null);

  /* ── Toast عند عدم العثور على المستند ──────────────────────────────────── */
  useEffect(() => {
    if (trigger && trigger !== prevTrigger && !isFetching && isFound === false) {
      toast.error(`لا يمكن العثور على المستند: ${trigger}`, { duration: 3000 });
    }
    if (trigger !== prevTrigger) setPrevTrigger(trigger);
  }, [trigger, isFetching, isFound]);

  /* ── Fetch journals for the configured docType ──────────────────────── */
  const journalDocType = docType ? JOURNAL_DOC_TYPE[docType] : null;
  const journalsQ = trpc.documentJournals.list.useQuery(
    { docType: journalDocType! },
    { enabled: !!journalDocType, staleTime: 300_000 }
  );

  /* ── Fetch existing documents for series extraction ─────────────────── */
  const isSales = docType === 'sale' || docType === 'quote' || docType === 'order';
  const salesQ  = trpc.salesInvoices.list.useQuery(
    { invoiceType: docType as 'sale' | 'quote' | 'order', ...(warehouseId ? { warehouseId } : {}) },
    { enabled: isSales && !!docType, staleTime: 60_000 }
  );
  const stockQ = trpc.stockVouchers.list.useQuery(
    { type: 'transfer' },
    { enabled: docType === 'transfer', staleTime: 60_000 }
  );

  /* ── Build merged series list ───────────────────────────────────────── */
  const series: Series[] = useMemo(() => {
    const merged = new Map<string, Series>();

    /* 1) Series from journal configuration (always available) */
    for (const j of (journalsQ.data ?? [])) {
      const { prefix, padLen } = seriesFromJournal(j as any);
      if (!prefix) continue;
      merged.set(prefix, { prefix, padLen, count: 0, fromJournal: true });
    }

    /* 2) Series from existing documents (higher count, overrides) */
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

  /* ── Reset prefix on type change ─────────────────────────────────────── */
  useEffect(() => { setSelPrefix(""); setSelPadLen(6); }, [docType]);

  /* ── Close menu on outside click / Escape ───────────────────────────── */
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

  /* ── Right-click → context menu ─────────────────────────────────────── */
  function handleContextMenu(e: MouseEvent<HTMLInputElement>) {
    if (!docType) return;
    e.preventDefault();

    /* Position: ensure menu stays inside viewport */
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuW = 220;
    const menuH = Math.min(series.length * 38 + 70, 360);
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

  /* ── Keyboard ────────────────────────────────────────────────────────── */
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') doPick();
  }

  /* ── Loading state for series ────────────────────────────────────────── */
  const seriesLoading = journalsQ.isLoading || salesQ.isLoading || stockQ.isLoading;

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
          {/* Header */}
          <div style={{
            padding: "7px 12px",
            background: "linear-gradient(135deg,#1a7fd4,#2563ab)",
            color: "#fff", fontSize: 11, fontWeight: 700,
            position: "sticky", top: 0,
          }}>
            سلاسل الترقيم — اختر بادئة
          </div>

          {/* Loading state */}
          {seriesLoading && (
            <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#888" }}>
              ⏳ جاري التحميل...
            </div>
          )}

          {/* Empty state */}
          {!seriesLoading && series.length === 0 && (
            <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#888" }}>
              لا توجد دفاتر مُعدَّة لهذا النوع
            </div>
          )}

          {/* Series items */}
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

          {/* Footer */}
          <div style={{
            padding: "5px 12px", fontSize: 10, color: "#aaa",
            background: "#f9fafb", borderTop: "1px solid #eee",
            position: "sticky", bottom: 0,
          }}>
            اختر السلسلة ثم اكتب الرقم + Enter
          </div>
        </div>
      )}
    </>
  );
}
