import {
  Save, FilePlus, Copy, Pencil, Trash2,
  ChevronsRight, ChevronRight, ChevronLeft, ChevronsLeft,
  CheckCircle2, XCircle, Eye, Share2, Printer, LogOut,
  Wrench, ChevronDown,
  RotateCcw, SendHorizonal, PauseCircle, Link2, Users, Paperclip,
  FileText,
} from "lucide-react";
import React, { useState, useEffect, useCallback, useRef } from "react";
// Note: useRef retained for ToolsDropdown click-outside handler
import { useLang } from "@/core/contexts/LanguageContext";
import { t, TranslationKey } from "@/shared/lib/translations";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ERPAction =
  | "save" | "draft" | "new" | "copy" | "edit" | "delete"
  | "first" | "prev" | "next" | "last"
  | "approve" | "cancel"
  | "preview" | "send" | "print" | "exit"
  | "post" | "unpost" | "reverse" | "suspend-posting" | "related-docs" | "user-activity" | "attach"
  | "search" | "refresh" | "browse" | "repost" | "preview-journal" | "close";

export type ERPMode = "view" | "new" | "edit" | "search";
export type PostingStatus = "unposted" | "posted" | "cancelled" | null;

/** Per-item override for a tools-dropdown entry */
export interface ToolItemConfig {
  disabled?: boolean;
  disabledReason?: string;
}

export interface ERPToolbarProps {
  /** Optional allowlist — only these button IDs will render (in spec order) */
  buttons?: ERPAction[];
  mode?: ERPMode;
  record?: number;
  total?: number;
  pageTitle?: string;
  // ── Main toolbar callbacks ────────────────────────────────────────────────
  onSave?: () => void;
  onDraft?: () => void;
  onNew?: () => void;
  onCopy?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onFirst?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onLast?: () => void;
  onApprove?: () => void;
  onCancel?: () => void;
  onPreview?: () => void;
  onSend?: () => void;
  onPrint?: () => void;
  onExit?: () => void;
  // ── Tools dropdown callbacks ──────────────────────────────────────────────
  onReverse?: () => void;
  onPost?: () => void;
  onUnpost?: () => void;
  onSuspendPosting?: () => void;
  onRelatedDocs?: () => void;
  onUserActivity?: () => void;
  onAttach?: () => void;
  /** Per-item explicit disabled + reason for the 7 tools-dropdown entries */
  toolsConfig?: {
    reverse?:         ToolItemConfig;
    post?:            ToolItemConfig;
    unpost?:          ToolItemConfig;
    suspendPosting?:  ToolItemConfig;
    relatedDocs?:     ToolItemConfig;
    userActivity?:    ToolItemConfig;
    attach?:          ToolItemConfig;
  };
  // ── Legacy backward-compat aliases ───────────────────────────────────────
  onClose?: () => void;          // alias → onExit
  onBrowse?: () => void;         // alias → onPreview (when onPreview absent)
  onSearch?: () => void;
  onRefresh?: () => void;
  onRepost?: () => void;
  onPreviewJournal?: () => void; // alias → onPreview (when onPreview absent)
  // ── Flags ─────────────────────────────────────────────────────────────────
  enableShortcuts?: boolean;
  hideStatusBar?: boolean;
  saveDisabled?: boolean;
  newLabel?: string;
  postingStatus?: PostingStatus;
  isSaved?: boolean;
  isPosted?: boolean;
}

// ─── Color palette ─────────────────────────────────────────────────────────────

const C = {
  toolbarBg:  "#E8EBF0",
  statusBg:   "#ECEEF2",
  border:     "#C8CDD6",
  divider:    "#B8BDC8",
  text:       "#2B2B2B",
  muted:      "#6B7280",
  primary:    "#2563EB",   // حفظ — blue
  success:    "#16A34A",   // اعتماد — green
  danger:     "#DC2626",   // حذف / إلغاء — red
  default:    "#E8EBF0",   // default button bg
  defaultHov: "#D8DBE4",
  primaryHov: "#1D4ED8",
  successHov: "#15803D",
  dangerHov:  "#B91C1C",
};

