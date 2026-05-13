import { useState } from "react";
import { useTabManager } from "@/contexts/TabManagerContext";
import {
  ChevronDown, ChevronRight, Factory, FileText, BarChart3,
  ClipboardList, Plus, Search, CheckCircle, ArrowRight,
  Layers, Cog, DollarSign, GitBranch, Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type MenuId = string;

const menuSections = [
  {
    id: "production",
    label: "أوامر الإنتاج",
    icon: Factory,
    children: [
      { id: "new-production-order",  label: "أمر إنتاج جديد",      icon: Plus,          path: "/mfg/new-order" },
      { id: "production-orders-list",label: "قائمة أوامر الإنتاج",  icon: ClipboardList, path: "/mfg/orders" },
      { id: "production-tracking",   label: "متابعة الإنتاج",       icon: GitBranch,     path: "/mfg/tracking" },
    ],
  },
  {
    id: "bom",
    label: "قوائم المكونات (BOM)",
    icon: Layers,
    children: [
      { id: "new-bom",    label: "إنشاء قائمة مكونات",  icon: Plus,   path: "/mfg/new-bom" },
      { id: "bom-list",   label: "قوائم المكونات",       icon: Layers, path: "/mfg/bom" },
    ],
  },
  {
    id: "cost",
    label: "تكلفة الإنتاج",
    icon: DollarSign,
    children: [
      { id: "cost-calculation", label: "حساب التكلفة",   icon: DollarSign, path: "/mfg/cost" },
      { id: "cost-reports",     label: "تقارير التكلفة",  icon: BarChart3,  path: "/mfg/cost-reports" },
    ],
  },
  {
    id: "stages",
    label: "مراحل الإنتاج",
    icon: Cog,
    children: [
      { id: "production-stages", label: "إدارة المراحل", icon: Cog,     path: "/mfg/stages" },
      { id: "workcenters",       label: "مراكز العمل",   icon: Factory, path: "/mfg/workcenters" },
    ],
  },
  {
    id: "mfg-reports",
    label: "التقارير",
    icon: BarChart3,
    children: [
      { id: "production-report", label: "تقرير الإنتاج", icon: BarChart3, path: "/mfg/production-report" },
      { id: "efficiency-report", label: "تقرير الكفاءة", icon: BarChart3, path: "/mfg/efficiency" },
      { id: "waste-report",      label: "تقرير الهالك",  icon: BarChart3, path: "/mfg/waste" },
    ],
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function ManufacturingMenu({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ production: true });
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const { openTab } = useTabManager();

  return (
    <nav className="w-56 shrink-0 border-l border-border bg-card/50 overflow-y-auto flex flex-col">
      <div className="p-3 border-b border-border">
        <button onClick={() => onSelect("overview")}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeId === "overview" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent/30"}`}>
          <Factory className="w-4 h-4 text-primary" />
          التصنيع
        </button>
      </div>
      <div className="py-2 flex-1">
        {menuSections.map(section => (
          <div key={section.id}>
            <button onClick={() => toggle(section.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors">
              <section.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-right">{section.label}</span>
              {expanded[section.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {expanded[section.id] && (
              <div className="mr-3 border-r border-border/40 mb-1">
                {section.children.map(child => (
                  <button key={child.id} onClick={() => { onSelect(child.id); openTab(child.path, child.label, child.icon); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                      activeId === child.id ? "bg-primary/10 text-primary font-semibold border-r-2 border-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
                    }`}>
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

function ManufacturingOverview({ onSelect }: { onSelect: (id: MenuId) => void }) {
  const stats = [
    { label: "أوامر نشطة",     value: "8",       color: "text-blue-500",    icon: Factory },
    { label: "مكتملة اليوم",   value: "3",       color: "text-emerald-500", icon: CheckCircle },
    { label: "تكلفة الإنتاج",  value: "45,200",  color: "text-amber-500",   icon: DollarSign },
    { label: "كفاءة الإنتاج",  value: "87%",     color: "text-purple-500",  icon: BarChart3 },
  ];
  const productionData = [
    { week: "الأسبوع 1", planned: 100, actual: 92 },
    { week: "الأسبوع 2", planned: 120, actual: 115 },
    { week: "الأسبوع 3", planned: 110, actual: 108 },
    { week: "الأسبوع 4", planned: 130, actual: 113 },
  ];
  const statusData = [
    { name: "قيد التنفيذ", value: 5, color: "#3b82f6" },
    { name: "مكتملة",      value: 12, color: "#10b981" },
    { name: "معلقة",       value: 3,  color: "#f59e0b" },
    { name: "ملغاة",       value: 1,  color: "#ef4444" },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4">
              <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">الإنتاج المخطط مقابل الفعلي</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={productionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                <Bar dataKey="planned" fill="hsl(var(--muted))"    name="المخطط"  radius={[4,4,0,0]} />
                <Bar dataKey="actual"  fill="hsl(var(--primary))"  name="الفعلي"  radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">حالة أوامر الإنتاج</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-4">
            <PieChart width={140} height={140}>
              <Pie data={statusData} cx={65} cy={65} innerRadius={40} outerRadius={65} dataKey="value">
                {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
            <div className="space-y-2">
              {statusData.map(s => (
                <div key={s.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="font-semibold mr-auto">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {menuSections.map(group => (
          <Card key={group.id} className="border-border/50 hover:border-primary/30 transition-colors">
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
    </div>
  );
}

// ─── Production Orders List ────────────────────────────────────────────────────

function ProductionOrdersList() {
  const orders = [
    { id: "MO-001", product: "منتج أ", qty: 100, produced: 75, startDate: "2026-05-01", endDate: "2026-05-10", status: "قيد التنفيذ" },
    { id: "MO-002", product: "منتج ب", qty: 50,  produced: 50, startDate: "2026-04-25", endDate: "2026-05-05", status: "مكتملة" },
    { id: "MO-003", product: "منتج ج", qty: 200, produced: 0,  startDate: "2026-05-08", endDate: "2026-05-20", status: "معلقة" },
  ];
  const statusColor: Record<string, string> = {
    "قيد التنفيذ": "bg-blue-500/10 text-blue-500",
    "مكتملة":      "bg-emerald-500/10 text-emerald-500",
    "معلقة":       "bg-amber-500/10 text-amber-500",
    "ملغاة":       "bg-destructive/10 text-destructive",
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">أوامر الإنتاج</h3>
        <Button className="h-8 text-sm" onClick={() => toast.info("إنشاء أمر إنتاج جديد")}>
          <Plus className="w-4 h-4 ml-1" /> أمر إنتاج جديد
        </Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">رقم الأمر</TableHead>
              <TableHead className="text-xs">المنتج</TableHead>
              <TableHead className="text-xs text-center">الكمية</TableHead>
              <TableHead className="text-xs text-center">المنتَج</TableHead>
              <TableHead className="text-xs">تاريخ البداية</TableHead>
              <TableHead className="text-xs">تاريخ النهاية</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map(o => (
              <TableRow key={o.id}>
                <TableCell className="text-sm font-mono text-primary">{o.id}</TableCell>
                <TableCell className="text-sm font-medium">{o.product}</TableCell>
                <TableCell className="text-center text-sm">{o.qty}</TableCell>
                <TableCell className="text-center text-sm">
                  <div className="flex items-center gap-1 justify-center">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(o.produced / o.qty) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{o.produced}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{o.startDate}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{o.endDate}</TableCell>
                <TableCell className="text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[o.status]}`}>{o.status}</span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary text-xs">عرض</button>
                    {o.status === "معلقة" && <button className="text-emerald-500 text-xs" onClick={() => toast.success("تم بدء الإنتاج")}>بدء</button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── BOM List ─────────────────────────────────────────────────────────────────

function BOMList() {
  const boms = [
    { id: 1, product: "منتج أ", components: 5, version: "1.0", status: "نشط" },
    { id: 2, product: "منتج ب", components: 3, version: "2.1", status: "نشط" },
    { id: 3, product: "منتج ج", components: 8, version: "1.2", status: "معطل" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">قوائم المكونات (BOM)</h3>
        <Button className="h-8 text-sm" onClick={() => toast.info("إنشاء قائمة مكونات جديدة")}>
          <Plus className="w-4 h-4 ml-1" /> قائمة مكونات جديدة
        </Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">المنتج</TableHead>
              <TableHead className="text-xs text-center">عدد المكونات</TableHead>
              <TableHead className="text-xs text-center">الإصدار</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {boms.map(b => (
              <TableRow key={b.id}>
                <TableCell className="text-sm font-medium">{b.product}</TableCell>
                <TableCell className="text-center text-sm">{b.components}</TableCell>
                <TableCell className="text-center text-sm">v{b.version}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={b.status === "نشط" ? "default" : "secondary"}>{b.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary text-xs">عرض</button>
                    <button className="text-muted-foreground text-xs">تعديل</button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Coming Soon ───────────────────────────────────────────────────────────────

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
      <Factory className="w-14 h-14 opacity-10" />
      <p className="text-lg font-bold text-foreground">{title}</p>
      <p className="text-sm">هذه الشاشة قيد التطوير</p>
      <Badge variant="outline" className="mt-1">قريباً</Badge>
    </div>
  );
}

// ─── Content Router ────────────────────────────────────────────────────────────

function ManufacturingContent({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  switch (activeId) {
    case "overview":             return <ManufacturingOverview onSelect={onSelect} />;
    case "new-production-order": return <ComingSoon title="أمر إنتاج جديد" />;
    case "production-orders-list":return <ProductionOrdersList />;
    case "production-tracking":  return <ComingSoon title="متابعة الإنتاج" />;
    case "new-bom":              return <ComingSoon title="إنشاء قائمة مكونات" />;
    case "bom-list":             return <BOMList />;
    case "cost-calculation":     return <ComingSoon title="حساب التكلفة" />;
    case "cost-reports":         return <ComingSoon title="تقارير التكلفة" />;
    case "production-stages":    return <ComingSoon title="إدارة المراحل" />;
    case "workcenters":          return <ComingSoon title="مراكز العمل" />;
    case "production-report":    return <ComingSoon title="تقرير الإنتاج" />;
    case "efficiency-report":    return <ComingSoon title="تقرير الكفاءة" />;
    case "waste-report":         return <ComingSoon title="تقرير الهالك" />;
    default:                     return <ManufacturingOverview onSelect={onSelect} />;
  }
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function ManufacturingModule() {
  const [activeId, setActiveId] = useState<MenuId>("overview");
  return (
    <div className="flex h-full" dir="rtl">
      <ManufacturingMenu activeId={activeId} onSelect={setActiveId} />
      <div className="flex-1 overflow-auto p-5">
        <ManufacturingContent activeId={activeId} onSelect={setActiveId} />
      </div>
    </div>
  );
}

// ─── Tab Sub-Pages ─────────────────────────────────────────────────────────────
function MfgSubPage({ activeId }: { activeId: string }) {
  return <div className="h-full overflow-auto p-5" dir="rtl"><ManufacturingContent activeId={activeId} onSelect={() => {}} /></div>;
}
export function MfgNewOrderTab()          { return <MfgSubPage activeId="new-production-order" />; }
export function MfgOrdersTab()            { return <MfgSubPage activeId="production-orders-list" />; }
export function MfgTrackingTab()          { return <MfgSubPage activeId="production-tracking" />; }
export function MfgNewBomTab()            { return <MfgSubPage activeId="new-bom" />; }
export function MfgBomTab()               { return <MfgSubPage activeId="bom-list" />; }
export function MfgCostTab()              { return <MfgSubPage activeId="cost-calculation" />; }
export function MfgCostReportsTab()       { return <MfgSubPage activeId="cost-reports" />; }
export function MfgStagesTab()            { return <MfgSubPage activeId="production-stages" />; }
export function MfgWorkcentersTab()       { return <MfgSubPage activeId="workcenters" />; }
export function MfgProductionReportTab()  { return <MfgSubPage activeId="production-report" />; }
export function MfgEfficiencyTab()        { return <MfgSubPage activeId="efficiency-report" />; }
export function MfgWasteTab()             { return <MfgSubPage activeId="waste-report" />; }
