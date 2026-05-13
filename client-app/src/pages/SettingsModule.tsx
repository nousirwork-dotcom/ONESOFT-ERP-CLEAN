import { useState } from "react";
import { useTabManager } from "@/contexts/TabManagerContext";
import {
  ChevronDown, ChevronRight, Settings, Building2, DollarSign,
  Calendar, Users, Shield, Database, FileText, History,
  Warehouse, Tag, BookOpen, Layout, Download, Bell,
  ArrowRight, Save, Plus, Trash2, Edit2, Clock, GitBranch,
  AlertTriangle, CheckCircle, XCircle, BarChart2, Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type MenuId = string;

// status: "done" = ✅ أخضر, "partial" = ▲ برتقالي, "missing" = ❌ أحمر
const menuSections = [
  {
    id: "general",
    label: "الإعدادات العامة",
    color: "#a855f7",
    emoji: "📁",
    children: [
      { id: "company-info",   label: "معلومات الشركة",      status: "done",    path: "/cfg/company" },
      { id: "currencies",     label: "العملات",              status: "done",    path: "/cfg/currencies" },
      { id: "taxes",          label: "الضرائب",              status: "done",    path: "/cfg/taxes" },
      { id: "fiscal-periods", label: "الفترات المحاسبية",    status: "done",    path: "/cfg/fiscal" },
      { id: "users-list",     label: "المستخدمين",           status: "missing", path: "/cfg/users" },
      { id: "user-groups",    label: "مجموعات المستخدمين",   status: "missing", path: "/cfg/user-groups" },
      { id: "permissions",    label: "صلاحيات المستخدمين",   status: "missing", path: "/cfg/permissions" },
    ],
  },
  {
    id: "approvals",
    label: "سير الموافقات والاعتمادات",
    color: "#a855f7",
    emoji: "📁",
    children: [
      { id: "approve-invoice",   label: "طلب اعتماد فاتورة",         status: "partial", path: "/cfg/approve-invoice" },
      { id: "approve-purchase",  label: "اعتماد أمر شراء",           status: "partial", path: "/cfg/approve-purchase" },
      { id: "approve-discount",  label: "اعتماد خصم / عرض خاص",     status: "partial", path: "/cfg/approve-discount" },
      { id: "approve-inventory", label: "اعتماد تسوية مخزنية",       status: "partial", path: "/cfg/approve-inventory" },
      { id: "approve-journal",   label: "اعتماد قيد يومية",          status: "partial", path: "/cfg/approve-journal" },
      { id: "approvals-log",     label: "سجل الموافقات",             status: "partial", path: "/cfg/approvals-log" },
      { id: "approval-paths",    label: "مسارات الاعتماد حسب القسم", status: "missing", path: "/cfg/approval-paths" },
    ],
  },
  {
    id: "notifications",
    label: "الإشعارات والتنبيهات",
    color: "#a855f7",
    emoji: "📁",
    children: [
      { id: "notif-stock",       label: "تنبيه نقص المخزون",                  status: "partial", path: "/cfg/notif-stock" },
      { id: "notif-credit",      label: "تنبيه تجاوز الحد الائتماني للعميل", status: "partial", path: "/cfg/notif-credit" },
      { id: "notif-overdue",     label: "تنبيه فواتير مستحقة أو متأخرة",     status: "partial", path: "/cfg/notif-overdue" },
      { id: "notif-expiry",      label: "تنبيه انتهاء صلاحية مواد خام",      status: "partial", path: "/cfg/notif-expiry" },
      { id: "notif-maintenance", label: "تنبيه اقتراب صيانة أصل أو ماكينة", status: "partial", path: "/cfg/notif-maintenance" },
      { id: "notif-pending",     label: "تنبيه مستندات بانتظار الاعتماد",    status: "partial", path: "/cfg/notif-pending" },
    ],
  },
  {
    id: "system",
    label: "النظام",
    color: "#a855f7",
    emoji: "📁",
    children: [
      { id: "warehouses-config", label: "المخازن",           status: "partial", path: "/cfg/warehouses" },
      { id: "doc-types",         label: "أنواع المستندات",    status: "partial", path: "/cfg/doc-types" },
      { id: "doc-books",         label: "دفاتر المستندات",    status: "missing", path: "/cfg/doc-books" },
      { id: "field-design",      label: "تصميم الحقول",       status: "missing", path: "/cfg/field-design" },
      { id: "backup",            label: "النسخ الاحتياطي",    status: "done",    path: "/cfg/backup" },
      { id: "audit-log",         label: "سجل العمليات",       status: "done",    path: "/cfg/audit-log" },
    ],
  },
  {
    id: "hr-settings",
    label: "باقي الإعدادات",
    color: "#a855f7",
    emoji: "📁",
    children: [
      { id: "missing-doc-numbers", label: "أرقام المستندات المفقودة", status: "partial", path: "/cfg/missing-docs" },
      { id: "payroll-periods",     label: "فترات الرواتب",            status: "partial", path: "/cfg/payroll-periods" },
      { id: "org-chart",           label: "ملف الهيكل الإداري",       status: "partial", path: "/cfg/org-chart" },
      { id: "wage-calendar",       label: "تقويم نظام الأجور",        status: "partial", path: "/cfg/wage-calendar" },
      { id: "shifts-setup",        label: "ملف الدوامات",             status: "partial", path: "/cfg/shifts" },
      { id: "report-designer",     label: "أدوات التقارير",           status: "partial", path: "/cfg/report-designer" },
      { id: "test-files-setup",    label: "إعداد ملفات الاختبار",     status: "missing", path: "/cfg/test-setup" },
      { id: "test-files-edit",     label: "تحرير ملفات الاختبار",     status: "missing", path: "/cfg/test-edit" },
      { id: "field-specs",         label: "مواصفات الحقول",           status: "missing", path: "/cfg/field-specs" },
    ],
  },
];

// ─── Status Icon ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  if (status === "done")    return <span className="text-green-400 text-xs font-bold">✓</span>;
  if (status === "partial") return <span className="text-orange-400 text-xs font-bold">▲</span>;
  return <span className="text-red-400 text-xs font-bold">✕</span>;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function SettingsMenu({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    general: true,
    approvals: false,
    notifications: false,
    system: false,
    "hr-settings": false,
  });
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const { openTab } = useTabManager();

  return (
    <nav className="w-64 shrink-0 border-l border-border bg-[#1a1a2e] overflow-y-auto flex flex-col">
      <div className="px-4 py-3 border-b border-border/30">
        <button onClick={() => onSelect("overview")}
          className="w-full flex items-center justify-end gap-2 text-sm font-bold text-[#a855f7] hover:opacity-80 transition-opacity">
          الإعدادات
          <Settings className="w-4 h-4" />
        </button>
      </div>
      <div className="py-1 flex-1">
        {menuSections.map(section => (
          <div key={section.id}>
            <button onClick={() => toggle(section.id)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors">
              <span className="text-base">{section.emoji}</span>
              <span className="flex-1 text-right text-xs font-semibold" style={{ color: section.color }}>{section.label}</span>
              {expanded[section.id]
                ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
                : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </button>
            {expanded[section.id] && (
              <div className="mb-1">
                {section.children.map(child => (
                  <button key={child.id} onClick={() => { onSelect(child.id); openTab(child.path, child.label, Settings); }}
                    className={`w-full flex items-center gap-2 px-4 py-1.5 text-xs transition-colors ${
                      activeId === child.id
                        ? "bg-[#a855f7]/15 text-white font-semibold"
                        : "text-gray-300 hover:text-white hover:bg-white/5"
                    }`}>
                    <StatusIcon status={child.status} />
                    <span className="flex-1 text-right leading-tight">{child.label}</span>
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

function SettingsOverview({ onSelect }: { onSelect: (id: MenuId) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold mb-1">إعدادات النظام</h2>
        <p className="text-muted-foreground text-sm">إدارة إعدادات النظام والتهيئة العامة لـ ONESOFT ERP</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {menuSections.map(group => (
          <Card key={group.id} className="border-border/50 hover:border-primary/30 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="text-base">{group.emoji}</span>
                <span style={{ color: group.color }}>{group.label}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0">
              {group.children.map(item => (
                <button key={item.id} onClick={() => onSelect(item.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors">
                  <StatusIcon status={item.status} />
                  <span className="flex-1 text-right">{item.label}</span>
                  <ArrowRight className="w-2.5 h-2.5 shrink-0 opacity-50" />
                </button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Company Info ──────────────────────────────────────────────────────────────

function CompanyInfoPage() {
  const [form, setForm] = useState({
    name: "ONESOFT ERP", nameEn: "ONESOFT ERP",
    address: "الرياض، المملكة العربية السعودية", phone: "+966 11 000 0000",
    email: "info@onesoft.sa", website: "www.onesoft.sa",
    taxNumber: "300000000000003", crNumber: "1010000000",
    currency: "SAR", language: "ar",
  });
  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-4 max-w-2xl">
      <h3 className="font-semibold text-sm">معلومات الشركة</h3>
      <Card className="border-border/50">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[["name","اسم الشركة (عربي)"],["nameEn","اسم الشركة (إنجليزي)"],["address","العنوان"],["phone","الهاتف"],["email","البريد الإلكتروني"],["website","الموقع الإلكتروني"],["taxNumber","الرقم الضريبي"],["crNumber","السجل التجاري"]].map(([k,l]) => (
              <div key={k}>
                <Label className="text-xs text-muted-foreground">{l}</Label>
                <Input value={(form as any)[k]} onChange={e => update(k, e.target.value)} className="h-8 text-sm mt-1" />
              </div>
            ))}
            <div>
              <Label className="text-xs text-muted-foreground">العملة الأساسية</Label>
              <Select value={form.currency} onValueChange={v => update("currency", v)}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                  <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                  <SelectItem value="EUR">يورو (EUR)</SelectItem>
                  <SelectItem value="AED">درهم إماراتي (AED)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">لغة النظام</Label>
              <Select value={form.language} onValueChange={v => update("language", v)}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full h-9" onClick={() => toast.success("تم حفظ معلومات الشركة")}>
            <Save className="w-4 h-4 ml-2" /> حفظ التغييرات
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Currencies ────────────────────────────────────────────────────────────────

function CurrenciesPage() {
  const currencies = [
    { code: "SAR", name: "ريال سعودي",    symbol: "ر.س", rate: 1,    isBase: true },
    { code: "USD", name: "دولار أمريكي",  symbol: "$",   rate: 3.75, isBase: false },
    { code: "EUR", name: "يورو",           symbol: "€",   rate: 4.10, isBase: false },
    { code: "AED", name: "درهم إماراتي",  symbol: "د.إ", rate: 1.02, isBase: false },
    { code: "GBP", name: "جنيه إسترليني", symbol: "£",   rate: 4.75, isBase: false },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">إدارة العملات</h3>
        <Button className="h-8 text-sm" onClick={() => toast.info("إضافة عملة جديدة")}><Plus className="w-3.5 h-3.5 ml-1" />إضافة عملة</Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">الكود</TableHead>
              <TableHead className="text-xs">العملة</TableHead>
              <TableHead className="text-xs">الرمز</TableHead>
              <TableHead className="text-xs text-center">سعر الصرف</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currencies.map(c => (
              <TableRow key={c.code}>
                <TableCell className="text-xs font-mono font-bold">{c.code}</TableCell>
                <TableCell className="text-xs">{c.name}</TableCell>
                <TableCell className="text-xs">{c.symbol}</TableCell>
                <TableCell className="text-xs text-center">{c.rate.toFixed(4)}</TableCell>
                <TableCell className="text-center">
                  {c.isBase ? <Badge className="text-xs">أساسية</Badge> : <Badge variant="secondary" className="text-xs">فعّالة</Badge>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary text-xs hover:underline" onClick={() => toast.info("تعديل العملة")}>تعديل</button>
                    {!c.isBase && <button className="text-destructive text-xs hover:underline" onClick={() => toast.error("حذف العملة")}>حذف</button>}
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

// ─── Taxes ─────────────────────────────────────────────────────────────────────

function TaxesPage() {
  const taxes = [
    { id: 1, name: "ضريبة القيمة المضافة", code: "VAT", rate: 15, type: "نسبة مئوية", active: true },
    { id: 2, name: "ضريبة الاستقطاع",      code: "WHT", rate: 5,  type: "نسبة مئوية", active: true },
    { id: 3, name: "رسوم جمركية",           code: "CUS", rate: 5,  type: "نسبة مئوية", active: false },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">إدارة الضرائب والرسوم</h3>
        <Button className="h-8 text-sm" onClick={() => toast.info("إضافة ضريبة")}><Plus className="w-3.5 h-3.5 ml-1" />إضافة ضريبة</Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">اسم الضريبة</TableHead>
              <TableHead className="text-xs">الكود</TableHead>
              <TableHead className="text-xs text-center">النسبة %</TableHead>
              <TableHead className="text-xs">النوع</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taxes.map(t => (
              <TableRow key={t.id}>
                <TableCell className="text-xs font-medium">{t.name}</TableCell>
                <TableCell className="text-xs font-mono">{t.code}</TableCell>
                <TableCell className="text-xs text-center">{t.rate}%</TableCell>
                <TableCell className="text-xs">{t.type}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={t.active ? "default" : "secondary"} className="text-xs">{t.active ? "فعّال" : "موقوف"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary text-xs hover:underline" onClick={() => toast.info("تعديل")}>تعديل</button>
                    <button className="text-destructive text-xs hover:underline" onClick={() => toast.error("حذف")}>حذف</button>
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

// ─── Fiscal Periods ────────────────────────────────────────────────────────────

function FiscalPeriodsPage() {
  const periods = [
    { id: 1, name: "2024", start: "2024-01-01", end: "2024-12-31", status: "مغلقة" },
    { id: 2, name: "2025", start: "2025-01-01", end: "2025-12-31", status: "مفتوحة" },
    { id: 3, name: "2026", start: "2026-01-01", end: "2026-12-31", status: "مفتوحة" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">الفترات المحاسبية</h3>
        <Button className="h-8 text-sm" onClick={() => toast.info("إضافة فترة")}><Plus className="w-3.5 h-3.5 ml-1" />فترة جديدة</Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">الفترة</TableHead>
              <TableHead className="text-xs">تاريخ البداية</TableHead>
              <TableHead className="text-xs">تاريخ النهاية</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.map(p => (
              <TableRow key={p.id}>
                <TableCell className="text-xs font-bold">{p.name}</TableCell>
                <TableCell className="text-xs">{p.start}</TableCell>
                <TableCell className="text-xs">{p.end}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={p.status === "مفتوحة" ? "default" : "secondary"} className="text-xs">{p.status}</Badge>
                </TableCell>
                <TableCell>
                  <button className="text-primary text-xs hover:underline" onClick={() => toast.info(p.status === "مفتوحة" ? "إغلاق الفترة" : "فتح الفترة")}>
                    {p.status === "مفتوحة" ? "إغلاق" : "فتح"}
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Users List ────────────────────────────────────────────────────────────────

function UsersListPage() {
  const users = [
    { id: 1, name: "أحمد محمد",   email: "ahmed@co.sa",  role: "مدير النظام", status: "نشط",    lastLogin: "اليوم" },
    { id: 2, name: "سارة علي",    email: "sara@co.sa",   role: "محاسب",       status: "نشط",    lastLogin: "أمس" },
    { id: 3, name: "خالد يوسف",   email: "khalid@co.sa", role: "مبيعات",      status: "نشط",    lastLogin: "3 أيام" },
    { id: 4, name: "منى حسن",     email: "mona@co.sa",   role: "مخازن",       status: "موقوف",  lastLogin: "أسبوع" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">إدارة المستخدمين</h3>
        <Button className="h-8 text-sm" onClick={() => toast.info("إضافة مستخدم")}><Plus className="w-3.5 h-3.5 ml-1" />مستخدم جديد</Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">الاسم</TableHead>
              <TableHead className="text-xs">البريد الإلكتروني</TableHead>
              <TableHead className="text-xs">الدور</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">آخر دخول</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="text-xs font-medium">{u.name}</TableCell>
                <TableCell className="text-xs">{u.email}</TableCell>
                <TableCell className="text-xs">{u.role}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={u.status === "نشط" ? "default" : "secondary"} className="text-xs">{u.status}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.lastLogin}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary text-xs hover:underline" onClick={() => toast.info("تعديل المستخدم")}>تعديل</button>
                    <button className="text-amber-500 text-xs hover:underline" onClick={() => toast.info("إعادة تعيين كلمة المرور")}>كلمة المرور</button>
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

// ─── User Groups ───────────────────────────────────────────────────────────────

function UserGroupsPage() {
  const groups = [
    { id: 1, name: "مديرو النظام",  users: 2, permissions: "كاملة" },
    { id: 2, name: "المحاسبون",     users: 5, permissions: "الحسابات والتقارير" },
    { id: 3, name: "فريق المبيعات", users: 8, permissions: "المبيعات والعملاء" },
    { id: 4, name: "أمناء المخازن", users: 3, permissions: "المخزون فقط" },
    { id: 5, name: "الموارد البشرية",users: 2, permissions: "HR فقط" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">مجموعات المستخدمين</h3>
        <Button className="h-8 text-sm" onClick={() => toast.info("إضافة مجموعة")}><Plus className="w-3.5 h-3.5 ml-1" />مجموعة جديدة</Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">اسم المجموعة</TableHead>
              <TableHead className="text-xs text-center">عدد المستخدمين</TableHead>
              <TableHead className="text-xs">الصلاحيات</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map(g => (
              <TableRow key={g.id}>
                <TableCell className="text-xs font-medium">{g.name}</TableCell>
                <TableCell className="text-xs text-center">{g.users}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{g.permissions}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary text-xs hover:underline" onClick={() => toast.info("تعديل المجموعة")}>تعديل</button>
                    <button className="text-primary text-xs hover:underline" onClick={() => toast.info("إدارة الصلاحيات")}>الصلاحيات</button>
                    <button className="text-destructive text-xs hover:underline" onClick={() => toast.error("حذف المجموعة")}>حذف</button>
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

// ─── Permissions ───────────────────────────────────────────────────────────────

function PermissionsPage() {
  const modules = [
    { name: "المبيعات",         read: true,  write: true,  delete: false, approve: false },
    { name: "المشتريات",        read: true,  write: true,  delete: false, approve: true  },
    { name: "المخزون",          read: true,  write: true,  delete: false, approve: false },
    { name: "الحسابات العامة",  read: true,  write: false, delete: false, approve: false },
    { name: "الموارد البشرية",  read: false, write: false, delete: false, approve: false },
    { name: "الأصول الثابتة",   read: true,  write: false, delete: false, approve: false },
    { name: "الإعدادات",        read: false, write: false, delete: false, approve: false },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">صلاحيات المستخدمين</h3>
        <Select defaultValue="sales-team">
          <SelectTrigger className="h-8 text-xs w-48"><SelectValue placeholder="اختر المجموعة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="admins">مديرو النظام</SelectItem>
            <SelectItem value="accountants">المحاسبون</SelectItem>
            <SelectItem value="sales-team">فريق المبيعات</SelectItem>
            <SelectItem value="warehouse">أمناء المخازن</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">الوحدة</TableHead>
              <TableHead className="text-xs text-center">قراءة</TableHead>
              <TableHead className="text-xs text-center">كتابة</TableHead>
              <TableHead className="text-xs text-center">حذف</TableHead>
              <TableHead className="text-xs text-center">اعتماد</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map(m => (
              <TableRow key={m.name}>
                <TableCell className="text-xs font-medium">{m.name}</TableCell>
                {[m.read, m.write, m.delete, m.approve].map((v, i) => (
                  <TableCell key={i} className="text-center">
                    {v ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Button className="h-9" onClick={() => toast.success("تم حفظ الصلاحيات")}><Save className="w-4 h-4 ml-2" />حفظ الصلاحيات</Button>
    </div>
  );
}

// ─── Approvals Generic ─────────────────────────────────────────────────────────

function ApprovalsPage({ title, docType }: { title: string; docType: string }) {
  const records = [
    { id: "APR-001", requester: "أحمد محمد",  date: "2026-05-07", amount: "15,000 ر.س", status: "معلق" },
    { id: "APR-002", requester: "سارة علي",   date: "2026-05-06", amount: "8,500 ر.س",  status: "معتمد" },
    { id: "APR-003", requester: "خالد يوسف",  date: "2026-05-05", amount: "22,000 ر.س", status: "مرفوض" },
  ];
  const statusColor: Record<string,string> = { "معلق": "secondary", "معتمد": "default", "مرفوض": "destructive" };
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">{title}</h3>
      <div className="flex gap-3">
        {[["معلق","⏳","text-amber-500"],["معتمد","✅","text-green-500"],["مرفوض","❌","text-red-500"]].map(([s,i,c]) => (
          <Card key={s} className="flex-1 border-border/50">
            <CardContent className="p-3 text-center">
              <div className={`text-xl font-bold ${c}`}>{records.filter(r=>r.status===s).length}</div>
              <div className="text-xs text-muted-foreground">{i} {s}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">رقم الطلب</TableHead>
              <TableHead className="text-xs">مقدم الطلب</TableHead>
              <TableHead className="text-xs">التاريخ</TableHead>
              <TableHead className="text-xs">المبلغ</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-xs font-mono">{r.id}</TableCell>
                <TableCell className="text-xs">{r.requester}</TableCell>
                <TableCell className="text-xs">{r.date}</TableCell>
                <TableCell className="text-xs">{r.amount}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={(statusColor[r.status] || "secondary") as any} className="text-xs">{r.status}</Badge>
                </TableCell>
                <TableCell>
                  {r.status === "معلق" && (
                    <div className="flex gap-2">
                      <button className="text-green-500 text-xs hover:underline" onClick={() => toast.success("تم الاعتماد")}>اعتماد</button>
                      <button className="text-destructive text-xs hover:underline" onClick={() => toast.error("تم الرفض")}>رفض</button>
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

// ─── Approvals Log ─────────────────────────────────────────────────────────────

function ApprovalsLogPage() {
  const logs = [
    { id: "APR-001", type: "فاتورة مبيعات",  action: "اعتماد",  user: "مدير المبيعات", date: "2026-05-07 10:30", note: "تمت الموافقة" },
    { id: "APR-002", type: "أمر شراء",        action: "رفض",     user: "المدير المالي", date: "2026-05-06 14:15", note: "تجاوز الميزانية" },
    { id: "APR-003", type: "تسوية مخزنية",    action: "اعتماد",  user: "مدير المخزن",  date: "2026-05-05 09:00", note: "" },
  ];
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">سجل الموافقات</h3>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">رقم المستند</TableHead>
              <TableHead className="text-xs">النوع</TableHead>
              <TableHead className="text-xs">الإجراء</TableHead>
              <TableHead className="text-xs">المعتمد</TableHead>
              <TableHead className="text-xs">التاريخ</TableHead>
              <TableHead className="text-xs">ملاحظة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map(l => (
              <TableRow key={l.id}>
                <TableCell className="text-xs font-mono">{l.id}</TableCell>
                <TableCell className="text-xs">{l.type}</TableCell>
                <TableCell className="text-xs">
                  <Badge variant={l.action === "اعتماد" ? "default" : "destructive"} className="text-xs">{l.action}</Badge>
                </TableCell>
                <TableCell className="text-xs">{l.user}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.date}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.note || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Approval Paths ────────────────────────────────────────────────────────────

function ApprovalPathsPage() {
  const paths = [
    { id: 1, docType: "فاتورة مبيعات",  minAmount: 0,      maxAmount: 10000,  approver: "مدير المبيعات",  level: 1 },
    { id: 2, docType: "فاتورة مبيعات",  minAmount: 10001,  maxAmount: 50000,  approver: "المدير المالي",  level: 2 },
    { id: 3, docType: "أمر شراء",        minAmount: 0,      maxAmount: 5000,   approver: "مدير المشتريات", level: 1 },
    { id: 4, docType: "أمر شراء",        minAmount: 5001,   maxAmount: 999999, approver: "المدير العام",   level: 2 },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">مسارات الاعتماد حسب القيمة أو القسم</h3>
        <Button className="h-8 text-sm" onClick={() => toast.info("إضافة مسار")}><Plus className="w-3.5 h-3.5 ml-1" />مسار جديد</Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">نوع المستند</TableHead>
              <TableHead className="text-xs text-center">من (ر.س)</TableHead>
              <TableHead className="text-xs text-center">إلى (ر.س)</TableHead>
              <TableHead className="text-xs">المعتمد</TableHead>
              <TableHead className="text-xs text-center">المستوى</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paths.map(p => (
              <TableRow key={p.id}>
                <TableCell className="text-xs font-medium">{p.docType}</TableCell>
                <TableCell className="text-xs text-center">{p.minAmount.toLocaleString()}</TableCell>
                <TableCell className="text-xs text-center">{p.maxAmount.toLocaleString()}</TableCell>
                <TableCell className="text-xs">{p.approver}</TableCell>
                <TableCell className="text-xs text-center">
                  <Badge variant="outline" className="text-xs">مستوى {p.level}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary text-xs hover:underline" onClick={() => toast.info("تعديل")}>تعديل</button>
                    <button className="text-destructive text-xs hover:underline" onClick={() => toast.error("حذف")}>حذف</button>
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

// ─── Notifications Settings ────────────────────────────────────────────────────

function NotificationSettingsPage({ title, description }: { title: string; description: string }) {
  const [enabled, setEnabled] = useState(true);
  const [threshold, setThreshold] = useState("10");
  const [channels, setChannels] = useState({ email: true, sms: false, inApp: true });
  return (
    <div className="space-y-4 max-w-xl">
      <h3 className="font-semibold text-sm">{title}</h3>
      <Card className="border-border/50">
        <CardContent className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">تفعيل التنبيه</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          {enabled && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">الحد الأدنى للتنبيه</Label>
                <Input value={threshold} onChange={e => setThreshold(e.target.value)} className="h-8 text-sm mt-1 max-w-xs" />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium">قنوات الإشعار</p>
                {[["email","البريد الإلكتروني"],["sms","رسالة SMS"],["inApp","داخل النظام"]].map(([k,l]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{l}</span>
                    <Switch checked={(channels as any)[k]} onCheckedChange={v => setChannels(p => ({...p,[k]:v}))} />
                  </div>
                ))}
              </div>
            </>
          )}
          <Button className="w-full h-9" onClick={() => toast.success("تم حفظ إعدادات التنبيه")}>
            <Save className="w-4 h-4 ml-2" />حفظ الإعدادات
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Warehouses Config ─────────────────────────────────────────────────────────

function WarehousesConfigPage() {
  const warehouses = [
    { id: 1, name: "المستودع الرئيسي",  code: "WH-001", location: "الرياض",  manager: "أحمد علي",  active: true },
    { id: 2, name: "مستودع الإنتاج",    code: "WH-002", location: "جدة",     manager: "سالم محمد", active: true },
    { id: 3, name: "مستودع الأرشيف",    code: "WH-003", location: "الدمام",  manager: "نورة خالد", active: false },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">إدارة المخازن</h3>
        <Button className="h-8 text-sm" onClick={() => toast.info("إضافة مخزن")}><Plus className="w-3.5 h-3.5 ml-1" />مخزن جديد</Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">اسم المخزن</TableHead>
              <TableHead className="text-xs">الكود</TableHead>
              <TableHead className="text-xs">الموقع</TableHead>
              <TableHead className="text-xs">المسؤول</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehouses.map(w => (
              <TableRow key={w.id}>
                <TableCell className="text-xs font-medium">{w.name}</TableCell>
                <TableCell className="text-xs font-mono">{w.code}</TableCell>
                <TableCell className="text-xs">{w.location}</TableCell>
                <TableCell className="text-xs">{w.manager}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={w.active ? "default" : "secondary"} className="text-xs">{w.active ? "نشط" : "موقوف"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary text-xs hover:underline" onClick={() => toast.info("تعديل")}>تعديل</button>
                    <button className="text-destructive text-xs hover:underline" onClick={() => toast.error("حذف")}>حذف</button>
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

// ─── Doc Types ─────────────────────────────────────────────────────────────────

function DocTypesPage() {
  const types = [
    { id: 1, name: "فاتورة مبيعات",   code: "INV",  module: "المبيعات",   prefix: "INV-", active: true },
    { id: 2, name: "فاتورة مشتريات",  code: "PUR",  module: "المشتريات",  prefix: "PUR-", active: true },
    { id: 3, name: "سند قبض",         code: "RCV",  module: "الحسابات",   prefix: "RCV-", active: true },
    { id: 4, name: "سند صرف",         code: "PAY",  module: "الحسابات",   prefix: "PAY-", active: true },
    { id: 5, name: "سند تحويل مخزني", code: "TRF",  module: "المخزون",    prefix: "TRF-", active: true },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">أنواع المستندات</h3>
        <Button className="h-8 text-sm" onClick={() => toast.info("إضافة نوع")}><Plus className="w-3.5 h-3.5 ml-1" />نوع جديد</Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">اسم المستند</TableHead>
              <TableHead className="text-xs">الكود</TableHead>
              <TableHead className="text-xs">الوحدة</TableHead>
              <TableHead className="text-xs">البادئة</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map(t => (
              <TableRow key={t.id}>
                <TableCell className="text-xs font-medium">{t.name}</TableCell>
                <TableCell className="text-xs font-mono">{t.code}</TableCell>
                <TableCell className="text-xs">{t.module}</TableCell>
                <TableCell className="text-xs font-mono">{t.prefix}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={t.active ? "default" : "secondary"} className="text-xs">{t.active ? "فعّال" : "موقوف"}</Badge>
                </TableCell>
                <TableCell>
                  <button className="text-primary text-xs hover:underline" onClick={() => toast.info("تعديل")}>تعديل</button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Doc Books ─────────────────────────────────────────────────────────────────

function DocBooksPage() {
  const books = [
    { id: 1, name: "دفتر فواتير المبيعات",  docType: "فاتورة مبيعات",  from: 1,    to: 9999,  current: 47,  active: true },
    { id: 2, name: "دفتر فواتير المشتريات", docType: "فاتورة مشتريات", from: 1,    to: 9999,  current: 23,  active: true },
    { id: 3, name: "دفتر سندات القبض",      docType: "سند قبض",        from: 1000, to: 1999,  current: 1015,active: true },
    { id: 4, name: "دفتر سندات الصرف",      docType: "سند صرف",        from: 2000, to: 2999,  current: 2008,active: true },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">دفاتر المستندات</h3>
        <Button className="h-8 text-sm" onClick={() => toast.info("إضافة دفتر")}><Plus className="w-3.5 h-3.5 ml-1" />دفتر جديد</Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">اسم الدفتر</TableHead>
              <TableHead className="text-xs">نوع المستند</TableHead>
              <TableHead className="text-xs text-center">من</TableHead>
              <TableHead className="text-xs text-center">إلى</TableHead>
              <TableHead className="text-xs text-center">الرقم الحالي</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {books.map(b => (
              <TableRow key={b.id}>
                <TableCell className="text-xs font-medium">{b.name}</TableCell>
                <TableCell className="text-xs">{b.docType}</TableCell>
                <TableCell className="text-xs text-center">{b.from}</TableCell>
                <TableCell className="text-xs text-center">{b.to}</TableCell>
                <TableCell className="text-xs text-center font-bold text-primary">{b.current}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={b.active ? "default" : "secondary"} className="text-xs">{b.active ? "نشط" : "مغلق"}</Badge>
                </TableCell>
                <TableCell>
                  <button className="text-primary text-xs hover:underline" onClick={() => toast.info("تعديل الدفتر")}>تعديل</button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Field Design ──────────────────────────────────────────────────────────────

function FieldDesignPage() {
  const screens = ["فاتورة مبيعات","فاتورة مشتريات","سند قبض","سند صرف","أمر شراء","أمر بيع"];
  const [selected, setSelected] = useState("فاتورة مبيعات");
  const fields = [
    { name: "رقم الفاتورة",   type: "نص",    required: true,  visible: true,  order: 1 },
    { name: "التاريخ",        type: "تاريخ", required: true,  visible: true,  order: 2 },
    { name: "العميل",         type: "قائمة", required: true,  visible: true,  order: 3 },
    { name: "ملاحظات",        type: "نص طويل",required: false, visible: true,  order: 4 },
    { name: "مرجع خارجي",    type: "نص",    required: false, visible: false, order: 5 },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">تصميم الحقول</h3>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="h-8 text-xs w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{screens.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">اسم الحقل</TableHead>
              <TableHead className="text-xs">النوع</TableHead>
              <TableHead className="text-xs text-center">إلزامي</TableHead>
              <TableHead className="text-xs text-center">مرئي</TableHead>
              <TableHead className="text-xs text-center">الترتيب</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map(f => (
              <TableRow key={f.name}>
                <TableCell className="text-xs font-medium">{f.name}</TableCell>
                <TableCell className="text-xs">{f.type}</TableCell>
                <TableCell className="text-center"><Switch checked={f.required} /></TableCell>
                <TableCell className="text-center"><Switch checked={f.visible} /></TableCell>
                <TableCell className="text-xs text-center">{f.order}</TableCell>
                <TableCell>
                  <button className="text-primary text-xs hover:underline" onClick={() => toast.info("تعديل الحقل")}>تعديل</button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Backup ────────────────────────────────────────────────────────────────────

function BackupPage() {
  const backups = [
    { id: 1, name: "نسخة_2026-05-07_10:00", size: "45 MB", date: "2026-05-07 10:00", type: "تلقائي" },
    { id: 2, name: "نسخة_2026-05-06_10:00", size: "44 MB", date: "2026-05-06 10:00", type: "تلقائي" },
    { id: 3, name: "نسخة_يدوية_2026-05-05", size: "43 MB", date: "2026-05-05 15:30", type: "يدوي" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">النسخ الاحتياطي</h3>
        <Button className="h-8 text-sm" onClick={() => toast.success("جاري إنشاء نسخة احتياطية...")}><Download className="w-3.5 h-3.5 ml-1" />نسخ الآن</Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">اسم النسخة</TableHead>
              <TableHead className="text-xs">الحجم</TableHead>
              <TableHead className="text-xs">التاريخ</TableHead>
              <TableHead className="text-xs text-center">النوع</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backups.map(b => (
              <TableRow key={b.id}>
                <TableCell className="text-xs font-mono">{b.name}</TableCell>
                <TableCell className="text-xs">{b.size}</TableCell>
                <TableCell className="text-xs">{b.date}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={b.type === "يدوي" ? "default" : "secondary"} className="text-xs">{b.type}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary text-xs hover:underline" onClick={() => toast.info("جاري التنزيل...")}>تنزيل</button>
                    <button className="text-amber-500 text-xs hover:underline" onClick={() => toast.info("جاري الاستعادة...")}>استعادة</button>
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

// ─── Audit Log ─────────────────────────────────────────────────────────────────

function AuditLogPage() {
  const logs = [
    { id: 1, user: "أحمد محمد",  action: "إضافة فاتورة",    module: "المبيعات",  doc: "INV-047", time: "10:30", date: "2026-05-07", ip: "192.168.1.10" },
    { id: 2, user: "سارة علي",   action: "تعديل عميل",      module: "المبيعات",  doc: "CUS-012", time: "09:15", date: "2026-05-07", ip: "192.168.1.11" },
    { id: 3, user: "خالد يوسف",  action: "حذف سند صرف",     module: "الحسابات", doc: "PAY-008", time: "14:00", date: "2026-05-06", ip: "192.168.1.12" },
    { id: 4, user: "أحمد محمد",  action: "تسجيل دخول",      module: "النظام",    doc: "—",       time: "08:00", date: "2026-05-07", ip: "192.168.1.10" },
  ];
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">سجل العمليات</h3>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">المستخدم</TableHead>
              <TableHead className="text-xs">العملية</TableHead>
              <TableHead className="text-xs">الوحدة</TableHead>
              <TableHead className="text-xs">المستند</TableHead>
              <TableHead className="text-xs">التاريخ</TableHead>
              <TableHead className="text-xs">الوقت</TableHead>
              <TableHead className="text-xs">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map(l => (
              <TableRow key={l.id}>
                <TableCell className="text-xs font-medium">{l.user}</TableCell>
                <TableCell className="text-xs">{l.action}</TableCell>
                <TableCell className="text-xs">{l.module}</TableCell>
                <TableCell className="text-xs font-mono">{l.doc}</TableCell>
                <TableCell className="text-xs">{l.date}</TableCell>
                <TableCell className="text-xs">{l.time}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{l.ip}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Missing Doc Numbers ───────────────────────────────────────────────────────

function MissingDocNumbersPage() {
  const missing = [
    { docType: "فاتورة مبيعات",  missing: [12, 15, 23], module: "المبيعات" },
    { docType: "سند قبض",        missing: [1003],        module: "الحسابات" },
    { docType: "أمر شراء",       missing: [8, 9],        module: "المشتريات" },
  ];
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">أرقام المستندات المفقودة</h3>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">نوع المستند</TableHead>
              <TableHead className="text-xs">الوحدة</TableHead>
              <TableHead className="text-xs">الأرقام المفقودة</TableHead>
              <TableHead className="text-xs text-center">العدد</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {missing.map(m => (
              <TableRow key={m.docType}>
                <TableCell className="text-xs font-medium">{m.docType}</TableCell>
                <TableCell className="text-xs">{m.module}</TableCell>
                <TableCell className="text-xs font-mono text-amber-500">{m.missing.join(", ")}</TableCell>
                <TableCell className="text-xs text-center">
                  <Badge variant="secondary" className="text-xs">{m.missing.length}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Payroll Periods ───────────────────────────────────────────────────────────

function PayrollPeriodsPage() {
  const periods = [
    { id: 1, name: "أبريل 2026",  start: "2026-04-01", end: "2026-04-30", status: "مغلقة",  processed: true },
    { id: 2, name: "مايو 2026",   start: "2026-05-01", end: "2026-05-31", status: "مفتوحة", processed: false },
    { id: 3, name: "يونيو 2026",  start: "2026-06-01", end: "2026-06-30", status: "مستقبلية",processed: false },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">فترات مسير الرواتب</h3>
        <Button className="h-8 text-sm" onClick={() => toast.info("إضافة فترة")}><Plus className="w-3.5 h-3.5 ml-1" />فترة جديدة</Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">الفترة</TableHead>
              <TableHead className="text-xs">من</TableHead>
              <TableHead className="text-xs">إلى</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs text-center">تم المعالجة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.map(p => (
              <TableRow key={p.id}>
                <TableCell className="text-xs font-bold">{p.name}</TableCell>
                <TableCell className="text-xs">{p.start}</TableCell>
                <TableCell className="text-xs">{p.end}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={p.status === "مفتوحة" ? "default" : p.status === "مغلقة" ? "secondary" : "outline"} className="text-xs">{p.status}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  {p.processed ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />}
                </TableCell>
                <TableCell>
                  {p.status === "مفتوحة" && (
                    <button className="text-primary text-xs hover:underline" onClick={() => toast.info("تشغيل المسير")}>تشغيل المسير</button>
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

// ─── Org Chart ─────────────────────────────────────────────────────────────────

function OrgChartPage() {
  const depts = [
    { id: 1, name: "الإدارة العامة",    parent: null,  manager: "المدير العام",      employees: 2 },
    { id: 2, name: "المالية والحسابات", parent: 1,     manager: "المدير المالي",     employees: 5 },
    { id: 3, name: "المبيعات",          parent: 1,     manager: "مدير المبيعات",     employees: 8 },
    { id: 4, name: "المشتريات",         parent: 1,     manager: "مدير المشتريات",    employees: 3 },
    { id: 5, name: "المخازن",           parent: 1,     manager: "مدير المخازن",      employees: 4 },
    { id: 6, name: "الموارد البشرية",   parent: 1,     manager: "مدير الموارد البشرية", employees: 2 },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">ملف الهيكل الإداري</h3>
        <Button className="h-8 text-sm" onClick={() => toast.info("إضافة قسم")}><Plus className="w-3.5 h-3.5 ml-1" />قسم جديد</Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">القسم</TableHead>
              <TableHead className="text-xs">التابع لـ</TableHead>
              <TableHead className="text-xs">المدير</TableHead>
              <TableHead className="text-xs text-center">عدد الموظفين</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {depts.map(d => (
              <TableRow key={d.id}>
                <TableCell className="text-xs font-medium">{d.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {d.parent ? depts.find(x => x.id === d.parent)?.name : "—"}
                </TableCell>
                <TableCell className="text-xs">{d.manager}</TableCell>
                <TableCell className="text-xs text-center">{d.employees}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary text-xs hover:underline" onClick={() => toast.info("تعديل")}>تعديل</button>
                    <button className="text-destructive text-xs hover:underline" onClick={() => toast.error("حذف")}>حذف</button>
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

// ─── Wage Calendar ─────────────────────────────────────────────────────────────

function WageCalendarPage() {
  const [calType, setCalType] = useState("monthly");
  return (
    <div className="space-y-4 max-w-xl">
      <h3 className="font-semibold text-sm">تقويم نظام الأجور</h3>
      <Card className="border-border/50">
        <CardContent className="p-5 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">نوع التقويم</Label>
            <Select value={calType} onValueChange={setCalType}>
              <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">شهري (30 يوم)</SelectItem>
                <SelectItem value="hijri">هجري</SelectItem>
                <SelectItem value="weekly">أسبوعي</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">يوم بداية الراتب</Label>
              <Input defaultValue="1" className="h-8 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">يوم نهاية الراتب</Label>
              <Input defaultValue="30" className="h-8 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">يوم صرف الراتب</Label>
              <Input defaultValue="25" className="h-8 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">أيام العمل في الأسبوع</Label>
              <Input defaultValue="5" className="h-8 text-sm mt-1" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">أيام الإجازة الأسبوعية</Label>
            <div className="flex gap-2 flex-wrap">
              {["السبت","الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة"].map(d => (
                <label key={d} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" defaultChecked={d === "الجمعة" || d === "السبت"} className="w-3 h-3" />
                  {d}
                </label>
              ))}
            </div>
          </div>
          <Button className="w-full h-9" onClick={() => toast.success("تم حفظ تقويم الأجور")}>
            <Save className="w-4 h-4 ml-2" />حفظ الإعدادات
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Shifts Setup ──────────────────────────────────────────────────────────────

function ShiftsSetupPage() {
  const shifts = [
    { id: 1, name: "الدوام الصباحي",  from: "08:00", to: "16:00", break: 60, days: "الأحد - الخميس", active: true },
    { id: 2, name: "الدوام المسائي",  from: "16:00", to: "00:00", break: 60, days: "الأحد - الخميس", active: true },
    { id: 3, name: "دوام الليل",      from: "00:00", to: "08:00", break: 60, days: "يومي",           active: false },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">ملف الدوامات</h3>
        <Button className="h-8 text-sm" onClick={() => toast.info("إضافة دوام")}><Plus className="w-3.5 h-3.5 ml-1" />دوام جديد</Button>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">اسم الدوام</TableHead>
              <TableHead className="text-xs text-center">من</TableHead>
              <TableHead className="text-xs text-center">إلى</TableHead>
              <TableHead className="text-xs text-center">استراحة (د)</TableHead>
              <TableHead className="text-xs">أيام العمل</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.map(s => (
              <TableRow key={s.id}>
                <TableCell className="text-xs font-medium">{s.name}</TableCell>
                <TableCell className="text-xs text-center font-mono">{s.from}</TableCell>
                <TableCell className="text-xs text-center font-mono">{s.to}</TableCell>
                <TableCell className="text-xs text-center">{s.break}</TableCell>
                <TableCell className="text-xs">{s.days}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={s.active ? "default" : "secondary"} className="text-xs">{s.active ? "نشط" : "موقوف"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary text-xs hover:underline" onClick={() => toast.info("تعديل")}>تعديل</button>
                    <button className="text-destructive text-xs hover:underline" onClick={() => toast.error("حذف")}>حذف</button>
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

// ─── Report Tools Generic ──────────────────────────────────────────────────────

function ReportToolsPage({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {["تقرير المبيعات","تقرير المشتريات","تقرير المخزون","تقرير الحسابات","تقرير الموارد البشرية","تقرير الأصول الثابتة"].map(r => (
          <Card key={r} className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => toast.info(`فتح ${r}`)}>
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart2 className="w-8 h-8 text-primary/50" />
              <div>
                <p className="text-sm font-medium">{r}</p>
                <p className="text-xs text-muted-foreground">انقر للفتح والتعديل</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Coming Soon ───────────────────────────────────────────────────────────────

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
      <Settings className="w-14 h-14 opacity-10" />
      <p className="text-lg font-bold text-foreground">{title}</p>
      <p className="text-sm">هذه الشاشة قيد التطوير</p>
      <Badge variant="outline" className="mt-1">قريباً</Badge>
    </div>
  );
}

// ─── Content Router ────────────────────────────────────────────────────────────

function SettingsContent({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  switch (activeId) {
    // الإعدادات العامة
    case "overview":             return <SettingsOverview onSelect={onSelect} />;
    case "company-info":         return <CompanyInfoPage />;
    case "currencies":           return <CurrenciesPage />;
    case "taxes":                return <TaxesPage />;
    case "fiscal-periods":       return <FiscalPeriodsPage />;
    // المستخدمون والصلاحيات
    case "users-list":           return <UsersListPage />;
    case "user-groups":          return <UserGroupsPage />;
    case "permissions":          return <PermissionsPage />;
    // سير الموافقات
    case "approve-invoice":      return <ApprovalsPage title="طلب اعتماد فاتورة" docType="فاتورة" />;
    case "approve-purchase":     return <ApprovalsPage title="اعتماد أمر شراء" docType="أمر شراء" />;
    case "approve-discount":     return <ApprovalsPage title="اعتماد خصم / عرض خاص" docType="خصم" />;
    case "approve-inventory":    return <ApprovalsPage title="اعتماد تسوية مخزنية" docType="تسوية" />;
    case "approve-journal":      return <ApprovalsPage title="اعتماد قيد يومية" docType="قيد" />;
    case "approvals-log":        return <ApprovalsLogPage />;
    case "approval-paths":       return <ApprovalPathsPage />;
    // الإشعارات والتنبيهات
    case "notif-stock":          return <NotificationSettingsPage title="تنبيه نقص المخزون" description="إرسال تنبيه عند وصول المخزون إلى الحد الأدنى" />;
    case "notif-credit":         return <NotificationSettingsPage title="تنبيه تجاوز الحد الائتماني للعميل" description="تنبيه عند تجاوز العميل حد الائتمان المسموح به" />;
    case "notif-overdue":        return <NotificationSettingsPage title="تنبيه فواتير مستحقة أو متأخرة" description="تنبيه عند وجود فواتير تجاوزت تاريخ الاستحقاق" />;
    case "notif-expiry":         return <NotificationSettingsPage title="تنبيه انتهاء صلاحية مواد خام" description="تنبيه قبل انتهاء صلاحية الأصناف بفترة محددة" />;
    case "notif-maintenance":    return <NotificationSettingsPage title="تنبيه اقتراب صيانة أصل أو ماكينة" description="تنبيه عند اقتراب موعد الصيانة الدورية" />;
    case "notif-pending":        return <NotificationSettingsPage title="تنبيه مستندات بانتظار الاعتماد" description="تنبيه عند وجود مستندات تحتاج اعتماداً" />;
    // النظام
    case "warehouses-config":    return <WarehousesConfigPage />;
    case "doc-types":            return <DocTypesPage />;
    case "doc-books":            return <DocBooksPage />;
    case "field-design":         return <FieldDesignPage />;
    case "backup":               return <BackupPage />;
    case "audit-log":            return <AuditLogPage />;
    // إعدادات الموارد البشرية
    case "missing-doc-numbers":  return <MissingDocNumbersPage />;
    case "payroll-periods":      return <PayrollPeriodsPage />;
    case "org-chart":            return <OrgChartPage />;
    case "wage-calendar":        return <WageCalendarPage />;
    case "shifts-setup":         return <ShiftsSetupPage />;
    // أدوات التقارير
    case "report-designer":      return <ReportToolsPage title="مصمم التقارير" />;
    case "report-templates":     return <ReportToolsPage title="قوالب التقارير" />;
    case "test-files-setup":     return <ComingSoon title="إعداد ملفات الاختبار" />;
    case "test-files-edit":      return <ComingSoon title="تحرير ملفات الاختبار" />;
    case "field-specs":          return <ComingSoon title="مواصفات الحقول" />;
    default:                     return <SettingsOverview onSelect={onSelect} />;
  }
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function SettingsModule() {
  const [activeId, setActiveId] = useState<MenuId>("overview");
  return (
    <div className="flex h-full" dir="rtl">
      <SettingsMenu activeId={activeId} onSelect={setActiveId} />
      <div className="flex-1 overflow-auto p-5">
        <SettingsContent activeId={activeId} onSelect={setActiveId} />
      </div>
    </div>
  );
}

// ─── Tab Sub-Pages ─────────────────────────────────────────────────────────────
function CfgSubPage({ activeId }: { activeId: string }) {
  return <div className="h-full overflow-auto p-5" dir="rtl"><SettingsContent activeId={activeId} onSelect={() => {}} /></div>;
}
export function CfgCompanyTab()          { return <CfgSubPage activeId="company-info" />; }
export function CfgCurrenciesTab()       { return <CfgSubPage activeId="currencies" />; }
export function CfgTaxesTab()            { return <CfgSubPage activeId="taxes" />; }
export function CfgFiscalTab()           { return <CfgSubPage activeId="fiscal-periods" />; }
export function CfgUsersTab()            { return <CfgSubPage activeId="users-list" />; }
export function CfgUserGroupsTab()       { return <CfgSubPage activeId="user-groups" />; }
export function CfgPermissionsTab()      { return <CfgSubPage activeId="permissions" />; }
export function CfgApproveInvoiceTab()   { return <CfgSubPage activeId="approve-invoice" />; }
export function CfgApprovePurchaseTab()  { return <CfgSubPage activeId="approve-purchase" />; }
export function CfgApproveDiscountTab()  { return <CfgSubPage activeId="approve-discount" />; }
export function CfgApproveInventoryTab() { return <CfgSubPage activeId="approve-inventory" />; }
export function CfgApproveJournalTab()   { return <CfgSubPage activeId="approve-journal" />; }
export function CfgApprovalsLogTab()     { return <CfgSubPage activeId="approvals-log" />; }
export function CfgApprovalPathsTab()    { return <CfgSubPage activeId="approval-paths" />; }
export function CfgNotifStockTab()       { return <CfgSubPage activeId="notif-stock" />; }
export function CfgNotifCreditTab()      { return <CfgSubPage activeId="notif-credit" />; }
export function CfgNotifOverdueTab()     { return <CfgSubPage activeId="notif-overdue" />; }
export function CfgNotifExpiryTab()      { return <CfgSubPage activeId="notif-expiry" />; }
export function CfgNotifMaintenanceTab() { return <CfgSubPage activeId="notif-maintenance" />; }
export function CfgNotifPendingTab()     { return <CfgSubPage activeId="notif-pending" />; }
export function CfgWarehousesTab()       { return <CfgSubPage activeId="warehouses-config" />; }
export function CfgDocTypesTab()         { return <CfgSubPage activeId="doc-types" />; }
export function CfgDocBooksTab()         { return <CfgSubPage activeId="doc-books" />; }
export function CfgFieldDesignTab()      { return <CfgSubPage activeId="field-design" />; }
export function CfgBackupTab()           { return <CfgSubPage activeId="backup" />; }
export function CfgAuditLogTab()         { return <CfgSubPage activeId="audit-log" />; }
export function CfgMissingDocsTab()      { return <CfgSubPage activeId="missing-doc-numbers" />; }
export function CfgPayrollPeriodsTab()   { return <CfgSubPage activeId="payroll-periods" />; }
export function CfgOrgChartTab()         { return <CfgSubPage activeId="org-chart" />; }
export function CfgWageCalendarTab()     { return <CfgSubPage activeId="wage-calendar" />; }
export function CfgShiftsTab()           { return <CfgSubPage activeId="shifts-setup" />; }
export function CfgReportDesignerTab()   { return <CfgSubPage activeId="report-designer" />; }
export function CfgTestSetupTab()        { return <CfgSubPage activeId="test-files-setup" />; }
export function CfgTestEditTab()         { return <CfgSubPage activeId="test-files-edit" />; }
export function CfgFieldSpecsTab()       { return <CfgSubPage activeId="field-specs" />; }
