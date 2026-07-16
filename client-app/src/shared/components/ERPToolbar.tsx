import {
  FilePlus, Save, Pencil, Trash2, Search, Printer,
  RefreshCw, Copy, SendHorizonal, CheckCircle2, XCircle,
  ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft,
  X, LucideIcon, Undo2, Eye, Share2, RefreshCcw,
  Wrench, Users, PauseCircle, ChevronDown,
} from "lucide-react";
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ERPAction =
  | "new" | "save" | "edit" | "delete"
  | "search" | "refresh" | "copy"
  | "post" | "unpost" | "repost" | "preview-journal" | "approve" | "cancel"
  | "print" | "send"
  | "first" | "prev" | "next" | "last"
  | "browse"
  | "close";

export type ERPMode = "view" | "new" | "edit" | "search";

export type PostingStatus = "unposted" | "posted" | "cancelled" | null;

export interface ERPToolbarProps {
  buttons?: ERPAction[];
  mode?: ERPMode;
  record?: number;
  total?: number;
  pageTitle?: string;
  onNew?: () => void;
  onSave?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSearch?: () => void;
  onRefresh?: () => void;
  onCopy?: () => void;
  onPost?: () => void;
  onUnpost?: () => void;
  onRepost?: () => void;
  onPreviewJournal?: () => void;
  onApprove?: () => void;
  onCancel?: () => void;
  onPrint?: () => void;
  onSend?: () => void;
  onFirst?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onLast?: () => void;
  onBrowse?: () => void;
  onClose?: () => void;
  onUserActivity?: () => void;
  onSuspendPosting?: () => void;
  enableShortcuts?: boolean;
  hideStatusBar?: boolean;
  saveDisabled?: boolean;
  newLabel?: string;
  /** حالة الترحيل — تُظهر badge في شريط الحالة */
  postingStatus?: PostingStatus;
  /** هل المستند محفوظ (له ID في قاعدة البيانات) */
  isSaved?: boolean;
  /** هل المستند مرحَّل */
  isPosted?: boolean;
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
  { id: "new",             label: "جديد",           icon: FilePlus,      shortcut: "F1", variant: "primary" },
  { id: "save",            label: "حفظ",             icon: Save,          shortcut: "F2", variant: "primary" },
  { id: "edit",            label: "تعديل",           icon: Pencil,        shortcut: "F4" },
  { id: "delete",          label: "حذف",             icon: Trash2,        shortcut: "Del", variant: "danger", dividerAfter: true },
  { id: "search",          label: "بحث",             icon: Search,        shortcut: "F3" },
  { id: "refresh",         label: "تحديث",           icon: RefreshCw },
  { id: "copy",            label: "نسخة مماثلة",     icon: Copy,          dividerAfter: true },
  { id: "post",            label: "ترحيل",           icon: SendHorizonal, variant: "gold" },
  { id: "unpost",          label: "إلغاء الترحيل",  icon: Undo2,         variant: "danger" },
  { id: "repost",          label: "إعادة الترحيل",  icon: RefreshCcw,    variant: "gold" },
  { id: "preview-journal", label: "معاينة القيد",    icon: Eye },
  { id: "approve",         label: "اعتماد",          icon: CheckCircle2,  variant: "gold" },
  { id: "cancel",          label: "إلغاء",           icon: XCircle,       variant: "danger", dividerAfter: true },
  { id: "print",           label: "طباعة",           icon: Printer },
  { id: "send",            label: "إرسال",           icon: Share2,        dividerAfter: true, variant: "default" as any },
  { id: "first",           label: "أول",             icon: ChevronsRight },
  { id: "prev",            label: "السابق",          icon: ChevronRight },
  { id: "next",            label: "التالي",          icon: ChevronLeft },
  { id: "last",            label: "آخر",             icon: ChevronsLeft },
  { id: "browse",          label: "مطالعة",          icon: Eye,           dividerAfter: true },
  { id: "close",           label: "إغلاق",           icon: X,             variant: "ghost" },
];

const MODE_LABELS: Record<ERPMode, string> = {
  view: "عرض",
  new: "إدخال",
  edit: "تعديل",
  search: "بحث",
};

const POSTING_BADGE: Record<NonNullable<PostingStatus>, { label: string; bg: string; color: string }> = {
  unposted:  { label: "غير مرحَّل",  bg: "#EFF6FF", color: "#1D4ED8" },
  posted:    { label: "✓ مرحَّل",    bg: "#F0FDF4", color: "#15803D" },
  cancelled: { label: "✕ ملغي",     bg: "#FEF2F2", color: "#DC2626" },
};

