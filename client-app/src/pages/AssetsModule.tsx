import { useState } from "react";
import { useTabManager } from "@/contexts/TabManagerContext";
import {
  ChevronDown, ChevronRight, Building2, FileText, BarChart3,
  Plus, Search, DollarSign, ArrowRight, TrendingDown,
  ArrowLeftRight, Settings, Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type MenuId = string;

const menuSections = [
  {
    id: "assets",
    label: "الأصول",
    icon: Building2,
    children: [
      { id: "assets-list",      label: "قائمة الأصول",  icon: Building2,    path: "/assets/list" },
      { id: "add-asset",        label: "إضافة أصل",     icon: Plus,          path: "/assets/add" },
      { id: "asset-categories", label: "فئات الأصول",   icon: Package,       path: "/assets/categories" },
    ],
  },
  {
    id: "depreciation",
    label: "الإهلاك",
    icon: TrendingDown,
    children: [
      { id: "depreciation-run",      label: "تشغيل الإهلاك", icon: TrendingDown, path: "/assets/depreciation" },
      { id: "depreciation-schedule", label: "جدول الإهلاك",   icon: FileText,     path: "/assets/depreciation-schedule" },
    ],
  },
  {
    id: "transfers",
    label: "نقل الأصول",
    icon: ArrowLeftRight,
    children: [
      { id: "asset-transfer", label: "نقل أصل",    icon: ArrowLeftRight, path: "/assets/transfer" },
      { id: "transfer-list",  label: "سجل النقل",   icon: FileText,       path: "/assets/transfer-list" },
    ],
  },
  {
    id: "disposal",
    label: "التخلص من الأصول",
    icon: Settings,
    children: [
      { id: "asset-disposal", label: "التخلص من أصل", icon: Settings,  path: "/assets/disposal" },
      { id: "disposal-list",  label: "سجل التخلص",     icon: FileText,  path: "/assets/disposal-list" },
    ],
  },
  {
    id: "asset-reports",
    label: "التقارير",
    icon: BarChart3,
    children: [
      { id: "assets-summary",      label: "ملخص الأصول",   icon: BarChart3,     path: "/assets/summary" },
      { id: "depreciation-report", label: "تقرير الإهلاك", icon: TrendingDown,  path: "/assets/depreciation-report" },
      { id: "asset-movement",      label: "حركة الأصول",   icon: ArrowLeftRight,path: "/assets/movement" },
    ],
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function AssetsMenu({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ assets: true });
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const { openTab } = useTabManager();

  return (
    <nav className="w-56 shrink-0 border-l border-border bg-card/50 overflow-y-auto flex flex-col">
      <div className="p-3 border-b border-border">
        <button onClick={() => onSelect("overview")}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeId === "overview" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent/30"}`}>
          <Building2 className="w-4 h-4 text-primary" />
          الأصول الثابتة
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

function AssetsOverview({ onSelect }: { onSelect: (id: MenuId) => void }) {
  const stats = [
    { label: "إجمالي الأصول",     value: "850,000",  color: "text-blue-500",    icon: Building2 },
    { label: "إجمالي الإهلاك",    value: "215,000",  color: "text-amber-500",   icon: TrendingDown },
    { label: "الصافي الدفتري",    value: "635,000",  color: "text-emerald-500", icon: DollarSign },
    { label: "عدد الأصول",        value: "24",       color: "text-purple-500",  icon: Package },
  ];
  const depreciationData = [
    { year: "2022", depreciation: 35000 },
    { year: "2023", depreciation: 42000 },
    { year: "2024", depreciation: 48000 },
    { year: "2025", depreciation: 52000 },
    { year: "2026", depreciation: 38000 },
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
      <Card className="border-border/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm">الإهلاك السنوي</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={depreciationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
              <Bar dataKey="depreciation" fill="hsl(var(--primary))" name="الإهلاك" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
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

// ─── Assets List ───────────────────────────────────────────────────────────────

function AssetsListPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const assets = [
    { id: "FA-001", name: "سيارة تويوتا كامري",    category: "مركبات",   purchaseDate: "2022-01-15", cost: 120000, depreciation: 36000, bookValue: 84000, status: "نشط" },
    { id: "FA-002", name: "حاسوب محمول Dell",       category: "أجهزة",    purchaseDate: "2023-03-10", cost: 8000,   depreciation: 3200,  bookValue: 4800,  status: "نشط" },
    { id: "FA-003", name: "مبنى المكتب الرئيسي",    category: "عقارات",   purchaseDate: "2019-06-01", cost: 500000, depreciation: 75000, bookValue: 425000,status: "نشط" },
    { id: "FA-004", name: "آلة تصوير Xerox",        category: "أجهزة",    purchaseDate: "2021-08-20", cost: 15000,  depreciation: 9000,  bookValue: 6000,  status: "نشط" },
    { id: "FA-005", name: "شاحنة نقل",              category: "مركبات",   purchaseDate: "2020-11-05", cost: 200000, depreciation: 80000, bookValue: 120000,status: "نشط" },
  ].filter(a => !search || a.name.includes(search) || a.category.includes(search));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث عن أصل..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 h-9" />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-9 text-sm"><Plus className="w-4 h-4 ml-1" /> إضافة أصل</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>إضافة أصل ثابت جديد</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              {[["اسم الأصل"],["تاريخ الشراء"],["تكلفة الشراء"],["العمر الإنتاجي (سنوات)"]].map(([l]) => (
                <div key={l}>
                  <Label className="text-xs text-muted-foreground">{l}</Label>
                  <Input className="h-8 text-sm" />
                </div>
              ))}
              <div>
                <Label className="text-xs text-muted-foreground">الفئة</Label>
                <Select>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="اختر فئة" /></SelectTrigger>
                  <SelectContent>
                    {["مركبات","أجهزة","عقارات","أثاث","معدات"].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">طريقة الإهلاك</Label>
                <Select>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="اختر طريقة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="straight-line">القسط الثابت</SelectItem>
                    <SelectItem value="declining">القسط المتناقص</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full mt-2" onClick={() => { toast.success("تم إضافة الأصل"); setOpen(false); }}>حفظ</Button>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">الكود</TableHead>
              <TableHead className="text-xs">اسم الأصل</TableHead>
              <TableHead className="text-xs">الفئة</TableHead>
              <TableHead className="text-xs">تاريخ الشراء</TableHead>
              <TableHead className="text-xs text-center">التكلفة</TableHead>
              <TableHead className="text-xs text-center">الإهلاك</TableHead>
              <TableHead className="text-xs text-center">الصافي</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map(a => (
              <TableRow key={a.id}>
                <TableCell className="text-sm font-mono text-muted-foreground">{a.id}</TableCell>
                <TableCell className="text-sm font-medium">{a.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.category}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.purchaseDate}</TableCell>
                <TableCell className="text-center text-sm">{a.cost.toLocaleString()}</TableCell>
                <TableCell className="text-center text-sm text-amber-500">{a.depreciation.toLocaleString()}</TableCell>
                <TableCell className="text-center text-sm font-semibold text-primary">{a.bookValue.toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary text-xs">عرض</button>
                    <button className="text-muted-foreground text-xs">نقل</button>
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

// ─── Depreciation Schedule ─────────────────────────────────────────────────────

function DepreciationSchedulePage() {
  const schedule = [
    { asset: "سيارة تويوتا كامري",  method: "القسط الثابت",   annual: 12000, accumulated: 36000, remaining: 84000 },
    { asset: "حاسوب محمول Dell",    method: "القسط الثابت",   annual: 1600,  accumulated: 3200,  remaining: 4800 },
    { asset: "مبنى المكتب",         method: "القسط الثابت",   annual: 12500, accumulated: 75000, remaining: 425000 },
    { asset: "آلة تصوير Xerox",     method: "القسط المتناقص", annual: 3000,  accumulated: 9000,  remaining: 6000 },
    { asset: "شاحنة نقل",           method: "القسط الثابت",   annual: 20000, accumulated: 80000, remaining: 120000 },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">جدول الإهلاك</h3>
        <Button className="h-8 text-sm" onClick={() => toast.success("تم تشغيل الإهلاك الشهري")}>
          تشغيل الإهلاك
        </Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">الأصل</TableHead>
              <TableHead className="text-xs">طريقة الإهلاك</TableHead>
              <TableHead className="text-xs text-center">الإهلاك السنوي</TableHead>
              <TableHead className="text-xs text-center">الإهلاك المتراكم</TableHead>
              <TableHead className="text-xs text-center">الصافي الدفتري</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedule.map((s, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm font-medium">{s.asset}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.method}</TableCell>
                <TableCell className="text-center text-sm text-amber-500">{s.annual.toLocaleString()}</TableCell>
                <TableCell className="text-center text-sm text-destructive">{s.accumulated.toLocaleString()}</TableCell>
                <TableCell className="text-center text-sm font-semibold text-primary">{s.remaining.toLocaleString()}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-primary/5 font-bold">
              <TableCell colSpan={2} className="text-sm font-bold">الإجمالي</TableCell>
              <TableCell className="text-center text-amber-500 font-bold">
                {schedule.reduce((s, i) => s + i.annual, 0).toLocaleString()}
              </TableCell>
              <TableCell className="text-center text-destructive font-bold">
                {schedule.reduce((s, i) => s + i.accumulated, 0).toLocaleString()}
              </TableCell>
              <TableCell className="text-center text-primary font-bold">
                {schedule.reduce((s, i) => s + i.remaining, 0).toLocaleString()}
              </TableCell>
            </TableRow>
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
      <Building2 className="w-14 h-14 opacity-10" />
      <p className="text-lg font-bold text-foreground">{title}</p>
      <p className="text-sm">هذه الشاشة قيد التطوير</p>
      <Badge variant="outline" className="mt-1">قريباً</Badge>
    </div>
  );
}

// ─── Content Router ────────────────────────────────────────────────────────────

function AssetsContent({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  switch (activeId) {
    case "overview":             return <AssetsOverview onSelect={onSelect} />;
    case "assets-list":
    case "add-asset":            return <AssetsListPage />;
    case "asset-categories":     return <ComingSoon title="فئات الأصول" />;
    case "depreciation-run":
    case "depreciation-schedule":return <DepreciationSchedulePage />;
    case "asset-transfer":
    case "transfer-list":        return <ComingSoon title="نقل الأصول" />;
    case "asset-disposal":
    case "disposal-list":        return <ComingSoon title="التخلص من الأصول" />;
    case "assets-summary":       return <ComingSoon title="ملخص الأصول" />;
    case "depreciation-report":  return <DepreciationSchedulePage />;
    case "asset-movement":       return <ComingSoon title="حركة الأصول" />;
    default:                     return <AssetsOverview onSelect={onSelect} />;
  }
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function AssetsModule() {
  const [activeId, setActiveId] = useState<MenuId>("overview");
  return (
    <div className="flex h-full" dir="rtl">
      <AssetsMenu activeId={activeId} onSelect={setActiveId} />
      <div className="flex-1 overflow-auto p-5">
        <AssetsContent activeId={activeId} onSelect={setActiveId} />
      </div>
    </div>
  );
}

// ─── Tab Sub-Pages ─────────────────────────────────────────────────────────────
function AssetsSubPage({ activeId }: { activeId: string }) {
  return <div className="h-full overflow-auto p-5" dir="rtl"><AssetsContent activeId={activeId} onSelect={() => {}} /></div>;
}
export function AssetsListTab()            { return <AssetsSubPage activeId="assets-list" />; }
export function AssetsAddTab()             { return <AssetsSubPage activeId="add-asset" />; }
export function AssetsCategoriesTab()      { return <AssetsSubPage activeId="asset-categories" />; }
export function AssetsDepreciationTab()    { return <AssetsSubPage activeId="depreciation-run" />; }
export function AssetsDeprScheduleTab()    { return <AssetsSubPage activeId="depreciation-schedule" />; }
export function AssetsTransferTab()        { return <AssetsSubPage activeId="asset-transfer" />; }
export function AssetsTransferListTab()    { return <AssetsSubPage activeId="transfer-list" />; }
export function AssetsDisposalTab()        { return <AssetsSubPage activeId="asset-disposal" />; }
export function AssetsDisposalListTab()    { return <AssetsSubPage activeId="disposal-list" />; }
export function AssetsSummaryTab()         { return <AssetsSubPage activeId="assets-summary" />; }
export function AssetsDeprReportTab()      { return <AssetsSubPage activeId="depreciation-report" />; }
export function AssetsMovementTab()        { return <AssetsSubPage activeId="asset-movement" />; }
