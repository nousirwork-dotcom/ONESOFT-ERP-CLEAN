// DEV ONLY — remove this file and its App.tsx route after screenshots are approved
import { useState } from "react";
import {
  ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion,
  Copy, Check, RefreshCw, KeyRound,
  Users, GitBranch, MonitorSmartphone, Fingerprint,
  Globe, Monitor, WifiOff, Lock, CheckCircle2, XCircle,
  Terminal, UploadCloud, ClipboardCopy, Info,
  Timer, Infinity as InfinityIcon, AlertTriangle,
} from "lucide-react";

const MOCK_DEVICE_ID = "a8d1afc3-4440-4b2e-b85a-dcb910895602";

const MODULES = [
  { id: "sales", label: "المبيعات", icon: "🛒" },
  { id: "purchases", label: "المشتريات", icon: "📦" },
  { id: "inventory", label: "المخزون", icon: "🏪" },
  { id: "accounting", label: "الحسابات", icon: "📊" },
  { id: "pos", label: "نقاط البيع", icon: "🖥️" },
  { id: "reports", label: "التقارير", icon: "📈" },
  { id: "zatca", label: "ZATCA", icon: "🏛️" },
  { id: "manufacturing", label: "التصنيع", icon: "⚙️" },
  { id: "hr", label: "الموارد البشرية", icon: "👥" },
];

interface MockPayload {
  org_id: string; customer_name: string;
  max_users: number; max_branches: number; max_pos: number; max_devices: number;
  enabled_modules: string[]; start_date: string; expiry_date: string;
  license_id: string; activation_id: string; issued_at: string; issued_by: string;
  license_type?: string; package_name?: string;
  web_allowed?: boolean; desktop_allowed?: boolean; offline_allowed?: boolean;
}
interface MockStatus { valid: boolean; error: string | null; payload: MockPayload | null; }

const MOCKS: Record<string, { label: string; color: string; status: MockStatus }> = {
  active: {
    label: "✅ Subscription — اشتراك سنوي مفعّل",
    color: "bg-green-700",
    status: {
      valid: true, error: null,
      payload: {
        org_id: "ORG-2026-XRAY", customer_name: "شركة النخبة للتجارة",
        max_users: 10, max_branches: 3, max_pos: 5, max_devices: 5,
        enabled_modules: ["sales","purchases","inventory","accounting","pos","reports","zatca"],
        start_date: "2026-07-07", expiry_date: "2027-07-07",
        license_id: "LIC-2026-ABCD-1234", activation_id: "ACT-7F3A9B2C",
        issued_at: "2026-07-07T00:00:00Z", issued_by: "OneSoft ERP",
        license_type: "subscription", package_name: "Professional",
        desktop_allowed: true, web_allowed: false, offline_allowed: true,
      },
    },
  },
  trial: {
    label: "🟡 Trial — نسخة تجريبية",
    color: "bg-amber-600",
    status: {
      valid: true, error: null,
      payload: {
        org_id: "ORG-TRIAL-0001", customer_name: "مؤسسة الاختبار التجريبية",
        max_users: 3, max_branches: 1, max_pos: 1, max_devices: 2,
        enabled_modules: ["sales","purchases","inventory","accounting"],
        start_date: "2026-07-01", expiry_date: "2026-07-22",
        license_id: "TRL-2026-0001", activation_id: "ACT-TRIAL-001",
        issued_at: "2026-07-01T00:00:00Z", issued_by: "OneSoft ERP",
        license_type: "trial", package_name: "Trial 30 يوم",
        desktop_allowed: true, web_allowed: false, offline_allowed: false,
      },
    },
  },
  expired: {
    label: "🔴 Expired — اشتراك منتهٍ",
    color: "bg-red-700",
    status: {
      valid: false, error: "expired",
      payload: {
        org_id: "ORG-2026-XRAY", customer_name: "شركة النخبة للتجارة",
        max_users: 10, max_branches: 3, max_pos: 5, max_devices: 5,
        enabled_modules: ["sales","purchases","inventory","accounting","pos"],
        start_date: "2026-01-01", expiry_date: "2026-06-30",
        license_id: "LIC-2026-ABCD-0001", activation_id: "ACT-EXPIRED",
        issued_at: "2026-01-01T00:00:00Z", issued_by: "OneSoft ERP",
        license_type: "subscription", package_name: "Professional",
        desktop_allowed: true, web_allowed: false, offline_allowed: true,
      },
    },
  },
  not_found: {
    label: "⚫ Not Found — غير مفعّل",
    color: "bg-slate-700",
    status: { valid: false, error: "license_not_found", payload: null },
  },
  invalid: {
    label: "🔴 Invalid — ترخيص غير صالح",
    color: "bg-red-900",
    status: { valid: false, error: "invalid_signature", payload: null },
  },
};

