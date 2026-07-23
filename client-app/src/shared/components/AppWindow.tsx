import { useRef, useEffect, useState, useCallback } from "react";
import { Minus, Square, X } from "lucide-react";
import { useTabManager, AppTab } from "@/core/contexts/TabManagerContext";
import { useWorkspaceEl } from "@/core/contexts/WorkspaceContext";
import { TASKBAR_H } from "@/shared/components/WindowTaskbar";
import { ToolbarActionsProvider } from "@/components/unified-toolbar/ToolbarActionsContext";
import { UnifiedScreenShell } from "@/components/layout/UnifiedScreenShell";
import { WorkWindowProvider } from "@/components/work-window/WorkWindowContext";

interface AppWindowProps {
  tab: AppTab;
  children: React.ReactNode;
  /** false for module-home / navigation pages; true (default) for all work screens */
  showToolbar?: boolean;
}

export default function AppWindow({ tab, children, showToolbar = true }: AppWindowProps) {
  const {
    closeTab, minimizeWindow, toggleMaximize,
    bringToFront, activeTabId, isPosWorkspaceActive,
  } = useTabManager();

  const workspaceEl = useWorkspaceEl();
  const [wsRect, setWsRect] = useState<DOMRect | null>(null);

  /* ─── Track workspace bounding rect ─── */
  useEffect(() => {
    if (!workspaceEl) return;
    const update = () => setWsRect(workspaceEl.getBoundingClientRect());
    update();
    const ro = new ResizeObserver(update);
    ro.observe(workspaceEl);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [workspaceEl]);

  const isActive = tab.id === activeTabId;
  const isMin    = tab.windowState === "minimized";
  const isMax    = tab.windowState === "maximized";
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  /* ─── POS full-workspace mode ───
     When the POS page activates isPosWorkspaceActive, this tab fills the
     entire viewport with no title bar and no MDI frame border. */
  const isPosTab      = tab.path === '/sales/pos';
  const isPosFullMode = isPosTab && isPosWorkspaceActive;

  let style: React.CSSProperties;

  if (isPosFullMode) {
    /* POS workspace: cover the entire viewport — no MDI chrome */
    style = {
      position: "fixed",
      inset: 0,
      zIndex: tab.zIndex,
      display: isMin ? "none" : "flex",
      flexDirection: "column",
    };
  } else {
    const rectReady = wsRect !== null;
    const wsLeft   = wsRect?.left  ?? 0;
    const wsTop    = wsRect?.top   ?? 0;
    const wsWidth  = wsRect?.width ?? vw;
    const wsBottom = vh - TASKBAR_H;

    if (isMax) {
      style = {
        position: "fixed",
        left: wsLeft, top: wsTop,
        width: wsWidth,
        height: Math.max(0, wsBottom - wsTop),
        zIndex: tab.zIndex,
        display: isMin || !rectReady ? "none" : "flex",
        flexDirection: "column",
      };
    } else {
      const inset = 24;
      style = {
        position: "fixed",
        left: wsLeft + inset,
        top: wsTop + inset * 0.6,
        width: Math.max(320, wsWidth - inset * 2),
        height: Math.max(240, wsBottom - wsTop - inset * 1.2),
        zIndex: tab.zIndex,
        display: isMin || !rectReady ? "none" : "flex",
        flexDirection: "column",
      };
    }
  }

  /* ─── Double-click / double-tap title bar = maximize/restore ─── */
  const onTitleDblClick = () => toggleMaximize(tab.id);

  const lastTapRef = useRef<number>(0);
  const onTitleTouchEnd = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      toggleMaximize(tab.id);
    }
    lastTapRef.current = now;
  }, [tab.id, toggleMaximize]);

  /* ─── Render ─── */
  return (
    <div
      style={style}
      onMouseDown={() => bringToFront(tab.id)}
      onTouchStart={() => bringToFront(tab.id)}
    >
      {/* Window frame */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        border: isPosFullMode ? "none" : isActive
          ? "1px solid rgba(99,132,199,0.55)"
          : "1px solid rgba(0,0,0,0.18)",
        boxShadow: isPosFullMode ? "none" : isActive
          ? "0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.16)"
          : "0 4px 16px rgba(0,0,0,0.18)",
        background: "var(--background)",
        transition: isPosFullMode ? "none" : "box-shadow 0.15s",
      }}>

        {/* ── Title bar — hidden in POS full mode ── */}
        {!isPosFullMode && (
          <div
            onDoubleClick={onTitleDblClick}
            onTouchEnd={onTitleTouchEnd}
            style={{
              height: 36,
              display: "flex",
              alignItems: "center",
              paddingRight: 10,
              paddingLeft: 0,
              flexShrink: 0,
              userSelect: "none",
              cursor: "default",
              background: isActive
                ? "linear-gradient(135deg, #1e3a5f 0%, #2d5986 60%, #3b6fa0 100%)"
                : "linear-gradient(135deg, #3a3a3a 0%, #555 100%)",
              transition: "background 0.2s",
            }}
            dir="rtl"
          >
            {/* Icon + label */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0, paddingRight: 10 }}>
              <tab.Icon style={{ width: 14, height: 14, color: "rgba(255,255,255,0.85)", flexShrink: 0 }} />
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "'Cairo', Tahoma, sans-serif",
                letterSpacing: "0.01em",
              }}>
                {tab.label}
              </span>
            </div>

            {/* Window controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
              <WinBtn
                onClick={e => { e.stopPropagation(); minimizeWindow(tab.id); }}
                hoverBg="rgba(255,255,255,0.15)"
                title="تصغير"
              >
                <Minus style={{ width: 11, height: 11 }} />
              </WinBtn>
              <WinBtn
                onClick={e => { e.stopPropagation(); toggleMaximize(tab.id); }}
                hoverBg="rgba(255,255,255,0.15)"
                title={isMax ? "استعادة" : "تكبير"}
              >
                {isMax ? <RestoreIcon /> : <Square style={{ width: 10, height: 10 }} />}
              </WinBtn>
              <WinBtn
                onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                hoverBg="#c42b1c"
                title="إغلاق"
              >
                <X style={{ width: 11, height: 11 }} />
              </WinBtn>
            </div>
          </div>
        )}

        {/* ── Content ── */}
        <WorkWindowProvider>
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <ToolbarActionsProvider>
              <UnifiedScreenShell showToolbar={showToolbar}>{children}</UnifiedScreenShell>
            </ToolbarActionsProvider>
          </div>
        </WorkWindowProvider>
      </div>
    </div>
  );
}

/* ─── Win10-style window button ─── */
function WinBtn({
  children, onClick, hoverBg, title,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  hoverBg: string;
  title: string;
}) {
  return (
    <button
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onClick={onClick}
      title={title}
      style={{
        width: 46,
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        color: "rgba(255,255,255,0.88)",
        cursor: "pointer",
        transition: "background 0.1s",
        flexShrink: 0,
        touchAction: "manipulation",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

/* ─── Restore icon (two overlapping squares) ─── */
function RestoreIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <rect x="2" y="0" width="9" height="9" rx="0.5" stroke="currentColor" strokeWidth="1.1" fill="none" />
      <path d="M0 2v9h9V9H2V2H0z" fill="currentColor" />
    </svg>
  );
}
