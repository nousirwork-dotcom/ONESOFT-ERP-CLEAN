import { createContext, useContext, useState, ReactNode, useCallback, useRef } from "react";

export type WindowState = "normal" | "minimized" | "maximized";

export type AppTab = {
  id: string;
  path: string;
  label: string;
  Icon: React.ElementType;
  pinned?: boolean;
  pos: { x: number; y: number };
  size: { w: number; h: number };
  prevPos: { x: number; y: number };
  prevSize: { w: number; h: number };
  windowState: WindowState;
  zIndex: number;
};

type TabManagerContextType = {
  tabs: AppTab[];
  activeTabId: string | null;
  dashboardVisible: boolean;
  openTab: (path: string, label: string, Icon: React.ElementType, pinned?: boolean) => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  setDashboardVisible: (v: boolean) => void;
  toggleDashboard: () => void;
  showDashboard: () => void;
  minimizeWindow: (id: string) => void;
  toggleMaximize: (id: string) => void;
  bringToFront: (id: string) => void;
  moveWindow: (id: string, pos: { x: number; y: number }) => void;
  resizeWindow: (id: string, pos: { x: number; y: number }, size: { w: number; h: number }) => void;
};

const TabManagerContext = createContext<TabManagerContextType | null>(null);

export function useTabManager() {
  const ctx = useContext(TabManagerContext);
  if (!ctx) throw new Error("useTabManager must be used inside TabManagerProvider");
  return ctx;
}

let tabCounter = 0;
let zCounter = 100;
let cascadeN = 0;

function getDefaultSize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    w: Math.round(Math.min(vw * 0.82, 1200)),
    h: Math.round(Math.min(vh * 0.80, 760)),
  };
}
function getInitialPos(size: { w: number; h: number }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const offset = (cascadeN % 6) * 28;
  cascadeN++;
  return {
    x: Math.max(40, Math.round((vw - size.w) / 2 - 60 + offset)),
    y: Math.max(40, Math.round((vh - size.h) / 2 - 40 + offset)),
  };
}

export function TabManagerProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs]               = useState<AppTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [dashboardVisible, setDashboardVisible] = useState(true);

  const toggleDashboard = useCallback(() => setDashboardVisible(v => !v), []);
  const showDashboard   = useCallback(() => setDashboardVisible(true), []);

  const bringToFront = useCallback((id: string) => {
    zCounter++;
    const z = zCounter;
    setTabs(prev => prev.map(t => t.id === id ? { ...t, zIndex: z } : t));
    setActiveTabId(id);
  }, []);

  const openTab = useCallback((path: string, label: string, Icon: React.ElementType, pinned = false) => {
    setDashboardVisible(false);
    setTabs(prev => {
      const existing = prev.find(t => t.path === path);
      if (existing) {
        zCounter++;
        const z = zCounter;
        setActiveTabId(existing.id);
        // restore if minimized
        return prev.map(t => t.id === existing.id
          ? { ...t, zIndex: z, windowState: t.windowState === "minimized" ? "normal" : t.windowState }
          : t
        );
      }
      tabCounter++;
      const id = `tab-${tabCounter}`;
      const size = getDefaultSize();
      const pos  = getInitialPos(size);
      zCounter++;
      const newTab: AppTab = {
        id, path, label, Icon, pinned,
        pos, size,
        prevPos: pos, prevSize: size,
        windowState: "normal",
        zIndex: zCounter,
      };
      setActiveTabId(id);
      return [...prev, newTab];
    });
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === id);
      if (!tab || tab.pinned) return prev;
      const next = prev.filter(t => t.id !== id);
      if (next.length === 0) {
        setActiveTabId(null);
        setDashboardVisible(true);
      } else if (activeTabId === id) {
        // focus the window with highest zIndex
        const topTab = [...next].sort((a, b) => b.zIndex - a.zIndex)[0];
        setActiveTabId(topTab.id);
      }
      return next;
    });
  }, [activeTabId]);

  const activateTab = useCallback((id: string) => {
    zCounter++;
    const z = zCounter;
    setTabs(prev => prev.map(t => t.id === id
      ? { ...t, zIndex: z, windowState: t.windowState === "minimized" ? "normal" : t.windowState }
      : t
    ));
    setActiveTabId(id);
    setDashboardVisible(false);
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, windowState: "minimized" } : t));
    // focus next visible window
    setTabs(prev => {
      const visible = prev.filter(t => t.id !== id && t.windowState !== "minimized");
      if (visible.length > 0) {
        const top = [...visible].sort((a, b) => b.zIndex - a.zIndex)[0];
        setActiveTabId(top.id);
      } else {
        setActiveTabId(null);
        setDashboardVisible(true);
      }
      return prev;
    });
  }, []);

  const toggleMaximize = useCallback((id: string) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== id) return t;
      if (t.windowState === "maximized") {
        return { ...t, windowState: "normal", pos: t.prevPos, size: t.prevSize };
      } else {
        return { ...t, windowState: "maximized", prevPos: t.pos, prevSize: t.size };
      }
    }));
    bringToFront(id);
  }, [bringToFront]);

  const moveWindow = useCallback((id: string, pos: { x: number; y: number }) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, pos } : t));
  }, []);

  const resizeWindow = useCallback((id: string, pos: { x: number; y: number }, size: { w: number; h: number }) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, pos, size } : t));
  }, []);

  return (
    <TabManagerContext.Provider value={{
      tabs, activeTabId, dashboardVisible,
      openTab, closeTab, activateTab,
      setDashboardVisible, toggleDashboard, showDashboard,
      minimizeWindow, toggleMaximize, bringToFront,
      moveWindow, resizeWindow,
    }}>
      {children}
    </TabManagerContext.Provider>
  );
}
