import { useRef, useEffect, useState } from "react";
import { useTabManager } from "@/contexts/TabManagerContext";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function TabBar() {
  const { tabs, activeTabId, activateTab, closeTab } = useTabManager();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft]   = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hoveredTabId, setHoveredTabId]     = useState<string | null>(null);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll);
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", checkScroll); ro.disconnect(); };
  }, [tabs]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeEl = el.querySelector(`[data-tabid="${activeTabId}"]`) as HTMLElement | null;
    activeEl?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  const scrollBy = (dir: "left" | "right") =>
    scrollRef.current?.scrollBy({ left: dir === "left" ? -160 : 160, behavior: "smooth" });

  return (
    <div
      dir="rtl"
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "stretch",
        height: 34,
        background: "#E8EDF4",
        borderBottom: "1px solid #C4CDD9",
        overflow: "hidden",
      }}
    >
      {/* زر التمرير يمين */}
      {canScrollRight && (
        <ScrollArrow dir="right" onClick={() => scrollBy("right")} />
      )}

      {/* قائمة التبويبات */}
      <div
        ref={scrollRef}
        style={{ flex: 1, display: "flex", alignItems: "stretch", overflowX: "auto", scrollbarWidth: "none" }}
      >
        {tabs.map((tab) => {
          const isActive  = tab.id === activeTabId;
          const isHovered = hoveredTabId === tab.id;
          const showClose = !tab.pinned && (isActive || isHovered);

          return (
            <div
              key={tab.id}
              data-tabid={tab.id}
              onClick={() => activateTab(tab.id)}
              onMouseEnter={() => setHoveredTabId(tab.id)}
              onMouseLeave={() => setHoveredTabId(null)}
              title={tab.label}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "0 8px 0 6px",
                cursor: "pointer", flexShrink: 0,
                maxWidth: 192, minWidth: 88,
                position: "relative",
                borderLeft: "1px solid",
                borderLeftColor: isActive ? "#B0BDD0" : "#C4CDD9",
                background: isActive
                  ? "#FFFFFF"
                  : isHovered
                  ? "#D6DFEe"
                  : "transparent",
                transition: "background 0.1s",
              }}
            >
              {/* شريط أزرق علوي للتبويب النشط */}
              {isActive && (
                <span style={{
                  position: "absolute", top: 0, left: 0, right: 0,
                  height: 2.5, background: "#2563EB",
                }} />
              )}

              {/* أيقونة */}
              <tab.Icon style={{
                width: 13, height: 13, flexShrink: 0,
                color: isActive ? "#2563EB" : "#6B7280",
                pointerEvents: "none",
              }} />

              {/* الاسم */}
              <span style={{
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#1E293B" : "#4B5563",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                flex: 1,
                fontFamily: "'Cairo', Tahoma, sans-serif",
                lineHeight: 1,
              }}>
                {tab.label}
              </span>

              {/* زر الإغلاق */}
              {!tab.pinned ? (
                <button
                  onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                  title="إغلاق"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 16, height: 16, flexShrink: 0,
                    borderRadius: 3, border: "none",
                    background: "transparent", cursor: "pointer",
                    padding: 0, color: "#9CA3AF",
                    opacity: showClose ? 1 : 0,
                    pointerEvents: showClose ? "auto" : "none",
                    transition: "opacity 0.12s, background 0.12s, color 0.12s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "#FECACA";
                    e.currentTarget.style.color = "#DC2626";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#9CA3AF";
                  }}
                >
                  <X style={{ width: 9, height: 9, pointerEvents: "none" }} />
                </button>
              ) : (
                /* نقطة صغيرة للتبويبات الثابتة */
                <span style={{
                  width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                  background: isActive ? "#2563EB" : "#BCC5D3",
                  transition: "background 0.12s",
                }} />
              )}
            </div>
          );
        })}

        {/* مساحة فارغة بعد آخر تبويب */}
        <div style={{ flex: 1, minWidth: 16 }} />
      </div>

      {/* زر التمرير يسار */}
      {canScrollLeft && (
        <ScrollArrow dir="left" onClick={() => scrollBy("left")} />
      )}
    </div>
  );
}

/* ── مكوّن سهم التمرير ───────────────────────── */
function ScrollArrow({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const borderSide = dir === "left" ? "borderRight" : "borderLeft";
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0, width: 24,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: hovered ? "#D3DCE9" : "#E8EDF4",
        border: "none",
        [borderSide]: "1px solid #C4CDD9",
        cursor: "pointer", color: "#5A687A",
        transition: "background 0.1s",
      }}
    >
      {dir === "left"
        ? <ChevronLeft  style={{ width: 13, height: 13, pointerEvents: "none" }} />
        : <ChevronRight style={{ width: 13, height: 13, pointerEvents: "none" }} />
      }
    </button>
  );
}
