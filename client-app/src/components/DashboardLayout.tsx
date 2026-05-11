import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  ChevronRight,
  Cog,
  Factory,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  PanelRight,
  Settings,
  Store,
  TrendingUp,
  ShoppingBag,
  UserCheck,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import ChatWidget from "./ChatWidget";
import TabBar from "./TabBar";
import { useTabManager } from "@/contexts/TabManagerContext";

const SIDEBAR_WIDTH_KEY = "erp-sidebar-width";
const LAYOUT_MODE_KEY = "erp-layout-mode";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 220;
const MAX_WIDTH = 320;

type LayoutMode = "vertical" | "horizontal";

type NavItem = {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: string;
  roles?: string[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "القائمة الرئيسية",
    items: [
      { icon: LayoutDashboard, label: "لوحة التحكم",     path: "/" },
      { icon: TrendingUp,      label: "إدارة المبيعات",   path: "/sales-module" },
      { icon: ShoppingBag,     label: "إدارة المشتريات",  path: "/purchases-module" },
      { icon: Boxes,           label: "إدارة المخزون",    path: "/inventory-module" },
      { icon: Factory,         label: "إدارة التصنيع",    path: "/manufacturing-module" },
      { icon: Calculator,      label: "الحسابات العامة",  path: "/accounting-module" },
      { icon: UserCheck,       label: "الموارد البشرية",  path: "/hr-module" },
      { icon: Wrench,          label: "الأصول الثابتة",   path: "/assets-module" },
      { icon: Settings,        label: "الإعدادات",        path: "/settings", roles: ["admin"] },
    ],
  },
];

function OnlineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${isOnline ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
      {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      <span>{isOnline ? "متصل" : "غير متصل"}</span>
    </div>
  );
}

/* =============================================
   VERTICAL LAYOUT — الشريط الجانبي الرأسي
============================================= */
function SidebarNav({ user }: { user: any }) {
  const { tabs, activeTabId, openTab } = useTabManager();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <SidebarContent className="py-2">
      {navGroups.map((group) => {
        const visibleItems = group.items.filter(
          (item) => !item.roles || (user?.role && item.roles.includes(user.role))
        );
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
                const isActive = activeTab?.path === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => openTab(item.path, item.label, item.icon)}
                      tooltip={collapsed ? item.label : undefined}
                      className={`mx-1 rounded-lg transition-all duration-150 ${
                        isActive
                          ? "bg-sidebar-primary/20 text-sidebar-primary font-medium"
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-sidebar-primary" : ""}`} />
                      <span>{item.label}</span>
                      {item.badge && (
                        <Badge variant="destructive" className="mr-auto text-[10px] h-4 px-1">
                          {item.badge}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
            {group.label !== "القائمة الرئيسية" && (
              <SidebarSeparator className="mt-2 bg-sidebar-border/50" />
            )}
          </SidebarGroup>
        );
      })}
    </SidebarContent>
  );
}

