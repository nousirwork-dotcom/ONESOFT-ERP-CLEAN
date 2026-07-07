// DEV ONLY — Customer License Activation Screen preview
// This file is excluded from production builds (import.meta.env.DEV guard in App.tsx)
import { useState } from "react";
import {
  ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion,
  Copy, Check, RefreshCw, KeyRound, FileUp,
  Users, GitBranch, MonitorSmartphone, Fingerprint,
  Globe, Monitor, WifiOff, Lock, CheckCircle2, XCircle,
  UploadCloud, ClipboardCopy, Info, Timer,
  Infinity as InfinityIcon, AlertTriangle, Phone,
} from "lucide-react";

const MOCK_DID = "a8d1afc3-4440-4b2e-b85a-dcb910895602";
const MODULES = [
  { id: "sales",         label: "المبيعات",        icon: "🛒" },
  { id: "purchases",     label: "المشتريات",       icon: "📦" },
  { id: "inventory",     label: "المخزون",         icon: "🏪" },
  { id: "accounting",    label: "الحسابات",        icon: "📊" },
  { id: "pos",           label: "نقاط البيع",      icon: "🖥️" },
  { id: "reports",       label: "التقارير",        icon: "📈" },
  { id: "zatca",         label: "ZATCA",           icon: "🏛️" },
  { id: "hr",            label: "الموارد البشرية", icon: "👥" },
  { id: "manufacturing", label: "التصنيع",         icon: "⚙️" },
];

interface MockPayload {
  org_id: string; customer_name: string; package_name: string;
  max_users: number; max_branches: number; max_pos: number; max_devices: number;
  enabled_modules: string[]; start_date: string; expiry_date: string;
  license_id: string; activation_id: string; issued_by: string;
  license_type?: string; device_id?: string;
  web_allowed?: boolean; desktop_allowed?: boolean; offline_allowed?: boolean;
}
interface MockStatus { valid: boolean; error: string | null; payload: MockPayload | null; }

