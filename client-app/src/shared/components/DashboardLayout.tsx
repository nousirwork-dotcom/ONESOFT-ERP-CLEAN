import { fmtDate } from "@/shared/utils/dateUtils";
import { Avatar, AvatarFallback } from "@/core/ui/avatar";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu";
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
} from "@/core/ui/sidebar";
import { useAuth } from "@/core/hooks/useAuth";
import { useIsMobile } from "@/shared/hooks/useMobile";
import ChangeMyPasswordDialog from "@/shared/components/ChangeMyPasswordDialog";
import {
  BarChart3,
  Boxes,
  Calculator,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Code2,
  Cog,
  KeyRound,
  Factory,
  FileText,
  Grid3x3,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  PanelRight,
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
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import ChatWidget from "./ChatWidget";
import WindowTaskbar from "./WindowTaskbar";
import ElectronTitleBar from "./ElectronTitleBar";
import TabBar from "./TabBar";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { WorkspaceContext } from "@/core/contexts/WorkspaceContext";
import { useLang } from "@/core/contexts/LanguageContext";
import { useUiPrefs } from "@/core/contexts/UiPrefsContext";
import { t } from "@/shared/lib/translations";
import { canViewHelpServices } from "@/shared/lib/hsPermissions";
import { Languages } from "lucide-react";

const SIDEBAR_WIDTH_KEY = "erp-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 220;
const MAX_WIDTH = 320;

type LayoutMode = "vertical" | "horizontal" | "apps";

type SubNavItem = {
  icon: React.ElementType;
  label: string;
  path: string;
};

type NavItem = {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: string;
  roles?: string[];
  children?: SubNavItem[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function getNavGroups(lang: "ar" | "en"): NavGroup[] {
  return [
    {
      label: t(lang, "mainMenu"),
      items: [
        { icon: LayoutDashboard, label: t(lang, "dashboard"),        path: "/" },
        { icon: TrendingUp,      label: t(lang, "salesMgmt"),        path: "/sales-module" },
        { icon: ShoppingBag,     label: t(lang, "purchasesMgmt"),    path: "/purchases-module" },
        { icon: Boxes,           label: t(lang, "inventoryMgmt"),    path: "/inventory-module" },
        { icon: Factory,         label: t(lang, "manufacturingMgmt"),path: "/manufacturing-module" },
        { icon: Calculator,      label: t(lang, "accounting"),       path: "/accounting-module" },
        { icon: UserCheck,       label: t(lang, "hr"),               path: "/hr-module" },
        { icon: Wrench,          label: t(lang, "fixedAssets"),      path: "/assets-module" },
        { icon: LifeBuoy,        label: t(lang, "helpServices"),     path: "/help-services-module" },
        { icon: Settings,        label: t(lang, "settings"),         path: "/settings" },
      ],
    },
  ];
}

type OpenTab = (
  path: string,
  label: string,
  Icon: React.ElementType,
  pinned?: boolean,
) => void;

function UserMenu({
  user,
  userInitials,
  lang,
  openTab,
  setShowChangePassword,
  logout,
}: {
  user: any;
  userInitials: string;
  lang: "ar" | "en";
  openTab: OpenTab;
  setShowChangePassword: (open: boolean) => void;
  logout: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent transition-colors">
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium text-foreground hidden sm:block">
            {user.name ?? t(lang, "user")}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48"
        style={{ direction: "rtl" }}
        collisionPadding={{ top: 40 }}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {user.username}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openTab("/settings", t(lang, "settings"), Settings)}>
          <Settings className="w-4 h-4 ml-2" />
          {t(lang, "settings")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowChangePassword(true)}>
          <KeyRound className="w-4 h-4 ml-2" />
          تغيير كلمة المرور
        </DropdownMenuItem>
        {import.meta.env.DEV && (user?.role === "superadmin" || user?.role === "admin") && (
          <DropdownMenuItem onClick={() => openTab("/dev/source-code", "مستعرض الكود", Code2)}>
            <Code2 className="w-4 h-4 ml-2" />
            مستعرض الكود
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
          <LogOut className="w-4 h-4 ml-2" />
          {t(lang, "logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LangToggleBtn({
  lang,
  isAr,
  toggleLang,
}: {
  lang: "ar" | "en";
  isAr: boolean;
  toggleLang: () => void;
}) {
  return (
    <button
      onClick={toggleLang}
      title={isAr ? t(lang, "switchToEnglish") : t(lang, "switchToArabic")}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
    >
      <Languages className="w-3.5 h-3.5" />
      <span className="hidden sm:block">{isAr ? "EN" : "ع"}</span>
    </button>
  );
}

function LayoutToggleBtn({
  layoutMode,
  setLayoutMode,
  isAr,
}: {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  isAr: boolean;
}) {
  const modeMeta: Record<LayoutMode, { icon: React.ElementType; label: string }> = {
    vertical:   { icon: PanelRight, label: isAr ? "رأسية"  : "Vertical" },
    horizontal: { icon: LayoutGrid,  label: isAr ? "أفقية"  : "Horizontal" },
    apps:       { icon: Grid3x3,    label: isAr ? "مركزية" : "Centered" },
  };
  const CurrentIcon = modeMeta[layoutMode]?.icon ?? PanelRight;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title={isAr ? "طريقة عرض واجهة النظام" : "Interface view mode"}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
          data-testid="button-layout-switcher"
        >
          <CurrentIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:block">{modeMeta[layoutMode]?.label}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44"
        style={{ direction: isAr ? "rtl" : "ltr" }}
      >
        {(Object.keys(modeMeta) as LayoutMode[]).map((mode) => {
          const Icon = modeMeta[mode].icon;
          return (
            <DropdownMenuItem
              key={mode}
              onClick={() => setLayoutMode(mode)}
              className={layoutMode === mode ? "bg-accent font-semibold" : ""}
              data-testid={`menu-layout-${mode}`}
            >
              <Icon className="w-4 h-4 ml-2" />
              {modeMeta[mode].label}
              {layoutMode === mode && <Check className="w-3.5 h-3.5 mr-auto text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
  const { lang } = useLang();
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${isOnline ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
      {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      <span>{isOnline ? t(lang, "online") : t(lang, "offline")}</span>
    </div>
  );
}

/* =============================================
   VERTICAL LAYOUT — الشريط الجانبي الرأسي
============================================= */
function SidebarNav({ user }: { user: any }) {
  const { tabs, activeTabId, openTab, dashboardVisible, toggleDashboard } = useTabManager();
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const toggleModule = (path: string) =>
    setExpandedModules(p => ({ ...p, [path]: !p[path] }));
  const { lang } = useLang();
  const navGroups = getNavGroups(lang);

  return (
    <SidebarContent className="py-1 overflow-y-auto">
      {navGroups.map((group) => {
        const visibleItems = group.items.filter(
          (item) =>
            (!item.roles || (user?.role && item.roles.includes(user.role))) &&
            (item.path !== "/help-services-module" || canViewHelpServices(user))
        );
        if (!visibleItems.length) return null;
        return (
          <SidebarGroup key={group.label} className="p-0">
            {!collapsed && group.label !== t(lang, "mainMenu") && (
              <SidebarGroupLabel className="text-[#CBD5E1]/50 text-[10px] uppercase tracking-widest font-semibold px-3 py-1 mt-1">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarMenu className="gap-0 px-1.5">
              {visibleItems.map((item) => {
                if (item.children) {
                  const expanded = expandedModules[item.path] ?? false;
                  const hasActiveChild = item.children.some(c => activeTab?.path === c.path);
                  return (
                    <SidebarMenuItem key={item.path} className="mb-px">
                      <SidebarMenuButton
                        isActive={hasActiveChild}
                        onClick={() => toggleModule(item.path)}
                        tooltip={collapsed ? item.label : undefined}
                        className={`h-[38px] px-3 transition-colors text-[14px] font-semibold ${
                          hasActiveChild
                            ? "bg-[var(--sidebar-primary)] text-white active-ring"
                            : "rounded-[4px] text-[var(--sidebar-foreground)] hover:text-white hover:bg-[var(--sidebar-accent)]"
                        }`}
                      >
                        <item.icon className="w-4 h-4 shrink-0 text-[var(--sidebar-foreground)]" />
                        <span className="flex-1 text-right">{item.label}</span>
                        {!collapsed && (
                          expanded
                            ? <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
                            : <ChevronLeft className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        )}
                      </SidebarMenuButton>
                      {!collapsed && expanded && (
                        <div className="border-r border-[rgba(255,255,255,0.08)] mr-4 mt-px mb-1">
                          {item.children.map(child => {
                            const childActive = activeTab?.path === child.path;
                            return (
                              <button
                                key={child.path}
                                onClick={() => openTab(child.path, child.label, child.icon)}
                                className={`w-full flex items-center gap-2 px-3 h-[34px] text-[12px] font-medium transition-colors ${
                                  childActive
                                    ? "bg-[var(--sidebar-primary)] text-white active-ring"
                                    : "rounded-[4px] text-[var(--sidebar-foreground)]/80 hover:text-white hover:bg-[var(--sidebar-accent)]"
                                }`}
                              >
                                <child.icon className="w-3.5 h-3.5 shrink-0" />
                                <span className="text-right leading-tight">{child.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </SidebarMenuItem>
                  );
                }
                const isDashboard = item.path === "/";
                const isActive = isDashboard ? dashboardVisible : activeTab?.path === item.path;
                return (
                  <SidebarMenuItem key={item.path} className="mb-px">
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => isDashboard ? toggleDashboard() : openTab(item.path, item.label, item.icon)}
                      tooltip={collapsed ? item.label : undefined}
                      className={`h-[38px] px-3 transition-colors text-[14px] font-semibold ${
                        isActive
                          ? "bg-[var(--sidebar-primary)] text-white active-ring"
                          : "rounded-[4px] text-[var(--sidebar-foreground)] hover:text-white hover:bg-[var(--sidebar-accent)]"
                      }`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-[var(--sidebar-foreground)]"}`} />
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
            {group.label !== t(lang, "mainMenu") && (
              <SidebarSeparator className="my-1 bg-[rgba(255,255,255,0.06)]" />
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
  const { tabs, activeTabId, openTab, dashboardVisible, toggleDashboard } = useTabManager();
  const { lang } = useLang();
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const allItems = getNavGroups(lang).flatMap((g) =>
    g.items.filter(
      (item) =>
        (!item.roles || (user?.role && item.roles.includes(user.role))) &&
        (item.path !== "/help-services-module" || canViewHelpServices(user))
    )
  );

  return (
    <div className="flex items-stretch gap-0 h-full overflow-x-auto scrollbar-none">
      {allItems.map((item) => {
        if (item.children) {
          const hasActiveChild = item.children.some(c => activeTab?.path === c.path);
          return (
            <DropdownMenu key={item.path}>
              <DropdownMenuTrigger asChild>
                <button className={`
                  relative flex items-center gap-2 px-3.5 mx-0.5 my-1.5
                  text-[14.5px] font-[500] whitespace-nowrap
                  transition-colors duration-150 outline-none
                  ${hasActiveChild
                    ? "bg-[var(--primary)] text-white shadow-sm active-ring"
                    : "rounded-md text-foreground/60 hover:text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.06]"
                  }
                `}>
                  <item.icon className={`w-3.5 h-3.5 shrink-0 ${hasActiveChild ? "text-white" : "text-foreground/50"}`} />
                  <span>{item.label}</span>
                  <ChevronDown className="w-3 h-3 shrink-0 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[190px]">
                {item.children.map(child => (
                  <DropdownMenuItem
                    key={child.path}
                    onClick={() => openTab(child.path, child.label, child.icon)}
                    className={`text-[13px] gap-2 ${activeTab?.path === child.path ? "bg-blue-500/10 text-blue-600" : ""}`}
                  >
                    <child.icon className="w-3.5 h-3.5 shrink-0" />
                    {child.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }
        const isDashboardItem = item.path === "/";
        const isActive = isDashboardItem ? dashboardVisible : activeTab?.path === item.path;
        return (
          <button
            key={item.path}
            onClick={() => isDashboardItem ? toggleDashboard() : openTab(item.path, item.label, item.icon)}
            className={`
              relative flex items-center gap-2 px-3.5 mx-0.5 my-1.5
              text-[14.5px] font-[500] whitespace-nowrap
              transition-colors duration-150
              ${isActive
                ? "bg-[var(--primary)] text-white shadow-sm active-ring"
                : "rounded-md text-foreground/60 hover:text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.06]"
              }
            `}
          >
            <item.icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-foreground/50"}`} />
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

  const { layoutMode, setLayoutMode } = useUiPrefs();

  const [workspaceEl, setWorkspaceEl] = useState<HTMLElement | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { loading, user, logout } = useAuth();
  const isMobile = useIsMobile();
  const { openTab, showDashboard, isPosWorkspaceActive } = useTabManager();
  const { lang, toggleLang, dir, isAr } = useLang();
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    if (!loading && !user) {
      window.location.replace('/login');
    }
  }, [loading, user]);

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
    admin: t(lang, "roleAdmin"),
    cashier: t(lang, "roleCashier"),
    warehouse_manager: t(lang, "roleWarehouseManager"),
  };

  /* ================================================
     APPS LAYOUT RENDER (شاشة تطبيقات مركزية)
  ================================================ */
  if (layoutMode === "apps") {
    return (
      <>
      <div className="flex flex-col h-screen overflow-hidden bg-background" style={{ paddingTop: "var(--titlebar-h, 0px)" }}>
        {/* Top Bar */}
        <header className="sticky top-0 z-20 border-b border-[#D4CDC1] dark:border-slate-700 bg-[#DDD4C4] dark:bg-slate-900" style={{ display: isPosWorkspaceActive ? 'none' : undefined }}>
          <div className="flex items-center gap-3 px-4 h-10" dir={dir}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Store className="w-4 h-4 text-primary" />
              </div>
              <span className="font-bold text-sm tracking-wider text-foreground">ONESOFT ERP</span>
            </div>
            <button
              onClick={showDashboard}
              title={isAr ? "الرئيسية" : "Home"}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[12px] font-medium text-foreground/80 hover:text-foreground hover:bg-black/[0.08] transition-colors border border-transparent hover:border-black/10"
              data-testid="button-apps-home"
            >
              <Grid3x3 className="w-3.5 h-3.5" />
              <span>{isAr ? "الرئيسية" : "Home"}</span>
            </button>
            <div className="flex-1" />
            <OnlineIndicator />
            <span className="text-xs text-muted-foreground hidden md:block">
              {fmtDate(new Date())}
            </span>
            <LangToggleBtn lang={lang} isAr={isAr} toggleLang={toggleLang} />
            <LayoutToggleBtn layoutMode={layoutMode} setLayoutMode={setLayoutMode} isAr={isAr} />
            <UserMenu
              user={user}
              userInitials={userInitials}
              lang={lang}
              openTab={openTab}
              setShowChangePassword={setShowChangePassword}
              logout={logout}
            />
          </div>
        </header>

        {/* شريط تبويبات الشاشات المفتوحة — يبقى خارج مساحة العمل حتى لا تغطيه النوافذ الداخلية */}
        <TabBar />

        {/* Main Content — desktop area */}
        <WorkspaceContext.Provider value={workspaceEl}>
          <main
            ref={setWorkspaceEl as any}
            className="flex-1 overflow-hidden"
            style={{ position: "relative", paddingBottom: isPosWorkspaceActive ? 0 : 40 }}
          >
            {children}
          </main>
        </WorkspaceContext.Provider>
      </div>
      <WindowTaskbar />
      <ChatWidget />
      {!isPosWorkspaceActive && <ElectronTitleBar />}
      <ChangeMyPasswordDialog open={showChangePassword} onClose={() => setShowChangePassword(false)} />
      </>
    );
  }

  /* ================================================
     HORIZONTAL LAYOUT RENDER
  ================================================ */
  if (layoutMode === "horizontal") {
    return (
      <>
      <div className="flex flex-col h-screen overflow-hidden bg-background" style={{ paddingTop: "var(--titlebar-h, 0px)" }}>
        {/* Top Bar */}
        <header className="sticky top-0 z-20 border-b border-[#D4CDC1] dark:border-slate-700 bg-[#DDD4C4] dark:bg-slate-900" style={{ display: isPosWorkspaceActive ? 'none' : undefined }}>
          {/* Row 1: Logo + User */}
          <div className="flex items-center gap-3 px-4 h-10 border-b border-[#C8C1B8] dark:border-slate-700" dir={dir}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Store className="w-4 h-4 text-primary" />
              </div>
              <span className="font-bold text-sm tracking-wider text-foreground">ONESOFT ERP</span>
            </div>
            <div className="flex-1" />
            <OnlineIndicator />
            <span className="text-xs text-muted-foreground hidden md:block">
              {fmtDate(new Date())}
            </span>
            <LangToggleBtn lang={lang} isAr={isAr} toggleLang={toggleLang} />
            <LayoutToggleBtn layoutMode={layoutMode} setLayoutMode={setLayoutMode} isAr={isAr} />
            <UserMenu
              user={user}
              userInitials={userInitials}
              lang={lang}
              openTab={openTab}
              setShowChangePassword={setShowChangePassword}
              logout={logout}
            />
          </div>

          {/* Row 2: Horizontal Nav */}
          <div className="flex items-center px-4 h-10 gap-2 overflow-x-auto scrollbar-none" dir={dir}>
            <HorizontalNav user={user} />
          </div>
        </header>

        {/* شريط تبويبات الشاشات المفتوحة — يبقى خارج مساحة العمل حتى لا تغطيه النوافذ الداخلية */}
        <TabBar />

        {/* Main Content — desktop area */}
        <WorkspaceContext.Provider value={workspaceEl}>
          <main
            ref={setWorkspaceEl as any}
            className="flex-1 overflow-hidden"
            style={{ position: "relative", paddingBottom: isPosWorkspaceActive ? 0 : 40 }}
          >
            {children}
          </main>
        </WorkspaceContext.Provider>
      </div>
      <WindowTaskbar />
      <ChatWidget />
      {!isPosWorkspaceActive && <ElectronTitleBar />}
      <ChangeMyPasswordDialog open={showChangePassword} onClose={() => setShowChangePassword(false)} />
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
            <img
              src="/logo.png"
              alt="OneSoft"
              className="w-9 h-9 rounded-xl object-cover shrink-0"
              style={{ boxShadow: '0 2px 8px rgba(64,107,147,0.25)' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sidebar-foreground font-bold text-sm truncate">ONESOFT ERP</p>
              <p className="text-sidebar-foreground/40 text-xs">{t(lang, "systemSubtitle")}</p>
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
                    {user.name ?? t(lang, "user")}
                  </p>
                  <p className="text-sidebar-foreground/40 text-[10px]">
                    {roleLabels[user.role] ?? user.role}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/40 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48"
              style={{ direction: dir }}
              collisionPadding={{ top: 40 }}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {user.username}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openTab("/settings", t(lang, "settings"), Settings)}>
                <Settings className="w-4 h-4 ml-2" />
                {t(lang, "settings")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowChangePassword(true)}>
                <KeyRound className="w-4 h-4 ml-2" />
                تغيير كلمة المرور
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 ml-2" />
                {t(lang, "logout")}
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

      <SidebarInset className="flex flex-col h-screen overflow-hidden" style={{ paddingTop: "var(--titlebar-h, 0px)" }}>
        {/* Top Bar */}
        <header className="sticky top-0 z-10 flex items-center gap-3 px-4 h-10 border-b border-[#D4CDC1] bg-[#DDD4C4] dark:bg-slate-900 dark:border-slate-700" dir={dir} style={{ display: isPosWorkspaceActive ? 'none' : undefined }}>
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {fmtDate(new Date())}
            </span>
            <LangToggleBtn lang={lang} isAr={isAr} toggleLang={toggleLang} />
            <LayoutToggleBtn layoutMode={layoutMode} setLayoutMode={setLayoutMode} isAr={isAr} />
            <UserMenu
              user={user}
              userInitials={userInitials}
              lang={lang}
              openTab={openTab}
              setShowChangePassword={setShowChangePassword}
              logout={logout}
            />
          </div>
        </header>

        {/* شريط تبويبات الشاشات المفتوحة — يبقى خارج مساحة العمل حتى لا تغطيه النوافذ الداخلية */}
        <TabBar />

        {/* Main Content — desktop area */}
        <WorkspaceContext.Provider value={workspaceEl}>
          <main
            ref={setWorkspaceEl as any}
            className="flex-1 overflow-hidden"
            style={{ position: "relative", paddingBottom: isPosWorkspaceActive ? 0 : 40 }}
          >
            {children}
          </main>
        </WorkspaceContext.Provider>
      </SidebarInset>
    </SidebarProvider>
    <WindowTaskbar />
    <ChatWidget />
    {!isPosWorkspaceActive && <ElectronTitleBar />}
    <ChangeMyPasswordDialog open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </>
  );
}
