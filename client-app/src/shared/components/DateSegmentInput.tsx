/**
 * DateSegmentInput — إدخال التاريخ بالشرائح YYYY-MM-DD
 *
 * ترتيب الإدخال:  DD → MM → YYYY
 * ترتيب العرض:   YYYY - MM - DD  (CSS order على flex)
 *
 * Tab / Shift+Tab : ينتقل DD↔MM↔YYYY ثم يخرج طبيعياً عبر ترتيب DOM
 * Enter           : يخرج مباشرة إلى الحقل التالي من أي موضع
 * ← →             : ينتقل بصرياً بين الأجزاء
 * Backspace فارغ  : يرجع للجزء السابق في ترتيب الإدخال
 * Auto-advance    : بعد 2 رقم في DD→MM وبعد اكتمال YYYY
 * onFocus         : يحدد المحتوى تلقائياً
 *
 * Props:
 *   standalone   — true: حدود كاملة (بدون زر تقويم)
 *                  false (افتراضي): بدون حد يمين (للاقتران بزر التقويم)
 */
import { useRef, useState, useEffect } from "react";
import type { KeyboardEvent, CSSProperties } from "react";

export interface DateSegmentInputProps {
  value: string;           // YYYY-MM-DD أو ""
  onChange: (v: string) => void;
  style?: CSSProperties;
  className?: string;
  standalone?: boolean;    // true = حدود كاملة بدون زر تقويم جانبي
  tabIndex?: number;
  disabled?: boolean;
}

function parse(iso: string): [string, string, string] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? [m[3], m[2], m[1]] : ["", "", ""];
}

function build(dd: string, mm: string, yyyy: string): string {
  if (dd.length === 2 && mm.length === 2 && yyyy.length === 4) {
    const d = +dd, mo = +mm, y = +yyyy;
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 1000)
      return `${yyyy}-${mm}-${dd}`;
  }
  return "";
}

function focusNext(from: HTMLElement | null) {
  if (!from) return;
  const doc = from.ownerDocument ?? document;
  const all = Array.from(
    doc.querySelectorAll<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]),' +
      'select:not([disabled]):not([tabindex="-1"]),' +
      'textarea:not([disabled]):not([tabindex="-1"]),' +
      'button:not([disabled]):not([tabindex="-1"])'
    )
  ).filter(el => el.offsetParent !== null);
  const i = all.indexOf(from);
  if (i >= 0 && i + 1 < all.length) all[i + 1].focus();
}

export function DateSegmentInput({
  value, onChange, style, className, standalone = false, tabIndex, disabled,
}: DateSegmentInputProps) {
  const [dd,   setDd]   = useState("");
  const [mm,   setMm]   = useState("");
  const [yyyy, setYyyy] = useState("");

  // DOM order: ddRef → mmRef → yyyyRef  (ترتيب Tab الطبيعي)
  const ddRef   = useRef<HTMLInputElement>(null);
  const mmRef   = useRef<HTMLInputElement>(null);
  const yyyyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const [d, m, y] = parse(value);
    setDd(d); setMm(m); setYyyy(y);
  }, [value]);

  const emit = (d: string, m: string, y: string) => {
    if (!d && !m && !y) { onChange(""); return; }
    const iso = build(d, m, y);
    if (iso) onChange(iso);
  };

  // ── DD ──────────────────────────────────────────────────────────────────────
  const onDdChange = (raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, 2);
    setDd(v);
    if (v.length === 2) { mmRef.current?.focus(); mmRef.current?.select(); }
    emit(v, mm, yyyy);
  };

  const onDdKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      mmRef.current?.focus(); mmRef.current?.select();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault(); mmRef.current?.focus(); mmRef.current?.select();
    }
  };

  // ── MM ──────────────────────────────────────────────────────────────────────
  const onMmChange = (raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, 2);
    setMm(v);
    if (v.length === 2 && +v >= 1 && +v <= 12) {
      yyyyRef.current?.focus(); yyyyRef.current?.select();
    }
    emit(dd, v, yyyy);
  };

  const onMmKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); yyyyRef.current?.focus(); yyyyRef.current?.select();
    } else if (e.key === "ArrowRight") {
      e.preventDefault(); ddRef.current?.focus(); ddRef.current?.select();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault(); yyyyRef.current?.focus(); yyyyRef.current?.select();
    } else if (e.key === "Backspace" && mm === "") {
      e.preventDefault(); ddRef.current?.focus(); ddRef.current?.select();
    }
  };

  // ── YYYY ─────────────────────────────────────────────────────────────────────
  const onYyyyChange = (raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, 4);
    setYyyy(v);
    if (v.length === 4) focusNext(yyyyRef.current);
    emit(dd, mm, v);
  };

  const onYyyyKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); focusNext(yyyyRef.current);
    } else if (e.key === "ArrowRight") {
      e.preventDefault(); mmRef.current?.focus(); mmRef.current?.select();
    } else if (e.key === "Backspace" && yyyy === "") {
      e.preventDefault(); mmRef.current?.focus(); mmRef.current?.select();
    }
  };

  const seg: CSSProperties = {
    border: "none", outline: "none", background: "transparent",
    textAlign: "center", fontFamily: "inherit", fontSize: "inherit",
    color: disabled ? "#9ca3af" : "inherit",
    padding: "0 1px", lineHeight: 1,
  };

  return (
    <div
      dir="ltr"
      className={className}
      data-nav-internal="true"
      style={{
        display: "flex", alignItems: "center",
        border: "1px solid #d1d5db",
        borderRadius: standalone ? 4 : "4px 0 0 4px",
        borderRight: standalone ? "1px solid #d1d5db" : "none",
        background: disabled ? "#f9fafb" : "white",
        paddingInline: 5,
        cursor: disabled ? "not-allowed" : undefined,
        ...style,
      }}
    >
      {/*
        DOM order  : DD(1st) → MM(2nd) → YYYY(3rd)   ← ترتيب Tab الطبيعي
        CSS order  : YYYY(1) - sep(2) - MM(3) - sep(4) - DD(5)  ← العرض البصري
      */}
      <input
        ref={ddRef}
        value={dd}
        onChange={e => onDdChange(e.target.value)}
        onKeyDown={onDdKey}
        onFocus={e => e.target.select()}
        placeholder="DD"
        maxLength={2}
        inputMode="numeric"
        disabled={disabled}
        tabIndex={tabIndex}
        style={{ ...seg, width: 20, order: 5 }}
      />
      <input
        ref={mmRef}
        value={mm}
        onChange={e => onMmChange(e.target.value)}
        onKeyDown={onMmKey}
        onFocus={e => e.target.select()}
        placeholder="MM"
        maxLength={2}
        inputMode="numeric"
        disabled={disabled}
        tabIndex={tabIndex !== undefined ? -1 : undefined}
        style={{ ...seg, width: 20, order: 3 }}
      />
      <input
        ref={yyyyRef}
        value={yyyy}
        onChange={e => onYyyyChange(e.target.value)}
        onKeyDown={onYyyyKey}
        onFocus={e => e.target.select()}
        placeholder="YYYY"
        maxLength={4}
        inputMode="numeric"
        disabled={disabled}
        tabIndex={tabIndex !== undefined ? -1 : undefined}
        style={{ ...seg, width: 34, order: 1 }}
      />
      <span style={{ color: "#bbb", userSelect: "none", fontSize: 11, margin: "0 1px", order: 2 }}>-</span>
      <span style={{ color: "#bbb", userSelect: "none", fontSize: 11, margin: "0 1px", order: 4 }}>-</span>
    </div>
  );
}

export default DateSegmentInput;
