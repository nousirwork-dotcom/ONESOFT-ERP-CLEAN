import { createContext, useContext, useState, useMemo, ReactNode, useCallback, useRef, useEffect } from "react";
import {
  TrendingUp, ShoppingBag, Boxes, Factory, Calculator,
  UserCheck, Wrench, Settings, LayoutGrid, LifeBuoy,
} from "lucide-react";

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
  isPosWorkspaceActive: boolean;
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

// ─── Tab Persistence Helpers ──────────────────────────────────────────────────

// Maps known paths (and path prefixes) to Icons for restoring tabs after restart.
// TabManagerProvider lives OUTSIDE BrandingProvider, so we use localStorage for
// settings sync (onesoft_cfg_remember_tabs is written by BrandingContext).

const NAV_EXACT: Record<string, React.ElementType> = {
  '/sales-module':          TrendingUp,
  '/purchases-module':      ShoppingBag,
  '/inventory-module':      Boxes,
  '/manufacturing-module':  Factory,
  '/accounting-module':     Calculator,
  '/hr-module':             UserCheck,
  '/assets-module':         Wrench,
  '/help-services-module':  LifeBuoy,
  '/settings':              Settings,
};

const NAV_PREFIXES: Array<{ prefix: string; Icon: React.ElementType }> = [
  { prefix: '/sales',   Icon: TrendingUp  },
  { prefix: '/pur',     Icon: ShoppingBag },
  { prefix: '/inv',     Icon: Boxes       },
  { prefix: '/mfg',     Icon: Factory     },
  { prefix: '/acc',     Icon: Calculator  },
  { prefix: '/hr',      Icon: UserCheck   },
  { prefix: '/assets',  Icon: Wrench      },
  { prefix: '/hs',      Icon: LifeBuoy    },
  { prefix: '/cfg',     Icon: Settings    },
];

function pathToIcon(path: string): React.ElementType {
  if (NAV_EXACT[path]) return NAV_EXACT[path];
  for (const p of NAV_PREFIXES) {
    if (path.startsWith(p.prefix)) return p.Icon;
  }
  return LayoutGrid;
}

const TABS_KEY        = 'onesoft_open_tabs';
const FLAG_KEY        = 'onesoft_cfg_remember_tabs';
const STARTUP_PAGE_KEY = 'onesoft_cfg_startup_page';

function isRememberEnabled(): boolean {
  try { return localStorage.getItem(FLAG_KEY) === 'true'; } catch { return false; }
}

type SavedTab = { path: string; label: string };

