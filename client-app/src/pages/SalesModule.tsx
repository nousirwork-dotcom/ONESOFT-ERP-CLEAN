import { useState, useRef, useEffect } from "react";
import SalesInvoicePageNew from "./SalesInvoicePage";
import SalesQuotation from "./sales/SalesQuotation";
import { useTabManager } from "@/contexts/TabManagerContext";
import {
  ChevronDown, ChevronRight, TrendingUp, FileText, RotateCcw,
  BarChart3, Settings, Users, ClipboardList, ShoppingCart, Tag,
  DollarSign, Receipt, Clock, Wallet, Star, Plus, Search,
  Printer, CheckCircle, RefreshCw, ArrowRight, Filter,
  Bell, Activity, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

// ─── Menu Structure ───────────────────────────────────────────────────────────

type MenuId = string;

const menuSections = [
  {
    id: "transactions",
    label: "المعاملات",
    icon: FileText,
    children: [
      { id: "all-transactions", label: "عرض المعاملات",      icon: Activity,     path: "/sales/transactions" },
      { id: "sales-invoice",    label: "فاتورة مبيعات",      icon: Receipt,      path: "/sales/invoice" },
      { id: "sales-return",     label: "مردود المبيعات",      icon: RotateCcw,    path: "/sales/return" },
      { id: "credit-note",      label: "إشعار دائن",          icon: FileText,     path: "/sales/credit-note" },
      { id: "quotation",        label: "عرض سعر مبيعات",     icon: Tag,          path: "/sales/quotation" },
      { id: "sales-order",      label: "أمر بيع",             icon: ClipboardList,path: "/sales/order" },
      { id: "delivery-order",   label: "أمر تسليم مبيعات",   icon: ArrowRight,   path: "/sales/delivery" },
    ],
  },
  {
    id: "pos",
    label: "نقطة بيع",
    icon: ShoppingCart,
    children: [
      { id: "pos-screen",      label: "شاشة البيع",   icon: ShoppingCart, path: "/sales/pos" },
      { id: "shifts",          label: "الورديات",      icon: Clock,        path: "/sales/shifts" },
      { id: "payment-methods", label: "طرق السداد",    icon: Wallet,       path: "/sales/payment-methods" },
      { id: "pos-settings",    label: "إعدادات POS",   icon: Star,         path: "/sales/pos-settings" },
      { id: "pos-reports",     label: "تقارير POS",    icon: BarChart3,    path: "/sales/pos-reports" },
    ],
  },
  {
    id: "customers",
    label: "العملاء",
    icon: Users,
    children: [
      { id: "add-customer",       label: "دليل العملاء",        icon: Users,       path: "/sales/customers" },
      { id: "customer-groups",    label: "مجموعات العملاء",     icon: Users,       path: "/sales/customer-groups" },
      { id: "customer-balances",  label: "أرصدة العملاء",       icon: DollarSign,  path: "/sales/customer-balances" },
      { id: "customer-statement", label: "كشف حساب عميل",       icon: FileText,    path: "/sales/customer-statement" },
    ],
  },
  {
    id: "reports",
    label: "التقارير",
    icon: BarChart3,
    children: [
      { id: "customer-reports",          label: "تقارير العملاء",                             icon: Users,      path: "/sales/customer-reports" },
      { id: "sales-totals-reports",      label: "تقارير إجماليات المبيعات",                   icon: TrendingUp, path: "/sales/totals-reports" },
      { id: "sales-invoices-report",     label: "تقرير فواتير ومردودات المبيعات خلال فترة",   icon: FileText,   path: "/sales/invoices-report" },
      { id: "sales-items-reports",       label: "تقارير أصناف المبيعات",                      icon: BarChart3,  path: "/sales/items-reports" },
    ],
  },
];

// ─── Dashboard Settings ────────────────────────────────────────────────────────

type DashboardWidgetKey =
  | "todaySales" | "invoiceCount" | "newCustomers" | "avgInvoice"
  | "chart" | "alerts" | "recentOps" | "stats";

type DashboardSettings = Record<DashboardWidgetKey, boolean>;

const SETTINGS_KEY = "onesoft_sales_dash_v1";

const DEFAULT_SETTINGS: DashboardSettings = {
  todaySales: true, invoiceCount: true, newCustomers: true, avgInvoice: true,
  chart: true, alerts: true, recentOps: true, stats: true,
};

const WIDGET_LABELS: { key: DashboardWidgetKey; label: string }[] = [
  { key: "todaySales",    label: "مبيعات اليوم" },
  { key: "invoiceCount",  label: "عدد الفواتير" },
  { key: "newCustomers",  label: "العملاء الجدد" },
  { key: "avgInvoice",    label: "متوسط الفاتورة" },
  { key: "chart",         label: "الرسم البياني" },
  { key: "alerts",        label: "التنبيهات" },
  { key: "recentOps",     label: "آخر العمليات" },
  { key: "stats",         label: "الإحصائيات" },
];

function loadSettings(): DashboardSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { return DEFAULT_SETTINGS; }
}

