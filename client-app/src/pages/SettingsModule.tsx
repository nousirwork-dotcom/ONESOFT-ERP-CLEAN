import { useState, useRef, useEffect } from "react";
import { useTabManager } from "@/contexts/TabManagerContext";
import { trpc } from "@/lib/trpc";
import Warehouses from "./Warehouses";
import DocumentJournalsPage from "./DocumentJournalsPage";
import DocumentTypesPage from "./DocumentTypesPage";
import DocumentTemplatesPage from "./DocumentTemplatesPage";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ChevronDown, ChevronRight, Settings, Building2, DollarSign,
  Calendar, Users, Shield, Database, FileText, History,
  Warehouse, Tag, BookOpen, Layout, Download, Bell,
  ArrowRight, Save, Plus, Trash2, Edit2, Clock, GitBranch,
  AlertTriangle, CheckCircle, XCircle, BarChart2, Lock, List, QrCode,
} from "lucide-react";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import { generateQrContent, QR_SYSTEMS, CUSTOM_TEMPLATE_HELP, type QrSystem } from "@/lib/qrUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
      { id: "fiscal-periods",   label: "الفترات المحاسبية",    status: "done",    path: "/cfg/fiscal" },
      { id: "user-categories", label: "فئات المستخدمين",      status: "done",    path: "/cfg/user-categories" },
      { id: "users-list",      label: "المستخدمين",           status: "missing", path: "/cfg/users" },
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
      { id: "warehouses-config",   label: "المخازن",             status: "partial", path: "/cfg/warehouses" },
      { id: "document-journals",   label: "دفاتر المستندات",     status: "partial", path: "/cfg/document-journals" },
      { id: "posting-settings",    label: "ترحيل المستندات",     status: "partial", path: "/cfg/posting-settings" },
      { id: "document-types",      label: "أنواع المستندات",     status: "partial", path: "/cfg/document-types" },
      { id: "document-templates",  label: "نماذج المستندات",     status: "partial", path: "/cfg/document-templates" },
      { id: "qr-settings",         label: "إعدادات QR Code",     status: "done",    path: "/cfg/qr-settings" },
      { id: "field-design",        label: "تصميم الحقول",        status: "missing", path: "/cfg/field-design" },
      { id: "backup",              label: "النسخ الاحتياطي",     status: "done",    path: "/cfg/backup" },
      { id: "audit-log",           label: "سجل العمليات",        status: "done",    path: "/cfg/audit-log" },
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

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام", cashier: "كاشير", accountant: "محاسب",
  warehouse_manager: "أمين مخزن", viewer: "مشاهد",
};