function loadSavedTabs(): AppTab[] {
  try {
    if (!isRememberEnabled()) return [];
    // القاعدة: التبويبات تُستعاد فقط عندما startup_page = 'last_opened'
    // إذا كان startup_page = dashboard/sales/etc. → يفتح الصفحة المحددة فقط ولا تعارض
    const startupPage = localStorage.getItem(STARTUP_PAGE_KEY) ?? 'dashboard';
    if (startupPage !== 'last_opened') return [];
    const raw = localStorage.getItem(TABS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedTab[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    return parsed.map((t, i) => ({
      id:          `restored-${i}-${t.path.replace(/\//g, '_')}`,
      path:        t.path,
      label:       t.label,
      Icon:        pathToIcon(t.path),
      pinned:      false,
      pos:         { x: 40 + i * 8, y: 40 + i * 8 },
      size:        { w: 1200, h: 760 },
      prevPos:     { x: 40, y: 40 },
      prevSize:    { w: 1200, h: 760 },
      windowState: 'maximized' as WindowState,
      zIndex:      100 + i,
    }));
  } catch {
    return [];
  }
}

function persistTabs(tabs: AppTab[]): void {
  try {
    const toSave: SavedTab[] = tabs
      .filter(t => !t.pinned)
      .map(t => ({ path: t.path, label: t.label }));
    localStorage.setItem(TABS_KEY, JSON.stringify(toSave));
  } catch { /* ignore */ }
}

// ─── Counters ─────────────────────────────────────────────────────────────────

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

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TabManagerProvider({ children }: { children: ReactNode }) {
  const restoredRef  = useRef<AppTab[]>(loadSavedTabs());
  const restoredTabs = restoredRef.current;

  const [tabs,           setTabs]           = useState<AppTab[]>(restoredTabs);
  const [activeTabId,    setActiveTabId]    = useState<string | null>(
    restoredTabs.length > 0 ? restoredTabs[restoredTabs.length - 1].id : null
  );
  const [dashboardVisible, setDashboardVisible] = useState<boolean>(
    restoredTabs.length === 0
  );
  /* Idempotent helper — exits fullscreen (Electron or browser DOM) without
     throwing if fullscreen is not active. Called from closeTab before the
     POS tab is removed so the exit fires before any component unmounts. */
  function exitPosFullscreen() {
    const erpAPI = (window as any).erpAPI;
    if (erpAPI?.setFullScreen) {
      erpAPI.setFullScreen(false);
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
  }

  /* POS workspace flag — pure derived state. No setter: truth comes from
     activeTabId + tab path + windowState + dashboardVisible. */
  const isPosWorkspaceActive = useMemo(() => {
    if (dashboardVisible) return false;
    const activeTab = tabs.find(t => t.id === activeTabId);
    return (
      activeTab?.path === '/sales/pos' &&
      activeTab?.windowState !== 'minimized'
    );
  }, [tabs, activeTabId, dashboardVisible]);

  // ─── DEBUG LOGGING ────────────────────────────────────────────────────────
  const _setDashboardVisible = (v: boolean) => {
    console.log('[debug:setDashboardVisible]', v, new Error().stack?.split('\n').slice(1, 5).join(' | '));
    setDashboardVisible(v);
  };

  const toggleDashboard = useCallback(() => {
    setDashboardVisible(v => {
      const next = !v;
      console.log('[debug:setDashboardVisible:toggle]', next, new Error().stack?.split('\n').slice(1, 5).join(' | '));
      return next;
    });
  }, []);
  const showDashboard = useCallback(() => _setDashboardVisible(true), []);

  // Persist tabs to localStorage whenever they change
  useEffect(() => {
    persistTabs(tabs);
  }, [tabs]);

  const bringToFront = useCallback((id: string) => {
    zCounter++;
    const z = zCounter;
    setTabs(prev => prev.map(t => t.id === id ? { ...t, zIndex: z } : t));
    setActiveTabId(id);
  }, []);

  const openTab = useCallback((path: string, label: string, Icon: React.ElementType, pinned = false) => {
    console.log('[debug:openTab]', path, new Error().stack?.split('\n').slice(1, 4).join(' | '));
    setDashboardVisible(false);
    setTabs(prev => {
      const existing = prev.find(t => t.path === path);
      if (existing) {
        zCounter++;
        const z = zCounter;
        setActiveTabId(existing.id);
        return prev.map(t => t.id === existing.id
          ? { ...t, zIndex: z, windowState: t.windowState === "minimized" ? "normal" : t.windowState }
          : t
        );
      }
      tabCounter++;
      const id   = `tab-${tabCounter}`;
      const size = getDefaultSize();
      const pos  = getInitialPos(size);
      zCounter++;
      const newTab: AppTab = {
        id, path, label, Icon, pinned,
        pos, size,
        prevPos: pos, prevSize: size,
        windowState: "maximized",
        zIndex: zCounter,
      };
      setActiveTabId(id);
      return [...prev, newTab];
    });
  }, []);

  const closeTab = useCallback((id: string) => {
    console.log('[debug:closeTab]', id, new Error().stack?.split('\n').slice(1, 4).join(' | '));
    setTabs(prev => {
      const tab = prev.find(t => t.id === id);
      if (!tab || tab.pinned) return prev;

      // Exit fullscreen BEFORE removing the POS tab so the exit fires
      // while LivePOSPage is still mounted. exitPosFullscreen is idempotent
      // (safe if called in React StrictMode's double-invocation).
      if (tab.path === '/sales/pos' && activeTabId === id) {
        exitPosFullscreen();
      }

      const next = prev.filter(t => t.id !== id);
      if (next.length === 0) {
        setActiveTabId(null);
        _setDashboardVisible(true);
      } else if (activeTabId === id) {
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
    console.log('[debug:minimizeWindow]', id, new Error().stack?.split('\n').slice(1, 4).join(' | '));
    setTabs(prev => prev.map(t => t.id === id ? { ...t, windowState: "minimized" } : t));
    setTabs(prev => {
      const visible = prev.filter(t => t.id !== id && t.windowState !== "minimized");
      if (visible.length > 0) {
        const top = [...visible].sort((a, b) => b.zIndex - a.zIndex)[0];
        setActiveTabId(top.id);
      } else {
        setActiveTabId(null);
        _setDashboardVisible(true);
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
      isPosWorkspaceActive,
      openTab, closeTab, activateTab,
      setDashboardVisible: _setDashboardVisible, toggleDashboard, showDashboard,
      minimizeWindow, toggleMaximize, bringToFront,
      moveWindow, resizeWindow,
    }}>
      {children}
    </TabManagerContext.Provider>
  );
}