const MOCKS: Record<string, { label: string; status: MockStatus }> = {
  inactive: {
    label: "⚫ غير مفعّل",
    status: { valid: false, error: "license_not_found", payload: null },
  },
  trial: {
    label: "🟡 فترة تجريبية",
    status: {
      valid: true, error: null,
      payload: {
        org_id: "ORG-TRIAL-0001", customer_name: "مؤسسة الاختبار التجريبية",
        package_name: "Trial 30 يوم",
        max_users: 3, max_branches: 1, max_pos: 1, max_devices: 2,
        enabled_modules: ["sales","purchases","inventory","accounting"],
        start_date: "2026-07-01", expiry_date: "2026-07-22",
        license_id: "TRL-2026-0001", activation_id: "ACT-TRIAL-001",
        issued_by: "OneSoft ERP", license_type: "trial", device_id: MOCK_DID,
        desktop_allowed: true, web_allowed: false, offline_allowed: false,
      },
    },
  },
  subscription: {
    label: "✅ اشتراك مفعّل",
    status: {
      valid: true, error: null,
      payload: {
        org_id: "ORG-2026-XRAY", customer_name: "شركة النخبة للتجارة",
        package_name: "Professional",
        max_users: 10, max_branches: 3, max_pos: 5, max_devices: 5,
        enabled_modules: ["sales","purchases","inventory","accounting","pos","reports","zatca"],
        start_date: "2026-07-07", expiry_date: "2027-07-07",
        license_id: "LIC-2026-ABCD-1234", activation_id: "ACT-7F3A9B2C",
        issued_by: "OneSoft ERP", license_type: "subscription", device_id: MOCK_DID,
        desktop_allowed: true, web_allowed: false, offline_allowed: true,
      },
    },
  },
  lifetime: {
    label: "🔵 ترخيص دائم",
    status: {
      valid: true, error: null,
      payload: {
        org_id: "ORG-2026-PERM", customer_name: "مجموعة الأفق التجارية",
        package_name: "Enterprise Lifetime",
        max_users: 50, max_branches: 10, max_pos: 20, max_devices: 30,
        enabled_modules: ["sales","purchases","inventory","accounting","pos","reports","zatca","hr","manufacturing"],
        start_date: "2026-01-01", expiry_date: "2099-12-31",
        license_id: "LIC-PERM-2026-001", activation_id: "ACT-PERM-001",
        issued_by: "OneSoft ERP", license_type: "lifetime", device_id: MOCK_DID,
        desktop_allowed: true, web_allowed: true, offline_allowed: true,
      },
    },
  },
  expired: {
    label: "🔴 اشتراك منتهٍ",
    status: {
      valid: false, error: "expired",
      payload: {
        org_id: "ORG-2026-XRAY", customer_name: "شركة النخبة للتجارة",
        package_name: "Professional",
        max_users: 10, max_branches: 3, max_pos: 5, max_devices: 5,
        enabled_modules: ["sales","purchases","inventory","accounting","pos"],
        start_date: "2026-01-01", expiry_date: "2026-06-30",
        license_id: "LIC-2026-ABCD-0001", activation_id: "ACT-EXPIRED",
        issued_by: "OneSoft ERP", license_type: "subscription", device_id: MOCK_DID,
        desktop_allowed: true, web_allowed: false, offline_allowed: true,
      },
    },
  },
  invalid: {
    label: "🔴 ترخيص غير صالح",
    status: { valid: false, error: "invalid_signature", payload: null },
  },
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "2-digit" }); }
  catch { return d; }
}
function daysLeft(exp: string) {
  return Math.max(0, Math.ceil((new Date(exp + "T23:59:59Z").getTime() - Date.now()) / 86_400_000));
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#C9A84C]/25 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}
function CardHeader({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[#C9A84C]/20 bg-[#FAF7F0]">
      <span className="text-[#1B2B5C]">{icon}</span>
      <span className="font-bold text-[#1B2B5C] text-sm">{title}</span>
      {badge && <span className="mr-auto">{badge}</span>}
    </div>
  );
}

function InfoCellNav({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] font-semibold text-white/45 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-mono text-white/90 truncate">{value ?? "—"}</span>
    </div>
  );
}

function LimitRow({ label, current, max, icon }: { label: string; current: number; max: number; icon: React.ReactNode }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const bar = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-[#1B2B5C]";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-[#4A5568] font-medium">{icon}<span>{label}</span></div>
        <div className="flex items-baseline gap-0.5">
          <span className="font-bold text-sm text-[#1B2B5C]">{current}</span>
          <span className="text-[#9CA3AF] text-xs"> / {max}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-[#E8E0D4] overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-[#9CA3AF]">
        <span>{pct}% مستخدَم</span><span>{Math.max(0,max-current)} متاح</span>
      </div>
    </div>
  );
}
function AccessBadge({ label, value, icon }: { label: string; value?: boolean | null; icon: React.ReactNode }) {
  const on = value === true;
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium ${on ? "bg-green-50 border-green-200 text-green-800" : "bg-[#FAF7F0] border-[#E8E0D4] text-[#9CA3AF]"}`}>
      <div className="flex items-center gap-2">{icon}<span>{label}</span></div>
      <span className={on ? "text-green-600 font-bold" : ""}>{on ? "✓" : "✕"}</span>
    </div>
  );
}
function ModuleChip({ label, icon, enabled }: { label: string; icon: string; enabled: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center ${enabled ? "bg-green-50 border-green-200" : "bg-[#FAF7F0] border-[#E8E0D4] opacity-60"}`}>
      <span className="text-xl leading-none">{icon}</span>
      <span className={`text-[9px] font-bold leading-tight ${enabled ? "text-green-800" : "text-[#9CA3AF]"}`}>{label}</span>
      {enabled ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Lock className="w-3 h-3 text-[#C9A84C]/60" />}
    </div>
  );
}

