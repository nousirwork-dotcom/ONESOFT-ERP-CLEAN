import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export type AppTab = {
  id: string;
  path: string;
  label: string;
  Icon: React.ElementType;
  pinned?: boolean;
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
};

const TabManagerContext = createContext<TabManagerContextType | null>(null);

export function useTabManager() {
  const ctx = useContext(TabManagerContext);
  if (!ctx) throw new Error("useTabManager must be used inside TabManagerProvider");
  return ctx;
}

let tabCounter = 0;

export function TabManagerProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<AppTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [dashboardVisible, setDashboardVisible] = useState(true);

  const toggleDashboard = useCallback(() => setDashboardVisible(v => !v), []);
  const showDashboard = useCallback(() => setDashboardVisible(true), []);

  const openTab = useCallback((path: string, label: string, Icon: React.ElementType, pinned = false) => {
    setDashboardVisible(false);
    setTabs(prev => {
      const existing = prev.find(t => t.path === path);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      tabCounter++;
      const id = `tab-${tabCounter}`;
      setActiveTabId(id);
      return [...prev, { id, path, label, Icon, pinned }];
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
        const idx = prev.findIndex(t => t.id === id);
        const newActive = next[Math.max(0, idx - 1)];
        setActiveTabId(newActive.id);
      }
      return next;
    });
  }, [activeTabId]);

  const activateTab = useCallback((id: string) => {
    setActiveTabId(id);
    setDashboardVisible(false);
  }, []);

  return (
    <TabManagerContext.Provider value={{
      tabs, activeTabId, dashboardVisible,
      openTab, closeTab, activateTab,
      setDashboardVisible, toggleDashboard, showDashboard,
    }}>
      {children}
    </TabManagerContext.Provider>
  );
}
