import { useState, useRef, useEffect } from "react";
import { DateSegmentInput } from "@/components/DateSegmentInput";
import { fmtDate, fmtDateTime } from "@/utils/dateUtils";
import { useTabManager } from "@/contexts/TabManagerContext";
import { trpc } from "@/lib/trpc";
import Warehouses from "./Warehouses";
import DocumentJournalsPage from "./DocumentJournalsPage";

import TemplatesManagerPage from "./TemplatesManagerPage";
import ZatcaIntegrationPage from "./ZatcaIntegrationPage";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ChevronDown, ChevronRight, Settings, Building2, DollarSign,
  Calendar, Users, Shield, Database, FileText, History,
  Warehouse, Tag, BookOpen, Layout, Download, Bell,
  ArrowRight, Save, Plus, Trash2, Edit2, Clock, GitBranch,
  AlertTriangle, CheckCircle, XCircle, BarChart2, Lock, List, QrCode,
  MessageSquare, Send, Bot, Mail, Eye, RefreshCw,
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
      { id: "company-info",    label: "معلومات الشركة",         status: "done",    path: "/cfg/company" },
      { id: "currencies",      label: "العملات",               status: "done",    path: "/cfg/currencies" },
      { id: "taxes",           label: "الضرائب",               status: "done",    path: "/cfg/taxes" },
      { id: "qr-settings",     label: "إعدادات QR Code",       status: "done",    path: "/cfg/qr-settings" },
      { id: "fiscal-periods",  label: "الفترات المحاسبية",     status: "done",    path: "/cfg/fiscal" },
      { id: "field-dictionary",label: "تعريف الحقول (Field Dictionary)", status: "done", path: "/cfg/field-dictionary" },
      { id: "payment-methods", label: "وسائل الدفع",                     status: "done", path: "/cfg/payment-methods" },
    ],
  },
  {
    id: "loyalty",
    label: "إدارة الولاء والعروض",
    color: "#f59e0b",
    emoji: "🏆",
    children: [
      { id: "loyalty-points",   label: "إعدادات النقاط",     status: "partial", path: "/cfg/loyalty-points"   },
      { id: "loyalty-tiers",    label: "مستويات العضوية",    status: "partial", path: "/cfg/loyalty-tiers"    },
      { id: "loyalty-promos",   label: "العروض الترويجية",   status: "partial", path: "/cfg/loyalty-promos"   },
      { id: "loyalty-messages", label: "رسائل الولاء",       status: "partial", path: "/cfg/loyalty-messages" },
    ],
  },
  {
    id: "user-management",
    label: "إدارة المستخدمين",
    color: "#406B93",
    emoji: "👥",
    children: [
      { id: "user-categories", label: "فئات المستخدمين",     status: "done",    path: "/cfg/user-categories" },
      { id: "users-list",      label: "المستخدمين",          status: "missing", path: "/cfg/users"           },
      { id: "user-groups",     label: "مجموعات المستخدمين",  status: "missing", path: "/cfg/user-groups"     },
      { id: "permissions",     label: "صلاحيات المستخدمين",  status: "missing", path: "/cfg/permissions"     },
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
    id: "design-print",
    label: "التصميم والطباعة",
    color: "#0ea5e9",
    emoji: "🖨️",
    children: [
      { id: "document-templates",  label: "نماذج وقوالب المستندات",         status: "partial", path: "/cfg/document-templates" },
      { id: "print-settings",   label: "إعدادات الطباعة",                status: "done",    path: "/cfg/print-settings"   },
      { id: "logo-stamp",       label: "إعدادات الشعار والختم",          status: "done",    path: "/cfg/logo-stamp"       },
      { id: "signatures",       label: "إعدادات التوقيع الإلكتروني",     status: "done",    path: "/cfg/signatures"       },
      { id: "email-pdf",        label: "إعدادات البريد الإلكتروني وPDF", status: "done",    path: "/cfg/email-pdf"        },
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

      { id: "backup",              label: "النسخ الاحتياطي",     status: "done",    path: "/cfg/backup" },
      { id: "audit-log",           label: "سجل العمليات",        status: "done",    path: "/cfg/audit-log" },
    ],
  },
  {
    id: "messaging",
    label: "مركز الرسائل والتكاملات",
    color: "#10b981",
    emoji: "💬",
    children: [
      { id: "messaging-whatsapp",  label: "WhatsApp Business",    status: "partial", path: "/cfg/messaging-whatsapp"  },
      { id: "messaging-telegram",  label: "Telegram Bot",         status: "partial", path: "/cfg/messaging-telegram"  },
      { id: "messaging-email",     label: "البريد الإلكتروني",    status: "partial", path: "/cfg/messaging-email"     },
      { id: "messaging-templates", label: "قوالب الرسائل",        status: "partial", path: "/cfg/messaging-templates" },
      { id: "messaging-log",       label: "سجل الإرسال",          status: "partial", path: "/cfg/messaging-log"       },
    ],
  },
  {
    id: "gov-integrations",
    label: "التكاملات الحكومية",
    color: "#16a34a",
    emoji: "🏛️",
    children: [
      { id: "zatca-config",   label: "هيئة الزكاة والضريبة (ZATCA)", status: "partial", path: "/cfg/zatca"      },
      { id: "zatca-monitor",  label: "لوحة متابعة ZATCA",             status: "partial", path: "/cfg/zatca-mon"  },
      { id: "zatca-invoices", label: "فواتير الهيئة",                  status: "partial", path: "/cfg/zatca-inv"  },
      { id: "zatca-logs",     label: "سجل عمليات ZATCA",              status: "partial", path: "/cfg/zatca-log"  },
      { id: "gosi-config",    label: "التأمينات الاجتماعية (GOSI)",    status: "missing", path: "/cfg/gosi"       },
      { id: "gazt-config",    label: "الزكاة والدخل (GAZT)",           status: "missing", path: "/cfg/gazt"       },
    ],
  },
  {
    id: "hr-settings",
    label: "إعدادات أخرى",
    color: "#a855f7",
    emoji: "📁",
    children: [
      { id: "missing-doc-numbers", label: "أرقام المستندات المفقودة", status: "partial", path: "/cfg/missing-docs" },
      { id: "payroll-periods",     label: "فترات الرواتب",            status: "partial", path: "/cfg/payroll-periods" },
      { id: "org-chart",           label: "ملف الهيكل الإداري",       status: "partial", path: "/cfg/org-chart" },
      { id: "wage-calendar",       label: "تقويم نظام الأجور",        status: "partial", path: "/cfg/wage-calendar" },
      { id: "shifts-setup",        label: "ملف الدوامات",             status: "partial", path: "/cfg/shifts" },
      { id: "report-designer",     label: "أدوات التقارير",           status: "partial", path: "/cfg/report-designer" },
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
    loyalty: false,
    "user-management": false,
    approvals: false,
    notifications: false,
    system: false,
    messaging: false,
    "gov-integrations": false,
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

type CurrencyRow = {
  id: number; code: string; nameAr: string; nameEn: string;
  symbol: string; symbolIntl: string | null;
  exchangeRate: string; decimalPlaces: number;
  isBase: boolean; isActive: boolean;
  mainUnitAr: string | null; subUnitAr: string | null;
  mainUnitEn: string | null; subUnitEn: string | null;
};

const EMPTY_CURRENCY: Omit<CurrencyRow, "id"> = {
  code: "", nameAr: "", nameEn: "", symbol: "", symbolIntl: "",
  exchangeRate: "1", decimalPlaces: 2, isBase: false, isActive: true,
  mainUnitAr: "", subUnitAr: "", mainUnitEn: "", subUnitEn: "",
};

function CurrencyDialog({
  open, onClose, initial, isEdit,
}: {
  open: boolean; onClose: () => void;
  initial: Omit<CurrencyRow, "id"> & { id?: number };
  isEdit: boolean;
}) {
  const [form, setForm] = useState(initial);
  const utils = trpc.useUtils();

  useEffect(() => { setForm(initial); }, [open]);

  const update = (k: keyof typeof form, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const createMut = trpc.currencies.create.useMutation({
    onSuccess: () => { toast.success("تمت إضافة العملة بنجاح"); utils.currencies.list.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.currencies.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث العملة بنجاح"); utils.currencies.list.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const saving = createMut.isPending || updateMut.isPending;

  function handleSave() {
    const payload = {
      code: form.code.trim().toUpperCase(),
      nameAr: form.nameAr.trim(), nameEn: form.nameEn.trim(),
      symbol: form.symbol.trim(),
      symbolIntl: form.symbolIntl?.trim() || null,
      exchangeRate: form.exchangeRate || "1",
      decimalPlaces: form.decimalPlaces,
      isBase: form.isBase, isActive: form.isActive,
      mainUnitAr: form.mainUnitAr?.trim() || null,
      subUnitAr: form.subUnitAr?.trim() || null,
      mainUnitEn: form.mainUnitEn?.trim() || null,
      subUnitEn: form.subUnitEn?.trim() || null,
    };
    if (!payload.code || !payload.nameAr || !payload.nameEn || !payload.symbol) {
      toast.error("الكود واسم العملة والرمز مطلوبة"); return;
    }
    if (isEdit && initial.id) updateMut.mutate({ id: initial.id, ...payload });
    else createMut.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-base">{isEdit ? "تعديل العملة" : "إضافة عملة جديدة"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm mt-1">
          {/* Row 1 */}
          <div className="space-y-1">
            <Label className="text-xs">كود العملة <span className="text-destructive">*</span></Label>
            <Input value={form.code} onChange={e => update("code", e.target.value.toUpperCase())}
              placeholder="SAR" maxLength={10} className="h-8 font-mono uppercase" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">الرمز الدولي (اختياري)</Label>
            <Input value={form.symbolIntl ?? ""} onChange={e => update("symbolIntl", e.target.value)}
              placeholder="SAR" maxLength={10} className="h-8 font-mono" />
          </div>
          {/* Row 2 */}
          <div className="space-y-1">
            <Label className="text-xs">اسم العملة بالعربية <span className="text-destructive">*</span></Label>
            <Input value={form.nameAr} onChange={e => update("nameAr", e.target.value)}
              placeholder="ريال سعودي" className="h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Currency Name in English <span className="text-destructive">*</span></Label>
            <Input value={form.nameEn} onChange={e => update("nameEn", e.target.value)}
              placeholder="Saudi Riyal" className="h-8" dir="ltr" />
          </div>
          {/* Row 3 */}
          <div className="space-y-1">
            <Label className="text-xs">رمز العملة <span className="text-destructive">*</span></Label>
            <Input value={form.symbol} onChange={e => update("symbol", e.target.value)}
              placeholder="ر.س" maxLength={10} className="h-8" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">سعر الصرف</Label>
              <Input type="number" value={form.exchangeRate} onChange={e => update("exchangeRate", e.target.value)}
                min={0} step="0.000001" className="h-8" dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">المنازل العشرية</Label>
              <Input type="number" value={form.decimalPlaces} onChange={e => update("decimalPlaces", Number(e.target.value))}
                min={0} max={8} className="h-8" dir="ltr" />
            </div>
          </div>
          {/* Amount in words section */}
          <div className="col-span-2 border border-border/50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">المبلغ بالحروف</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">الوحدة الرئيسية عربي</Label>
                <Input value={form.mainUnitAr ?? ""} onChange={e => update("mainUnitAr", e.target.value)}
                  placeholder="ريال" className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الوحدة الفرعية عربي</Label>
                <Input value={form.subUnitAr ?? ""} onChange={e => update("subUnitAr", e.target.value)}
                  placeholder="هللة" className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Main Unit English</Label>
                <Input value={form.mainUnitEn ?? ""} onChange={e => update("mainUnitEn", e.target.value)}
                  placeholder="Riyal" className="h-8" dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sub Unit English</Label>
                <Input value={form.subUnitEn ?? ""} onChange={e => update("subUnitEn", e.target.value)}
                  placeholder="Halala" className="h-8" dir="ltr" />
              </div>
            </div>
          </div>
          {/* Flags */}
          <div className="flex items-center gap-6 col-span-2">
            <div className="flex items-center gap-2">
              <Switch checked={form.isBase} onCheckedChange={v => update("isBase", v)} id="isBase" />
              <Label htmlFor="isBase" className="text-xs cursor-pointer">عملة أساسية</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={v => update("isActive", v)} id="isActive" />
              <Label htmlFor="isActive" className="text-xs cursor-pointer">نشطة</Label>
            </div>
          </div>
        </div>
        <DialogFooter className="mt-2 gap-2">
          <Button variant="outline" onClick={onClose} className="h-8 text-xs">إلغاء</Button>
          <Button onClick={handleSave} disabled={saving} className="h-8 text-xs">
            {saving ? "جاري الحفظ..." : (isEdit ? "حفظ التعديلات" : "إضافة العملة")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CurrenciesPage() {
  const utils = trpc.useUtils();
  const listQ = trpc.currencies.list.useQuery();
  const seedMut = trpc.currencies.seedDefaults.useMutation({
    onSuccess: (r) => { if (r.seeded) utils.currencies.list.invalidate(); },
  });
  const deleteMut = trpc.currencies.delete.useMutation({
    onSuccess: () => { toast.success("تم إيقاف العملة"); utils.currencies.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const seededRef = useRef(false);
  useEffect(() => {
    if (!seededRef.current && listQ.data && listQ.data.length === 0) {
      seededRef.current = true;
      seedMut.mutate();
    }
  }, [listQ.data]);

  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<(Omit<CurrencyRow, "id"> & { id?: number }) | null>(null);

  function openAdd() { setEditing({ ...EMPTY_CURRENCY }); setDlgOpen(true); }
  function openEdit(c: CurrencyRow) {
    setEditing({
      id: c.id, code: c.code, nameAr: c.nameAr, nameEn: c.nameEn,
      symbol: c.symbol, symbolIntl: c.symbolIntl ?? "",
      exchangeRate: c.exchangeRate, decimalPlaces: c.decimalPlaces,
      isBase: c.isBase, isActive: c.isActive,
      mainUnitAr: c.mainUnitAr ?? "", subUnitAr: c.subUnitAr ?? "",
      mainUnitEn: c.mainUnitEn ?? "", subUnitEn: c.subUnitEn ?? "",
    });
    setDlgOpen(true);
  }

  const rows = listQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">إدارة العملات</h3>
        <Button className="h-8 text-sm" onClick={openAdd}><Plus className="w-3.5 h-3.5 ml-1" />إضافة عملة</Button>
      </div>

      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">الكود</TableHead>
              <TableHead className="text-xs">اسم العملة عربي</TableHead>
              <TableHead className="text-xs">Currency Name</TableHead>
              <TableHead className="text-xs text-center">الرمز</TableHead>
              <TableHead className="text-xs text-center">سعر الصرف</TableHead>
              <TableHead className="text-xs text-center">العملة الأساسية</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-6">جاري التحميل...</TableCell></TableRow>
            )}
            {!listQ.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-6">لا توجد عملات</TableCell></TableRow>
            )}
            {rows.map(c => (
              <TableRow key={c.id} className={!c.isActive ? "opacity-50" : undefined}>
                <TableCell className="text-xs font-mono font-bold">{c.code}</TableCell>
                <TableCell className="text-xs">{c.nameAr}</TableCell>
                <TableCell className="text-xs" dir="ltr">{c.nameEn}</TableCell>
                <TableCell className="text-xs text-center font-mono">{c.symbol}</TableCell>
                <TableCell className="text-xs text-center" dir="ltr">{Number(c.exchangeRate).toFixed(4)}</TableCell>
                <TableCell className="text-center">
                  {c.isBase
                    ? <Badge className="text-xs bg-primary/10 text-primary border-primary/20">أساسية</Badge>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-center">
                  {c.isActive
                    ? <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200">نشطة</Badge>
                    : <Badge variant="secondary" className="text-xs bg-red-50 text-red-700 border-red-200">موقوفة</Badge>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-3">
                    <button className="text-primary text-xs hover:underline" onClick={() => openEdit(c as CurrencyRow)}>
                      تعديل
                    </button>
                    {!c.isBase && (
                      <button className="text-destructive text-xs hover:underline"
                        onClick={() => { if (confirm(`هل تريد إيقاف عملة ${c.nameAr}؟`)) deleteMut.mutate({ id: c.id }); }}>
                        إيقاف
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {editing && (
        <CurrencyDialog
          open={dlgOpen}
          onClose={() => setDlgOpen(false)}
          initial={editing}
          isEdit={!!editing.id}
        />
      )}
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

// ─── Loyalty: إعدادات النقاط ──────────────────────────────────────────────────

function LoyaltyPointsPage() {
  const [form, setForm] = useState({
    enabled: true,
    rateAmount: "100",
    ratePoints: "1",
    welcomePoints: "50",
    validityDays: "365",
    notifyBeforeDays: "30",
    redeemRate: "1",
    redeemMinPoints: "100",
    allowRedeemOnDiscount: false,
    calcOnNet: true,
  });
  const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4 max-w-2xl" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">إعدادات نظام النقاط</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">تفعيل النظام</span>
          <Switch checked={form.enabled} onCheckedChange={v => upd("enabled", v)} />
        </div>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-xs text-muted-foreground font-semibold">معدل اكتساب النقاط</CardTitle></CardHeader>
        <CardContent className="px-5 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">المبلغ (ريال)</Label>
              <Input value={form.rateAmount} onChange={e => upd("rateAmount", e.target.value)} className="h-8 text-sm mt-1" type="number" min="1" />
            </div>
            <span className="text-sm text-muted-foreground mt-5">=</span>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">عدد النقاط</Label>
              <Input value={form.ratePoints} onChange={e => upd("ratePoints", e.target.value)} className="h-8 text-sm mt-1" type="number" min="1" />
            </div>
          </div>
          <div className="text-[11px] text-amber-600 bg-amber-50 rounded px-3 py-1.5 border border-amber-100">
            مثال: كل {form.rateAmount} ريال = {form.ratePoints} نقطة
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="calcOnNet" checked={form.calcOnNet} onCheckedChange={v => upd("calcOnNet", !!v)} />
            <label htmlFor="calcOnNet" className="text-xs cursor-pointer">احتساب النقاط على صافي المبلغ (بعد الخصم وقبل الضريبة)</label>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-xs text-muted-foreground font-semibold">الاستبدال والصلاحية</CardTitle></CardHeader>
        <CardContent className="px-5 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">نقاط الترحيب (للعميل الجديد)</Label>
              <Input value={form.welcomePoints} onChange={e => upd("welcomePoints", e.target.value)} className="h-8 text-sm mt-1" type="number" min="0" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">صلاحية النقاط (أيام)</Label>
              <Input value={form.validityDays} onChange={e => upd("validityDays", e.target.value)} className="h-8 text-sm mt-1" type="number" min="0" placeholder="0 = بلا انتهاء" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">تنبيه قبل انتهاء الصلاحية (أيام)</Label>
              <Input value={form.notifyBeforeDays} onChange={e => upd("notifyBeforeDays", e.target.value)} className="h-8 text-sm mt-1" type="number" min="0" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">قيمة النقطة عند الاستبدال (ريال)</Label>
              <Input value={form.redeemRate} onChange={e => upd("redeemRate", e.target.value)} className="h-8 text-sm mt-1" type="number" min="0" step="0.01" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">الحد الأدنى للاستبدال (نقاط)</Label>
              <Input value={form.redeemMinPoints} onChange={e => upd("redeemMinPoints", e.target.value)} className="h-8 text-sm mt-1" type="number" min="0" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="redeemOnDiscount" checked={form.allowRedeemOnDiscount} onCheckedChange={v => upd("allowRedeemOnDiscount", !!v)} />
            <label htmlFor="redeemOnDiscount" className="text-xs cursor-pointer">السماح باستخدام النقاط مع الخصم في نفس الفاتورة</label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => toast.success("تم حفظ إعدادات النقاط")}>
          <Save className="w-3.5 h-3.5" /> حفظ الإعدادات
        </Button>
      </div>
    </div>
  );
}

// ─── Loyalty: مستويات العضوية ─────────────────────────────────────────────────

const DEFAULT_TIERS = [
  { id: "standard",  label: "عادي",     labelEn: "Standard",  color: "#6b7280", minSpend: 0,      minInvoices: 0,  minPoints: 0,    multiplier: 1.0 },
  { id: "silver",    label: "فضي",      labelEn: "Silver",    color: "#94a3b8", minSpend: 1000,   minInvoices: 5,  minPoints: 100,  multiplier: 1.5 },
  { id: "gold",      label: "ذهبي",     labelEn: "Gold",      color: "#d97706", minSpend: 5000,   minInvoices: 15, minPoints: 500,  multiplier: 2.0 },
  { id: "platinum",  label: "بلاتيني",  labelEn: "Platinum",  color: "#0891b2", minSpend: 15000,  minInvoices: 40, minPoints: 1500, multiplier: 2.5 },
  { id: "vip",       label: "VIP",      labelEn: "VIP",       color: "#7c3aed", minSpend: 50000,  minInvoices: 100,minPoints: 5000, multiplier: 3.0 },
];

function LoyaltyTiersPage() {
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [upgradeBy, setUpgradeBy] = useState<"spend" | "invoices" | "points">("spend");
  const upd = (idx: number, k: string, v: any) =>
    setTiers(p => p.map((t, i) => i === idx ? { ...t, [k]: v } : t));

  return (
    <div className="space-y-4 max-w-3xl" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">مستويات العضوية</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">معيار الترقية:</span>
          <Select value={upgradeBy} onValueChange={v => setUpgradeBy(v as any)}>
            <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="spend">إجمالي المشتريات</SelectItem>
              <SelectItem value="invoices">عدد الفواتير</SelectItem>
              <SelectItem value="points">عدد النقاط</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        {tiers.map((tier, idx) => (
          <Card key={tier.id} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: tier.color }}>
                  {tier.label.charAt(0)}
                </div>
                <div className="flex-1 grid grid-cols-4 gap-3">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">المستوى (عربي)</Label>
                    <Input value={tier.label} onChange={e => upd(idx, "label", e.target.value)} className="h-7 text-xs mt-0.5" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      {upgradeBy === "spend" ? "الحد الأدنى للمشتريات (ريال)" : upgradeBy === "invoices" ? "الحد الأدنى للفواتير" : "الحد الأدنى للنقاط"}
                    </Label>
                    <Input type="number" value={upgradeBy === "spend" ? tier.minSpend : upgradeBy === "invoices" ? tier.minInvoices : tier.minPoints}
                      onChange={e => upd(idx, upgradeBy === "spend" ? "minSpend" : upgradeBy === "invoices" ? "minInvoices" : "minPoints", Number(e.target.value))}
                      className="h-7 text-xs mt-0.5" disabled={idx === 0} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">مضاعف النقاط</Label>
                    <Input type="number" value={tier.multiplier} step="0.5" min="1"
                      onChange={e => upd(idx, "multiplier", parseFloat(e.target.value) || 1)}
                      className="h-7 text-xs mt-0.5" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">اللون</Label>
                    <div className="flex gap-1.5 items-center mt-0.5">
                      <input type="color" value={tier.color} onChange={e => upd(idx, "color", e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border border-border p-0.5" />
                      <span className="text-[10px] font-mono text-muted-foreground">{tier.color}</span>
                    </div>
                  </div>
                </div>
              </div>
              {idx > 0 && (
                <div className="mt-2 text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1">
                  الترقية من {tiers[idx-1].label}: عند تجاوز{" "}
                  {upgradeBy === "spend" ? `${tier.minSpend.toLocaleString()} ريال` : upgradeBy === "invoices" ? `${tier.minInvoices} فاتورة` : `${tier.minPoints} نقطة`}
                  {" "}· مضاعف النقاط: ×{tier.multiplier}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => toast.success("تم حفظ مستويات العضوية")}>
          <Save className="w-3.5 h-3.5" /> حفظ المستويات
        </Button>
      </div>
    </div>
  );
}

// ─── Loyalty: العروض الترويجية ─────────────────────────────────────────────────

type LoyaltyPromo = {
  id: string; name: string; nameEn: string;
  multiplier: number; startDate: string; endDate: string;
  scope: "all" | "category" | "branch"; scopeValue: string;
  enabled: boolean;
};

function LoyaltyPromosPage() {
  const [promos, setPromos] = useState<LoyaltyPromo[]>([
    { id: "1", name: "رمضان الكريم", nameEn: "Ramadan Offer", multiplier: 3, startDate: "2025-03-01", endDate: "2025-03-30", scope: "all", scopeValue: "", enabled: true },
    { id: "2", name: "العيد الوطني", nameEn: "National Day",  multiplier: 2, startDate: "2025-09-20", endDate: "2025-09-25", scope: "all", scopeValue: "", enabled: false },
  ]);
  const [showForm, setShowForm] = useState(false);
  const [editPromo, setEditPromo] = useState<LoyaltyPromo | null>(null);
  const blank: LoyaltyPromo = { id: Date.now().toString(), name: "", nameEn: "", multiplier: 2, startDate: "", endDate: "", scope: "all", scopeValue: "", enabled: true };
  const [form, setForm] = useState<LoyaltyPromo>(blank);
  const updForm = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const openNew = () => { setForm({ ...blank, id: Date.now().toString() }); setEditPromo(null); setShowForm(true); };
  const openEdit = (p: LoyaltyPromo) => { setForm({ ...p }); setEditPromo(p); setShowForm(true); };
  const savePromo = () => {
    if (editPromo) setPromos(p => p.map(x => x.id === editPromo.id ? form : x));
    else setPromos(p => [...p, form]);
    setShowForm(false);
    toast.success("تم حفظ العرض الترويجي");
  };
  const deletePromo = (id: string) => { setPromos(p => p.filter(x => x.id !== id)); toast.success("تم حذف العرض"); };
  const toggleEnabled = (id: string) => setPromos(p => p.map(x => x.id === id ? { ...x, enabled: !x.enabled } : x));

  return (
    <div className="space-y-4 max-w-3xl" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">العروض الترويجية</h3>
        <Button size="sm" className="gap-1.5" onClick={openNew}><Plus className="w-3.5 h-3.5" /> عرض جديد</Button>
      </div>

      <div className="space-y-2">
        {promos.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">لا توجد عروض. أضف عرضاً جديداً.</div>
        )}
        {promos.map(promo => (
          <Card key={promo.id} className={`border-border/50 ${!promo.enabled ? "opacity-50" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <span className="text-lg">🎁</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{promo.name}</span>
                    <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50">×{promo.multiplier} نقاط</Badge>
                    {promo.enabled ? <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">نشط</Badge> : <Badge variant="outline" className="text-[10px]">متوقف</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {promo.startDate} — {promo.endDate}
                    {promo.scope !== "all" && <span className="mr-2">· {promo.scope === "category" ? "فئة: " : "فرع: "}{promo.scopeValue}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch checked={promo.enabled} onCheckedChange={() => toggleEnabled(promo.id)} />
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(promo)}><Edit2 className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500" onClick={() => deletePromo(promo.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle className="text-sm">{editPromo ? "تعديل العرض" : "عرض ترويجي جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">اسم العرض (عربي)</Label><Input value={form.name} onChange={e => updForm("name", e.target.value)} className="h-8 text-sm mt-1" /></div>
              <div><Label className="text-xs">اسم العرض (إنجليزي)</Label><Input value={form.nameEn} onChange={e => updForm("nameEn", e.target.value)} className="h-8 text-sm mt-1" /></div>
              <div><Label className="text-xs">تاريخ البداية</Label><Input type="date" value={form.startDate} onChange={e => updForm("startDate", e.target.value)} className="h-8 text-sm mt-1" /></div>
              <div><Label className="text-xs">تاريخ الانتهاء</Label><Input type="date" value={form.endDate} onChange={e => updForm("endDate", e.target.value)} className="h-8 text-sm mt-1" /></div>
              <div><Label className="text-xs">مضاعف النقاط</Label><Input type="number" value={form.multiplier} min="1" step="0.5" onChange={e => updForm("multiplier", parseFloat(e.target.value) || 1)} className="h-8 text-sm mt-1" /></div>
              <div>
                <Label className="text-xs">نطاق التطبيق</Label>
                <Select value={form.scope} onValueChange={v => updForm("scope", v)}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأصناف</SelectItem>
                    <SelectItem value="category">فئة محددة</SelectItem>
                    <SelectItem value="branch">فرع محدد</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.scope !== "all" && (
                <div className="col-span-2">
                  <Label className="text-xs">{form.scope === "category" ? "الفئة" : "الفرع"}</Label>
                  <Input value={form.scopeValue} onChange={e => updForm("scopeValue", e.target.value)} className="h-8 text-sm mt-1" placeholder={form.scope === "category" ? "اسم الفئة..." : "اسم الفرع..."} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={v => updForm("enabled", v)} />
              <span className="text-xs">تفعيل العرض فور الحفظ</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button size="sm" onClick={savePromo}><Save className="w-3.5 h-3.5 ml-1" /> حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Loyalty: رسائل الولاء ─────────────────────────────────────────────────────

function LoyaltyMessagesPage() {
  const [channels, setChannels] = useState({ whatsapp: true, sms: false, email: true });
  const [templates, setTemplates] = useState({
    earnPoints:  { enabled: true,  text: "مرحباً {{CustomerName}}! لقد اكتسبت {{Points}} نقطة من فاتورتك رقم {{InvoiceNo}}. رصيدك الحالي: {{Balance}} نقطة." },
    tierUpgrade: { enabled: true,  text: "تهانينا {{CustomerName}}! تم ترقيتك إلى مستوى {{NewTier}}. استمتع بمزايا أكبر مع كل عملية شراء." },
    expiryAlert: { enabled: true,  text: "تذكير: لديك {{Points}} نقطة ستنتهي صلاحيتها في {{ExpiryDate}}. استخدمها قبل انتهاء الصلاحية." },
    welcomeMsg:  { enabled: true,  text: "أهلاً بك {{CustomerName}} في برنامج الولاء! حصلت على {{WelcomePoints}} نقطة كهدية ترحيب." },
    redeemDone:  { enabled: false, text: "تم خصم {{RedeemedPoints}} نقطة من رصيدك. رصيدك المتبقي: {{Balance}} نقطة." },
  });
  const updTmpl = (k: string, field: string, v: any) =>
    setTemplates(p => ({ ...p, [k]: { ...p[k as keyof typeof p], [field]: v } }));

  const EVENTS = [
    { key: "earnPoints",  label: "اكتساب نقاط جديدة",      icon: "⭐" },
    { key: "tierUpgrade", label: "ترقية لمستوى أعلى",       icon: "🏆" },
    { key: "expiryAlert", label: "قرب انتهاء صلاحية النقاط", icon: "⏰" },
    { key: "welcomeMsg",  label: "ترحيب بعميل جديد",         icon: "🎉" },
    { key: "redeemDone",  label: "استبدال نقاط",             icon: "🎁" },
  ] as const;

  const VARS_HINT = "المتغيرات: {{CustomerName}} {{Points}} {{Balance}} {{InvoiceNo}} {{NewTier}} {{ExpiryDate}} {{WelcomePoints}} {{RedeemedPoints}}";

  return (
    <div className="space-y-4 max-w-2xl" dir="rtl">
      <h3 className="font-semibold text-sm">رسائل الولاء</h3>

      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-xs text-muted-foreground font-semibold">قنوات الإرسال</CardTitle></CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="flex gap-6">
            {([["whatsapp","WhatsApp","#25D366"],["sms","SMS","#2563eb"],["email","البريد الإلكتروني","#7c3aed"]] as const).map(([k, label, color]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <Switch checked={channels[k]} onCheckedChange={v => setChannels(p => ({ ...p, [k]: v }))} />
                <span className="text-sm font-medium" style={{ color }}>{label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {EVENTS.map(ev => {
          const tmpl = templates[ev.key];
          return (
            <Card key={ev.key} className="border-border/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{ev.icon}</span>
                    <span className="text-sm font-medium">{ev.label}</span>
                  </div>
                  <Switch checked={tmpl.enabled} onCheckedChange={v => updTmpl(ev.key, "enabled", v)} />
                </div>
                {tmpl.enabled && (
                  <Textarea value={tmpl.text} onChange={e => updTmpl(ev.key, "text", e.target.value)}
                    className="text-xs resize-none h-16 font-mono" dir="rtl" />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-[10px] text-muted-foreground bg-muted/30 rounded px-3 py-2 border border-border/40">{VARS_HINT}</div>

      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => toast.success("تم حفظ إعدادات الرسائل")}>
          <Save className="w-3.5 h-3.5" /> حفظ الإعدادات
        </Button>
      </div>
    </div>
  );
}

// ─── Messaging: WhatsApp Business API ─────────────────────────────────────────

const WABA_TABS = ["الإعدادات", "معلومات الاتصال", "قوالب الرسائل", "سجل الإرسال"] as const;
type WabaTab = typeof WABA_TABS[number];

// ─ الجودة badge ──────────────────────────────────────────────────────────────
function QualityBadge({ quality }: { quality: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    GREEN:  { label: "جودة عالية ●",  cls: "text-green-600 bg-green-50 border-green-200" },
    YELLOW: { label: "جودة متوسطة ●", cls: "text-amber-600 bg-amber-50 border-amber-200" },
    RED:    { label: "جودة منخفضة ●", cls: "text-red-600 bg-red-50 border-red-200" },
  };
  const m = map[quality?.toUpperCase()] ?? { label: quality || "—", cls: "text-muted-foreground bg-muted border-border" };
  return <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${m.cls}`}>{m.label}</span>;
}

function MessagingWhatsAppPage() {
  const [activeTab, setActiveTab] = useState<WabaTab>("الإعدادات");

  const settingsQ     = trpc.documentSend.getSettings.useQuery();
  const wabaInfoQ     = trpc.documentSend.getWabaInfo.useQuery(undefined, { enabled: false });
  const templatesQ    = trpc.documentSend.getWabaTemplates.useQuery();
  const logsQ         = trpc.documentSend.getAllLogs.useQuery({ limit: 100, method: "whatsapp" });

  const updateMut     = trpc.documentSend.updateSettings.useMutation({
    onSuccess: () => { toast.success("تم حفظ الإعدادات ✓"); settingsQ.refetch(); },
    onError: e => toast.error(e.message),
  });
  const testMut       = trpc.documentSend.testWabaConnection.useMutation();
  const saveTemplates = trpc.documentSend.saveWabaTemplates.useMutation({
    onSuccess: r => { toast.success(`تم حفظ ${r.count} قالب ✓`); templatesQ.refetch(); },
    onError: e => toast.error(e.message),
  });

  const s = settingsQ.data;
  const [form, setForm] = useState({
    wabaEnabled: false,
    wabaApiUrl: "https://graph.facebook.com/v19.0",
    wabaAccessToken: "", wabaPhoneNumberId: "", wabaSenderName: "OneSoft ERP",
    wabaBusinessAccountId: "", wabaVerifyToken: "", wabaWebhookUrl: "",
  });
  const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (s) setForm({
      wabaEnabled:           s.wabaEnabled ?? false,
      wabaApiUrl:            s.wabaApiUrl ?? "https://graph.facebook.com/v19.0",
      wabaAccessToken:       s.wabaAccessToken ?? "",
      wabaPhoneNumberId:     s.wabaPhoneNumberId ?? "",
      wabaSenderName:        s.wabaSenderName ?? "OneSoft ERP",
      wabaBusinessAccountId: (s as any).wabaBusinessAccountId ?? "",
      wabaVerifyToken:       (s as any).wabaVerifyToken ?? "",
      wabaWebhookUrl:        (s as any).wabaWebhookUrl ?? "",
    });
  }, [s]);

  // نتيجة اختبار الاتصال
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; phoneInfo?: any } | null>(null);

  const handleTest = () => {
    setTestResult(null);
    testMut.mutate(undefined, {
      onSuccess: r => {
        setTestResult(r);
        if (r.ok) toast.success("✅ الاتصال ناجح");
        else toast.error("❌ " + r.message);
      },
      onError: e => toast.error(e.message),
    });
  };

  // قوالب محلية قابلة للتحرير
  const [templates, setTemplates] = useState<any[]>([]);
  const [editingTpl, setEditingTpl] = useState<number | null>(null);
  useEffect(() => { if (templatesQ.data) setTemplates(templatesQ.data); }, [templatesQ.data]);
  const updTpl = (idx: number, k: string, v: any) =>
    setTemplates(p => p.map((t, i) => i === idx ? { ...t, [k]: v } : t));

  const STATUS_COLORS: Record<string, string> = {
    sent: "text-green-600", failed: "text-red-600", pending: "text-amber-600",
  };

  return (
    <div className="space-y-4 max-w-3xl" dir="rtl">
      {/* ─ Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#25D366]" />
          WhatsApp Business API
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">تفعيل الإرسال عبر API</span>
          <Switch checked={form.wabaEnabled} onCheckedChange={v => upd("wabaEnabled", v)} />
        </div>
      </div>

      {/* ─ Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border">
        {WABA_TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-[#25D366] text-[#25D366]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>{tab}</button>
        ))}
      </div>

      {/* ══ تبويب: الإعدادات ═══════════════════════════════════════════ */}
      {activeTab === "الإعدادات" && (
        <div className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-xs text-muted-foreground font-semibold">إعدادات الاتصال الأساسية</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">API URL (Graph)</Label>
                <Input value={form.wabaApiUrl} onChange={e => upd("wabaApiUrl", e.target.value)}
                  className="h-8 text-xs mt-1 font-mono" dir="ltr" placeholder="https://graph.facebook.com/v19.0" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Access Token</Label>
                <Input value={form.wabaAccessToken} onChange={e => upd("wabaAccessToken", e.target.value)}
                  className="h-8 text-xs mt-1 font-mono" dir="ltr" type="password" placeholder="EAAxxxxx…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Phone Number ID</Label>
                  <Input value={form.wabaPhoneNumberId} onChange={e => upd("wabaPhoneNumberId", e.target.value)}
                    className="h-8 text-xs mt-1 font-mono" dir="ltr" placeholder="1234567890" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">اسم المرسل</Label>
                  <Input value={form.wabaSenderName} onChange={e => upd("wabaSenderName", e.target.value)}
                    className="h-8 text-sm mt-1" dir="rtl" placeholder="OneSoft ERP" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-xs text-muted-foreground font-semibold">إعدادات متقدمة</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">WhatsApp Business Account ID</Label>
                <Input value={form.wabaBusinessAccountId} onChange={e => upd("wabaBusinessAccountId", e.target.value)}
                  className="h-8 text-xs mt-1 font-mono" dir="ltr" placeholder="WABA ID من Meta Business Manager" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Verify Token (للـ Webhook)</Label>
                  <Input value={form.wabaVerifyToken} onChange={e => upd("wabaVerifyToken", e.target.value)}
                    className="h-8 text-xs mt-1 font-mono" dir="ltr" placeholder="my_verify_token" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                  <Input value={form.wabaWebhookUrl} onChange={e => upd("wabaWebhookUrl", e.target.value)}
                    className="h-8 text-xs mt-1 font-mono" dir="ltr" placeholder="https://domain.com/webhook/wa" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* نتيجة الاختبار */}
          {testResult && (
            <Card className={`border ${testResult.ok ? "border-green-200 bg-green-50 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:bg-red-950/20"}`}>
              <CardContent className="p-4 space-y-2">
                <p className={`text-sm font-semibold ${testResult.ok ? "text-green-700" : "text-red-700"}`}>
                  {testResult.ok ? "✅ الاتصال ناجح" : "❌ " + testResult.message}
                </p>
                {testResult.ok && testResult.phoneInfo && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">الرقم:</span> <span className="font-mono">{testResult.phoneInfo.displayNumber}</span></div>
                    <div><span className="text-muted-foreground">الاسم المُحقَّق:</span> <span>{testResult.phoneInfo.verifiedName}</span></div>
                    <div><span className="text-muted-foreground">الجودة:</span> <QualityBadge quality={testResult.phoneInfo.quality} /></div>
                    <div><span className="text-muted-foreground">الحالة:</span> <span className="text-green-600 font-medium">{testResult.phoneInfo.status}</span></div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2 justify-end">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleTest} disabled={testMut.isPending}>
              <Eye className="w-3.5 h-3.5" /> {testMut.isPending ? "جاري الاختبار…" : "اختبار الاتصال"}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => updateMut.mutate(form)} disabled={updateMut.isPending}>
              <Save className="w-3.5 h-3.5" /> {updateMut.isPending ? "جاري الحفظ…" : "حفظ الإعدادات"}
            </Button>
          </div>

          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
            <CardContent className="p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
              <p className="font-semibold">📋 متطلبات WhatsApp Business API</p>
              <p>• حساب Meta Business Manager مع التحقق الكامل</p>
              <p>• رقم هاتف مسجل في WhatsApp Business Platform</p>
              <p>• قوالب رسائل معتمدة من Meta لكل نوع إشعار</p>
              <p>• Webhook مُعدّ لاستقبال إشعارات التسليم والقراءة</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══ تبويب: معلومات الاتصال ════════════════════════════════════ */}
      {activeTab === "معلومات الاتصال" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleTest} disabled={testMut.isPending}>
              <RefreshCw className={`w-3 h-3 ${testMut.isPending ? "animate-spin" : ""}`} />
              تحديث معلومات الاتصال
            </Button>
          </div>

          {!testResult && !testMut.isPending && (
            <div className="text-center py-10 text-muted-foreground text-sm space-y-3">
              <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <p>اضغط "تحديث" للحصول على معلومات الاتصال من Meta</p>
            </div>
          )}

          {testMut.isPending && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" />جاري الاتصال بـ Meta…
            </div>
          )}

          {testResult && (
            <div className="space-y-3">
              <Card className={`border-2 ${testResult.ok ? "border-green-300" : "border-red-300"}`}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${testResult.ok ? "bg-green-100" : "bg-red-100"}`}>
                      <MessageSquare className={`w-5 h-5 ${testResult.ok ? "text-green-600" : "text-red-600"}`} />
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${testResult.ok ? "text-green-700" : "text-red-700"}`}>
                        {testResult.ok ? "متصل بـ WhatsApp Business API" : "غير متصل"}
                      </p>
                      {!testResult.ok && <p className="text-xs text-red-600 mt-0.5">{testResult.message}</p>}
                    </div>
                  </div>
                  {testResult.ok && testResult.phoneInfo && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">رقم الهاتف</p>
                          <p className="text-base font-bold font-mono text-foreground">{testResult.phoneInfo.displayNumber}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">الاسم المُحقَّق من Meta</p>
                          <p className="text-sm font-medium">{testResult.phoneInfo.verifiedName}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">جودة الرسائل</p>
                          <QualityBadge quality={testResult.phoneInfo.quality} />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">حالة الرقم</p>
                          <p className={`text-sm font-semibold ${testResult.phoneInfo.status === "CONNECTED" ? "text-green-600" : "text-amber-600"}`}>
                            {testResult.phoneInfo.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {testResult.ok && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "إجمالي الرسائل المرسلة", value: (logsQ.data?.filter(l => l.status === "sent").length ?? 0).toLocaleString("ar-SA"), icon: Send, color: "text-green-600" },
                    { label: "رسائل فاشلة", value: (logsQ.data?.filter(l => l.status === "failed").length ?? 0).toLocaleString("ar-SA"), icon: XCircle, color: "text-red-600" },
                    { label: "آخر إرسال", value: logsQ.data?.[0]?.sentAt ? fmtDate(logsQ.data[0].sentAt) : "—", icon: Clock, color: "text-[#406B93]" },
                  ].map(stat => (
                    <Card key={stat.label} className="border-border/50">
                      <CardContent className="p-4 text-center">
                        <stat.icon className={`w-5 h-5 mx-auto mb-1.5 ${stat.color}`} />
                        <p className="text-lg font-bold">{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ تبويب: قوالب الرسائل ══════════════════════════════════════ */}
      {activeTab === "قوالب الرسائل" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">القوالب المستخدمة عند إرسال المستندات عبر WhatsApp</p>
            <Button size="sm" className="gap-1.5 h-7 text-xs"
              onClick={() => saveTemplates.mutate(templates)} disabled={saveTemplates.isPending}>
              <Save className="w-3 h-3" /> {saveTemplates.isPending ? "جاري الحفظ…" : "حفظ الكل"}
            </Button>
          </div>

          {templates.map((tpl, idx) => (
            <Card key={tpl.key} className="border-border/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{tpl.label}</span>
                    {tpl.docType && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-[#25D366]/10 text-[#25D366] border-[#25D366]/30">
                        {tpl.docType}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={tpl.isActive} onCheckedChange={v => updTpl(idx, "isActive", v)} />
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                      onClick={() => setEditingTpl(editingTpl === idx ? null : idx)}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {editingTpl === idx ? (
                  <Textarea value={tpl.content} onChange={e => updTpl(idx, "content", e.target.value)}
                    className="text-xs resize-none h-24 font-mono" dir="rtl" />
                ) : (
                  <p className="text-[11px] text-muted-foreground whitespace-pre-line bg-muted/30 rounded p-2 leading-relaxed">
                    {tpl.content}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}

          <div className="text-[10px] text-muted-foreground bg-muted/30 rounded px-3 py-2 border border-border/40">
            المتغيرات: {"{{customerName}} {{docNumber}} {{docTypeName}} {{amount}} {{currency}} {{sellerName}}"}
          </div>
        </div>
      )}

      {/* ══ تبويب: سجل الإرسال ════════════════════════════════════════ */}
      {activeTab === "سجل الإرسال" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
              onClick={() => logsQ.refetch()} disabled={logsQ.isFetching}>
              <RefreshCw className={`w-3 h-3 ${logsQ.isFetching ? "animate-spin" : ""}`} /> تحديث
            </Button>
          </div>

          {logsQ.isLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">جاري التحميل…</div>
          ) : !logsQ.data?.length ? (
            <div className="text-center py-10 text-muted-foreground text-sm">لا يوجد سجلات إرسال بعد</div>
          ) : (
            <Card className="border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right text-xs">التاريخ والوقت</TableHead>
                    <TableHead className="text-right text-xs">رقم المستند</TableHead>
                    <TableHead className="text-right text-xs">العميل</TableHead>
                    <TableHead className="text-right text-xs">الجوال</TableHead>
                    <TableHead className="text-right text-xs">المستخدم</TableHead>
                    <TableHead className="text-right text-xs">الحالة</TableHead>
                    <TableHead className="text-right text-xs">رقم الرسالة (Meta)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsQ.data.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {log.sentAt ? fmtDateTime(log.sentAt) : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{log.docNumber ?? "—"}</TableCell>
                      <TableCell className="text-xs">{log.recipientName ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono" dir="ltr">{log.recipientContact ?? "—"}</TableCell>
                      <TableCell className="text-xs">{log.userName ?? "—"}</TableCell>
                      <TableCell className={`text-xs font-semibold ${STATUS_COLORS[log.status] ?? "text-muted-foreground"}`}>
                        {log.status === "sent" ? "✓ أُرسل" : log.status === "failed" ? "✕ فشل" : "⏳ معلّق"}
                        {log.errorMessage && <span className="block text-[10px] text-red-400 font-normal">{log.errorMessage}</span>}
                      </TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground" dir="ltr">
                        {(log as any).metaMessageId ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Messaging: Telegram Bot ───────────────────────────────────────────────────

function MessagingTelegramPage() {
  const settingsQ = trpc.documentSend.getSettings.useQuery();
  const updateMut = trpc.documentSend.updateSettings.useMutation({
    onSuccess: () => { toast.success("تم حفظ إعدادات Telegram ✓"); settingsQ.refetch(); },
    onError: e => toast.error(e.message),
  });
  const testMut = trpc.documentSend.testTelegramConnection.useMutation({
    onSuccess: r => r.ok ? toast.success("✅ البوت متصل: " + r.message) : toast.error("❌ " + r.message),
    onError: e => toast.error(e.message),
  });

  const s = settingsQ.data;
  const [form, setForm] = useState({ telegramEnabled: false, telegramBotToken: "" });
  const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (s) setForm({ telegramEnabled: s.telegramEnabled ?? false, telegramBotToken: s.telegramBotToken ?? "" });
  }, [s]);

  return (
    <div className="space-y-4 max-w-2xl" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Bot className="w-4 h-4 text-[#229ED9]" />Telegram Bot</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">تفعيل الإرسال</span>
          <Switch checked={form.telegramEnabled} onCheckedChange={v => upd("telegramEnabled", v)} />
        </div>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-xs text-muted-foreground font-semibold">إعدادات البوت</CardTitle></CardHeader>
        <CardContent className="px-5 pb-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Bot Token</Label>
            <Input value={form.telegramBotToken} onChange={e => upd("telegramBotToken", e.target.value)} className="h-8 text-sm mt-1 font-mono text-xs" dir="ltr" type="password" placeholder="123456789:AAFxxxx..." />
            <p className="text-[10px] text-muted-foreground mt-1">احصل على توكن من @BotFather على Telegram</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 justify-end">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => testMut.mutate()} disabled={testMut.isPending || !form.telegramEnabled}>
          <Eye className="w-3.5 h-3.5" /> {testMut.isPending ? "جاري الاختبار…" : "اختبار البوت"}
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => updateMut.mutate(form)} disabled={updateMut.isPending}>
          <Save className="w-3.5 h-3.5" /> {updateMut.isPending ? "جاري الحفظ…" : "حفظ الإعدادات"}
        </Button>
      </div>
    </div>
  );
}

// ─── Messaging: Email (Resend) ─────────────────────────────────────────────────

function MessagingEmailPage() {
  const settingsQ = trpc.documentSend.getSettings.useQuery();
  const updateMut = trpc.documentSend.updateSettings.useMutation({
    onSuccess: () => { toast.success("تم حفظ إعدادات البريد ✓"); settingsQ.refetch(); },
    onError: e => toast.error(e.message),
  });

  const s = settingsQ.data;
  const [form, setForm] = useState({ emailEnabled: false, emailApiKey: "", emailFromEmail: "", emailFromName: "OneSoft ERP" });
  const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (s) setForm({ emailEnabled: s.emailEnabled ?? false, emailApiKey: s.emailApiKey ?? "", emailFromEmail: s.emailFromEmail ?? "", emailFromName: s.emailFromName ?? "OneSoft ERP" });
  }, [s]);

  return (
    <div className="space-y-4 max-w-2xl" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Mail className="w-4 h-4 text-[#7c3aed]" />البريد الإلكتروني (Resend)</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">تفعيل الإرسال</span>
          <Switch checked={form.emailEnabled} onCheckedChange={v => upd("emailEnabled", v)} />
        </div>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-xs text-muted-foreground font-semibold">إعدادات Resend</CardTitle></CardHeader>
        <CardContent className="px-5 pb-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Resend API Key</Label>
            <Input value={form.emailApiKey} onChange={e => upd("emailApiKey", e.target.value)} className="h-8 text-sm mt-1 font-mono text-xs" dir="ltr" type="password" placeholder="re_xxxxxxxxxxxx" />
            <p className="text-[10px] text-muted-foreground mt-1">احصل على مفتاح API من <span className="text-[#7c3aed]">resend.com</span></p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">البريد المرسل (From)</Label>
              <Input value={form.emailFromEmail} onChange={e => upd("emailFromEmail", e.target.value)} className="h-8 text-sm mt-1 font-mono text-xs" dir="ltr" placeholder="noreply@company.com" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">اسم المرسل</Label>
              <Input value={form.emailFromName} onChange={e => upd("emailFromName", e.target.value)} className="h-8 text-sm mt-1" dir="rtl" placeholder="OneSoft ERP" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => updateMut.mutate(form)} disabled={updateMut.isPending}>
          <Save className="w-3.5 h-3.5" /> {updateMut.isPending ? "جاري الحفظ…" : "حفظ الإعدادات"}
        </Button>
      </div>
    </div>
  );
}

// ─── Messaging: قوالب الرسائل ──────────────────────────────────────────────────

const DEFAULT_MSG_TEMPLATES = [
  { key: "invoice_sent",    channel: "whatsapp", label: "إرسال فاتورة للعميل",      icon: "📄", text: "السلام عليكم {{CustomerName}}،\nمرفق فاتورتك رقم {{InvoiceNo}} بتاريخ {{Date}} بمبلغ {{Total}} {{Currency}}.\n\nشكراً لتعاملكم معنا 🙏" },
  { key: "payment_receipt", channel: "whatsapp", label: "إيصال استلام دفعة",         icon: "💰", text: "تم استلام دفعتكم بمبلغ {{Amount}} {{Currency}} بتاريخ {{Date}}.\nالرصيد المتبقي: {{Balance}} {{Currency}}" },
  { key: "overdue_notice",  channel: "whatsapp", label: "تذكير بفاتورة متأخرة",      icon: "⏰", text: "تذكير: لديكم فاتورة رقم {{InvoiceNo}} بمبلغ {{Total}} {{Currency}} متأخرة منذ {{DueDays}} يوم." },
  { key: "quotation_sent",  channel: "email",    label: "إرسال عرض سعر",             icon: "📋", text: "يسعدنا تقديم عرض السعر المرفق رقم {{QuotNo}} الصالح حتى {{ValidUntil}}." },
  { key: "purchase_order",  channel: "email",    label: "إرسال أمر شراء للمورد",     icon: "🛒", text: "برجاء الاطلاع على أمر الشراء رقم {{PONo}} المرفق والتأكيد في أقرب وقت." },
];

const CHANNEL_COLORS: Record<string, string> = { whatsapp: "#25D366", telegram: "#229ED9", email: "#7c3aed" };
const CHANNEL_LABELS: Record<string, string> = { whatsapp: "WhatsApp", telegram: "Telegram", email: "Email" };

function MessagingTemplatesPage() {
  const [templates, setTemplates] = useState(DEFAULT_MSG_TEMPLATES);
  const [editing, setEditing] = useState<string | null>(null);
  const updText = (key: string, text: string) =>
    setTemplates(p => p.map(t => t.key === key ? { ...t, text } : t));

  return (
    <div className="space-y-4 max-w-2xl" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-[#406B93]" />قوالب الرسائل</h3>
        <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
          <Plus className="w-3 h-3" /> قالب جديد
        </Button>
      </div>

      <div className="space-y-2">
        {templates.map(tmpl => (
          <Card key={tmpl.key} className="border-border/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{tmpl.icon}</span>
                  <span className="text-sm font-medium">{tmpl.label}</span>
                  <Badge className="text-[10px] px-1.5 py-0" style={{ backgroundColor: CHANNEL_COLORS[tmpl.channel] + "20", color: CHANNEL_COLORS[tmpl.channel], borderColor: CHANNEL_COLORS[tmpl.channel] + "40" }}>
                    {CHANNEL_LABELS[tmpl.channel]}
                  </Badge>
                </div>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditing(editing === tmpl.key ? null : tmpl.key)}>
                  <Edit2 className="w-3 h-3" />
                </Button>
              </div>
              {editing === tmpl.key ? (
                <Textarea value={tmpl.text} onChange={e => updText(tmpl.key, e.target.value)}
                  className="text-xs resize-none h-20 font-mono" dir="rtl" />
              ) : (
                <p className="text-[11px] text-muted-foreground whitespace-pre-line bg-muted/30 rounded p-2">{tmpl.text}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-[10px] text-muted-foreground bg-muted/30 rounded px-3 py-2 border border-border/40">
        المتغيرات المتاحة: {"{{CustomerName}} {{InvoiceNo}} {{Date}} {{Total}} {{Currency}} {{Balance}} {{DueDays}} {{QuotNo}} {{ValidUntil}} {{PONo}} {{Amount}}"}
      </div>

      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => toast.success("تم حفظ القوالب ✓")}>
          <Save className="w-3.5 h-3.5" /> حفظ القوالب
        </Button>
      </div>
    </div>
  );
}

// ─── Messaging: سجل الإرسال ────────────────────────────────────────────────────

function MessagingLogPage() {
  const logsQ = trpc.documentSend.getAllLogs.useQuery({ limit: 50 });
  const logs = logsQ.data ?? [];

  const STATUS_COLORS: Record<string, string> = {
    sent: "text-green-600",
    failed: "text-red-600",
    pending: "text-amber-600",
  };
  const CHANNEL_ICONS: Record<string, string> = {
    whatsapp: "📱",
    telegram: "🤖",
    email: "📧",
    pdf: "📄",
  };

  return (
    <div className="space-y-4 max-w-3xl" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Send className="w-4 h-4 text-[#406B93]" />سجل الإرسال</h3>
        <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => logsQ.refetch()} disabled={logsQ.isFetching}>
          <RefreshCw className={`w-3 h-3 ${logsQ.isFetching ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      {logsQ.isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">جاري التحميل…</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">لا يوجد سجلات إرسال بعد</div>
      ) : (
        <Card className="border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right text-xs">التاريخ</TableHead>
                <TableHead className="text-right text-xs">القناة</TableHead>
                <TableHead className="text-right text-xs">المستلم</TableHead>
                <TableHead className="text-right text-xs">المستند</TableHead>
                <TableHead className="text-right text-xs">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {log.sentAt ? fmtDateTime(log.sentAt) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {CHANNEL_ICONS[log.channel] ?? "📨"} {log.channel}
                  </TableCell>
                  <TableCell className="text-xs">{log.recipient ?? "—"}</TableCell>
                  <TableCell className="text-xs">{log.docRef ?? "—"}</TableCell>
                  <TableCell className={`text-xs font-medium ${STATUS_COLORS[log.status] ?? "text-muted-foreground"}`}>
                    {log.status === "sent" ? "✓ أُرسل" : log.status === "failed" ? "✕ فشل" : "⏳ معلّق"}
                    {log.errorMsg && <span className="block text-[10px] text-red-400">{log.errorMsg}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ─── Print Settings ────────────────────────────────────────────────────────────

const PRINT_KEY = "print_settings";
type PrintCfg = {
  paperSize: string; paperOrientation: string; copies: number;
  marginTop: number; marginBottom: number; marginLeft: number; marginRight: number;
  previewBeforePrint: boolean; autoPrintAfterSave: boolean;
  thermalEnabled: boolean; thermalWidth: number; thermalFont: number;
};
const PRINT_DEFAULT: PrintCfg = {
  paperSize: "A4", paperOrientation: "portrait", copies: 1,
  marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10,
  previewBeforePrint: true, autoPrintAfterSave: false,
  thermalEnabled: false, thermalWidth: 80, thermalFont: 12,
};

function PrintSettingsPage() {
  const utils = trpc.useUtils();
  const settingQ = trpc.appSettings.get.useQuery({ key: PRINT_KEY });
  const setMut = trpc.appSettings.set.useMutation({
    onSuccess: () => { toast.success("تم حفظ إعدادات الطباعة"); utils.appSettings.get.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const cfg: PrintCfg = { ...PRINT_DEFAULT, ...(settingQ.data ?? {}) };
  const [form, setForm] = useState<PrintCfg>(cfg);

  useEffect(() => {
    if (settingQ.data) setForm({ ...PRINT_DEFAULT, ...settingQ.data });
  }, [settingQ.data]);

  const up = (k: keyof PrintCfg, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  function save() { setMut.mutate({ key: PRINT_KEY, value: form }); }

  return (
    <div className="space-y-5 max-w-2xl" dir="rtl">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <span className="text-lg">🖨️</span> إعدادات الطباعة
      </h3>

      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">إعدادات الورق</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">حجم الورق</Label>
            <Select value={form.paperSize} onValueChange={v => up("paperSize", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="A5">A5</SelectItem>
                <SelectItem value="Letter">Letter</SelectItem>
                <SelectItem value="Legal">Legal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">اتجاه الورق</Label>
            <Select value={form.paperOrientation} onValueChange={v => up("paperOrientation", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">عمودي (Portrait)</SelectItem>
                <SelectItem value="landscape">أفقي (Landscape)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">عدد النسخ الافتراضي</Label>
            <Input type="number" value={form.copies} min={1} max={10}
              onChange={e => up("copies", Number(e.target.value))} className="h-8 text-xs" dir="ltr" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">الهوامش (مم)</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 grid grid-cols-2 gap-4">
          {(["marginTop","marginBottom","marginLeft","marginRight"] as const).map(k => (
            <div key={k} className="space-y-1">
              <Label className="text-xs">
                {k === "marginTop" ? "أعلى" : k === "marginBottom" ? "أسفل" : k === "marginLeft" ? "يسار" : "يمين"}
              </Label>
              <Input type="number" value={(form as any)[k]} min={0} max={50}
                onChange={e => up(k, Number(e.target.value))} className="h-8 text-xs" dir="ltr" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">خيارات الطباعة</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <Switch checked={form.previewBeforePrint} onCheckedChange={v => up("previewBeforePrint", v)} />
            <Label className="text-xs">معاينة قبل الطباعة</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.autoPrintAfterSave} onCheckedChange={v => up("autoPrintAfterSave", v)} />
            <Label className="text-xs">الطباعة التلقائية بعد الحفظ</Label>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">إعدادات الطباعة الحرارية</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <Switch checked={form.thermalEnabled} onCheckedChange={v => up("thermalEnabled", v)} />
            <Label className="text-xs">تفعيل الطباعة الحرارية</Label>
          </div>
          {form.thermalEnabled && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <Label className="text-xs">عرض الورق (مم)</Label>
                <Select value={String(form.thermalWidth)} onValueChange={v => up("thermalWidth", Number(v))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58">58 مم</SelectItem>
                    <SelectItem value="80">80 مم</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">حجم الخط</Label>
                <Input type="number" value={form.thermalFont} min={8} max={16}
                  onChange={e => up("thermalFont", Number(e.target.value))} className="h-8 text-xs" dir="ltr" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={setMut.isPending} className="h-8 text-xs gap-1.5">
          <Save className="w-3.5 h-3.5" />{setMut.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </div>
    </div>
  );
}

// ─── Logo & Stamp Settings ──────────────────────────────────────────────────────

const LOGO_KEY = "logo_stamp_settings";

type LogoItem = { label: string; key: string; description: string };
const LOGO_ITEMS: LogoItem[] = [
  { key: "companyLogo",    label: "شعار الشركة الرئيسي", description: "يظهر في رأس جميع المستندات" },
  { key: "branchLogo",     label: "شعار الفرع",           description: "يُستخدم بدلاً من شعار الشركة للفروع" },
  { key: "officialStamp",  label: "الختم الرسمي",         description: "الختم الرسمي للشركة" },
  { key: "paidStamp",      label: "ختم مدفوع",            description: "يظهر على الفواتير المدفوعة" },
  { key: "approvedStamp",  label: "ختم معتمد",            description: "يظهر على المستندات المعتمدة" },
  { key: "background",     label: "خلفية المستند",        description: "صورة خلفية شفافة للمستندات" },
];

function LogoStampPage() {
  const utils = trpc.useUtils();
  const settingQ = trpc.appSettings.get.useQuery({ key: LOGO_KEY });
  const setMut = trpc.appSettings.set.useMutation({
    onSuccess: () => { toast.success("تم حفظ إعدادات الشعار والختم"); utils.appSettings.get.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const [images, setImages] = useState<Record<string, string>>({});
  useEffect(() => { if (settingQ.data) setImages(settingQ.data); }, [settingQ.data]);

  function handleFile(key: string, file: File) {
    if (file.size > 2 * 1024 * 1024) { toast.error("الحجم الأقصى 2 ميغابايت"); return; }
    const reader = new FileReader();
    reader.onload = e => setImages(prev => ({ ...prev, [key]: e.target?.result as string }));
    reader.readAsDataURL(file);
  }

  function removeImage(key: string) { setImages(prev => { const n = { ...prev }; delete n[key]; return n; }); }

  function save() { setMut.mutate({ key: LOGO_KEY, value: images }); }

  return (
    <div className="space-y-4 max-w-2xl" dir="rtl">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <span className="text-lg">🖼️</span> إعدادات الشعار والختم
      </h3>
      <p className="text-xs text-muted-foreground">يمكن رفع صور بصيغة PNG أو JPG أو SVG — الحجم الأقصى 2 ميغابايت لكل صورة</p>

      <div className="grid grid-cols-1 gap-3">
        {LOGO_ITEMS.map(item => (
          <Card key={item.key} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-24 h-20 border rounded-md border-dashed border-border flex items-center justify-center bg-muted/30 flex-shrink-0 overflow-hidden">
                {images[item.key]
                  ? <img src={images[item.key]} alt={item.label} className="max-w-full max-h-full object-contain" />
                  : <span className="text-2xl opacity-30">🖼️</span>}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(item.key, f); e.target.value = ""; }} />
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded-md hover:bg-accent cursor-pointer">
                      <Plus className="w-3 h-3" />{images[item.key] ? "تغيير" : "رفع صورة"}
                    </span>
                  </label>
                  {images[item.key] && (
                    <button onClick={() => removeImage(item.key)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10">
                      <Trash2 className="w-3 h-3" />حذف
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={setMut.isPending} className="h-8 text-xs gap-1.5">
          <Save className="w-3.5 h-3.5" />{setMut.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </div>
    </div>
  );
}

// ─── Signature Settings ─────────────────────────────────────────────────────────

const SIG_KEY = "signature_settings";

type SigItem = { key: string; label: string; role: string };
const SIG_ITEMS: SigItem[] = [
  { key: "director",    label: "توقيع المدير",            role: "مدير عام / CEO" },
  { key: "accountant",  label: "توقيع المحاسب",           role: "محاسب / Accountant" },
  { key: "warehouse",   label: "توقيع أمين المستودع",     role: "أمين مستودع / Warehouse Keeper" },
  { key: "sales",       label: "توقيع مسؤول المبيعات",   role: "مسؤول مبيعات / Sales Manager" },
];

type SigData = {
  image?: string;
  name?: string;
  jobTitle?: string;
  showOnSales?: boolean;
  showOnPurchase?: boolean;
  showOnVouchers?: boolean;
};

function SignatureSettingsPage() {
  const utils = trpc.useUtils();
  const settingQ = trpc.appSettings.get.useQuery({ key: SIG_KEY });
  const setMut = trpc.appSettings.set.useMutation({
    onSuccess: () => { toast.success("تم حفظ إعدادات التوقيعات"); utils.appSettings.get.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const [sigs, setSigs] = useState<Record<string, SigData>>({});
  useEffect(() => { if (settingQ.data) setSigs(settingQ.data); }, [settingQ.data]);

  function updateSig(key: string, field: keyof SigData, val: unknown) {
    setSigs(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));
  }

  function handleFile(key: string, file: File) {
    if (file.size > 1 * 1024 * 1024) { toast.error("الحجم الأقصى 1 ميغابايت"); return; }
    const reader = new FileReader();
    reader.onload = e => updateSig(key, "image", e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function save() { setMut.mutate({ key: SIG_KEY, value: sigs }); }

  return (
    <div className="space-y-4 max-w-2xl" dir="rtl">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <span className="text-lg">✍️</span> إعدادات التوقيع الإلكتروني
      </h3>
      <p className="text-xs text-muted-foreground">أضف توقيعات الموظفين لظهورها في المستندات المطبوعة — صور PNG شفافة مستحسنة</p>

      <div className="space-y-3">
        {SIG_ITEMS.map(item => {
          const sig = sigs[item.key] ?? {};
          return (
            <Card key={item.key} className="border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{item.label}</span>
                  <span className="text-xs text-muted-foreground font-normal">{item.role}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-full h-20 border rounded-md border-dashed border-border flex items-center justify-center bg-muted/20 overflow-hidden">
                    {sig.image
                      ? <img src={sig.image} alt={item.label} className="max-h-full max-w-full object-contain" />
                      : <span className="text-xs text-muted-foreground">لا يوجد توقيع</span>}
                  </div>
                  <div className="flex gap-2">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(item.key, f); e.target.value = ""; }} />
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded-md hover:bg-accent cursor-pointer">
                        <Plus className="w-3 h-3" />رفع توقيع
                      </span>
                    </label>
                    {sig.image && (
                      <button onClick={() => updateSig(item.key, "image", undefined)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10">
                        <Trash2 className="w-3 h-3" />حذف
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">الاسم</Label>
                    <Input value={sig.name ?? ""} onChange={e => updateSig(item.key, "name", e.target.value)}
                      placeholder="اسم صاحب التوقيع" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">المسمى الوظيفي</Label>
                    <Input value={sig.jobTitle ?? ""} onChange={e => updateSig(item.key, "jobTitle", e.target.value)}
                      placeholder="المسمى الوظيفي" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-2 pt-1">
                    <Label className="text-xs text-muted-foreground">إظهار في:</Label>
                    <div className="flex flex-col gap-1.5">
                      {([["showOnSales","فواتير المبيعات"],["showOnPurchase","فواتير المشتريات"],["showOnVouchers","السندات"]] as const).map(([field, label]) => (
                        <div key={field} className="flex items-center gap-2">
                          <Switch checked={!!(sig as any)[field]} onCheckedChange={v => updateSig(item.key, field as keyof SigData, v)} />
                          <Label className="text-xs">{label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={setMut.isPending} className="h-8 text-xs gap-1.5">
          <Save className="w-3.5 h-3.5" />{setMut.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </div>
    </div>
  );
}

// ─── Email & PDF Settings ───────────────────────────────────────────────────────

const EMAIL_PDF_KEY = "email_pdf_settings";

type EmailPdfCfg = {
  smtpHost: string; smtpPort: number; smtpSecure: boolean;
  smtpUser: string; smtpPass: string;
  fromEmail: string; fromName: string;
  autoGeneratePdf: boolean;
  emailSubject: string; emailBody: string;
  sendInvoiceAsPdf: boolean;
  sendQuoteAsPdf: boolean;
  sendStatementAsPdf: boolean;
};
const EMAIL_PDF_DEFAULT: EmailPdfCfg = {
  smtpHost: "", smtpPort: 587, smtpSecure: false,
  smtpUser: "", smtpPass: "",
  fromEmail: "", fromName: "",
  autoGeneratePdf: true,
  emailSubject: "مستند رقم {{docNumber}} من {{companyName}}",
  emailBody: "السلام عليكم،\n\nيسعدنا إرسال {{docTypeName}} رقم {{docNumber}} المرفق.\n\nشكراً لتعاملكم معنا.\n\n{{companyName}}",
  sendInvoiceAsPdf: true, sendQuoteAsPdf: true, sendStatementAsPdf: true,
};

function EmailPdfSettingsPage() {
  const utils = trpc.useUtils();
  const settingQ = trpc.appSettings.get.useQuery({ key: EMAIL_PDF_KEY });
  const setMut = trpc.appSettings.set.useMutation({
    onSuccess: () => { toast.success("تم حفظ إعدادات البريد الإلكتروني"); utils.appSettings.get.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<EmailPdfCfg>(EMAIL_PDF_DEFAULT);
  useEffect(() => { if (settingQ.data) setForm({ ...EMAIL_PDF_DEFAULT, ...settingQ.data }); }, [settingQ.data]);
  const up = (k: keyof EmailPdfCfg, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  function save() { setMut.mutate({ key: EMAIL_PDF_KEY, value: form }); }

  return (
    <div className="space-y-5 max-w-2xl" dir="rtl">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <span className="text-lg">📧</span> إعدادات البريد الإلكتروني وPDF
      </h3>

      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">إعداد SMTP</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">خادم SMTP (Host)</Label>
            <Input value={form.smtpHost} onChange={e => up("smtpHost", e.target.value)}
              placeholder="smtp.gmail.com" className="h-8 text-xs" dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">المنفذ (Port)</Label>
            <Input type="number" value={form.smtpPort} onChange={e => up("smtpPort", Number(e.target.value))}
              className="h-8 text-xs" dir="ltr" />
          </div>
          <div className="flex items-end pb-1">
            <div className="flex items-center gap-2">
              <Switch checked={form.smtpSecure} onCheckedChange={v => up("smtpSecure", v)} />
              <Label className="text-xs">SSL/TLS آمن</Label>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">اسم المستخدم</Label>
            <Input value={form.smtpUser} onChange={e => up("smtpUser", e.target.value)}
              placeholder="user@example.com" className="h-8 text-xs" dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">كلمة المرور / App Password</Label>
            <Input type="password" value={form.smtpPass} onChange={e => up("smtpPass", e.target.value)}
              className="h-8 text-xs" dir="ltr" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">معلومات المرسل</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">البريد المرسل منه</Label>
            <Input value={form.fromEmail} onChange={e => up("fromEmail", e.target.value)}
              placeholder="noreply@company.com" className="h-8 text-xs" dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">اسم المرسل</Label>
            <Input value={form.fromName} onChange={e => up("fromName", e.target.value)}
              placeholder="اسم الشركة" className="h-8 text-xs" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">قالب البريد الإلكتروني</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">موضوع الرسالة</Label>
            <Input value={form.emailSubject} onChange={e => up("emailSubject", e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">نص الرسالة</Label>
            <Textarea value={form.emailBody} onChange={e => up("emailBody", e.target.value)}
              rows={5} className="text-xs resize-none" />
          </div>
          <p className="text-xs text-muted-foreground">
            المتغيرات المتاحة: {"{{"+"docNumber"+"}}"} {"{{"+"docTypeName"+"}}"} {"{{"+"companyName"+"}}"} {"{{"+"customerName"+"}}"} {"{{"+"amount"+"}}"}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">إعدادات PDF</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <Switch checked={form.autoGeneratePdf} onCheckedChange={v => up("autoGeneratePdf", v)} />
            <Label className="text-xs">إنشاء PDF تلقائياً عند الحفظ</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.sendInvoiceAsPdf} onCheckedChange={v => up("sendInvoiceAsPdf", v)} />
            <Label className="text-xs">إرسال الفواتير بصيغة PDF</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.sendQuoteAsPdf} onCheckedChange={v => up("sendQuoteAsPdf", v)} />
            <Label className="text-xs">إرسال عروض الأسعار بصيغة PDF</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.sendStatementAsPdf} onCheckedChange={v => up("sendStatementAsPdf", v)} />
            <Label className="text-xs">إرسال كشوف الحسابات بصيغة PDF</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={setMut.isPending} className="h-8 text-xs gap-1.5">
          <Save className="w-3.5 h-3.5" />{setMut.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </div>
    </div>
  );
}

// ─── Field Dictionary ──────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: "Text",      labelAr: "نص",              labelEn: "Text" },
  { value: "LongText",  labelAr: "نص طويل",          labelEn: "Long Text" },
  { value: "Number",    labelAr: "رقم",              labelEn: "Number" },
  { value: "Amount",    labelAr: "مبلغ",             labelEn: "Amount" },
  { value: "Percentage",labelAr: "نسبة",             labelEn: "Percentage" },
  { value: "Date",      labelAr: "تاريخ",            labelEn: "Date" },
  { value: "Time",      labelAr: "وقت",              labelEn: "Time" },
  { value: "DateTime",  labelAr: "تاريخ ووقت",       labelEn: "DateTime" },
  { value: "Boolean",   labelAr: "نعم / لا",         labelEn: "Boolean" },
  { value: "Customer",  labelAr: "عميل",             labelEn: "Customer" },
  { value: "Vendor",    labelAr: "مورد",             labelEn: "Vendor" },
  { value: "Employee",  labelAr: "موظف",             labelEn: "Employee" },
  { value: "User",      labelAr: "مستخدم",           labelEn: "User" },
  { value: "Item",      labelAr: "صنف",              labelEn: "Item" },
  { value: "Warehouse", labelAr: "مستودع",           labelEn: "Warehouse" },
  { value: "Branch",    labelAr: "فرع",              labelEn: "Branch" },
  { value: "Account",   labelAr: "حساب محاسبي",      labelEn: "Account" },
  { value: "Currency",  labelAr: "عملة",             labelEn: "Currency" },
  { value: "Unit",      labelAr: "وحدة قياس",        labelEn: "Unit" },
  { value: "Image",     labelAr: "صورة",             labelEn: "Image" },
  { value: "File",      labelAr: "ملف",              labelEn: "File" },
  { value: "URL",       labelAr: "رابط",             labelEn: "URL" },
  { value: "Email",     labelAr: "بريد إلكتروني",    labelEn: "Email" },
  { value: "Phone",     labelAr: "رقم هاتف",         labelEn: "Phone" },
];

const FIELD_CATEGORIES = [
  "Document Fields", "Customer Fields", "Vendor Fields", "Item Fields",
  "Inventory Fields", "Accounting Fields", "Sales Fields", "Purchase Fields",
  "Financial Fields", "Employee Fields", "Branch Fields", "Company Fields",
  "System Fields", "Custom Fields",
];

const CATEGORY_AR: Record<string, string> = {
  "Document Fields":  "بيانات المستند",
  "Customer Fields":  "بيانات العميل",
  "Vendor Fields":    "بيانات المورد",
  "Item Fields":      "بيانات الأصناف",
  "Inventory Fields": "بيانات المخزون",
  "Accounting Fields":"بيانات محاسبية",
  "Sales Fields":     "بيانات المبيعات",
  "Purchase Fields":  "بيانات المشتريات",
  "Financial Fields": "بيانات مالية",
  "Employee Fields":  "بيانات الموظفين",
  "Branch Fields":    "بيانات الفروع",
  "Company Fields":   "بيانات الشركة",
  "System Fields":    "بيانات النظام",
  "Custom Fields":    "حقول مخصصة",
};

type FDRow = { id: number; orgId: number; code: string; nameAr: string; nameEn: string; fieldType: string; category: string; description?: string | null; isSystem: boolean; isActive: boolean; sortOrder: number; createdAt: string; };
const EMPTY_FD = { code: "", nameAr: "", nameEn: "", fieldType: "Text", category: "Custom Fields", description: "", isActive: true, sortOrder: 0 };

function FieldDictionaryDialog({
  open, onClose, initial, isEdit,
}: { open: boolean; onClose: () => void; initial: Partial<FDRow> & typeof EMPTY_FD; isEdit: boolean; }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ ...initial });
  useEffect(() => { setForm({ ...initial }); }, [open]);
  const f = (k: keyof typeof EMPTY_FD, v: any) => setForm(p => ({ ...p, [k]: v }));

  const createMut = trpc.fieldDictionary.create.useMutation({
    onSuccess: () => { toast.success("تم إضافة الحقل"); utils.fieldDictionary.list.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.fieldDictionary.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث الحقل"); utils.fieldDictionary.list.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  function save() {
    if (!form.code.trim()) return toast.error("كود الحقل مطلوب");
    if (!form.nameAr.trim()) return toast.error("الاسم العربي مطلوب");
    if (!form.nameEn.trim()) return toast.error("الاسم الإنجليزي مطلوب");
    const payload = { code: form.code.trim().toUpperCase(), nameAr: form.nameAr.trim(), nameEn: form.nameEn.trim(), fieldType: form.fieldType, category: form.category, description: form.description || null, isActive: form.isActive, sortOrder: Number(form.sortOrder) || 0 };
    if (isEdit && (initial as any).id) updateMut.mutate({ id: (initial as any).id, ...payload });
    else createMut.mutate(payload);
  }

  const isPending = createMut.isPending || updateMut.isPending;
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-sm">{isEdit ? "تعديل حقل" : "إضافة حقل جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">كود الحقل <span className="text-destructive">*</span></Label>
              <Input value={form.code} onChange={e => f("code", e.target.value.toUpperCase())} className="h-8 text-xs font-mono" placeholder="مثال: NETSALES" disabled={isEdit && !!(initial as any).isSystem} />
              <p className="text-[10px] text-muted-foreground">أحرف إنجليزية كبيرة وأرقام وشرطة سفلية</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">نوع الحقل <span className="text-destructive">*</span></Label>
              <select
                value={form.fieldType}
                onChange={e => f("fieldType", e.target.value)}
                className="w-full h-8 text-xs px-2 border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                dir="rtl"
              >
                {FIELD_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.labelAr} — {t.labelEn}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">الاسم العربي <span className="text-destructive">*</span></Label>
              <Input value={form.nameAr} onChange={e => f("nameAr", e.target.value)} className="h-8 text-xs" placeholder="مثال: صافي المبيعات" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">English Name <span className="text-destructive">*</span></Label>
              <Input value={form.nameEn} onChange={e => f("nameEn", e.target.value)} className="h-8 text-xs" placeholder="e.g. Net Sales" dir="ltr" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">فئة الحقل / Category</Label>
            <select
              value={form.category}
              onChange={e => f("category", e.target.value)}
              className="w-full h-8 text-xs px-2 border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              dir="rtl"
            >
              {FIELD_CATEGORIES.map(c => (
                <option key={c} value={c}>{CATEGORY_AR[c] ?? c} — {c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">وصف الحقل (اختياري)</Label>
            <Textarea value={form.description ?? ""} onChange={e => f("description", e.target.value)} className="text-xs resize-none h-16" placeholder="وصف مختصر لاستخدام الحقل..." />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.isActive} onCheckedChange={v => f("isActive", v)} id="fd-active" />
            <Label htmlFor="fd-active" className="text-xs">نشط</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>إلغاء</Button>
          <Button size="sm" onClick={save} disabled={isPending}>
            {isPending ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة الحقل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldDictionaryPage() {
  const utils = trpc.useUtils();
  const listQ = trpc.fieldDictionary.list.useQuery();
  const seedMut = trpc.fieldDictionary.seedDefaults.useMutation({
    onSuccess: (r) => { if (r.seeded) utils.fieldDictionary.list.invalidate(); },
  });
  const deleteMut = trpc.fieldDictionary.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف الحقل"); utils.fieldDictionary.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const seededRef = useRef(false);
  useEffect(() => {
    if (!seededRef.current && listQ.data && listQ.data.length === 0) {
      seededRef.current = true;
      seedMut.mutate();
    }
  }, [listQ.data]);

  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<(typeof EMPTY_FD & { id?: number; isSystem?: boolean }) | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("__all__");
  const [typeFilter, setTypeFilter] = useState("__all__");

  function openAdd() { setEditing({ ...EMPTY_FD }); setDlgOpen(true); }
  function openEdit(r: FDRow) {
    setEditing({ id: r.id, isSystem: r.isSystem, code: r.code, nameAr: r.nameAr, nameEn: r.nameEn, fieldType: r.fieldType, category: r.category, description: r.description ?? "", isActive: r.isActive, sortOrder: r.sortOrder });
    setDlgOpen(true);
  }

  const rows = (listQ.data ?? []) as FDRow[];
  const sq = search.toLowerCase();
  const filtered = rows.filter(r =>
    (!sq || r.code.toLowerCase().includes(sq) || r.nameAr.includes(sq) || r.nameEn.toLowerCase().includes(sq)) &&
    (catFilter === "__all__" || r.category === catFilter) &&
    (typeFilter === "__all__" || r.fieldType === typeFilter)
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-sm">قاموس الحقول / Field Dictionary</h3>
          <p className="text-xs text-muted-foreground mt-0.5">تعريف مركزي للحقول يُستخدم في الروابط المحاسبية، القوالب، التقارير، والرسائل</p>
        </div>
        <Button className="h-8 text-xs gap-1.5" onClick={openAdd}>
          <Plus className="w-3.5 h-3.5" />إضافة حقل
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالكود أو الاسم..." className="h-8 text-xs w-56" />
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="h-8 text-xs w-48"><SelectValue placeholder="كل الفئات" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__" className="text-xs">كل الفئات</SelectItem>
            {FIELD_CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs">{CATEGORY_AR[c] ?? c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="كل الأنواع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__" className="text-xs">كل الأنواع</SelectItem>
            {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.labelAr}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground self-center">{filtered.length} حقل</span>
      </div>

      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-10 text-center">#</TableHead>
              <TableHead className="text-xs font-mono">كود الحقل<br/><span className="font-normal text-[10px] text-muted-foreground">Field Code</span></TableHead>
              <TableHead className="text-xs">الاسم العربي</TableHead>
              <TableHead className="text-xs" dir="ltr">English Name</TableHead>
              <TableHead className="text-xs">نوع الحقل<br/><span className="font-normal text-[10px] text-muted-foreground">Type</span></TableHead>
              <TableHead className="text-xs">الفئة<br/><span className="font-normal text-[10px] text-muted-foreground">Category</span></TableHead>
              <TableHead className="text-xs text-center w-16">نظامي</TableHead>
              <TableHead className="text-xs text-center w-16">الحالة</TableHead>
              <TableHead className="text-xs w-20">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading && (
              <TableRow><TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-8">جاري التحميل...</TableCell></TableRow>
            )}
            {!listQ.isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-8">لا توجد حقول مطابقة</TableCell></TableRow>
            )}
            {filtered.map((r, i) => {
              const typeInfo = FIELD_TYPES.find(t => t.value === r.fieldType);
              return (
                <TableRow key={r.id} className={!r.isActive ? "opacity-50" : undefined}>
                  <TableCell className="text-xs text-center text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="text-xs font-mono font-bold text-primary">{r.code}</TableCell>
                  <TableCell className="text-xs">{r.nameAr}</TableCell>
                  <TableCell className="text-xs" dir="ltr">{r.nameEn}</TableCell>
                  <TableCell className="text-xs">
                    <span className="inline-flex items-center gap-1">
                      {typeInfo?.labelAr ?? r.fieldType}
                      <span className="text-[10px] text-muted-foreground">({typeInfo?.labelEn ?? r.fieldType})</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span>{CATEGORY_AR[r.category] ?? r.category}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {r.isSystem
                      ? <Badge className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">نظامي</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.isActive
                      ? <Badge variant="secondary" className="text-[10px] bg-green-50 text-green-700 border-green-200">نشط</Badge>
                      : <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-700 border-red-200">موقوف</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <button className="text-primary text-xs hover:underline" onClick={() => openEdit(r)}>تعديل</button>
                      {!r.isSystem && (
                        <button className="text-destructive text-xs hover:underline"
                          onClick={() => { if (confirm(`حذف الحقل "${r.code}"؟`)) deleteMut.mutate({ id: r.id }); }}>
                          حذف
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {editing && (
        <FieldDictionaryDialog
          open={dlgOpen}
          onClose={() => setDlgOpen(false)}
          initial={editing as any}
          isEdit={!!( editing as any).id}
        />
      )}
    </div>
  );
}

// ─── Payment Methods ───────────────────────────────────────────────────────────

const ICON_OPTIONS = [
  { value: "cash",   labelAr: "نقدي (Cash)" },
  { value: "card",   labelAr: "بطاقة (Card)" },
  { value: "bank",   labelAr: "تحويل بنكي (Bank)" },
  { value: "tamara", labelAr: "تمارا (Tamara)" },
  { value: "tabby",  labelAr: "تابي (Tabby)" },
  { value: "wallet", labelAr: "محفظة (Wallet)" },
  { value: "qr",     labelAr: "كيو آر (QR)" },
  { value: "other",  labelAr: "أخرى (Other)" },
];

function PaymentMethodIcon({ icon, color }: { icon?: string | null; color?: string | null }) {
  const c = color ?? "#64748B";
  if (icon === "cash") return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
      <rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>
      <path d="M6 12h.01M18 12h.01"/>
    </svg>
  );
  if (icon === "card") return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
      <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>
    </svg>
  );
  if (icon === "bank") return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
      <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 10v11M12 10v11M16 10v11"/>
    </svg>
  );
  if (icon === "wallet") return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>
      <circle cx="16" cy="12" r="1.5"/>
    </svg>
  );
  if (icon === "qr") return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><path d="M14 14h1v1h-1zM16 14h1v1h-1zM18 14h1v1h-1zM14 16h1v1h-1zM16 16h1v1h-1zM18 16h1v1h-1zM14 18h1v1h-1zM16 18h1v1h-1zM18 18h1v1h-1z"/>
    </svg>
  );
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
      <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
    </svg>
  );
}

type PMRow = {
  id: number; code: string; nameAr: string; nameEn?: string | null;
  icon?: string | null; color?: string | null; bgColor?: string | null;
  accountId?: number | null; isActive: boolean; isVisible: boolean;
  isBuiltIn: boolean; sortOrder: number;
};

const EMPTY_PM: Omit<PMRow, "id" | "isBuiltIn"> = {
  code: "", nameAr: "", nameEn: "", icon: "other", color: "#406B93", bgColor: "#EFF6FF",
  accountId: null, isActive: true, isVisible: true, sortOrder: 0,
};

function PaymentMethodDialog({
  open, onClose, initial, isEdit,
}: {
  open: boolean; onClose: () => void;
  initial: Partial<PMRow> & { id?: number };
  isEdit: boolean;
}) {
  const [form, setForm] = useState<typeof EMPTY_PM & { id?: number }>({ ...EMPTY_PM, ...initial });
  const utils = trpc.useUtils();

  useEffect(() => { setForm({ ...EMPTY_PM, ...initial }); }, [open]);

  const upd = (k: keyof typeof form, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const createMut = trpc.paymentMethods.create.useMutation({
    onSuccess: () => { toast.success("تمت الإضافة"); utils.paymentMethods.list.invalidate(); utils.paymentMethods.listActive.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.paymentMethods.update.useMutation({
    onSuccess: () => { toast.success("تم التحديث"); utils.paymentMethods.list.invalidate(); utils.paymentMethods.listActive.invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  function handleSave() {
    if (!form.nameAr.trim()) return toast.error("الاسم العربي مطلوب");
    if (!isEdit && !form.code.trim()) return toast.error("الكود مطلوب");
    if (isEdit && form.id) {
      updateMut.mutate({ id: form.id, nameAr: form.nameAr, nameEn: form.nameEn ?? undefined,
        icon: form.icon ?? undefined, color: form.color ?? undefined, bgColor: form.bgColor ?? undefined,
        accountId: form.accountId ?? undefined, isActive: form.isActive, isVisible: form.isVisible, sortOrder: form.sortOrder });
    } else {
      createMut.mutate({ code: form.code, nameAr: form.nameAr, nameEn: form.nameEn ?? undefined,
        icon: form.icon ?? undefined, color: form.color ?? undefined, bgColor: form.bgColor ?? undefined,
        accountId: form.accountId ?? undefined, isActive: form.isActive, isVisible: form.isVisible, sortOrder: form.sortOrder });
    }
  }

  if (!open) return null;
  const busy = createMut.isPending || updateMut.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
      <div className="bg-background border rounded-xl shadow-xl w-[500px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-sm font-semibold">{isEdit ? "تعديل وسيلة دفع" : "إضافة وسيلة دفع جديدة"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {!isEdit && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">كود الوسيلة (Code) *</label>
              <Input value={form.code} onChange={e => upd("code", e.target.value.toUpperCase())}
                placeholder="مثال: TRANSFER" className="h-8 text-xs font-mono mt-1" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">الاسم العربي *</label>
              <Input value={form.nameAr} onChange={e => upd("nameAr", e.target.value)} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">الاسم الإنجليزي</label>
              <Input value={form.nameEn ?? ""} onChange={e => upd("nameEn", e.target.value)} className="h-8 text-xs mt-1" dir="ltr" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">الأيقونة</label>
            <select value={form.icon ?? "other"} onChange={e => upd("icon", e.target.value)}
              className="mt-1 w-full h-8 text-xs border rounded-md px-2 bg-background">
              {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.labelAr}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">لون الأيقونة / الحدود</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={form.color ?? "#406B93"} onChange={e => upd("color", e.target.value)}
                  className="h-8 w-10 rounded border cursor-pointer" />
                <Input value={form.color ?? "#406B93"} onChange={e => upd("color", e.target.value)}
                  className="h-8 text-xs font-mono flex-1" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">لون الخلفية (BgColor)</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={form.bgColor ?? "#EFF6FF"} onChange={e => upd("bgColor", e.target.value)}
                  className="h-8 w-10 rounded border cursor-pointer" />
                <Input value={form.bgColor ?? "#EFF6FF"} onChange={e => upd("bgColor", e.target.value)}
                  className="h-8 text-xs font-mono flex-1" dir="ltr" />
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">معاينة</label>
            <div className="mt-1 flex items-center gap-2 p-3 rounded-lg border"
              style={{ backgroundColor: form.bgColor ?? "#EFF6FF", borderColor: form.color ?? "#406B93" }}>
              <PaymentMethodIcon icon={form.icon} color={form.color} />
              <span className="text-sm font-medium" style={{ color: form.color ?? "#406B93" }}>{form.nameAr || "اسم الوسيلة"}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">الترتيب</label>
            <Input type="number" value={form.sortOrder} onChange={e => upd("sortOrder", Number(e.target.value))}
              className="h-8 text-xs mt-1 w-24" dir="ltr" />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input type="checkbox" checked={form.isActive} onChange={e => upd("isActive", e.target.checked)} className="rounded" />
              نشطة (Active)
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input type="checkbox" checked={form.isVisible} onChange={e => upd("isVisible", e.target.checked)} className="rounded" />
              مرئية في نافذة الدفع
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-4">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose} disabled={busy}>إلغاء</Button>
          <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={busy}>
            {busy ? "جاري الحفظ..." : isEdit ? "تحديث" : "إضافة"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PaymentMethodsPage() {
  const utils = trpc.useUtils();
  const listQ = trpc.paymentMethods.list.useQuery();
  const seedMut = trpc.paymentMethods.seedDefaults.useMutation({
    onSuccess: (r) => { if (r.seeded) utils.paymentMethods.list.invalidate(); },
  });
  const updateMut = trpc.paymentMethods.update.useMutation({
    onSuccess: () => { utils.paymentMethods.list.invalidate(); utils.paymentMethods.listActive.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.paymentMethods.delete.useMutation({
    onSuccess: () => { toast.success("تم الحذف"); utils.paymentMethods.list.invalidate(); utils.paymentMethods.listActive.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const reorderMut = trpc.paymentMethods.reorder.useMutation({
    onSuccess: () => utils.paymentMethods.list.invalidate(),
  });

  const seededRef = useRef(false);
  useEffect(() => {
    if (!seededRef.current && listQ.data && listQ.data.length === 0) {
      seededRef.current = true;
      seedMut.mutate();
    }
  }, [listQ.data]);

  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<PMRow> & { id?: number }>({});

  const rows = (listQ.data ?? []) as PMRow[];
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);

  function openAdd() { setEditing({ ...EMPTY_PM }); setDlgOpen(true); }
  function openEdit(r: PMRow) { setEditing(r); setDlgOpen(true); }

  function moveRow(id: number, dir: -1 | 1) {
    const idx = sorted.findIndex(r => r.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const newOrder = sorted.map(r => r.id);
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    reorderMut.mutate({ ids: newOrder });
  }

  function toggleField(r: PMRow, field: "isActive" | "isVisible") {
    updateMut.mutate({ id: r.id, [field]: !r[field] });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-sm">وسائل الدفع / Payment Methods</h3>
          <p className="text-xs text-muted-foreground mt-0.5">إدارة وسائل الدفع المتاحة في نافذة استلام المبالغ</p>
        </div>
        <div className="flex gap-2">
          {rows.length === 0 && (
            <Button variant="outline" className="h-8 text-xs gap-1.5" onClick={() => seedMut.mutate()}>
              <RefreshCw className="w-3.5 h-3.5" />استعادة الافتراضيات
            </Button>
          )}
          <Button className="h-8 text-xs gap-1.5" onClick={openAdd}>
            <Plus className="w-3.5 h-3.5" />إضافة وسيلة
          </Button>
        </div>
      </div>

      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-16 text-center">ترتيب</TableHead>
              <TableHead className="text-xs w-16 text-center">معاينة</TableHead>
              <TableHead className="text-xs font-mono">الكود</TableHead>
              <TableHead className="text-xs">الاسم العربي</TableHead>
              <TableHead className="text-xs" dir="ltr">English Name</TableHead>
              <TableHead className="text-xs text-center w-20">مرئية</TableHead>
              <TableHead className="text-xs text-center w-20">نشطة</TableHead>
              <TableHead className="text-xs text-center w-20">نظامية</TableHead>
              <TableHead className="text-xs w-24">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading && (
              <TableRow><TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-8">جاري التحميل...</TableCell></TableRow>
            )}
            {!listQ.isLoading && sorted.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-8">لا توجد وسائل دفع — اضغط "استعادة الافتراضيات"</TableCell></TableRow>
            )}
            {sorted.map((r, i) => (
              <TableRow key={r.id} className={!r.isActive ? "opacity-50" : undefined}>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <button className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={i === 0} onClick={() => moveRow(r.id, -1)}>▲</button>
                    <span className="text-xs text-muted-foreground">{r.sortOrder}</span>
                    <button className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={i === sorted.length - 1} onClick={() => moveRow(r.id, 1)}>▼</button>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto"
                    style={{ backgroundColor: r.bgColor ?? "#F8FAFC", border: `1px solid ${r.color ?? "#E2E8F0"}` }}>
                    <PaymentMethodIcon icon={r.icon} color={r.color} />
                  </div>
                </TableCell>
                <TableCell className="text-xs font-mono font-bold text-primary">{r.code}</TableCell>
                <TableCell className="text-xs">{r.nameAr}</TableCell>
                <TableCell className="text-xs" dir="ltr">{r.nameEn ?? "—"}</TableCell>
                <TableCell className="text-center">
                  <button onClick={() => toggleField(r, "isVisible")} title="تبديل الظهور">
                    {r.isVisible
                      ? <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 cursor-pointer">مرئية</Badge>
                      : <Badge variant="secondary" className="text-[10px] bg-gray-50 text-gray-500 border-gray-200 cursor-pointer">مخفية</Badge>}
                  </button>
                </TableCell>
                <TableCell className="text-center">
                  <button onClick={() => toggleField(r, "isActive")} title="تبديل الحالة">
                    {r.isActive
                      ? <Badge variant="secondary" className="text-[10px] bg-green-50 text-green-700 border-green-200 cursor-pointer">نشطة</Badge>
                      : <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-700 border-red-200 cursor-pointer">موقوفة</Badge>}
                  </button>
                </TableCell>
                <TableCell className="text-center">
                  {r.isBuiltIn
                    ? <Badge className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">نظامية</Badge>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary text-xs hover:underline" onClick={() => openEdit(r)}>تعديل</button>
                    {!r.isBuiltIn && (
                      <button className="text-destructive text-xs hover:underline"
                        onClick={() => { if (confirm(`حذف "${r.nameAr}"؟`)) deleteMut.mutate({ id: r.id }); }}>
                        حذف
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <PaymentMethodDialog
        open={dlgOpen}
        onClose={() => setDlgOpen(false)}
        initial={editing}
        isEdit={!!editing.id}
      />
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
    case "field-dictionary":     return <FieldDictionaryPage />;
    case "payment-methods":      return <PaymentMethodsPage />;
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

    case "document-templates":   return <TemplatesManagerPage />;
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
    // إدارة الولاء والعروض
    case "loyalty-points":       return <LoyaltyPointsPage />;
    case "loyalty-tiers":        return <LoyaltyTiersPage />;
    case "loyalty-promos":       return <LoyaltyPromosPage />;
    case "loyalty-messages":     return <LoyaltyMessagesPage />;
    // التكاملات الحكومية
    case "zatca-config":         return <ZatcaIntegrationPage initialTab="settings" />;
    case "zatca-monitor":        return <ZatcaIntegrationPage initialTab="monitor" />;
    case "zatca-invoices":       return <ZatcaIntegrationPage initialTab="invoices" />;
    case "zatca-logs":           return <ZatcaIntegrationPage initialTab="logs" />;
    case "gosi-config":          return <ComingSoon title="التأمينات الاجتماعية (GOSI)" />;
    case "gazt-config":          return <ComingSoon title="الزكاة والدخل (GAZT)" />;
    // مركز الرسائل والتكاملات
    case "messaging-whatsapp":   return <MessagingWhatsAppPage />;
    case "messaging-telegram":   return <MessagingTelegramPage />;
    case "messaging-email":      return <MessagingEmailPage />;
    case "messaging-templates":  return <MessagingTemplatesPage />;
    case "messaging-log":        return <MessagingLogPage />;
    // التصميم والطباعة
    case "print-settings":       return <PrintSettingsPage />;
    case "logo-stamp":           return <LogoStampPage />;
    case "signatures":           return <SignatureSettingsPage />;
    case "email-pdf":            return <EmailPdfSettingsPage />;
    default:                     return <SettingsOverview onSelect={onSelect} />;
  }
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function SettingsModule() {
  const [activeId, setActiveId] = useState<MenuId>("overview");
  return (
    <div className="flex h-full" dir="rtl">
      <SettingsMenu activeId={activeId} onSelect={setActiveId} />
      <div className="flex-1 overflow-auto p-5" style={{ background: "#ECE7DD" }}>
        <SettingsContent activeId={activeId} onSelect={setActiveId} />
      </div>
    </div>
  );
}

// ─── Tab Sub-Pages ─────────────────────────────────────────────────────────────
function CfgSubPage({ activeId }: { activeId: string }) {
  return <div className="h-full overflow-auto p-5" dir="rtl" style={{ background: "#ECE7DD" }}><SettingsContent activeId={activeId} onSelect={() => {}} /></div>;
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
export function CfgDocumentJournalsTab()     { return <CfgSubPage activeId="document-journals" />; }

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
export function CfgLoyaltyPointsTab()   { return <CfgSubPage activeId="loyalty-points" />; }
export function CfgLoyaltyTiersTab()    { return <CfgSubPage activeId="loyalty-tiers" />; }
export function CfgLoyaltyPromosTab()   { return <CfgSubPage activeId="loyalty-promos" />; }
export function CfgLoyaltyMessagesTab() { return <CfgSubPage activeId="loyalty-messages" />; }
export function CfgMessagingWhatsAppTab()  { return <CfgSubPage activeId="messaging-whatsapp" />; }
export function CfgMessagingTelegramTab()  { return <CfgSubPage activeId="messaging-telegram" />; }
export function CfgMessagingEmailTab()     { return <CfgSubPage activeId="messaging-email" />; }
export function CfgMessagingTemplatesTab() { return <CfgSubPage activeId="messaging-templates" />; }
export function CfgMessagingLogTab()       { return <CfgSubPage activeId="messaging-log" />; }
export function CfgPrintSettingsTab()      { return <CfgSubPage activeId="print-settings" />; }
export function CfgLogoStampTab()          { return <CfgSubPage activeId="logo-stamp" />; }
export function CfgSignaturesTab()         { return <CfgSubPage activeId="signatures" />; }
export function CfgEmailPdfTab()           { return <CfgSubPage activeId="email-pdf" />; }
export function CfgFieldDictionaryTab()   { return <CfgSubPage activeId="field-dictionary" />; }
export function CfgPaymentMethodsTab()    { return <CfgSubPage activeId="payment-methods" />; }
export function CfgZatcaTab()            { return <CfgSubPage activeId="zatca-config" />; }
export function CfgZatcaMonitorTab()     { return <CfgSubPage activeId="zatca-monitor" />; }
export function CfgZatcaInvoicesTab()    { return <CfgSubPage activeId="zatca-invoices" />; }
export function CfgZatcaLogsTab()        { return <CfgSubPage activeId="zatca-logs" />; }
