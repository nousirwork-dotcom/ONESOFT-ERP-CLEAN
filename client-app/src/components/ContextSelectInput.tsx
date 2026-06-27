/**
 * ContextSelectInput — حقل اختيار يعمل بكليك يمين
 *
 * يظهر فارغاً بشكل افتراضي.
 * كليك يمين → قائمة سياق بالخيارات المتاحة.
 * يُستخدم للمخزن، العملة، نوع "بناءً على".
 */
import React, { useState, useRef, useEffect, type MouseEvent } from "react";

export interface ContextSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  color?: string;
}

interface Props {
  value:        string;
  onChange:     (v: string) => void;
  options:      ContextSelectOption[];
  placeholder?: string;
  disabled?:    boolean;
  title?:       string;
  menuTitle?:   string;
  className?:   string;
  style?:       React.CSSProperties;
}

export default function ContextSelectInput({
  value, onChange, options,
  placeholder = "كليك ⊞ للاختيار",
  disabled, title, menuTitle,
  className = "classic-input",
  style,
}: Props) {

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos,     setMenuPos]     = useState({ x: 0, y: 0 });
  const menuRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label ?? "";

  /* ── Close on outside click / Escape ── */
  useEffect(() => {
    if (!menuVisible) return;
    const onMouse = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuVisible(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setMenuVisible(false); };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown",   onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown",   onKey);
    };
  }, [menuVisible]);

  /* ── Right-click ── */
  function handleContextMenu(e: MouseEvent<HTMLInputElement>) {
    if (disabled) return;
    e.preventDefault();
    const vw = window.innerWidth, vh = window.innerHeight;
    const menuW = 220, menuH = Math.min(options.length * 36 + 60, 340);
    const x = e.clientX + menuW > vw ? e.clientX - menuW : e.clientX;
    const y = e.clientY + menuH > vh ? e.clientY - menuH : e.clientY;
    setMenuPos({ x, y });
    setMenuVisible(true);
  }

  /* ── Select option ── */
  function pick(opt: ContextSelectOption) {
    onChange(opt.value);
    setMenuVisible(false);
    inputRef.current?.focus();
  }

  return (
    <>
      <div className="relative flex-1 min-w-0" style={{ minWidth: 0 }}>
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={selectedLabel}
          disabled={disabled}
          onContextMenu={handleContextMenu}
          placeholder={disabled ? "" : placeholder}
          title={title ?? (disabled ? "" : "كليك يمين لاختيار")}
          className={className}
          style={{
            cursor: disabled ? "not-allowed" : "default",
            userSelect: "none",
            ...style,
          }}
          onFocus={e => e.currentTarget.blur()}
        />
        {/* chevron indicator */}
        {!disabled && (
          <div
            className="absolute inset-y-0 left-1.5 flex items-center pointer-events-none"
            style={{ zIndex: 1 }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path d="M2 3.5L5 6.5L8 3.5" stroke={selectedLabel ? "#4B5563" : "#9CA3AF"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
        {/* series indicator ⊞ */}
        {!disabled && !selectedLabel && (
          <span style={{
            position: "absolute", top: "50%", transform: "translateY(-50%)",
            right: 5, fontSize: 7, color: "#1a7fd4", opacity: 0.55,
            pointerEvents: "none", userSelect: "none",
          }}>⊞</span>
        )}
      </div>

      {/* ── Context Menu ── */}
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
            boxShadow: "0 4px 28px rgba(0,0,0,0.18)",
            minWidth: 200,
            maxHeight: 340,
            overflowY: "auto",
            direction: "rtl",
          }}
        >
          {/* Header */}
          {menuTitle && (
            <div style={{
              padding: "7px 12px",
              background: "linear-gradient(135deg,#1a7fd4,#2563ab)",
              color: "#fff", fontSize: 11, fontWeight: 700,
              position: "sticky", top: 0,
            }}>
              {menuTitle}
            </div>
          )}

          {/* Empty state */}
          {options.length === 0 && (
            <div style={{ padding: 14, textAlign: "center", fontSize: 12, color: "#888" }}>
              لا توجد خيارات
            </div>
          )}

          {/* Clear option if value selected */}
          {value && (
            <div
              onClick={() => pick({ value: "", label: "" })}
              style={{
                padding: "7px 14px", cursor: "pointer",
                fontSize: 11, color: "#ef4444",
                borderBottom: "1px solid #f3f4f6",
                display: "flex", alignItems: "center", gap: 6,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#fff1f2")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}
            >
              ✕ مسح الاختيار
            </div>
          )}

          {/* Options */}
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => pick(opt)}
              style={{
                padding: "8px 14px",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                fontSize: 12,
                borderBottom: "1px solid #f3f4f6",
                gap: 8,
                background: opt.value === value ? "#eff6ff" : "",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = opt.value === value ? "#dbeafe" : "#f5f9ff")}
              onMouseLeave={e => (e.currentTarget.style.background = opt.value === value ? "#eff6ff" : "")}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontWeight: opt.value === value ? 700 : 500, color: opt.color ?? "#1a3f6f" }}>
                  {opt.label}
                </span>
                {opt.sublabel && (
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{opt.sublabel}</span>
                )}
              </div>
              {opt.value === value && (
                <span style={{ fontSize: 11, color: "#3b82f6", flexShrink: 0 }}>✓</span>
              )}
            </div>
          ))}

          {/* Footer */}
          <div style={{
            padding: "4px 12px", fontSize: 10, color: "#aaa",
            background: "#f9fafb", borderTop: "1px solid #eee",
            position: "sticky", bottom: 0,
          }}>
            اختر بالنقر · Esc للإغلاق
          </div>
        </div>
      )}
    </>
  );
}
