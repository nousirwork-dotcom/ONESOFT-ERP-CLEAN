// DEV ONLY — Customer License Activation Screen (6-state preview with sidebar)
// Excluded from production builds via import.meta.env.DEV guard in App.tsx
import { useState, useEffect } from "react";
import {
  ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion,
  Copy, Check, RefreshCw, KeyRound, FileUp,
  Users, GitBranch, MonitorSmartphone, Fingerprint,
  Globe, Monitor, WifiOff, Lock, CheckCircle2, XCircle,
  Timer, Phone, AlertTriangle, Info,
  Infinity as InfinityIcon, UploadCloud, ClipboardCopy,
  LayoutDashboard, ShoppingCart, Package, Archive,
  BarChart3, Settings, HelpCircle, ChevronLeft,
} from "lucide-react";

const MOCK_DID = "a8d1afc3-4440-4b2e-b85a-dcb910895602";
const MOCK_ORG = "شركة النخبة للتجارة";

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
  license_type: string;
  web_allowed?: boolean; desktop_allowed?: boolean; offline_allowed?: boolean;
}
interface MockStatus { valid: boolean; error: string | null; payload: MockPayload | null }

const MOCKS: Record<string, { label: string; btnColor: string; status: MockStatus }> = {
  inactive: {
    label: "⚫ غير مفعّل", btnColor: "bg-gray-600",
    status: { valid: false, error: "license_not_found", payload: null },
  },
  trial: {
    label: "🟡 فترة تجريبية", btnColor: "bg-[#C9A84C]",
    status: {
      valid: true, error: null,
      payload: {
        org_id: "ORG-TRIAL-0001", customer_name: "مؤسسة الاختبار التجريبية",
        package_name: "Trial 30 يوم",
        max_users: 3, max_branches: 1, max_pos: 1, max_devices: 2,
        enabled_modules: ["sales", "purchases", "inventory", "accounting"],
        start_date: "2026-07-01", expiry_date: "2026-07-22",
        license_id: "TRL-2026-0001", activation_id: "ACT-TRIAL-001",
        issued_by: "OneSoft ERP", license_type: "trial",
        desktop_allowed: true, web_allowed: false, offline_allowed: false,
      },
    },
  },
  subscription: {
    label: "✅ اشتراك مفعّل", btnColor: "bg-[#1B2B5C]",
    status: {
      valid: true, error: null,
      payload: {
        org_id: "ORG-2026-XRAY", customer_name: MOCK_ORG,
        package_name: "Professional",
        max_users: 10, max_branches: 3, max_pos: 5, max_devices: 5,
        enabled_modules: ["sales", "purchases", "inventory", "accounting", "pos", "reports", "zatca"],
        start_date: "2026-07-07", expiry_date: "2027-07-07",
        license_id: "LIC-2026-ABCD-1234", activation_id: "ACT-7F3A9B2C",
        issued_by: "OneSoft ERP", license_type: "subscription",
        desktop_allowed: true, web_allowed: false, offline_allowed: true,
      },
    },
  },
  lifetime: {
    label: "🔵 ترخيص دائم", btnColor: "bg-[#2D4A9C]",
    status: {
      valid: true, error: null,
      payload: {
        org_id: "ORG-2026-PERM", customer_name: "مجموعة الأفق التجارية",
        package_name: "Enterprise Lifetime",
        max_users: 50, max_branches: 10, max_pos: 20, max_devices: 30,
        enabled_modules: ["sales", "purchases", "inventory", "accounting", "pos", "reports", "zatca", "hr", "manufacturing"],
        start_date: "2026-01-01", expiry_date: "2099-12-31",
        license_id: "LIC-PERM-2026-001", activation_id: "ACT-PERM-001",
        issued_by: "OneSoft ERP", license_type: "lifetime",
        desktop_allowed: true, web_allowed: true, offline_allowed: true,
      },
    },
  },
  expired: {
    label: "🔴 اشتراك منتهٍ", btnColor: "bg-red-600",
    status: {
      valid: false, error: "expired",
      payload: {
        org_id: "ORG-2026-XRAY", customer_name: MOCK_ORG,
        package_name: "Professional",
        max_users: 10, max_branches: 3, max_pos: 5, max_devices: 5,
        enabled_modules: ["sales", "purchases", "inventory", "accounting", "pos"],
        start_date: "2026-01-01", expiry_date: "2026-06-30",
        license_id: "LIC-2026-ABCD-0001", activation_id: "ACT-EXPIRED",
        issued_by: "OneSoft ERP", license_type: "subscription",
        desktop_allowed: true, web_allowed: false, offline_allowed: true,
      },
    },
  },
  invalid: {
    label: "🔴 غير صالح", btnColor: "bg-red-800",
    status: { valid: false, error: "invalid_signature", payload: null },
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────
function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "2-digit" }); }
  catch { return d; }
}
function daysLeft(exp: string) {
  return Math.max(0, Math.ceil((new Date(exp + "T23:59:59Z").getTime() - Date.now()) / 86_400_000));
}

