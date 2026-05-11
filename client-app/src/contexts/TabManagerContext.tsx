import { createContext, useContext, useState, ReactNode } from "react";

export type AppTab = {
  id: string;
  path: string;
  label: string;
  Icon: React.ElementType;
};

type TabManagerContextType = {
  tabs: AppTab[];
  activeTabId: string;
  openTab: (path: string, label: string, Icon: React.ElementType) => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
};

const TabManagerContext = createContext<TabManagerContextType | null>(null);

export function useTabManager() {
  const ctx = useContext(TabManagerContext);
  if (!ctx) throw new Error("useTabManager must be used inside TabManagerProvider");
  return ctx;
}

let tabCounter = 1;

export function TabManagerProvider({ children, initialPath, initialLabel, InitialIcon }: {
  children: ReactNode;
  initialPath: string;
  initialLabel: string;
  InitialIcon: React.ElementType;
}) {
  const firstId = "tab-1";
  const [tabs, setTabs] = useState<AppTab[]>([
    { id: firstId, path: initialPath, label: initialLabel, Icon: InitialIcon },
  ]);
  const [activeTabId, setActiveTabId] = useState(firstId);

  const openTab = (path: string, label: string, Icon: React.ElementType) => {
    setTabs(prev => {
      const existing = prev.find(t => t.path === path);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      tabCounter++;
      const id = `tab-${tabCounter}`;
      setActiveTabId(id);
      return [...prev, { id, path, label, Icon }];
    });
  };

  const closeTab = (id: string) => {
    setTabs(prev => {
      if (prev.length === 1) return prev;
      const idx = prev.findIndex(t => t.id === id);
      const next = prev.filter(t => t.id !== id);
      if (activeTabId === id) {
        const newActive = next[Math.max(0, idx - 1)];
        setActiveTabId(newActive.id);
      }
      return next;
    });
  };

  const activateTab = (id: string) => setActiveTabId(id);

  return (
    <TabManagerContext.Provider value={{ tabs, activeTabId, openTab, closeTab, activateTab }}>
      {children}
    </TabManagerContext.Provider>
  );
}