function fmtDate(d?: string | null, full = false) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: full ? "long" : "2-digit", day: "2-digit" }); }
  catch { return d; }
}
function daysLeft(exp: string) {
  return Math.max(0, Math.ceil((new Date(exp + "T23:59:59Z").getTime() - Date.now()) / 86_400_000));
}

function InfoCell({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] font-semibold text-white/45 uppercase tracking-wider">{label}</span>
      <span className="text-xs font-mono text-white/90 truncate">{value ?? "—"}</span>
    </div>
  );
}

function LimitRow({ label, current, max, icon }: { label: string; current: number; max: number; icon: React.ReactNode }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const bar = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-blue-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">{icon}<span>{label}</span></div>
        <div><span className="font-bold text-sm">{current}</span><span className="text-muted-foreground text-xs"> / {max}</span></div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} /></div>
      <div className="flex justify-between text-[10px] text-muted-foreground"><span>{pct}% مستخدَم</span><span>{Math.max(0,max-current)} متاح</span></div>
    </div>
  );
}

function BoolBadge({ label, value, icon }: { label: string; value?: boolean | null; icon: React.ReactNode }) {
  const on = value === true;
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium ${on ? "bg-green-50 border-green-200 text-green-800" : "bg-muted/50 border-border text-muted-foreground"}`}>
      <div className="flex items-center gap-2">{icon}<span>{label}</span></div>
      <span className={on ? "text-green-600" : ""}>{on ? "✓ مفعّل" : "✕ غير مفعّل"}</span>
    </div>
  );
}

function ModuleChip({ label, icon, enabled }: { label: string; icon: string; enabled: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border text-center ${enabled ? "bg-green-50 border-green-200" : "bg-muted/30 border-border opacity-50"}`}>
      <span className="text-lg leading-none">{icon}</span>
      <span className={`text-[9px] font-semibold leading-tight ${enabled ? "text-green-800" : "text-muted-foreground"}`}>{label}</span>
      {enabled ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Lock className="w-3 h-3 text-muted-foreground" />}
    </div>
  );
}