// ─── Colors ─────────────────────────────────────────────────────────────────
const C = {
  bg:      "#E8EBF0",
  border:  "#C8CDD6",
  text:    "#2B2B2B",
  muted:   "#6B7280",
  primary: "#406B93",
  gold:    "#B89B5E",
  danger:  "#C0392B",
  divider: "#C8CDD6",
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

// ─── Tools Dropdown ───────────────────────────────────────────────────────────
function ToolsDropdown({
  onUserActivity,
  onSuspendPosting,
}: {
  onUserActivity?: () => void;
  onSuspendPosting?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const menuItems: { label: string; icon: React.ReactNode; action?: () => void }[] = [
    ...(onUserActivity    ? [{ label: "نشاط المستخدمين", icon: <Users size={13} />,       action: onUserActivity }]    : []),
    ...(onSuspendPosting  ? [{ label: "تعليق الترحيل",   icon: <PauseCircle size={13} />, action: onSuspendPosting }]  : []),
  ];

  if (menuItems.length === 0) return null;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="أدوات"
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
          border: open ? `1px solid ${C.divider}` : "1px solid transparent",
          background: open ? "#ECEAE4" : "transparent",
          color: C.text,
          cursor: "pointer",
          transition: "background 0.12s, border-color 0.12s",
          fontFamily: "'Cairo', 'Tahoma', sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Wrench size={15} strokeWidth={1.8} />
          <ChevronDown size={10} strokeWidth={2} style={{ marginTop: 1 }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>
          أدوات
        </span>
      </button>

      {open && (
        <div
          dir="rtl"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 170,
            background: "#fff",
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            zIndex: 9999,
            overflow: "hidden",
            fontFamily: "'Cairo', 'Tahoma', sans-serif",
          }}
        >
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => { setOpen(false); item.action?.(); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "9px 14px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: C.text,
                textAlign: "right",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F4F3EF")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ color: C.muted }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
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
  onPost, onUnpost, onRepost, onPreviewJournal, onApprove, onCancel,
  onPrint, onSend,
  onFirst, onPrev, onNext, onLast,
  onBrowse,
  onClose,
  onUserActivity,
  onSuspendPosting,
  enableShortcuts = true,
  hideStatusBar = false,
  saveDisabled = false,
  newLabel,
  postingStatus,
  isSaved = false,
  isPosted = false,
}: ERPToolbarProps) {
  const [activeBtn, setActiveBtn] = useState<ERPAction | "">("");

  const callbacks: Partial<Record<ERPAction, (() => void) | undefined>> = {
    new: onNew, save: onSave, edit: onEdit, delete: onDelete,
    search: onSearch, refresh: onRefresh, copy: onCopy,
    post: onPost, unpost: onUnpost, repost: onRepost, "preview-journal": onPreviewJournal,
    approve: onApprove, cancel: onCancel,
    print: onPrint,
    send:  onSend,
    first: onFirst, prev: onPrev, next: onNext, last: onLast,
    browse: onBrowse,
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

  const getShowDivider = (btn: BtnDef, idx: number) => {
    if (!btn.dividerAfter) return false;
    return idx < visibleButtons.length - 1;
  };

  // حالة تعطيل أزرار الترحيل
  const isDisabled = (id: ERPAction) => {
    if (id === "save")   return saveDisabled;
    if (id === "post")   return !isSaved || isPosted;
    if (id === "unpost") return !isPosted;
    if (id === "repost") return !isSaved || !isPosted;
    if (id === "preview-journal") return !isSaved;
    return false;
  };

  const badge = postingStatus ? POSTING_BADGE[postingStatus] : null;

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
        boxShadow: "0 2px 6px rgba(0,0,0,0.07)",
        minHeight: 48,
      }}>
        {visibleButtons.map((btn, idx) => (
          <React.Fragment key={btn.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
              <TBtn
                btn={btn.id === "new" && newLabel ? { ...btn, label: newLabel } : btn}
                active={activeBtn === btn.id}
                disabled={isDisabled(btn.id)}
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
            {btn.id === "browse" && (onUserActivity || onSuspendPosting) && (
              <ToolsDropdown
                onUserActivity={onUserActivity}
                onSuspendPosting={onSuspendPosting}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Status bar ──────────────────────────────────────────────── */}
      {!hideStatusBar && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "2px 12px",
          background: "#ECEEF2",
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11,
          color: C.muted,
          flexShrink: 0,
          fontFamily: "'Cairo', 'Tahoma', sans-serif",
        }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {pageTitle && <span style={{ fontWeight: 600, color: C.text }}>{pageTitle}</span>}
            <span>الوضع: <strong style={{ color: C.primary }}>{MODE_LABELS[mode]}</strong></span>
            {record !== undefined && total !== undefined && (
              <span>السجل: <strong style={{ color: C.text }}>{record} / {total}</strong></span>
            )}
            {badge && (
              <span style={{
                padding: "1px 8px",
                borderRadius: 10,
                background: badge.bg,
                color: badge.color,
                fontWeight: 700,
                fontSize: 10.5,
                border: `1px solid ${badge.color}33`,
                letterSpacing: 0.3,
              }}>
                {badge.label}
              </span>
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
