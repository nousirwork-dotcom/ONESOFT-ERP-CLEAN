import { useRef, useEffect } from "react";
import { Minus, Square, X, Maximize2 } from "lucide-react";
import { useTabManager, AppTab } from "@/contexts/TabManagerContext";

interface AppWindowProps {
  tab: AppTab;
  children: React.ReactNode;
}

const MIN_W = 400;
const MIN_H = 280;
const TASKBAR_H = 48;

export default function AppWindow({ tab, children }: AppWindowProps) {
  const { closeTab, minimizeWindow, toggleMaximize, bringToFront, moveWindow, resizeWindow, activeTabId } = useTabManager();

  const dragging   = useRef(false);
  const resizing   = useRef(false);
  const isActive   = tab.id === activeTabId;
  const isMin      = tab.windowState === "minimized";
  const isMax      = tab.windowState === "maximized";

  /* ─── Computed style ─── */
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let style: React.CSSProperties;
  if (isMax) {
    style = {
      position: "fixed", left: 0, top: 0,
      width: vw, height: vh - TASKBAR_H,
      zIndex: tab.zIndex,
      display: isMin ? "none" : "flex",
      flexDirection: "column",
    };
  } else {
    style = {
      position: "fixed",
      left: tab.pos.x,
      top: tab.pos.y,
      width: tab.size.w,
      height: tab.size.h,
      zIndex: tab.zIndex,
      display: isMin ? "none" : "flex",
      flexDirection: "column",
      minWidth: MIN_W,
      minHeight: MIN_H,
    };
  }

  /* ─── Drag title bar ─── */
  const onTitleMouseDown = (e: React.MouseEvent) => {
    if (isMax) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    bringToFront(tab.id);
    const ox = e.clientX - tab.pos.x;
    const oy = e.clientY - tab.pos.y;
    dragging.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "move";

    const onMove = (ev: MouseEvent) => {
      const nx = Math.max(0, Math.min(vw - tab.size.w, ev.clientX - ox));
      const ny = Math.max(0, Math.min(vh - TASKBAR_H - 40, ev.clientY - oy));
      moveWindow(tab.id, { x: nx, y: ny });
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  /* ─── Resize edges ─── */
  const onResizeMouseDown = (e: React.MouseEvent, dir: string) => {
    if (isMax) return;
    e.preventDefault();
    e.stopPropagation();
    bringToFront(tab.id);
    const sx = e.clientX, sy = e.clientY;
    const sw = tab.size.w, sh = tab.size.h;
    const spx = tab.pos.x, spy = tab.pos.y;
    resizing.current = true;
    document.body.style.userSelect = "none";
    const cursors: Record<string, string> = {
      n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
      ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize",
    };
    document.body.style.cursor = cursors[dir] ?? "default";

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let nx = spx, ny = spy, nw = sw, nh = sh;
      if (dir.includes("e")) nw = Math.max(MIN_W, sw + dx);
      if (dir.includes("w")) { nw = Math.max(MIN_W, sw - dx); nx = spx + (sw - nw); }
      if (dir.includes("s")) nh = Math.max(MIN_H, sh + dy);
      if (dir.includes("n")) { nh = Math.max(MIN_H, sh - dy); ny = spy + (sh - nh); }
      resizeWindow(tab.id, { x: nx, y: ny }, { w: nw, h: nh });
    };
    const onUp = () => {
      resizing.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  /* ─── Double-click title bar = maximize/restore ─── */
  const onTitleDblClick = () => toggleMaximize(tab.id);

  /* ─── Render ─── */
  return (
    <div
      style={style}
      onMouseDown={() => { if (!dragging.current && !resizing.current) bringToFront(tab.id); }}
    >
      {/* Resize handles */}
      {!isMax && (<>
        <div onMouseDown={e => onResizeMouseDown(e, "n")}
          style={{ position:"absolute", top:0, left:6, right:6, height:4, cursor:"ns-resize", zIndex:10 }} />
        <div onMouseDown={e => onResizeMouseDown(e, "s")}
          style={{ position:"absolute", bottom:0, left:6, right:6, height:4, cursor:"ns-resize", zIndex:10 }} />
        <div onMouseDown={e => onResizeMouseDown(e, "w")}
          style={{ position:"absolute", top:6, bottom:6, right:0, width:4, cursor:"ew-resize", zIndex:10 }} />
        <div onMouseDown={e => onResizeMouseDown(e, "e")}
          style={{ position:"absolute", top:6, bottom:6, left:0, width:4, cursor:"ew-resize", zIndex:10 }} />
        <div onMouseDown={e => onResizeMouseDown(e, "nw")}
          style={{ position:"absolute", top:0, right:0, width:8, height:8, cursor:"nwse-resize", zIndex:11 }} />
        <div onMouseDown={e => onResizeMouseDown(e, "ne")}
          style={{ position:"absolute", top:0, left:0, width:8, height:8, cursor:"nesw-resize", zIndex:11 }} />
        <div onMouseDown={e => onResizeMouseDown(e, "sw")}
          style={{ position:"absolute", bottom:0, right:0, width:8, height:8, cursor:"nesw-resize", zIndex:11 }} />
        <div onMouseDown={e => onResizeMouseDown(e, "se")}
          style={{ position:"absolute", bottom:0, left:0, width:8, height:8, cursor:"nwse-resize", zIndex:11 }} />
      </>)}

      {/* Window frame */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: isMax ? 0 : 8,
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
          onMouseDown={onTitleMouseDown}
          onDoubleClick={onTitleDblClick}
          style={{
            height: 36,
            display: "flex",
            alignItems: "center",
            paddingRight: 10,
            paddingLeft: 0,
            flexShrink: 0,
            userSelect: "none",
            cursor: isMax ? "default" : "move",
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

          {/* Window controls — LTR order: minimize, maximize, close */}
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
              {isMax
                ? <RestoreIcon />
                : <Square style={{ width: 10, height: 10 }} />
              }
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
