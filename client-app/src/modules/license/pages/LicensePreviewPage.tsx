// DEV ONLY — preview page for all 5 license states (no auth required)
// Remove this file and its route after screenshots are approved

import { useState } from "react";
import {
  ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion,
  Copy, Check, RefreshCw, KeyRound, FileUp,
  Users, GitBranch, MonitorSmartphone, Fingerprint,
  Globe, Monitor, WifiOff, Lock, CheckCircle2, XCircle,
  Terminal, UploadCloud, ClipboardCopy, Info,
  Timer, Infinity as InfinityIcon,
} from "lucide-react";

// ─── Mock data for each state ─────────────────────────────────────────────────
const MOCK_DEVICE_ID = "a8d1afc3-4440-4b2e-b85a-dcb910895602";
const MOCK_HW_FP     = "SHA256:3d4f8a1b9c2e7f05d6";

const MOCKS: Record<string, { status: MockStatus; label: string; color: string }> = {
  active: {
    label: "✅ ترخيص مفعّل (Subscription)",
    color: "bg-green-600",
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
    label: "🟡 نسخة تجريبية (Trial)",
    color: "bg-amber-500",
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
    label: "🔴 ترخيص منتهي (Expired)",
    color: "bg-red-600",
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
    label: "⚫ غير مفعّل (license_not_found)",
    color: "bg-slate-600",
    status: { valid: false, error: "license_not_found", payload: null },
  },
  invalid: {
    label: "🔴 ترخيص تالف (invalid_signature)",
    color: "bg-red-800",
    status: { valid: false, error: "invalid_signature", payload: null },
  },
};

interface MockPayload {
  org_id: string; customer_name: string;
  max_users: number; max_branches: number; max_pos: number; max_devices: number;
  enabled_modules: string[]; start_date: string; expiry_date: string;
  license_id: string; activation_id: string; issued_at: string; issued_by: string;
  license_type?: string; package_name?: string;
  web_allowed?: boolean; desktop_allowed?: boolean; offline_allowed?: boolean;
}
interface MockStatus {
  valid: boolean; error: string | null; payload: MockPayload | null;
}

// ─── Shared helpers from main page ───────────────────────────────────────────
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

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "2-digit" }); }
  catch { return d; }
}

function daysLeft(exp: string) {
  return Math.max(0, Math.ceil((new Date(exp + "T23:59:59Z").getTime() - Date.now()) / 86_400_000));
}

function LimitRow({ label, current, max, icon }: { label: string; current: number; max: number; icon: React.ReactNode }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const barColor = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-blue-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">{icon}<span>{label}</span></div>
        <div className="flex items-center gap-1">
          <span className="font-bold text-sm text-foreground">{current}</span>
          <span className="text-muted-foreground text-xs">/ {max}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{pct}% مستخدَم</span><span>{max - current} متاح</span>
      </div>
    </div>
  );
}

function BoolBadge({ label, value, icon }: { label: string; value?: boolean | null; icon: React.ReactNode }) {
  const on = value === true;
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium ${on ? "bg-green-50 border-green-200 text-green-800" : "bg-muted/50 border-border text-muted-foreground"}`}>
      <div className="flex items-center gap-2">{icon}<span>{label}</span></div>
      <span className={on ? "text-green-600" : ""}>{on ? "مفعّل" : "غير مفعّل"}</span>
    </div>
  );
}

function ModuleChip({ label, icon, enabled }: { label: string; icon: string; enabled: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border text-center ${enabled ? "bg-green-50 border-green-200" : "bg-muted/30 border-border opacity-55"}`}>
      <span className="text-lg leading-none">{icon}</span>
      <span className={`text-[9px] font-semibold leading-tight ${enabled ? "text-green-800" : "text-muted-foreground"}`}>{label}</span>
      {enabled ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Lock className="w-3 h-3 text-muted-foreground" />}
    </div>
  );
}

