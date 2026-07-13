import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { trpc } from "@/shared/lib/trpc";
import {
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  Package,
  ShoppingCart,
  TrendingUp,
  Wallet,
  Factory,
  Calculator,
  Users,
  Building2,
  Settings,
  Boxes,
  Eye,
  EyeOff,
  LifeBuoy,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useState, useEffect } from "react";
import { formatCurrency } from "@/shared/utils/currency";
import { useAuth } from "@/core/hooks/useAuth";
import { canViewHelpServices } from "@/shared/lib/hsPermissions";

const WIDGET_DEFS = [
  { id: "stats",         label: "بطاقات الإحصائيات" },
  { id: "salesChart",    label: "مخطط المبيعات (7 أيام)" },
  { id: "topProducts",   label: "أكثر الأصناف مبيعًا" },
  { id: "quickActions",  label: "الإجراءات السريعة" },
  { id: "modules",       label: "وحدات النظام" },
];

type WidgetId = typeof WIDGET_DEFS[number]["id"];
type Visibility = Record<WidgetId, boolean>;

const DEFAULT_VISIBILITY: Visibility = {
  stats:        true,
  salesChart:   true,
  topProducts:  true,
  quickActions: true,
  modules:      true,
};

function useWidgetVisibility() {
  const [vis, setVis] = useState<Visibility>(() => {
    try {
      const saved = localStorage.getItem("dashboard-widgets");
      return saved ? { ...DEFAULT_VISIBILITY, ...JSON.parse(saved) } : DEFAULT_VISIBILITY;
    } catch {
      return DEFAULT_VISIBILITY;
    }
  });

  const toggle = (id: WidgetId) => {
    setVis(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem("dashboard-widgets", JSON.stringify(next));
      return next;
    });
  };

  return { vis, toggle };
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color,
  onClick,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <Card className="card-hover border-0 shadow-sm cursor-pointer" onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                <span className="text-xs text-emerald-600 font-medium">{trend}</span>
              </div>
            )}
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsPanel({
  vis,
  toggle,
  onClose,
}: {
  vis: Visibility;
  toggle: (id: WidgetId) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" dir="rtl">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative mt-16 ml-4 w-72 rounded-2xl shadow-2xl border border-border/60 overflow-hidden"
        style={{ background: "#FDFCFA" }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-border/40"
          style={{ background: "#EDE8DC" }}
        >
          <span className="font-semibold text-sm text-slate-700">تخصيص لوحة التحكم</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <div className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground px-2 pb-1">اختر الأقسام التي تريد إظهارها</p>
          {WIDGET_DEFS.map(({ id, label }) => {
            const isOn = vis[id as WidgetId];
            return (
              <button
                key={id}
                onClick={() => toggle(id as WidgetId)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors hover:bg-slate-100/80 group"
              >
                <span className={`text-sm font-medium transition-colors ${isOn ? "text-slate-800" : "text-slate-400"}`}>
                  {label}
                </span>
                <div
                  className={`w-9 h-5 rounded-full flex items-center transition-all duration-200 px-0.5 ${
                    isOn ? "bg-[#406B93] justify-end" : "bg-slate-200 justify-start"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </div>
              </button>
            );
          })}
        </div>
        <div className="px-4 pb-4 pt-1">
          <button
            onClick={() => {
              WIDGET_DEFS.forEach(({ id }) => {
                if (!vis[id as WidgetId]) toggle(id as WidgetId);
              });
            }}
            className="w-full text-xs text-[#406B93] hover:underline text-center py-1"
          >
            إظهار الكل
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: chartData } = trpc.dashboard.salesChart.useQuery({ days: 7 });
  const { data: topProducts } = trpc.dashboard.topProducts.useQuery({ limit: 5 });
  const { vis, toggle } = useWidgetVisibility();
  const [showSettings, setShowSettings] = useState(false);


  const chartFormatted = (chartData ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString("ar-SA", { month: "short", day: "numeric" }),
    مبيعات: Number(d.total),
    فواتير: Number(d.count),
  }));

  const hiddenCount = WIDGET_DEFS.filter(({ id }) => !vis[id as WidgetId]).length;

  return (
    <div className="h-full overflow-auto p-4 md:p-5 space-y-6" dir="rtl">
      {showSettings && (
        <SettingsPanel vis={vis} toggle={toggle} onClose={() => setShowSettings(false)} />
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm mt-0.5">نظرة عامة على أداء النظام</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            تخصيص
            {hiddenCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-[#406B93] text-white text-[10px] flex items-center justify-center font-bold">
                {hiddenCount}
              </span>
            )}
          </button>
          <Button onClick={() => navigate("/pos")} className="gap-2">
            <ShoppingCart className="w-4 h-4" />
            فتح الكاشير
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      {vis.stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="مبيعات اليوم"
            value={isLoading ? "..." : formatCurrency(stats?.todaySales ?? 0)}
            subtitle={`${stats?.todayInvoices ?? 0} فاتورة`}
            icon={Wallet}
            color="bg-indigo-50 text-indigo-600"
            onClick={() => navigate("/invoices")}
          />
          <StatCard
            title="مبيعات الشهر"
            value={isLoading ? "..." : formatCurrency(stats?.monthSales ?? 0)}
            subtitle={`${stats?.monthInvoices ?? 0} فاتورة`}
            icon={TrendingUp}
            color="bg-emerald-50 text-emerald-600"
            onClick={() => navigate("/reports")}
          />
          <StatCard
            title="الأصناف"
            value={isLoading ? "..." : String(stats?.productCount ?? 0)}
            subtitle="صنف نشط"
            icon={Package}
            color="bg-amber-50 text-amber-600"
            onClick={() => navigate("/products")}
          />
          <StatCard
            title="تحويلات معلقة"
            value={isLoading ? "..." : String(stats?.pendingTransfers ?? 0)}
            subtitle="تحتاج موافقة"
            icon={ArrowLeftRight}
            color={`${(stats?.pendingTransfers ?? 0) > 0 ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600"}`}
            onClick={() => navigate("/transfers")}
          />
        </div>
      )}

      {/* Charts Row */}
      {(vis.salesChart || vis.topProducts) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {vis.salesChart && (
            <Card className="lg:col-span-2 border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">المبيعات - آخر 7 أيام</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/reports")} className="text-xs gap-1">
                    <BarChart3 className="w-3.5 h-3.5" />
                    التقارير
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {chartFormatted.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartFormatted}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.45 0.18 265)" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="oklch(0.45 0.18 265)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 240)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.55 0.02 240)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "oklch(0.55 0.02 240)" }} />
                      <Tooltip
                        formatter={(val) => [formatCurrency(Number(val)), "المبيعات"]}
                        contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.88 0.01 240)", fontSize: 12 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="مبيعات"
                        stroke="oklch(0.45 0.18 265)"
                        strokeWidth={2}
                        fill="url(#salesGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <BarChart3 className="w-8 h-8 opacity-25" />
                    <p className="text-sm">لا توجد بيانات مبيعات بعد</p>
                    <button
                      onClick={() => navigate("/pos")}
                      className="text-xs text-[#406B93] hover:underline"
                    >
                      أنشئ أول فاتورة من الكاشير
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {vis.topProducts && (
            <Card className={`border-0 shadow-sm ${!vis.salesChart ? "lg:col-span-3" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">أكثر الأصناف مبيعًا</CardTitle>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                {topProducts && topProducts.length > 0 ? (
                  <div className="space-y-3">
                    {topProducts.map((p, i) => (
                      <div key={p.productId} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.productName}</p>
                          <p className="text-xs text-muted-foreground">{Number(p.totalQty).toFixed(0)} وحدة</p>
                        </div>
                        <span className="text-sm font-semibold text-primary">
                          {formatCurrency(Number(p.totalRevenue))}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[160px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Package className="w-8 h-8 opacity-25" />
                    <p className="text-sm">لا توجد مبيعات أصناف بعد</p>
                    <p className="text-xs opacity-70">ستظهر الأصناف الأكثر مبيعًا هنا بعد أول عملية بيع</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Quick Actions */}
      {vis.quickActions && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "فاتورة جديدة", icon: ShoppingCart, path: "/pos",               color: "bg-indigo-600 hover:bg-indigo-700 text-white" },
            { label: "إضافة صنف",   icon: Package,       path: "/inventory-module",  color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
            { label: "تحويل مخزن",  icon: ArrowLeftRight, path: "/inventory-module", color: "bg-amber-600 hover:bg-amber-700 text-white" },
            { label: "التقارير",    icon: BarChart3,      path: "/sales-module",      color: "bg-slate-700 hover:bg-slate-800 text-white" },
          ].map((action) => (
            <button
              key={action.path + action.label}
              onClick={() => navigate(action.path)}
              className={`flex items-center gap-2.5 p-3.5 rounded-xl font-medium text-sm transition-all duration-150 ${action.color} shadow-sm hover:shadow-md`}
            >
              <action.icon className="w-4 h-4 shrink-0" />
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* ERP Modules Grid */}
      {vis.modules && (
        <div>
          <h2 className="text-base font-semibold mb-3 text-foreground">وحدات النظام</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "المبيعات",        icon: TrendingUp,   path: "/sales-module",        color: "text-blue-500",    bg: "bg-blue-500/10" },
              { label: "المشتريات",       icon: ShoppingCart, path: "/purchases-module",     color: "text-purple-500",  bg: "bg-purple-500/10" },
              { label: "المخزون",         icon: Boxes,        path: "/inventory-module",     color: "text-amber-500",   bg: "bg-amber-500/10" },
              { label: "التصنيع",         icon: Factory,      path: "/manufacturing-module", color: "text-orange-500",  bg: "bg-orange-500/10" },
              { label: "الحسابات",        icon: Calculator,   path: "/accounting-module",    color: "text-emerald-500", bg: "bg-emerald-500/10" },
              { label: "الموارد البشرية", icon: Users,        path: "/hr-module",            color: "text-pink-500",    bg: "bg-pink-500/10" },
              { label: "الأصول الثابتة",  icon: Building2,    path: "/assets-module",        color: "text-cyan-500",    bg: "bg-cyan-500/10" },
              { label: "المساعدة والخدمات", icon: LifeBuoy,   path: "/help-services-module", color: "text-teal-500",    bg: "bg-teal-500/10" },
              { label: "الإعدادات",       icon: Settings,     path: "/settings",             color: "text-slate-500",   bg: "bg-slate-500/10" },
            ]
              .filter((m) => m.path !== "/help-services-module" || canViewHelpServices(user))
              .map((m) => (
              <button key={m.path} onClick={() => navigate(m.path)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-accent/20 transition-all duration-150 text-center">
                <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center`}>
                  <m.icon className={`w-5 h-5 ${m.color}`} />
                </div>
                <span className="text-xs font-medium text-foreground">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All hidden fallback */}
      {hiddenCount === WIDGET_DEFS.length && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
          <EyeOff className="w-12 h-12 opacity-20" />
          <p className="text-sm">جميع الأقسام مخفية</p>
          <button
            onClick={() => setShowSettings(true)}
            className="text-xs text-[#406B93] hover:underline"
          >
            اضغط هنا لإظهارها
          </button>
        </div>
      )}
    </div>
  );
}