// ─── 3D shadow helper ──────────────────────────────────────────────────────────

function btn3DShadow(pressed: boolean): string {
  if (pressed) {
    return "inset 0 2px 4px rgba(0,0,0,0.22), 0 0 0 transparent";
  }
  return "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.09)";
}

// ─── Button spec ───────────────────────────────────────────────────────────────

type BtnVariant = "primary" | "success" | "danger" | "default";

type BtnSpec = {
  id: ERPAction;
  labelKey: TranslationKey;
  icon: React.ElementType;
  shortcut?: string;
  variant: BtnVariant;
  dividerAfter?: boolean;
};

const MAIN_SPECS: BtnSpec[] = [
  { id: "save",    labelKey: "tbSave",    icon: Save,          shortcut: "F2",       variant: "primary"  },
  { id: "draft",   labelKey: "tbDraft",   icon: FileText,      shortcut: "Ctrl+D",   variant: "default"  },
  { id: "new",     labelKey: "tbNew",     icon: FilePlus,      shortcut: "F3",       variant: "default"  },
  { id: "copy",    labelKey: "tbCopy",    icon: Copy,          shortcut: "Ctrl⇧C",   variant: "default"  },
  // ← tools dropdown slot is inserted here in render
  { id: "edit",    labelKey: "tbEdit",    icon: Pencil,        shortcut: "F4",       variant: "default"  },
  { id: "delete",  labelKey: "tbDelete",  icon: Trash2,        shortcut: "Ctrl+Del", variant: "danger",  dividerAfter: true },
  { id: "first",   labelKey: "tbFirst",   icon: ChevronsRight,  shortcut: "Ctrl↖",   variant: "default"  },
  { id: "prev",    labelKey: "tbPrev",    icon: ChevronRight,   shortcut: "PgUp",    variant: "default"  },
  { id: "next",    labelKey: "tbNext",    icon: ChevronLeft,    shortcut: "PgDn",    variant: "default"  },
  { id: "last",    labelKey: "tbLast",    icon: ChevronsLeft,   shortcut: "Ctrl↘",   variant: "default",  dividerAfter: true },
  { id: "approve", labelKey: "tbApprove", icon: CheckCircle2,  shortcut: "Ctrl↵",    variant: "success"  },
  { id: "cancel",  labelKey: "tbCancel",  icon: XCircle,       shortcut: "Ctrl⇧↵",   variant: "danger",  dividerAfter: true },
  { id: "preview", labelKey: "tbPreview", icon: Eye,                                 variant: "default"  },
  { id: "send",    labelKey: "tbSend",    icon: Share2,                               variant: "default"  },
  { id: "print",   labelKey: "tbPrint",   icon: Printer,       shortcut: "Ctrl+P",   variant: "default"  },
  { id: "exit",    labelKey: "tbExit",    icon: LogOut,        shortcut: "Esc",      variant: "default"  },
];

// ─── Single Button ──────────────────────────────────────────────────────────────

function TBtn({
  spec, label, disabled, onClick,
}: {
  spec: BtnSpec;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered]  = useState(false);
  const [pressed, setPressed]  = useState(false);

  const getBg = () => {
    if (disabled) return C.default;
    const h = hovered || pressed;
    if (spec.variant === "primary") return h ? C.primaryHov : C.primary;
    if (spec.variant === "success") return h ? C.successHov : C.success;
    if (spec.variant === "danger")  return h ? C.dangerHov  : C.danger;
    return h ? C.defaultHov : C.default;
  };

  const getColor = () => {
    if (disabled) return "#a0a5af";
    if (spec.variant !== "default") return "#fff";
    return C.text;
  };

  return (
    <button
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      title={spec.shortcut ? `${label} (${spec.shortcut})` : label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        padding: "3px 9px",
        minWidth: 46,
        height: 42,
        borderRadius: 5,
        border: `1px solid ${spec.variant === "default" ? (hovered && !disabled ? C.border : "transparent") : "transparent"}`,
        background: getBg(),
        color: getColor(),
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.1s, border-color 0.1s",
        flexShrink: 0,
        fontFamily: "'Cairo', 'Tahoma', sans-serif",
        opacity: disabled ? 0.45 : 1,
        boxShadow: disabled ? "none" : btn3DShadow(pressed),
        transform: pressed && !disabled ? "translateY(1px)" : "none",
        outline: "none",
      }}
    >
      <spec.icon size={15} strokeWidth={1.8} />
      <span style={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>
        {label}
      </span>
      {spec.shortcut && (
        <span style={{
          fontSize: 8,
          lineHeight: 1,
          color: spec.variant !== "default" ? "rgba(255,255,255,0.7)" : C.muted,
          fontFamily: "monospace",
          letterSpacing: 0,
        }}>
          {spec.shortcut}
        </span>
      )}
    </button>
  );
}