/* =============================================
   HORIZONTAL LAYOUT — الشريط الأفقي العلوي
============================================= */
function HorizontalNav({ user }: { user: any }) {
  const { tabs, activeTabId, openTab } = useTabManager();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const allItems = navGroups.flatMap((g) =>
    g.items.filter((item) => !item.roles || (user?.role && item.roles.includes(user.role)))
  );

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
      {allItems.map((item) => {
        const isActive = activeTab?.path === item.path;
        return (
          <button
            key={item.path}
            onClick={() => openTab(item.path, item.label, item.icon)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150 ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <item.icon className="w-3.5 h-3.5 shrink-0" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* =============================================
   MAIN LAYOUT COMPONENT
============================================= */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    return (localStorage.getItem(LAYOUT_MODE_KEY) as LayoutMode) ?? "vertical";
  });

  const { loading, user, logout } = useAuth();
  const isMobile = useIsMobile();
  const { openTab } = useTabManager();
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    if (!loading && !user) {
      window.location.replace('/login');
    }
  }, [loading, user]);

  const toggleLayout = () => {
    const next: LayoutMode = layoutMode === "vertical" ? "horizontal" : "vertical";
    setLayoutMode(next);
    localStorage.setItem(LAYOUT_MODE_KEY, next);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return null;

  const userInitials = (user.name ?? "U")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const roleLabels: Record<string, string> = {
    admin: "مدير النظام",
    cashier: "كاشير",
    warehouse_manager: "مدير مخزن",
  };

  /* ---- User Menu (shared) ---- */
  const UserMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent transition-colors">
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium text-foreground hidden sm:block">
            {user.name ?? "مستخدم"}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openTab("/settings", "الإعدادات", Settings)}>
          <Settings className="w-4 h-4 ml-2" />
          الإعدادات
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
          <LogOut className="w-4 h-4 ml-2" />
          تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /* ---- Layout Toggle Button ---- */
  const LayoutToggleBtn = () => (
    <button
      onClick={toggleLayout}
      title={layoutMode === "vertical" ? "تبديل إلى القائمة الأفقية" : "تبديل إلى القائمة الرأسية"}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
    >
      {layoutMode === "vertical" ? (
        <>
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="hidden sm:block">أفقي</span>
        </>
      ) : (
        <>
          <PanelRight className="w-3.5 h-3.5" />
          <span className="hidden sm:block">رأسي</span>
        </>
      )}
    </button>
  );

  /* ================================================
     HORIZONTAL LAYOUT RENDER
  ================================================ */
  if (layoutMode === "horizontal") {
    return (
      <>
      <div className="flex flex-col min-h-screen bg-background">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
          {/* Row 1: Logo + User */}
          <div className="flex items-center gap-3 px-4 h-12 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Store className="w-4 h-4 text-primary" />
              </div>
              <span className="font-bold text-sm tracking-wider text-foreground">ONESOFT ERP</span>
            </div>
            <div className="flex-1" />
            <OnlineIndicator />
            <span className="text-xs text-muted-foreground hidden md:block">
              {new Date().toLocaleDateString("ar-SA", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <LayoutToggleBtn />
            <UserMenu />
          </div>

          {/* Row 2: Horizontal Nav */}
          <div className="flex items-center px-4 h-10 gap-2 overflow-x-auto scrollbar-none">
            <HorizontalNav user={user} />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>

        {/* Tab Bar */}
        <TabBar />
      </div>
      <ChatWidget />
      </>
    );
  }

  /* ================================================
     VERTICAL LAYOUT RENDER (default)
  ================================================ */
  return (
    <>
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <Sidebar side="right" className="border-l border-sidebar-border bg-sidebar">
        {/* Header */}
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

        {/* Navigation */}
        <SidebarNav user={user} />

        {/* Footer */}
        <SidebarFooter className="border-t border-sidebar-border/50 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 w-full p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-right">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-bold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-sidebar-foreground text-xs font-medium truncate">
                    {user.name ?? "مستخدم"}
                  </p>
                  <p className="text-sidebar-foreground/40 text-[10px]">
                    {roleLabels[user.role] ?? user.role}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/40 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openTab("/settings", "الإعدادات", Settings)}>
                <Settings className="w-4 h-4 ml-2" />
                الإعدادات
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 ml-2" />
                تسجيل الخروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>

        {/* Resize Handle */}
        {!isMobile && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-sidebar-primary/30 transition-colors"
            onMouseDown={handleMouseDown}
          />
        )}
      </Sidebar>

      <SidebarInset className="flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 flex items-center gap-3 px-4 h-14 border-b border-border bg-background/95 backdrop-blur-sm">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {new Date().toLocaleDateString("ar-SA", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <LayoutToggleBtn />
            <UserMenu />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>

        {/* Tab Bar */}
        <TabBar />
      </SidebarInset>
    </SidebarProvider>
    <ChatWidget />
    </>
  );
}