// ─── Shared sub-components ──────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#C9A84C]/30 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
function SectionTitle({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-7 h-7 rounded-lg bg-[#1B2B5C]/8 flex items-center justify-center text-[#1B2B5C] shrink-0">{icon}</span>
      <span className="font-extrabold text-[#1B2B5C] text-[15px]">{title}</span>
      {badge && <span className="mr-auto">{badge}</span>}
    </div>
  );
}
function LimitCard({ label, current, max, icon }: { label: string; current: number; max: number; icon: React.ReactNode }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const bar = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-[#1B2B5C]";
  const tc  = pct >= 90 ? "text-red-600" : "text-[#1B2B5C]";
  return (
    <div className="bg-[#FAF7F0] rounded-xl border border-[#C9A84C]/20 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[#1B2B5C]/70">{icon}</span>
          <span className="text-[13px] font-semibold text-[#374151]">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-[22px] font-black leading-none ${tc}`}>{current}</span>
          <span className="text-[13px] text-[#9CA3AF] font-medium"> / {max}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-[#E5DDD0] overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-[#9CA3AF] mt-1">{pct}% مستخدَم</p>
    </div>
  );
}
function AccessBadge({ label, value, icon }: { label: string; value?: boolean | null; icon: React.ReactNode }) {
  const on = value === true;
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-[13px] font-semibold ${on ? "bg-green-50 border-green-200 text-green-800" : "bg-[#F4F0E8] border-[#E0D8CC] text-[#9CA3AF]"}`}>
      <div className="flex items-center gap-2.5">{icon}<span>{label}</span></div>
      <span className={`text-base ${on ? "text-green-500" : "text-[#CBD5E1]"}`}>{on ? "✓" : "✕"}</span>
    </div>
  );
}
function ModuleChip({ label, icon, enabled }: { label: string; icon: string; enabled: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${enabled ? "bg-green-50 border-green-200" : "bg-[#F4F0E8] border-[#E0D8CC] opacity-60"}`}>
      <span className="text-lg leading-none shrink-0">{icon}</span>
      <span className={`text-[12px] font-bold flex-1 leading-tight ${enabled ? "text-green-900" : "text-[#9CA3AF]"}`}>{label}</span>
      {enabled ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-[#C9A84C]/50 shrink-0" />}
    </div>
  );
}

// ─── Main license screen content ────────────────────────────────────────
function LicenseScreen({ status, ck, copy }: {
  status: MockStatus;
  ck: string | null;
  copy: (v: string, k: string) => void;
}) {
  const [tab, setTab] = useState<"code" | "file" | "trial">("code");
  const [activCode, setActivCode] = useState("");

  const p        = status.payload;
  const isValid  = status.valid;
  const err      = status.error;
  const lt       = p?.license_type;
  const isTrial  = isValid && lt === "trial";
  const isLife   = isValid && lt === "lifetime";
  const isExpired  = !isValid && err === "expired";
  const isSlate    = !isValid && err === "license_not_found";
  const isInvalid  = !isValid && (err === "invalid_signature" || err === "invalid_json");

  const days = p?.expiry_date && !isLife ? daysLeft(p.expiry_date) : null;
  const mods = new Set(p?.enabled_modules ?? []);
  const curUsers = isValid ? 4 : 0;
  const curBranches = isValid ? 1 : 0;

  const trialDuration = p?.start_date && p?.expiry_date && isTrial
    ? Math.ceil((new Date(p.expiry_date + "T23:59:59Z").getTime() - new Date(p.start_date + "T00:00:00Z").getTime()) / 86_400_000)
    : null;

  const typeLabel =
    lt === "trial"     ? "فترة تجريبية"
    : lt === "lifetime"  ? "ترخيص دائم"
    : isValid          ? "اشتراك مفعّل"
    : isExpired        ? "انتهت الصلاحية"
    : isSlate          ? "غير مفعّل"
    : isInvalid        ? "ترخيص غير صالح"
    : "غير محدد";

  const badge = isValid && !isTrial
    ? { label: "الترخيص مفعّل ✓", bg: "bg-green-100",  text: "text-green-800",  bdr: "border-green-300" }
    : isTrial
    ? { label: "نسخة تجريبية",    bg: "bg-[#FFF3D0]",  text: "text-[#8B6914]",  bdr: "border-[#C9A84C]/60" }
    : isExpired
    ? { label: "انتهت الصلاحية",  bg: "bg-red-100",    text: "text-red-800",    bdr: "border-red-300" }
    : isInvalid
    ? { label: "ترخيص غير صالح", bg: "bg-red-100",    text: "text-red-800",    bdr: "border-red-300" }
    : { label: "غير مفعّل",       bg: "bg-gray-100",   text: "text-gray-600",   bdr: "border-gray-300" };

  const ShIcon = isValid && !isTrial ? ShieldCheck : isTrial ? ShieldCheck : isSlate ? ShieldQuestion : isExpired ? ShieldAlert : ShieldOff;
  const shIconCls = isValid && !isTrial ? "text-green-500" : isTrial ? "text-[#C9A84C]" : "text-red-500";
  const shBgCls   = isValid && !isTrial ? "bg-green-50 border-green-200" : isTrial ? "bg-[#FFF8E0] border-[#C9A84C]/50" : isSlate ? "bg-gray-100 border-gray-200" : "bg-red-50 border-red-200";

  const daysColor = !days ? "" : days <= 7 ? "text-red-600" : days <= 30 ? "text-amber-600" : "text-[#1B2B5C]";

  const statusMsg =
    isSlate    ? "البرنامج غير مفعّل. يرجى إدخال كود التفعيل أو استيراد ملف الترخيص للمتابعة."
    : isTrial  ? "هذه نسخة تجريبية محدودة المدة."
    : isExpired ? "انتهت صلاحية الترخيص. يرجى التواصل مع مزود النظام للتجديد."
    : isInvalid ? "ملف الترخيص غير صالح أو تم تعديله. يرجى التواصل مع مزود النظام."
    : null;

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-black text-[#1B2B5C] leading-none">الترخيص والتفعيل</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">إدارة حالة ترخيص النظام وتفعيل النسخة</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#C9A84C]/40 bg-white text-[#1B2B5C] text-[13px] font-semibold shadow-sm">
          <RefreshCw className="w-4 h-4" /> تحديث الحالة
        </button>
      </div>

      {/* ── Status Card ── */}
      <Card className="p-6">
        <div className="flex items-start gap-6">
          {/* Shield */}
          <div className={`shrink-0 w-20 h-20 rounded-2xl flex items-center justify-center border-2 shadow-inner ${shBgCls}`}>
            <ShIcon className={`w-10 h-10 ${shIconCls}`} />
          </div>

          {/* Status + type + package */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center px-4 py-1.5 rounded-full border text-[13px] font-bold ${badge.bg} ${badge.text} ${badge.bdr}`}>
                {badge.label}
              </span>
              {isValid && <span className="text-[13px] text-[#6B7280]">باقي من انتهاء الصلاحية</span>}
            </div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-[28px] font-black text-[#1B2B5C] leading-none">{p?.package_name ?? typeLabel}</h2>
              {p?.package_name && <span className="text-[14px] text-[#6B7280] font-medium">{typeLabel}</span>}
            </div>
            {p?.customer_name && <p className="text-[14px] text-[#6B7280] font-medium">{p.customer_name}</p>}
            {statusMsg && !isValid && (
              <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border text-[13px] mt-2 ${
                isInvalid || isExpired ? "bg-red-50 border-red-200 text-red-800" : "bg-[#FFF8E0] border-[#C9A84C]/30 text-[#6B5100]"
              }`}>
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="leading-relaxed">{statusMsg}</span>
              </div>
            )}
            {isInvalid && (
              <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 border text-[12px] bg-amber-50 border-amber-200 text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                لا تحاول تعديل ملف الترخيص يدوياً — أي تعديل سيُبطل التوقيع الرقمي ويُوقف عمل النظام.
              </div>
            )}
          </div>

          {/* Days counter */}
          {p && (
            <div className={`shrink-0 flex flex-col items-center justify-center gap-1 rounded-2xl border-2 px-6 py-4 text-center min-w-[100px] ${
              isLife ? "bg-[#EFF3FF] border-[#1B2B5C]/20"
              : (days ?? 0) <= 7 ? "bg-red-50 border-red-200"
              : (days ?? 0) <= 30 ? "bg-amber-50 border-amber-200"
              : "bg-[#F0F9F0] border-green-200"
            }`}>
              {isLife ? (
                <><InfinityIcon className="w-10 h-10 text-[#1B2B5C]" /><p className="text-[11px] text-[#1B2B5C]/60 font-semibold mt-1">دائم</p></>
              ) : (
                <>
                  <span className={`text-[42px] font-black leading-none ${daysColor || "text-[#1B2B5C]"}`}>{days}</span>
                  <span className="text-[12px] text-[#6B7280] font-semibold">يوم</span>
                  {(days ?? 0) <= 30 && <span className={`text-[11px] font-bold mt-0.5 ${(days ?? 0) <= 7 ? "text-red-600" : "text-amber-600"}`}>{(days ?? 0) <= 7 ? "⚠ عاجل" : "قريبًا"}</span>}
                </>
              )}
            </div>
          )}
        </div>

        {/* IDs grid */}
        {p && (
          <div className="mt-5 pt-4 border-t border-[#C9A84C]/20 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
            {[
              { label: "Device ID",       value: MOCK_DID, id: "dv" },
              { label: "Organization ID", value: p.org_id, id: "oid" },
              { label: "تاريخ التفعيل",  value: fmtDate(p.start_date) },
              { label: "تاريخ الانتهاء", value: isLife ? "دائم" : fmtDate(p.expiry_date) },
              { label: "License ID",      value: p.license_id, id: "lid" },
              { label: "Activation ID",   value: p.activation_id, id: "aid" },
              { label: "الجهة المصدرة",  value: p.issued_by },
              { label: "اسم المؤسسة",    value: p.customer_name },
            ].map((item, i) => (
              <div key={i} className="min-w-0">
                <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-0.5">{item.label}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-mono text-[#1B2B5C]/80 truncate">{item.value ?? "—"}</span>
                  {(item as any).id && item.value && (
                    <button onClick={() => copy(item.value!, (item as any).id)}
                      className="p-0.5 rounded text-[#C9A84C]/60 hover:text-[#C9A84C] transition-colors shrink-0">
                      {ck === (item as any).id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Trial banner */}
        {isTrial && p && (
          <div className="mt-4 p-4 bg-[#FFF8E0] rounded-xl border border-[#C9A84C]/30">
            <div className="flex items-center gap-2 mb-3">
              <Timer className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-[13px] font-bold text-[#8B6914]">تفاصيل الفترة التجريبية</span>
              <span className="text-[12px] text-[#C9A84C]/70 mr-auto">قابلة للترقية إلى ترخيص كامل</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><p className="text-[10px] text-[#C9A84C]/70 font-bold uppercase mb-0.5">المدة</p><p className="text-[18px] font-black text-[#1B2B5C]">{trialDuration} يوم</p></div>
              <div><p className="text-[10px] text-[#C9A84C]/70 font-bold uppercase mb-0.5">تاريخ البداية</p><p className="text-[13px] font-semibold text-[#1B2B5C]">{fmtDate(p.start_date)}</p></div>
              <div><p className="text-[10px] text-[#C9A84C]/70 font-bold uppercase mb-0.5">تاريخ النهاية</p><p className="text-[13px] font-semibold text-[#1B2B5C]">{fmtDate(p.expiry_date)}</p></div>
              <div><p className="text-[10px] text-[#C9A84C]/70 font-bold uppercase mb-0.5">الأيام المتبقية</p>
                <p className={`text-[28px] font-black leading-none ${(days ?? 0) <= 7 ? "text-red-600" : (days ?? 0) <= 14 ? "text-amber-600" : "text-[#1B2B5C]"}`}>{days}</p></div>
            </div>
          </div>
        )}

        {/* Expired */}
        {isExpired && p && (
          <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-[13px] font-bold text-red-800">انتهت صلاحية الترخيص</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-[13px]">
              <div><p className="text-[10px] text-red-400/70 font-bold uppercase mb-0.5">تاريخ البداية</p><p className="font-semibold text-red-800">{fmtDate(p.start_date)}</p></div>
              <div><p className="text-[10px] text-red-400/70 font-bold uppercase mb-0.5">تاريخ الانتهاء</p><p className="font-semibold text-red-800">{fmtDate(p.expiry_date)}</p></div>
              <div><p className="text-[10px] text-red-400/70 font-bold uppercase mb-0.5">الإجراء المطلوب</p><p className="font-semibold text-red-800">التواصل مع مزود النظام</p></div>
            </div>
          </div>
        )}

        {/* Active bar */}
        {isValid && !isTrial && (
          <div className="mt-4 flex items-center gap-2.5 px-4 py-2.5 bg-green-50 rounded-xl border border-green-200">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <span className="text-[13px] font-semibold text-green-800">الترخيص مفعّل وجميع خدمات النظام تعمل بشكل طبيعي.</span>
          </div>
        )}
      </Card>

      {/* ── 3-column row ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* COL 1 (rightmost in RTL): حدود الترخيص */}
        <Card className="p-5">
          <SectionTitle icon={<span className="text-base">🏅</span>} title="حدود الترخيص" />
          {p ? (
            <div className="space-y-3">
              <LimitCard label="المستخدمون"  current={curUsers}    max={p.max_users}    icon={<Users className="w-4 h-4" />} />
              <LimitCard label="الفروع"       current={curBranches} max={p.max_branches} icon={<GitBranch className="w-4 h-4" />} />
              <LimitCard label="نقاط البيع"  current={0}           max={p.max_pos}      icon={<MonitorSmartphone className="w-4 h-4" />} />
              <LimitCard label="الأجهزة"      current={0}           max={p.max_devices}  icon={<Fingerprint className="w-4 h-4" />} />
              <div className="pt-2 space-y-2">
                <AccessBadge label="الويب"         value={p.web_allowed}            icon={<Globe className="w-4 h-4" />} />
                <AccessBadge label="سطح المكتب"    value={p.desktop_allowed ?? true} icon={<Monitor className="w-4 h-4" />} />
                <AccessBadge label="وضع الأوفلاين" value={p.offline_allowed}         icon={<WifiOff className="w-4 h-4" />} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-10 gap-3">
              <Lock className="w-12 h-12 text-[#C9A84C]/25" />
              <p className="text-[13px] text-[#9CA3AF] text-center">سيتم عرض الحدود بعد التفعيل</p>
            </div>
          )}
        </Card>

        {/* COL 2 (middle): الموديولات + الجهاز */}
        <div className="space-y-4">
          <Card className="p-5">
            <SectionTitle
              icon={<span className="text-base">📦</span>}
              title="الموديولات المفعّلة"
              badge={p ? <span className="text-[12px] font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">{mods.size} / {MODULES.length}</span> : undefined}
            />
            <div className="space-y-2">
              {MODULES.map(m => <ModuleChip key={m.id} label={m.label} icon={m.icon} enabled={!!p && mods.has(m.id)} />)}
            </div>
          </Card>

          {/* Device info */}
          <Card className="p-5">
            <SectionTitle icon={<Fingerprint className="w-4 h-4" />} title="معلومات الجهاز" />
            <div className="space-y-3">
              <div className="bg-[#FAF7F0] rounded-xl border border-[#C9A84C]/20 px-4 py-3">
                <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Device ID</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] font-mono text-[#1B2B5C] break-all leading-snug">{MOCK_DID}</code>
                  <button onClick={() => copy(MOCK_DID, "dv2")}
                    className="p-1.5 rounded-lg border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-white transition-colors shrink-0">
                    {ck === "dv2" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="bg-[#FAF7F0] rounded-xl border border-[#C9A84C]/20 px-4 py-3">
                <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Request Code</p>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] font-mono text-[#9CA3AF]">LIQ-XXXX-XXXX</code>
                  <button className="p-1.5 rounded-lg border border-[#C9A84C]/30 text-[#C9A84C] shrink-0"><Copy className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-semibold ${isValid ? "bg-green-50 border-green-200 text-green-800" : "bg-[#FAF7F0] border-[#E0D8CC] text-[#9CA3AF]"}`}>
                {isValid
                  ? <><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> الجهاز مرتبط بترخيص صالح</>
                  : <><XCircle className="w-4 h-4 shrink-0" /> الجهاز غير مرتبط بأي ترخيص</>
                }
              </div>
              <div className="flex items-start gap-2 px-3 py-2.5 bg-[#FAF7F0] rounded-xl border border-[#C9A84C]/20 text-[12px] text-[#6B7280]">
                <Phone className="w-3.5 h-3.5 text-[#C9A84C] shrink-0 mt-0.5" />
                استخدم كود الطلب في حال تواصلت مع مزود النظام لتفعيل النظام.
              </div>
            </div>
          </Card>
        </div>

        {/* COL 3 (leftmost in RTL): تفعيل الترخيص */}
        <Card className="p-5">
          <SectionTitle icon={<KeyRound className="w-4 h-4" />} title="تفعيل الترخيص" />
          {/* Tabs */}
          <div className="flex rounded-xl border border-[#C9A84C]/25 overflow-hidden mb-4">
            {([
              { key: "code",  label: "إدخال كود التفعيل" },
              { key: "file",  label: "استيراد ملف" },
              { key: "trial", label: "فترة تجريبية" },
            ] as const).map((t, i, arr) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 py-2.5 text-[11px] font-bold text-center leading-tight px-1 transition-all ${
                  tab === t.key ? "bg-[#1B2B5C] text-white" : "bg-white text-[#4A5568] hover:bg-[#FAF7F0]"
                } ${i < arr.length - 1 ? "border-l border-[#C9A84C]/25" : ""}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Code tab */}
          {tab === "code" && (
            <div className="space-y-3">
              <p className="text-[13px] text-[#6B7280] leading-relaxed">أدخل كود التفعيل الذي حصلت عليه من دعم OneSoft ERP.</p>
              <div>
                <p className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1.5">كود التفعيل</p>
                <textarea
                  value={activCode}
                  onChange={e => setActivCode(e.target.value)}
                  rows={5}
                  placeholder="أدخل كود التفعيل..."
                  className="w-full text-[11px] font-mono border-2 border-[#C9A84C]/25 rounded-xl p-3 bg-[#FAF7F0] text-[#1B2B5C] focus:outline-none focus:border-[#1B2B5C]/40 resize-none leading-relaxed"
                  dir="ltr"
                />
              </div>
              <button
                disabled={!activCode.trim()}
                className={`w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[15px] font-bold transition-colors shadow-md ${
                  activCode.trim() ? "bg-[#1B2B5C] text-white hover:bg-[#243875]" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                <KeyRound className="w-5 h-5" /> تفعيل الآن
              </button>
            </div>
          )}

          {/* File tab */}
          {tab === "file" && (
            <div className="space-y-3">
              <p className="text-[13px] text-[#6B7280] leading-relaxed">استورد ملف الترخيص (.ons) الصادر من مزود النظام.</p>
              <div className="border-2 border-dashed border-[#C9A84C]/40 rounded-xl p-6 text-center">
                <FileUp className="w-8 h-8 mx-auto text-[#C9A84C] mb-2" />
                <p className="text-[13px] font-semibold text-[#6B7280]">اضغط لاختيار ملف</p>
                <p className="text-[12px] text-[#9CA3AF] mt-1">.ons أو .json</p>
              </div>
              <button className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gray-200 text-gray-400 text-[15px] font-bold cursor-not-allowed">
                <UploadCloud className="w-5 h-5" /> استيراد ملف الترخيص
              </button>
            </div>
          )}

          {/* Trial tab */}
          {tab === "trial" && (
            <div className="space-y-3">
              <div className="bg-[#FFF8E0] border border-[#C9A84C]/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Timer className="w-4 h-4 text-[#C9A84C]" />
                  <span className="text-[13px] font-bold text-[#8B6914]">الفترة التجريبية</span>
                </div>
                <p className="text-[12px] text-[#6B7280] leading-relaxed">
                  للحصول على فترة تجريبية، يجب الحصول على ملف ترخيص تجريبي موقّع من مزود النظام. تواصل معهم وأرسل Device ID الخاص بجهازك.
                </p>
              </div>
              <div className="space-y-2 pt-1">
                {["انسخ Device ID أدناه", "أرسله لمزود النظام", "استلم ملف الترخيص", "استورده من تبويب «استيراد»"].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 text-[13px] text-[#4A5568]">
                    <span className="w-6 h-6 rounded-full bg-[#1B2B5C] text-white text-[10px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                    {s}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => copy(MOCK_DID, "did-t")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-[#1B2B5C]/25 text-[#1B2B5C] text-[12px] font-semibold hover:bg-[#1B2B5C]/5">
                  {ck === "did-t" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />} نسخ Device ID
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-[#1B2B5C]/25 text-[#1B2B5C] text-[12px] font-semibold hover:bg-[#1B2B5C]/5">
                  <ClipboardCopy className="w-4 h-4" /> توليد كود الطلب
                </button>
              </div>
            </div>
          )}

          {/* Active message */}
          {isValid && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl text-[12px] text-green-800 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              الترخيص مفعّل وجميع الخدمات تعمل بشكل طبيعي.
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}

// ─── Sidebar Nav Items ────────────────────────────────────────────────────
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "الرئيسية" },
  { icon: ShoppingCart,    label: "المبيعات" },
  { icon: Package,         label: "المشتريات" },
  { icon: Archive,         label: "المخزون" },
  { icon: BarChart3,       label: "التقارير" },
  { icon: Settings,        label: "الإعدادات" },
];

// ─── Full Preview Page ────────────────────────────────────────────────────
export default function LicensePreviewPage() {
  const keys = Object.keys(MOCKS) as (keyof typeof MOCKS)[];
  const getHashState = (): keyof typeof MOCKS => {
    const h = window.location.hash.replace("#", "");
    return (keys.includes(h as any) ? h : "subscription") as keyof typeof MOCKS;
  };
  const [active, setActive] = useState<keyof typeof MOCKS>(getHashState);
  const [ck, setK] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setActive(getHashState());
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => { setK(key); setTimeout(() => setK(null), 2000); });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F2EDE4]" dir="rtl">

      {/* ── RIGHT SIDEBAR (Navy) ── */}
      <aside className="w-[220px] bg-[#1B2B5C] flex flex-col shrink-0 h-full shadow-2xl">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#C9A84C] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#1B2B5C]" />
            </div>
            <div>
              <p className="text-[13px] font-black text-white leading-none">OneSoft</p>
              <p className="text-[10px] text-white/40 font-medium">ERP</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 bg-white/8 border border-white/10 rounded-xl px-3 py-2">
            <span className="text-white/30 text-[13px]">🔍</span>
            <span className="text-[12px] text-white/30">ابحث في القوائم...</span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <div key={item.label}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/55 hover:bg-white/6 hover:text-white/80 cursor-pointer transition-colors">
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="text-[13px] font-medium">{item.label}</span>
            </div>
          ))}
          {/* Active item */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#C9A84C]/15 border border-[#C9A84C]/30 cursor-pointer">
            <KeyRound className="w-4 h-4 text-[#C9A84C] shrink-0" />
            <span className="text-[13px] font-bold text-[#C9A84C]">الترخيص والتفعيل</span>
            <ChevronLeft className="w-3 h-3 text-[#C9A84C] mr-auto" />
          </div>
        </nav>

        {/* Help */}
        <div className="px-4 py-3 border-t border-white/10">
          <div className="flex items-center gap-2 text-white/35 hover:text-white/60 cursor-pointer transition-colors">
            <HelpCircle className="w-4 h-4" />
            <span className="text-[12px] font-medium">مساعدة</span>
          </div>
        </div>

        {/* User */}
        <div className="px-4 py-3 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#C9A84C] flex items-center justify-center text-[#1B2B5C] font-black text-[11px] shrink-0">
              م ن
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-white truncate">مدير النظام</p>
              <p className="text-[9px] text-white/40 truncate">{MOCKS[active].status.payload?.customer_name ?? "—"}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Dev warning bar */}
        <div className="bg-yellow-100 border-b border-yellow-300 px-5 py-1.5 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-yellow-800 font-semibold">⚠️ صفحة معاينة تطويرية — غير متاحة في نسخة الإنتاج</span>
          <div className="flex gap-2">
            {keys.map(k => (
              <button key={k} onClick={() => setActive(k)}
                className={`px-3 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                  active === k
                    ? `${MOCKS[k].btnColor} text-white border-transparent`
                    : "bg-white border-[#C9A84C]/30 text-[#1B2B5C] hover:bg-[#FAF7F0]"
                }`}>
                {MOCKS[k].label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5">
          <LicenseScreen status={MOCKS[active].status} ck={ck} copy={copy} />
        </div>

        {/* Status bar at bottom */}
        <div className="bg-white border-t border-[#C9A84C]/20 px-5 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-[11px] text-[#6B7280]">
            <span>📅 {new Date().toLocaleDateString("ar-SA")}</span>
            <span>🕐 {new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span> متصل</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-[#6B7280]">
            <span>🏢 {MOCKS[active].status.payload?.customer_name ?? "—"}</span>
            <span>📍 فرع الرياض الرئيسي</span>
          </div>
        </div>
      </div>

    </div>
  );
}
