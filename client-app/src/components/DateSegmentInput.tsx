/**
 * DateSegmentInput — إدخال التاريخ بالشرائح DD / MM / YYYY
 * - انتقال تلقائي بين الشرائح عند اكتمال كل جزء
 * - يخزّن ويقرأ بصيغة ISO: YYYY-MM-DD
 * - يدعم الأسهم، Tab، Backspace، والتقويم المنبثق
 */
import { useRef, useState, useEffect } from "react";
import type { KeyboardEvent, CSSProperties } from "react";

export interface DateSegmentInputProps {
  value: string;           // YYYY-MM-DD أو ""
  onChange: (v: string) => void;
  style?: CSSProperties;
  className?: string;
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

export function DateSegmentInput({ value, onChange, style, className }: DateSegmentInputProps) {
  const [dd,   setDd]   = useState("");
  const [mm,   setMm]   = useState("");
  const [yyyy, setYyyy] = useState("");

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

  const onDdChange = (raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, 2);
    setDd(v);
    if (v.length === 2 && +v >= 1 && +v <= 31) {
      mmRef.current?.focus();
      mmRef.current?.select();
    }
    emit(v, mm, yyyy);
  };

  const onDdKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault(); mmRef.current?.focus(); mmRef.current?.select();
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault(); mmRef.current?.focus(); mmRef.current?.select();
    }
  };

  const onMmChange = (raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, 2);
    setMm(v);
    if (v.length === 2 && +v >= 1 && +v <= 12) {
      yyyyRef.current?.focus();
      yyyyRef.current?.select();
    }
    emit(dd, v, yyyy);
  };

  const onMmKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowLeft" || (e.key === "Backspace" && mm === "")) {
      e.preventDefault(); ddRef.current?.focus(); ddRef.current?.select();
    } else if (e.key === "ArrowRight") {
      e.preventDefault(); yyyyRef.current?.focus(); yyyyRef.current?.select();
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault(); yyyyRef.current?.focus(); yyyyRef.current?.select();
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault(); ddRef.current?.focus(); ddRef.current?.select();
    }
  };

  const onYyyyChange = (raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, 4);
    setYyyy(v);
    emit(dd, mm, v);
  };

  const onYyyyKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowLeft" || (e.key === "Backspace" && yyyy === "")) {
      e.preventDefault(); mmRef.current?.focus(); mmRef.current?.select();
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault(); mmRef.current?.focus(); mmRef.current?.select();
    }
  };

  const seg: CSSProperties = {
    border: "none", outline: "none", background: "transparent",
    textAlign: "center", fontFamily: "inherit", fontSize: "inherit",
    color: "inherit", padding: "0 1px", lineHeight: 1,
  };

  return (
    <div
      dir="ltr"
      className={className}
      style={{
        display: "flex", alignItems: "center",
        border: "1px solid #d1d5db",
        borderRadius: "4px 0 0 4px",
        borderRight: "none",
        background: "white",
        paddingInline: 5,
        ...style,
      }}
    >
      <input
        ref={ddRef}
        value={dd}
        onChange={e => onDdChange(e.target.value)}
        onKeyDown={onDdKey}
        onFocus={e => e.target.select()}
        placeholder="DD"
        maxLength={2}
        inputMode="numeric"
        style={{ ...seg, width: 20 }}
      />
      <span style={{ color: "#bbb", userSelect: "none", fontSize: 11, margin: "0 1px" }}>-</span>
      <input
        ref={mmRef}
        value={mm}
        onChange={e => onMmChange(e.target.value)}
        onKeyDown={onMmKey}
        onFocus={e => e.target.select()}
        placeholder="MM"
        maxLength={2}
        inputMode="numeric"
        style={{ ...seg, width: 20 }}
      />
      <span style={{ color: "#bbb", userSelect: "none", fontSize: 11, margin: "0 1px" }}>-</span>
      <input
        ref={yyyyRef}
        value={yyyy}
        onChange={e => onYyyyChange(e.target.value)}
        onKeyDown={onYyyyKey}
        onFocus={e => e.target.select()}
        placeholder="YYYY"
        maxLength={4}
        inputMode="numeric"
        style={{ ...seg, width: 34 }}
      />
    </div>
  );
}

export default DateSegmentInput;
