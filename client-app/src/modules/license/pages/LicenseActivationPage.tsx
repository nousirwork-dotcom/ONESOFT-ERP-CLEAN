import { useState, useRef } from "react";
import { trpc } from "@/shared/lib/trpc";
import {
  ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion,
  Copy, Check, RefreshCw, KeyRound, FileUp,
  Users, GitBranch, MonitorSmartphone, Fingerprint,
  Globe, Monitor, WifiOff, Lock, CheckCircle2, XCircle,
  UploadCloud, ClipboardCopy, Timer, Phone,
  Infinity as InfinityIcon, AlertTriangle, Info,
} from "lucide-react";

// ─── Theme ─────────────────────────────────────────────────────────────
// Navy #1B2B5C  |  Gold #C9A84C  |  Cream bg #FAF7F0
// Cards: white + border-[#C9A84C]/30 + rounded-2xl + shadow-sm

// ─── Types ─────────────────────────────────────────────────────────────
type LicType = "trial" | "subscription" | "lifetime" | undefined;

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

function deriveLicType(lt?: LicType, exp?: string): LicType {
  if (lt) return lt;
  if (!exp) return undefined;
  return exp >= "2099-01-01" ? "lifetime" : "subscription";
}
function daysLeft(exp: string) {
  return Math.max(0, Math.ceil((new Date(exp + "T23:59:59Z").getTime() - Date.now()) / 86_400_000));
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "2-digit" }); }
  catch { return d; }
}

// ─── Copy hook ──────────────────────────────────────────────────────────
function useCopy() {
  const [k, setK] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => { setK(key); setTimeout(() => setK(null), 2000); });
  };
  return { ck: k, copy };
}

// ─── Helpers ────────────────────────────────────────────────────────────
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
      <span className="w-7 h-7 rounded-lg bg-[#1B2B5C]/8 flex items-center justify-center text-[#1B2B5C] shrink-0">
        {icon}
      </span>
      <span className="font-extrabold text-[#1B2B5C] text-[15px]">{title}</span>
      {badge && <span className="mr-auto">{badge}</span>}
    </div>
  );
}

function CopyBtn({ value, id, ck, copy, size = "sm" }: {
  value?: string | null; id: string;
  ck: string | null; copy: (v: string, k: string) => void;
  size?: "sm" | "xs";
}) {
  if (!value) return null;
  const cls = size === "xs"
    ? "p-1 rounded-lg border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#FAF7F0] transition-colors"
    : "p-1.5 rounded-lg border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#FAF7F0] transition-colors";
  const icCls = size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <button onClick={() => copy(value, id)} className={cls}>
      {ck === id ? <Check className={`${icCls} text-green-500`} /> : <Copy className={icCls} />}
    </button>
  );
}

// ─── LimitCard ──────────────────────────────────────────────────────────
function LimitCard({ label, current, max, icon }: {
  label: string; current: number; max: number; icon: React.ReactNode;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const barColor = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-[#1B2B5C]";
  const textColor = pct >= 90 ? "text-red-600" : "text-[#1B2B5C]";
  return (
    <div className="bg-[#FAF7F0] rounded-xl border border-[#C9A84C]/20 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[#1B2B5C]/70">{icon}</span>
          <span className="text-[13px] font-semibold text-[#374151]">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-[22px] font-black leading-none ${textColor}`}>{current}</span>
          <span className="text-[13px] text-[#9CA3AF] font-medium"> / {max}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-[#E5DDD0] overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-[#9CA3AF] mt-1">{pct}% مستخدَم</p>
    </div>
  );
}

// ─── AccessBadge ──────────────────────────────────────────────────────────
function AccessBadge({ label, value, icon }: { label: string; value?: boolean | null; icon: React.ReactNode }) {
  const on = value === true;
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-[13px] font-semibold ${
      on ? "bg-green-50 border-green-200 text-green-800" : "bg-[#F4F0E8] border-[#E0D8CC] text-[#9CA3AF]"
    }`}>
      <div className="flex items-center gap-2.5">{icon}<span>{label}</span></div>
      <span className={`text-base ${on ? "text-green-500" : "text-[#CBD5E1]"}`}>{on ? "✓" : "✕"}</span>
    </div>
  );
}

// ─── ModuleChip ──────────────────────────────────────────────────────────
function ModuleChip({ label, icon, enabled }: { label: string; icon: string; enabled: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
      enabled
        ? "bg-green-50 border-green-200"
        : "bg-[#F4F0E8] border-[#E0D8CC] opacity-60"
    }`}>
      <span className="text-lg leading-none shrink-0">{icon}</span>
      <span className={`text-[12px] font-bold flex-1 leading-tight ${enabled ? "text-green-900" : "text-[#9CA3AF]"}`}>
        {label}
      </span>
      {enabled
        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
        : <Lock className="w-3.5 h-3.5 text-[#C9A84C]/50 shrink-0" />
      }
    </div>
  );
}

// ─── NavyButton ──────────────────────────────────────────────────────────
function NavyButton({ children, onClick, disabled, className = "" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1B2B5C] text-white text-[14px] font-bold
        hover:bg-[#243875] active:bg-[#0F1D3F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md ${className}`}
    >
      {children}
    </button>
  );
}

