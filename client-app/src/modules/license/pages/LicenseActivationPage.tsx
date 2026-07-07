import { useState, useRef } from "react";
import { trpc } from "@/shared/lib/trpc";
import {
  ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion,
  Copy, Check, RefreshCw, KeyRound, FileUp,
  Users, GitBranch, MonitorSmartphone, Fingerprint,
  Globe, Monitor, WifiOff, Lock, CheckCircle2, XCircle,
  UploadCloud, ClipboardCopy, Info, Timer,
  Infinity as InfinityIcon, AlertTriangle, Phone,
} from "lucide-react";

// ─── Theme ─────────────────────────────────────────────────────────────────
// Navy: #1B2B5C  |  Gold: #C9A84C  |  Cream bg: #FAF7F0
// Cards: white + border-[#C9A84C]/25

// ─── Constants ───────────────────────────────────────────────────────────────
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

type LicType = "trial" | "subscription" | "lifetime" | undefined;

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

// ─── useCopy ─────────────────────────────────────────────────────────────────
function useCopy() {
  const [k, setK] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => { setK(key); setTimeout(() => setK(null), 2000); });
  };
  return { ck: k, copy };
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#C9A84C]/25 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

// ─── Card Header ─────────────────────────────────────────────────────────────
function CardHeader({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[#C9A84C]/20 bg-[#FAF7F0]">
      <span className="text-[#1B2B5C]">{icon}</span>
      <span className="font-bold text-[#1B2B5C] text-sm">{title}</span>
      {badge && <span className="mr-auto">{badge}</span>}
    </div>
  );
}

// ─── InfoCell (inside navy header) ────────────────────────────────────────────
function InfoCellNav({ label, value, copyId, ck, copy }: {
  label: string; value?: string | null;
  copyId?: string; ck?: string | null; copy?: (v: string, k: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] font-semibold text-white/45 uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-white/90 truncate select-all">{value ?? "—"}</span>
        {copyId && value && copy && (
          <button onClick={() => copy(value, copyId)} className="text-white/35 hover:text-white/80 transition-colors shrink-0">
            {ck === copyId ? <Check className="w-3 h-3 text-green-300" /> : <Copy className="w-3 h-3" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── InfoCell (white body) ────────────────────────────────────────────────────
function InfoCell({ label, value, copyId, ck, copy }: {
  label: string; value?: string | null;
  copyId?: string; ck?: string | null; copy?: (v: string, k: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] font-semibold text-[#C9A84C] uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-[#1B2B5C]/80 truncate">{value ?? "—"}</span>
        {copyId && value && copy && (
          <button onClick={() => copy(value, copyId)} className="text-[#C9A84C]/60 hover:text-[#C9A84C] transition-colors shrink-0">
            {ck === copyId ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── LimitRow ─────────────────────────────────────────────────────────────────
function LimitRow({ label, current, max, icon }: {
  label: string; current: number; max: number; icon: React.ReactNode;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const barColor = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-[#1B2B5C]";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-[#4A5568] font-medium">{icon} <span>{label}</span></div>
        <div className="flex items-baseline gap-0.5">
          <span className={`font-bold text-sm ${pct >= 90 ? "text-red-600" : "text-[#1B2B5C]"}`}>{current}</span>
          <span className="text-[#9CA3AF] text-xs"> / {max}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-[#E8E0D4] overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-[#9CA3AF]">
        <span>{pct}% مستخدَم</span>
        <span>{Math.max(0, max - current)} متاح</span>
      </div>
    </div>
  );
}

// ─── AccessBadge ─────────────────────────────────────────────────────────────
function AccessBadge({ label, value, icon }: { label: string; value?: boolean | null; icon: React.ReactNode }) {
  const on = value === true;
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium ${
      on ? "bg-green-50 border-green-200 text-green-800" : "bg-[#FAF7F0] border-[#E8E0D4] text-[#9CA3AF]"
    }`}>
      <div className="flex items-center gap-2">{icon} <span>{label}</span></div>
      <span className={on ? "text-green-600 font-bold" : ""}>{on ? "✓" : "✕"}</span>
    </div>
  );
}

// ─── ModuleChip ──────────────────────────────────────────────────────────────
function ModuleChip({ label, icon, enabled }: { label: string; icon: string; enabled: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-colors ${
      enabled
        ? "bg-green-50 border-green-200"
        : "bg-[#FAF7F0] border-[#E8E0D4] opacity-60"
    }`}>
      <span className="text-xl leading-none">{icon}</span>
      <span className={`text-[9px] font-bold leading-tight ${enabled ? "text-green-800" : "text-[#9CA3AF]"}`}>{label}</span>
      {enabled
        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
        : <Lock className="w-3 h-3 text-[#C9A84C]/60" />
      }
    </div>
  );
}

// ─── NavyButton ──────────────────────────────────────────────────────────────
function NavyButton({ children, onClick, disabled, className = "" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B2B5C] text-white text-sm font-semibold
        hover:bg-[#243875] active:bg-[#0F1D3F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
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
      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#1B2B5C]/30 text-[#1B2B5C] text-sm font-semibold
        hover:bg-[#1B2B5C]/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Page
// ═══════════════════════════════════════════════════════════════════════════════
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

  // ── Derived state ─────────────────────────────────────────────────────────
  const p          = status?.payload;
  const isValid    = !!status?.valid;
  const err        = status?.error as string | null | undefined;
  const lt         = deriveLicType(p?.license_type as LicType, p?.expiry_date);
  const days       = p?.expiry_date && lt !== "lifetime" ? daysLeft(p.expiry_date) : null;
  const curUsers   = stats?.current_users ?? 0;
  const curBranches = (stats as { current_branches?: number } | undefined)?.current_branches ?? 0;
  const mods       = new Set(p?.enabled_modules ?? []);

  const isTrial    = isValid && lt === "trial";
  const isLifetime = isValid && lt === "lifetime";
  const isActive   = isValid && !isTrial;
  const isSlate    = !isValid && err === "license_not_found";
  const isExpired  = !isValid && err === "expired";
  const isInvalid  = !isValid && (err === "invalid_signature" || err === "unknown_algorithm" || err === "unknown_kid" || err === "invalid_json");
  const isDateTamper = !isValid && err === "date_manipulation_suspected";

  const trialDuration = p?.start_date && p?.expiry_date && isTrial
    ? Math.ceil((new Date(p.expiry_date + "T23:59:59Z").getTime() - new Date(p.start_date + "T00:00:00Z").getTime()) / 86_400_000)
    : null;

  // ── Type labels (commercial, no technical terms) ───────────────────────────
  const bigTypeLabel =
    lt === "trial"         ? "فترة تجريبية"
    : lt === "lifetime"    ? "ترخيص دائم"
    : isValid              ? "اشتراك مفعّل"
    : isExpired            ? "انتهت الصلاحية"
    : isSlate              ? "غير مفعّل"
    : isInvalid            ? "ترخيص غير صالح"
    : isDateTamper         ? "خطأ في الساعة"
    : "غير محدد";

  const statusBadge =
    isActive && !isTrial ? { label: "مفعّل ✓",           cls: "bg-green-500/20 text-green-200 border-green-400/30" }
    : isTrial            ? { label: "تجريبي",             cls: "bg-[#C9A84C]/20 text-[#E8C97E] border-[#C9A84C]/30" }
    : isExpired          ? { label: "منتهٍ",              cls: "bg-red-400/20 text-red-200 border-red-400/30" }
    : isSlate            ? { label: "غير مفعّل",          cls: "bg-white/10 text-white/60 border-white/20" }
    : isInvalid          ? { label: "غير صالح",           cls: "bg-red-400/20 text-red-200 border-red-400/30" }
    : isDateTamper       ? { label: "تلاعب بالتاريخ",    cls: "bg-orange-400/20 text-orange-200 border-orange-400/30" }
    : { label: "غير محدد",                                cls: "bg-white/10 text-white/60 border-white/20" };

  const ShieldIcon =
    (isActive && !isTrial) ? ShieldCheck
    : isTrial              ? ShieldCheck
    : isSlate              ? ShieldQuestion
    : isExpired            ? ShieldAlert
    : ShieldOff;

  const daysColor =
    days === null  ? "text-white"
    : days <= 7    ? "text-red-300"
    : days <= 30   ? "text-[#E8C97E]"
    : "text-green-300";

  // Commercial status messages
  const statusMessage =
    isSlate      ? "البرنامج غير مفعّل. يرجى إدخال كود التفعيل أو استيراد ملف الترخيص للمتابعة."
    : isTrial    ? "هذه نسخة تجريبية محدودة المدة."
    : isExpired  ? "انتهت صلاحية الترخيص. يرجى التواصل مع مزود النظام للتجديد."
    : isInvalid  ? "ملف الترخيص غير صالح أو تم تعديله. يرجى التواصل مع مزود النظام."
    : isDateTamper ? "يوجد خطأ في إعدادات التاريخ والوقت. يرجى مراجعة إعدادات الجهاز."
    : null;

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-auto bg-[#FAF7F0]" dir="rtl">
      <div className="p-5 space-y-4 w-full">

        {/* ══ PAGE HEADER ════════════════════════════════════════════════════ */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1B2B5C] flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-[#1B2B5C] leading-none">الترخيص والتفعيل</h1>
                <p className="text-xs text-[#6B7280] mt-0.5">إدارة حالة ترخيص النظام وتفعيل النسخة</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => { refetch(); setNotice(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#C9A84C]/30 bg-white text-[#1B2B5C] text-xs font-semibold hover:bg-[#FAF7F0] transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> تحديث الحالة
          </button>
        </div>

        {/* ══ NOTICE ═══════════════════════════════════════════════════════ */}
        {notice && (
          <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 border ${
            notice.ok
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}>
            {notice.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" /> : <XCircle className="w-4 h-4 shrink-0 text-red-500" />}
            <span className="flex-1">{notice.msg}</span>
            <button onClick={() => setNotice(null)} className="text-xl leading-none opacity-40 hover:opacity-80">×</button>
          </div>
        )}

        {/* ══ STATUS CARD — full width ═════════════════════════════════════ */}
        <Card>
          {/* Navy header */}
          <div className="bg-[#1B2B5C] px-6 py-4">
            <div className="flex items-center gap-4">
              {/* Shield */}
              <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                <ShieldIcon className="w-7 h-7 text-white" />
              </div>

              {/* Type label + package */}
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-semibold text-white/45 uppercase tracking-widest mb-0.5">نوع النسخة</p>
                <h2 className="text-2xl font-black text-white leading-none">{bigTypeLabel}</h2>
                {p && (
                  <p className="text-sm text-white/55 mt-0.5 font-medium">
                    {p.package_name ?? "Standard"}{p.customer_name ? ` — ${p.customer_name}` : ""}
                  </p>
                )}
              </div>

              {/* Status badge */}
              <span className={`shrink-0 px-4 py-1.5 rounded-full border text-sm font-bold ${statusBadge.cls}`}>
                {statusBadge.label}
              </span>

              {/* Days counter (when license exists) */}
              {p && (
                <div className="shrink-0 flex flex-col items-center justify-center gap-1 bg-white/8 border border-white/15 rounded-2xl px-5 py-3 min-w-[100px] text-center">
                  {isLifetime ? (
                    <>
                      <InfinityIcon className="w-8 h-8 text-white" />
                      <span className="text-[9px] text-white/50 font-medium">ترخيص دائم</span>
                    </>
                  ) : (
                    <>
                      <span className={`text-4xl font-black leading-none ${daysColor}`}>{days}</span>
                      <span className="text-[9px] text-white/45 text-center font-medium">يوم متبقٍّ</span>
                      {days !== null && days <= 30 && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                          days <= 7 ? "bg-red-400/25 text-red-200" : "bg-[#C9A84C]/25 text-[#E8C97E]"
                        }`}>{days <= 7 ? "⚠ عاجل" : "قريبًا"}</span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* IDs grid (inside navy header when license exists) */}
            {p && (
              <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
                <InfoCellNav label="Organization ID"  value={p.org_id}         copyId="oid" ck={ck} copy={copy} />
                <InfoCellNav label="License ID"       value={p.license_id}     copyId="lid" ck={ck} copy={copy} />
                <InfoCellNav label="Activation ID"    value={p.activation_id}  copyId="aid" ck={ck} copy={copy} />
                <InfoCellNav label="Device ID"        value={p.device_id || devInfo?.device_id} copyId="did" ck={ck} copy={copy} />
                <InfoCellNav label="تاريخ التفعيل"   value={fmtDate(p.start_date)} />
                <InfoCellNav label="تاريخ الانتهاء"  value={isLifetime ? "دائم" : fmtDate(p.expiry_date)} />
                <InfoCellNav label="الجهة المصدرة"   value={p.issued_by} />
                {p.customer_name && <InfoCellNav label="اسم المؤسسة" value={p.customer_name} />}
              </div>
            )}
          </div>

          {/* White body — error/empty states */}
          {!p && statusMessage && (
            <div className="px-6 py-5">
              <div className={`flex items-start gap-3 rounded-xl px-4 py-3.5 border ${
                isSlate    ? "bg-[#FAF7F0] border-[#C9A84C]/25"
                : isInvalid || isDateTamper ? "bg-red-50 border-red-200"
                : isExpired ? "bg-red-50 border-red-200"
                : "bg-[#FAF7F0] border-[#C9A84C]/25"
              }`}>
                <Info className={`w-4 h-4 mt-0.5 shrink-0 ${isInvalid || isExpired || isDateTamper ? "text-red-500" : "text-[#C9A84C]"}`} />
                <p className={`text-sm leading-relaxed ${isInvalid || isExpired || isDateTamper ? "text-red-800" : "text-[#4A5568]"}`}>
                  {statusMessage}
                </p>
              </div>
              {isInvalid && (
                <div className="mt-3 flex items-start gap-3 rounded-xl px-4 py-3 border bg-amber-50 border-amber-200">
                  <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    لا تحاول تعديل ملف الترخيص يدوياً — أي تعديل سيُبطل التوقيع الرقمي ويُوقف عمل النظام.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Trial info banner */}
          {isTrial && p && (
            <div className="border-t border-[#C9A84C]/20 bg-[#FFF8E8] px-6 py-3.5">
              <div className="flex items-center gap-2 mb-2.5">
                <Timer className="w-4 h-4 text-[#C9A84C] shrink-0" />
                <span className="text-sm font-bold text-[#8B6914]">تفاصيل الفترة التجريبية</span>
                <span className="text-xs text-[#C9A84C]/70 mr-auto">قابلة للتحديث إلى ترخيص كامل</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-[9px] text-[#C9A84C]/70 uppercase tracking-wider mb-0.5 font-semibold">مدة التجربة</p>
                  <p className="font-bold text-[#1B2B5C]">{trialDuration} يوم</p>
                </div>
                <div>
                  <p className="text-[9px] text-[#C9A84C]/70 uppercase tracking-wider mb-0.5 font-semibold">تاريخ البداية</p>
                  <p className="font-semibold text-[#1B2B5C]">{fmtDate(p.start_date)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-[#C9A84C]/70 uppercase tracking-wider mb-0.5 font-semibold">تاريخ النهاية</p>
                  <p className="font-semibold text-[#1B2B5C]">{fmtDate(p.expiry_date)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-[#C9A84C]/70 uppercase tracking-wider mb-0.5 font-semibold">الأيام المتبقية</p>
                  <p className={`text-2xl font-black leading-none ${
                    (days ?? 0) <= 7 ? "text-red-600" : (days ?? 0) <= 14 ? "text-amber-600" : "text-[#1B2B5C]"
                  }`}>{days}</p>
                </div>
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
                <div>
                  <p className="text-[9px] text-red-400/70 uppercase tracking-wider mb-0.5">تاريخ البداية</p>
                  <p className="font-semibold text-red-800">{fmtDate(p.start_date)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-red-400/70 uppercase tracking-wider mb-0.5">تاريخ الانتهاء</p>
                  <p className="font-semibold text-red-800">{fmtDate(p.expiry_date)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-red-400/70 uppercase tracking-wider mb-0.5">الإجراء المطلوب</p>
                  <p className="font-semibold text-red-800">التواصل مع مزود النظام</p>
                </div>
              </div>
            </div>
          )}

          {/* Active success bar */}
          {isValid && !isTrial && (
            <div className="border-t border-green-200 bg-green-50 px-6 py-2.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <span className="text-sm font-semibold text-green-800">الترخيص مفعّل — جميع خدمات النظام تعمل بشكل طبيعي.</span>
            </div>
          )}
        </Card>

        {/* ══ ROW 2: LIMITS + MODULES ════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── حدود الترخيص ──────────────────────────────────────────── */}
          <Card>
            <CardHeader icon={<span className="text-base">🏅</span>} title="حدود الترخيص" />
            <div className="p-5">
              {p ? (
                <div className="space-y-5">
                  <LimitRow label="المستخدمون"  current={curUsers}    max={p.max_users}    icon={<Users className="w-3.5 h-3.5"/>} />
                  <LimitRow label="الفروع"       current={curBranches} max={p.max_branches} icon={<GitBranch className="w-3.5 h-3.5"/>} />
                  <LimitRow label="نقاط البيع"  current={0}           max={p.max_pos}      icon={<MonitorSmartphone className="w-3.5 h-3.5"/>} />
                  <LimitRow label="الأجهزة"      current={0}           max={p.max_devices}  icon={<Fingerprint className="w-3.5 h-3.5"/>} />

                  <div className="pt-3 border-t border-[#C9A84C]/15">
                    <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-2">صلاحيات الوصول</p>
                    <div className="space-y-2">
                      <AccessBadge label="واجهة الويب"    value={p.web_allowed}             icon={<Globe   className="w-3.5 h-3.5"/>} />
                      <AccessBadge label="سطح المكتب"     value={p.desktop_allowed ?? true}  icon={<Monitor className="w-3.5 h-3.5"/>} />
                      <AccessBadge label="وضع الأوفلاين"  value={p.offline_allowed}          icon={<WifiOff className="w-3.5 h-3.5"/>} />
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

          {/* ── الموديولات ────────────────────────────────────────────── */}
          <Card>
            <CardHeader
              icon={<span className="text-base">📦</span>}
              title="الموديولات المفعّلة"
              badge={p ? (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                  {mods.size} / {MODULES.length}
                </span>
              ) : undefined}
            />
            <div className="p-5">
              <div className="grid grid-cols-3 gap-2.5">
                {MODULES.map(m => (
                  <ModuleChip key={m.id} label={m.label} icon={m.icon} enabled={!!p && mods.has(m.id)} />
                ))}
              </div>
              {!p && (
                <p className="text-center text-xs text-[#9CA3AF] mt-3">
                  فعّل الترخيص لعرض الموديولات المتاحة
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* ══ ROW 3: ACTIVATION + DEVICE ════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── كارت التفعيل ──────────────────────────────────────────── */}
          <Card>
            <CardHeader icon={<KeyRound className="w-4 h-4"/>} title="تفعيل الترخيص" />
            <div className="p-5 space-y-4">

              {/* Tabs */}
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "code",  label1: "إدخال كود",  label2: "التفعيل" },
                  { key: "file",  label1: "استيراد",    label2: "license.ons" },
                  { key: "trial", label1: "فترة",       label2: "تجريبية" },
                ] as const).map(t => (
                  <button
                    key={t.key}
                    onClick={() => { setTab(t.key); setNotice(null); }}
                    className={`flex flex-col items-center gap-0.5 py-2.5 px-2 rounded-xl border text-center text-[10px] font-bold leading-tight transition-all ${
                      tab === t.key
                        ? "bg-[#1B2B5C] text-white border-[#1B2B5C] shadow-sm"
                        : "bg-[#FAF7F0] border-[#C9A84C]/25 text-[#4A5568] hover:bg-[#F0EBE0] hover:border-[#C9A84C]/50"
                    }`}
                  >
                    <span>{t.label1}</span>
                    <span className={tab === t.key ? "text-white/70" : "text-[#C9A84C]"}>{t.label2}</span>
                  </button>
                ))}
              </div>

              {/* ── Code tab ── */}
              {tab === "code" && (
                <div className="space-y-3">
                  <p className="text-xs text-[#6B7280]">أدخل كود التفعيل الذي حصلت عليه من مزود النظام.</p>
                  <textarea
                    value={activCode}
                    onChange={e => setActivCode(e.target.value)}
                    rows={5}
                    placeholder="الصق كود التفعيل هنا..."
                    className="w-full text-[10px] font-mono border border-[#C9A84C]/25 rounded-xl p-3 bg-[#FAF7F0] text-[#1B2B5C] focus:outline-none focus:border-[#1B2B5C]/40 resize-none leading-relaxed"
                    dir="ltr"
                  />
                  <NavyButton
                    onClick={() => { setNotice(null); byCode.mutate({ code: activCode.trim() }); }}
                    disabled={!activCode.trim() || byCode.isPending}
                    className="w-full"
                  >
                    <KeyRound className="w-4 h-4" />
                    {byCode.isPending ? "جارٍ التحقق..." : "تفعيل الآن"}
                  </NavyButton>
                </div>
              )}

              {/* ── File tab ── */}
              {tab === "file" && (
                <div className="space-y-3">
                  <p className="text-xs text-[#6B7280]">استورد ملف الترخيص (.ons) الصادر من مزود النظام.</p>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-[#C9A84C]/35 rounded-xl p-5 text-center cursor-pointer hover:border-[#1B2B5C]/30 hover:bg-[#F0EBE0] transition-colors"
                  >
                    <FileUp className="w-7 h-7 mx-auto text-[#C9A84C] mb-1.5" />
                    {fileName ? (
                      <><p className="text-xs font-bold text-[#1B2B5C]">{fileName}</p><p className="text-[10px] text-green-600 mt-0.5">✓ جاهز للاستيراد</p></>
                    ) : (
                      <p className="text-xs text-[#6B7280]">اضغط لاختيار ملف .ons</p>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept=".ons,.json" className="hidden" onChange={onFile} />
                  <NavyButton
                    onClick={() => { setNotice(null); byFile.mutate({ content: fileContent }); }}
                    disabled={!fileContent || byFile.isPending}
                    className="w-full"
                  >
                    <UploadCloud className="w-4 h-4" />
                    {byFile.isPending ? "جارٍ التحقق..." : "استيراد وتفعيل"}
                  </NavyButton>
                </div>
              )}

              {/* ── Trial tab ── */}
              {tab === "trial" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[#C9A84C]/25 bg-[#FFF8E8] px-4 py-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <Timer className="w-4 h-4 text-[#C9A84C] shrink-0" />
                      <span className="text-sm font-bold text-[#8B6914]">الفترة التجريبية</span>
                    </div>
                    <p className="text-xs text-[#6B7280] leading-relaxed">
                      الفترة التجريبية تتطلب ملف ترخيص تجريبي موقّع يُصدره مزود النظام.
                      تواصل مع مزود النظام وأرسل Device ID الخاص بجهازك للحصول على ملف التجربة.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-[#C9A84C] uppercase tracking-wide">الخطوات</p>
                    {[
                      "انسخ Device ID أدناه",
                      "أرسله لمزود النظام",
                      "استلم ملف الترخيص التجريبي",
                      "استورده من تبويب «استيراد»",
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-xs text-[#4A5568]">
                        <span className="w-5 h-5 rounded-full bg-[#1B2B5C] text-white text-[9px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                        {s}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <OutlineButton
                      onClick={() => devInfo?.device_id && copy(devInfo.device_id, "did-trial")}
                      className="flex-1 text-xs py-2"
                    >
                      {ck === "did-trial" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      نسخ Device ID
                    </OutlineButton>
                    <OutlineButton
                      onClick={() => { genReq.mutate({ org_id: "" }); }}
                      disabled={genReq.isPending}
                      className="flex-1 text-xs py-2"
                    >
                      <ClipboardCopy className="w-3.5 h-3.5" />
                      توليد كود الطلب
                    </OutlineButton>
                  </div>
                  {reqCode && (
                    <div className="space-y-1">
                      <div className="flex items-start gap-2">
                        <textarea readOnly value={reqCode} rows={3}
                          className="flex-1 text-[9px] font-mono bg-[#FAF7F0] rounded-xl p-2.5 border border-[#C9A84C]/25 resize-none select-all"
                          dir="ltr"
                        />
                        <button onClick={() => copy(reqCode, "rq")} className="p-2.5 rounded-xl border border-[#C9A84C]/25 hover:bg-[#FAF7F0] text-[#C9A84C] shrink-0 mt-0.5 transition-colors">
                          {ck === "rq" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Success bar */}
              {isValid && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
                  الترخيص مفعّل — لا حاجة لإعادة التفعيل.
                </div>
              )}
            </div>
          </Card>

          {/* ── معلومات الجهاز ────────────────────────────────────────── */}
          <Card>
            <CardHeader icon={<Fingerprint className="w-4 h-4"/>} title="معلومات الجهاز" />
            <div className="p-5 space-y-4">

              {/* Device ID */}
              <div>
                <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1.5">Device ID</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-[#FAF7F0] border border-[#C9A84C]/25 rounded-xl px-3 py-2.5 text-[#1B2B5C] select-all break-all">
                    {devInfo?.device_id ?? "جارٍ التحميل..."}
                  </code>
                  <button
                    onClick={() => devInfo?.device_id && copy(devInfo.device_id, "dv")}
                    className="p-2.5 rounded-xl border border-[#C9A84C]/25 hover:bg-[#FAF7F0] text-[#C9A84C] shrink-0 transition-colors"
                  >
                    {ck === "dv" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Hardware fingerprint */}
              {devInfo?.hw_fingerprint && (
                <div>
                  <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1.5">Hardware Fingerprint</p>
                  <code className="block text-[10px] font-mono bg-[#FAF7F0] border border-[#C9A84C]/25 rounded-xl px-3 py-2 text-[#6B7280] break-all">
                    {devInfo.hw_fingerprint}
                  </code>
                </div>
              )}

              {/* Device status */}
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold ${
                isValid
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-[#FAF7F0] border-[#C9A84C]/25 text-[#6B7280]"
              }`}>
                {isValid
                  ? <><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> الجهاز مرتبط بترخيص صالح</>
                  : <><XCircle className="w-4 h-4 text-[#C9A84C]/50 shrink-0" /> الجهاز غير مرتبط بأي ترخيص نشط</>
                }
              </div>

              {/* Request Code */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider">كود الطلب</p>
                  <button
                    onClick={() => genReq.mutate({ org_id: "" })}
                    disabled={genReq.isPending}
                    className="text-[10px] font-semibold text-[#1B2B5C] hover:text-[#243875] flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {genReq.isPending ? "جارٍ..." : "توليد"}
                  </button>
                </div>
                {reqCode ? (
                  <div className="flex items-start gap-2">
                    <textarea readOnly value={reqCode} rows={4}
                      className="flex-1 text-[9px] font-mono bg-[#FAF7F0] rounded-xl p-2.5 border border-[#C9A84C]/25 resize-none select-all"
                      dir="ltr"
                    />
                    <button onClick={() => copy(reqCode, "rq2")} className="p-2.5 rounded-xl border border-[#C9A84C]/25 hover:bg-[#FAF7F0] text-[#C9A84C] shrink-0 mt-0.5 transition-colors">
                      {ck === "rq2" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#FAF7F0] border border-[#C9A84C]/25 rounded-xl px-3 py-3 text-xs text-[#9CA3AF] text-center">
                    اضغط «توليد» لإنشاء كود الطلب الخاص بهذا الجهاز
                  </div>
                )}
              </div>

              {/* Contact provider */}
              <div className="flex items-start gap-2 rounded-xl bg-[#FAF7F0] border border-[#C9A84C]/20 px-3 py-3 text-xs text-[#6B7280]">
                <Phone className="w-3.5 h-3.5 text-[#C9A84C] shrink-0 mt-0.5" />
                <span>أرسل Device ID أو كود الطلب لمزود النظام للحصول على ملف الترخيص.</span>
              </div>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
