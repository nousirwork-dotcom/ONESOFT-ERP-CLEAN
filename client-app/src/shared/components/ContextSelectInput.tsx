/**
 * ContextSelectInput — قائمة اختيار بأسلوب Windows 10 Context Menu
 *
 * تفتح بالنقر العادي أو كليك يمين.
 * تصميم: خلفية بيضاء، بدون تدوير، تظليل أزرق Windows عند التحويم.
 */
import React, { useState, useRef, useEffect, type MouseEvent } from "react";

export interface ContextSelectOption {
  value:      string;
  label:      string;
  sublabel?:  string;
  color?:     string;
  separator?: boolean; /* خط فاصل قبل هذا العنصر */
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

/* ── ألوان القائمة ── */
const MENU_BG    = "#f0f0f0";   /* لون خلفية موحّد — رمادي فاتح */
const WIN_HOVER  = "#CCE8FF";
const WIN_BORDER = "1px solid #adadad";
const WIN_SHADOW = "2px 2px 8px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.08)";

export default function ContextSelectInput({
  value, onChange, options,
  placeholder = "اضغط للاختيار",
  disabled, title, menuTitle,
  className = "classic-input",
  style,
}: Props) {

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos,     setMenuPos]     = useState({ x: 0, y: 0 });
  const [hovered,     setHovered]     = useState<string | null>(null);
  const [focused,     setFocused]     = useState(false);

  const menuRef  = useRef<HTMLDivElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label ?? "";

  /* ── Close on outside click / Escape ── */
  useEffect(() => {
    if (!menuVisible) return;
    const onMouse = (e: globalThis.MouseEvent) => {
      if (menuRef.current  && !menuRef.current.contains(e.target as Node) &&
          wrapRef.current  && !wrapRef.current.contains(e.target as Node))
        setMenuVisible(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setMenuVisible(false);
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown",   onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown",   onKey);
    };
  }, [menuVisible]);

  /* ── Open menu at cursor / below input ── */
  function openMenu(clientX: number, clientY: number) {
    if (disabled) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const menuW = 230;
    const menuH = Math.min(options.length * 30 + 32, 380);
    const x = clientX + menuW > vw ? clientX - menuW : clientX;
    const y = clientY + menuH > vh ? clientY - menuH : clientY;
    setMenuPos({ x, y });
    setMenuVisible(true);
  }

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    if (menuVisible) { setMenuVisible(false); return; }
    /* كليك يسار: تحديد/تظليل الحقل فقط — لا فتح القائمة */
    (e.currentTarget as HTMLDivElement).focus();
  }

  function handleContextMenu(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled) return;
    openMenu(e.clientX, e.clientY);
  }

  function pick(opt: ContextSelectOption) {
    onChange(opt.value);
    setMenuVisible(false);
  }

  /* ── تظليل العنصر المحدد ── */
  function itemBg(optValue: string) {
    if (hovered === optValue) return WIN_HOVER;
    if (optValue === value && hovered === null) return "#E8F4FF";
    return "";
  }

  return (
    <>
      {/* ── Input wrapper ── */}
      <div
        ref={wrapRef}
        className="relative flex-1 min-w-0"
        style={{
          cursor: disabled ? "not-allowed" : "default",
          outline: focused && !menuVisible ? "2px solid #818cf8" : "none",
          outlineOffset: -1,
          borderRadius: 2,
        }}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); }}
      >
        <input
          type="text"
          readOnly
          value={selectedLabel}
          disabled={disabled}
          placeholder={disabled ? "" : placeholder}
          title={title ?? (disabled ? "" : "اضغط للاختيار")}
          className={className}
          style={{
            cursor:     disabled ? "not-allowed" : "default",
            userSelect: "none",
            pointerEvents: "none",   /* الضغط يصل للـ wrapper */
            ...style,
          }}
          tabIndex={-1}
        />
        {/* chevron */}
        {!disabled && (
          <div
            className="absolute inset-y-0 left-1.5 flex items-center pointer-events-none"
            style={{ zIndex: 1 }}
          >
            <svg
              width="9" height="9" viewBox="0 0 10 10" fill="none"
              style={{ transform: menuVisible ? "rotate(180deg)" : "", transition: "transform 0.15s" }}
            >
              <path
                d="M2 3.5L5 6.5L8 3.5"
                stroke={selectedLabel ? "#444" : "#9CA3AF"}
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>

      {/* ── Windows-style Context Menu ── */}
      {menuVisible && (
        <div
          ref={menuRef}
          style={{
            position:   "fixed",
            top:        menuPos.y,
            left:       menuPos.x,
            zIndex:     99999,
            background: MENU_BG,
            border:     WIN_BORDER,
            boxShadow:  WIN_SHADOW,
            minWidth:   200,
            maxHeight:  380,
            overflowY:  "auto",
            direction:  "rtl",
            padding:    "2px 0",
            userSelect: "none",
            /* Windows: بدون تدوير */
            borderRadius: 0,
            fontFamily: '"Tahoma","Segoe UI",Arial,sans-serif',
          }}
          onMouseLeave={() => setHovered(null)}
        >
          {/* عنوان اختياري — بأسلوب Windows section header */}
          {menuTitle && (
            <div style={{
              padding:     "5px 12px 4px",
              fontSize:    11,
              fontWeight:  700,
              color:       "#666",
              borderBottom: "1px solid #e0e0e0",
              background:  MENU_BG,
              letterSpacing: 0,
            }}>
              {menuTitle}
            </div>
          )}

          {/* لا خيارات */}
          {options.length === 0 && (
            <div style={{ padding: "8px 14px", fontSize: 12, color: "#999" }}>
              لا توجد خيارات
            </div>
          )}

          {/* خيار "مسح" عند وجود قيمة */}
          {value && (
            <>
              <div
                onMouseEnter={() => setHovered("__clear__")}
                onClick={() => pick({ value: "", label: "" })}
                style={{
                  padding:    "5px 14px",
                  fontSize:   12,
                  color:      hovered === "__clear__" ? "#000" : "#c0392b",
                  cursor:     "default",
                  background: itemBg("__clear__"),
                  display:    "flex", alignItems: "center", gap: 7,
                  minHeight:  28,
                }}
              >
                <span style={{ fontSize: 10 }}>✕</span> مسح الاختيار
              </div>
              <div style={{ height: 1, background: "#e0e0e0", margin: "1px 0" }} />
            </>
          )}

          {/* الخيارات */}
          {options.map((opt, i) => (
            <React.Fragment key={opt.value}>
              {/* فاصل اختياري */}
              {opt.separator && i > 0 && (
                <div style={{ height: 1, background: "#e0e0e0", margin: "1px 0" }} />
              )}
              <div
                onMouseEnter={() => setHovered(opt.value)}
                onClick={() => pick(opt)}
                style={{
                  padding:    "0 14px",
                  fontSize:   12,
                  color:      hovered === opt.value ? "#000" : (opt.color ?? "#1a1a1a"),
                  cursor:     "default",
                  background: itemBg(opt.value),
                  display:    "flex", alignItems: "center", justifyContent: "space-between",
                  minHeight:  28,
                  gap:        8,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
                  <span style={{ fontWeight: opt.value === value ? 700 : 400 }}>
                    {opt.label}
                  </span>
                  {opt.sublabel && (
                    <span style={{ fontSize: 10, color: "#888" }}>{opt.sublabel}</span>
                  )}
                </div>
                {/* checkmark للعنصر المحدد */}
                {opt.value === value && (
                  <span style={{ fontSize: 11, color: "#0078D7", flexShrink: 0 }}>✔</span>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </>
  );
}