function LicenseScreen({ status }: { status: MockStatus }) {
  const p        = status.payload;
  const isValid  = status.valid;
  const err      = status.error;
  const lt       = p?.license_type;
  const isTrial  = isValid && lt === "trial";
  const isLifetime = isValid && lt === "lifetime";
  const isActive = isValid && !isTrial;
  const isSlate  = !isValid && err === "license_not_found";
  const isExpired = !isValid && err === "expired";
  const isInvalid = !isValid && (err === "invalid_signature" || err === "invalid_json");

  const days = p?.expiry_date && !isLifetime ? daysLeft(p.expiry_date) : null;
  const mods = new Set(p?.enabled_modules ?? []);
  const curUsers = isValid ? 4 : 0;
  const curBranches = isValid ? 1 : 0;

  const trialDuration = p?.start_date && p?.expiry_date && isTrial
    ? Math.ceil((new Date(p.expiry_date + "T23:59:59Z").getTime() - new Date(p.start_date + "T00:00:00Z").getTime()) / 86_400_000)
    : null;

  const bigTypeLabel =
    lt === "trial"        ? "نسخة تجريبية"
    : lt === "lifetime"   ? "ترخيص دائم"
    : lt === "subscription" && isValid ? "اشتراك سنوي"
    : isExpired && lt === "trial"      ? "نسخة تجريبية — منتهية"
    : isExpired           ? "اشتراك منتهٍ"
    : isSlate             ? "غير مفعّل"
    : isInvalid           ? "ترخيص غير صالح"
    : "غير محدد";

  const statusBadge = isActive
    ? { label: "مفعّل",           cls: "bg-white/20 text-white border-white/30" }
    : isTrial
    ? { label: "نشط",             cls: "bg-amber-300/20 text-amber-200 border-amber-300/30" }
    : isExpired
    ? { label: "انتهت الصلاحية", cls: "bg-red-300/20 text-red-200 border-red-300/30" }
    : isSlate
    ? { label: "غير مفعّل",      cls: "bg-white/10 text-white/70 border-white/20" }
    : { label: "غير صالح",        cls: "bg-red-300/20 text-red-200 border-red-300/30" };

  const gradient = isActive ? "from-green-700 to-green-900"
    : isTrial   ? "from-amber-600 to-amber-800"
    : isExpired ? "from-red-600 to-red-900"
    : isSlate   ? "from-slate-600 to-slate-800"
    : "from-red-700 to-red-900";

  const ShieldIcon = isActive ? ShieldCheck : isTrial ? ShieldCheck : isSlate ? ShieldQuestion : isExpired ? ShieldAlert : ShieldOff;
  const daysColor = !days ? "text-white" : days <= 7 ? "text-red-300" : days <= 30 ? "text-amber-300" : "text-white";

  return (
    <div className="w-full space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">الترخيص والتفعيل</h2>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5" /> تحديث الحالة
        </button>
      </div>

      {/* ── STATUS CARD ── */}
      <div className={`w-full rounded-2xl bg-gradient-to-l ${gradient} shadow-lg overflow-hidden`}>

        {/* TYPE HEADER */}
        <div className="flex items-center gap-4 px-5 pt-5 pb-4 border-b border-white/15">
          <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0 shadow-inner">
            <ShieldIcon className="w-8 h-8 text-white drop-shadow" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-white/45 uppercase tracking-widest mb-0.5">نوع النسخة</p>
            <h2 className="text-3xl font-black text-white leading-none tracking-tight">{bigTypeLabel}</h2>
            {p && (
              <p className="text-sm text-white/60 mt-1 font-medium">
                {p.package_name ?? "Standard"}{p.customer_name ? ` — ${p.customer_name}` : ""}
              </p>
            )}
          </div>
          <span className={`shrink-0 px-4 py-1.5 rounded-full border text-sm font-bold ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
          {p && (
            <div className="shrink-0 flex flex-col items-center justify-center gap-1 bg-white/10 border border-white/20 rounded-2xl px-5 py-3 min-w-[90px]">
              {isLifetime ? (
                <><InfinityIcon className="w-9 h-9 text-white" /><span className="text-[9px] text-white/50">دائم</span></>
              ) : (
                <>
                  <span className={`text-4xl font-black leading-none ${daysColor}`}>{days}</span>
                  <span className="text-[9px] text-white/50 text-center">يوم متبقٍّ</span>
                  {days !== null && days <= 30 && (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${days <= 7 ? "bg-red-400/30 text-red-200" : "bg-amber-400/30 text-amber-200"}`}>
                      {days <= 7 ? "⚠ عاجل" : "قريبًا"}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* IDs grid (when license exists) */}
        {p && (
          <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
            <InfoCell label="Organization ID"  value={p.org_id} />
            <InfoCell label="License ID"       value={p.license_id} />
            <InfoCell label="Activation ID"    value={p.activation_id} />
            <InfoCell label="Device ID"        value={MOCK_DEVICE_ID} />
            <InfoCell label="تاريخ البداية"   value={fmtDate(p.start_date, true)} />
            <InfoCell label="تاريخ الانتهاء"  value={isLifetime ? "دائم — لا ينتهي" : fmtDate(p.expiry_date, true)} />
            <InfoCell label="الجهة المصدرة"   value={p.issued_by} />
            <InfoCell label="تاريخ الإصدار"   value={fmtDate(p.issued_at?.slice(0,10), true)} />
          </div>
        )}

        {/* Error states */}
        {!p && (
          <div className="px-5 py-5">
            {isSlate && (
              <div className="space-y-3">
                <div>
                  <p className="text-xl font-black text-white">البرنامج غير مفعّل</p>
                  <p className="text-sm text-white/75 mt-1">يرجى إدخال كود التفعيل أو استيراد ملف الترخيص من مزود النظام.</p>
                </div>
                <div className="flex items-start gap-2 bg-white/10 border border-white/15 rounded-xl px-4 py-3">
                  <Info className="w-4 h-4 text-white/50 mt-0.5 shrink-0" />
                  <p className="text-xs text-white/65 leading-relaxed">
                    في نسخة الإنتاج لن يتم السماح باستخدام النظام بدون ترخيص صالح
                    أو فترة تجريبية موقّعة. التجريب المفتوح يعمل في وضع التطوير فقط.
                  </p>
                </div>
              </div>
            )}
            {isInvalid && (
              <div className="space-y-3">
                <div>
                  <p className="text-xl font-black text-white">ملف الترخيص غير صالح أو تم تعديله</p>
                  <p className="text-sm text-white/75 mt-1">يرجى التواصل مع مزود النظام للحصول على ملف ترخيص صالح.</p>
                </div>
                <div className="flex items-start gap-2 bg-red-500/15 border border-red-300/20 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-red-300 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-200/80 leading-relaxed">
                    لا تحاول تعديل ملف الترخيص يدوياً. أي تعديل سيُبطل التوقيع الرقمي ويُوقف عمل النظام.
                  </p>
                </div>
              </div>
            )}
            {isExpired && (
              <div className="space-y-2">
                <p className="text-xl font-black text-white">انتهت صلاحية الترخيص</p>
                <p className="text-sm text-white/75">تواصل مع مزود النظام لتجديد الاشتراك.</p>
              </div>
            )}
          </div>
        )}

        {/* Trial banner */}
        {isTrial && p && (
          <div className="border-t border-amber-400/20 bg-amber-500/15 px-5 py-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <Timer className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="text-sm font-bold text-amber-100">تفاصيل الفترة التجريبية</span>
              <span className="text-xs text-amber-200/60 mr-auto">هذه نسخة تجريبية محدودة — قابلة للتحديث إلى ترخيص كامل</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-[9px] text-amber-200/50 uppercase tracking-wider mb-0.5">مدة التجربة</p>
                <p className="text-sm font-bold text-amber-100">{trialDuration} يوم</p>
              </div>
              <div>
                <p className="text-[9px] text-amber-200/50 uppercase tracking-wider mb-0.5">بداية التجربة</p>
                <p className="text-sm font-bold text-amber-100">{fmtDate(p.start_date, true)}</p>
              </div>
              <div>
                <p className="text-[9px] text-amber-200/50 uppercase tracking-wider mb-0.5">نهاية التجربة</p>
                <p className="text-sm font-bold text-amber-100">{fmtDate(p.expiry_date, true)}</p>
              </div>
              <div>
                <p className="text-[9px] text-amber-200/50 uppercase tracking-wider mb-0.5">الأيام المتبقية</p>
                <p className={`text-xl font-black leading-none ${daysColor}`}>{days} <span className="text-sm font-medium text-amber-200/70">يوم</span></p>
              </div>
            </div>
          </div>
        )}

        {/* Expired banner (when payload exists) */}
        {isExpired && p && (
          <div className="border-t border-red-400/20 bg-red-500/15 px-5 py-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />
              <span className="text-sm font-bold text-red-100">الترخيص منتهٍ</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div><p className="text-[9px] text-red-200/50 uppercase mb-0.5">تاريخ البداية</p><p className="text-red-100 font-medium">{fmtDate(p.start_date, true)}</p></div>
              <div><p className="text-[9px] text-red-200/50 uppercase mb-0.5">تاريخ الانتهاء</p><p className="text-red-100 font-medium">{fmtDate(p.expiry_date, true)}</p></div>
              <div><p className="text-[9px] text-red-200/50 uppercase mb-0.5">الحالة</p><p className="text-red-200 font-bold">انتهى</p></div>
            </div>
            <p className="text-xs text-red-200/70 mt-2">تواصل مع مزود النظام لتجديد الاشتراك.</p>
          </div>
        )}
      </div>

      {/* ── 3-col grid ── */}
      <div className="grid grid-cols-3 gap-4 w-full">
        {/* Limits */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border"><span>🏅</span><span className="font-semibold text-sm">حدود الترخيص</span></div>
          {p ? (
            <>
              <div className="space-y-4">
                <LimitRow label="المستخدمون" current={curUsers}    max={p.max_users}    icon={<Users className="w-3.5 h-3.5"/>} />
                <LimitRow label="الفروع"      current={curBranches} max={p.max_branches} icon={<GitBranch className="w-3.5 h-3.5"/>} />
                <LimitRow label="نقاط البيع"  current={0}           max={p.max_pos}      icon={<MonitorSmartphone className="w-3.5 h-3.5"/>} />
                <LimitRow label="الأجهزة"     current={0}           max={p.max_devices}  icon={<Fingerprint className="w-3.5 h-3.5"/>} />
              </div>
              <div className="space-y-1.5 pt-2 border-t border-border">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">صلاحيات الوصول</p>
                <BoolBadge label="واجهة الويب"   value={p.web_allowed}            icon={<Globe className="w-3.5 h-3.5"/>} />
                <BoolBadge label="سطح المكتب"    value={p.desktop_allowed ?? true} icon={<Monitor className="w-3.5 h-3.5"/>} />
                <BoolBadge label="وضع الأوفلاين" value={p.offline_allowed}         icon={<WifiOff className="w-3.5 h-3.5"/>} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
              <Lock className="w-10 h-10 opacity-20" />
              <div className="text-center"><p className="text-sm font-medium">لا يوجد ترخيص مفعّل</p><p className="text-xs opacity-70 mt-0.5">سيتم عرض حدود الترخيص بعد التفعيل</p></div>
            </div>
          )}
        </div>

        {/* Modules */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <span>📦</span><span className="font-semibold text-sm">الموديولات المفعّلة</span>
            {p && <span className="mr-auto text-xs font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">{mods.size} / {MODULES.length}</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MODULES.map(m => <ModuleChip key={m.id} label={m.label} icon={m.icon} enabled={!!p && mods.has(m.id)} />)}
          </div>
          {!p && <p className="text-center text-xs text-muted-foreground">فعّل الترخيص لرؤية الموديولات المتاحة</p>}
        </div>

        {/* Activation */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border"><span>🔑</span><span className="font-semibold text-sm">تفعيل الترخيص</span></div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { icon: <Terminal className="w-4 h-4"/>, l1: "إدخال كود", l2: "التفعيل", active: true },
              { icon: <UploadCloud className="w-4 h-4"/>, l1: "استيراد", l2: "license.ons", active: false },
              { icon: <ClipboardCopy className="w-4 h-4"/>, l1: "توليد", l2: "كود الطلب", active: false },
            ].map((t, i) => (
              <div key={i} className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-center text-[10px] font-semibold ${t.active ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border text-muted-foreground"}`}>
                {t.icon}<span>{t.l1}</span><span className="opacity-75">{t.l2}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground border border-dashed border-border rounded-lg px-3 py-2 leading-relaxed">
            ملاحظة: التفعيل التجريبي يتطلب ملف ترخيص موقّع من License Center — لا يوجد تجربة مفتوحة من هنا.
          </div>
          <label className="text-xs text-muted-foreground block">أدخل كود التفعيل الذي حصلت عليه من مزود النظام.</label>
          <div className="w-full h-20 bg-muted rounded-lg border border-border text-[10px] text-muted-foreground flex items-center justify-center px-3">الصق كود التفعيل هنا...</div>
          <button className="w-full bg-primary text-primary-foreground text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 font-semibold">
            <KeyRound className="w-4 h-4" />تفعيل الآن
          </button>
          {isValid && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />الترخيص مفعّل — جميع الخدمات تعمل بشكل طبيعي.
            </div>
          )}
        </div>
      </div>

      {/* Device strip */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-border"><Fingerprint className="w-4 h-4 text-primary"/><span className="font-semibold text-sm">معلومات الجهاز الحالي</span></div>
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Device ID</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-muted px-3 py-2.5 rounded-lg border border-border">{MOCK_DEVICE_ID}</code>
            <button className="p-2.5 rounded-lg border border-border text-muted-foreground"><Copy className="w-4 h-4"/></button>
          </div>
          <div className="flex items-center gap-2 text-xs pt-1">
            {isValid ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500"/><span className="text-green-700">الجهاز مرتبط بترخيص صالح</span></> : <><XCircle className="w-3.5 h-3.5 text-muted-foreground"/><span className="text-muted-foreground">الجهاز غير مرتبط بأي ترخيص نشط</span></>}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-border"><ClipboardCopy className="w-4 h-4 text-primary"/><span className="font-semibold text-sm">Request Code — كود الطلب</span></div>
          <div className="flex flex-col items-center justify-center py-4 gap-2 text-center">
            <ClipboardCopy className="w-7 h-7 text-muted-foreground opacity-25"/>
            <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed">كود الطلب يُرسَل لمزود النظام للحصول على ملف الترخيص.</p>
            <button className="border border-border rounded-lg text-xs py-1.5 px-3 text-muted-foreground flex items-center gap-1.5"><ClipboardCopy className="w-3.5 h-3.5"/>توليد كود الطلب</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LicensePreviewPage() {
  const hash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
  const initState = (hash in MOCKS ? hash : "active") as keyof typeof MOCKS;
  const [active, setActive] = useState<keyof typeof MOCKS>(initState);

  return (
    <div className="min-h-screen bg-muted/30 p-4" dir="rtl">
      <div className="w-full mb-4 bg-yellow-100 border border-yellow-400 text-yellow-900 rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2">
        ⚠️ صفحة معاينة تطويرية — لن تظهر في نسخة الإنتاج
      </div>
      <div className="flex gap-2 flex-wrap mb-5">
        {Object.entries(MOCKS).map(([k, v]) => (
          <button key={k} onClick={() => setActive(k as keyof typeof MOCKS)}
            className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${active === k ? `${v.color} text-white border-transparent shadow` : "bg-card border-border text-muted-foreground hover:bg-accent"}`}>
            {v.label}
          </button>
        ))}
      </div>
      <div className="bg-background rounded-xl border border-border shadow-xl p-4 overflow-auto" style={{ minHeight: "calc(100vh - 160px)" }}>
        <LicenseScreen status={MOCKS[active].status} />
      </div>
    </div>
  );
}
