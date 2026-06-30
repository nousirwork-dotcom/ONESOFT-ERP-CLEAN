import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface FloatingWindowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
}

export function FloatingWindow({
  open,
  onOpenChange,
  title,
  children,
  footer,
  defaultWidth = 620,
  defaultHeight = 480,
  minWidth = 380,
  minHeight = 260,
}: FloatingWindowProps) {
  const getInitialPos = () => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    return {
      x: Math.max(20, vw / 2 - defaultWidth / 2),
      y: Math.max(80, Math.round((vh - defaultHeight) * 0.35)),
    };
  };

  const [pos, setPos] = useState(getInitialPos);
  const [size, setSize] = useState({ w: defaultWidth, h: defaultHeight });
  const [maximized, setMaximized] = useState(false);
  const [prevState, setPrevState] = useState({ pos: getInitialPos(), size: { w: defaultWidth, h: defaultHeight } });

  // درء تراكم الـ listeners
  const dragging = useRef(false);

  // إعادة ضبط الموضع عند فتح النافذة
  useEffect(() => {
    if (open) {
      setPos(getInitialPos());
      setSize({ w: defaultWidth, h: defaultHeight });
      setMaximized(false);
    }
  }, [open]);

  // ─── سحب النافذة (Drag to move) ───────────────────────────────────────────
  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if (maximized) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;

    const onMove = (ev: MouseEvent) => {
      const nx = Math.max(0, Math.min(window.innerWidth - size.w, ev.clientX - startX));
      const ny = Math.max(0, Math.min(window.innerHeight - 48, ev.clientY - startY));
      setPos({ x: nx, y: ny });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      dragging.current = false;
    };
    dragging.current = true;
    document.body.style.cursor = "move";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ─── تغيير الحجم (Resize from edges) ─────────────────────────────────────
  const onResizeMouseDown = (e: React.MouseEvent, dir: string) => {
    if (maximized) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.w;
    const startH = size.h;
    const startPX = pos.x;
    const startPY = pos.y;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let nx = startPX, ny = startPY, nw = startW, nh = startH;

      if (dir.includes("e")) nw = Math.max(minWidth, startW + dx);
      if (dir.includes("w")) {
        nw = Math.max(minWidth, startW - dx);
        nx = startPX + (startW - nw);
      }
      if (dir.includes("s")) nh = Math.max(minHeight, startH + dy);
      if (dir.includes("n")) {
        nh = Math.max(minHeight, startH - dy);
        ny = startPY + (startH - nh);
      }
      setSize({ w: nw, h: nh });
      setPos({ x: nx, y: ny });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    const cursors: Record<string, string> = {
      n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
      ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize",
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = cursors[dir] ?? "default";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ─── تبديل التكبير ────────────────────────────────────────────────────────
  const toggleMaximize = () => {
    if (!maximized) {
      setPrevState({ pos, size });
      setMaximized(true);
    } else {
      setPos(prevState.pos);
      setSize(prevState.size);
      setMaximized(false);
    }
  };

  const windowStyle: React.CSSProperties = maximized
    ? { position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh", zIndex: 50 }
    : { position: "fixed", left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex: 50, minWidth: minWidth, minHeight: minHeight };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay شفاف */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <DialogPrimitive.Content
          style={windowStyle}
          className={cn(
            "bg-background border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
          dir="rtl"
          onOpenAutoFocus={e => e.preventDefault()}
        >
          {/* ── مقابض السحب من الحواف ── */}
          {!maximized && (<>
            <div onMouseDown={e => onResizeMouseDown(e, "n")}  className="absolute top-0 left-3 right-3 h-1 cursor-ns-resize z-10" />
            <div onMouseDown={e => onResizeMouseDown(e, "s")}  className="absolute bottom-0 left-3 right-3 h-1 cursor-ns-resize z-10" />
            <div onMouseDown={e => onResizeMouseDown(e, "w")}  className="absolute top-3 bottom-3 left-0 w-1 cursor-ew-resize z-10" />
            <div onMouseDown={e => onResizeMouseDown(e, "e")}  className="absolute top-3 bottom-3 right-0 w-1 cursor-ew-resize z-10" />
            <div onMouseDown={e => onResizeMouseDown(e, "nw")} className="absolute top-0 left-0  w-3 h-3 cursor-nwse-resize z-10" />
            <div onMouseDown={e => onResizeMouseDown(e, "ne")} className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize z-10" />
            <div onMouseDown={e => onResizeMouseDown(e, "sw")} className="absolute bottom-0 left-0  w-3 h-3 cursor-nesw-resize z-10" />
            <div onMouseDown={e => onResizeMouseDown(e, "se")} className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize z-10" />
          </>)}

          {/* ── شريط العنوان (قابل للسحب) ── */}
          <div
            onMouseDown={onHeaderMouseDown}
            className={cn(
              "flex items-center px-4 py-2.5 bg-muted/40 border-b border-border shrink-0 select-none",
              !maximized && "cursor-move"
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold flex-1 min-w-0 truncate">{title}</span>
            <div className="flex items-center gap-1 mr-3 shrink-0">
              <button
                onClick={toggleMaximize}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title={maximized ? "تصغير" : "تكبير"}
              >
                {maximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <DialogPrimitive.Close className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground">
                <XIcon className="w-3.5 h-3.5" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* ── المحتوى ── */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>

          {/* ── الذيل ── */}
          {footer && (
            <div className="shrink-0 border-t border-border px-4 py-2.5 flex items-center justify-end gap-2 bg-muted/20">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
