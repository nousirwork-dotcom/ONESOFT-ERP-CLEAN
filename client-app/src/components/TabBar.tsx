import { useRef } from "react";
import { useTabManager } from "@/contexts/TabManagerContext";
import { X } from "lucide-react";

export default function TabBar() {
  const { tabs, activeTabId, activateTab, closeTab } = useTabManager();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="shrink-0 flex items-stretch overflow-hidden border-b border-primary/20"
      style={{
        height: 36,
        background: "linear-gradient(180deg, hsl(var(--primary) / 0.18) 0%, hsl(var(--primary) / 0.08) 100%)",
      }}
    >
      <div
        ref={scrollRef}
        className="flex items-stretch overflow-x-auto flex-1"
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`flex items-center gap-1.5 px-3 cursor-pointer select-none shrink-0 group transition-all duration-150 border-l border-primary/15
                ${isActive
                  ? "bg-background/95 text-primary shadow-sm border-t-[2.5px] border-t-primary"
                  : "text-primary/70 hover:bg-background/40 hover:text-primary border-t-[2.5px] border-t-transparent"
                }`}
              style={{ maxWidth: 180, minWidth: 100 }}
              onClick={() => activateTab(tab.id)}
            >
              <tab.Icon className={`w-3 h-3 shrink-0 transition-colors ${isActive ? "text-primary" : "text-primary/60"}`} />
              <span className={`text-[11px] truncate flex-1 transition-all ${isActive ? "font-semibold" : "font-medium"}`}>
                {tab.label}
              </span>
              {tabs.length > 1 && (
                <button
                  onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                  className={`p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-all shrink-0
                    ${isActive ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-50 hover:!opacity-100"}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
