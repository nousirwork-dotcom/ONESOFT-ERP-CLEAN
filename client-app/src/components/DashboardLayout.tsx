import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  Boxes,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Cog,
  Columns2,
  Factory,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  PanelRight,
  PanelRightOpen,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";
import { CSSProperties, createElement, useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import ChatWidget from "./ChatWidget";
import TabBar from "./TabBar";
import { useTabManager } from "@/contexts/TabManagerContext";

const SIDEBAR_WIDTH_KEY  = "erp-sidebar-width";
const LAYOUT_MODE_KEY    = "erp-layout-mode";
const PANEL_WIDTH_KEY    = "erp-panel-width";
const DEFAULT_WIDTH      = 260;
const MIN_WIDTH          = 220;
const MAX_WIDTH          = 320;
const DEFAULT_PANEL_W    = 420;
const MIN_PANEL_W        = 280;
const MAX_PANEL_W        = 640;

type LayoutMode = "vertical" | "horizontal" | "horizontal-panel" | "horizontal-sidebar";

type SubNavItem = { icon: React.ElementType; label: string; path: string };
type NavItem    = { icon: React.ElementType; label: string; path: string; badge?: string; roles?: string[]; children?: SubNavItem[] };
type NavGroup   = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "القائمة الرئيسية",
    items: [
      { icon: LayoutDashboard, label: "لوحة التحكم",      path: "/" },
      {
        icon: TrendingUp, label: "إدارة المبيعات", path: "/sales-module",
        children: [
          { icon: Receipt,      label: "فاتورة مبيعات",    path: "/sales/invoice" },
          { icon: Tag,          label: "عرض سعر مبيعات",   path: "/sales/quotation" },
          { icon: RotateCcw,    label: "مردود المبيعات",    path: "/sales/return" },
          { icon: Users,        label: "دليل العملاء",      path: "/sales/customers" },
          { icon: BarChart3,    label: "تقارير المبيعات",   path: "/sales/totals-reports" },
        ],
      },
      {
        icon: ShoppingBag, label: "إدارة المشتريات", path: "/purchases-module",
        children: [
          { icon: ClipboardList, label: "أوامر الشراء",     path: "/purchases/orders" },
          { icon: FileText,      label: "فواتير المشتريات", path: "/purchases/invoices" },
          { icon: RotateCcw,     label: "مردود المشتريات",  path: "/purchases/returns" },
          { icon: Users,         label: "دليل الموردين",    path: "/purchases/suppliers" },
          { icon: TrendingDown,  label: "تقارير المشتريات", path: "/purchases/rpt-supplier" },
        ],
      },
      { icon: Boxes,      label: "إدارة المخزون",    path: "/inventory-module" },
      { icon: Factory,    label: "إدارة التصنيع",    path: "/manufacturing-module" },
      { icon: Calculator, label: "الحسابات العامة",  path: "/accounting-module" },
      { icon: UserCheck,  label: "الموارد البشرية",  path: "/hr-module" },
      { icon: Wrench,     label: "الأصول الثابتة",   path: "/assets-module" },
      { icon: Settings,   label: "الإعدادات",        path: "/settings", roles: ["admin"] },
    ],
  },
];

/* ─── Online Indicator ─────────────────────────────────────────────── */
function OnlineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${isOnline ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
      {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      <span>{isOnline ? "متصل" : "غير متصل"}</span>
    </div>
  );
}

