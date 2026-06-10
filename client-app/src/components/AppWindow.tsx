import { useRef, useEffect, useState } from "react";
import { Minus, Square, X } from "lucide-react";
import { useTabManager, AppTab } from "@/contexts/TabManagerContext";
import { useWorkspaceEl } from "@/contexts/WorkspaceContext";

interface AppWindowProps {
  tab: AppTab;
  children: React.ReactNode;
}

const TASKBAR_H = 48;

export default function AppWindow({ tab, children }: AppWindowProps) {
  const {
    closeTab, minimizeWindow, toggleMaximize,
    bringToFront, activeTabId,
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

  /* ─── Computed style ─── */
  let style: React.CSSProperties;

  if (isMax) {
    /* تكبير كامل — يغطي كل الشاشة ما عدا شريط المهام */
    style = {
      position: "fixed", left: 0, top: 0,
      width: vw, height: vh - TASKBAR_H,
      zIndex: tab.zIndex,
      display: isMin ? "none" : "flex",
      flexDirection: "column",
    };
  } else {
    /* وضع العمل — يملأ منطقة الـ workspace (تحت شريط التنقل) */
    const left   = wsRect?.left   ?? 0;
    const top    = wsRect?.top    ?? 0;
    const width  = wsRect?.width  ?? vw;
    const height = wsRect ? wsRect.height - TASKBAR_H : vh - TASKBAR_H - 80;
    style = {
      position: "fixed",
      left, top, width, height,
      zIndex: tab.zIndex,
      display: isMin ? "none" : "flex",
      flexDirection: "column",
    };
  }

  /* ─── Double-click title bar = maximize/restore ─── */
  const onTitleDblClick = () => toggleMaximize(tab.id);

  /* ─── Render ─── */
  return (
    <div
      style={style}
      onMouseDown={() => bringToFront(tab.id)}
    >
      {/* Window frame */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: isMax ? 0 : 0,
        border: isActive
          ? "1px solid rgba(99,132,199,0.55)"
          : "1px solid rgba(0,0,0,0.18)",
        boxShadow: isActive
          ? "0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.16)"
          : "0 4px 16px rgba(0,0,0,0.18)",
        background: "#fff",
        transition: "box-shadow 0.15s",
      }}>

        {/* ── Title bar ── */}
        <div
          onDoubleClick={onTitleDblClick}
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
            {/* Minimize */}
            <WinBtn
              onClick={e => { e.stopPropagation(); minimizeWindow(tab.id); }}
              hoverBg="rgba(255,255,255,0.15)"
              title="تصغير"
            >
              <Minus style={{ width: 11, height: 11 }} />
            </WinBtn>
            {/* Maximize / Restore */}
            <WinBtn
              onClick={e => { e.stopPropagation(); toggleMaximize(tab.id); }}
              hoverBg="rgba(255,255,255,0.15)"
              title={isMax ? "استعادة" : "تكبير"}
            >
              {isMax ? <RestoreIcon /> : <Square style={{ width: 10, height: 10 }} />}
            </WinBtn>
            {/* Close */}
            <WinBtn
              onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
              hoverBg="#c42b1c"
              title="إغلاق"
            >
              <X style={{ width: 11, height: 11 }} />
            </WinBtn>
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
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
