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
  focusedEntityType?: string;
  focusedEntityId?: number | string | null;
  focusedFieldName?: string;
  focusedSourceScreen?: string;
  focusedEntityTitle?: string;
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
  focusedEntityType,
  focusedEntityId,
  focusedFieldName,
  focusedSourceScreen,
  focusedEntityTitle,
}: Props) {

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos,     setMenuPos]     = useState({ x: 0, y: 0 });
  const [hovered,     setHovered]     = useState<string | null>(null);
  const [focused,     setFocused]     = useState(false);
  const [editMode,    setEditMode]    = useState(false);
  const [editText,    setEditText]    = useState("");

  const menuRef  = useRef<HTMLDivElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label ?? "";
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (editMode) return;
    openMenu(e.clientX, e.clientY);
  }

  function handleContextMenu(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled) return;
    openMenu(e.clientX, e.clientY);
  }

  function pick(opt: ContextSelectOption) {
    onChange(opt.value);
    setMenuVisible(false);
    setEditMode(false);
  }

  function startEdit() {
    if (disabled) return;
    setEditText(selectedLabel);
    setEditMode(true);
    setMenuVisible(false);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }

  function commitEdit() {
    const text = editText.trim();
    if (!text) {
      onChange("");
    } else {
      const match = options.find(o => o.label.trim() === text);
      if (match) onChange(match.value);
    }
    setEditMode(false);
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
        data-enter-nav="true"
        data-focused-entity-type={focusedEntityType}
        data-focused-entity-id={focusedEntityId ?? undefined}
        data-focused-field={focusedFieldName}
        data-focused-source={focusedSourceScreen}
        data-focused-entity-title={focusedEntityTitle}
        style={{
          cursor: disabled ? "not-allowed" : "default",
          outline: focused && !menuVisible ? "2px solid #818cf8" : "none",
          outlineOffset: -1,
          borderRadius: 2,
        }}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onDoubleClick={startEdit}
        onContextMenu={handleContextMenu}
        aria-expanded={menuVisible ? "true" : "false"}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); }}
        onKeyDown={(e) => {
          if (disabled) return;
          // Space opens the menu (standard select-widget keyboard UX)
          if (e.key === " " || e.code === "Space") {
            e.preventDefault();
            if (!menuVisible) {
              const rect = wrapRef.current?.getBoundingClientRect();
              if (rect) openMenu(rect.right, rect.bottom);
            }
          }
          // Enter when menu is open: close/dismiss (option selection is via mouse/click)
          if (e.key === "Enter" && menuVisible) {
            e.preventDefault();
            setMenuVisible(false);
          }
          // Enter when menu is closed: do nothing — global hook handles navigation
          if (e.key === "Escape" && menuVisible) {
            e.preventDefault();
            setMenuVisible(false);
          }
        }}
      >
        <input
          ref={inputRef}
          type="text"
          readOnly={!editMode}
          value={editMode ? editText : selectedLabel}
          onChange={e => setEditText(e.target.value)}
          onBlur={editMode ? commitEdit : undefined}
          onKeyDown={e => {
            if (!editMode) return;
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditMode(false);
          }}
          disabled={disabled}
          placeholder={disabled ? "" : placeholder}
          title={title ?? (disabled ? "" : "اضغط للاختيار")}
          className={className}
          style={{
            cursor:     disabled ? "not-allowed" : "default",
             userSelect: editMode ? "text" : "none",
             pointerEvents: editMode ? "auto" : "none",
            ...style,
          }}
          tabIndex={-1}
        />
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
