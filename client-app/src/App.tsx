import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TabManagerProvider, useTabManager } from "./contexts/TabManagerContext";
import LoginPage from "./pages/LoginPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import { createElement, useEffect } from "react";
import { trpc } from "./lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { LayoutDashboard, Settings } from "lucide-react";
import { PAGE_MAP } from "./lib/pageMap";

// ─── Auth Guard ───────────────────────────────────────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (meQuery.isLoading) return;
    if (!meQuery.data) {
      if (location !== "/login") navigate("/login");
    } else {
      if (location === "/login") {
        navigate(meQuery.data.role === "superadmin" ? "/superadmin" : "/");
      }
    }
  }, [meQuery.data, meQuery.isLoading, location]);

  if (meQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">جاري التحقق من الجلسة...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── محتوى التبويبات ─────────────────────────────────────────────────────
function TabContent() {
  const { tabs, activeTabId } = useTabManager();
  return (
    <div className="h-full" dir="rtl">
      {tabs.map(tab => {
        const Component = PAGE_MAP[tab.path];
        return (
          <div
            key={tab.id}
            style={{ display: tab.id === activeTabId ? "flex" : "none", flexDirection: "column" }}
            className="h-full"
          >
            {Component ? <Component /> : <NotFound />}
          </div>
        );
      })}
    </div>
  );
}

// ─── مسارات التطبيق ───────────────────────────────────────────────────────
function AppRoutes() {
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const user = meQuery.data;

  if (user?.role === "superadmin") {
    return (
      <Switch>
        <Route path="/superadmin" component={SuperAdminPage} />
        <Route component={SuperAdminPage} />
      </Switch>
    );
  }

  const panelRenderer = (path: string) => {
    const C = PAGE_MAP[path];
    return C ? createElement(C) : null;
  };

  return (
    <TabManagerProvider
      initialPath="/"
      initialLabel="لوحة التحكم"
      InitialIcon={LayoutDashboard}
    >
      <DashboardLayout panelRenderer={panelRenderer}>
        <TabContent />
      </DashboardLayout>
    </TabManagerProvider>
  );
}

// ─── QueryClient & tRPC ───────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: (url, options) => fetch(url, { ...options, credentials: "include" }),
    }),
  ],
});

// ─── App Root ─────────────────────────────────────────────────────────────
function App() {
  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="light">
            <TooltipProvider>
              <Toaster position="top-center" richColors />
              <Switch>
                <Route path="/login" component={LoginPage} />
                <Route>
                  <AuthGuard>
                    <AppRoutes />
                  </AuthGuard>
                </Route>
              </Switch>
            </TooltipProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}

export default App;
