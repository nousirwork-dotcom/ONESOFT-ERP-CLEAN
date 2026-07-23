import { useRef, useCallback } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";

interface WorkWindowTitleBarProps {
  title:        string;
  isMaximized:  boolean;
  onClose:      () => void;
  onToggleMax:  () => void;
  onDragOffset: (offset: { x: number; y: number } | null) => void;
  currentOffset: { x: number; y: number } | null;
}

export function WorkWindowTitleBar({
  title,
  isMaximized,
  onClose,
  onToggleMax,
  onDragOffset,
  currentOffset,
}: WorkWindowTitleBarProps) {
  const dragStart  = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-winctrl]")) return;
    if (isMaximized) return; // حظر السحب في وضع التكبير
    e.preventDefault();
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      ox: currentOffset?.x ?? 0,
      oy: currentOffset?.y ?? 0,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      onDragOffset({
        x: dragStart.current.ox + (ev.clientX - dragStart.current.mx),
        y: dragStart.current.oy + (ev.clientY - dragStart.current.my),
      });
    };
    const onUp = () => {
      dragStart.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  }, [isMaximized, currentOffset, onDragOffset]);

  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onToggleMax}
      dir="rtl"
      style={{
        height:          42,
        display:         "flex",
        alignItems:      "center",
        paddingRight:    12,
        paddingLeft:     0,
        flexShrink:      0,
        userSelect:      "none",
        cursor:          isMaximized ? "default" : "move",
        background:      "linear-gradient(135deg, #1e3a5f 0%, #2d5986 60%, #3b6fa0 100%)",
        borderBottom:    "1px solid #D2C9BC",
        borderRadius:    "12px 12px 0 0",
      }}
    >
      {/* Title */}
      <span style={{
        flex:         1,
        fontSize:     13,
        fontWeight:   700,
        color:        "#fff",
        overflow:     "hidden",
        textOverflow: "ellipsis",
        whiteSpace:   "nowrap",
        fontFamily:   "'Cairo', Tahoma, sans-serif",
        letterSpacing: "0.01em",
      }}>
        {title}
      </span>

      {/* Window controls */}
      <div data-winctrl style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
        <TitleBarBtn onClick={onToggleMax} title={isMaximized ? "استعادة" : "تكبير"} hoverBg="rgba(255,255,255,0.15)">
          {isMaximized ? <Minimize2 style={{ width: 12, height: 12 }} /> : <Maximize2 style={{ width: 12, height: 12 }} />}
        </TitleBarBtn>
        <TitleBarBtn onClick={onClose} title="إغلاق" hoverBg="#c42b1c">
          <X style={{ width: 13, height: 13 }} />
        </TitleBarBtn>
      </div>
    </div>
  );
}

function TitleBarBtn({ children, onClick, title, hoverBg }: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  hoverBg: string;
}) {
  return (
    <button
      onMouseDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        width:           40,
        height:          42,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        background:      "transparent",
        border:          "none",
        color:           "rgba(255,255,255,0.9)",
        cursor:          "pointer",
        transition:      "background 0.1s",
        flexShrink:      0,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}