/* ─── Vertical Sidebar Nav ─────────────────────────────────────────── */
function SidebarNav({ user }: { user: any }) {
  const { tabs, activeTabId, openTab } = useTabManager();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    "/sales-module": true,
    "/purchases-module": true,
  });
  const toggleModule = (path: string) => setExpandedModules(p => ({ ...p, [path]: !p[path] }));

  return (
    <SidebarContent className="py-2">
      {navGroups.map((group) => {
        const visibleItems = group.items.filter(item => !item.roles || (user?.role && item.roles.includes(user.role)));
        if (!visibleItems.length) return null;
        return (
          <SidebarGroup key={group.label}>
            {!collapsed && group.label !== "القائمة الرئيسية" && (
              <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest font-semibold px-3 mb-1">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleItems.map((item) => {
                if (item.children) {
                  const expanded = expandedModules[item.path] ?? false;
                  const hasActiveChild = item.children.some(c => activeTab?.path === c.path);
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={hasActiveChild}
                        onClick={() => toggleModule(item.path)}
                        tooltip={collapsed ? item.label : undefined}
                        className={`mx-1 rounded-lg transition-all duration-150 ${hasActiveChild ? "bg-sidebar-primary/20 text-sidebar-primary font-medium" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"}`}
                      >
                        <item.icon className={`w-4 h-4 shrink-0 ${hasActiveChild ? "text-sidebar-primary" : ""}`} />
                        <span className="flex-1">{item.label}</span>
                        {!collapsed && (expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronLeft className="w-3 h-3 shrink-0" />)}
                      </SidebarMenuButton>
                      {!collapsed && expanded && (
                        <div className="mr-3 border-r border-sidebar-border/40 mt-0.5 mb-1">
                          {item.children.map(child => {
                            const childActive = activeTab?.path === child.path;
                            return (
                              <button
                                key={child.path}
                                onClick={() => openTab(child.path, child.label, child.icon)}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${childActive ? "bg-sidebar-primary/15 text-sidebar-primary font-semibold border-r-2 border-sidebar-primary" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"}`}
                              >
                                <child.icon className="w-3 h-3 shrink-0" />
                                <span className="text-right leading-tight">{child.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </SidebarMenuItem>
                  );
                }
                const isActive = activeTab?.path === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => openTab(item.path, item.label, item.icon)}
                      tooltip={collapsed ? item.label : undefined}
                      className={`mx-1 rounded-lg transition-all duration-150 ${isActive ? "bg-sidebar-primary/20 text-sidebar-primary font-medium" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"}`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-sidebar-primary" : ""}`} />
                      <span>{item.label}</span>
                      {item.badge && <Badge variant="destructive" className="mr-auto text-[10px] h-4 px-1">{item.badge}</Badge>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
            {group.label !== "القائمة الرئيسية" && <SidebarSeparator className="mt-2 bg-sidebar-border/50" />}
          </SidebarGroup>
        );
      })}
    </SidebarContent>
  );
}

/* ─── Standalone Nav Sidebar (horizontal-sidebar mode) ────────────── */
function NavSidebar({ user, width }: { user: any; width: number }) {
  const { tabs, activeTabId, openTab } = useTabManager();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "/sales-module": true, "/purchases-module": true,
  });

  const allItems = navGroups.flatMap(g =>
    g.items.filter(item => !item.roles || (user?.role && item.roles.includes(user.role)))
  );

  return (
    <div
      style={{ width }}
      className="flex flex-col border-r border-sidebar-border bg-sidebar overflow-hidden h-full shrink-0"
      dir="rtl"
    >
      <div className="px-3 py-2 border-b border-sidebar-border/50 shrink-0">
        <span className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">التنقل</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
        {allItems.map(item => {
          if (item.children) {
            const isExpanded = expanded[item.path] ?? false;
            const hasActive  = item.children.some(c => activeTab?.path === c.path);
            return (
              <div key={item.path}>
                <button
                  onClick={() => setExpanded(p => ({ ...p, [item.path]: !p[item.path] }))}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${hasActive ? "bg-sidebar-primary/20 text-sidebar-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"}`}
                >
                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 text-right">{item.label}</span>
                  {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronLeft className="w-3 h-3 shrink-0" />}
                </button>
                {isExpanded && (
                  <div className="mr-3 border-r border-sidebar-border/40 mt-0.5 mb-1">
                    {item.children.map(child => {
                      const childActive = activeTab?.path === child.path;
                      return (
                        <button
                          key={child.path}
                          onClick={() => openTab(child.path, child.label, child.icon)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${childActive ? "bg-sidebar-primary/15 text-sidebar-primary font-semibold border-r-2 border-sidebar-primary" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"}`}
                        >
                          <child.icon className="w-3 h-3 shrink-0" />
                          <span className="text-right leading-tight">{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          const isActive = activeTab?.path === item.path;
          return (
            <button
              key={item.path}
              onClick={() => openTab(item.path, item.label, item.icon)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${isActive ? "bg-sidebar-primary/20 text-sidebar-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"}`}
            >
              <item.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="text-right flex-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Horizontal Top Nav ───────────────────────────────────────────── */
function HorizontalNav({
  user,
  onModuleClick,
}: {
  user: any;
  onModuleClick?: (path: string, label: string, icon: React.ElementType) => void;
}) {
  const { tabs, activeTabId, openTab } = useTabManager();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const allItems  = navGroups.flatMap(g =>
    g.items.filter(item => !item.roles || (user?.role && item.roles.includes(user.role)))
  );

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
      {allItems.map((item) => {
        if (item.children) {
          const hasActiveChild = item.children.some(c => activeTab?.path === c.path);
          return (
            <DropdownMenu key={item.path}>
              <DropdownMenuTrigger asChild>
                <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150 ${hasActiveChild ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                  <ChevronDown className="w-3 h-3 shrink-0 mr-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[180px]">
                {item.children.map(child => (
                  <DropdownMenuItem
                    key={child.path}
                    onClick={() => openTab(child.path, child.label, child.icon)}
                    className={`text-xs gap-2 ${activeTab?.path === child.path ? "bg-primary/10 text-primary" : ""}`}
                  >
                    <child.icon className="w-3.5 h-3.5 shrink-0" />
                    {child.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }
        const isActive = activeTab?.path === item.path;
        const handleClick = () => {
          if (onModuleClick) {
            onModuleClick(item.path, item.label, item.icon);
          } else {
            openTab(item.path, item.label, item.icon);
          }
        };
        return (
          <button
            key={item.path}
            onClick={handleClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150 ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
          >
            <item.icon className="w-3.5 h-3.5 shrink-0" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN LAYOUT COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export default function DashboardLayout({
  children,
  panelRenderer,
}: {
  children: React.ReactNode;
  panelRenderer?: (path: string) => React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const s = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return s ? parseInt(s, 10) : DEFAULT_WIDTH;
  });
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    return (localStorage.getItem(LAYOUT_MODE_KEY) as LayoutMode) ?? "vertical";
  });
  const [panelPath,  setPanelPath]  = useState<string | null>(null);
  const [panelLabel, setPanelLabel] = useState<string>("");
  const [panelWidth, setPanelWidth] = useState(() => {
    const s = localStorage.getItem(PANEL_WIDTH_KEY);
    return s ? parseInt(s, 10) : DEFAULT_PANEL_W;
  });

  const { loading, user, logout } = useAuth();
  const isMobile  = useIsMobile();
  const { openTab } = useTabManager();

  /* sidebar resize */
  const isResizing  = useRef(false);
  const startX      = useRef(0);
  const startW      = useRef(0);

  /* panel resize */
  const isPanelResizing = useRef(false);
  const panelStartX     = useRef(0);
  const panelStartW     = useRef(0);

  useEffect(() => {
    if (!loading && !user) window.location.replace("/login");
  }, [loading, user]);

  const switchLayout = (mode: LayoutMode) => {
    setLayoutMode(mode);
    localStorage.setItem(LAYOUT_MODE_KEY, mode);
    if (mode !== "horizontal-panel") setPanelPath(null);
  };

  /* sidebar mouse resize */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX.current - e.clientX;
      const nw = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW.current + delta));
      setSidebarWidth(nw);
    };
    const onUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [sidebarWidth]);

  const handleSidebarResizeDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startW.current = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  /* panel mouse resize */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isPanelResizing.current) return;
      const delta = panelStartX.current - e.clientX;
      const nw = Math.min(MAX_PANEL_W, Math.max(MIN_PANEL_W, panelStartW.current + delta));
      setPanelWidth(nw);
    };
    const onUp = () => {
      if (isPanelResizing.current) {
        isPanelResizing.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth));
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [panelWidth]);

  const handlePanelResizeDown = (e: React.MouseEvent) => {
    isPanelResizing.current = true;
    panelStartX.current = e.clientX;
    panelStartW.current = panelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  };

  const openPanel = useCallback((path: string, label: string, _icon: React.ElementType) => {
    setPanelPath(path);
    setPanelLabel(label);
  }, []);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user)   return null;

  const userInitials = (user.name ?? "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const roleLabels: Record<string, string> = { admin: "مدير النظام", cashier: "كاشير", warehouse_manager: "مدير مخزن" };

  const dateStr = new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  /* ── Shared: User Menu ── */
  const UserMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent transition-colors">
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">{userInitials}</AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium text-foreground hidden sm:block">{user.name ?? "مستخدم"}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openTab("/settings", "الإعدادات", Settings)}>
          <Settings className="w-4 h-4 ml-2" />الإعدادات
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
          <LogOut className="w-4 h-4 ml-2" />تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /* ── Shared: Layout Mode Picker (dropdown, 4 options) ── */
  const modeConfig: { value: LayoutMode; label: string; icon: React.ElementType; desc: string }[] = [
    { value: "vertical",           label: "رأسي",            icon: PanelRight,    desc: "شريط جانبي على اليمين" },
    { value: "horizontal",         label: "أفقي",            icon: LayoutGrid,    desc: "قائمة علوية، تبويبات" },
    { value: "horizontal-panel",   label: "أفقي + لوحة",     icon: Columns2,      desc: "الوحدات تفتح في لوحة جانبية" },
    { value: "horizontal-sidebar", label: "أفقي + شريط",     icon: PanelRightOpen,desc: "قائمة علوية + شريط جانبي دائم" },
  ];
  const currentMode = modeConfig.find(m => m.value === layoutMode)!;

  const LayoutToggleBtn = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title="طريقة العرض"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
        >
          <currentMode.icon className="w-3.5 h-3.5" />
          <span className="hidden sm:block">{currentMode.label}</span>
          <ChevronDown className="w-3 h-3 hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground py-1.5">طريقة العرض</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={layoutMode} onValueChange={(v) => switchLayout(v as LayoutMode)}>
          {modeConfig.map(m => (
            <DropdownMenuRadioItem key={m.value} value={m.value} className="text-xs gap-2 py-2">
              <m.icon className="w-3.5 h-3.5 shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium">{m.label}</span>
                <span className="text-[10px] text-muted-foreground">{m.desc}</span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /* ══════════════════════════════════════════════════════════
     HORIZONTAL LAYOUT  (shared header for modes 2, 3, 4)
  ══════════════════════════════════════════════════════════ */
  const HorizontalHeader = ({ onModuleClick }: { onModuleClick?: (path: string, label: string, icon: React.ElementType) => void }) => (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 h-12 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <Store className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-sm tracking-wider text-foreground">ONESOFT ERP</span>
        </div>
        <div className="flex-1" />
        <OnlineIndicator />
        <span className="text-xs text-muted-foreground hidden md:block">{dateStr}</span>
        <LayoutToggleBtn />
        <UserMenu />
      </div>
      <div className="flex items-center px-4 h-10 gap-2 overflow-x-auto scrollbar-none">
        <HorizontalNav user={user} onModuleClick={onModuleClick} />
      </div>
    </header>
  );

  /* ══════════════════════════════════════════════════════════
     MODE: horizontal (standard)
  ══════════════════════════════════════════════════════════ */
  if (layoutMode === "horizontal") {
    return (
      <>
        <div className="flex flex-col h-screen overflow-hidden bg-background">
          <HorizontalHeader />
          <TabBar />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
        <ChatWidget />
      </>
    );
  }

  /* ══════════════════════════════════════════════════════════
     MODE: horizontal-panel  (modules open as right panel)
  ══════════════════════════════════════════════════════════ */
  if (layoutMode === "horizontal-panel") {
    return (
      <>
        <div className="flex flex-col h-screen overflow-hidden bg-background">
          <HorizontalHeader onModuleClick={openPanel} />
          <TabBar />
          <main className="flex-1 overflow-hidden flex flex-row">
            {/* Tab content (left / main) */}
            <div className="flex-1 overflow-hidden">{children}</div>

            {/* Right panel */}
            {panelPath && panelRenderer && (
              <div
                style={{ width: panelWidth }}
                className="relative flex flex-col border-r border-border bg-background shrink-0"
                dir="rtl"
              >
                {/* resize handle (left edge of panel) */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-10"
                  onMouseDown={handlePanelResizeDown}
                />
                {/* panel header */}
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/40 shrink-0 gap-2">
                  <span className="text-xs font-semibold text-foreground truncate">{panelLabel}</span>
                  <button
                    onClick={() => setPanelPath(null)}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-accent transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* panel content */}
                <div className="flex-1 overflow-hidden">
                  {panelRenderer(panelPath)}
                </div>
              </div>
            )}

            {/* Empty panel hint */}
            {!panelPath && (
              <div className="w-64 border-r border-dashed border-border/60 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/10 shrink-0">
                <Columns2 className="w-8 h-8 opacity-30" />
                <p className="text-xs text-center px-4 opacity-50">اضغط على وحدة من القائمة العلوية لفتحها هنا</p>
              </div>
            )}
          </main>
        </div>
        <ChatWidget />
      </>
    );
  }

  /* ══════════════════════════════════════════════════════════
     MODE: horizontal-sidebar  (top nav + right sidebar always)
  ══════════════════════════════════════════════════════════ */
  if (layoutMode === "horizontal-sidebar") {
    return (
      <>
        <div className="flex flex-col h-screen overflow-hidden bg-background">
          <HorizontalHeader />
          <TabBar />
          <main className="flex-1 overflow-hidden flex flex-row">
            {/* Tab content (left / main) */}
            <div className="flex-1 overflow-hidden">{children}</div>

            {/* Right sidebar (always visible) */}
            <div className="relative shrink-0" style={{ width: sidebarWidth }}>
              {/* resize handle on left edge */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-10"
                onMouseDown={handleSidebarResizeDown}
              />
              <NavSidebar user={user} width={sidebarWidth} />
            </div>
          </main>
        </div>
        <ChatWidget />
      </>
    );
  }

  /* ══════════════════════════════════════════════════════════
     MODE: vertical  (default right sidebar)
  ══════════════════════════════════════════════════════════ */
  return (
    <>
      <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
        <Sidebar side="right" className="border-l border-sidebar-border bg-sidebar">
          <SidebarHeader className="border-b border-sidebar-border/50 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sidebar-primary/20 flex items-center justify-center">
                <Store className="w-5 h-5 text-sidebar-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sidebar-foreground font-bold text-sm truncate">ONESOFT ERP</p>
                <p className="text-sidebar-foreground/40 text-xs">نظام إدارة الأعمال</p>
              </div>
              <OnlineIndicator />
            </div>
          </SidebarHeader>

          <SidebarNav user={user} />

          <SidebarFooter className="border-t border-sidebar-border/50 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 w-full p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-right">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-bold">{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sidebar-foreground text-xs font-medium truncate">{user.name ?? "مستخدم"}</p>
                    <p className="text-sidebar-foreground/40 text-[10px]">{roleLabels[user.role] ?? user.role}</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/40 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs text-muted-foreground">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openTab("/settings", "الإعدادات", Settings)}>
                  <Settings className="w-4 h-4 ml-2" />الإعدادات
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 ml-2" />تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>

          {/* sidebar resize handle */}
          {!isMobile && (
            <div
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-sidebar-primary/30 transition-colors"
              onMouseDown={handleSidebarResizeDown}
            />
          )}
        </Sidebar>

        <SidebarInset className="flex flex-col h-screen overflow-hidden">
          <header className="sticky top-0 z-10 flex items-center gap-3 px-4 h-14 border-b border-border bg-background/95 backdrop-blur-sm">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:block">{dateStr}</span>
              <LayoutToggleBtn />
              <UserMenu />
            </div>
          </header>
          <TabBar />
          <main className="flex-1 overflow-hidden">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <ChatWidget />
    </>
  );
}
