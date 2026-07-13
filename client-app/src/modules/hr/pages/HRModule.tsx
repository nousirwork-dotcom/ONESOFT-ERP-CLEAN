import { useState } from "react";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import {
  ChevronDown, ChevronRight, Users, FileText, BarChart3,
  ClipboardList, Plus, Search, DollarSign, ArrowRight,
  Clock, Calendar, CreditCard, UserCheck, Briefcase,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Badge } from "@/core/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/core/ui/dialog";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type MenuId = string;

export const menuSections = [
  {
    id: "employees",
    label: "الموظفون",
    icon: Users,
    children: [
      { id: "employees-list",  label: "قائمة الموظفين",   icon: Users,      path: "/hr/employees" },
      { id: "add-employee",    label: "إضافة موظف",        icon: Plus,       path: "/hr/add-employee" },
      { id: "departments",     label: "الأقسام",            icon: Briefcase,  path: "/hr/departments" },
      { id: "positions",       label: "المسميات الوظيفية", icon: UserCheck,  path: "/hr/positions" },
    ],
  },
  {
    id: "payroll",
    label: "الرواتب",
    icon: DollarSign,
    children: [
      { id: "payroll-run",    label: "تشغيل الرواتب", icon: DollarSign,   path: "/hr/payroll" },
      { id: "payroll-list",   label: "كشوف الرواتب",  icon: ClipboardList,path: "/hr/payroll-list" },
      { id: "salary-advance", label: "السلف",          icon: CreditCard,   path: "/hr/advances" },
    ],
  },
  {
    id: "attendance",
    label: "الحضور والانصراف",
    icon: Clock,
    children: [
      { id: "attendance-log",    label: "سجل الحضور",   icon: Clock,     path: "/hr/attendance" },
      { id: "attendance-report", label: "تقرير الحضور", icon: BarChart3, path: "/hr/attendance-report" },
      { id: "work-schedule",     label: "جداول العمل",   icon: Calendar,  path: "/hr/schedule" },
    ],
  },
  {
    id: "leaves",
    label: "الإجازات",
    icon: Calendar,
    children: [
      { id: "leave-request", label: "طلب إجازة",       icon: Plus,        path: "/hr/leave-request" },
      { id: "leave-list",    label: "قائمة الإجازات",   icon: ClipboardList,path: "/hr/leaves" },
      { id: "leave-balance", label: "أرصدة الإجازات",   icon: Calendar,    path: "/hr/leave-balance" },
    ],
  },
  {
    id: "hr-reports",
    label: "التقارير",
    icon: BarChart3,
    children: [
      { id: "headcount-report",   label: "تقرير الكوادر", icon: Users,      path: "/hr/headcount" },
      { id: "payroll-report",     label: "تقرير الرواتب", icon: DollarSign, path: "/hr/payroll-report" },
      { id: "attendance-summary", label: "ملخص الحضور",   icon: BarChart3,  path: "/hr/attendance-summary" },
    ],
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function HRMenu({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ employees: true });
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const { openTab } = useTabManager();

  return (
    <nav className="w-56 shrink-0 border-l border-border bg-card/50 overflow-y-auto flex flex-col">
      <div className="p-3 border-b border-border">
        <button onClick={() => onSelect("overview")}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeId === "overview" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent/30"}`}>
          <Users className="w-4 h-4 text-primary" />
          الموارد البشرية
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

function HROverview({ onSelect }: { onSelect: (id: MenuId) => void }) {
  const stats = [
    { label: "إجمالي الموظفين",   value: "48",       color: "text-blue-500",    icon: Users },
    { label: "إجمالي الرواتب",    value: "185,000",  color: "text-emerald-500", icon: DollarSign },
    { label: "طلبات إجازة",       value: "5",        color: "text-amber-500",   icon: Calendar },
    { label: "غياب اليوم",        value: "2",        color: "text-destructive", icon: Clock },
  ];
  const payrollData = [
    { month: "يناير",  payroll: 175000 }, { month: "فبراير", payroll: 178000 },
    { month: "مارس",   payroll: 180000 }, { month: "أبريل",  payroll: 182000 },
    { month: "مايو",   payroll: 185000 }, { month: "يونيو",  payroll: 185000 },
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
        <CardHeader className="pb-2"><CardTitle className="text-sm">تطور الرواتب الشهرية</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={payrollData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
              <Bar dataKey="payroll" fill="hsl(var(--primary))" name="الرواتب" radius={[4,4,0,0]} />
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

// ─── Employees List ────────────────────────────────────────────────────────────

function EmployeesListPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const employees = [
    { id: 1, name: "أحمد محمد علي",    dept: "المبيعات",    position: "مندوب مبيعات",  salary: 5000, status: "نشط" },
    { id: 2, name: "فاطمة عبدالله",    dept: "المحاسبة",    position: "محاسب",          salary: 6000, status: "نشط" },
    { id: 3, name: "محمد إبراهيم",     dept: "المخزون",     position: "أمين مخزن",      salary: 4500, status: "نشط" },
    { id: 4, name: "سارة أحمد",        dept: "الموارد البشرية","position": "مسؤول HR",  salary: 5500, status: "إجازة" },
    { id: 5, name: "خالد العمري",      dept: "تقنية المعلومات","position": "مبرمج",     salary: 8000, status: "نشط" },
  ].filter(e => !search || e.name.includes(search) || e.dept.includes(search));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث عن موظف..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 h-9" />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-9 text-sm"><Plus className="w-4 h-4 ml-1" /> إضافة موظف</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>إضافة موظف جديد</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              {[["الاسم الكامل"],["رقم الهوية"],["الهاتف"],["البريد الإلكتروني"],["تاريخ التعيين"],["الراتب الأساسي"]].map(([l]) => (
                <div key={l}>
                  <Label className="text-xs text-muted-foreground">{l}</Label>
                  <Input className="h-8 text-sm" />
                </div>
              ))}
              <div>
                <Label className="text-xs text-muted-foreground">القسم</Label>
                <Select>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="اختر قسم" /></SelectTrigger>
                  <SelectContent>
                    {["المبيعات","المحاسبة","المخزون","الموارد البشرية","تقنية المعلومات"].map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">المسمى الوظيفي</Label>
                <Input className="h-8 text-sm" />
              </div>
            </div>
            <Button className="w-full mt-2" onClick={() => { toast.success("تم إضافة الموظف"); setOpen(false); }}>حفظ</Button>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">#</TableHead>
              <TableHead className="text-xs">الاسم</TableHead>
              <TableHead className="text-xs">القسم</TableHead>
              <TableHead className="text-xs">المسمى الوظيفي</TableHead>
              <TableHead className="text-xs text-center">الراتب</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map(e => (
              <TableRow key={e.id}>
                <TableCell className="text-sm text-muted-foreground">{e.id}</TableCell>
                <TableCell className="text-sm font-medium">{e.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.dept}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.position}</TableCell>
                <TableCell className="text-center text-sm font-semibold text-primary">{e.salary.toLocaleString()}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={e.status === "نشط" ? "default" : "secondary"}>{e.status}</Badge>
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

// ─── Payroll Run ───────────────────────────────────────────────────────────────

function PayrollRunPage() {
  const [month, setMonth] = useState("2026-05");
  const payrollItems = [
    { name: "أحمد محمد علي",  basic: 5000, allowances: 1000, deductions: 200, net: 5800 },
    { name: "فاطمة عبدالله",  basic: 6000, allowances: 1200, deductions: 300, net: 6900 },
    { name: "محمد إبراهيم",   basic: 4500, allowances: 900,  deductions: 150, net: 5250 },
    { name: "سارة أحمد",      basic: 5500, allowances: 1100, deductions: 250, net: 6350 },
    { name: "خالد العمري",    basic: 8000, allowances: 1600, deductions: 400, net: 9200 },
  ];
  const totalNet = payrollItems.reduce((s, i) => s + i.net, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">تشغيل الرواتب</h3>
        <div className="flex gap-2 items-center">
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-8 text-sm w-40" />
          <Button className="h-8 text-sm" onClick={() => toast.success("تم تشغيل الرواتب بنجاح")}>تشغيل الرواتب</Button>
        </div>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">الموظف</TableHead>
              <TableHead className="text-xs text-center">الراتب الأساسي</TableHead>
              <TableHead className="text-xs text-center">البدلات</TableHead>
              <TableHead className="text-xs text-center">الاستقطاعات</TableHead>
              <TableHead className="text-xs text-center">الصافي</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrollItems.map((p, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm font-medium">{p.name}</TableCell>
                <TableCell className="text-center text-sm">{p.basic.toLocaleString()}</TableCell>
                <TableCell className="text-center text-sm text-emerald-500">+{p.allowances.toLocaleString()}</TableCell>
                <TableCell className="text-center text-sm text-destructive">-{p.deductions.toLocaleString()}</TableCell>
                <TableCell className="text-center text-sm font-bold text-primary">{p.net.toLocaleString()}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-primary/5 font-bold">
              <TableCell className="text-sm font-bold">الإجمالي</TableCell>
              <TableCell colSpan={3}></TableCell>
              <TableCell className="text-center text-primary font-bold">{totalNet.toLocaleString()}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Attendance Log ────────────────────────────────────────────────────────────

function AttendanceLogPage() {
  const today = new Date().toISOString().split("T")[0];
  const records = [
    { name: "أحمد محمد علي",  checkIn: "08:05", checkOut: "17:00", status: "حاضر" },
    { name: "فاطمة عبدالله",  checkIn: "08:15", checkOut: "17:10", status: "حاضر" },
    { name: "محمد إبراهيم",   checkIn: "08:30", checkOut: "16:45", status: "حاضر" },
    { name: "سارة أحمد",      checkIn: "-",      checkOut: "-",     status: "إجازة" },
    { name: "خالد العمري",    checkIn: "09:00", checkOut: "18:00", status: "متأخر" },
  ];
  const statusColor: Record<string, string> = {
    "حاضر":  "bg-emerald-500/10 text-emerald-500",
    "غائب":  "bg-destructive/10 text-destructive",
    "إجازة": "bg-blue-500/10 text-blue-500",
    "متأخر": "bg-amber-500/10 text-amber-500",
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">سجل الحضور والانصراف</h3>
        <Input type="date" defaultValue={today} className="h-8 text-sm w-40" />
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">الموظف</TableHead>
              <TableHead className="text-xs text-center">وقت الحضور</TableHead>
              <TableHead className="text-xs text-center">وقت الانصراف</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm font-medium">{r.name}</TableCell>
                <TableCell className="text-center text-sm font-mono">{r.checkIn}</TableCell>
                <TableCell className="text-center text-sm font-mono">{r.checkOut}</TableCell>
                <TableCell className="text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[r.status]}`}>{r.status}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Leave Requests ────────────────────────────────────────────────────────────

function LeaveRequestsPage() {
  const leaves = [
    { employee: "أحمد محمد علي",  type: "سنوية",   from: "2026-05-10", to: "2026-05-15", days: 5, status: "معتمدة" },
    { employee: "سارة أحمد",      type: "مرضية",   from: "2026-05-07", to: "2026-05-08", days: 2, status: "معتمدة" },
    { employee: "محمد إبراهيم",   type: "طارئة",   from: "2026-05-20", to: "2026-05-20", days: 1, status: "معلقة" },
  ];
  const statusColor: Record<string, string> = {
    "معتمدة": "bg-emerald-500/10 text-emerald-500",
    "مرفوضة": "bg-destructive/10 text-destructive",
    "معلقة":  "bg-amber-500/10 text-amber-500",
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">طلبات الإجازات</h3>
        <Button className="h-8 text-sm" onClick={() => toast.info("طلب إجازة جديد")}>
          <Plus className="w-4 h-4 ml-1" /> طلب إجازة
        </Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">الموظف</TableHead>
              <TableHead className="text-xs">نوع الإجازة</TableHead>
              <TableHead className="text-xs">من</TableHead>
              <TableHead className="text-xs">إلى</TableHead>
              <TableHead className="text-xs text-center">الأيام</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaves.map((l, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm font-medium">{l.employee}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.type}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.from}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.to}</TableCell>
                <TableCell className="text-center text-sm font-semibold">{l.days}</TableCell>
                <TableCell className="text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[l.status]}`}>{l.status}</span>
                </TableCell>
                <TableCell>
                  {l.status === "معلقة" && (
                    <div className="flex gap-2">
                      <button className="text-emerald-500 text-xs" onClick={() => toast.success("تم اعتماد الإجازة")}>اعتماد</button>
                      <button className="text-destructive text-xs" onClick={() => toast.error("تم رفض الإجازة")}>رفض</button>
                    </div>
                  )}
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
      <Users className="w-14 h-14 opacity-10" />
      <p className="text-lg font-bold text-foreground">{title}</p>
      <p className="text-sm">هذه الشاشة قيد التطوير</p>
      <Badge variant="outline" className="mt-1">قريباً</Badge>
    </div>
  );
}

// ─── Content Router ────────────────────────────────────────────────────────────

function HRContent({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  switch (activeId) {
    case "overview":          return <HROverview onSelect={onSelect} />;
    case "employees-list":
    case "add-employee":      return <EmployeesListPage />;
    case "departments":       return <ComingSoon title="الأقسام" />;
    case "positions":         return <ComingSoon title="المسميات الوظيفية" />;
    case "payroll-run":       return <PayrollRunPage />;
    case "payroll-list":      return <ComingSoon title="كشوف الرواتب" />;
    case "salary-advance":    return <ComingSoon title="السلف" />;
    case "attendance-log":    return <AttendanceLogPage />;
    case "attendance-report": return <ComingSoon title="تقرير الحضور" />;
    case "work-schedule":     return <ComingSoon title="جداول العمل" />;
    case "leave-request":
    case "leave-list":
    case "leave-balance":     return <LeaveRequestsPage />;
    case "headcount-report":  return <ComingSoon title="تقرير الكوادر" />;
    case "payroll-report":    return <ComingSoon title="تقرير الرواتب" />;
    case "attendance-summary":return <ComingSoon title="ملخص الحضور" />;
    default:                  return <HROverview onSelect={onSelect} />;
  }
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function HRModule() {
  const [activeId, setActiveId] = useState<MenuId>("overview");
  return (
    <div className="flex h-full" dir="rtl">
      <HRMenu activeId={activeId} onSelect={setActiveId} />
      <div className="flex-1 overflow-auto p-5">
        <HRContent activeId={activeId} onSelect={setActiveId} />
      </div>
    </div>
  );
}

// ─── Tab Sub-Pages ─────────────────────────────────────────────────────────────
function HRSubPage({ activeId }: { activeId: string }) {
  return <div className="h-full overflow-auto p-5" dir="rtl"><HRContent activeId={activeId} onSelect={() => {}} /></div>;
}
export function HREmployeesTab()         { return <HRSubPage activeId="employees-list" />; }
export function HRAddEmployeeTab()       { return <HRSubPage activeId="add-employee" />; }
export function HRDepartmentsTab()       { return <HRSubPage activeId="departments" />; }
export function HRPositionsTab()         { return <HRSubPage activeId="positions" />; }
export function HRPayrollTab()           { return <HRSubPage activeId="payroll-run" />; }
export function HRPayrollListTab()       { return <HRSubPage activeId="payroll-list" />; }
export function HRAdvancesTab()          { return <HRSubPage activeId="salary-advance" />; }
export function HRAttendanceTab()        { return <HRSubPage activeId="attendance-log" />; }
export function HRAttendanceReportTab()  { return <HRSubPage activeId="attendance-report" />; }
export function HRScheduleTab()          { return <HRSubPage activeId="work-schedule" />; }
export function HRLeaveRequestTab()      { return <HRSubPage activeId="leave-request" />; }
export function HRLeavesTab()            { return <HRSubPage activeId="leave-list" />; }
export function HRLeaveBalanceTab()      { return <HRSubPage activeId="leave-balance" />; }
export function HRHeadcountTab()         { return <HRSubPage activeId="headcount-report" />; }
export function HRPayrollReportTab()     { return <HRSubPage activeId="payroll-report" />; }
export function HRAttendanceSummaryTab() { return <HRSubPage activeId="attendance-summary" />; }
