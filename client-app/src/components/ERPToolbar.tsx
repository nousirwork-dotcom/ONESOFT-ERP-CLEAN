import {
  FilePlus, Save, Pencil, Trash2, Search, Printer,
  RefreshCw, Copy, SendHorizonal, CheckCircle2, XCircle,
  ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft,
  X, LucideIcon,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ERPAction =
  | "new" | "save" | "edit" | "delete"
  | "search" | "refresh" | "copy"
  | "post" | "approve" | "cancel"
  | "print"
  | "first" | "prev" | "next" | "last"
  | "close";

export type ERPMode = "view" | "new" | "edit" | "search";

export interface ERPToolbarProps {
  /** أي الأزرار تظهر — الافتراضي: كل الأزرار */
  buttons?: ERPAction[];
  /** الوضع الحالي للصفحة */
  mode?: ERPMode;
  /** رقم السجل الحالي / الإجمالي */
  record?: number;
  total?: number;
  /** عنوان الصفحة (يظهر في شريط الحالة) */
  pageTitle?: string;
  /** Callbacks لكل زر */
  onNew?: () => void;
  onSave?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSearch?: () => void;
  onRefresh?: () => void;
  onCopy?: () => void;
  onPost?: () => void;
  onApprove?: () => void;
  onCancel?: () => void;
  onPrint?: () => void;
  onFirst?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onLast?: () => void;
  onClose?: () => void;
  /** تفعيل اختصارات لوحة المفاتيح */
  enableShortcuts?: boolean;
  /** إخفاء شريط الحالة السفلي */
  hideStatusBar?: boolean;
  /** حالة تعطيل الحفظ (مثلاً أثناء الإرسال) */
  saveDisabled?: boolean;
  /** تسمية بديلة لزر "جديد" — مثال: "إضافة صنف" */
  newLabel?: string;
}

// ─── Button definition ────────────────────────────────────────────────────────
type BtnDef = {
  id: ERPAction;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  variant?: "primary" | "danger" | "gold" | "ghost" | "default";
  dividerAfter?: boolean;
};

const ALL_BUTTONS: BtnDef[] = [
  { id: "new",     label: "جديد",    icon: FilePlus,      shortcut: "F1", variant: "primary" },
  { id: "save",    label: "حفظ",     icon: Save,          shortcut: "F2", variant: "primary" },
  { id: "edit",    label: "تعديل",   icon: Pencil,        shortcut: "F4" },
  { id: "delete",  label: "حذف",     icon: Trash2,        shortcut: "Del", variant: "danger", dividerAfter: true },
  { id: "search",  label: "بحث",     icon: Search,        shortcut: "F3" },
  { id: "refresh", label: "تحديث",   icon: RefreshCw },
  { id: "copy",    label: "نسخ",     icon: Copy,          dividerAfter: true },
  { id: "post",    label: "ترحيل",   icon: SendHorizonal, variant: "gold" },
  { id: "approve", label: "اعتماد",  icon: CheckCircle2,  variant: "gold" },
  { id: "cancel",  label: "إلغاء",   icon: XCircle,       variant: "danger", dividerAfter: true },
  { id: "print",   label: "طباعة",   icon: Printer,       dividerAfter: true },
  { id: "first",   label: "أول",     icon: ChevronsRight },
  { id: "prev",    label: "السابق",  icon: ChevronRight },
  { id: "next",    label: "التالي",  icon: ChevronLeft },
  { id: "last",    label: "آخر",     icon: ChevronsLeft,  dividerAfter: true },
  { id: "close",   label: "إغلاق",   icon: X,             variant: "ghost" },
];

const MODE_LABELS: Record<ERPMode, string> = {
  view: "عرض",
  new: "إدخال",
  edit: "تعديل",
  search: "بحث",
};

// ─── Colors (CSS variables fallback to hardcoded ERP palette) ─────────────────
const C = {
  bg:        "#F8F7F4",
  border:    "#DDD8CE",
  text:      "#2B2B2B",
  muted:     "#6B7280",
  primary:   "#406B93",
  gold:      "#B89B5E",
  danger:    "#C0392B",
  divider:   "#D5D0C8",
};

// ─── Single Toolbar Button ─────────────────────────────────────────────────────
function TBtn({
  btn, active, disabled, onClick,
}: {
  btn: BtnDef;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const getBg = () => {
    if (disabled) return "transparent";
    if (btn.variant === "primary") return hovered ? "#365E80" : C.primary;
    if (btn.variant === "danger")  return hovered ? "#A93226" : C.danger;
    if (btn.variant === "gold")    return hovered ? "#A8894E" : C.gold;
    if (btn.variant === "ghost")   return hovered ? "#F0EDE8" : "transparent";
    return hovered ? "#ECEAE4" : "transparent";
  };

  const getColor = () => {
    if (disabled) return "#aaa";
    if (["primary", "danger", "gold"].includes(btn.variant ?? "")) return "#fff";
    return C.text;
  };

  const getBorder = () => {
    if (["primary", "danger", "gold"].includes(btn.variant ?? "")) return "transparent";
    return hovered && !disabled ? C.divider : "transparent";
  };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={btn.shortcut ? `${btn.label} (${btn.shortcut})` : btn.label}
      disabled={disabled}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        padding: "3px 8px",
        minWidth: 44,
        height: 40,
        borderRadius: 4,
        border: `1px solid ${getBorder()}`,
        background: getBg(),
        color: getColor(),
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.12s, border-color 0.12s",
        flexShrink: 0,
        outline: active ? `2px solid ${C.primary}` : "none",
        outlineOffset: 1,
        fontFamily: "'Cairo', 'Tahoma', sans-serif",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <btn.icon size={15} strokeWidth={1.8} />
      <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>
        {btn.label}
      </span>
      {btn.shortcut && (
        <span style={{
          fontSize: 8.5,
          lineHeight: 1,
          color: ["primary", "danger", "gold"].includes(btn.variant ?? "")
            ? "rgba(255,255,255,0.7)"
            : C.muted,
          fontFamily: "monospace",
        }}>
          {btn.shortcut}
        </span>
      )}
    </button>
  );
}

// ─── ERPToolbar ───────────────────────────────────────────────────────────────
export default function ERPToolbar({
  buttons,
  mode = "view",
  record,
  total,
  pageTitle,
  onNew, onSave, onEdit, onDelete,
  onSearch, onRefresh, onCopy,
  onPost, onApprove, onCancel,
  onPrint,
  onFirst, onPrev, onNext, onLast,
  onClose,
  enableShortcuts = true,
  hideStatusBar = false,
  saveDisabled = false,
  newLabel,
}: ERPToolbarProps) {
  const [activeBtn, setActiveBtn] = useState<ERPAction | "">("");

  const callbacks: Partial<Record<ERPAction, (() => void) | undefined>> = {
    new: onNew, save: onSave, edit: onEdit, delete: onDelete,
    search: onSearch, refresh: onRefresh, copy: onCopy,
    post: onPost, approve: onApprove, cancel: onCancel,
    print: onPrint,
    first: onFirst, prev: onPrev, next: onNext, last: onLast,
    close: onClose,
  };

  const handleClick = useCallback((id: ERPAction) => {
    setActiveBtn(id);
    setTimeout(() => setActiveBtn(""), 250);
    callbacks[id]?.();
  }, [callbacks]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableShortcuts) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = ["INPUT", "SELECT", "TEXTAREA"].includes(tag);
      if (e.key === "F1")  { e.preventDefault(); handleClick("new"); }
      if (e.key === "F2")  { e.preventDefault(); handleClick("save"); }
      if (e.key === "F3")  { e.preventDefault(); handleClick("search"); }
      if (e.key === "F4")  { e.preventDefault(); handleClick("edit"); }
      if (e.key === "Delete" && !isInput) handleClick("delete");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enableShortcuts, handleClick]);

  const visibleButtons = buttons
    ? ALL_BUTTONS.filter(b => buttons.includes(b.id))
    : ALL_BUTTONS.filter(b => callbacks[b.id] !== undefined);

  // Determine whether a divider should show after a button (only if next visible button exists)
  const getShowDivider = (btn: BtnDef, idx: number) => {
    if (!btn.dividerAfter) return false;
    return idx < visibleButtons.length - 1;
  };

  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {/* ── Toolbar row ─────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "4px 8px",
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        overflowX: "auto",
        overflowY: "hidden",
        flexShrink: 0,
        boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
        minHeight: 48,
      }}>
        {visibleButtons.map((btn, idx) => (
          <div key={btn.id} style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
            <TBtn
              btn={btn.id === "new" && newLabel ? { ...btn, label: newLabel } : btn}
              active={activeBtn === btn.id}
              disabled={btn.id === "save" && saveDisabled}
              onClick={() => handleClick(btn.id)}
            />
            {getShowDivider(btn, idx) && (
              <div style={{
                width: 1, height: 32,
                background: C.divider,
                margin: "0 4px",
                flexShrink: 0,
              }} />
            )}
          </div>
        ))}
      </div>

      {/* ── Status bar ──────────────────────────────────────────────── */}
      {!hideStatusBar && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "2px 12px",
          background: "#F2F0EC",
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11,
          color: C.muted,
          flexShrink: 0,
          fontFamily: "'Cairo', 'Tahoma', sans-serif",
        }}>
          <div style={{ display: "flex", gap: 16 }}>
            {pageTitle && <span style={{ fontWeight: 600, color: C.text }}>{pageTitle}</span>}
            <span>الوضع: <strong style={{ color: C.primary }}>{MODE_LABELS[mode]}</strong></span>
            {record !== undefined && total !== undefined && (
              <span>السجل: <strong style={{ color: C.text }}>{record} / {total}</strong></span>
            )}
          </div>
          <span style={{ fontSize: 10.5, opacity: 0.8 }}>
            F1=جديد · F2=حفظ · F3=بحث · F4=تعديل
          </span>
        </div>
      )}
    </div>
  );
}
