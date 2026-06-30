import { fmtDate } from "@/shared/utils/dateUtils";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { LayoutDashboard, Store } from "lucide-react";
import { useState, useEffect } from "react";

const TASKBAR_H = 48;

export default function WindowTaskbar() {
  const { tabs, activeTabId, activateTab, minimizeWindow, toggleDashboard, dashboardVisible, showDashboard } = useTabManager();
  const [clock, setClock] = useState(() => fmtTime());

  useEffect(() => {
    const id = setInterval(() => setClock(fmtTime()), 10000);
    return () => clearInterval(id);
  }, []);

  const visibleTabs = tabs; // show all (minimized too)

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: TASKBAR_H,
        zIndex: 2000,
        background: "linear-gradient(to bottom, #1a2e4a 0%, #142240 100%)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        gap: 2,
        paddingRight: 6,
        paddingLeft: 6,
        boxShadow: "0 -2px 12px rgba(0,0,0,0.35)",
      }}
      dir="rtl"
    >
      {/* Start button / Logo */}
      <button
        onClick={toggleDashboard}
        title="لوحة التحكم"
        style={{
          width: 42,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          background: dashboardVisible ? "rgba(59,130,246,0.35)" : "transparent",
          border: dashboardVisible ? "1px solid rgba(59,130,246,0.5)" : "1px solid transparent",
          cursor: "pointer",
          flexShrink: 0,
          transition: "background 0.15s",
          color: "#fff",
        }}
        onMouseEnter={e => { if (!dashboardVisible) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
        onMouseLeave={e => { if (!dashboardVisible) e.currentTarget.style.background = "transparent"; }}
      >
        <Store style={{ width: 18, height: 18 }} />
      </button>

      {/* Separator */}
      <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.12)", flexShrink: 0, marginRight: 2, marginLeft: 2 }} />

      {/* Open window buttons */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 3, overflow: "hidden" }}>
        {visibleTabs.map(tab => {
          const isActive  = tab.id === activeTabId && !dashboardVisible;
          const isMinimized = tab.windowState === "minimized";

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (isMinimized || !isActive) {
                  activateTab(tab.id);
                } else {
                  minimizeWindow(tab.id);
                }
              }}
              title={tab.label}
              style={{
                height: 36,
                minWidth: 48,
                maxWidth: 180,
                display: "flex",
                alignItems: "center",
                gap: 6,
                paddingRight: 8,
                paddingLeft: 8,
                borderRadius: 5,
                background: isActive
                  ? "rgba(59,130,246,0.30)"
                  : isMinimized
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(255,255,255,0.10)",
                border: isActive
                  ? "1px solid rgba(59,130,246,0.55)"
                  : "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                color: isActive ? "#fff" : "rgba(255,255,255,0.72)",
                transition: "background 0.12s, border-color 0.12s",
                flexShrink: 0,
                overflow: "hidden",
                position: "relative",
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.16)";
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = isMinimized ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.10)";
              }}
            >
              {/* Active indicator line at bottom */}
              {isActive && (
                <span style={{
                  position: "absolute", bottom: 0, left: 8, right: 8, height: 2,
                  background: "#3b82f6", borderRadius: "2px 2px 0 0",
                }} />
              )}
              <tab.Icon style={{ width: 13, height: 13, flexShrink: 0, opacity: isMinimized ? 0.5 : 1 }} />
              <span style={{
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "'Cairo', Tahoma, sans-serif",
                opacity: isMinimized ? 0.55 : 1,
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Clock */}
      <div style={{
        flexShrink: 0,
        paddingLeft: 12,
        paddingRight: 12,
        textAlign: "center",
        color: "rgba(255,255,255,0.75)",
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, letterSpacing: "0.02em" }}>{clock}</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", lineHeight: 1.2 }}>
          {fmtDate(new Date())}
        </div>
      </div>
    </div>
  );
}

function fmtTime() {
  return new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
}