function UsersListPage() {
  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.users.list.useQuery();
  const { data: cats = [] } = trpc.userCategories.list.useQuery();

  const [showAdd, setShowAdd] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [form, setForm] = useState({ code: "", username: "", password: "", name: "", email: "", phone: "", role: "cashier" });
  const sf = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  // fetch next code whenever a category with autoNumbering is selected
  const { data: nextCodeData } = trpc.userCategories.nextCode.useQuery(
    { categoryId: categoryId! },
    { enabled: !!categoryId }
  );
  // auto-fill code when next code data arrives (only if code is still empty / matches previous auto)
  const prevCatId = useRef<number | null>(null);
  useEffect(() => {
    if (!categoryId) { if (prevCatId.current !== null) { sf("code", ""); } prevCatId.current = null; return; }
    if (nextCodeData?.code) { sf("code", nextCodeData.code); }
    prevCatId.current = categoryId;
  }, [nextCodeData, categoryId]);

  const createUser = trpc.users.create.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      utils.userCategories.nextCode.invalidate(categoryId ? { categoryId } : undefined);
      setShowAdd(false);
      setCategoryId(null);
      setForm({ code: "", username: "", password: "", name: "", email: "", phone: "", role: "cashier" });
      toast.success("تم إضافة المستخدم");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("تم حذف المستخدم"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">إدارة المستخدمين</h3>
        <Button className="h-8 text-sm" onClick={() => setShowAdd(v => !v)}>
          <Plus className="w-3.5 h-3.5 ml-1" />مستخدم جديد
        </Button>
      </div>

      {showAdd && (
        <Card className="border-indigo-200 bg-indigo-50/40 p-4">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <Label className="text-xs mb-1 block">فئة المستخدم</Label>
              <Select
                value={categoryId ? String(categoryId) : "none"}
                onValueChange={v => setCategoryId(v === "none" ? null : Number(v))}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="بدون فئة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون فئة</SelectItem>
                  {(cats as any[]).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.code ? `${c.code} — ` : ""}{c.name}
                      {c.autoNumbering ? " (ترقيم تلقائي)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block flex items-center gap-1">
                الكود
                {nextCodeData?.code && categoryId && (
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">تلقائي</span>
                )}
              </Label>
              <Input
                className={`h-8 text-sm ${nextCodeData?.code && categoryId ? "border-emerald-300 bg-emerald-50/40" : ""}`}
                value={form.code}
                onChange={e => sf("code", e.target.value)}
                placeholder={nextCodeData?.code ?? "U001"}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">الاسم الكامل *</Label>
              <Input className="h-8 text-sm" value={form.name} onChange={e => sf("name", e.target.value)} placeholder="أحمد محمد" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">اسم المستخدم *</Label>
              <Input className="h-8 text-sm" value={form.username} onChange={e => sf("username", e.target.value)} placeholder="ahmed" dir="ltr" autoComplete="off" name="new-username" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">كلمة المرور *</Label>
              <Input className="h-8 text-sm" type="password" value={form.password} onChange={e => sf("password", e.target.value)} placeholder="••••••" dir="ltr" autoComplete="new-password" name="new-password" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">البريد الإلكتروني</Label>
              <Input className="h-8 text-sm" value={form.email} onChange={e => sf("email", e.target.value)} placeholder="ahmed@co.sa" dir="ltr" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">الدور</Label>
              <Select value={form.role} onValueChange={v => sf("role", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدير النظام</SelectItem>
                  <SelectItem value="accountant">محاسب</SelectItem>
                  <SelectItem value="cashier">كاشير</SelectItem>
                  <SelectItem value="warehouse_manager">أمين مخزن</SelectItem>
                  <SelectItem value="viewer">مشاهد</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Button size="sm" className="h-7 text-xs" disabled={!form.name || !form.username || !form.password || createUser.isPending}
              onClick={() => createUser.mutate({
                code: form.code || undefined,
                username: form.username,
                password: form.password,
                name: form.name,
                email: form.email || undefined,
                role: form.role as any,
                categoryId: categoryId ?? undefined,
              })}>
              {createUser.isPending ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowAdd(false); setCategoryId(null); setForm({ code: "", username: "", password: "", name: "", email: "", phone: "", role: "cashier" }); }}>إلغاء</Button>
          </div>
        </Card>
      )}

      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-16">الكود</TableHead>
              <TableHead className="text-xs">الاسم</TableHead>
              <TableHead className="text-xs">اسم المستخدم</TableHead>
              <TableHead className="text-xs">البريد الإلكتروني</TableHead>
              <TableHead className="text-xs">الدور</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-xs text-center text-muted-foreground py-6">جارٍ التحميل...</TableCell></TableRow>
            )}
            {!isLoading && users.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-xs text-center text-muted-foreground py-6">لا يوجد مستخدمون</TableCell></TableRow>
            )}
            {users.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell className="text-xs font-mono text-muted-foreground">{u.code ?? "—"}</TableCell>
                <TableCell className="text-xs font-medium">{u.name}</TableCell>
                <TableCell className="text-xs font-mono" dir="ltr">{u.username}</TableCell>
                <TableCell className="text-xs" dir="ltr">{u.email ?? "—"}</TableCell>
                <TableCell className="text-xs">{ROLE_LABELS[u.role] ?? u.role}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={u.isActive ? "default" : "secondary"} className="text-xs">
                    {u.isActive ? "نشط" : "موقوف"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-destructive text-xs hover:underline"
                      onClick={() => deleteUser.mutate({ id: u.id })}>
                      حذف
                    </button>
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

// ─── User Categories ───────────────────────────────────────────────────────────

function buildCatPreview(prefix: string, totalDigits: number, firstNum: number, inc: number) {
  if (!prefix || totalDigits <= prefix.length) return null;
  const seqLen = totalDigits - prefix.length;
  const first = String(firstNum).padStart(seqLen, "0");
  const second = String(firstNum + inc).padStart(seqLen, "0");
  return { first: prefix + first, second: prefix + second, seqLen };
}

const emptyCatForm = {
  code: "", name: "",
  autoNumbering: true, firstNumber: 1, lastNumber: 99999, increment: 1, codeDigits: 5,
};

function CatNumberingSection({ form, set }: { form: typeof emptyCatForm; set: (k: string, v: any) => void }) {
  const preview = buildCatPreview(form.code, form.codeDigits, form.firstNumber, form.increment);
  return (
    <div className="border border-border/60 rounded-md overflow-hidden mt-3">
      <div className="px-3 py-1.5 bg-primary/5 text-xs font-semibold text-primary border-b border-border/60 flex items-center justify-between">
        <span>إعدادات الترقيم التلقائي</span>
        <label className="flex items-center gap-1.5 cursor-pointer font-normal">
          <Checkbox checked={form.autoNumbering} onCheckedChange={v => set("autoNumbering", !!v)} />
          <span className="text-xs">تفعيل تسلسل تلقائي</span>
        </label>
      </div>
      <div className={`${!form.autoNumbering ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="grid grid-cols-4 divide-x divide-x-reverse divide-border/60 border-b border-border/60">
          <div className="px-2 py-1">
            <p className="text-[10px] text-muted-foreground mb-0.5">أول رقم</p>
            <Input type="number" min={1} value={form.firstNumber}
              onChange={e => set("firstNumber", parseInt(e.target.value) || 1)}
              className="h-7 text-xs border-0 p-0 focus-visible:ring-0 bg-transparent font-mono" dir="ltr" />
          </div>
          <div className="px-2 py-1">
            <p className="text-[10px] text-muted-foreground mb-0.5">آخر رقم</p>
            <Input type="number" min={1} value={form.lastNumber}
              onChange={e => set("lastNumber", parseInt(e.target.value) || 99999)}
              className="h-7 text-xs border-0 p-0 focus-visible:ring-0 bg-transparent font-mono" dir="ltr" />
          </div>
          <div className="px-2 py-1">
            <p className="text-[10px] text-muted-foreground mb-0.5">معدل الزيادة</p>
            <Input type="number" min={1} value={form.increment}
              onChange={e => set("increment", parseInt(e.target.value) || 1)}
              className="h-7 text-xs border-0 p-0 focus-visible:ring-0 bg-transparent font-mono" dir="ltr" />
          </div>
          <div className="px-2 py-1">
            <p className="text-[10px] text-muted-foreground mb-0.5">عدد الخانات</p>
            <Input type="number" min={2} max={12} value={form.codeDigits}
              onChange={e => set("codeDigits", parseInt(e.target.value) || 5)}
              className="h-7 text-xs border-0 p-0 focus-visible:ring-0 bg-transparent font-mono" dir="ltr" />
          </div>
        </div>
        {preview && form.code && (
          <div className="px-3 py-2 bg-emerald-50/60 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground">معاينة:</span>
            <code className="font-mono text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">{preview.first}</code>
            <span className="text-muted-foreground text-xs">،</span>
            <code className="font-mono text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">{preview.second}</code>
            <span className="text-[10px] text-muted-foreground mr-auto">
              بادئة: <b>{form.code}</b> | تسلسل: <b>{preview.seqLen}</b> خانة
            </span>
          </div>
        )}
        {form.autoNumbering && form.code && form.codeDigits <= form.code.length && (
          <p className="text-[11px] text-red-500 px-3 pb-2">⚠️ عدد الخانات أقل من أو يساوي طول البادئة!</p>
        )}
      </div>
    </div>
  );
}

function UserCategoriesPage() {
  const utils = trpc.useUtils();
  const { data: cats = [], isLoading } = trpc.userCategories.list.useQuery();
  const createCat = trpc.userCategories.create.useMutation({
    onSuccess: () => { utils.userCategories.list.invalidate(); setShowAdd(false); setAddForm({ ...emptyCatForm }); toast.success("تم إضافة الفئة"); },
    onError: (e) => toast.error(e.message),
  });
  const updateCat = trpc.userCategories.update.useMutation({
    onSuccess: () => { utils.userCategories.list.invalidate(); setEditId(null); toast.success("تم تعديل الفئة"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteCat = trpc.userCategories.delete.useMutation({
    onSuccess: () => { utils.userCategories.list.invalidate(); toast.success("تم حذف الفئة"); },
    onError: (e) => toast.error(e.message),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ ...emptyCatForm });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyCatForm });

  const setAdd = (k: string, v: any) => setAddForm(p => ({ ...p, [k]: v }));
  const setEdit = (k: string, v: any) => setEditForm(p => ({ ...p, [k]: v }));

  const addCodeDup = !!addForm.code.trim() && (cats as any[]).some((c: any) => c.code === addForm.code.trim());
  const editCodeDup = !!editForm.code.trim() && (cats as any[]).some((c: any) => c.code === editForm.code.trim() && c.id !== editId);

  const handleCreate = () => {
    if (!addForm.name.trim()) return toast.error("اسم الفئة مطلوب");
    if (addCodeDup) return toast.error("الكود مكرر — يوجد فئة بنفس الكود");
    createCat.mutate({
      code: addForm.code.trim() || undefined,
      name: addForm.name.trim(),
      autoNumbering: addForm.autoNumbering,
      firstNumber: addForm.firstNumber,
      lastNumber: addForm.lastNumber,
      increment: addForm.increment,
      codeDigits: addForm.codeDigits,
    });
  };

  const handleUpdate = () => {
    if (!editId) return;
    if (!editForm.name.trim()) return toast.error("اسم الفئة مطلوب");
    if (editCodeDup) return toast.error("الكود مكرر — يوجد فئة بنفس الكود");
    updateCat.mutate({
      id: editId,
      code: editForm.code.trim() || undefined,
      name: editForm.name.trim(),
      autoNumbering: editForm.autoNumbering,
      firstNumber: editForm.firstNumber,
      lastNumber: editForm.lastNumber,
      increment: editForm.increment,
      codeDigits: editForm.codeDigits,
    });
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">فئات المستخدمين</h3>
        <Button className="h-8 text-sm" onClick={() => { setShowAdd(v => !v); setEditId(null); }}>
          <Plus className="w-3.5 h-3.5 ml-1" />فئة جديدة
        </Button>
      </div>

      {showAdd && (
        <Card className="border-indigo-200 bg-indigo-50/40 p-4">
          <div className="grid grid-cols-2 gap-3 mb-1">
            <div>
              <Label className="text-xs mb-1 block">الكود / البادئة</Label>
              <Input
                className={`h-8 text-sm font-mono ${addCodeDup ? "border-destructive focus-visible:ring-destructive" : ""}`}
                value={addForm.code} onChange={e => setAdd("code", e.target.value)}
                placeholder="CAT" autoFocus dir="ltr" />
              {addCodeDup && <p className="text-[10px] text-destructive mt-0.5">الكود مكرر</p>}
            </div>
            <div>
              <Label className="text-xs mb-1 block">اسم الفئة *</Label>
              <Input className="h-8 text-sm" value={addForm.name} onChange={e => setAdd("name", e.target.value)} placeholder="مثال: المحاسبون" />
            </div>
          </div>
          <CatNumberingSection form={addForm} set={setAdd} />
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="h-7 text-xs" disabled={!addForm.name.trim() || addCodeDup || createCat.isPending} onClick={handleCreate}>
              {createCat.isPending ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => { setShowAdd(false); setAddForm({ ...emptyCatForm }); }}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}

      {editId !== null && (
        <Card className="border-amber-200 bg-amber-50/30 p-4">
          <p className="text-xs font-semibold text-amber-700 mb-2">تعديل الفئة</p>
          <div className="grid grid-cols-2 gap-3 mb-1">
            <div>
              <Label className="text-xs mb-1 block">الكود / البادئة</Label>
              <Input
                className={`h-8 text-sm font-mono ${editCodeDup ? "border-destructive focus-visible:ring-destructive" : ""}`}
                value={editForm.code} onChange={e => setEdit("code", e.target.value)}
                autoFocus dir="ltr" />
              {editCodeDup && <p className="text-[10px] text-destructive mt-0.5">الكود مكرر</p>}
            </div>
            <div>
              <Label className="text-xs mb-1 block">اسم الفئة *</Label>
              <Input className="h-8 text-sm" value={editForm.name} onChange={e => setEdit("name", e.target.value)} />
            </div>
          </div>
          <CatNumberingSection form={editForm} set={setEdit} />
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="h-7 text-xs" disabled={!editForm.name.trim() || editCodeDup || updateCat.isPending} onClick={handleUpdate}>
              {updateCat.isPending ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditId(null)}>إلغاء</Button>
          </div>
        </Card>
      )}

      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-24">الكود</TableHead>
              <TableHead className="text-xs">اسم الفئة</TableHead>
              <TableHead className="text-xs text-center">الترقيم</TableHead>
              <TableHead className="text-xs text-center">خانات</TableHead>
              <TableHead className="text-xs">معاينة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-xs text-center text-muted-foreground py-6">جارٍ التحميل...</TableCell></TableRow>
            )}
            {!isLoading && (cats as any[]).length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-xs text-center text-muted-foreground py-6">لا توجد فئات — أضف فئة جديدة</TableCell></TableRow>
            )}
            {(cats as any[]).map((c: any) => {
              const pv = buildCatPreview(c.code ?? "", c.codeDigits ?? 5, c.firstNumber ?? 1, c.increment ?? 1);
              return (
                <TableRow key={c.id} className={editId === c.id ? "bg-amber-50/40" : ""}>
                  <TableCell className="text-xs font-mono text-muted-foreground">{c.code ?? "—"}</TableCell>
                  <TableCell className="text-xs font-medium">{c.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={c.autoNumbering ? "default" : "outline"} className="text-[9px] h-4">
                      {c.autoNumbering ? "تلقائي" : "يدوي"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">{c.codeDigits ?? 5}</TableCell>
                  <TableCell>
                    {pv && c.autoNumbering
                      ? <code className="font-mono text-[10px] text-emerald-600">{pv.first}، {pv.second}...</code>
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <button className="text-primary text-xs hover:underline"
                        onClick={() => {
                          setEditId(c.id);
                          setEditForm({
                            code: c.code ?? "", name: c.name,
                            autoNumbering: c.autoNumbering ?? true,
                            firstNumber: c.firstNumber ?? 1,
                            lastNumber: c.lastNumber ?? 99999,
                            increment: c.increment ?? 1,
                            codeDigits: c.codeDigits ?? 5,
                          });
                          setShowAdd(false);
                        }}>
                        تعديل
                      </button>
                      <button className="text-destructive text-xs hover:underline" onClick={() => deleteCat.mutate({ id: c.id })}>
                        حذف
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Group Members Section ────────────────────────────────────────────────────

type PendingMember = { memberType: 'user' | 'group'; memberCode: string; memberName: string };

function MemberRow({ memberType, setMemberType, memberCode, setMemberCode, memberName, setMemberName, onAdd, users, groups, existingCodes = [], dupHighlight = false }:
  { memberType: 'user'|'group'; setMemberType: (v:'user'|'group')=>void; memberCode:string; setMemberCode:(v:string)=>void; memberName:string; setMemberName:(v:string)=>void; onAdd:()=>void; users:any[]; groups:any[]; existingCodes?: string[]; dupHighlight?: boolean }) {

  const [notFound, setNotFound] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerFocusIdx, setPickerFocusIdx] = useState(-1);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const availableList: any[] = memberType === 'user' ? users : groups;
  const filteredList = availableList.filter((item: any) => {
    if (!memberCode.trim()) return true;
    return (
      item.code?.toLowerCase().includes(memberCode.toLowerCase()) ||
      item.name?.toLowerCase().includes(memberCode.toLowerCase())
    );
  });

  useEffect(() => { setPickerFocusIdx(-1); }, [filteredList.length]);

  useEffect(() => {
    if (pickerFocusIdx < 0 || !pickerListRef.current) return;
    const items = pickerListRef.current.querySelectorAll<HTMLElement>('[data-picker-item]');
    items[pickerFocusIdx]?.scrollIntoView({ block: 'nearest' });
  }, [pickerFocusIdx]);

  const handleCodeBlur = () => {
    setTimeout(() => {
      if (pickerRef.current?.contains(document.activeElement)) return;
      setShowPicker(false);
      if (!memberCode.trim()) { setNotFound(false); return; }
      if (memberType === 'user') {
        const found = users.find((u:any) => u.code === memberCode.trim());
        if (found) { setMemberName(found.name); setNotFound(false); }
        else { setMemberName(""); setNotFound(true); }
      } else {
        const found = groups.find((g:any) => g.code === memberCode.trim());
        if (found) { setMemberName(found.name); setNotFound(false); }
        else { setMemberName(""); setNotFound(true); }
      }
    }, 150);
  };

  // onPointerDown prevents focus move → input stays focused → no blur race condition
  const selectFromPicker = (item: any) => {
    setMemberCode(item.code ?? "");
    setMemberName(item.name ?? "");
    setNotFound(false);
    setShowPicker(false);
    setPickerFocusIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showPicker) {
      if (e.key === 'Enter' && canAdd) { e.preventDefault(); onAdd(); }
      if (e.key === 'F2' || e.key === 'F4') { e.preventDefault(); setShowPicker(true); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPickerFocusIdx(i => Math.min(i + 1, filteredList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPickerFocusIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const idx = pickerFocusIdx >= 0 ? pickerFocusIdx
        : filteredList.findIndex(it => it.code === memberCode.trim());
      if (idx >= 0 && filteredList[idx]) {
        e.preventDefault();
        selectFromPicker(filteredList[idx]);
      } else if (e.key === 'Enter' && canAdd) {
        e.preventDefault(); setShowPicker(false); onAdd();
      } else if (e.key === 'Tab') {
        setShowPicker(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault(); setShowPicker(false); setPickerFocusIdx(-1);
    }
  };

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  // no real-time duplicate error — only notFound shown during typing
  const errorMsg = notFound ? "كود غير موجود" : null;
  const canAdd = !!(memberCode.trim() && memberName.trim() && !notFound);

  return (
    <TableRow>
      <TableCell className="py-1 pe-1">
        <Select value={memberType} onValueChange={v => { setMemberType(v as any); setMemberCode(""); setMemberName(""); setNotFound(false); setShowPicker(false); }}>
          <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="user">مستخدم</SelectItem>
            <SelectItem value="group">مجموعة</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="py-1 pe-1">
        <div className="relative space-y-0.5" ref={pickerRef}>
          <div className="flex items-center gap-0.5">
            <Input
              ref={inputRef}
              className={`h-7 text-xs w-24 ${errorMsg || dupHighlight ? "border-destructive focus-visible:ring-destructive" : ""}`}
              placeholder="الكود"
              value={memberCode}
              onChange={e => { setMemberCode(e.target.value); setMemberName(""); setNotFound(false); setShowPicker(true); setPickerFocusIdx(-1); }}
              onFocus={() => setShowPicker(true)}
              onBlur={handleCodeBlur}
              onKeyDown={handleKeyDown}
              onContextMenu={e => { e.preventDefault(); setShowPicker(v => !v); }}
            />
            <button
              type="button"
              title="اختر من القائمة (F2 / كليك يمين)"
              className="h-7 w-7 flex items-center justify-center rounded border border-border hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-colors shrink-0"
              onMouseDown={e => { e.preventDefault(); setShowPicker(v => !v); }}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
          {errorMsg && <p className="text-[10px] text-destructive leading-tight font-medium">{errorMsg}</p>}
          {showPicker && (
            <div ref={pickerListRef} className="absolute z-50 top-9 right-0 bg-white border border-border rounded-md shadow-xl max-h-52 overflow-y-auto min-w-[260px]" dir="rtl">
              <div className="px-3 py-1.5 border-b border-border/50 bg-primary/5 flex items-center gap-2 sticky top-0 z-10">
                <List className="w-3 h-3 text-primary shrink-0" />
                <span className="text-[10px] text-primary font-medium flex-1">
                  {memberType === 'user' ? 'المستخدمون' : 'المجموعات'}
                </span>
                <span className="text-[9px] text-muted-foreground">↑↓ Enter / Tab</span>
              </div>
              {filteredList.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-3">لا توجد نتائج</p>
              )}
              {filteredList.map((item: any, idx: number) => {
                const isFocused = idx === pickerFocusIdx;
                return (
                  <button
                    key={item.id}
                    data-picker-item=""
                    type="button"
                    className={`w-full text-right px-3 py-2 text-xs flex justify-between gap-2 items-center border-b border-border/20 last:border-0 transition-colors
                      ${isFocused ? "bg-primary text-primary-foreground" : "hover:bg-accent cursor-pointer"}`}
                    onPointerDown={e => e.preventDefault()}
                    onClick={() => selectFromPicker(item)}
                    onDoubleClick={() => selectFromPicker(item)}
                    onMouseEnter={() => setPickerFocusIdx(idx)}
                  >
                    <code className={`font-mono text-xs shrink-0 px-1.5 py-0.5 rounded ${isFocused ? "bg-white/20 text-white" : "text-primary bg-primary/10"}`}>
                      {item.code ?? "—"}
                    </code>
                    <span className="flex-1 truncate text-right">{item.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="py-1 pe-1">
        <Input className="h-7 text-xs w-40 bg-muted/40" placeholder="يُحمَّل تلقائياً" value={memberName} readOnly tabIndex={-1} />
      </TableCell>
      <TableCell className="py-1">
        <Button size="sm" variant="outline" className="h-7 text-xs px-2" disabled={!canAdd} onClick={onAdd} title="إضافة (Enter)">
          <Plus className="w-3 h-3" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function SavedMembersTable({ groupId }: { groupId: number }) {
  const utils = trpc.useUtils();
  const { data: members = [] } = trpc.groupMembers.list.useQuery({ groupId });
  const removeMember = trpc.groupMembers.remove.useMutation({
    onSuccess: () => utils.groupMembers.list.invalidate({ groupId }),
    onError: (e) => toast.error(e.message),
  });
  if (!members.length) return (
    <p className="text-xs text-muted-foreground text-center py-2">لا يوجد أعضاء بعد</p>
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">نوع العضو</TableHead>
          <TableHead className="text-xs">كود العضو</TableHead>
          <TableHead className="text-xs">اسم العضو</TableHead>
          <TableHead className="text-xs w-8"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m: any) => (
          <TableRow key={m.id}>
            <TableCell className="text-xs">{m.memberType === 'user' ? 'مستخدم' : 'مجموعة'}</TableCell>
            <TableCell className="text-xs font-mono">{m.memberCode ?? '—'}</TableCell>
            <TableCell className="text-xs">{m.memberName ?? '—'}</TableCell>
            <TableCell>
              <button className="text-destructive text-xs hover:underline" onClick={() => removeMember.mutate({ id: m.id })}>
                حذف
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AddMemberToGroup({ groupId, users, groups, onErrorChange }: { groupId: number; users: any[]; groups: any[]; onErrorChange?: (hasError: boolean) => void }) {
  const utils = trpc.useUtils();
  const { data: savedMembers = [] } = trpc.groupMembers.list.useQuery({ groupId });
  const addMember = trpc.groupMembers.add.useMutation({
    onSuccess: () => { utils.groupMembers.list.invalidate({ groupId }); setCode(""); setName(""); toast.success("تم إضافة العضو"); },
    onError: (e) => toast.error(e.message),
  });
  const [type, setType] = useState<'user'|'group'>('user');
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const existingCodes = (savedMembers as any[])
    .filter((m: any) => m.memberType === type)
    .map((m: any) => m.memberCode)
    .filter(Boolean);

  const isDuplicate = !!code.trim() && existingCodes.includes(code.trim());
  useEffect(() => { onErrorChange?.(isDuplicate); }, [isDuplicate]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">نوع العضو</TableHead>
          <TableHead className="text-xs">كود العضو</TableHead>
          <TableHead className="text-xs">اسم العضو</TableHead>
          <TableHead className="text-xs w-8"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <MemberRow memberType={type} setMemberType={setType} memberCode={code} setMemberCode={setCode}
          memberName={name} setMemberName={setName} users={users} groups={groups}
          existingCodes={existingCodes}
          onAdd={() => {
            if (existingCodes.includes(code.trim())) return;
            addMember.mutate({ groupId, memberType: type, memberCode: code.trim(), memberName: name || undefined });
          }} />
      </TableBody>
    </Table>
  );
}

// ─── User Groups ───────────────────────────────────────────────────────────────

function UserGroupsPage() {
  const utils = trpc.useUtils();
  const { data: groups = [], isLoading } = trpc.userGroups.list.useQuery();
  const { data: allUsers = [] } = trpc.users.list.useQuery();

  const createGroup = trpc.userGroups.create.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const addBulk = trpc.groupMembers.addBulk.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const deleteGroup = trpc.userGroups.delete.useMutation({
    onSuccess: () => { utils.userGroups.list.invalidate(); toast.success("تم حذف المجموعة"); },
    onError: (e) => toast.error(e.message),
  });
  const updateGroup = trpc.userGroups.update.useMutation({
    onSuccess: () => { utils.userGroups.list.invalidate(); setEditId(null); toast.success("تم تعديل المجموعة"); },
    onError: (e) => toast.error(e.message),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [rowType, setRowType] = useState<'user'|'group'>('user');
  const [rowCode, setRowCode] = useState("");
  const [rowName, setRowName] = useState("");

  const [editId, setEditId] = useState<number | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editMemberHasError, setEditMemberHasError] = useState(false);

  // duplicate rows highlighted at save time (not during typing)
  const [dupKeySet, setDupKeySet] = useState<Set<string>>(new Set());
  const [inputRowDup, setInputRowDup] = useState(false);

  const addPending = () => {
    if (!rowCode.trim() || !rowName.trim()) return;
    setPendingMembers(prev => [...prev, { memberType: rowType, memberCode: rowCode.trim(), memberName: rowName }]);
    setDupKeySet(new Set());
    setInputRowDup(false);
    setRowCode(""); setRowName("");
  };

  const validateAndSave = async () => {
    // build full list: pendingMembers + current input row (if filled)
    const inputFilled = !!rowCode.trim() && !!rowName.trim();
    const allRows: PendingMember[] = inputFilled
      ? [...pendingMembers, { memberType: rowType, memberCode: rowCode.trim(), memberName: rowName }]
      : [...pendingMembers];

    // find duplicate type:code keys
    const seen = new Map<string, number>();
    for (const m of allRows) {
      const key = `${m.memberType}:${m.memberCode}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const dups = new Set<string>();
    for (const [key, count] of seen.entries()) { if (count > 1) dups.add(key); }

    // also flag input row if it duplicates an existing pendingMember
    const inputKey = `${rowType}:${rowCode.trim()}`;
    const inputIsDup = inputFilled && pendingMembers.some(m => `${m.memberType}:${m.memberCode}` === inputKey);

    if (dups.size > 0 || inputIsDup) {
      setDupKeySet(dups);
      setInputRowDup(inputIsDup);
      toast.error("العضو تم تكراره بالجدول — أزل التكرار ثم احفظ");
      return;
    }
    setDupKeySet(new Set());
    setInputRowDup(false);
    try {
      const g = await createGroup.mutateAsync({ code: newCode || undefined, name: newName.trim() });
      if (pendingMembers.length) {
        await addBulk.mutateAsync({ groupId: g.id, members: pendingMembers });
      }
      utils.userGroups.list.invalidate();
      setShowAdd(false);
      setNewCode(""); setNewName("");
      setPendingMembers([]);
      toast.success("تم إضافة المجموعة");
    } catch { /* errors shown via onError */ }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">مجموعات المستخدمين</h3>
        <Button className="h-8 text-sm" onClick={() => { setShowAdd(v => !v); setEditId(null); }}>
          <Plus className="w-3.5 h-3.5 ml-1" />مجموعة جديدة
        </Button>
      </div>

      {/* ── نموذج إضافة مجموعة ── */}
      {showAdd && (
        <Card className="border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">الكود</Label>
              <Input className="h-8 text-sm" value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="GRP01" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">اسم المجموعة *</Label>
              <Input className="h-8 text-sm" value={newName} onChange={e => setNewName(e.target.value)} placeholder="مثال: أمناء المخازن" />
            </div>
          </div>

          {/* ─ جدول الأعضاء المؤقتين ─ */}
          <div className="border border-border/60 rounded-md overflow-hidden bg-white">
            <div className="bg-muted/30 px-3 py-1.5 border-b border-border/40">
              <span className="text-xs font-medium text-muted-foreground">أعضاء المجموعة</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">نوع العضو</TableHead>
                  <TableHead className="text-xs">كود العضو</TableHead>
                  <TableHead className="text-xs">اسم العضو</TableHead>
                  <TableHead className="text-xs w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingMembers.map((m, i) => {
                  const rowKey = `${m.memberType}:${m.memberCode}`;
                  const isDupRow = dupKeySet.has(rowKey);
                  return (
                    <TableRow key={i} className={isDupRow ? "bg-destructive/10" : ""}>
                      <TableCell className="text-xs">{m.memberType === 'user' ? 'مستخدم' : 'مجموعة'}</TableCell>
                      <TableCell className={`text-xs font-mono ${isDupRow ? "text-destructive font-bold" : ""}`}>{m.memberCode}</TableCell>
                      <TableCell className="text-xs">{m.memberName || '—'}</TableCell>
                      <TableCell>
                        <button className="text-destructive text-xs" onClick={() => {
                          setPendingMembers(p => p.filter((_, j) => j !== i));
                          setDupKeySet(new Set());
                        }}>حذف</button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <MemberRow memberType={rowType} setMemberType={setRowType}
                  memberCode={rowCode} setMemberCode={v => { setRowCode(v); setInputRowDup(false); }}
                  memberName={rowName} setMemberName={setRowName} users={allUsers} groups={groups}
                  existingCodes={[]}
                  dupHighlight={inputRowDup}
                  onAdd={addPending} />
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <Button size="sm" className="h-7 text-xs"
              disabled={!newName.trim() || createGroup.isPending || addBulk.isPending}
              onClick={validateAndSave}>
              {(createGroup.isPending || addBulk.isPending) ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => { setShowAdd(false); setNewCode(""); setNewName(""); setPendingMembers([]); setDupKeySet(new Set()); setInputRowDup(false); }}>
              إلغاء
            </Button>
            {(dupKeySet.size > 0 || inputRowDup) && (
              <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                ⚠ العضو تم تكراره بالجدول — لا يمكن الحفظ
              </span>
            )}
          </div>
        </Card>
      )}

      {/* ── نموذج تعديل مجموعة ── */}
      {editId !== null && (
        <Card className="border-amber-200 bg-amber-50/30 p-4 space-y-3">
          <p className="text-xs font-semibold text-amber-700">تعديل المجموعة</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">الكود</Label>
              <Input className="h-8 text-sm" value={editCode} onChange={e => setEditCode(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">اسم المجموعة *</Label>
              <Input className="h-8 text-sm" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
          </div>

          {/* ─ أعضاء المجموعة الحالية ─ */}
          <div className="border border-border/60 rounded-md overflow-hidden bg-white">
            <div className="bg-muted/30 px-3 py-1.5 border-b border-border/40">
              <span className="text-xs font-medium text-muted-foreground">أعضاء المجموعة</span>
            </div>
            <SavedMembersTable groupId={editId} />
            <div className="border-t border-border/40">
              <AddMemberToGroup groupId={editId} users={allUsers} groups={groups} onErrorChange={setEditMemberHasError} />
            </div>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <Button size="sm" className="h-7 text-xs" disabled={!editName.trim() || editMemberHasError || updateGroup.isPending}
              onClick={() => {
                if (editMemberHasError) { toast.error("يوجد كود عضو مكرر — أزل الكود المكرر أولاً"); return; }
                updateGroup.mutate({ id: editId, code: editCode || undefined, name: editName });
              }}>
              {updateGroup.isPending ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditId(null); setEditMemberHasError(false); }}>إلغاء</Button>
            {editMemberHasError && (
              <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                ⚠ العضو تم تكرار بالجدول — لا يمكن الحفظ
              </span>
            )}
          </div>
        </Card>
      )}

      {/* ── جدول المجموعات ── */}
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-20">الكود</TableHead>
              <TableHead className="text-xs">اسم المجموعة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={3} className="text-xs text-center text-muted-foreground py-6">جارٍ التحميل...</TableCell></TableRow>
            )}
            {!isLoading && groups.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-xs text-center text-muted-foreground py-6">لا توجد مجموعات — أضف مجموعة جديدة</TableCell></TableRow>
            )}
            {groups.map((g: any) => (
              <TableRow key={g.id} className={editId === g.id ? "bg-amber-50/40" : ""}>
                <TableCell className="text-xs font-mono text-muted-foreground">{g.code ?? "—"}</TableCell>
                <TableCell className="text-xs font-medium">{g.name}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary text-xs hover:underline"
                      onClick={() => { setEditId(g.id); setEditCode(g.code ?? ""); setEditName(g.name); setShowAdd(false); }}>
                      تعديل
                    </button>
                    <button className="text-destructive text-xs hover:underline"
                      onClick={() => deleteGroup.mutate({ id: g.id })}>
                      حذف
                    </button>
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

// ─── QR Settings Page ──────────────────────────────────────────────────────────

function QRSettingsPage() {
  const qrQuery = trpc.qrSettings.get.useQuery();
  const upsertMutation = trpc.qrSettings.upsert.useMutation({
    onSuccess: () => {
      toast.success("✓ تم حفظ إعدادات QR Code");
      qrQuery.refetch();
    },
    onError: (e) => toast.error(`خطأ: ${e.message}`),
  });

  const s = qrQuery.data;

  const [isEnabled, setIsEnabled] = useState(true);
  const [system, setSystem] = useState<QrSystem>("zatca");
  const [sellerName, setSellerName] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [customFormat, setCustomFormat] = useState("{{sellerName}}\n{{taxNumber}}\n{{invoiceDateTime}}\n{{totalAmount}}\n{{vatAmount}}");
  const [showOnSales, setShowOnSales] = useState(true);
  const [showOnPurchase, setShowOnPurchase] = useState(false);
  const [showOnReceipt, setShowOnReceipt] = useState(false);
  const [qrSize, setQrSize] = useState(100);
  const [qrPosition, setQrPosition] = useState("top-right");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!s) return;
    setIsEnabled(s.isEnabled);
    setSystem((s.countrySystem as QrSystem) ?? "zatca");
    setSellerName(s.sellerName ?? "");
    setTaxNumber(s.taxNumber ?? "");
    setCustomFormat(s.customFormat ?? "{{sellerName}}\n{{taxNumber}}\n{{invoiceDateTime}}\n{{totalAmount}}\n{{vatAmount}}");
    setShowOnSales(s.showOnSalesInvoice);
    setShowOnPurchase(s.showOnPurchaseInvoice);
    setShowOnReceipt(s.showOnReceiptVoucher);
    setQrSize(s.qrSize ?? 100);
    setQrPosition(s.qrPosition ?? "top-right");
  }, [s]);

  // معاينة QR
  const previewContent = (() => {
    const sampleData = {
      sellerName: sellerName || "OneSoft Company",
      taxNumber: taxNumber || "300000000000003",
      invoiceDateTime: new Date().toISOString(),
      totalAmount: 1150.00,
      vatAmount: 150.00,
      invoiceNumber: "INV-2026-000001",
    };
    try {
      return generateQrContent(system, sampleData, customFormat);
    } catch {
      return "";
    }
  })();

  const handleSave = () => {
    upsertMutation.mutate({
      isEnabled, countrySystem: system,
      sellerName: sellerName || null,
      taxNumber: taxNumber || null,
      customFormat: system === "custom" ? customFormat : null,
      showOnSalesInvoice: showOnSales,
      showOnPurchaseInvoice: showOnPurchase,
      showOnReceiptVoucher: showOnReceipt,
      qrSize, qrPosition,
    });
  };

  if (qrQuery.isLoading) return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">جاري التحميل...</div>;

  return (
    <div className="space-y-5 max-w-3xl" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#406B93]" />
            إعدادات QR Code
          </h3>
          <p className="text-muted-foreground text-xs mt-0.5">تهيئة نظام QR Code للفواتير ونماذج الطباعة</p>
        </div>
        <Button onClick={handleSave} disabled={upsertMutation.isPending} className="h-8 text-sm bg-[#406B93] hover:bg-[#315578]">
          <Save className="w-3.5 h-3.5 ml-1" />
          {upsertMutation.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </div>

      {/* تفعيل QR */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">تفعيل نظام QR Code</p>
              <p className="text-xs text-muted-foreground mt-0.5">عند التفعيل يظهر QR تلقائياً في نماذج الطباعة المحددة</p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>
        </CardContent>
      </Card>

      {isEnabled && (<>
        {/* اختيار النظام */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-bold">نظام QR Code</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {QR_SYSTEMS.map(sys => (
              <div key={sys.id}
                onClick={() => setSystem(sys.id)}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  system === sys.id
                    ? "border-[#406B93] bg-[#406B93]/5"
                    : "border-border hover:border-[#406B93]/40 hover:bg-accent/10"
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 transition-all ${
                  system === sys.id ? "border-[#406B93] bg-[#406B93]" : "border-gray-300"
                }`}>
                  {system === sys.id && <div className="w-2 h-2 rounded-full bg-white m-auto mt-0.5" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{sys.label}</span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">{sys.country}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{sys.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* بيانات المنشأة */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-bold">بيانات المنشأة في QR</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">اسم المنشأة</Label>
                <Input value={sellerName} onChange={e => setSellerName(e.target.value)}
                  placeholder="اسم الشركة أو المنشأة..." className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">الرقم الضريبي</Label>
                <Input value={taxNumber} onChange={e => setTaxNumber(e.target.value)}
                  placeholder="300000000000003" className="h-8 text-sm mt-1 font-mono" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
              ℹ️ إذا تُركت فارغة، يُستخدم الرقم الضريبي واسم المنشأة من بيانات الفاتورة تلقائياً
            </p>
          </CardContent>
        </Card>

        {/* قالب مخصص */}
        {system === "custom" && (
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-bold">قالب QR المخصص</CardTitle>
                <button onClick={() => setShowHelp(h => !h)} className="text-xs text-[#406B93] hover:underline">
                  {showHelp ? "إخفاء المساعدة" : "عرض المتغيرات المتاحة"}
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {showHelp && (
                <pre className="text-[10px] bg-gray-50 border border-gray-200 rounded p-2 text-gray-600 leading-5 whitespace-pre-wrap font-mono">
                  {CUSTOM_TEMPLATE_HELP}
                </pre>
              )}
              <Textarea
                value={customFormat}
                onChange={e => setCustomFormat(e.target.value)}
                rows={5}
                className="font-mono text-xs"
                placeholder="اكتب قالب QR المخصص هنا..."
              />
            </CardContent>
          </Card>
        )}

        {/* نماذج الطباعة */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-bold">نماذج الطباعة التي تعرض QR</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {[
              { id: "sales", label: "فاتورة المبيعات", val: showOnSales, set: setShowOnSales },
              { id: "purchase", label: "فاتورة المشتريات", val: showOnPurchase, set: setShowOnPurchase },
              { id: "receipt", label: "سند القبض", val: showOnReceipt, set: setShowOnReceipt },
            ].map(item => (
              <div key={item.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{item.label}</span>
                </div>
                <Switch checked={item.val} onCheckedChange={item.set} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* مظهر QR */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-bold">مظهر QR Code</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">حجم QR (بكسل)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number" min={50} max={300} value={qrSize}
                    onChange={e => setQrSize(Number(e.target.value))}
                    className="h-8 text-sm w-24"
                  />
                  <span className="text-xs text-muted-foreground">{qrSize}×{qrSize} px</span>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">موضع QR في الفاتورة</Label>
                <Select value={qrPosition} onValueChange={setQrPosition}>
                  <SelectTrigger className="h-8 text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-right">أعلى اليمين</SelectItem>
                    <SelectItem value="top-left">أعلى اليسار</SelectItem>
                    <SelectItem value="bottom-right">أسفل اليمين</SelectItem>
                    <SelectItem value="bottom-left">أسفل اليسار</SelectItem>
                    <SelectItem value="bottom-center">أسفل الوسط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* معاينة QR */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-bold">معاينة QR Code</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-6">
              {previewContent ? (
                <div className="flex flex-col items-center gap-2">
                  <QRCodeDisplay content={previewContent} size={Math.min(qrSize, 160)} />
                  <span className="text-[10px] text-muted-foreground">
                    معاينة ({QR_SYSTEMS.find(s => s.id === system)?.country})
                  </span>
                </div>
              ) : (
                <div className="w-32 h-32 bg-gray-100 border border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-xs">
                  لا توجد معاينة
                </div>
              )}
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-0.5">النظام المختار</p>
                  <Badge className="text-[11px]">{QR_SYSTEMS.find(s => s.id === system)?.label}</Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-0.5">بيانات المعاينة (عيّنة)</p>
                  <p className="text-xs text-gray-500">إجمالي: 1,150.000 — ضريبة: 150.000</p>
                </div>
                {system === "zatca" && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-700">
                    ✓ متوافق مع معيار ZATCA e-invoice Phase 2 (TLV → Base64)
                  </div>
                )}
                {system === "eta" && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[11px] text-blue-700">
                    ✓ متوافق مع معيار ETA (النظام الضريبي المصري) — JSON
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </>)}
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
    case "user-categories":      return <UserCategoriesPage />;
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
    case "warehouses-config":    return <Warehouses />;
    case "document-journals":    return <DocumentJournalsPage />;
    case "document-types":       return <DocumentTypesPage />;
    case "document-templates":   return <DocumentTemplatesPage />;
    case "qr-settings":          return <QRSettingsPage />;
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
export function CfgUserCategoriesTab()   { return <CfgSubPage activeId="user-categories" />; }
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
export function CfgDocTypesTab()          { return <CfgSubPage activeId="doc-types" />; }
export function CfgDocBooksTab()          { return <CfgSubPage activeId="doc-books" />; }
export function CfgDocumentJournalsTab()  { return <CfgSubPage activeId="document-journals" />; }
export function CfgDocumentTypesTab()     { return <CfgSubPage activeId="document-types" />; }
export function CfgDocumentTemplatesTab() { return <CfgSubPage activeId="document-templates" />; }
export function CfgFieldDesignTab()      { return <CfgSubPage activeId="field-design" />; }
export function CfgBackupTab()           { return <CfgSubPage activeId="backup" />; }
export function CfgAuditLogTab()         { return <CfgSubPage activeId="audit-log" />; }
export function CfgQrSettingsTab()       { return <CfgSubPage activeId="qr-settings" />; }
export function CfgMissingDocsTab()      { return <CfgSubPage activeId="missing-doc-numbers" />; }
export function CfgPayrollPeriodsTab()   { return <CfgSubPage activeId="payroll-periods" />; }
export function CfgOrgChartTab()         { return <CfgSubPage activeId="org-chart" />; }
export function CfgWageCalendarTab()     { return <CfgSubPage activeId="wage-calendar" />; }
export function CfgShiftsTab()           { return <CfgSubPage activeId="shifts-setup" />; }
export function CfgReportDesignerTab()   { return <CfgSubPage activeId="report-designer" />; }
export function CfgTestSetupTab()        { return <CfgSubPage activeId="test-files-setup" />; }
export function CfgTestEditTab()         { return <CfgSubPage activeId="test-files-edit" />; }
export function CfgFieldSpecsTab()       { return <CfgSubPage activeId="field-specs" />; }