// ─── Main Preview Screen ───────────────────────────────────────────────────────
function LicenseScreen({ status }: { status: MockStatus }) {
  const p       = status.payload;
  const isValid = status.valid;
  const err     = status.error;
  const lt      = p?.license_type;
  const isTrial  = isValid && lt === "trial";
  const isActive = isValid && !isTrial;
  const isSlate  = !isValid && err === "license_not_found";
  const isExpired = !isValid && err === "expired";

  const gradient =
    isActive  ? "from-green-700 to-green-900"
    : isTrial  ? "from-amber-600 to-amber-800"
    : isExpired ? "from-red-600 to-red-900"
    : isSlate   ? "from-slate-600 to-slate-800"
    : "from-red-700 to-red-900";

  const statusLabel =
    isActive  ? "مفعّل"
    : isTrial  ? "نسخة تجريبية"
    : isExpired ? "انتهت الصلاحية"
    : isSlate   ? "غير مفعّل"
    : err === "invalid_signature" ? "ترخيص غير صالح"
    : "غير محدد";

  const alertMsg =
    isSlate   ? "البرنامج غير مفعّل. يرجى إدخال كود التفعيل أو استيراد ملف الترخيص."
    : isExpired && lt === "trial" ? "انتهت الفترة التجريبية. تواصل مع مزود النظام."
    : isExpired ? "انتهت صلاحية الترخيص. تواصل مع مزود النظام للتجديد."
    : err === "invalid_signature" ? "ملف الترخيص غير صالح أو تم تعديله. تواصل مع مزود النظام."
    : null;

  const days = p?.expiry_date && lt !== "lifetime" ? daysLeft(p.expiry_date) : null;
  const mods = new Set(p?.enabled_modules ?? []);
  const curUsers = isValid ? 4 : 0;
  const curBranches = isValid ? 1 : 0;
  const ShieldIcon = isActive ? ShieldCheck : isTrial ? ShieldCheck : isSlate ? ShieldQuestion : isExpired ? ShieldAlert : ShieldOff;

  return (
    <div className="w-full space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">الترخيص والتفعيل</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">إدارة ترخيص النظام وتفعيله والاطلاع على حالة الاشتراك</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5" /> تحديث الحالة
        </button>
      </div>

      {/* Status Card */}
      <div className={`w-full rounded-2xl bg-gradient-to-l ${gradient} shadow-lg overflow-hidden`}>
        <div className="p-5">
          <div className="flex items-stretch gap-6 flex-wrap">
            {/* Shield */}
            <div className="flex flex-col items-center justify-center gap-2.5 min-w-[100px]">
              <div className="w-20 h-20 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-inner">
                <ShieldIcon className="w-11 h-11 text-white drop-shadow-lg" />
              </div>
              <span className="text-xs font-bold bg-white/20 text-white border border-white/25 px-3 py-1 rounded-full">{statusLabel}</span>
              {lt && <span className="text-[10px] text-white/60">{lt === "trial" ? "فترة تجريبية" : lt === "lifetime" ? "ترخيص دائم" : "اشتراك"}</span>}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-[200px] text-white">
              {p ? (
                <>
                  <p className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">الباقة الحالية</p>
                  <h3 className="text-2xl font-black">{p.package_name ?? "Standard"}</h3>
                  <p className="text-sm text-white/70 mt-1 mb-3">{p.customer_name}</p>
                  <div className="grid grid-cols-3 gap-x-5 gap-y-3">
                    {[
                      { l: "Organization ID", v: p.org_id },
                      { l: "License ID", v: p.license_id },
                      { l: "Activation ID", v: p.activation_id },
                      { l: "Device ID", v: MOCK_DEVICE_ID },
                      { l: "تاريخ التفعيل", v: fmtDate(p.start_date) },
                      { l: "الجهة المصدرة", v: p.issued_by },
                    ].map(({ l, v }) => (
                      <div key={l}>
                        <p className="text-[9px] text-white/50 uppercase tracking-wide mb-0.5">{l}</p>
                        <p className="text-xs font-mono text-white/90 truncate">{v}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-2">
                  <h3 className="text-xl font-black text-white mb-1.5">{statusLabel}</h3>
                  {alertMsg && <p className="text-sm text-white/70">{alertMsg}</p>}
                  {isSlate && <p className="text-xs text-white/50 mt-2">سيتم عرض حدود الترخيص بعد التفعيل.</p>}
                </div>
              )}
            </div>

            {/* Days counter */}
            {p && (
              <div className="shrink-0 flex flex-col items-center justify-center gap-2 bg-white/10 border border-white/20 rounded-2xl px-6 py-4 min-w-[110px]">
                {lt === "lifetime" ? (
                  <><InfinityIcon className="w-10 h-10 text-white" /><span className="text-xs text-white/60">دائم</span></>
                ) : (
                  <>
                    <span className={`text-4xl font-black leading-none ${(days ?? 0) <= 7 ? "text-red-300" : (days ?? 0) <= 30 ? "text-amber-300" : "text-white"}`}>{days}</span>
                    <span className="text-[10px] text-white/50">يوم متبقٍّ</span>
                    <div className="w-full h-px bg-white/15" />
                    <span className="text-[10px] text-white/50 font-mono">{fmtDate(p.expiry_date)}</span>
                    {days !== null && days <= 30 && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${(days ?? 0) <= 7 ? "bg-red-500/30 text-red-200" : "bg-amber-500/30 text-amber-200"}`}>
                        {(days ?? 0) <= 7 ? "⚠ عاجل" : "قريبًا"}
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {alertMsg && (
          <div className="flex items-center gap-2 px-5 py-2.5 bg-black/20 text-white/90 text-xs border-t border-white/10">
            <Info className="w-3.5 h-3.5 text-white/60 shrink-0" />{alertMsg}
          </div>
        )}
        {isTrial && (
          <div className="flex items-center gap-2 px-5 py-2 bg-amber-500/20 text-amber-200 text-xs border-t border-amber-400/20">
            <Timer className="w-3.5 h-3.5 shrink-0" />هذه نسخة تجريبية محدودة — قابلة للتحديث إلى ترخيص كامل
          </div>
        )}
      </div>

      {/* 3-col grid */}
      <div className="grid grid-cols-3 gap-4 w-full">
        {/* Limits */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <span className="text-base">🏅</span><span className="font-semibold text-sm">حدود الترخيص</span>
          </div>
          {p ? (
            <>
              <div className="space-y-4">
                <LimitRow label="المستخدمون" current={curUsers}    max={p.max_users}    icon={<Users className="w-3.5 h-3.5" />} />
                <LimitRow label="الفروع"      current={curBranches} max={p.max_branches} icon={<GitBranch className="w-3.5 h-3.5" />} />
                <LimitRow label="نقاط البيع"  current={0}           max={p.max_pos}      icon={<MonitorSmartphone className="w-3.5 h-3.5" />} />
                <LimitRow label="الأجهزة"     current={0}           max={p.max_devices}  icon={<Fingerprint className="w-3.5 h-3.5" />} />
              </div>
              <div className="space-y-1.5 pt-2 border-t border-border">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-2">صلاحيات الوصول</p>
                <BoolBadge label="واجهة الويب" value={p.web_allowed} icon={<Globe className="w-3.5 h-3.5" />} />
                <BoolBadge label="سطح المكتب" value={p.desktop_allowed ?? true} icon={<Monitor className="w-3.5 h-3.5" />} />
                <BoolBadge label="وضع الأوفلاين" value={p.offline_allowed} icon={<WifiOff className="w-3.5 h-3.5" />} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
              <Lock className="w-10 h-10 opacity-20" />
              <div className="text-center">
                <p className="text-sm font-medium">لا يوجد ترخيص مفعّل</p>
                <p className="text-xs mt-0.5 opacity-70">سيتم عرض حدود الترخيص بعد التفعيل</p>
              </div>
            </div>
          )}
        </div>

        {/* Modules */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <span className="text-base">📦</span>
            <span className="font-semibold text-sm">الموديولات المفعّلة</span>
            {p && <span className="mr-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{mods.size} / {MODULES.length}</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MODULES.map(m => <ModuleChip key={m.id} label={m.label} icon={m.icon} enabled={!!p && mods.has(m.id)} />)}
          </div>
          {!p && <p className="text-center text-xs text-muted-foreground pt-1">فعّل الترخيص لرؤية الموديولات المتاحة</p>}
        </div>

        {/* Activation */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <span className="text-base">🔑</span><span className="font-semibold text-sm">تفعيل الترخيص</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { icon: <Terminal className="w-4 h-4" />, l1: "إدخال كود", l2: "التفعيل", active: true },
              { icon: <UploadCloud className="w-4 h-4" />, l1: "استيراد", l2: "license.ons", active: false },
              { icon: <ClipboardCopy className="w-4 h-4" />, l1: "توليد", l2: "كود الطلب", active: false },
            ].map((t, i) => (
              <div key={i} className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-center text-[10px] font-semibold ${t.active ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border text-muted-foreground"}`}>
                {t.icon}<span>{t.l1}</span><span className="opacity-80">{t.l2}</span>
              </div>
            ))}
          </div>
          <label className="text-xs text-muted-foreground block">أدخل كود التفعيل الذي حصلت عليه من دعم OneSoft ERP.</label>
          <div className="w-full h-24 bg-muted rounded-lg border border-border text-[10px] text-muted-foreground flex items-center justify-center">الصق كود التفعيل هنا...</div>
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

      {/* Device info strip */}
      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Fingerprint className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">معلومات الجهاز (هذا الجهاز)</span>
          </div>
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Device ID</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-muted px-3 py-2.5 rounded-lg border border-border">{MOCK_DEVICE_ID}</code>
            <button className="p-2.5 rounded-lg border border-border text-muted-foreground"><Copy className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-2 text-xs mt-1">
            {isValid ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span className="text-green-700">الجهاز مرتبط بترخيص صالح</span></> : <><XCircle className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-muted-foreground">الجهاز غير مرتبط بأي ترخيص</span></>}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <ClipboardCopy className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Request Code — كود الطلب</span>
          </div>
          <div className="flex flex-col items-center justify-center py-4 gap-2 text-center">
            <ClipboardCopy className="w-7 h-7 text-muted-foreground opacity-30" />
            <p className="text-xs text-muted-foreground">كود الطلب يُرسَل لفريق الدعم للحصول على ترخيص مناسب.</p>
            <button className="border border-border rounded-lg text-xs py-1.5 px-3 text-muted-foreground flex items-center gap-1.5">
              <ClipboardCopy className="w-3.5 h-3.5" />توليد كود الطلب
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Preview Wrapper Page (accessible without auth) ───────────────────────────
export default function LicensePreviewPage() {
  const hash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
  const initState = (hash in MOCKS ? hash : "active") as keyof typeof MOCKS;
  const [active, setActive] = useState<keyof typeof MOCKS>(initState);

  return (
    <div className="min-h-screen bg-muted/30 p-4" dir="rtl">
      {/* Dev Banner */}
      <div className="w-full mb-4 bg-yellow-100 border border-yellow-400 text-yellow-900 rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2">
        ⚠️ صفحة معاينة تطويرية — لن تظهر في نسخة الإنتاج — لإغلاقها احذف هذا المسار من App.tsx
      </div>

      {/* State Selector */}
      <div className="w-full mb-5 flex gap-2 flex-wrap">
        {Object.entries(MOCKS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setActive(k as keyof typeof MOCKS)}
            className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
              active === k
                ? `${v.color} text-white border-transparent shadow`
                : "bg-card border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Screen */}
      <div className="bg-background rounded-xl border border-border shadow-xl p-4 overflow-auto" style={{ minHeight: "calc(100vh - 160px)" }}>
        <LicenseScreen status={MOCKS[active].status} />
      </div>
    </div>
  );
}
