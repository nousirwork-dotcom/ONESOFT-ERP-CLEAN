import { useRef } from "react";
import { useTabManager } from "@/contexts/TabManagerContext";
import { X } from "lucide-react";

export default function TabBar() {
  const { tabs, activeTabId, activateTab, closeTab } = useTabManager();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (tabs.length <= 1) return null;

  return (
    <div className="shrink-0 border-t border-border bg-muted/30 flex items-stretch overflow-hidden" style={{ height: 34 }}>
      <div
        ref={scrollRef}
        className="flex items-stretch overflow-x-auto scrollbar-none flex-1"
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`flex items-center gap-1.5 px-3 border-l border-border cursor-pointer select-none shrink-0 group transition-colors
                ${isActive
                  ? "bg-background text-foreground border-t-2 border-t-primary"
                  : "bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground border-t-2 border-t-transparent"}`}
              style={{ maxWidth: 180, minWidth: 90 }}
              onClick={() => activateTab(tab.id)}
            >
              <tab.Icon className={`w-3 h-3 shrink-0 ${isActive ? "text-primary" : ""}`} />
              <span className="text-[11px] font-medium truncate flex-1">{tab.label}</span>
              <button
                onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                className={`p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-colors shrink-0
                  ${isActive ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100"}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
