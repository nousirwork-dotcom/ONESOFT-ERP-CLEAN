import { fmtDate } from "@/shared/utils/dateUtils";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { Store, X } from "lucide-react";
import { useState, useEffect } from "react";

export const TASKBAR_H = 40;

export default function WindowTaskbar() {
  const { tabs, activeTabId, activateTab, closeTab, minimizeWindow, toggleDashboard, dashboardVisible, showDashboard, isPosWorkspaceActive } = useTabManager();
  const [clock, setClock] = useState(() => fmtTime());

  useEffect(() => {
    const id = setInterval(() => setClock(fmtTime()), 10000);
    return () => clearInterval(id);
  }, []);

  if (isPosWorkspaceActive) return null;

  const visibleTabs = tabs;

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
          width: 40,
          height: 30,
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
            <div
              key={tab.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (isMinimized || !isActive) {
                  activateTab(tab.id);
                } else {
                  minimizeWindow(tab.id);
                }
              }}
              onKeyDown={event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                if (isMinimized || !isActive) activateTab(tab.id);
                else minimizeWindow(tab.id);
              }}
              title={tab.label}
              style={{
                height: 30,
                minWidth: 48,
                maxWidth: 180,
                display: "flex",
                alignItems: "center",
                gap: 6,
                paddingRight: 8,
                paddingLeft: 8,
                borderRadius: isActive ? 10 : 5,
                background: isActive
                  ? "rgba(59,130,246,0.30)"
                  : isMinimized
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(255,255,255,0.10)",
                border: isActive
                  ? "1.5px solid var(--color-border-active)"
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
              {!tab.pinned && (
                <button
                  type="button"
                  aria-label={`إغلاق الشاشة: ${tab.label}`}
                  title="إغلاق الشاشة"
                  onMouseDown={event => event.stopPropagation()}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    closeTab(tab.id);
                  }}
                  onKeyDown={event => event.stopPropagation()}
                  style={{
                    width: 19,
                    height: 19,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    border: "1px solid transparent",
                    borderRadius: 4,
                    padding: 0,
                    background: "transparent",
                    color: "rgba(255,255,255,0.58)",
                    cursor: "pointer",
                    transition: "background 0.12s, color 0.12s, border-color 0.12s",
                  }}
                  onMouseEnter={event => {
                    event.currentTarget.style.background = "rgba(239,68,68,0.85)";
                    event.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                    event.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={event => {
                    event.currentTarget.style.background = "transparent";
                    event.currentTarget.style.borderColor = "transparent";
                    event.currentTarget.style.color = "rgba(255,255,255,0.58)";
                  }}
                >
                  <X aria-hidden="true" style={{ width: 12, height: 12 }} />
                </button>
              )}
            </div>
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
