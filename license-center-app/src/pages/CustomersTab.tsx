import React, { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  Search, Plus, ChevronDown, X, Copy, Check,
  Monitor, Globe, Layers, Users, Building2, MonitorSmartphone,
  KeyRound, RefreshCw, Pause, Play, FileText, Link,
  ClipboardList, Eye, Pencil, Calendar,
  CheckCircle2, XCircle, AlertTriangle, Clock, ShieldOff,
} from "lucide-react";

const NAVY   = "#0F1D40";
const NAVY2  = "#1B2B5C";
const GOLD   = "#C9A84C";
const CREAM  = "#F8F5EF";
const BORDER = "#E5DDD0";

// ─── Types ─────────────────────────────────────────────────────────────────────
type RunType     = "desktop" | "web" | "hybrid";
type LicType     = "trial" | "subscription" | "lifetime";
type ClientStatus = "active" | "trial" | "expired" | "suspended" | "expiring_soon" | "inactive";

interface ClientRow {
  id: number; name: string; orgId: string; tradeName?: string | null;
  commercialReg?: string | null; taxNumber?: string | null;
  country?: string | null; city?: string | null;
  phone?: string | null; email?: string | null;
  activityType?: string | null; contactName?: string | null;
  contactPhone?: string | null; contactEmail?: string | null;
  runType: string; notes?: string | null;
  license: {
    id: number; licenseId: string; licenseType: string; status: string;
    maxUsers: number; maxBranches: number; maxPos: number;
    maxDevices: number; maxWeb: number;
    startDate: string; expiryDate: string;
    enabledModules: string[];
    webAllowed: boolean; desktopAllowed: boolean;
    offlineAllowed: boolean; syncAllowed: boolean;
  } | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function daysLeft(exp?: string | null): number {
  if (!exp) return 0;
  return Math.ceil((new Date(exp + "T23:59:59Z").getTime() - Date.now()) / 86_400_000);
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function addDays(d: string, n: number) {
  const dt = new Date(d + "T00:00:00"); dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}
function addMonths(d: string, n: number) {
  const dt = new Date(d + "T00:00:00"); dt.setMonth(dt.getMonth() + n);
  return dt.toISOString().slice(0, 10);
}
function trialExpiry(d: string) {
  return addMonths(d, 3);
}

function computeStatus(row: ClientRow): ClientStatus {
  const lic = row.license;
  if (!lic) return "inactive";
  if (lic.status === "suspended") return "suspended";
  const days = daysLeft(lic.expiryDate);
  if (lic.status === "expired" || days < 0) return "expired";
  if (lic.licenseType === "trial") return "trial";
  if (days <= 30) return "expiring_soon";
  return "active";
}

const STATUS_CFG: Record<ClientStatus, { label: string; bg: string; text: string; dot: string; icon: React.ReactNode }> = {
  active:        { label: "نشط",            bg: "#ECFDF5", text: "#16A34A", dot: "#22C55E", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  trial:         { label: "تجريبي",         bg: "#FEFCE8", text: "#B45309", dot: "#F59E0B", icon: <Clock className="w-3.5 h-3.5" /> },
  expired:       { label: "منتهي",          bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444", icon: <XCircle className="w-3.5 h-3.5" /> },
  suspended:     { label: "موقوف",          bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF", icon: <ShieldOff className="w-3.5 h-3.5" /> },
  expiring_soon: { label: "قريب الانتهاء", bg: "#FFF7ED", text: "#C2410C", dot: "#F97316", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  inactive:      { label: "غير مفعل",       bg: "#F9FAFB", text: "#9CA3AF", dot: "#D1D5DB", icon: <XCircle className="w-3.5 h-3.5" /> },
};

const RUN_TYPE_CFG: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
  desktop: { label: "Desktop / Offline", icon: <Monitor className="w-5 h-5" />, desc: "Installer + ملف ترخيص" },
  web:     { label: "Web / Online",      icon: <Globe className="w-5 h-5" />,   desc: "رابط دخول + كود مؤسسة" },
  hybrid:  { label: "Hybrid",            icon: <Layers className="w-5 h-5" />,  desc: "سطح مكتب + مزامنة" },
};

const LIC_TYPE_CFG: Record<string, { label: string; desc: string; color: string }> = {
  trial:        { label: "فترة تجريبية", desc: "Trial",        color: "#B45309" },
  subscription: { label: "اشتراك",       desc: "Subscription", color: NAVY2 },
  lifetime:     { label: "دائم",         desc: "Lifetime",     color: "#16A34A" },
};

// ─── StatusBadge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ClientStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

// ─── NumInput ──────────────────────────────────────────────────────────────────
function NumInput({ label, value, onChange, min = 0, max = 999 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-bold" style={{ color: GOLD }}>{label}</label>
      <div className="flex items-center rounded-xl border overflow-hidden" style={{ borderColor: BORDER }}>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          className="px-3 py-2 text-[16px] font-black hover:bg-gray-100 transition-colors" style={{ color: NAVY2 }}>−</button>
        <input type="number" value={value} min={min} max={max}
          onChange={e => onChange(Math.min(max, Math.max(min, parseInt(e.target.value) || 0)))}
          className="flex-1 text-center text-[15px] font-bold outline-none bg-transparent py-2" style={{ color: NAVY2 }} />
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
          className="px-3 py-2 text-[16px] font-black hover:bg-gray-100 transition-colors" style={{ color: NAVY2 }}>+</button>
      </div>
    </div>
  );
}

// ─── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className="flex items-center gap-2 px-3 py-2 rounded-xl border text-[13px] font-semibold transition-all"
      style={{
        borderColor: value ? "#16A34A" : BORDER,
        backgroundColor: value ? "#ECFDF5" : "#F9FAFB",
        color: value ? "#16A34A" : "#6B7280",
      }}>
      <span className={`w-8 h-4.5 rounded-full relative transition-colors flex items-center shrink-0`}
        style={{ backgroundColor: value ? "#16A34A" : "#D1D5DB", height: "18px", width: "32px" }}>
        <span className="w-3.5 h-3.5 bg-white rounded-full shadow absolute transition-transform"
          style={{ transform: value ? "translateX(14px)" : "translateX(2px)" }} />
      </span>
      {label}
    </button>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b mb-3" style={{ borderColor: BORDER }}>
      <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.12)" }}>
        <span style={{ color: GOLD }}>{icon}</span>
      </span>
      <h3 className="text-[14px] font-extrabold" style={{ color: NAVY2 }}>{title}</h3>
    </div>
  );
}

// ─── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-bold" style={{ color: GOLD }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls = `w-full px-3 py-2 rounded-xl border text-[14px] outline-none transition-colors`;
const inputStyle = { borderColor: BORDER, color: NAVY2 };

// ─── ActionResultModal ──────────────────────────────────────────────────────────
function ActionResultModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: BORDER }}>
          <h2 className="text-[17px] font-extrabold" style={{ color: NAVY2 }}>{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        <div className="px-5 pb-5 flex justify-end">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-white text-[14px] font-bold transition-all hover:opacity-90"
            style={{ backgroundColor: NAVY2 }}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}