function OutlineButton({ children, onClick, disabled, className = "" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#1B2B5C]/25 text-[#1B2B5C] text-[13px] font-semibold
        hover:bg-[#1B2B5C]/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Page
// ═══════════════════════════════════════════════════════════════════════════
export default function LicenseActivationPage() {
  const [tab,         setTab]         = useState<"code" | "file" | "trial">("code");
  const [activCode,   setActivCode]   = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileName,    setFileName]    = useState("");
  const [reqCode,     setReqCode]     = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { ck, copy } = useCopy();

  const utils = trpc.useUtils();
  const { data: status, refetch } = trpc.license.getStatus.useQuery(undefined, { retry: false });
  const { data: devInfo }         = trpc.license.getDeviceInfo.useQuery(undefined, { retry: false });
  const { data: stats }           = trpc.license.getCurrentStats.useQuery(undefined, { retry: false });

  const genReq = trpc.license.generateRequestCode.useMutation({
    onSuccess: d => setReqCode(d.code),
    onError:   e => setNotice({ ok: false, msg: e.message }),
  });
  const byCode = trpc.license.activateByCode.useMutation({
    onSuccess: d => {
      setNotice({ ok: true, msg: `✅ تم تفعيل الترخيص — ${d.customer}` });
      setActivCode("");
      utils.license.getStatus.invalidate(); refetch();
    },
    onError: e => setNotice({ ok: false, msg: e.message }),
  });
  const byFile = trpc.license.activateByFile.useMutation({
    onSuccess: d => {
      setNotice({ ok: true, msg: `✅ تم تفعيل الترخيص — ${d.customer}` });
      setFileContent(""); setFileName("");
      utils.license.getStatus.invalidate(); refetch();
    },
    onError: e => setNotice({ ok: false, msg: e.message }),
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setFileName(f.name);
    const r = new FileReader();
    r.onload = ev => setFileContent((ev.target?.result as string) ?? "");
    r.readAsText(f);
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const p           = status?.payload;
  const isValid     = !!status?.valid;
  const err         = status?.error as string | null | undefined;
  const lt          = deriveLicType(p?.license_type as LicType, p?.expiry_date);
  const days        = p?.expiry_date && lt !== "lifetime" ? daysLeft(p.expiry_date) : null;
  const curUsers    = stats?.current_users ?? 0;
  const curBranches = (stats as { current_branches?: number } | undefined)?.current_branches ?? 0;
  const mods        = new Set(p?.enabled_modules ?? []);

  const isTrial     = isValid && lt === "trial";
  const isLifetime  = isValid && lt === "lifetime";
  const isExpired   = !isValid && err === "expired";
  const isSlate     = !isValid && err === "license_not_found";
  const isInvalid   = !isValid && (err === "invalid_signature" || err === "unknown_algorithm" || err === "unknown_kid" || err === "invalid_json");
  const isDateTamper = !isValid && err === "date_manipulation_suspected";

  const trialDuration = p?.start_date && p?.expiry_date && isTrial
    ? Math.ceil((new Date(p.expiry_date + "T23:59:59Z").getTime() - new Date(p.start_date + "T00:00:00Z").getTime()) / 86_400_000)
    : null;

  const typeLabel =
    lt === "trial"    ? "فترة تجريبية"
    : lt === "lifetime" ? "ترخيص دائم"
    : isValid         ? "اشتراك مفعّل"
    : isExpired       ? "انتهت الصلاحية"
    : isSlate         ? "غير مفعّل"
    : isInvalid       ? "ترخيص غير صالح"
    : isDateTamper    ? "خطأ في الوقت"
    : "غير محدد";

  // status badge for inside card
  const statusBadge = isValid && !isTrial
    ? { label: "الترخيص مفعّل ✓",     bg: "bg-green-100",  text: "text-green-800",  border: "border-green-300" }
    : isTrial
    ? { label: "نسخة تجريبية",        bg: "bg-[#FFF3D0]",  text: "text-[#8B6914]",  border: "border-[#C9A84C]/60" }
    : isExpired
    ? { label: "انتهت الصلاحية",      bg: "bg-red-100",    text: "text-red-800",    border: "border-red-300" }
    : isInvalid
    ? { label: "ترخيص غير صالح",      bg: "bg-red-100",    text: "text-red-800",    border: "border-red-300" }
    : { label: "غير مفعّل",            bg: "bg-gray-100",   text: "text-gray-600",   border: "border-gray-300" };

  const ShieldIcon = isValid && !isTrial ? ShieldCheck
    : isTrial ? ShieldCheck
    : isSlate ? ShieldQuestion
    : isExpired ? ShieldAlert
    : ShieldOff;

  const daysColor = !days ? "" : days <= 7 ? "text-red-600" : days <= 30 ? "text-amber-600" : "text-[#1B2B5C]";

  const statusMessage =
    isSlate     ? "البرنامج غير مفعّل. يرجى إدخال كود التفعيل أو استيراد ملف الترخيص للمتابعة."
    : isTrial   ? "هذه نسخة تجريبية محدودة المدة."
    : isExpired ? "انتهت صلاحية الترخيص. يرجى التواصل مع مزود النظام للتجديد."
    : isInvalid ? "ملف الترخيص غير صالح أو تم تعديله. يرجى التواصل مع مزود النظام."
    : isDateTamper ? "يوجد خطأ في إعدادات التاريخ والوقت. يرجى مراجعة إعدادات الجهاز."
    : null;

  const deviceId = p?.device_id || devInfo?.device_id;

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-auto bg-[#F2EDE4]" dir="rtl">
      <div className="p-5 space-y-4 min-h-full">

        {/* ══ PAGE HEADER ═══════════════════════════════════════════════ */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-black text-[#1B2B5C] leading-none">الترخيص والتفعيل</h1>
            <p className="text-[13px] text-[#6B7280] mt-1">إدارة حالة ترخيص النظام وتفعيل النسخة</p>
          </div>
          <button
            onClick={() => { refetch(); setNotice(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#C9A84C]/40 bg-white text-[#1B2B5C] text-[13px] font-semibold hover:bg-[#FAF7F0] transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" /> تحديث الحالة
          </button>
        </div>

        {/* ══ NOTICE ═══════════════════════════════════════════════════ */}
        {notice && (
          <div className={`flex items-center gap-2.5 text-[13px] rounded-xl px-4 py-3 border ${
            notice.ok ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"
          }`}>
            {notice.ok ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
            <span className="flex-1">{notice.msg}</span>
            <button onClick={() => setNotice(null)} className="text-xl leading-none opacity-40 hover:opacity-80">×</button>
          </div>
        )}

        {/* ══ STATUS CARD — full width ══════════════════════════════════ */}
        <Card className="overflow-hidden">
          <div className="p-6">
            <div className="flex items-start gap-6">

              {/* Shield icon */}
              <div className={`shrink-0 w-20 h-20 rounded-2xl flex items-center justify-center border-2 shadow-inner ${
                isValid && !isTrial ? "bg-green-50 border-green-200"
                : isTrial          ? "bg-[#FFF8E0] border-[#C9A84C]/50"
                : isExpired || isInvalid ? "bg-red-50 border-red-200"
                : "bg-gray-100 border-gray-200"
              }`}>
                <ShieldIcon className={`w-10 h-10 ${
                  isValid && !isTrial ? "text-green-500"
                  : isTrial          ? "text-[#C9A84C]"
                  : isExpired || isInvalid ? "text-red-500"
                  : "text-gray-400"
                }`} />
              </div>

              {/* Status + type + package */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center px-4 py-1.5 rounded-full border text-[13px] font-bold ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
                    {statusBadge.label}
                  </span>
                  <span className="text-[13px] text-[#6B7280]">
                    {isValid ? "باقي من انتهاء الصلاحية" : ""}
                  </span>
                </div>

                <div className="flex items-baseline gap-3">
                  <h2 className="text-[28px] font-black text-[#1B2B5C] leading-none">
                    {p?.package_name ?? typeLabel}
                  </h2>
                  {p?.package_name && (
                    <span className="text-[14px] text-[#6B7280] font-medium">{typeLabel}</span>
                  )}
                </div>

                {p?.customer_name && (
                  <p className="text-[14px] text-[#6B7280] font-medium">{p.customer_name}</p>
                )}

                {/* Status message for invalid/inactive */}
                {statusMessage && !isValid && (
                  <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border text-[13px] mt-2 ${
                    isInvalid || isExpired || isDateTamper
                      ? "bg-red-50 border-red-200 text-red-800"
                      : "bg-[#FFF8E0] border-[#C9A84C]/30 text-[#6B5100]"
                  }`}>
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{statusMessage}</span>
                  </div>
                )}
              </div>

              {/* Days counter */}
              {p && (
                <div className={`shrink-0 flex flex-col items-center justify-center gap-1 rounded-2xl border-2 px-6 py-4 text-center ${
                  isLifetime ? "bg-[#EFF3FF] border-[#1B2B5C]/20"
                  : (days ?? 0) <= 7 ? "bg-red-50 border-red-200"
                  : (days ?? 0) <= 30 ? "bg-amber-50 border-amber-200"
                  : "bg-[#F0F9F0] border-green-200"
                }`}>
                  {isLifetime ? (
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

            {/* IDs row */}
            {p && (
              <div className="mt-5 pt-4 border-t border-[#C9A84C]/20 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                {[
                  { label: "Organization ID", value: p.org_id, id: "oid" },
                  { label: "License ID",      value: p.license_id, id: "lid" },
                  { label: "Activation ID",   value: p.activation_id, id: "aid" },
                  { label: "Device ID",       value: deviceId, id: "did" },
                  { label: "تاريخ التفعيل",  value: fmtDate(p.start_date) },
                  { label: "تاريخ الانتهاء", value: isLifetime ? "دائم" : fmtDate(p.expiry_date) },
                  { label: "الجهة المصدرة",  value: p.issued_by },
                ].map((item, i) => (
                  <div key={i} className="min-w-0">
                    <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-0.5">{item.label}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-mono text-[#1B2B5C]/80 truncate">{item.value ?? "—"}</span>
                      {item.id && <CopyBtn value={item.value} id={item.id} ck={ck} copy={copy} size="xs" />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Trial details */}
            {isTrial && p && (
              <div className="mt-4 p-4 bg-[#FFF8E0] rounded-xl border border-[#C9A84C]/30">
                <div className="flex items-center gap-2 mb-3">
                  <Timer className="w-4 h-4 text-[#C9A84C]" />
                  <span className="text-[13px] font-bold text-[#8B6914]">تفاصيل الفترة التجريبية</span>
                  <span className="text-[12px] text-[#C9A84C]/70 mr-auto">قابلة للترقية إلى ترخيص كامل</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div><p className="text-[10px] text-[#C9A84C]/70 font-bold uppercase mb-0.5">المدة</p><p className="text-[15px] font-black text-[#1B2B5C]">{trialDuration} يوم</p></div>
                  <div><p className="text-[10px] text-[#C9A84C]/70 font-bold uppercase mb-0.5">تاريخ البداية</p><p className="text-[13px] font-semibold text-[#1B2B5C]">{fmtDate(p.start_date)}</p></div>
                  <div><p className="text-[10px] text-[#C9A84C]/70 font-bold uppercase mb-0.5">تاريخ النهاية</p><p className="text-[13px] font-semibold text-[#1B2B5C]">{fmtDate(p.expiry_date)}</p></div>
                  <div><p className="text-[10px] text-[#C9A84C]/70 font-bold uppercase mb-0.5">الأيام المتبقية</p>
                    <p className={`text-[28px] font-black leading-none ${(days ?? 0) <= 7 ? "text-red-600" : (days ?? 0) <= 14 ? "text-amber-600" : "text-[#1B2B5C]"}`}>{days}</p></div>
                </div>
              </div>
            )}

            {/* Expired details */}
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

            {/* Active success */}
            {isValid && !isTrial && (
              <div className="mt-4 flex items-center gap-2.5 px-4 py-2.5 bg-green-50 rounded-xl border border-green-200">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                <span className="text-[13px] font-semibold text-green-800">الترخيص مفعّل وجميع خدمات النظام تعمل بشكل طبيعي.</span>
              </div>
            )}
          </div>
        </Card>

        {/* ══ 3-COLUMN ROW ══════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── COL 1 (right in RTL): حدود الترخيص ─────────────────── */}
          <Card className="p-5">
            <SectionTitle icon={<span className="text-base">🏅</span>} title="حدود الترخيص" />
            {p ? (
              <div className="space-y-3">
                <LimitCard label="المستخدمون"  current={curUsers}    max={p.max_users}    icon={<Users className="w-4 h-4" />} />
                <LimitCard label="الفروع"       current={curBranches} max={p.max_branches} icon={<GitBranch className="w-4 h-4" />} />
                <LimitCard label="نقاط البيع"  current={0}           max={p.max_pos}      icon={<MonitorSmartphone className="w-4 h-4" />} />
                <LimitCard label="الأجهزة"      current={0}           max={p.max_devices}  icon={<Fingerprint className="w-4 h-4" />} />
                <div className="pt-2 space-y-2">
                  <AccessBadge label="الويب"          value={p.web_allowed}             icon={<Globe   className="w-4 h-4" />} />
                  <AccessBadge label="سطح المكتب"     value={p.desktop_allowed ?? true}  icon={<Monitor className="w-4 h-4" />} />
                  <AccessBadge label="وضع الأوفلاين"  value={p.offline_allowed}          icon={<WifiOff className="w-4 h-4" />} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 gap-3">
                <Lock className="w-12 h-12 text-[#C9A84C]/25" />
                <p className="text-[13px] text-[#9CA3AF] text-center">سيتم عرض الحدود بعد التفعيل</p>
              </div>
            )}
          </Card>

          {/* ── COL 2 (middle): الموديولات + معلومات الجهاز ─────────── */}
          <div className="space-y-4">
            <Card className="p-5">
              <SectionTitle
                icon={<span className="text-base">📦</span>}
                title="الموديولات المفعّلة"
                badge={p ? (
                  <span className="text-[12px] font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                    {mods.size} / {MODULES.length}
                  </span>
                ) : undefined}
              />
              <div className="space-y-2">
                {MODULES.map(m => (
                  <ModuleChip key={m.id} label={m.label} icon={m.icon} enabled={!!p && mods.has(m.id)} />
                ))}
              </div>
            </Card>

            {/* Device info */}
            <Card className="p-5">
              <SectionTitle icon={<Fingerprint className="w-4 h-4" />} title="معلومات الجهاز" />
              <div className="space-y-3">
                {/* Device ID */}
                <div className="bg-[#FAF7F0] rounded-xl border border-[#C9A84C]/20 px-4 py-3">
                  <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Device ID</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[12px] font-mono text-[#1B2B5C] break-all leading-snug">
                      {deviceId ?? "جارٍ التحميل..."}
                    </code>
                    <CopyBtn value={deviceId} id="dv" ck={ck} copy={copy} />
                  </div>
                </div>
                {/* Request Code */}
                <div className="bg-[#FAF7F0] rounded-xl border border-[#C9A84C]/20 px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider">Request Code</p>
                    <button
                      onClick={() => genReq.mutate({ org_id: "" })}
                      disabled={genReq.isPending}
                      className="text-[11px] text-[#1B2B5C] font-semibold flex items-center gap-1 hover:text-[#243875] disabled:opacity-50"
                    >
                      <RefreshCw className="w-3 h-3" /> {genReq.isPending ? "جارٍ..." : "توليد"}
                    </button>
                  </div>
                  {reqCode ? (
                    <div className="flex items-start gap-2">
                      <code className="flex-1 text-[10px] font-mono text-[#374151] break-all leading-snug">{reqCode}</code>
                      <CopyBtn value={reqCode} id="rq" ck={ck} copy={copy} />
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#9CA3AF]">LIQ-XXXX-XXXX</p>
                  )}
                </div>
                {/* Status */}
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-semibold ${
                  isValid ? "bg-green-50 border-green-200 text-green-800" : "bg-[#FAF7F0] border-[#E0D8CC] text-[#9CA3AF]"
                }`}>
                  {isValid
                    ? <><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> الجهاز مرتبط بترخيص صالح</>
                    : <><XCircle className="w-4 h-4 shrink-0" /> الجهاز غير مرتبط بأي ترخيص نشط</>
                  }
                </div>
                <div className="flex items-start gap-2 px-3 py-2.5 bg-[#FAF7F0] rounded-xl border border-[#C9A84C]/20 text-[12px] text-[#6B7280]">
                  <Phone className="w-3.5 h-3.5 text-[#C9A84C] shrink-0 mt-0.5" />
                  استخدم كود الطلب في حال تواصلت مع مزود النظام لتفعيل النظام.
                </div>
              </div>
            </Card>
          </div>

          {/* ── COL 3 (left in RTL): تفعيل الترخيص ──────────────────── */}
          <Card className="p-5">
            <SectionTitle icon={<KeyRound className="w-4 h-4" />} title="تفعيل الترخيص" />

            {/* Tabs */}
            <div className="flex rounded-xl border border-[#C9A84C]/25 overflow-hidden mb-4">
              {([
                { key: "code",  label: "إدخال كود التفعيل" },
                { key: "file",  label: "استيراد license.ons" },
                { key: "trial", label: "فترة تجريبية" },
              ] as const).map((t, i, arr) => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setNotice(null); }}
                  className={`flex-1 py-2.5 text-[11px] font-bold text-center transition-all leading-tight px-1 ${
                    tab === t.key
                      ? "bg-[#1B2B5C] text-white"
                      : "bg-white text-[#4A5568] hover:bg-[#FAF7F0]"
                  } ${i < arr.length - 1 ? "border-l border-[#C9A84C]/25" : ""}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Tab: code ── */}
            {tab === "code" && (
              <div className="space-y-3">
                <p className="text-[13px] text-[#6B7280] leading-relaxed">
                  أدخل كود التفعيل الذي حصلت عليه من دعم OneSoft ERP.
                </p>
                <div>
                  <p className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1.5">كود التفعيل</p>
                  <textarea
                    value={activCode}
                    onChange={e => setActivCode(e.target.value)}
                    rows={5}
                    placeholder="أدخل كود التفعيل..."
                    className="w-full text-[11px] font-mono border-2 border-[#C9A84C]/25 rounded-xl p-3 bg-[#FAF7F0] text-[#1B2B5C] focus:outline-none focus:border-[#1B2B5C]/40 resize-none leading-relaxed transition-colors"
                    dir="ltr"
                  />
                </div>
                <NavyButton
                  onClick={() => { setNotice(null); byCode.mutate({ code: activCode.trim() }); }}
                  disabled={!activCode.trim() || byCode.isPending}
                  className="w-full text-[15px] py-3.5"
                >
                  <KeyRound className="w-5 h-5" />
                  {byCode.isPending ? "جارٍ التحقق..." : "تفعيل الآن"}
                </NavyButton>
              </div>
            )}

            {/* ── Tab: file ── */}
            {tab === "file" && (
              <div className="space-y-3">
                <p className="text-[13px] text-[#6B7280] leading-relaxed">
                  استورد ملف الترخيص (.ons) الصادر من مزود النظام.
                </p>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-[#C9A84C]/40 rounded-xl p-6 text-center cursor-pointer hover:border-[#1B2B5C]/30 hover:bg-[#F0EBE0] transition-colors"
                >
                  <FileUp className="w-8 h-8 mx-auto text-[#C9A84C] mb-2" />
                  {fileName ? (
                    <><p className="text-[13px] font-bold text-[#1B2B5C]">{fileName}</p><p className="text-[12px] text-green-600 mt-1">✓ جاهز للاستيراد</p></>
                  ) : (
                    <><p className="text-[13px] font-semibold text-[#6B7280]">اضغط لاختيار ملف</p><p className="text-[12px] text-[#9CA3AF] mt-1">.ons أو .json</p></>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".ons,.json" className="hidden" onChange={onFile} />
                <NavyButton
                  onClick={() => { setNotice(null); byFile.mutate({ content: fileContent }); }}
                  disabled={!fileContent || byFile.isPending}
                  className="w-full text-[15px] py-3.5"
                >
                  <UploadCloud className="w-5 h-5" />
                  {byFile.isPending ? "جارٍ التحقق..." : "استيراد ملف الترخيص"}
                </NavyButton>
              </div>
            )}

            {/* ── Tab: trial ── */}
            {tab === "trial" && (
              <div className="space-y-3">
                <div className="bg-[#FFF8E0] border border-[#C9A84C]/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Timer className="w-4 h-4 text-[#C9A84C]" />
                    <span className="text-[13px] font-bold text-[#8B6914]">الفترة التجريبية</span>
                  </div>
                  <p className="text-[12px] text-[#6B7280] leading-relaxed">
                    للحصول على فترة تجريبية، يجب الحصول على ملف ترخيص تجريبي موقّع من مزود النظام.
                    تواصل معهم وأرسل Device ID الخاص بجهازك.
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
                  <OutlineButton onClick={() => deviceId && copy(deviceId, "did-t")} className="flex-1">
                    {ck === "did-t" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    نسخ Device ID
                  </OutlineButton>
                  <OutlineButton onClick={() => genReq.mutate({ org_id: "" })} disabled={genReq.isPending} className="flex-1">
                    <ClipboardCopy className="w-4 h-4" /> توليد كود الطلب
                  </OutlineButton>
                </div>
                {reqCode && (
                  <div className="flex items-start gap-2">
                    <textarea readOnly value={reqCode} rows={3}
                      className="flex-1 text-[10px] font-mono bg-[#FAF7F0] rounded-xl p-2.5 border border-[#C9A84C]/25 resize-none" dir="ltr" />
                    <button onClick={() => copy(reqCode, "rq-t")}
                      className="p-2.5 rounded-xl border border-[#C9A84C]/25 text-[#C9A84C] hover:bg-[#FAF7F0] mt-0.5 shrink-0">
                      {ck === "rq-t" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Active state bottom message */}
            {isValid && (
              <div className="mt-4 flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl text-[12px] text-green-800 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                الترخيص مفعّل وجميع الخدمات تعمل بشكل طبيعي.
              </div>
            )}
          </Card>

        </div>
      </div>
    </div>
  );
}