// ─── Divider ────────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div style={{
      width: 1, height: 32,
      background: C.divider,
      margin: "0 4px",
      flexShrink: 0,
      borderRadius: 1,
    }} />
  );
}

// ─── Tools Dropdown ─────────────────────────────────────────────────────────────

type ToolEntry = {
  labelKey: TranslationKey;
  icon: React.ElementType;
  action?: () => void;
  /** Explicit disabled flag (overrides action-based inference) */
  disabled?: boolean;
  /** Translated reason shown as tooltip when disabled */
  disabledReason?: string;
};

function ToolsDropdown({
  lang, isAr,
  onReverse, onPost, onUnpost, onSuspendPosting,
  onRelatedDocs, onUserActivity, onAttach,
  toolsConfig,
}: {
  lang: "ar" | "en"; isAr: boolean;
  onReverse?: () => void; onPost?: () => void; onUnpost?: () => void;
  onSuspendPosting?: () => void; onRelatedDocs?: () => void;
  onUserActivity?: () => void; onAttach?: () => void;
  toolsConfig?: ERPToolbarProps["toolsConfig"];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // All 7 items always shown; disabled when no handler OR explicit disabled flag
  const ALL_TOOLS: ToolEntry[] = [
    { labelKey: "tbReverse",        icon: RotateCcw,      action: onReverse,        ...toolsConfig?.reverse },
    { labelKey: "tbPost",           icon: SendHorizonal,   action: onPost,           ...toolsConfig?.post },
    { labelKey: "tbUnpost",         icon: ChevronDown,     action: onUnpost,         ...toolsConfig?.unpost },
    { labelKey: "tbSuspendPosting", icon: PauseCircle,     action: onSuspendPosting, ...toolsConfig?.suspendPosting },
    { labelKey: "tbRelatedDocs",    icon: Link2,           action: onRelatedDocs,    ...toolsConfig?.relatedDocs },
    { labelKey: "tbUserActivity",   icon: Users,           action: onUserActivity,   ...toolsConfig?.userActivity },
    { labelKey: "tbAttach",         icon: Paperclip,       action: onAttach,         ...toolsConfig?.attach },
  ];

  // Show the dropdown button only if at least one tool is provided
  const hasAny = ALL_TOOLS.some(ti => ti.action !== undefined);
  if (!hasAny) return null;

  const toolLabel = t(lang, "tbTools");

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        title={toolLabel}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          padding: "3px 9px",
          minWidth: 46,
          height: 42,
          borderRadius: 5,
          border: `1px solid ${(hovered || open) ? C.border : "transparent"}`,
          background: open ? C.defaultHov : (hovered ? C.defaultHov : C.default),
          color: C.text,
          cursor: "pointer",
          transition: "background 0.1s, border-color 0.1s",
          fontFamily: "'Cairo', 'Tahoma', sans-serif",
          boxShadow: btn3DShadow(pressed),
          transform: pressed ? "translateY(1px)" : "none",
          outline: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Wrench size={14} strokeWidth={1.8} />
          <ChevronDown size={9} strokeWidth={2.5} style={{ marginTop: 1, opacity: 0.7 }} />
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>
          {toolLabel}
        </span>
      </button>

      {open && (
        <div
          dir={isAr ? "rtl" : "ltr"}
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            right: 0,
            minWidth: 190,
            background: "#fff",
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            boxShadow: "0 -4px 20px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.06)",
            zIndex: 9999,
            overflow: "hidden",
            fontFamily: "'Cairo', 'Tahoma', sans-serif",
          }}
        >
          {/* arrow tip pointing down */}
          <div style={{
            position: "absolute",
            bottom: -5,
            right: 18,
            width: 10,
            height: 10,
            background: "#fff",
            border: `1px solid ${C.border}`,
            borderTop: "none",
            borderLeft: "none",
            transform: "rotate(45deg)",
            zIndex: 1,
          }} />
          <div style={{ position: "relative", zIndex: 2 }}>
            {ALL_TOOLS.map((item, i) => (
              <ToolMenuItem key={item.labelKey} item={item} lang={lang} isLast={i === ALL_TOOLS.length - 1}
                onClose={() => setOpen(false)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolMenuItem({
  item, lang, isLast, onClose,
}: {
  item: ToolEntry; lang: "ar" | "en"; isLast: boolean; onClose: () => void;
}) {
  const [hov, setHov] = useState(false);
  const Icon = item.icon;
  const isDisabled = item.disabled === true || !item.action;
  const disabledTitle = item.disabledReason ?? t(lang, "tbToolsNotAvailable");
  return (
    <button
      disabled={isDisabled}
      onClick={isDisabled ? undefined : () => { onClose(); item.action!(); }}
      onMouseEnter={() => !isDisabled && setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={isDisabled ? disabledTitle : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "9px 14px",
        background: hov ? "#F0F4F9" : "transparent",
        border: "none",
        borderBottom: isLast ? "none" : "1px solid #f0f0f0",
        cursor: isDisabled ? "not-allowed" : "pointer",
        fontSize: 12.5,
        color: isDisabled ? "#adb5bd" : "#2B2B2B",
        textAlign: lang === "ar" ? "right" : "left",
        transition: "background 0.1s",
        fontFamily: "'Cairo', 'Tahoma', sans-serif",
        opacity: isDisabled ? 0.55 : 1,
      }}
    >
      <Icon size={13} strokeWidth={1.8} color={isDisabled ? "#adb5bd" : "#6B7280"} />
      <span>{t(lang, item.labelKey)}</span>
    </button>
  );
}

// ─── Posting badge config ────────────────────────────────────────────────────────

const POSTING_BADGE_KEYS: Record<NonNullable<PostingStatus>, { key: TranslationKey; bg: string; color: string }> = {
  unposted:  { key: "tbUnpostedBadge",  bg: "#EFF6FF", color: "#1D4ED8" },
  posted:    { key: "tbPostedBadge",    bg: "#F0FDF4", color: "#15803D" },
  cancelled: { key: "tbCancelledBadge", bg: "#FEF2F2", color: "#DC2626" },
};

// ─── ERPToolbar — main export ─────────────────────────────────────────────────

export default function ERPToolbar({
  buttons,
  mode = "view",
  record,
  total,
  pageTitle,
  onSave, onDraft, onNew, onCopy, onEdit, onDelete,
  onFirst, onPrev, onNext, onLast,
  onApprove, onCancel,
  onPreview, onSend, onPrint, onExit,
  onReverse, onPost, onUnpost, onSuspendPosting,
  onRelatedDocs, onUserActivity, onAttach,
  toolsConfig,
  onClose, onBrowse, onSearch, onRefresh, onRepost, onPreviewJournal,
  enableShortcuts = true,
  hideStatusBar = false,
  saveDisabled = false,
  newLabel,
  postingStatus,
  isSaved = false,
  isPosted = false,
}: ERPToolbarProps) {
  const { lang, isAr } = useLang();
  const [activeId, setActiveId] = useState<ERPAction | "">("");

  // ── resolve aliases ────────────────────────────────────────────────────────
  const resolvedExit    = onExit    ?? onClose;
  const resolvedPreview = onPreview ?? onBrowse ?? onPreviewJournal;

  // ── callbacks map ──────────────────────────────────────────────────────────
  const CB: Partial<Record<ERPAction, (() => void) | undefined>> = {
    save:    saveDisabled ? undefined : onSave,
    draft:   onDraft,
    new:     onNew,
    copy:    onCopy,
    edit:    onEdit,
    delete:  onDelete,
    first:   onFirst,
    prev:    onPrev,
    next:    onNext,
    last:    onLast,
    approve: onApprove,
    cancel:  onCancel,
    preview: resolvedPreview,
    send:    onSend,
    print:   onPrint,
    exit:    resolvedExit,
    // legacy (kept for buttons prop compat but not auto-shown)
    search:  onSearch,
    refresh: onRefresh,
    repost:  onRepost,
    close:   onClose,
    browse:  onBrowse,
    "preview-journal": onPreviewJournal,
  };

  const flash = useCallback((id: ERPAction) => {
    setActiveId(id);
    setTimeout(() => setActiveId(""), 200);
  }, []);

  const fire = useCallback((id: ERPAction) => {
    flash(id);
    CB[id]?.();
  }, [CB, flash]);

  // ── keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!enableShortcuts) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = ["INPUT", "TEXTAREA", "SELECT"].includes(tag);
      const ctrl  = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      if (e.key === "F2" && !inInput) { e.preventDefault(); fire("save"); return; }
      if (e.key === "F3" && !inInput) { e.preventDefault(); fire("new"); return; }
      if (e.key === "F4" && !inInput) { e.preventDefault(); fire("edit"); return; }

      if (ctrl && e.key === "d" && !shift && !inInput) { e.preventDefault(); fire("draft"); return; }
      if (ctrl && e.key === "c" && shift  && !inInput) { e.preventDefault(); fire("copy"); return; }
      if (ctrl && e.key === "p" && !inInput)           { e.preventDefault(); fire("print"); return; }
      if (ctrl && e.key === "Enter" && !shift && !inInput) { e.preventDefault(); fire("approve"); return; }
      if (ctrl && e.key === "Enter" && shift  && !inInput) { e.preventDefault(); fire("cancel"); return; }

      if (ctrl && e.key === "Delete" && !inInput) { e.preventDefault(); fire("delete"); return; }
      if (ctrl && e.key === "Home"   && !inInput) { e.preventDefault(); fire("first"); return; }
      if (ctrl && e.key === "End"    && !inInput) { e.preventDefault(); fire("last"); return; }
      if (!ctrl && !shift && e.key === "PageUp"   && !inInput) fire("prev");
      if (!ctrl && !shift && e.key === "PageDown" && !inInput) fire("next");

      if (e.key === "Escape" && !inInput) { e.preventDefault(); fire("exit"); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enableShortcuts, fire]);

  // ── determine visible buttons ──────────────────────────────────────────────
  const visibleSpecs: BtnSpec[] = MAIN_SPECS.filter(spec => {
    if (buttons) return buttons.includes(spec.id);
    return CB[spec.id] !== undefined;
  });

  // ── tools dropdown — show if any tool handler exists ──────────────────────
  const hasTools = !!(onReverse || onPost || onUnpost || onSuspendPosting ||
    onRelatedDocs || onUserActivity || onAttach);

  // ── button groups with dividers ────────────────────────────────────────────
  // dividerAfter is defined on delete, last, cancel, exit in MAIN_SPECS
  // We render dividers between visible buttons that have dividerAfter=true
  // PLUS tools dropdown is inserted after "copy" (before edit in spec order)

  // ── status bar ────────────────────────────────────────────────────────────
  const modeLabel = ((): string => {
    const map: Record<ERPMode, TranslationKey> = {
      view: "tbModeView", new: "tbModeNew", edit: "tbModeEdit", search: "tbModeSearch",
    };
    return t(lang, map[mode]);
  })();

  const badge = postingStatus ? POSTING_BADGE_KEYS[postingStatus] : null;

  // ── render ─────────────────────────────────────────────────────────────────
  // Pre-compute where tools dropdown is inserted (after "copy" if visible)
  const copyIdx = visibleSpecs.findIndex(s => s.id === "copy");
  const toolsAfterIdx = hasTools ? (copyIdx >= 0 ? copyIdx : visibleSpecs.length - 1) : -1;

  return (
    <div dir={isAr ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {/* ── Toolbar row ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "3px 8px",
        background: C.toolbarBg,
        borderBottom: `1px solid ${C.border}`,
        overflowX: "auto",
        overflowY: "visible",
        flexShrink: 0,
        boxShadow: "0 2px 6px rgba(0,0,0,0.07)",
        minHeight: 50,
        position: "relative",
      }}>
        {visibleSpecs.map((spec, idx) => {
          const needsDivider = spec.dividerAfter && idx < visibleSpecs.length - 1;
          const showToolsAfter = toolsAfterIdx === idx;

          const effectiveLabel = (spec.id === "new" && newLabel)
            ? newLabel
            : t(lang, spec.labelKey);

          const isActive = activeId === spec.id;

          return (
            <React.Fragment key={spec.id}>
              <div style={{ display: "flex", alignItems: "center", flexShrink: 0, position: "relative" }}>
                <TBtn
                  spec={spec}
                  label={effectiveLabel}
                  disabled={spec.id === "save" ? saveDisabled : false}
                  onClick={() => fire(spec.id)}
                />
                {isActive && (
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 5,
                    background: "rgba(255,255,255,0.25)",
                    pointerEvents: "none",
                  }} />
                )}
              </div>
              {showToolsAfter && (
                <ToolsDropdown
                  lang={lang} isAr={isAr}
                  onReverse={onReverse} onPost={onPost} onUnpost={onUnpost}
                  onSuspendPosting={onSuspendPosting} onRelatedDocs={onRelatedDocs}
                  onUserActivity={onUserActivity} onAttach={onAttach}
                  toolsConfig={toolsConfig}
                />
              )}
              {needsDivider && <Divider />}
            </React.Fragment>
          );
        })}

        {/* tools slot at end if no copy button in visible set */}
        {toolsAfterIdx === visibleSpecs.length - 1 && copyIdx === -1 && hasTools && (
          <ToolsDropdown
            lang={lang} isAr={isAr}
            onReverse={onReverse} onPost={onPost} onUnpost={onUnpost}
            onSuspendPosting={onSuspendPosting} onRelatedDocs={onRelatedDocs}
            onUserActivity={onUserActivity} onAttach={onAttach}
            toolsConfig={toolsConfig}
          />
        )}
      </div>

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      {!hideStatusBar && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "2px 14px",
          background: C.statusBg,
          borderBottom: `1px solid ${C.border}`,
          fontSize: 10.5,
          color: C.muted,
          flexShrink: 0,
          fontFamily: "'Cairo', 'Tahoma', sans-serif",
          minHeight: 22,
        }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {pageTitle && (
              <span style={{ fontWeight: 700, color: C.text, fontSize: 11 }}>{pageTitle}</span>
            )}
            <span>
              {t(lang, "tbMode")}:{" "}
              <strong style={{ color: C.primary }}>{modeLabel}</strong>
            </span>
            {record !== undefined && total !== undefined && (
              <span>
                {t(lang, "tbRecord")}:{" "}
                <strong style={{ color: C.text }}>{record} / {total}</strong>
              </span>
            )}
            {badge && (
              <span style={{
                padding: "1px 9px",
                borderRadius: 10,
                background: badge.bg,
                color: badge.color,
                fontWeight: 700,
                fontSize: 10,
                border: `1px solid ${badge.color}33`,
                letterSpacing: 0.2,
              }}>
                {t(lang, badge.key)}
              </span>
            )}
          </div>
          <span style={{ fontSize: 9.5, opacity: 0.7, fontFamily: "monospace" }}>
            {t(lang, "tbShortcuts")}
          </span>
        </div>
      )}
    </div>
  );
}