// ─── CopyField ─────────────────────────────────────────────────────────────────
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div>
      <p className="text-[12px] font-bold mb-1" style={{ color: GOLD }}>{label}</p>
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border" style={{ borderColor: BORDER, backgroundColor: "#F9FAFB" }}>
        <span className="flex-1 font-mono text-[13px] font-bold break-all" style={{ color: NAVY2 }}>{value}</span>
        <button onClick={copy} className="shrink-0 p-1 rounded-lg hover:bg-gray-200 transition-colors">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" style={{ color: GOLD }} />}
        </button>
      </div>
    </div>
  );
}

// ─── ActionsDropdown ───────────────────────────────────────────────────────────
function ActionsDropdown({ row, onAction, onNavigate }: {
  row: ClientRow;
  onAction: (action: string, row: ClientRow) => void;
  onNavigate: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const status = computeStatus(row);
  const hasLic = !!row.license;

  const items = [
    { id: "view",        icon: <Eye className="w-4 h-4" />,             label: "عرض التفاصيل",         disabled: false },
    { id: "edit",        icon: <Pencil className="w-4 h-4" />,          label: "تعديل",                disabled: false },
    { id: "sep1" },
    { id: "renew",       icon: <RefreshCw className="w-4 h-4" />,       label: "تجديد الترخيص",        disabled: !hasLic },
    { id: "suspend",     icon: <Pause className="w-4 h-4" />,           label: "إيقاف",                disabled: !hasLic || status === "suspended" },
    { id: "resume",      icon: <Play className="w-4 h-4" />,            label: "إعادة تفعيل",          disabled: !hasLic || status !== "suspended" },
    { id: "sep2" },
    { id: "export_lic",  icon: <FileText className="w-4 h-4" />,        label: "إصدار license.ons",    disabled: !hasLic || row.runType === "web" },
    { id: "actv_code",   icon: <KeyRound className="w-4 h-4" />,        label: "إصدار Activation Code",disabled: !hasLic },
    { id: "web_link",    icon: <Link className="w-4 h-4" />,            label: "رابط Web Setup",        disabled: row.runType === "desktop" },
    { id: "sep3" },
    { id: "copy_code",   icon: <Copy className="w-4 h-4" />,            label: "نسخ كود المؤسسة",      disabled: false },
    { id: "devices",     icon: <MonitorSmartphone className="w-4 h-4" />,label: "عرض الأجهزة",         disabled: false },
    { id: "log",         icon: <ClipboardList className="w-4 h-4" />,   label: "سجل العمليات",         disabled: false },
  ];

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-bold border transition-all hover:shadow-sm"
        style={{ borderColor: BORDER, color: NAVY2, backgroundColor: open ? "#F3F4F6" : "white" }}>
        إجراءات <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-52 bg-white rounded-xl shadow-xl border py-1"
          style={{ borderColor: BORDER }}>
          {items.map((item, i) => {
            if (item.id?.startsWith("sep")) return <hr key={i} className="my-1" style={{ borderColor: BORDER }} />;
            return (
              <button key={item.id} disabled={item.disabled}
                onClick={() => { setOpen(false); onAction(item.id!, row); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-right transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: NAVY2 }}>
                <span style={{ color: item.disabled ? "#9CA3AF" : GOLD }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CreateClientDialog ─────────────────────────────────────────────────────────
interface CreateForm {
  name: string; tradeName: string; commercialReg: string; taxNumber: string;
  country: string; city: string; phone: string; email: string;
  activityType: string; contactName: string; contactPhone: string; contactEmail: string;
  runType: RunType; notes: string;
  packageName: string; licenseType: LicType;
  trialDays: number; subPeriod: number;
  startDate: string; expiryDate: string;
  maxUsers: number; maxBranches: number; maxPos: number; maxDevices: number; maxWeb: number;
  webAllowed: boolean; desktopAllowed: boolean; offlineAllowed: boolean; syncAllowed: boolean;
  enabledModules: string[];
}

function makeDefaultForm(): CreateForm {
  const today = todayStr();
  return {
    name: "", tradeName: "", commercialReg: "", taxNumber: "",
    country: "", city: "", phone: "", email: "",
    activityType: "", contactName: "", contactPhone: "", contactEmail: "",
    runType: "desktop", notes: "",
    packageName: "", licenseType: "subscription",
    trialDays: 90, subPeriod: 12,
    startDate: today, expiryDate: addMonths(today, 12),
    maxUsers: 5, maxBranches: 1, maxPos: 1, maxDevices: 3, maxWeb: 0,
    webAllowed: false, desktopAllowed: true, offlineAllowed: false, syncAllowed: false,
    enabledModules: [],
  };
}

function CreateClientDialog({ modules, onClose, onCreated }: {
  modules: { id: string; name: string; group: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateForm>(makeDefaultForm);
  const createMut = trpc.licenseCenter.createClientWithLicense.useMutation({
    onSuccess: () => { onCreated(); onClose(); },
  });

  const set = <K extends keyof CreateForm>(k: K, v: CreateForm[K]) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === "licenseType") {
        if (v === "lifetime") next.expiryDate = "2099-12-31";
        else if (v === "trial") next.expiryDate = trialExpiry(next.startDate);
        else next.expiryDate = addMonths(next.startDate, next.subPeriod);
      }
      if (k === "startDate") {
        if (next.licenseType === "trial") next.expiryDate = trialExpiry(v as string);
        else if (next.licenseType === "subscription") next.expiryDate = addMonths(v as string, next.subPeriod);
      }
      if (k === "trialDays") next.expiryDate = trialExpiry(next.startDate);
      if (k === "subPeriod") next.expiryDate = addMonths(next.startDate, v as number);
      if (k === "runType") {
        if (v === "web") { next.webAllowed = true; next.desktopAllowed = false; }
        else if (v === "desktop") { next.webAllowed = false; next.desktopAllowed = true; }
        else { next.webAllowed = true; next.desktopAllowed = true; }
      }
      return next;
    });
  };

  const toggleModule = (id: string) => {
    setForm(f => ({
      ...f,
      enabledModules: f.enabledModules.includes(id)
        ? f.enabledModules.filter(m => m !== id)
        : [...f.enabledModules, id],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({
      name: form.name, tradeName: form.tradeName || undefined,
      commercialReg: form.commercialReg || undefined, taxNumber: form.taxNumber || undefined,
      country: form.country || undefined, city: form.city || undefined,
      phone: form.phone || undefined, email: form.email || undefined,
      activityType: form.activityType || undefined,
      contactName: form.contactName || undefined, contactPhone: form.contactPhone || undefined,
      contactEmail: form.contactEmail || undefined,
      runType: form.runType, notes: form.notes || undefined,
      packageName: form.packageName || undefined, licenseType: form.licenseType,
      startDate: form.startDate, expiryDate: form.expiryDate,
      maxUsers: form.maxUsers, maxBranches: form.maxBranches, maxPos: form.maxPos,
      maxDevices: form.maxDevices, maxWeb: form.maxWeb,
      webAllowed: form.webAllowed, desktopAllowed: form.desktopAllowed,
      offlineAllowed: form.offlineAllowed, syncAllowed: form.syncAllowed,
      enabledModules: form.enabledModules,
    });
  };

  const groups = Array.from(new Set(modules.map(m => m.group)));
  const groupLabels: Record<string, string> = {
    core: "الوحدات الأساسية", integration: "التكامل", hr: "الموارد البشرية",
    advanced: "وحدات متقدمة", connectivity: "الاتصال والمزامنة",
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center p-4 pt-8 overflow-y-auto"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mb-8" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl z-10"
          style={{ borderColor: BORDER, backgroundColor: "rgba(201,168,76,0.04)" }}>
          <div>
            <h2 className="text-[20px] font-black" style={{ color: NAVY2 }}>إنشاء عميل جديد</h2>
            <p className="text-[12px] font-medium mt-0.5" style={{ color: GOLD }}>بيانات المؤسسة + إعداد الترخيص</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-7">

            {/* §1 بيانات المؤسسة */}
            <div>
              <SectionHeader icon={<Building2 className="w-4 h-4" />} title="بيانات المؤسسة" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="اسم المؤسسة *">
                  <input required value={form.name} onChange={e => set("name", e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="الاسم الرسمي للمؤسسة" />
                </Field>
                <Field label="الاسم التجاري">
                  <input value={form.tradeName} onChange={e => set("tradeName", e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="الاسم المعروف" />
                </Field>
                <Field label="السجل التجاري">
                  <input value={form.commercialReg} onChange={e => set("commercialReg", e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="رقم السجل التجاري" />
                </Field>
                <Field label="الرقم الضريبي">
                  <input value={form.taxNumber} onChange={e => set("taxNumber", e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="الرقم الضريبي (VAT)" />
                </Field>
                <Field label="الدولة">
                  <input value={form.country} onChange={e => set("country", e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="مثال: السعودية" />
                </Field>
                <Field label="المدينة">
                  <input value={form.city} onChange={e => set("city", e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="مثال: الرياض" />
                </Field>
                <Field label="رقم الجوال">
                  <input value={form.phone} onChange={e => set("phone", e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="05XXXXXXXX" />
                </Field>
                <Field label="البريد الإلكتروني">
                  <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="info@company.sa" />
                </Field>
                <Field label="نوع النشاط">
                  <input value={form.activityType} onChange={e => set("activityType", e.target.value)}
                    className={`${inputCls} col-span-2`} style={inputStyle} placeholder="مثال: تجارة عامة، خدمات، توزيع..." />
                </Field>
              </div>
            </div>

            {/* §2 بيانات المسؤول */}
            <div>
              <SectionHeader icon={<Users className="w-4 h-4" />} title="بيانات المسؤول" />
              <div className="grid grid-cols-3 gap-4">
                <Field label="اسم المسؤول">
                  <input value={form.contactName} onChange={e => set("contactName", e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="الاسم الكامل" />
                </Field>
                <Field label="جوال المسؤول">
                  <input value={form.contactPhone} onChange={e => set("contactPhone", e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="05XXXXXXXX" />
                </Field>
                <Field label="بريد المسؤول">
                  <input type="email" value={form.contactEmail} onChange={e => set("contactEmail", e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="admin@company.sa" />
                </Field>
              </div>
            </div>

            {/* §3 نوع التشغيل */}
            <div>
              <SectionHeader icon={<Monitor className="w-4 h-4" />} title="نوع التشغيل" />
              <div className="grid grid-cols-3 gap-3">
                {(["desktop", "web", "hybrid"] as RunType[]).map(rt => {
                  const cfg = RUN_TYPE_CFG[rt];
                  const active = form.runType === rt;
                  return (
                    <button key={rt} type="button" onClick={() => set("runType", rt)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all"
                      style={{
                        borderColor: active ? NAVY2 : BORDER,
                        backgroundColor: active ? "rgba(27,43,92,0.06)" : "#F9FAFB",
                      }}>
                      <span style={{ color: active ? NAVY2 : "#9CA3AF" }}>{cfg.icon}</span>
                      <span className="text-[13px] font-extrabold" style={{ color: active ? NAVY2 : "#6B7280" }}>{cfg.label}</span>
                      <span className="text-[11px] text-center" style={{ color: "#9CA3AF" }}>{cfg.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* §4 نوع الترخيص */}
            <div>
              <SectionHeader icon={<KeyRound className="w-4 h-4" />} title="نوع الترخيص" />
              <div className="grid grid-cols-3 gap-3 mb-4">
                {(["trial", "subscription", "lifetime"] as LicType[]).map(lt => {
                  const cfg = LIC_TYPE_CFG[lt];
                  const active = form.licenseType === lt;
                  return (
                    <button key={lt} type="button" onClick={() => set("licenseType", lt)}
                      className="flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all"
                      style={{
                        borderColor: active ? cfg.color : BORDER,
                        backgroundColor: active ? `${cfg.color}11` : "#F9FAFB",
                      }}>
                      <span className="text-[15px] font-extrabold" style={{ color: active ? cfg.color : "#6B7280" }}>{cfg.label}</span>
                      <span className="text-[12px]" style={{ color: "#9CA3AF" }}>{cfg.desc}</span>
                    </button>
                  );
                })}
              </div>

              {form.licenseType === "trial" && (
                <div className="grid grid-cols-3 gap-4 p-4 rounded-xl border" style={{ borderColor: BORDER, backgroundColor: "#FEFCE8" }}>
                  <Field label="مدة التجربة">
                    <select value={form.trialDays} onChange={e => set("trialDays", parseInt(e.target.value))}
                      className={inputCls} style={inputStyle}>
                      <option value={90}>3 أشهر تقويمية</option>
                    </select>
                  </Field>
                  <Field label="تاريخ البداية">
                    <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)}
                      className={inputCls} style={inputStyle} />
                  </Field>
                  <Field label="تاريخ الانتهاء">
                    <input type="date" value={form.expiryDate} readOnly
                      className={`${inputCls} bg-gray-50`} style={{ ...inputStyle, color: "#9CA3AF" }} />
                  </Field>
                </div>
              )}
              {form.licenseType === "subscription" && (
                <div className="grid grid-cols-3 gap-4 p-4 rounded-xl border" style={{ borderColor: BORDER, backgroundColor: "#F0F9FF" }}>
                  <Field label="فترة الاشتراك">
                    <select value={form.subPeriod} onChange={e => set("subPeriod", parseInt(e.target.value))}
                      className={inputCls} style={inputStyle}>
                      <option value={1}>شهري (شهر)</option>
                      <option value={3}>ربع سنوي (3 أشهر)</option>
                      <option value={6}>نصف سنوي (6 أشهر)</option>
                      <option value={12}>سنوي (12 شهر)</option>
                      <option value={24}>سنتين</option>
                      <option value={36}>3 سنوات</option>
                    </select>
                  </Field>
                  <Field label="تاريخ البداية">
                    <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)}
                      className={inputCls} style={inputStyle} />
                  </Field>
                  <Field label="تاريخ الانتهاء">
                    <input type="date" value={form.expiryDate} readOnly
                      className={`${inputCls} bg-gray-50`} style={{ ...inputStyle, color: "#9CA3AF" }} />
                  </Field>
                </div>
              )}
              {form.licenseType === "lifetime" && (
                <div className="p-4 rounded-xl border" style={{ borderColor: "#BBF7D0", backgroundColor: "#ECFDF5" }}>
                  <p className="text-[13px] font-semibold text-green-700">
                    ترخيص دائم — لا يوجد تاريخ انتهاء. يمكن تعطيله يدوياً من لوحة التحكم عند الحاجة.
                  </p>
                </div>
              )}
            </div>

            {/* §5 حدود الترخيص */}
            <div>
              <SectionHeader icon={<Monitor className="w-4 h-4" />} title="حدود الترخيص" />
              <div className="grid grid-cols-5 gap-3 mb-4">
                <NumInput label="المستخدمون"   value={form.maxUsers}    onChange={v => set("maxUsers", v)}    min={1} />
                <NumInput label="الفروع"        value={form.maxBranches} onChange={v => set("maxBranches", v)} min={1} />
                <NumInput label="نقاط البيع"   value={form.maxPos}      onChange={v => set("maxPos", v)}      min={0} />
                <NumInput label="الأجهزة"       value={form.maxDevices}  onChange={v => set("maxDevices", v)}  min={1} />
                <NumInput label="الويب"         value={form.maxWeb}      onChange={v => set("maxWeb", v)}      min={0} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Toggle label="الويب"           value={form.webAllowed}     onChange={v => set("webAllowed", v)} />
                <Toggle label="سطح المكتب"      value={form.desktopAllowed} onChange={v => set("desktopAllowed", v)} />
                <Toggle label="التشغيل أوفلاين" value={form.offlineAllowed} onChange={v => set("offlineAllowed", v)} />
                <Toggle label="المزامنة"         value={form.syncAllowed}    onChange={v => set("syncAllowed", v)} />
              </div>
            </div>

            {/* §6 الشاشات المتاحة */}
            <div>
              <SectionHeader icon={<Layers className="w-4 h-4" />} title="الشاشات المتاحة" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-semibold" style={{ color: "#6B7280" }}>
                  {form.enabledModules.length} / {modules.length} محدّد
                </span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm(f => ({ ...f, enabledModules: modules.map(m => m.id) }))}
                    className="text-[12px] font-bold px-3 py-1 rounded-lg border transition-colors hover:bg-gray-50"
                    style={{ borderColor: BORDER, color: NAVY2 }}>تحديد الكل</button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, enabledModules: [] }))}
                    className="text-[12px] font-bold px-3 py-1 rounded-lg border transition-colors hover:bg-gray-50"
                    style={{ borderColor: BORDER, color: "#6B7280" }}>إلغاء الكل</button>
                </div>
              </div>
              {groups.map(g => (
                <div key={g} className="mb-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#9CA3AF" }}>{groupLabels[g] ?? g}</p>
                  <div className="flex flex-wrap gap-2">
                    {modules.filter(m => m.group === g).map(m => {
                      const active = form.enabledModules.includes(m.id);
                      return (
                        <button key={m.id} type="button" onClick={() => toggleModule(m.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[13px] font-semibold transition-all"
                          style={{
                            borderColor: active ? NAVY2 : BORDER,
                            backgroundColor: active ? NAVY2 : "#F9FAFB",
                            color: active ? "white" : "#6B7280",
                          }}>
                          {active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5 opacity-40" />}
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div>
              <Field label="ملاحظات (اختياري)">
                <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2}
                  className={`${inputCls} resize-none`} style={inputStyle} placeholder="أي ملاحظات إضافية..." />
              </Field>
            </div>

          </div>

          {/* Footer */}
          {createMut.error && (
            <div className="mx-6 mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-700 font-semibold">
              {createMut.error.message}
            </div>
          )}
          <div className="flex items-center justify-between px-6 py-4 border-t sticky bottom-0 bg-white rounded-b-2xl"
            style={{ borderColor: BORDER }}>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl border text-[14px] font-bold transition-all hover:bg-gray-50"
              style={{ borderColor: BORDER, color: "#6B7280" }}>إلغاء</button>
            <button type="submit" disabled={createMut.isPending || !form.name.trim()}
              className="px-6 py-2.5 rounded-xl text-white text-[15px] font-extrabold transition-all hover:opacity-90 disabled:opacity-50 shadow-md"
              style={{ backgroundColor: NAVY2 }}>
              {createMut.isPending ? "جارٍ الإنشاء..." : "إنشاء العميل"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── RenewDialog ────────────────────────────────────────────────────────────────
function RenewDialog({ row, onClose, onDone }: { row: ClientRow; onClose: () => void; onDone: () => void }) {
  const [newExpiry, setNewExpiry] = useState(addMonths(todayStr(), 12));
  const renewMut = trpc.licenseCenter.renewLicense.useMutation({ onSuccess: () => { onDone(); onClose(); } });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: BORDER }}>
          <h2 className="text-[17px] font-extrabold" style={{ color: NAVY2 }}>تجديد الترخيص</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[13px] font-semibold" style={{ color: "#6B7280" }}>العميل: <span className="font-bold" style={{ color: NAVY2 }}>{row.name}</span></p>
          <Field label="تاريخ الانتهاء الجديد">
            <input type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)}
              className={inputCls} style={inputStyle} />
          </Field>
          {renewMut.error && <p className="text-[12px] text-red-600">{renewMut.error.message}</p>}
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-[14px] font-bold" style={{ borderColor: BORDER, color: "#6B7280" }}>إلغاء</button>
          <button onClick={() => row.license && renewMut.mutate({ licenseId: row.license.id, newExpiryDate: newExpiry })}
            disabled={renewMut.isPending || !row.license}
            className="flex-1 py-2.5 rounded-xl text-white text-[14px] font-extrabold disabled:opacity-50"
            style={{ backgroundColor: NAVY2 }}>
            {renewMut.isPending ? "جارٍ التجديد..." : "تجديد"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main CustomersTab ──────────────────────────────────────────────────────────
export default function CustomersTab({ onNavigate }: { onNavigate: (key: string) => void }) {
  const [search, setSearch]             = useState("");
  const [filterRun, setFilterRun]       = useState("");
  const [filterLic, setFilterLic]       = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [createOpen, setCreateOpen]     = useState(false);
  const [renewRow, setRenewRow]         = useState<ClientRow | null>(null);
  const [resultModal, setResultModal]   = useState<{ title: string; content: React.ReactNode } | null>(null);

  const clientsQ  = trpc.licenseCenter.listClientsDetailed.useQuery(undefined, { retry: false });
  const modulesQ  = trpc.licenseCenter.listModuleCatalog.useQuery(undefined, { retry: false });
  const suspendMut = trpc.licenseCenter.suspendLicense.useMutation({ onSuccess: () => clientsQ.refetch() });
  const resumeMut  = trpc.licenseCenter.resumeLicense.useMutation({ onSuccess: () => clientsQ.refetch() });
  const actvMut    = trpc.licenseCenter.generateActivationCode.useMutation({
    onSuccess: (data) => setResultModal({
      title: "Activation Code",
      content: (
        <div className="space-y-3">
          <p className="text-[13px] font-semibold" style={{ color: "#6B7280" }}>احتفظ بهذا الكود وأرسله للعميل:</p>
          <CopyField label="Activation Code" value={data.code} />
          <CopyField label="License ID" value={data.licenseId} />
          <p className="text-[12px] px-3 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
            هذا الكود يُستخدم مرة واحدة فقط عند أول تفعيل.
          </p>
        </div>
      ),
    }),
  });
  const webSetupMut = trpc.licenseCenter.generateWebSetupToken.useMutation({
    onSuccess: (data) => setResultModal({
      title: "رابط Web Setup Admin",
      content: (
        <div className="space-y-3">
          <p className="text-[13px] font-semibold" style={{ color: "#6B7280" }}>أرسل هذا الرابط للعميل لإنشاء أول مسؤول:</p>
          <CopyField label="رابط الإعداد" value={data.url} />
          <CopyField label="Organization Code" value={data.orgId} />
          <p className="text-[12px] px-3 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
            هذا الرابط يُستخدم مرة واحدة فقط لإنشاء المسؤول الأول.
          </p>
        </div>
      ),
    }),
  });

  const rows = useMemo<ClientRow[]>(() => {
    const data = (clientsQ.data ?? []) as ClientRow[];
    return data.filter(r => {
      if (search) {
        const q = search.toLowerCase();
        if (!r.name.toLowerCase().includes(q) &&
            !r.orgId.toLowerCase().includes(q) &&
            !(r.taxNumber ?? "").toLowerCase().includes(q) &&
            !(r.tradeName ?? "").toLowerCase().includes(q)) return false;
      }
      if (filterRun && r.runType !== filterRun) return false;
      if (filterLic && r.license?.licenseType !== filterLic) return false;
      const st = computeStatus(r);
      if (filterStatus && st !== filterStatus) return false;
      return true;
    });
  }, [clientsQ.data, search, filterRun, filterLic, filterStatus]);

  const handleAction = (action: string, row: ClientRow) => {
    if (action === "suspend" && row.license) suspendMut.mutate({ licenseId: row.license.id }, { onSuccess: () => clientsQ.refetch() });
    else if (action === "resume" && row.license) resumeMut.mutate({ licenseId: row.license.id }, { onSuccess: () => clientsQ.refetch() });
    else if (action === "renew") setRenewRow(row);
    else if (action === "actv_code" && row.license) actvMut.mutate({ licenseId: row.license.id });
    else if (action === "web_link") webSetupMut.mutate({ clientId: row.id });
    else if (action === "copy_code") {
      navigator.clipboard.writeText(row.orgId);
    }
    else if (action === "devices") onNavigate("devices");
    else if (action === "log") onNavigate("log");
    else if (action === "export_lic") {
      setResultModal({
        title: "إصدار license.ons",
        content: (
          <div className="space-y-3">
            <CopyField label="Organization Code" value={row.orgId} />
            {row.license && <CopyField label="License ID" value={row.license.licenseId} />}
            <p className="text-[12px] px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
              ملف license.ons يتم توليده ورفعه عبر نظام التوليد التلقائي — هذه البيانات مرجعية.
            </p>
          </div>
        ),
      });
    }
    else if (action === "view") {
      setResultModal({
        title: `تفاصيل: ${row.name}`,
        content: (
          <div className="space-y-2 text-[13px]">
            {[
              ["كود المؤسسة", row.orgId], ["الاسم التجاري", row.tradeName], ["السجل التجاري", row.commercialReg],
              ["الرقم الضريبي", row.taxNumber], ["الدولة / المدينة", [row.country, row.city].filter(Boolean).join(" / ")],
              ["الجوال", row.phone], ["البريد", row.email], ["نوع النشاط", row.activityType],
              ["المسؤول", row.contactName], ["جوال المسؤول", row.contactPhone],
              ["نوع التشغيل", RUN_TYPE_CFG[row.runType]?.label ?? row.runType],
            ].filter(([, v]) => v).map(([l, v]) => (
              <div key={l as string} className="flex justify-between border-b pb-1.5" style={{ borderColor: BORDER }}>
                <span className="font-bold" style={{ color: GOLD }}>{l}</span>
                <span className="font-semibold" style={{ color: NAVY2 }}>{v}</span>
              </div>
            ))}
          </div>
        ),
      });
    }
  };

  const filterSelectCls = `px-3 py-2 rounded-xl border text-[13px] font-semibold outline-none bg-white`;

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-black" style={{ color: NAVY2 }}>
            العملاء
            <span className="mr-2 text-[14px] font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(201,168,76,0.12)", color: GOLD }}>
              {clientsQ.data?.length ?? 0}
            </span>
          </h2>
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[14px] font-extrabold transition-all hover:opacity-90 shadow-md"
            style={{ backgroundColor: NAVY2 }}>
            <Plus className="w-4 h-4" /> إنشاء عميل جديد
          </button>
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white flex-1 min-w-52" style={{ borderColor: BORDER }}>
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم، كود المؤسسة، الرقم الضريبي..."
              className="flex-1 bg-transparent text-[14px] outline-none text-right" style={{ color: NAVY2 }} />
            {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
          </div>
          <select value={filterRun} onChange={e => setFilterRun(e.target.value)}
            className={filterSelectCls} style={{ borderColor: BORDER, color: filterRun ? NAVY2 : "#9CA3AF" }}>
            <option value="">كل أنواع التشغيل</option>
            <option value="desktop">Desktop</option>
            <option value="web">Web / Online</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <select value={filterLic} onChange={e => setFilterLic(e.target.value)}
            className={filterSelectCls} style={{ borderColor: BORDER, color: filterLic ? NAVY2 : "#9CA3AF" }}>
            <option value="">كل أنواع الترخيص</option>
            <option value="trial">تجريبي</option>
            <option value="subscription">اشتراك</option>
            <option value="lifetime">دائم</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className={filterSelectCls} style={{ borderColor: BORDER, color: filterStatus ? NAVY2 : "#9CA3AF" }}>
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="trial">تجريبي</option>
            <option value="expiring_soon">قريب الانتهاء</option>
            <option value="expired">منتهي</option>
            <option value="suspended">موقوف</option>
            <option value="inactive">غير مفعل</option>
          </select>
          {(filterRun || filterLic || filterStatus) && (
            <button onClick={() => { setFilterRun(""); setFilterLic(""); setFilterStatus(""); }}
              className="px-3 py-2 rounded-xl border text-[12px] font-bold transition-colors hover:bg-gray-50"
              style={{ borderColor: BORDER, color: "#6B7280" }}>مسح الفلاتر</button>
          )}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: BORDER }}>
        {clientsQ.isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-[15px] font-semibold animate-pulse" style={{ color: GOLD }}>جارٍ التحميل...</div>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Users className="w-12 h-12 opacity-20" style={{ color: NAVY2 }} />
            <p className="text-[15px] font-semibold" style={{ color: "#9CA3AF" }}>
              {search || filterRun || filterLic || filterStatus ? "لا توجد نتائج تطابق الفلاتر" : "لا يوجد عملاء بعد"}
            </p>
            {!search && !filterRun && !filterLic && !filterStatus && (
              <button onClick={() => setCreateOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[13px] font-bold"
                style={{ backgroundColor: NAVY2 }}>
                <Plus className="w-4 h-4" /> إنشاء أول عميل
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" style={{ minWidth: "1000px" }}>
              <thead>
                <tr style={{ backgroundColor: "#F9FAFB", borderBottom: `2px solid ${BORDER}` }}>
                  {["اسم المؤسسة", "كود المؤسسة", "نوع التشغيل", "نوع الترخيص", "الحالة", "انتهاء الترخيص", "المستخدمون", "الأجهزة", "إجراءات"].map(h => (
                    <th key={h} className="px-4 py-3 text-right font-extrabold text-[12px] uppercase tracking-wide" style={{ color: "#6B7280" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const status = computeStatus(row);
                  const days   = daysLeft(row.license?.expiryDate);
                  const isLast = i === rows.length - 1;
                  return (
                    <tr key={row.id} style={{ borderBottom: isLast ? "none" : `1px solid ${BORDER}` }}
                      className="hover:bg-gray-50 transition-colors">
                      {/* اسم المؤسسة */}
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="font-extrabold text-[14px]" style={{ color: NAVY2 }}>{row.name}</p>
                          {row.tradeName && <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>{row.tradeName}</p>}
                        </div>
                      </td>
                      {/* كود المؤسسة */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[12px] font-bold px-2 py-1 rounded-lg"
                          style={{ backgroundColor: "rgba(201,168,76,0.1)", color: GOLD }}>{row.orgId}</span>
                      </td>
                      {/* نوع التشغيل */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span style={{ color: NAVY2 }}>{RUN_TYPE_CFG[row.runType]?.icon}</span>
                          <span className="font-semibold" style={{ color: NAVY2 }}>
                            {row.runType === "desktop" ? "Desktop" : row.runType === "web" ? "Web" : "Hybrid"}
                          </span>
                        </div>
                      </td>
                      {/* نوع الترخيص */}
                      <td className="px-4 py-3.5">
                        {row.license ? (
                          <span className="font-bold" style={{ color: LIC_TYPE_CFG[row.license.licenseType]?.color ?? NAVY2 }}>
                            {LIC_TYPE_CFG[row.license.licenseType]?.label ?? row.license.licenseType}
                          </span>
                        ) : <span style={{ color: "#9CA3AF" }}>—</span>}
                      </td>
                      {/* الحالة */}
                      <td className="px-4 py-3.5"><StatusBadge status={status} /></td>
                      {/* انتهاء الترخيص */}
                      <td className="px-4 py-3.5">
                        {row.license?.expiryDate && row.license.licenseType !== "lifetime" ? (
                          <div>
                            <p className="font-semibold" style={{ color: days <= 30 ? "#DC2626" : NAVY2 }}>
                              {new Date(row.license.expiryDate + "T00:00:00").toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" })}
                            </p>
                            {days >= 0 && <p className="text-[11px] mt-0.5" style={{ color: days <= 30 ? "#DC2626" : "#9CA3AF" }}>
                              {days} يوم متبقي
                            </p>}
                          </div>
                        ) : row.license?.licenseType === "lifetime" ? (
                          <span className="text-[12px] font-bold text-green-600">دائم</span>
                        ) : <span style={{ color: "#9CA3AF" }}>—</span>}
                      </td>
                      {/* المستخدمون */}
                      <td className="px-4 py-3.5">
                        <span className="font-bold" style={{ color: NAVY2 }}>{row.license?.maxUsers ?? "—"}</span>
                      </td>
                      {/* الأجهزة */}
                      <td className="px-4 py-3.5">
                        <span className="font-bold" style={{ color: NAVY2 }}>{row.license?.maxDevices ?? "—"}</span>
                      </td>
                      {/* إجراءات */}
                      <td className="px-4 py-3.5">
                        <ActionsDropdown row={row} onAction={handleAction} onNavigate={onNavigate} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      {createOpen && (
        <CreateClientDialog
          modules={modulesQ.data ?? []}
          onClose={() => setCreateOpen(false)}
          onCreated={() => clientsQ.refetch()}
        />
      )}
      {renewRow && (
        <RenewDialog row={renewRow} onClose={() => setRenewRow(null)} onDone={() => clientsQ.refetch()} />
      )}
      {resultModal && (
        <ActionResultModal title={resultModal.title} onClose={() => setResultModal(null)}>
          {resultModal.content}
        </ActionResultModal>
      )}
    </div>
  );
}
