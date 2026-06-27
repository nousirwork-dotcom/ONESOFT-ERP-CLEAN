/**
 * BasedOnDocInput — حقل رقم المستند المصدر (بناءً على)
 *
 * كليك يمين → قائمة سلاسل الترقيم (مستخرجة تلقائياً من DB)
 * اختر سلسلة → يظهر البادئة الثابتة في الحقل
 * اكتب الرقم الباقي + Enter → يُحمَّل المستند
 *
 * يعمل مع: عرض أسعار | أمر بيع | فاتورة مبيعات | تحويل داخلي
 */
import React, {
  useState, useMemo, useRef, useEffect,
  type KeyboardEvent, type MouseEvent,
} from "react";
import { trpc } from "@/lib/trpc";

/* ── Types ── */
type DocType = 'quote' | 'order' | 'sale' | 'transfer' | '';

interface Series { prefix: string; padLen: number; count: number; }

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

/* ── Extract unique series from number list ── */
function extractSeries(numbers: (string | null | undefined)[]): Series[] {
  const map = new Map<string, { padLen: number; count: number }>();
  for (const num of numbers) {
    if (!num) continue;
    const m = num.match(/^(.*[-.])\d+$/);
    if (!m) continue;
    const suffix = num.slice(m[1].length);
    const cur = map.get(m[1]);
    map.set(m[1], {
      padLen: Math.max(cur?.padLen ?? 0, suffix.length),
      count:  (cur?.count ?? 0) + 1,
    });
  }
  return [...map.entries()]
    .map(([prefix, { padLen, count }]) => ({ prefix, padLen, count }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function BasedOnDocInput({
  docType, value, onChange, onPick,
  warehouseId, isFetching, trigger, isFound,
}: Props) {

  /* ── Local state ─────────────────────────────────────────────────────── */
  const [menuVisible,  setMenuVisible]  = useState(false);
  const [menuPos,      setMenuPos]      = useState({ x: 0, y: 0 });
  const [selPrefix,    setSelPrefix]    = useState("");   // prefix chosen from menu
  const [selPadLen,    setSelPadLen]    = useState(6);    // digit count for padding

  const inputRef    = useRef<HTMLInputElement>(null);
  const menuRef     = useRef<HTMLDivElement>(null);

  /* ── Data fetching — salesInvoices (sale/quote/order) ────────────────── */
  const isSales = docType === 'sale' || docType === 'quote' || docType === 'order';
  const salesQ  = trpc.salesInvoices.list.useQuery(
    { invoiceType: docType as 'sale' | 'quote' | 'order', ...(warehouseId ? { warehouseId } : {}) },
    { enabled: isSales && !!docType, staleTime: 60_000 }
  );

  /* ── Data fetching — stockVouchers (transfer) ────────────────────────── */
  const stockQ = trpc.stockVouchers.list.useQuery(
    { type: 'transfer' },
    { enabled: docType === 'transfer', staleTime: 60_000 }
  );

  /* ── Compute series ──────────────────────────────────────────────────── */
  const series: Series[] = useMemo(() => {
    if (isSales) {
      return extractSeries((salesQ.data ?? []).map(r => r.invoiceNumber));
    }
    if (docType === 'transfer') {
      return extractSeries((stockQ.data ?? []).map((r: any) => r.voucherNumber));
    }
    return [];
  }, [salesQ.data, stockQ.data, docType, isSales]);

  /* ── Reset prefix when docType changes ──────────────────────────────── */
  useEffect(() => {
    setSelPrefix("");
    setSelPadLen(6);
  }, [docType]);

  /* ── Close menu on outside click or Escape ───────────────────────────── */
  useEffect(() => {
    if (!menuVisible) return;
    function handler(e: globalThis.MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuVisible(false);
      }
    }
    function keyHandler(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setMenuVisible(false);
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown',   keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown',   keyHandler);
    };
  }, [menuVisible]);

  /* ── Right-click → show series menu ─────────────────────────────────── */
  function handleContextMenu(e: MouseEvent<HTMLInputElement>) {
    if (!docType || series.length === 0) return;
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuVisible(true);
  }

  /* ── Select a series from context menu ──────────────────────────────── */
  function selectSeries(s: Series) {
    setSelPrefix(s.prefix);
    setSelPadLen(s.padLen || 6);
    setMenuVisible(false);
    // Put the prefix in the input and focus at end
    onChange(s.prefix);
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(s.prefix.length, s.prefix.length);
    }, 0);
  }

  /* ── Build full number with auto-padding then trigger load ───────────── */
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

  /* ── Keyboard handler ────────────────────────────────────────────────── */
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') doPick();
  }

  /* ── Tooltip hint ────────────────────────────────────────────────────── */
  const hint = docType && series.length > 0
    ? "كليك يمين لاختيار سلسلة الترقيم"
    : docType ? "رقم المستند ثم Enter ↵" : "";

  /* ═══════════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Input wrapper ── */}
      <div className="relative flex-1 min-w-0">
        {/* Prefix label inside input (when series selected) */}
        {selPrefix && value.startsWith(selPrefix) && (
          <span
            style={{
              position: "absolute", right: "auto", left: "auto",
              top: "50%", transform: "translateY(-50%)",
              pointerEvents: "none", zIndex: 2,
              padding: "0 4px 0 0",
              display: "flex", alignItems: "center",
              height: "100%",
            }}
          />
        )}

        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={!docType}
          onChange={e => {
            onChange(e.target.value);
            // If user deletes prefix portion, clear prefix tracking
            if (selPrefix && !e.target.value.startsWith(selPrefix)) {
              setSelPrefix("");
            }
          }}
          onBlur={() => { if (docType && value.trim()) doPick(); }}
          onKeyDown={handleKeyDown}
          onContextMenu={handleContextMenu}
          placeholder={hint}
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

        {/* Right-click hint dot — shows when series available */}
        {docType && series.length > 0 && (
          <span
            className="absolute top-1/2 -translate-y-1/2"
            style={{ right: 4, fontSize: 8, color: "#1a7fd4", opacity: 0.7, pointerEvents: "none" }}
            title="كليك يمين للسلاسل"
          >●</span>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          Context Menu — سلاسل الترقيم
          ════════════════════════════════════════════════════════════════════ */}
      {menuVisible && series.length > 0 && (
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
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
            minWidth: 200,
            direction: "rtl",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "6px 12px",
            background: "linear-gradient(135deg,#1a7fd4,#2563ab)",
            color: "#fff", fontSize: 11, fontWeight: 700,
          }}>
            سلاسل الترقيم — اختر بادئة
          </div>

          {/* Series list */}
          {series.map(s => (
            <div
              key={s.prefix}
              onClick={() => selectSeries(s)}
              style={{
                padding: "7px 14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 12,
                borderBottom: "1px solid #f0f0f0",
                gap: 12,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#eff6ff")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}
            >
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#1a7fd4", direction: "ltr" }}>
                {s.prefix}
              </span>
              <span style={{ fontSize: 10, color: "#888", flexShrink: 0 }}>
                {s.count} مستند
              </span>
            </div>
          ))}

          {/* Footer hint */}
          <div style={{ padding: "4px 12px", fontSize: 10, color: "#aaa", background: "#f9fafb" }}>
            بعد الاختيار: اكتب الرقم + Enter
          </div>
        </div>
      )}
    </>
  );
}