function LicenseScreen({ status }: { status: MockStatus }) {
  const p       = status.payload;
  const isValid = status.valid;
  const err     = status.error;
  const lt      = p?.license_type;
  const isTrial    = isValid && lt === "trial";
  const isLifetime = isValid && lt === "lifetime";
  const isActive   = isValid && !isTrial;
  const isSlate    = !isValid && err === "license_not_found";
  const isExpired  = !isValid && err === "expired";
  const isInvalid  = !isValid && (err === "invalid_signature" || err === "invalid_json");

  const days = p?.expiry_date && !isLifetime ? daysLeft(p.expiry_date) : null;
  const mods = new Set(p?.enabled_modules ?? []);
  const curUsers = isValid ? 4 : 0;
  const curBranches = isValid ? 1 : 0;

  const trialDuration = p?.start_date && p?.expiry_date && isTrial
    ? Math.ceil((new Date(p.expiry_date + "T23:59:59Z").getTime() - new Date(p.start_date + "T00:00:00Z").getTime()) / 86_400_000)
    : null;

  const bigTypeLabel =
    lt === "trial"    ? "فترة تجريبية"
    : lt === "lifetime" ? "ترخيص دائم"
    : isActive        ? "اشتراك مفعّل"
    : isExpired       ? "انتهت الصلاحية"
    : isSlate         ? "غير مفعّل"
    : isInvalid       ? "ترخيص غير صالح"
    : "غير محدد";

  const statusBadge =
    isActive && !isTrial ? { label: "مفعّل ✓",    cls: "bg-green-500/20 text-green-200 border-green-400/30" }
    : isTrial            ? { label: "تجريبي",      cls: "bg-[#C9A84C]/20 text-[#E8C97E] border-[#C9A84C]/30" }
    : isExpired          ? { label: "منتهٍ",        cls: "bg-red-400/20 text-red-200 border-red-400/30" }
    : isSlate            ? { label: "غير مفعّل",   cls: "bg-white/10 text-white/60 border-white/20" }
    : { label: "غير صالح",                          cls: "bg-red-400/20 text-red-200 border-red-400/30" };

  const ShieldIcon = (isActive && !isTrial) ? ShieldCheck : isTrial ? ShieldCheck : isSlate ? ShieldQuestion : isExpired ? ShieldAlert : ShieldOff;
  const daysColor = !days ? "text-white" : days <= 7 ? "text-red-300" : days <= 30 ? "text-[#E8C97E]" : "text-green-300";

  const statusMessage =
    isSlate   ? "البرنامج غير مفعّل. يرجى إدخال كود التفعيل أو استيراد ملف الترخيص للمتابعة."
    : isTrial ? "هذه نسخة تجريبية محدودة المدة."
    : isExpired ? "انتهت صلاحية الترخيص. يرجى التواصل مع مزود النظام للتجديد."
    : isInvalid ? "ملف الترخيص غير صالح أو تم تعديله. يرجى التواصل مع مزود النظام."
    : null;

  return (
    <div className="space-y-4 w-full" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1B2B5C] flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-[#1B2B5C] leading-none">الترخيص والتفعيل</h1>
            <p className="text-xs text-[#6B7280] mt-0.5">إدارة حالة ترخيص النظام وتفعيل النسخة</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#C9A84C]/30 bg-white text-[#1B2B5C] text-xs font-semibold shadow-sm">
          <RefreshCw className="w-3.5 h-3.5" /> تحديث الحالة
        </button>
      </div>

      {/* ── STATUS CARD ── */}
      <Card>
        {/* Navy header */}
        <div className="bg-[#1B2B5C] px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <ShieldIcon className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-semibold text-white/45 uppercase tracking-widest mb-0.5">نوع النسخة</p>
              <h2 className="text-2xl font-black text-white leading-none">{bigTypeLabel}</h2>
              {p && <p className="text-sm text-white/55 mt-0.5 font-medium">{p.package_name} — {p.customer_name}</p>}
            </div>
            <span className={`shrink-0 px-4 py-1.5 rounded-full border text-sm font-bold ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
            {p && (
              <div className="shrink-0 flex flex-col items-center justify-center gap-1 bg-white/8 border border-white/15 rounded-2xl px-5 py-3 min-w-[100px] text-center">
                {isLifetime ? (
                  <><InfinityIcon className="w-8 h-8 text-white" /><span className="text-[9px] text-white/50">ترخيص دائم</span></>
                ) : (
                  <>
                    <span className={`text-4xl font-black leading-none ${daysColor}`}>{days}</span>
                    <span className="text-[9px] text-white/45 font-medium">يوم متبقٍّ</span>
                    {days !== null && days <= 30 && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${days <= 7 ? "bg-red-400/25 text-red-200" : "bg-[#C9A84C]/25 text-[#E8C97E]"}`}>
                        {days <= 7 ? "⚠ عاجل" : "قريبًا"}
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* IDs grid */}
          {p && (
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
              <InfoCellNav label="Organization ID"  value={p.org_id} />
              <InfoCellNav label="License ID"       value={p.license_id} />
              <InfoCellNav label="Activation ID"    value={p.activation_id} />
              <InfoCellNav label="Device ID"        value={MOCK_DID} />
              <InfoCellNav label="تاريخ التفعيل"   value={fmtDate(p.start_date)} />
              <InfoCellNav label="تاريخ الانتهاء"  value={isLifetime ? "دائم" : fmtDate(p.expiry_date)} />
              <InfoCellNav label="الجهة المصدرة"   value={p.issued_by} />
              <InfoCellNav label="اسم المؤسسة"     value={p.customer_name} />
            </div>
          )}
        </div>

        {/* Error/empty body */}
        {!p && statusMessage && (
          <div className="px-6 py-5">
            <div className={`flex items-start gap-3 rounded-xl px-4 py-3.5 border ${isInvalid || isExpired ? "bg-red-50 border-red-200" : "bg-[#FAF7F0] border-[#C9A84C]/25"}`}>
              <Info className={`w-4 h-4 mt-0.5 shrink-0 ${isInvalid || isExpired ? "text-red-500" : "text-[#C9A84C]"}`} />
              <p className={`text-sm leading-relaxed ${isInvalid || isExpired ? "text-red-800" : "text-[#4A5568]"}`}>{statusMessage}</p>
            </div>
            {isInvalid && (
              <div className="mt-3 flex items-start gap-3 rounded-xl px-4 py-3 border bg-amber-50 border-amber-200">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">لا تحاول تعديل ملف الترخيص يدوياً — أي تعديل سيُبطل التوقيع الرقمي ويُوقف عمل النظام.</p>
              </div>
            )}
          </div>
        )}

        {/* Trial banner */}
        {isTrial && p && (
          <div className="border-t border-[#C9A84C]/20 bg-[#FFF8E8] px-6 py-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <Timer className="w-4 h-4 text-[#C9A84C] shrink-0" />
              <span className="text-sm font-bold text-[#8B6914]">تفاصيل الفترة التجريبية</span>
              <span className="text-xs text-[#C9A84C]/70 mr-auto">قابلة للتحديث إلى ترخيص كامل</span>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div><p className="text-[9px] text-[#C9A84C]/70 uppercase tracking-wider mb-0.5 font-semibold">مدة التجربة</p><p className="font-bold text-[#1B2B5C]">{trialDuration} يوم</p></div>
              <div><p className="text-[9px] text-[#C9A84C]/70 uppercase tracking-wider mb-0.5 font-semibold">تاريخ البداية</p><p className="font-semibold text-[#1B2B5C]">{fmtDate(p.start_date)}</p></div>
              <div><p className="text-[9px] text-[#C9A84C]/70 uppercase tracking-wider mb-0.5 font-semibold">تاريخ النهاية</p><p className="font-semibold text-[#1B2B5C]">{fmtDate(p.expiry_date)}</p></div>
              <div><p className="text-[9px] text-[#C9A84C]/70 uppercase tracking-wider mb-0.5 font-semibold">الأيام المتبقية</p><p className={`text-2xl font-black leading-none ${(days ?? 0) <= 7 ? "text-red-600" : (days ?? 0) <= 14 ? "text-amber-600" : "text-[#1B2B5C]"}`}>{days}</p></div>
            </div>
          </div>
        )}

        {/* Expired banner */}
        {isExpired && p && (
          <div className="border-t border-red-200 bg-red-50 px-6 py-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-sm font-bold text-red-800">انتهت صلاحية الترخيص</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div><p className="text-[9px] text-red-400/70 uppercase mb-0.5">تاريخ البداية</p><p className="font-semibold text-red-800">{fmtDate(p.start_date)}</p></div>
              <div><p className="text-[9px] text-red-400/70 uppercase mb-0.5">تاريخ الانتهاء</p><p className="font-semibold text-red-800">{fmtDate(p.expiry_date)}</p></div>
              <div><p className="text-[9px] text-red-400/70 uppercase mb-0.5">الإجراء المطلوب</p><p className="font-semibold text-red-800">التواصل مع مزود النظام</p></div>
            </div>
          </div>
        )}

        {/* Active success */}
        {isValid && !isTrial && (
          <div className="border-t border-green-200 bg-green-50 px-6 py-2.5 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <span className="text-sm font-semibold text-green-800">الترخيص مفعّل — جميع خدمات النظام تعمل بشكل طبيعي.</span>
          </div>
        )}
      </Card>

      {/* ── ROW 2: LIMITS + MODULES ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Limits */}
        <Card>
          <CardHeader icon={<span>🏅</span>} title="حدود الترخيص" />
          <div className="p-5">
            {p ? (
              <div className="space-y-5">
                <LimitRow label="المستخدمون" current={curUsers}    max={p.max_users}    icon={<Users className="w-3.5 h-3.5"/>} />
                <LimitRow label="الفروع"     current={curBranches} max={p.max_branches} icon={<GitBranch className="w-3.5 h-3.5"/>} />
                <LimitRow label="نقاط البيع" current={0}           max={p.max_pos}      icon={<MonitorSmartphone className="w-3.5 h-3.5"/>} />
                <LimitRow label="الأجهزة"    current={0}           max={p.max_devices}  icon={<Fingerprint className="w-3.5 h-3.5"/>} />
                <div className="pt-3 border-t border-[#C9A84C]/15">
                  <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-2">صلاحيات الوصول</p>
                  <div className="space-y-2">
                    <AccessBadge label="واجهة الويب"   value={p.web_allowed}             icon={<Globe className="w-3.5 h-3.5"/>} />
                    <AccessBadge label="سطح المكتب"    value={p.desktop_allowed ?? true}  icon={<Monitor className="w-3.5 h-3.5"/>} />
                    <AccessBadge label="وضع الأوفلاين" value={p.offline_allowed}          icon={<WifiOff className="w-3.5 h-3.5"/>} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Lock className="w-10 h-10 text-[#C9A84C]/30" />
                <p className="text-sm text-[#6B7280] font-medium text-center">سيتم عرض حدود الترخيص بعد التفعيل</p>
              </div>
            )}
          </div>
        </Card>

        {/* Modules */}
        <Card>
          <CardHeader
            icon={<span>📦</span>}
            title="الموديولات المفعّلة"
            badge={p ? <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">{new Set(p.enabled_modules).size} / {MODULES.length}</span> : undefined}
          />
          <div className="p-5">
            <div className="grid grid-cols-3 gap-2.5">
              {MODULES.map(m => <ModuleChip key={m.id} label={m.label} icon={m.icon} enabled={!!p && mods.has(m.id)} />)}
            </div>
            {!p && <p className="text-center text-xs text-[#9CA3AF] mt-3">فعّل الترخيص لعرض الموديولات المتاحة</p>}
          </div>
        </Card>
      </div>

      {/* ── ROW 3: ACTIVATION + DEVICE ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Activation */}
        <Card>
          <CardHeader icon={<KeyRound className="w-4 h-4"/>} title="تفعيل الترخيص" />
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label1: "إدخال كود", label2: "التفعيل",    active: true },
                { label1: "استيراد",  label2: "license.ons", active: false },
                { label1: "فترة",     label2: "تجريبية",    active: false },
              ].map((t, i) => (
                <div key={i} className={`flex flex-col items-center gap-0.5 py-2.5 px-2 rounded-xl border text-[10px] font-bold text-center ${
                  t.active ? "bg-[#1B2B5C] text-white border-[#1B2B5C]" : "bg-[#FAF7F0] border-[#C9A84C]/25 text-[#4A5568]"
                }`}>
                  <span>{t.label1}</span>
                  <span className={t.active ? "text-white/70" : "text-[#C9A84C]"}>{t.label2}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#6B7280]">أدخل كود التفعيل الذي حصلت عليه من مزود النظام.</p>
            <div className="w-full h-20 bg-[#FAF7F0] rounded-xl border border-[#C9A84C]/25 flex items-center justify-center text-xs text-[#9CA3AF]">
              الصق كود التفعيل هنا...
            </div>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B2B5C] text-white text-sm font-semibold">
              <KeyRound className="w-4 h-4" /> تفعيل الآن
            </button>
            {isValid && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                الترخيص مفعّل — لا حاجة لإعادة التفعيل.
              </div>
            )}
          </div>
        </Card>

        {/* Device info */}
        <Card>
          <CardHeader icon={<Fingerprint className="w-4 h-4"/>} title="معلومات الجهاز" />
          <div className="p-5 space-y-4">
            <div>
              <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1.5">Device ID</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-[#FAF7F0] border border-[#C9A84C]/25 rounded-xl px-3 py-2.5 text-[#1B2B5C] break-all">{MOCK_DID}</code>
                <button className="p-2.5 rounded-xl border border-[#C9A84C]/25 text-[#C9A84C]"><Copy className="w-4 h-4" /></button>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold ${
              isValid ? "bg-green-50 border-green-200 text-green-800" : "bg-[#FAF7F0] border-[#C9A84C]/25 text-[#6B7280]"
            }`}>
              {isValid
                ? <><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> الجهاز مرتبط بترخيص صالح</>
                : <><XCircle className="w-4 h-4 text-[#C9A84C]/50 shrink-0" /> الجهاز غير مرتبط بأي ترخيص نشط</>
              }
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider">كود الطلب</p>
                <button className="text-[10px] font-semibold text-[#1B2B5C] flex items-center gap-1"><RefreshCw className="w-3 h-3" /> توليد</button>
              </div>
              <div className="bg-[#FAF7F0] border border-[#C9A84C]/25 rounded-xl px-3 py-3 text-xs text-[#9CA3AF] text-center">
                اضغط «توليد» لإنشاء كود الطلب
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-[#FAF7F0] border border-[#C9A84C]/20 px-3 py-3 text-xs text-[#6B7280]">
              <Phone className="w-3.5 h-3.5 text-[#C9A84C] shrink-0 mt-0.5" />
              <span>أرسل Device ID لمزود النظام للحصول على ملف الترخيص.</span>
            </div>
          </div>
        </Card>
      </div>

    </div>
  );
}

export default function LicensePreviewPage() {
  const keys = Object.keys(MOCKS) as (keyof typeof MOCKS)[];
  const hash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
  const init = (keys.includes(hash as any) ? hash : "subscription") as keyof typeof MOCKS;
  const [active, setActive] = useState<keyof typeof MOCKS>(init);

  const colors: Record<string, string> = {
    inactive:     "bg-gray-600",
    trial:        "bg-[#C9A84C]",
    subscription: "bg-[#1B2B5C]",
    lifetime:     "bg-[#2D4A9C]",
    expired:      "bg-red-600",
    invalid:      "bg-red-800",
  };

  return (
    <div className="min-h-screen bg-[#F0EAD6] p-4" dir="rtl">
      <div className="w-full mb-4 bg-yellow-100 border border-yellow-400 text-yellow-900 rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2">
        ⚠️ صفحة معاينة تطويرية — غير متاحة في نسخة الإنتاج
      </div>
      <div className="flex gap-2 flex-wrap mb-5">
        {keys.map(k => (
          <button key={k} onClick={() => setActive(k)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
              active === k ? `${colors[k]} text-white border-transparent shadow-sm` : "bg-white border-[#C9A84C]/30 text-[#1B2B5C] hover:bg-[#FAF7F0]"
            }`}>
            {MOCKS[k].label}
          </button>
        ))}
      </div>
      <div className="bg-[#FAF7F0] rounded-2xl border border-[#C9A84C]/20 shadow-xl p-5 overflow-auto" style={{ minHeight: "calc(100vh - 160px)" }}>
        <LicenseScreen status={MOCKS[active].status} />
      </div>
    </div>
  );
}