function saveSettings(s: DashboardSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

/* ── Toggle Switch ── */
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
        background: checked ? "#2563EB" : "#D1D5DB",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
        padding: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2,
        left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: "50%",
        background: "#fff", transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

/* ── Settings Popup ── */
function DashboardSettingsPanel({
  settings, onChange, onClose,
  anchorRef,
}: {
  settings: DashboardSettings;
  onChange: (key: DashboardWidgetKey, val: boolean) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  return (
    <div
      ref={panelRef}
      dir="rtl"
      style={{
        position: "absolute", top: "calc(100% + 6px)", left: 0,
        zIndex: 9999, width: 240,
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderBottom: "1px solid #F3F4F6",
        background: "#F9FAFB",
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", fontFamily: "'Cairo', Tahoma, sans-serif" }}>
          تخصيص لوحة التحكم
        </span>
        <button
          onClick={onClose}
          style={{
            width: 22, height: 22, borderRadius: 5, border: "none",
            background: "transparent", cursor: "pointer", color: "#9CA3AF",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#F3F4F6")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <X style={{ width: 13, height: 13, pointerEvents: "none" }} />
        </button>
      </div>

      {/* Widget list */}
      <div style={{ padding: "6px 0" }}>
        {WIDGET_LABELS.map(({ key, label }) => (
          <div
            key={key}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "7px 14px", transition: "background 0.1s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{
              fontSize: 12.5, color: "#374151",
              fontFamily: "'Cairo', Tahoma, sans-serif",
            }}>
              {label}
            </span>
            <ToggleSwitch checked={settings[key]} onChange={val => onChange(key, val)} />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: "8px 14px", borderTop: "1px solid #F3F4F6" }}>
        <button
          onClick={() => {
            WIDGET_LABELS.forEach(({ key }) => onChange(key, true));
          }}
          style={{
            width: "100%", padding: "5px 0", borderRadius: 6,
            border: "1px solid #E5E7EB", background: "transparent",
            fontSize: 11.5, color: "#6B7280", cursor: "pointer",
            fontFamily: "'Cairo', Tahoma, sans-serif",
            transition: "background 0.1s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#F3F4F6")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          إظهار الكل
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function SalesMenu({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  const { openTab } = useTabManager();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    transactions: true, pos: false, customers: false, reports: false,
  });
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  return (
    <nav className="w-56 shrink-0 border-l border-border bg-card/50 overflow-y-auto flex flex-col">
      <div className="p-3 border-b border-border">
        <button
          onClick={() => onSelect("overview")}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeId === "overview" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent/30"}`}
        >
          <TrendingUp className="w-4 h-4 text-primary" />
          المبيعات
        </button>
      </div>
      <div className="py-2 flex-1">
        {menuSections.map(section => (
          <div key={section.id}>
            <button
              onClick={() => toggle(section.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors uppercase tracking-wide"
            >
              <section.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-right">{section.label}</span>
              {expanded[section.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {expanded[section.id] && (
              <div className="mr-3 border-r border-border/40 mb-1">
                {section.children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => {
                        onSelect(child.id);
                        openTab(child.path, child.label, child.icon);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                        activeId === child.id
                          ? "bg-primary/10 text-primary font-semibold border-r-2 border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
                      }`}
                    >
                      <child.icon className="w-3 h-3 shrink-0" />
                      <span className="text-right leading-tight">{child.label}</span>
                    </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function SalesOverview({
  onSelect, settings, onSettingsChange,
}: {
  onSelect: (id: MenuId) => void;
  settings: DashboardSettings;
  onSettingsChange: (key: DashboardWidgetKey, val: boolean) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const gearBtnRef = useRef<HTMLButtonElement>(null);

  const allStats = [
    { key: "todaySales"   as DashboardWidgetKey, label: "مبيعات اليوم",   value: "12,450", change: "+8%",  color: "text-emerald-500", icon: TrendingUp },
    { key: "invoiceCount" as DashboardWidgetKey, label: "عدد الفواتير",   value: "47",      change: "+12%", color: "text-blue-500",    icon: Receipt },
    { key: "newCustomers" as DashboardWidgetKey, label: "العملاء الجدد",  value: "5",       change: "+2",   color: "text-purple-500",  icon: Users },
    { key: "avgInvoice"   as DashboardWidgetKey, label: "متوسط الفاتورة", value: "264.9",   change: "-3%",  color: "text-amber-500",   icon: DollarSign },
  ];
  const visibleStats = allStats.filter(s => settings[s.key]);

  const salesData = [
    { day: "السبت",    sales: 8200 }, { day: "الأحد",   sales: 9400 },
    { day: "الاثنين", sales: 11000 }, { day: "الثلاثاء", sales: 9800 },
    { day: "الأربعاء",sales: 12450 }, { day: "الخميس",  sales: 10600 },
    { day: "الجمعة",  sales: 7300 },
  ];

  const recentOps = [
    { id: "INV-2026-0047", customer: "أحمد محمد",   amount: "1,250",  status: "مكتملة",  color: "#10B981" },
    { id: "INV-2026-0046", customer: "شركة النور",   amount: "4,800",  status: "معلقة",   color: "#F59E0B" },
    { id: "INV-2026-0045", customer: "محمد علي",     amount: "760",    status: "مكتملة",  color: "#10B981" },
    { id: "INV-2026-0044", customer: "مؤسسة الفجر",  amount: "12,300", status: "مكتملة",  color: "#10B981" },
  ];

  const colsClass = visibleStats.length === 4 ? "grid-cols-2 lg:grid-cols-4"
                   : visibleStats.length === 3 ? "grid-cols-3"
                   : visibleStats.length === 2 ? "grid-cols-2"
                   : "grid-cols-1";

  return (
    <div className="space-y-5">

      {/* ── العنوان + زر الإعدادات ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "rgba(37,99,235,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <TrendingUp style={{ width: 16, height: 16, color: "#2563EB" }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827", fontFamily: "'Cairo', Tahoma, sans-serif" }}>
              المبيعات
            </h2>
            <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF", fontFamily: "'Cairo', Tahoma, sans-serif" }}>
              لوحة تحكم المبيعات
            </p>
          </div>
        </div>

        {/* زر الإعدادات */}
        <div style={{ position: "relative" }}>
          <button
            ref={gearBtnRef}
            onClick={() => setSettingsOpen(p => !p)}
            title="إعدادات لوحة التحكم"
            style={{
              width: 32, height: 32, borderRadius: 7,
              border: `1px solid ${settingsOpen ? "#2563EB" : "#E5E7EB"}`,
              background: settingsOpen ? "#EFF6FF" : "#fff",
              cursor: "pointer", color: settingsOpen ? "#2563EB" : "#6B7280",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              if (!settingsOpen) {
                e.currentTarget.style.borderColor = "#2563EB";
                e.currentTarget.style.color = "#2563EB";
                e.currentTarget.style.background = "#EFF6FF";
              }
            }}
            onMouseLeave={e => {
              if (!settingsOpen) {
                e.currentTarget.style.borderColor = "#E5E7EB";
                e.currentTarget.style.color = "#6B7280";
                e.currentTarget.style.background = "#fff";
              }
            }}
          >
            <Settings style={{ width: 15, height: 15, pointerEvents: "none" }} />
          </button>

          {settingsOpen && (
            <DashboardSettingsPanel
              settings={settings}
              onChange={onSettingsChange}
              onClose={() => setSettingsOpen(false)}
              anchorRef={gearBtnRef}
            />
          )}
        </div>
      </div>

      {/* ── بطاقات الإحصائيات ── */}
      {visibleStats.length > 0 && (
        <div className={`grid ${colsClass} gap-3`}>
          {visibleStats.map(s => (
            <Card key={s.label} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                  <span className="text-xs text-muted-foreground">{s.change}</span>
                </div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── الرسم البياني ── */}
      {settings.chart && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">مبيعات الأسبوع الحالي</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                <Bar dataKey="sales" fill="hsl(var(--primary))" name="المبيعات" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── التنبيهات ── */}
      {settings.alerts && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              التنبيهات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { msg: "فاتورة INV-2026-0046 معلقة منذ يومين", color: "#F59E0B" },
              { msg: "رصيد العميل شركة النور تجاوز حد الائتمان", color: "#EF4444" },
              { msg: "3 عروض أسعار على وشك الانتهاء", color: "#3B82F6" },
            ].map((a, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "7px 10px", borderRadius: 7,
                background: `${a.color}10`,
                border: `1px solid ${a.color}30`,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#374151", fontFamily: "'Cairo', Tahoma, sans-serif" }}>{a.msg}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── آخر العمليات ── */}
      {settings.recentOps && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              آخر العمليات
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'Cairo', Tahoma, sans-serif" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    {["رقم الفاتورة", "العميل", "المبلغ", "الحالة"].map(h => (
                      <th key={h} style={{ padding: "8px 16px", textAlign: "right", color: "#9CA3AF", fontWeight: 500, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentOps.map((op, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F9FAFB" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "8px 16px", color: "#2563EB", fontWeight: 500 }}>{op.id}</td>
                      <td style={{ padding: "8px 16px", color: "#374151" }}>{op.customer}</td>
                      <td style={{ padding: "8px 16px", color: "#111827", fontWeight: 600 }}>{op.amount}</td>
                      <td style={{ padding: "8px 16px" }}>
                        <span style={{
                          display: "inline-block", padding: "2px 10px", borderRadius: 20,
                          fontSize: 11, fontWeight: 500,
                          background: `${op.color}15`, color: op.color,
                          border: `1px solid ${op.color}30`,
                        }}>{op.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── الإحصائيات (روابط سريعة) ── */}
      {settings.stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {menuSections.map(group => (
            <Card key={group.id} className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                  <group.icon className="w-3.5 h-3.5 text-primary" />
                  {group.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {group.children.map(item => (
                  <button key={item.id} onClick={() => onSelect(item.id)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors">
                    <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                    {item.label}
                  </button>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
}

// ─── Sales Invoice ─────────────────────────────────────────────────────────────

function SalesInvoicePage() {
  const [items, setItems] = useState<{ id: number; name: string; qty: number; price: number; discount: number }[]>([]);
  const [search, setSearch] = useState("");
  const { data: products } = trpc.products.list.useQuery({ search });

  const addItem = (p: any) => {
    setItems(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, qty: 1, price: Number(p.salePrice), discount: 0 }];
    });
    setSearch("");
  };

  const subtotal = items.reduce((s, i) => s + i.qty * i.price * (1 - i.discount / 100), 0);
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" /> فاتورة مبيعات جديدة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">رقم الفاتورة</Label>
                <Input defaultValue="INV-2026-0001" className="h-8 text-sm" readOnly />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">التاريخ</Label>
                <Input type="date" defaultValue={new Date().toISOString().split("T")[0]} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">العميل</Label>
                <Select>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="اختر عميل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk-in">عميل نقدي</SelectItem>
                    <SelectItem value="1">أحمد محمد</SelectItem>
                    <SelectItem value="2">شركة النور</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">طريقة الدفع</Label>
                <Select defaultValue="cash">
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="card">بطاقة</SelectItem>
                    <SelectItem value="transfer">تحويل</SelectItem>
                    <SelectItem value="credit">آجل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute right-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="بحث عن صنف بالاسم أو الباركود..." value={search}
                onChange={e => setSearch(e.target.value)} className="h-8 text-sm pr-8" />
            </div>
            {search && products && products.length > 0 && (
              <div className="border border-border rounded-lg max-h-36 overflow-y-auto bg-card shadow-lg">
                {products.map((p: any) => (
                  <button key={p.id} onClick={() => addItem(p)}
                    className="w-full text-right px-3 py-2 text-sm hover:bg-accent/50 flex justify-between items-center border-b border-border/30 last:border-0">
                    <span className="text-foreground">{p.name}</span>
                    <span className="text-primary font-medium">{Number(p.salePrice).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">الصنف</TableHead>
                <TableHead className="text-xs text-center w-20">الكمية</TableHead>
                <TableHead className="text-xs text-center w-24">السعر</TableHead>
                <TableHead className="text-xs text-center w-20">خصم%</TableHead>
                <TableHead className="text-xs text-center w-24">الإجمالي</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">ابحث وأضف أصناف للفاتورة</TableCell></TableRow>
              )}
              {items.map((item, i) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm font-medium">{item.name}</TableCell>
                  <TableCell className="text-center">
                    <Input type="number" value={item.qty} min={1}
                      onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: +e.target.value } : it))}
                      className="h-7 w-16 text-center text-sm mx-auto" />
                  </TableCell>
                  <TableCell className="text-center text-sm">{item.price.toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    <Input type="number" value={item.discount} min={0} max={100}
                      onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, discount: +e.target.value } : it))}
                      className="h-7 w-16 text-center text-sm mx-auto" />
                  </TableCell>
                  <TableCell className="text-center text-primary font-semibold text-sm">
                    {(item.qty * item.price * (1 - item.discount / 100)).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-destructive hover:text-destructive/70 text-xs">حذف</button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">ملخص الفاتورة</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">المجموع</span><span>{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">الضريبة (15%)</span><span>{tax.toFixed(2)}</span></div>
            <div className="border-t border-border pt-2 flex justify-between font-bold">
              <span>الإجمالي</span>
              <span className="text-primary text-lg">{total.toFixed(2)}</span>
            </div>
            <Button className="w-full h-9" onClick={() => toast.success("تم حفظ الفاتورة بنجاح")}>
              <CheckCircle className="w-4 h-4 ml-2" /> حفظ الفاتورة
            </Button>
            <Button variant="outline" className="w-full h-9" onClick={() => toast.info("جاري الطباعة...")}>
              <Printer className="w-4 h-4 ml-2" /> طباعة
            </Button>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">ملاحظات</CardTitle></CardHeader>
          <CardContent>
            <Textarea placeholder="ملاحظات الفاتورة..." className="resize-none h-20 text-sm" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Customers Page ────────────────────────────────────────────────────────────

function CustomersPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { data: customers, refetch } = trpc.customers.list.useQuery({ search });
  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => { toast.success("تم إضافة العميل"); setOpen(false); refetch(); }
  });
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث عن عميل..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 h-9" />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-9 text-sm"><Plus className="w-4 h-4 ml-1" /> إضافة عميل</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إضافة عميل جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {[["name","الاسم"],["phone","الهاتف"],["email","البريد الإلكتروني"],["address","العنوان"]].map(([k,l]) => (
                <div key={k}>
                  <Label className="text-xs text-muted-foreground">{l}</Label>
                  <Input value={(form as any)[k]} onChange={e => setForm(p => ({...p,[k]:e.target.value}))} className="h-8 text-sm" />
                </div>
              ))}
              <Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>حفظ</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">الاسم</TableHead>
              <TableHead className="text-xs">الهاتف</TableHead>
              <TableHead className="text-xs">البريد</TableHead>
              <TableHead className="text-xs text-center">الرصيد</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers?.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="text-sm font-medium">{c.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.phone || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.email || "-"}</TableCell>
                <TableCell className="text-center">
                  <span className={`text-sm font-semibold ${Number(c.balance) >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {Number(c.balance || 0).toFixed(2)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary hover:text-primary/70 text-xs">تعديل</button>
                    <button className="text-muted-foreground hover:text-foreground text-xs">كشف حساب</button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!customers?.length && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا يوجد عملاء</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Shifts Page ───────────────────────────────────────────────────────────────

function ShiftsPage() {
  const shifts = [
    { id: 1, name: "الوردية الصباحية", start: "08:00", end: "16:00", cashier: "أحمد محمد", status: "مغلقة", sales: 12500 },
    { id: 2, name: "الوردية المسائية", start: "16:00", end: "00:00", cashier: "محمد علي", status: "مفتوحة", sales: 8300 },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">إدارة الورديات</h3>
        <Button className="h-8 text-sm" onClick={() => toast.success("تم فتح وردية جديدة")}>
          <Plus className="w-4 h-4 ml-1" /> فتح وردية
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shifts.map(s => (
          <Card key={s.id} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-sm">{s.name}</p>
                  <p className="text-muted-foreground text-xs">{s.cashier}</p>
                </div>
                <Badge variant={s.status === "مفتوحة" ? "default" : "secondary"}>{s.status}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[["البداية", s.start], ["النهاية", s.end], ["المبيعات", s.sales.toLocaleString()]].map(([l, v]) => (
                  <div key={l} className="bg-muted/30 rounded p-2">
                    <p className="text-muted-foreground text-xs">{l}</p>
                    <p className="font-semibold text-sm">{v}</p>
                  </div>
                ))}
              </div>
              {s.status === "مفتوحة" && (
                <Button variant="destructive" className="w-full mt-3 h-8 text-sm" onClick={() => toast.success("تم إغلاق الوردية")}>
                  إغلاق الوردية
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Payment Methods ───────────────────────────────────────────────────────────

function PaymentMethodsPage() {
  const [methods, setMethods] = useState([
    { name: "نقدي",          icon: "💵", active: true  },
    { name: "بطاقة ائتمان",  icon: "💳", active: true  },
    { name: "تحويل بنكي",    icon: "🏦", active: true  },
    { name: "آجل",           icon: "📋", active: true  },
    { name: "شيك",           icon: "📄", active: false },
  ]);
  const toggle = (name: string) => setMethods(prev => prev.map(m => m.name === name ? { ...m, active: !m.active } : m));
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">طرق السداد المتاحة</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {methods.map(m => (
          <Card key={m.name} className={`border-border/50 ${!m.active ? "opacity-60" : ""}`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{m.icon}</span>
                <p className="font-medium text-sm">{m.name}</p>
              </div>
              <button
                onClick={() => toggle(m.name)}
                className={`w-10 h-5 rounded-full transition-colors relative ${m.active ? "bg-primary" : "bg-muted"}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${m.active ? "right-0.5" : "left-0.5"}`} />
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Sales Totals Report ───────────────────────────────────────────────────────

const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function getPreset(preset: string): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const today = fmt(now);
  if (preset === "today")  return { from: today, to: today };
  if (preset === "week") {
    const d = new Date(now); d.setDate(now.getDate() - 6);
    return { from: fmt(d), to: today };
  }
  if (preset === "month") {
    return { from: `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`, to: today };
  }
  if (preset === "year")  return { from: `${now.getFullYear()}-01-01`, to: today };
  if (preset === "lastyear") {
    const y = now.getFullYear() - 1;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  return { from: `${now.getFullYear()}-01-01`, to: today };
}

function SalesTotalsReports() {
  const [preset, setPreset] = useState("year");
  const [dateFrom, setDateFrom] = useState(() => getPreset("year").from);
  const [dateTo,   setDateTo]   = useState(() => getPreset("year").to);
  const [tab, setTab] = useState<"summary" | "monthly" | "customer">("summary");

  const applyPreset = (p: string) => {
    setPreset(p);
    const { from, to } = getPreset(p);
    setDateFrom(from); setDateTo(to);
  };

  const { data: rows = [], isLoading, refetch } = trpc.salesInvoices.list.useQuery({
    dateFrom, dateTo, limit: 2000,
  });

  // ── تجميع البيانات ──────────────────────────────────────────────
  const sales   = rows.filter(r => r.invoiceType === "sale");
  const returns = rows.filter(r => r.invoiceType === "return");

  const sum = (arr: typeof rows) => arr.reduce((s, r) => s + parseFloat(r.total ?? "0"), 0);
  const sumPaid = (arr: typeof rows) => arr.reduce((s, r) => s + parseFloat(r.paidAmount ?? "0"), 0);
  const sumRemain = (arr: typeof rows) => arr.reduce((s, r) => s + parseFloat(r.remainingAmount ?? "0"), 0);

  const totalSales   = sum(sales);
  const totalReturns = sum(returns);
  const netSales     = totalSales - totalReturns;
  const totalPaid    = sumPaid(sales);
  const totalRemain  = sumRemain(sales);
  const avgInvoice   = sales.length > 0 ? totalSales / sales.length : 0;

  const fmtNum = (n: number) => n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── بيانات رسم شهري ─────────────────────────────────────────────
  const monthlyMap: Record<string, { label: string; sales: number; returns: number; count: number }> = {};
  rows.forEach(r => {
    const d = new Date(r.invoiceDate);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label = `${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (!monthlyMap[key]) monthlyMap[key] = { label, sales: 0, returns: 0, count: 0 };
    const v = parseFloat(r.total ?? "0");
    if (r.invoiceType === "sale")   { monthlyMap[key].sales += v; monthlyMap[key].count++; }
    if (r.invoiceType === "return") { monthlyMap[key].returns += v; }
  });
  const monthlyData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ ...v, net: v.sales - v.returns }));

  // ── بيانات بالعميل ─────────────────────────────────────────────
  const customerMap: Record<string, { name: string; total: number; count: number; paid: number; remain: number }> = {};
  sales.forEach(r => {
    const name = r.customerName || "غير محدد";
    if (!customerMap[name]) customerMap[name] = { name, total: 0, count: 0, paid: 0, remain: 0 };
    customerMap[name].total  += parseFloat(r.total ?? "0");
    customerMap[name].paid   += parseFloat(r.paidAmount ?? "0");
    customerMap[name].remain += parseFloat(r.remainingAmount ?? "0");
    customerMap[name].count++;
  });
  const customerData = Object.values(customerMap).sort((a, b) => b.total - a.total);

  const PRESETS = [
    { id: "today",    label: "اليوم" },
    { id: "week",     label: "آخر 7 أيام" },
    { id: "month",    label: "هذا الشهر" },
    { id: "year",     label: "هذه السنة" },
    { id: "lastyear", label: "السنة الماضية" },
  ];

  const KPI_TABS = [
    { id: "summary",  label: "ملخص" },
    { id: "monthly",  label: "بالشهر" },
    { id: "customer", label: "بالعميل" },
  ];

  const tooltipStyle = {
    backgroundColor: "#fff", border: "1px solid #E5E7EB",
    borderRadius: 8, fontSize: 12, fontFamily: "'Cairo', Tahoma, sans-serif",
    direction: "rtl" as const,
  };

  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "'Cairo', Tahoma, sans-serif" }}>

      {/* ── شريط الفلاتر ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        padding: "10px 14px", background: "#F9FAFB",
        border: "1px solid #E5E7EB", borderRadius: 10,
      }}>
        {/* عنوان */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(37,99,235,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarChart3 style={{ width: 14, height: 14, color: "#2563EB" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>تقارير إجماليات المبيعات</span>
        </div>

        {/* أزرار الفترة */}
        <div style={{ display: "flex", gap: 4 }}>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => applyPreset(p.id)}
              style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 11.5, cursor: "pointer",
                border: preset === p.id ? "1px solid #2563EB" : "1px solid #E5E7EB",
                background: preset === p.id ? "#EFF6FF" : "#fff",
                color: preset === p.id ? "#2563EB" : "#6B7280",
                fontWeight: preset === p.id ? 700 : 400,
                fontFamily: "'Cairo', Tahoma, sans-serif",
              }}
            >{p.label}</button>
          ))}
        </div>

        {/* تاريخ يدوي */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>من</span>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset("custom"); }}
            style={{ padding: "3px 7px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 11.5 }} />
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>إلى</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreset("custom"); }}
            style={{ padding: "3px 7px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 11.5 }} />
        </div>

        <button onClick={() => refetch()} title="تحديث"
          style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#F3F4F6")}
          onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
        >
          <RefreshCw style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* ── بطاقات KPI ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          { label: "إجمالي المبيعات",  value: fmtNum(totalSales),   sub: `${sales.length} فاتورة`,        icon: TrendingUp, color: "#059669", bg: "#F0FDF4" },
          { label: "إجمالي المرتجعات", value: fmtNum(totalReturns), sub: `${returns.length} مردود`,       icon: RotateCcw,  color: "#DC2626", bg: "#FEF2F2" },
          { label: "صافي المبيعات",    value: fmtNum(netSales),     sub: "المبيعات − المرتجعات",           icon: BarChart3,  color: "#2563EB", bg: "#EFF6FF" },
          { label: "متوسط الفاتورة",   value: fmtNum(avgInvoice),   sub: "لكل فاتورة مبيعات",              icon: Receipt,    color: "#7C3AED", bg: "#F5F3FF" },
          { label: "المحصَّل",          value: fmtNum(totalPaid),    sub: "مبالغ مدفوعة",                  icon: CheckCircle,color: "#059669", bg: "#F0FDF4" },
          { label: "المتبقي",           value: fmtNum(totalRemain),  sub: "مبالغ غير محصَّلة",              icon: Clock,      color: totalRemain > 0 ? "#D97706" : "#6B7280", bg: totalRemain > 0 ? "#FFFBEB" : "#F9FAFB" },
        ].map(k => (
          <div key={k.label} style={{
            padding: "12px 14px", borderRadius: 10, border: "1px solid #E5E7EB",
            background: k.bg, display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `${k.color}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <k.icon style={{ width: 18, height: 18, color: k.color }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 2 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{isLoading ? "..." : k.value}</div>
              <div style={{ fontSize: 10.5, color: "#9CA3AF", marginTop: 2 }}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── تبويبات التقرير ── */}
      <div style={{ display: "flex", borderBottom: "2px solid #E5E7EB", gap: 0 }}>
        {KPI_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{
              padding: "8px 18px", fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? "#2563EB" : "#6B7280",
              background: "transparent", border: "none", cursor: "pointer",
              borderBottom: tab === t.id ? "2px solid #2563EB" : "2px solid transparent",
              marginBottom: -2, fontFamily: "'Cairo', Tahoma, sans-serif",
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ── تبويب: ملخص ── */}
      {tab === "summary" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* رسم شهري */}
          <div style={{ padding: 16, border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 12 }}>المبيعات والمرتجعات حسب الشهر</div>
            {isLoading ? (
              <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF" }}>جاري التحميل...</div>
            ) : monthlyData.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF" }}>لا توجد بيانات للفترة المختارة</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="label" tick={{ fill: "#6B7280", fontSize: 11, fontFamily: "'Cairo', Tahoma, sans-serif" }} />
                  <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => [fmtNum(v), n === "sales" ? "المبيعات" : n === "returns" ? "المرتجعات" : "الصافي"]} />
                  <Legend formatter={v => v === "sales" ? "المبيعات" : v === "returns" ? "المرتجعات" : "الصافي"} />
                  <Bar dataKey="sales"   name="sales"   fill="#2563EB" radius={[4,4,0,0]} />
                  <Bar dataKey="returns" name="returns" fill="#EF4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* رسم صافي المبيعات */}
          {monthlyData.length > 0 && (
            <div style={{ padding: 16, border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 12 }}>اتجاه صافي المبيعات</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="label" tick={{ fill: "#6B7280", fontSize: 11, fontFamily: "'Cairo', Tahoma, sans-serif" }} />
                  <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtNum(v), "صافي المبيعات"]} />
                  <Line type="monotone" dataKey="net" name="net" stroke="#059669" strokeWidth={2.5} dot={{ r: 4, fill: "#059669" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── تبويب: بالشهر ── */}
      {tab === "monthly" && (
        <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F3F4F6" }}>
                {["الشهر", "عدد الفواتير", "إجمالي المبيعات", "المرتجعات", "الصافي"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "right", color: "#6B7280", fontWeight: 600, fontSize: 12, borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "#9CA3AF" }}>جاري التحميل...</td></tr>
              ) : monthlyData.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "#9CA3AF" }}>لا توجد بيانات</td></tr>
              ) : (
                <>
                  {monthlyData.map((m, i) => (
                    <tr key={m.label} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#EFF6FF")}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#FAFAFA")}
                    >
                      <td style={{ padding: "9px 14px", color: "#374151", fontWeight: 600 }}>{m.label}</td>
                      <td style={{ padding: "9px 14px", color: "#6B7280" }}>{m.count}</td>
                      <td style={{ padding: "9px 14px", color: "#2563EB", fontWeight: 600, direction: "ltr", textAlign: "right" }}>{fmtNum(m.sales)}</td>
                      <td style={{ padding: "9px 14px", color: "#DC2626", direction: "ltr", textAlign: "right" }}>{fmtNum(m.returns)}</td>
                      <td style={{ padding: "9px 14px", color: "#059669", fontWeight: 700, direction: "ltr", textAlign: "right" }}>{fmtNum(m.net)}</td>
                    </tr>
                  ))}
                  {/* سطر الإجمالي */}
                  <tr style={{ background: "#F3F4F6", fontWeight: 700, borderTop: "2px solid #E5E7EB" }}>
                    <td style={{ padding: "9px 14px", color: "#111827" }}>الإجمالي</td>
                    <td style={{ padding: "9px 14px", color: "#374151" }}>{sales.length}</td>
                    <td style={{ padding: "9px 14px", color: "#2563EB", direction: "ltr", textAlign: "right" }}>{fmtNum(totalSales)}</td>
                    <td style={{ padding: "9px 14px", color: "#DC2626", direction: "ltr", textAlign: "right" }}>{fmtNum(totalReturns)}</td>
                    <td style={{ padding: "9px 14px", color: "#059669", direction: "ltr", textAlign: "right" }}>{fmtNum(netSales)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── تبويب: بالعميل ── */}
      {tab === "customer" && (
        <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F3F4F6" }}>
                {["#", "العميل", "عدد الفواتير", "إجمالي المبيعات", "المحصَّل", "المتبقي", "نسبة الإجمالي"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "right", color: "#6B7280", fontWeight: 600, fontSize: 12, borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#9CA3AF" }}>جاري التحميل...</td></tr>
              ) : customerData.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#9CA3AF" }}>لا توجد بيانات</td></tr>
              ) : (
                <>
                  {customerData.map((c, i) => {
                    const pct = totalSales > 0 ? (c.total / totalSales) * 100 : 0;
                    return (
                      <tr key={c.name} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#EFF6FF")}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#FAFAFA")}
                      >
                        <td style={{ padding: "9px 14px", color: "#9CA3AF", fontSize: 12 }}>{i+1}</td>
                        <td style={{ padding: "9px 14px", color: "#374151", fontWeight: 600 }}>{c.name}</td>
                        <td style={{ padding: "9px 14px", color: "#6B7280" }}>{c.count}</td>
                        <td style={{ padding: "9px 14px", color: "#2563EB", fontWeight: 600, direction: "ltr", textAlign: "right" }}>{fmtNum(c.total)}</td>
                        <td style={{ padding: "9px 14px", color: "#059669", direction: "ltr", textAlign: "right" }}>{fmtNum(c.paid)}</td>
                        <td style={{ padding: "9px 14px", color: c.remain > 0 ? "#DC2626" : "#6B7280", direction: "ltr", textAlign: "right" }}>{fmtNum(c.remain)}</td>
                        <td style={{ padding: "9px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#E5E7EB", overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: "#2563EB", borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, color: "#6B7280", minWidth: 32 }}>{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* سطر الإجمالي */}
                  <tr style={{ background: "#F3F4F6", fontWeight: 700, borderTop: "2px solid #E5E7EB" }}>
                    <td style={{ padding: "9px 14px" }} />
                    <td style={{ padding: "9px 14px", color: "#111827" }}>الإجمالي</td>
                    <td style={{ padding: "9px 14px", color: "#374151" }}>{sales.length}</td>
                    <td style={{ padding: "9px 14px", color: "#2563EB", direction: "ltr", textAlign: "right" }}>{fmtNum(totalSales)}</td>
                    <td style={{ padding: "9px 14px", color: "#059669", direction: "ltr", textAlign: "right" }}>{fmtNum(totalPaid)}</td>
                    <td style={{ padding: "9px 14px", color: totalRemain > 0 ? "#DC2626" : "#6B7280", direction: "ltr", textAlign: "right" }}>{fmtNum(totalRemain)}</td>
                    <td style={{ padding: "9px 14px" }} />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Sales Invoices Period Report ─────────────────────────────────────────────

type SortMode    = "document" | "warehouse" | "customer";
type DisplayMode = "totals" | "details";

function SalesInvoicesReport() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const firstOfMonth = `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`;
  const today = fmt(now);

  // ── حالة الفلاتر ──
  const [dateFrom,       setDateFrom]       = useState(firstOfMonth);
  const [dateTo,         setDateTo]         = useState(today);
  const [showReturns,    setShowReturns]    = useState(true);
  const [selectedWh,     setSelectedWh]     = useState<string>("all");
  const [customerSearch, setCustomerSearch] = useState("");
  const [sortMode,       setSortMode]       = useState<SortMode>("document");
  const [displayMode,    setDisplayMode]    = useState<DisplayMode>("totals");

  const [queryInput, setQueryInput] = useState<{
    dateFrom: string; dateTo: string;
    warehouseId?: number; customerSearch?: string;
    excludeReturns: boolean; limit: number;
  } | null>(null);

  const { data: warehouses = [] } = trpc.warehouses.list.useQuery();

  const { data: rows = [], isFetching, isLoading } = trpc.salesInvoices.list.useQuery(
    queryInput ?? { dateFrom, dateTo, limit: 2000 },
    { enabled: queryInput !== null }
  );

  const handleRun = () => {
    setQueryInput({
      dateFrom, dateTo,
      warehouseId: selectedWh !== "all" ? parseInt(selectedWh) : undefined,
      customerSearch: customerSearch.trim() || undefined,
      excludeReturns: !showReturns,
      limit: 2000,
    });
  };

  const loading = isFetching || isLoading;

  // ── أدوات مشتركة ──
  const fmtNum = (n: number) =>
    n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d: string | Date) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
  };

  const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    sale:   { label: "فاتورة مبيعات", color: "#059669", bg: "#ECFDF5" },
    return: { label: "مردود مبيعات",  color: "#DC2626", bg: "#FEF2F2" },
    quote:  { label: "عرض سعر",       color: "#7C3AED", bg: "#F5F3FF" },
  };

  const whMap: Record<number, string> = {};
  warehouses.forEach((w: any) => { whMap[w.id] = w.name; });

  // ── إجماليات كلية ──
  const sales        = rows.filter(r => r.invoiceType === "sale");
  const returns      = rows.filter(r => r.invoiceType === "return");
  const totalSales   = sales.reduce((s, r)   => s + parseFloat(r.total ?? "0"), 0);
  const totalReturns = returns.reduce((s, r) => s + parseFloat(r.total ?? "0"), 0);
  const totalPaid    = sales.reduce((s, r)   => s + parseFloat(r.paidAmount ?? "0"), 0);
  const totalRemain  = sales.reduce((s, r)   => s + parseFloat(r.remainingAmount ?? "0"), 0);
  const netSales     = totalSales - totalReturns;

  // ── تجميع حسب المخزن ──
  type GroupEntry = { key: string; label: string; items: typeof rows; salesTotal: number; returnsTotal: number; net: number; paid: number; remain: number; count: number };
  const buildGroups = (getKey: (r: typeof rows[0]) => string, getLabel: (r: typeof rows[0]) => string): GroupEntry[] => {
    const map: Record<string, GroupEntry> = {};
    rows.forEach(r => {
      const key   = getKey(r);
      const label = getLabel(r);
      if (!map[key]) map[key] = { key, label, items: [], salesTotal: 0, returnsTotal: 0, net: 0, paid: 0, remain: 0, count: 0 };
      const v = parseFloat(r.total ?? "0");
      map[key].items.push(r);
      if (r.invoiceType === "sale")   { map[key].salesTotal += v; map[key].paid += parseFloat(r.paidAmount ?? "0"); map[key].remain += parseFloat(r.remainingAmount ?? "0"); map[key].count++; }
      if (r.invoiceType === "return") { map[key].returnsTotal += v; }
      map[key].net = map[key].salesTotal - map[key].returnsTotal;
    });
    return Object.values(map).sort((a, b) => b.salesTotal - a.salesTotal);
  };

  const warehouseGroups = buildGroups(
    r => r.warehouseId ? String(r.warehouseId) : "none",
    r => r.warehouseId ? (whMap[r.warehouseId] ?? `مخزن #${r.warehouseId}`) : "بدون مخزن"
  );
  const customerGroups = buildGroups(
    r => r.customerName || "unknown",
    r => r.customerName || "غير محدد"
  );

  // ── أنماط CSS مشتركة ──
  const inputStyle: React.CSSProperties = {
    padding: "5px 10px", border: "1px solid #D1D5DB", borderRadius: 7,
    fontSize: 12.5, fontFamily: "'Cairo', Tahoma, sans-serif",
    color: "#374151", background: "#fff", outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11.5, color: "#6B7280", fontWeight: 600, marginBottom: 3,
    fontFamily: "'Cairo', Tahoma, sans-serif",
  };
  const thStyle: React.CSSProperties = {
    padding: "9px 12px", textAlign: "right", color: "#6B7280",
    fontWeight: 600, fontSize: 11.5, borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap",
    background: "#F3F4F6",
  };

  const hasRun = queryInput !== null;

  // ── مكوِّن صف سجل فاتورة ──
  const InvoiceRow = ({ r, i }: { r: typeof rows[0]; i: number }) => {
    const typeInfo = TYPE_LABELS[r.invoiceType] ?? { label: r.invoiceType, color: "#6B7280", bg: "#F9FAFB" };
    const total  = parseFloat(r.total ?? "0");
    const paid   = parseFloat(r.paidAmount ?? "0");
    const remain = parseFloat(r.remainingAmount ?? "0");
    const whName = r.warehouseId ? (whMap[r.warehouseId] ?? `#${r.warehouseId}`) : "—";
    return (
      <tr style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}
        onMouseEnter={e => (e.currentTarget.style.background = "#EFF6FF")}
        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#FAFAFA")}
      >
        <td style={{ padding: "8px 12px", color: "#9CA3AF", fontSize: 11 }}>{i + 1}</td>
        <td style={{ padding: "8px 12px", color: "#2563EB", fontWeight: 700, direction: "ltr" }}>{r.invoiceNumber}</td>
        <td style={{ padding: "8px 12px", color: "#374151", direction: "ltr" }}>{fmtDate(r.invoiceDate)}</td>
        <td style={{ padding: "8px 12px" }}>
          <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, background: typeInfo.bg, color: typeInfo.color, fontWeight: 600 }}>{typeInfo.label}</span>
        </td>
        <td style={{ padding: "8px 12px", color: "#374151" }}>{r.customerName || "—"}</td>
        <td style={{ padding: "8px 12px", color: "#6B7280" }}>{whName}</td>
        <td style={{ padding: "8px 12px", color: typeInfo.color, fontWeight: 700, direction: "ltr", textAlign: "right" }}>{fmtNum(total)}</td>
        <td style={{ padding: "8px 12px", color: "#059669", direction: "ltr", textAlign: "right" }}>{fmtNum(paid)}</td>
        <td style={{ padding: "8px 12px", color: remain > 0 ? "#D97706" : "#9CA3AF", direction: "ltr", textAlign: "right" }}>{fmtNum(remain)}</td>
      </tr>
    );
  };

  // ── Toggle مساعد ──
  const Toggle = ({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) => (
    <div onClick={onChange} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
      <div style={{
        width: 36, height: 20, borderRadius: 10,
        background: value ? "#2563EB" : "#D1D5DB",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 2, width: 16, height: 16, borderRadius: "50%",
          background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
          transition: "left 0.2s", left: value ? 18 : 2,
        }} />
      </div>
      <span style={{ fontSize: 12.5, color: "#374151", fontFamily: "'Cairo', Tahoma, sans-serif" }}>{label}</span>
    </div>
  );

  const SORT_OPTIONS: { id: SortMode; label: string }[] = [
    { id: "document",  label: "حسب المستند" },
    { id: "warehouse", label: "حسب المخزن" },
    { id: "customer",  label: "حسب العميل" },
  ];

  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: "'Cairo', Tahoma, sans-serif" }}>

      {/* ── لوحة الفلاتر ── */}
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, background: "#F9FAFB", overflow: "hidden" }}>
        {/* رأس */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #E5E7EB", background: "#fff" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileText style={{ width: 16, height: 16, color: "#2563EB" }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>تقرير فواتير ومردودات المبيعات خلال فترة</div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>اختر الفلاتر ونوع الفرز ثم اضغط «تشغيل التقرير»</div>
          </div>
        </div>

        {/* الصف الأول من الفلاتر */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: "14px 16px 10px", alignItems: "flex-end" }}>

          {/* من تاريخ */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={labelStyle}>من تاريخ</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, width: 140 }} />
          </div>
          {/* إلى تاريخ */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={labelStyle}>إلى تاريخ</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inputStyle, width: 140 }} />
          </div>

          {/* المخزن */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={labelStyle}>المخزن</span>
            <select value={selectedWh} onChange={e => setSelectedWh(e.target.value)} style={{ ...inputStyle, width: 170, cursor: "pointer" }}>
              <option value="all">كل المخازن</option>
              {warehouses.map((w: any) => (
                <option key={w.id} value={String(w.id)}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* بحث بالعميل */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={labelStyle}>حسب كود / اسم العميل</span>
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "#9CA3AF" }} />
              <input type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRun()}
                placeholder="اسم أو كود العميل..."
                style={{ ...inputStyle, width: 185, paddingRight: 28 }}
              />
            </div>
          </div>

          {/* إظهار المردودات */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 4 }}>
            <Toggle value={showReturns} onChange={() => setShowReturns(v => !v)} label="إظهار المردودات" />
          </div>
        </div>

        {/* الصف الثاني: نوع الفرز + طريقة العرض + زر التشغيل */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: "0 16px 14px", alignItems: "flex-end" }}>

          {/* نوع الفرز */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={labelStyle}>نوع الفرز</span>
            <div style={{ display: "flex", gap: 0, border: "1px solid #D1D5DB", borderRadius: 8, overflow: "hidden" }}>
              {SORT_OPTIONS.map((opt, idx) => (
                <button key={opt.id} onClick={() => setSortMode(opt.id)}
                  style={{
                    padding: "5px 14px", fontSize: 12.5, cursor: "pointer",
                    border: "none",
                    borderRight: idx < SORT_OPTIONS.length - 1 ? "1px solid #D1D5DB" : "none",
                    background: sortMode === opt.id ? "#2563EB" : "#fff",
                    color: sortMode === opt.id ? "#fff" : "#374151",
                    fontWeight: sortMode === opt.id ? 700 : 400,
                    fontFamily: "'Cairo', Tahoma, sans-serif",
                    transition: "background 0.15s",
                  }}
                >{opt.label}</button>
              ))}
            </div>
          </div>

          {/* طريقة العرض — تظهر فقط عند حسب المخزن أو حسب العميل */}
          {sortMode !== "document" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={labelStyle}>طريقة العرض</span>
              <div style={{ display: "flex", gap: 0, border: "1px solid #D1D5DB", borderRadius: 8, overflow: "hidden" }}>
                {[
                  { id: "totals" as DisplayMode,  label: "إجماليات فقط" },
                  { id: "details" as DisplayMode, label: "التفاصيل" },
                ].map((opt, idx) => (
                  <button key={opt.id} onClick={() => setDisplayMode(opt.id)}
                    style={{
                      padding: "5px 14px", fontSize: 12.5, cursor: "pointer",
                      border: "none",
                      borderRight: idx === 0 ? "1px solid #D1D5DB" : "none",
                      background: displayMode === opt.id ? "#7C3AED" : "#fff",
                      color: displayMode === opt.id ? "#fff" : "#374151",
                      fontWeight: displayMode === opt.id ? 700 : 400,
                      fontFamily: "'Cairo', Tahoma, sans-serif",
                      transition: "background 0.15s",
                    }}
                  >{opt.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* زر التشغيل */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <button onClick={handleRun} disabled={loading}
              style={{
                padding: "7px 22px", borderRadius: 8, border: "none",
                background: loading ? "#93C5FD" : "#2563EB",
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 7,
                fontFamily: "'Cairo', Tahoma, sans-serif",
                boxShadow: "0 1px 4px rgba(37,99,235,.25)",
              }}
            >
              {loading
                ? <RefreshCw style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                : <Activity style={{ width: 14, height: 14 }} />}
              {loading ? "جاري التحميل..." : "تشغيل التقرير"}
            </button>
          </div>
        </div>
      </div>

      {/* ── حالة ما قبل التشغيل ── */}
      {!hasRun && (
        <div style={{ textAlign: "center", padding: "52px 20px", border: "2px dashed #E5E7EB", borderRadius: 12, color: "#9CA3AF", background: "#FAFAFA" }}>
          <Filter style={{ width: 36, height: 36, margin: "0 auto 10px", opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>اختر الفلاتر واضغط «تشغيل التقرير» لعرض النتائج</div>
        </div>
      )}

      {/* ── نتائج: بطاقات الإجماليات (تظهر دائماً بعد التشغيل) ── */}
      {hasRun && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          {[
            { label: "إجمالي المبيعات",  value: fmtNum(totalSales),   icon: TrendingUp,  color: "#059669", bg: "#ECFDF5", sub: `${sales.length} فاتورة` },
            { label: "إجمالي المرتجعات", value: fmtNum(totalReturns), icon: RotateCcw,   color: "#DC2626", bg: "#FEF2F2", sub: `${returns.length} مردود` },
            { label: "صافي المبيعات",    value: fmtNum(netSales),     icon: BarChart3,   color: "#2563EB", bg: "#EFF6FF", sub: "مبيعات − مرتجعات" },
            { label: "المحصَّل",          value: fmtNum(totalPaid),    icon: CheckCircle, color: "#059669", bg: "#ECFDF5", sub: "مبالغ مدفوعة" },
            { label: "المتبقي",           value: fmtNum(totalRemain),  icon: Clock,       color: totalRemain > 0 ? "#D97706" : "#6B7280", bg: totalRemain > 0 ? "#FFFBEB" : "#F9FAFB", sub: "غير محصَّل" },
          ].map(k => (
            <div key={k.label} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #E5E7EB", background: k.bg, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${k.color}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <k.icon style={{ width: 16, height: 16, color: k.color }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: "#6B7280" }}>{k.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: k.color, direction: "ltr", textAlign: "right" }}>{loading ? "..." : k.value}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>{k.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ── عرض: حسب المستند (القائمة المعتادة) ──
      ══════════════════════════════════════════════════════════════ */}
      {hasRun && sortMode === "document" && (
        <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>الحركات حسب المستند ({rows.length})</span>
            <span style={{ fontSize: 11, color: "#9CA3AF" }}>{dateFrom} — {dateTo}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 800 }}>
              <thead>
                <tr>{["#","رقم المستند","التاريخ","النوع","العميل","المخزن","الإجمالي","المدفوع","المتبقي"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 36, color: "#9CA3AF" }}>جاري التحميل...</td></tr>
                  : rows.length === 0
                    ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}><FileText style={{ width: 28, height: 28, opacity: 0.15, display: "block", margin: "0 auto 6px" }} />لا توجد حركات</td></tr>
                    : rows.map((r, i) => <InvoiceRow key={r.id} r={r} i={i} />)
                }
              </tbody>
              {rows.length > 0 && !loading && (
                <tfoot>
                  <tr style={{ background: "#F3F4F6", fontWeight: 700, borderTop: "2px solid #E5E7EB" }}>
                    <td colSpan={5} style={{ padding: "9px 12px", color: "#111827" }}>الإجمالي — {rows.length} حركة ({sales.length} مبيعات, {returns.length} مردودات)</td>
                    <td style={{ padding: "9px 12px" }} />
                    <td style={{ padding: "9px 12px", color: "#2563EB", direction: "ltr", textAlign: "right" }}>{fmtNum(totalSales)}</td>
                    <td style={{ padding: "9px 12px", color: "#059669", direction: "ltr", textAlign: "right" }}>{fmtNum(totalPaid)}</td>
                    <td style={{ padding: "9px 12px", color: totalRemain > 0 ? "#D97706" : "#9CA3AF", direction: "ltr", textAlign: "right" }}>{fmtNum(totalRemain)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ── عرض: حسب المخزن أو العميل ──
      ══════════════════════════════════════════════════════════════ */}
      {hasRun && (sortMode === "warehouse" || sortMode === "customer") && (() => {
        const groups = sortMode === "warehouse" ? warehouseGroups : customerGroups;
        const groupLabel = sortMode === "warehouse" ? "المخزن" : "العميل";
        const colSpanDetails = 9;

        if (loading) return (
          <div style={{ textAlign: "center", padding: 36, color: "#9CA3AF", border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff" }}>جاري التحميل...</div>
        );
        if (groups.length === 0) return (
          <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF", border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff" }}>لا توجد بيانات</div>
        );

        /* ─ إجماليات فقط ─ */
        if (displayMode === "totals") {
          return (
            <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>إجماليات المبيعات {sortMode === "warehouse" ? "حسب المخزن" : "حسب العميل"}</span>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>{groups.length} {groupLabel}</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      {["#", groupLabel, "عدد الفواتير", "إجمالي المبيعات", "المرتجعات", "صافي المبيعات", "المحصَّل", "المتبقي", "النسبة"].map(h => <th key={h} style={thStyle}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g, i) => {
                      const pct = totalSales > 0 ? (g.salesTotal / totalSales) * 100 : 0;
                      return (
                        <tr key={g.key} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#EFF6FF")}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#FAFAFA")}
                        >
                          <td style={{ padding: "8px 12px", color: "#9CA3AF", fontSize: 11 }}>{i+1}</td>
                          <td style={{ padding: "8px 12px", fontWeight: 700, color: "#374151" }}>{g.label}</td>
                          <td style={{ padding: "8px 12px", color: "#6B7280" }}>{g.count}</td>
                          <td style={{ padding: "8px 12px", color: "#2563EB", fontWeight: 700, direction: "ltr", textAlign: "right" }}>{fmtNum(g.salesTotal)}</td>
                          <td style={{ padding: "8px 12px", color: "#DC2626", direction: "ltr", textAlign: "right" }}>{fmtNum(g.returnsTotal)}</td>
                          <td style={{ padding: "8px 12px", color: "#059669", fontWeight: 700, direction: "ltr", textAlign: "right" }}>{fmtNum(g.net)}</td>
                          <td style={{ padding: "8px 12px", color: "#059669", direction: "ltr", textAlign: "right" }}>{fmtNum(g.paid)}</td>
                          <td style={{ padding: "8px 12px", color: g.remain > 0 ? "#D97706" : "#9CA3AF", direction: "ltr", textAlign: "right" }}>{fmtNum(g.remain)}</td>
                          <td style={{ padding: "8px 12px", minWidth: 120 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#E5E7EB", overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: "#2563EB", borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11, color: "#6B7280", minWidth: 34 }}>{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F3F4F6", fontWeight: 700, borderTop: "2px solid #E5E7EB" }}>
                      <td colSpan={2} style={{ padding: "9px 12px", color: "#111827" }}>الإجمالي ({groups.length} {groupLabel})</td>
                      <td style={{ padding: "9px 12px", color: "#374151" }}>{sales.length}</td>
                      <td style={{ padding: "9px 12px", color: "#2563EB", direction: "ltr", textAlign: "right" }}>{fmtNum(totalSales)}</td>
                      <td style={{ padding: "9px 12px", color: "#DC2626", direction: "ltr", textAlign: "right" }}>{fmtNum(totalReturns)}</td>
                      <td style={{ padding: "9px 12px", color: "#059669", direction: "ltr", textAlign: "right" }}>{fmtNum(netSales)}</td>
                      <td style={{ padding: "9px 12px", color: "#059669", direction: "ltr", textAlign: "right" }}>{fmtNum(totalPaid)}</td>
                      <td style={{ padding: "9px 12px", color: totalRemain > 0 ? "#D97706" : "#9CA3AF", direction: "ltr", textAlign: "right" }}>{fmtNum(totalRemain)}</td>
                      <td style={{ padding: "9px 12px" }} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        }

        /* ─ التفاصيل ─ */
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {groups.map(g => (
              <div key={g.key} style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
                {/* رأس المجموعة */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 14px", background: "linear-gradient(to left, #EFF6FF, #F0FDF4)",
                  borderBottom: "1px solid #BFDBFE",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {sortMode === "warehouse"
                        ? <DollarSign style={{ width: 13, height: 13, color: "#fff" }} />
                        : <Users style={{ width: 13, height: 13, color: "#fff" }} />}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#1E40AF" }}>{g.label}</span>
                    <span style={{ fontSize: 11, color: "#6B7280" }}>({g.items.length} حركة · {g.count} فاتورة مبيعات)</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                    <span style={{ color: "#059669", fontWeight: 700 }}>صافي: <span style={{ direction: "ltr", display: "inline-block" }}>{fmtNum(g.net)}</span></span>
                    {g.remain > 0 && <span style={{ color: "#D97706" }}>متبقي: <span style={{ direction: "ltr", display: "inline-block" }}>{fmtNum(g.remain)}</span></span>}
                  </div>
                </div>
                {/* صفوف التفاصيل */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 800 }}>
                    <thead>
                      <tr>{["#","رقم المستند","التاريخ","النوع","العميل","المخزن","الإجمالي","المدفوع","المتبقي"].map(h => <th key={h} style={{ ...thStyle, background: "#F8FAFF" }}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {g.items.map((r, i) => <InvoiceRow key={r.id} r={r} i={i} />)}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#F3F4F6", fontWeight: 700, borderTop: "2px solid #BFDBFE" }}>
                        <td colSpan={5} style={{ padding: "7px 12px", color: "#374151", fontSize: 12 }}>إجمالي {g.label} — {g.items.length} حركة</td>
                        <td style={{ padding: "7px 12px" }} />
                        <td style={{ padding: "7px 12px", color: "#2563EB", direction: "ltr", textAlign: "right" }}>{fmtNum(g.salesTotal)}</td>
                        <td style={{ padding: "7px 12px", color: "#059669", direction: "ltr", textAlign: "right" }}>{fmtNum(g.paid)}</td>
                        <td style={{ padding: "7px 12px", color: g.remain > 0 ? "#D97706" : "#9CA3AF", direction: "ltr", textAlign: "right" }}>{fmtNum(g.remain)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}
            {/* إجمالي كلي */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, padding: "10px 16px", background: "#1E3A5F", borderRadius: 10, color: "#fff", fontSize: 13 }}>
              <span>الإجمالي الكلي:</span>
              <span style={{ fontWeight: 800 }}>مبيعات: {fmtNum(totalSales)}</span>
              <span style={{ color: "#FCA5A5" }}>مرتجعات: {fmtNum(totalReturns)}</span>
              <span style={{ color: "#6EE7B7", fontWeight: 800 }}>الصافي: {fmtNum(netSales)}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Coming Soon ───────────────────────────────────────────────────────────────

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
      <TrendingUp className="w-14 h-14 opacity-10" />
      <p className="text-lg font-bold text-foreground">{title}</p>
      <p className="text-sm">هذه الشاشة قيد التطوير</p>
      <Badge variant="outline" className="mt-1">قريباً</Badge>
    </div>
  );
}

// ─── Delivery Order ──────────────────────────────────────────────────────────

function DeliveryOrderPage() {
  const [items, setItems] = useState<{ id: number; name: string; orderedQty: number; deliveredQty: number; unit: string }[]>([
    { id: 1, name: "لابتوب Dell XPS 15",     orderedQty: 5,  deliveredQty: 5,  unit: "قطعة" },
    { id: 2, name: "سماعات Sony WH-1000XM5", orderedQty: 10, deliveredQty: 8,  unit: "قطعة" },
    { id: 3, name: "ماوس لاسلكي",            orderedQty: 20, deliveredQty: 20, unit: "قطعة" },
  ]);
  const [status, setStatus] = useState("pending");

  const statusOptions = [
    { value: "pending",   label: "معلق",        color: "bg-amber-100 text-amber-700" },
    { value: "partial",   label: "جزئي",        color: "bg-blue-100 text-blue-700" },
    { value: "delivered", label: "مُسلَّم",      color: "bg-emerald-100 text-emerald-700" },
    { value: "cancelled", label: "ملغي",        color: "bg-red-100 text-red-700" },
  ];
  const currentStatus = statusOptions.find(s => s.value === status)!;

  const deliveryOrders = [
    { id: "DO-2026-001", date: "2026-05-06", customer: "شركة النور للتجارة",   order: "SO-2026-012", status: "delivered", total: 12450 },
    { id: "DO-2026-002", date: "2026-05-07", customer: "مؤسسة الأمل",          order: "SO-2026-015", status: "partial",   total: 8200 },
    { id: "DO-2026-003", date: "2026-05-07", customer: "أحمد محمد علي",        order: "SO-2026-018", status: "pending",   total: 3600 },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">أوامر تسليم المبيعات</h2>
          <p className="text-xs text-muted-foreground mt-0.5">إدارة وتتبع عمليات تسليم البضاعة للعملاء</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs h-8">
          <Plus className="w-3.5 h-3.5" /> أمر تسليم جديد
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "إجمالي أوامر التسليم", value: "24",  color: "text-blue-500",    bg: "bg-blue-50" },
          { label: "مُسلَّمة اليوم",        value: "8",   color: "text-emerald-500", bg: "bg-emerald-50" },
          { label: "تسليم جزئي",           value: "5",   color: "text-amber-500",   bg: "bg-amber-50" },
          { label: "معلقة",                value: "11",  color: "text-red-500",     bg: "bg-red-50" },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Delivery Order Form */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary" /> إنشاء أمر تسليم جديد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">رقم أمر التسليم</Label>
              <Input defaultValue="DO-2026-004" className="h-8 text-sm" readOnly />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">التاريخ</Label>
              <Input type="date" defaultValue={new Date().toISOString().split("T")[0]} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">أمر البيع المرتبط</Label>
              <Select defaultValue="SO-2026-020">
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SO-2026-020">SO-2026-020</SelectItem>
                  <SelectItem value="SO-2026-019">SO-2026-019</SelectItem>
                  <SelectItem value="SO-2026-018">SO-2026-018</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">العميل</Label>
              <Select defaultValue="1">
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">شركة النور للتجارة</SelectItem>
                  <SelectItem value="2">مؤسسة الأمل</SelectItem>
                  <SelectItem value="3">أحمد محمد علي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">المخزن</Label>
              <Select defaultValue="main">
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">المخزن الرئيسي</SelectItem>
                  <SelectItem value="branch">مخزن الفرع</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">الحالة</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Label className="text-xs text-muted-foreground">عنوان التسليم</Label>
              <Input placeholder="عنوان التسليم..." className="h-8 text-sm" />
            </div>
          </div>

          {/* Items Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">الصنف</TableHead>
                <TableHead className="text-xs text-center w-24">الكمية المطلوبة</TableHead>
                <TableHead className="text-xs text-center w-24">الكمية المُسلَّمة</TableHead>
                <TableHead className="text-xs text-center w-20">الوحدة</TableHead>
                <TableHead className="text-xs text-center w-24">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => {
                const pct = Math.round((item.deliveredQty / item.orderedQty) * 100);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm font-medium">{item.name}</TableCell>
                    <TableCell className="text-center text-sm">{item.orderedQty}</TableCell>
                    <TableCell className="text-center">
                      <Input type="number" value={item.deliveredQty} min={0} max={item.orderedQty}
                        onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, deliveredQty: Math.min(+e.target.value, it.orderedQty) } : it))}
                        className="h-7 w-20 text-center text-sm mx-auto" />
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{item.unit}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-xs ${
                        pct === 100 ? "border-emerald-300 text-emerald-700 bg-emerald-50" :
                        pct > 0    ? "border-amber-300 text-amber-700 bg-amber-50" :
                                     "border-red-300 text-red-700 bg-red-50"
                      }`}>
                        {pct === 100 ? "مكتمل" : pct > 0 ? `${pct}%` : "لم يُسلَّم"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${currentStatus.color}`}>{currentStatus.label}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                <Printer className="w-3.5 h-3.5" /> طباعة
              </Button>
              <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => toast.success("تم حفظ أمر التسليم بنجاح")}>
                <CheckCircle className="w-3.5 h-3.5" /> حفظ أمر التسليم
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">قائمة أوامر التسليم</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="بحث..." className="h-7 text-xs w-36" />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Filter className="w-3 h-3" /> فلتر
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">رقم الأمر</TableHead>
                <TableHead className="text-xs">التاريخ</TableHead>
                <TableHead className="text-xs">العميل</TableHead>
                <TableHead className="text-xs">أمر البيع</TableHead>
                <TableHead className="text-xs text-center">الحالة</TableHead>
                <TableHead className="text-xs text-center">الإجمالي</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveryOrders.map(o => {
                const st = statusOptions.find(s => s.value === o.status)!;
                return (
                  <TableRow key={o.id} className="hover:bg-accent/20">
                    <TableCell className="text-sm font-mono font-medium text-primary">{o.id}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{o.date}</TableCell>
                    <TableCell className="text-sm">{o.customer}</TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">{o.order}</TableCell>
                    <TableCell className="text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    </TableCell>
                    <TableCell className="text-center text-sm font-semibold text-primary">
                      {o.total.toLocaleString("ar-SA")} ر.س
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2">عرض</Button>
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                          <Printer className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sales Transactions View (كل المعاملات) ────────────────────────────────────

const DOC_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  sale:     { label: "فاتورة مبيعات",   color: "#2563EB", bg: "#EFF6FF" },
  return:   { label: "مردود مبيعات",    color: "#DC2626", bg: "#FEF2F2" },
  quote:    { label: "عرض سعر",         color: "#7C3AED", bg: "#F5F3FF" },
  order:    { label: "أمر بيع",         color: "#D97706", bg: "#FFFBEB" },
};

function SalesTransactionsView() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo]     = useState(today);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch]         = useState("");

  const { data: allInvoices = [], isLoading, refetch } = trpc.salesInvoices.list.useQuery({
    dateFrom,
    dateTo,
    limit: 1000,
    search: search || undefined,
  });

  const filtered = typeFilter === "all"
    ? allInvoices
    : allInvoices.filter(r => r.invoiceType === typeFilter);

  const fmt = (v: string | null | undefined) =>
    v ? parseFloat(v).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";

  const grandTotal  = filtered.reduce((s, r) => s + parseFloat(r.total       ?? "0"), 0);
  const totalPaid   = filtered.reduce((s, r) => s + parseFloat(r.paidAmount  ?? "0"), 0);
  const totalRemain = filtered.reduce((s, r) => s + parseFloat(r.remainingAmount ?? "0"), 0);

  const statusLabel: Record<string, { label: string; color: string }> = {
    draft:     { label: "مسودة",   color: "#6B7280" },
    confirmed: { label: "مؤكدة",   color: "#2563EB" },
    posted:    { label: "محاسبية", color: "#7C3AED" },
    paid:      { label: "مدفوعة",  color: "#059669" },
    cancelled: { label: "ملغاة",   color: "#DC2626" },
  };

  const typeCounts = allInvoices.reduce<Record<string, number>>((acc, r) => {
    acc[r.invoiceType] = (acc[r.invoiceType] ?? 0) + 1;
    return acc;
  }, {});

  const filterTabs = [
    { id: "all",    label: "الكل",          count: allInvoices.length },
    { id: "sale",   label: "فواتير",        count: typeCounts.sale   ?? 0 },
    { id: "return", label: "مردود",          count: typeCounts.return ?? 0 },
    { id: "quote",  label: "عروض أسعار",    count: typeCounts.quote  ?? 0 },
    { id: "order",  label: "أوامر بيع",     count: typeCounts.order  ?? 0 },
  ];

  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "'Cairo', Tahoma, sans-serif" }}>

      {/* ── شريط الأدوات ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "8px 12px", borderBottom: "1px solid #E5E7EB",
        background: "#F9FAFB", flexShrink: 0,
      }}>
        {/* عنوان */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: "rgba(124,58,237,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Activity style={{ width: 15, height: 15, color: "#7C3AED" }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>عرض المعاملات</div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>
              {isLoading ? "جاري التحميل..." : `${filtered.length} معاملة`}
            </div>
          </div>
        </div>

        {/* فلتر التاريخ */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#6B7280" }}>من</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: "3px 8px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, background: "#fff", color: "#111827" }} />
          <span style={{ fontSize: 12, color: "#6B7280" }}>إلى</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ padding: "3px 8px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, background: "#fff", color: "#111827" }} />
        </div>

        {/* بحث */}
        <div style={{ position: "relative" }}>
          <Search style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "#9CA3AF", pointerEvents: "none" }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث برقم أو عميل..."
            style={{ paddingRight: 28, paddingLeft: 8, paddingTop: 4, paddingBottom: 4, border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, background: "#fff", width: 170 }}
          />
        </div>

        {/* تحديث */}
        <button onClick={() => refetch()} title="تحديث"
          style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#F3F4F6")}
          onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
        >
          <RefreshCw style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* ── تبويبات النوع ── */}
      <div style={{
        display: "flex", gap: 4, padding: "6px 12px",
        borderBottom: "1px solid #E5E7EB", background: "#fff", flexShrink: 0,
      }}>
        {filterTabs.map(tab => {
          const active = typeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 12px", borderRadius: 20, fontSize: 12,
                border: active ? "1px solid #7C3AED" : "1px solid #E5E7EB",
                background: active ? "#F5F3FF" : "#fff",
                color: active ? "#7C3AED" : "#6B7280",
                cursor: "pointer", fontWeight: active ? 700 : 400,
                fontFamily: "'Cairo', Tahoma, sans-serif",
                transition: "all 0.1s",
              }}
            >
              {tab.label}
              <span style={{
                minWidth: 18, height: 18, borderRadius: 9, fontSize: 10, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? "#7C3AED" : "#F3F4F6",
                color: active ? "#fff" : "#6B7280", padding: "0 4px",
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── الجدول ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F3F4F6", position: "sticky", top: 0, zIndex: 2 }}>
              {["نوع المعاملة", "رقم المستند", "العميل", "التاريخ", "نوع السداد", "الإجمالي", "المدفوع", "المتبقي", "الحالة"].map(h => (
                <th key={h} style={{
                  padding: "8px 10px", textAlign: "right",
                  color: "#6B7280", fontWeight: 600, fontSize: 11.5,
                  borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "#9CA3AF" }}>جاري التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <Activity style={{ width: 32, height: 32, color: "#D1D5DB" }} />
                    <span style={{ fontSize: 13 }}>لا توجد معاملات لهذه الفترة</span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((inv, i) => {
                const dt = DOC_TYPE_CONFIG[inv.invoiceType] ?? { label: inv.invoiceType, color: "#6B7280", bg: "#F3F4F6" };
                const st = statusLabel[inv.status] ?? { label: inv.status, color: "#6B7280" };
                const payLabel = inv.paymentMethod === "cash" ? "نقداً" : "آجل";
                const invDate = new Date(inv.invoiceDate).toLocaleDateString("ar-EG", {
                  year: "numeric", month: "2-digit", day: "2-digit",
                });
                return (
                  <tr key={inv.id}
                    style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F5F3FF")}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#FAFAFA")}
                  >
                    <td style={{ padding: "7px 10px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: dt.bg, color: dt.color,
                      }}>
                        {dt.label}
                      </span>
                    </td>
                    <td style={{ padding: "7px 10px", color: "#2563EB", fontWeight: 600 }}>{inv.invoiceNumber}</td>
                    <td style={{ padding: "7px 10px", color: "#374151" }}>{inv.customerName ?? "—"}</td>
                    <td style={{ padding: "7px 10px", color: "#6B7280", direction: "ltr", textAlign: "right" }}>{invDate}</td>
                    <td style={{ padding: "7px 10px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 12, fontSize: 11,
                        background: inv.paymentMethod === "cash" ? "#F0FDF4" : "#FFF7ED",
                        color: inv.paymentMethod === "cash" ? "#059669" : "#D97706", fontWeight: 600,
                      }}>
                        {payLabel}
                      </span>
                    </td>
                    <td style={{ padding: "7px 10px", fontWeight: 700, textAlign: "left", direction: "ltr", color: "#111827" }}>
                      {fmt(inv.total)} <span style={{ fontSize: 10, color: "#9CA3AF" }}>{inv.currency ?? ""}</span>
                    </td>
                    <td style={{ padding: "7px 10px", textAlign: "left", direction: "ltr", color: "#059669" }}>
                      {fmt(inv.paidAmount)}
                    </td>
                    <td style={{ padding: "7px 10px", textAlign: "left", direction: "ltr", color: parseFloat(inv.remainingAmount ?? "0") > 0 ? "#DC2626" : "#6B7280" }}>
                      {fmt(inv.remainingAmount)}
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 12, fontSize: 11,
                        background: `${st.color}18`, color: st.color, fontWeight: 600,
                      }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── شريط الإجمالي ── */}
      {filtered.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 24,
          padding: "6px 16px", borderTop: "2px solid #E5E7EB",
          background: "#F9FAFB", flexShrink: 0, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 12, color: "#6B7280", marginLeft: "auto" }}>
            إجمالي <strong>{filtered.length}</strong> معاملة
          </span>
          <span style={{ fontSize: 12, color: "#374151" }}>
            إجمالي المبيعات: <strong style={{ color: "#111827" }}>
              {grandTotal.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}
            </strong>
          </span>
          <span style={{ fontSize: 12, color: "#374151" }}>
            المدفوع: <strong style={{ color: "#059669" }}>
              {totalPaid.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}
            </strong>
          </span>
          <span style={{ fontSize: 12, color: "#374151" }}>
            المتبقي: <strong style={{ color: totalRemain > 0 ? "#DC2626" : "#6B7280" }}>
              {totalRemain.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Sales Invoice List View ───────────────────────────────────────────────────

function SalesInvoiceListView() {
  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo]     = useState(today);
  const [search, setSearch]     = useState("");
  const [mode, setMode]         = useState<"list" | "form">("list");

  const { data: invoices = [], isLoading, refetch } = trpc.salesInvoices.list.useQuery({
    invoiceType: "sale",
    dateFrom,
    dateTo,
    search: search || undefined,
    limit: 500,
  });

  const fmt = (v: string | null | undefined) =>
    v ? parseFloat(v).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";

  const totalAmount = invoices.reduce((s, r) => s + parseFloat(r.total ?? "0"), 0);

  const statusLabel: Record<string, { label: string; color: string }> = {
    draft:     { label: "مسودة",    color: "#6B7280" },
    confirmed: { label: "مؤكدة",    color: "#2563EB" },
    posted:    { label: "محاسبية",  color: "#7C3AED" },
    paid:      { label: "مدفوعة",   color: "#059669" },
    cancelled: { label: "ملغاة",    color: "#DC2626" },
  };

  if (mode === "form") {
    return (
      <div className="h-full flex flex-col" dir="rtl">
        {/* شريط الرجوع */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 12px", borderBottom: "1px solid #E5E7EB",
          background: "#F9FAFB",
        }}>
          <button
            onClick={() => { setMode("list"); refetch(); }}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
              border: "1px solid #D1D5DB", borderRadius: 6,
              background: "#fff", cursor: "pointer", fontSize: 12,
              color: "#374151", fontFamily: "'Cairo', Tahoma, sans-serif",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#F3F4F6")}
            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
          >
            <ArrowRight style={{ width: 13, height: 13 }} />
            العودة إلى القائمة
          </button>
          <span style={{ fontSize: 12, color: "#9CA3AF", fontFamily: "'Cairo', Tahoma, sans-serif" }}>
            إنشاء فاتورة مبيعات جديدة
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <SalesInvoicePageNew />
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "'Cairo', Tahoma, sans-serif" }}>

      {/* ── شريط العنوان + الأدوات ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "8px 12px", borderBottom: "1px solid #E5E7EB",
        background: "#F9FAFB", flexShrink: 0,
      }}>
        {/* عنوان */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: "rgba(37,99,235,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Receipt style={{ width: 15, height: 15, color: "#2563EB" }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>فواتير المبيعات</div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>
              {isLoading ? "جاري التحميل..." : `${invoices.length} فاتورة`}
            </div>
          </div>
        </div>

        {/* فلتر التاريخ */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#6B7280" }}>من</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{
              padding: "3px 8px", border: "1px solid #D1D5DB", borderRadius: 6,
              fontSize: 12, background: "#fff", color: "#111827", cursor: "pointer",
            }}
          />
          <span style={{ fontSize: 12, color: "#6B7280" }}>إلى</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{
              padding: "3px 8px", border: "1px solid #D1D5DB", borderRadius: 6,
              fontSize: 12, background: "#fff", color: "#111827", cursor: "pointer",
            }}
          />
        </div>

        {/* بحث */}
        <div style={{ position: "relative" }}>
          <Search style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            width: 13, height: 13, color: "#9CA3AF", pointerEvents: "none",
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث برقم أو عميل..."
            style={{
              paddingRight: 28, paddingLeft: 8, paddingTop: 4, paddingBottom: 4,
              border: "1px solid #D1D5DB", borderRadius: 6,
              fontSize: 12, background: "#fff", color: "#111827", width: 180,
            }}
          />
        </div>

        {/* تحديث */}
        <button
          onClick={() => refetch()}
          title="تحديث"
          style={{
            width: 30, height: 30, borderRadius: 6, border: "1px solid #D1D5DB",
            background: "#fff", cursor: "pointer", color: "#6B7280",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#F3F4F6")}
          onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
        >
          <RefreshCw style={{ width: 13, height: 13 }} />
        </button>

        {/* زر إضافة فاتورة */}
        <button
          onClick={() => setMode("form")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 14px", borderRadius: 7, border: "none",
            background: "#2563EB", color: "#fff", cursor: "pointer",
            fontSize: 12, fontWeight: 700, fontFamily: "'Cairo', Tahoma, sans-serif",
            boxShadow: "0 1px 4px rgba(37,99,235,0.3)",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1D4ED8")}
          onMouseLeave={e => (e.currentTarget.style.background = "#2563EB")}
        >
          <Plus style={{ width: 14, height: 14 }} />
          فاتورة جديدة
        </button>
      </div>

      {/* ── الجدول ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F3F4F6", position: "sticky", top: 0, zIndex: 2 }}>
              {["رقم الفاتورة", "العميل", "التاريخ", "المخزن", "نوع السداد", "الإجمالي", "الحالة"].map(h => (
                <th key={h} style={{
                  padding: "8px 12px", textAlign: "right",
                  color: "#6B7280", fontWeight: 600, fontSize: 11.5,
                  borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#9CA3AF" }}>
                  جاري التحميل...
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <Receipt style={{ width: 32, height: 32, color: "#D1D5DB" }} />
                    <span style={{ fontSize: 13 }}>لا توجد فواتير لهذه الفترة</span>
                    <button
                      onClick={() => setMode("form")}
                      style={{
                        marginTop: 4, padding: "5px 16px", borderRadius: 6,
                        border: "none", background: "#2563EB", color: "#fff",
                        cursor: "pointer", fontSize: 12, fontWeight: 600,
                        fontFamily: "'Cairo', Tahoma, sans-serif",
                      }}
                    >
                      + إنشاء فاتورة جديدة
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              invoices.map((inv, i) => {
                const st = statusLabel[inv.status] ?? { label: inv.status, color: "#6B7280" };
                const payLabel = inv.paymentMethod === "cash" ? "نقداً" : "آجل";
                const invDate = new Date(inv.invoiceDate).toLocaleDateString("ar-EG", {
                  year: "numeric", month: "2-digit", day: "2-digit",
                });
                return (
                  <tr
                    key={inv.id}
                    style={{
                      borderBottom: "1px solid #F3F4F6",
                      background: i % 2 === 0 ? "#fff" : "#FAFAFA",
                      cursor: "default",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#EFF6FF")}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#FAFAFA")}
                  >
                    <td style={{ padding: "7px 12px", color: "#2563EB", fontWeight: 600 }}>
                      {inv.invoiceNumber}
                    </td>
                    <td style={{ padding: "7px 12px", color: "#374151" }}>
                      {inv.customerName ?? "—"}
                    </td>
                    <td style={{ padding: "7px 12px", color: "#6B7280", direction: "ltr", textAlign: "right" }}>
                      {invDate}
                    </td>
                    <td style={{ padding: "7px 12px", color: "#6B7280" }}>
                      {(inv as any).warehouseId ?? "—"}
                    </td>
                    <td style={{ padding: "7px 12px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 12, fontSize: 11,
                        background: inv.paymentMethod === "cash" ? "#F0FDF4" : "#FFF7ED",
                        color: inv.paymentMethod === "cash" ? "#059669" : "#D97706",
                        fontWeight: 600,
                      }}>
                        {payLabel}
                      </span>
                    </td>
                    <td style={{ padding: "7px 12px", color: "#111827", fontWeight: 700, textAlign: "left", direction: "ltr" }}>
                      {fmt(inv.total)} {inv.currency ?? ""}
                    </td>
                    <td style={{ padding: "7px 12px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 12, fontSize: 11,
                        background: `${st.color}18`, color: st.color, fontWeight: 600,
                      }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── شريط الإجمالي ── */}
      {invoices.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "6px 16px", borderTop: "2px solid #E5E7EB",
          background: "#F9FAFB", flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: "#6B7280" }}>
            إجمالي {invoices.length} فاتورة
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
            الإجمالي الكلي: {totalAmount.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Content Router ────────────────────────────────────────────────────────────

function SalesContent({ activeId, onSelect, settings, onSettingsChange }: {
  activeId: MenuId;
  onSelect: (id: MenuId) => void;
  settings: DashboardSettings;
  onSettingsChange: (key: DashboardWidgetKey, val: boolean) => void;
}) {
  switch (activeId) {
    case "overview":              return <SalesOverview onSelect={onSelect} settings={settings} onSettingsChange={onSettingsChange} />;
    case "all-transactions":      return <SalesTransactionsView />;
    case "sales-invoice":         return <SalesInvoiceListView />;
    case "sales-return":          return <ComingSoon title="مردود المبيعات" />;
    case "credit-note":           return <ComingSoon title="إشعار دائن" />;
    case "quotation":             return <SalesQuotation />;
    case "sales-order":           return <ComingSoon title="أمر بيع" />;
    case "delivery-order":        return <DeliveryOrderPage />;
    case "pos-screen":            return <ComingSoon title="شاشة البيع" />;
    case "shifts":                return <ShiftsPage />;
    case "payment-methods":       return <PaymentMethodsPage />;
    case "pos-settings":          return <ComingSoon title="إعدادات POS" />;
    case "pos-reports":           return <ComingSoon title="تقارير POS" />;
    case "add-customer":
    case "customer-groups":
    case "customer-balances":
    case "customer-statement":    return <CustomersPage />;
    case "customer-reports":      return <ComingSoon title="تقارير العملاء" />;
    case "sales-totals-reports":   return <SalesTotalsReports />;
    case "sales-invoices-report":  return <SalesInvoicesReport />;
    case "sales-items-reports":    return <ComingSoon title="تقارير أصناف المبيعات" />;
    default:                      return <SalesOverview onSelect={onSelect} />;
  }
}

// ─── Exported Sub-Page Wrappers (for MDI tab system) ──────────────────────────
export function SalesTransactionsTab()  { return <div className="h-full flex flex-col" dir="rtl" style={{ height: "100%" }}><SalesTransactionsView /></div>; }
export function SalesInvoiceTab()       { return <div className="h-full flex flex-col" dir="rtl" style={{ height: "100%" }}><SalesInvoiceListView /></div>; }
export function SalesReturnTab()        { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="مردود المبيعات" /></div>; }
export function SalesCreditNoteTab()    { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="إشعار دائن" /></div>; }
export function SalesQuotationTab()     { return <div className="h-full overflow-auto p-5" dir="rtl"><SalesQuotation /></div>; }
export function SalesOrderTab()         { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="أمر بيع" /></div>; }
export function SalesDeliveryTab()      { return <div className="h-full overflow-auto p-5" dir="rtl"><DeliveryOrderPage /></div>; }
export function SalesPosTab()           { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="شاشة البيع" /></div>; }
export function SalesShiftsTab()        { return <div className="h-full overflow-auto p-5" dir="rtl"><ShiftsPage /></div>; }
export function SalesPaymentMethodsTab(){ return <div className="h-full overflow-auto p-5" dir="rtl"><PaymentMethodsPage /></div>; }
export function SalesPosSettingsTab()   { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="إعدادات POS" /></div>; }
export function SalesPosReportsTab()    { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="تقارير POS" /></div>; }
export function SalesCustomersTab()     { return <div className="h-full overflow-auto p-5" dir="rtl"><CustomersPage /></div>; }
export function SalesCustomerGroupsTab()    { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="مجموعات العملاء" /></div>; }
export function SalesCustomerBalancesTab()  { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="أرصدة العملاء" /></div>; }
export function SalesCustomerStatementTab() { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="كشف حساب عميل" /></div>; }
export function SalesCustomerReportsTab()   { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="تقارير العملاء" /></div>; }
export function SalesTotalsReportsTab()    { return <div className="h-full overflow-auto p-5" dir="rtl"><SalesTotalsReports /></div>; }
export function SalesInvoicesReportTab()   { return <div className="h-full overflow-auto p-5" dir="rtl"><SalesInvoicesReport /></div>; }
export function SalesItemsReportsTab()     { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="تقارير أصناف المبيعات" /></div>; }

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function SalesModule() {
  const [activeId, setActiveId] = useState<MenuId>("overview");
  const [settings, setSettings] = useState<DashboardSettings>(loadSettings);

  const handleSettingsChange = (key: DashboardWidgetKey, val: boolean) => {
    setSettings(prev => {
      const next = { ...prev, [key]: val };
      saveSettings(next);
      return next;
    });
  };

  return (
    <div className="flex h-full" dir="rtl">
      <SalesMenu activeId={activeId} onSelect={setActiveId} />
      <div className="flex-1 overflow-auto p-5">
        <SalesContent
          activeId={activeId}
          onSelect={setActiveId}
          settings={settings}
          onSettingsChange={handleSettingsChange}
        />
      </div>
    </div>
  );
}
