import { useState, useRef } from "react";
import { trpc } from "@/shared/lib/trpc";
import {
  ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion,
  Copy, Check, RefreshCw, KeyRound, FileUp,
  Users, GitBranch, MonitorSmartphone, Fingerprint,
  Globe, Monitor, WifiOff, Lock, CheckCircle2, XCircle,
  Terminal, UploadCloud, ClipboardCopy, Info,
  Timer, Infinity as InfinityIcon, AlertTriangle,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────
const MODULES = [
  { id: "sales",         label: "المبيعات",        icon: "🛒" },
  { id: "purchases",     label: "المشتريات",       icon: "📦" },
  { id: "inventory",     label: "المخزون",         icon: "🏪" },
  { id: "accounting",    label: "الحسابات",        icon: "📊" },
  { id: "pos",           label: "نقاط البيع",      icon: "🖥️" },
  { id: "reports",       label: "التقارير",        icon: "📈" },
  { id: "zatca",         label: "ZATCA",           icon: "🏛️" },
  { id: "manufacturing", label: "التصنيع",         icon: "⚙️" },
  { id: "hr",            label: "الموارد البشرية", icon: "👥" },
];

type LicType = "trial" | "subscription" | "lifetime" | undefined;

function deriveLicType(lt?: LicType, exp?: string): LicType {
  if (lt) return lt;
  if (!exp) return undefined;
  return exp >= "2099-01-01" ? "lifetime" : "subscription";
}

function daysLeft(exp: string): number {
  return Math.max(0, Math.ceil((new Date(exp + "T23:59:59Z").getTime() - Date.now()) / 86_400_000));
}

function fmtDate(d?: string | null, full = false) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: full ? "long" : "2-digit",
      day: "2-digit",
    });
  } catch { return d; }
}

// ─── useCopy ─────────────────────────────────────────────────────────────────
function useCopy() {
  const [k, setK] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => { setK(key); setTimeout(() => setK(null), 2000); });
  };
  return { ck: k, copy };
}

// ─── InfoCell (inside gradient card) ─────────────────────────────────────────
function InfoCell({ label, value, copyId, ck, copy }: {
  label: string; value?: string | null;
  copyId?: string; ck?: string | null;
  copy?: (v: string, k: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] font-semibold text-white/45 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-white/90 truncate">{value ?? "—"}</span>
        {copyId && value && copy && (
          <button onClick={() => copy(value, copyId)} className="text-white/35 hover:text-white transition-colors shrink-0">
            {ck === copyId ? <Check className="w-3 h-3 text-green-300" /> : <Copy className="w-3 h-3" />}
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
  const barColor = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-blue-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">{icon}<span>{label}</span></div>
        <div className="flex items-center gap-0.5">
          <span className={`font-bold text-sm ${pct >= 90 ? "text-red-600" : "text-foreground"}`}>{current}</span>
          <span className="text-muted-foreground text-xs"> / {max}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{pct}% مستخدَم</span>
        <span>{Math.max(0, max - current)} متاح</span>
      </div>
    </div>
  );
}

// ─── BoolBadge ───────────────────────────────────────────────────────────────
function BoolBadge({ label, value, icon }: {
  label: string; value?: boolean | null; icon: React.ReactNode;
}) {
  const on = value === true;
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium ${
      on ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300"
         : "bg-muted/50 border-border text-muted-foreground"
    }`}>
      <div className="flex items-center gap-2">{icon}<span>{label}</span></div>
      <span className={on ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>{on ? "✓ مفعّل" : "✕ غير مفعّل"}</span>
    </div>
  );
}

// ─── ModuleChip ──────────────────────────────────────────────────────────────
function ModuleChip({ label, icon, enabled }: { label: string; icon: string; enabled: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border text-center transition-colors ${
      enabled ? "bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800"
              : "bg-muted/30 border-border opacity-50"
    }`}>
      <span className="text-lg leading-none">{icon}</span>
      <span className={`text-[9px] font-semibold leading-tight ${
        enabled ? "text-green-800 dark:text-green-300" : "text-muted-foreground"
      }`}>{label}</span>
      {enabled
        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
        : <Lock className="w-3 h-3 text-muted-foreground" />
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function LicenseActivationPage() {
  const [tab,         setTab]         = useState<"code" | "file" | "request">("code");
  const [activCode,   setActivCode]   = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileName,    setFileName]    = useState("");
  const [reqOrgId,    setReqOrgId]    = useState("");
  const [reqCode,     setReqCode]     = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { ck, copy } = useCopy();

  const utils = trpc.useUtils();
  const { data: status, refetch } = trpc.license.getStatus.useQuery(undefined, { retry: false });
  const { data: devInfo }         = trpc.license.getDeviceInfo.useQuery(undefined, { retry: false });
  const { data: stats }           = trpc.license.getCurrentStats.useQuery(undefined, { retry: false });

  const genReq = trpc.license.generateRequestCode.useMutation({
    onSuccess: d => { setReqCode(d.code); setTab("request"); },
    onError:   e => setNotice({ ok: false, msg: e.message }),
  });
  const byCode = trpc.license.activateByCode.useMutation({
    onSuccess: d => {
      setNotice({ ok: true, msg: `✅ تم التفعيل — ${d.customer}` });
      setActivCode("");
      utils.license.getStatus.invalidate(); refetch();
    },
    onError: e => setNotice({ ok: false, msg: e.message }),
  });
  const byFile = trpc.license.activateByFile.useMutation({
    onSuccess: d => {
      setNotice({ ok: true, msg: `✅ تم التفعيل — ${d.customer}` });
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

  // ── Derived state ───────────────────────────────────────────────────────────
  const p           = status?.payload;
  const isValid     = !!status?.valid;
  const err         = status?.error as string | null | undefined;
  const lt          = deriveLicType(p?.license_type as LicType, p?.expiry_date);
  const days        = p?.expiry_date && lt !== "lifetime" ? daysLeft(p.expiry_date) : null;
  const curUsers    = stats?.current_users ?? 0;
  const curBranches = (stats as { current_branches?: number } | undefined)?.current_branches ?? 0;
  const mods        = new Set(p?.enabled_modules ?? []);

  // ── Status booleans ─────────────────────────────────────────────────────────
  const isTrial    = isValid && lt === "trial";
  const isLifetime = isValid && lt === "lifetime";
  const isActive   = isValid && !isTrial;
  const isSlate    = !isValid && err === "license_not_found";
  const isExpired  = !isValid && err === "expired";
  const isInvalid  = !isValid && (err === "invalid_signature" || err === "unknown_algorithm" || err === "unknown_kid" || err === "invalid_json");
  const isDateTamper = !isValid && err === "date_manipulation_suspected";

  // ── Trial duration (total days from start to expiry) ────────────────────────
  const trialDuration = p?.start_date && p?.expiry_date && isTrial
    ? Math.ceil((new Date(p.expiry_date + "T23:59:59Z").getTime() - new Date(p.start_date + "T00:00:00Z").getTime()) / 86_400_000)
    : null;

  // ── BIG type label (shown at top of card, very prominent) ──────────────────
  const bigTypeLabel =
    lt === "trial"           ? "نسخة تجريبية"
    : lt === "lifetime"      ? "ترخيص دائم"
    : lt === "subscription" && isValid ? "اشتراك سنوي"
    : isExpired && lt === "trial"      ? "نسخة تجريبية — منتهية"
    : isExpired              ? "اشتراك منتهٍ"
    : isSlate                ? "غير مفعّل"
    : isInvalid              ? "ترخيص غير صالح"
    : isDateTamper           ? "تلاعب بالتاريخ"
    : "غير محدد";

  // ── Status badge label ──────────────────────────────────────────────────────
  const statusBadge = isActive
    ? { label: "مفعّل",            cls: "bg-white/20 text-white border-white/30" }
    : isTrial
    ? { label: "نشط",              cls: "bg-amber-300/20 text-amber-200 border-amber-300/30" }
    : isExpired
    ? { label: "انتهت الصلاحية",  cls: "bg-red-300/20 text-red-200 border-red-300/30" }
    : isSlate
    ? { label: "غير مفعّل",       cls: "bg-white/10 text-white/70 border-white/20" }
    : isInvalid
    ? { label: "غير صالح",         cls: "bg-red-300/20 text-red-200 border-red-300/30" }
    : isDateTamper
    ? { label: "تلاعب مكتشف",     cls: "bg-orange-300/20 text-orange-200 border-orange-300/30" }
    : { label: "غير محدد",         cls: "bg-white/10 text-white/60 border-white/20" };

  // ── Gradient ────────────────────────────────────────────────────────────────
  const gradient =
    isActive   ? "from-green-700 to-green-900"
    : isTrial  ? "from-amber-600 to-amber-800"
    : isExpired ? "from-red-600 to-red-900"
    : isSlate   ? "from-slate-600 to-slate-800"
    : isDateTamper ? "from-orange-700 to-orange-900"
    : "from-red-700 to-red-900";

  const ShieldIcon =
    isActive   ? ShieldCheck
    : isTrial  ? ShieldCheck
    : isSlate  ? ShieldQuestion
    : isExpired ? ShieldAlert
    : ShieldOff;

  const daysColor =
    days === null  ? "text-white"
    : days <= 7    ? "text-red-300"
    : days <= 30   ? "text-amber-300"
    : "text-white";

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-auto" dir="rtl">
      <div className="p-4 space-y-4 w-full">

        {/* ══ PAGE HEADER ══════════════════════════════════════════════════════ */}
        <div className="flex items-start justify-between w-full">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              <h2 className="erp-page-title">الترخيص والتفعيل</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              إدارة ترخيص النظام وتفعيله والاطلاع على حالة الاشتراك والقيود
            </p>
          </div>
          <button
            onClick={() => { refetch(); setNotice(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> تحديث الحالة
          </button>
        </div>

        {/* ══ NOTICE ═══════════════════════════════════════════════════════════ */}
        {notice && (
          <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 border w-full ${
            notice.ok
              ? "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800"
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800"
          }`}>
            {notice.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{notice.msg}</span>
            <button onClick={() => setNotice(null)} className="text-xl leading-none opacity-40 hover:opacity-80">×</button>
          </div>
        )}

        {/* ══ STATUS CARD ══════════════════════════════════════════════════════ */}
        <div className={`w-full rounded-2xl bg-gradient-to-l ${gradient} shadow-lg overflow-hidden`}>

          {/* ── TYPE HEADER (most prominent section) ── */}
          <div className="flex items-center gap-4 px-5 pt-5 pb-4 border-b border-white/15">
            {/* Shield icon */}
            <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldIcon className="w-8 h-8 text-white drop-shadow" />
            </div>

            {/* TYPE LABEL (big) + package */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-white/45 uppercase tracking-widest mb-0.5">نوع النسخة</p>
              <h2 className="text-3xl font-black text-white leading-none tracking-tight">{bigTypeLabel}</h2>
              {p && (
                <p className="text-sm text-white/60 mt-1 font-medium">
                  {p.package_name ?? "Standard"}{p.customer_name ? ` — ${p.customer_name}` : ""}
                </p>
              )}
            </div>

            {/* Status badge */}
            <span className={`shrink-0 px-4 py-1.5 rounded-full border text-sm font-bold ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>

            {/* Days counter OR Infinity */}
            {p && (
              <div className="shrink-0 flex flex-col items-center justify-center gap-1 bg-white/10 border border-white/20 rounded-2xl px-5 py-3 min-w-[90px] backdrop-blur-sm">
                {isLifetime ? (
                  <>
                    <InfinityIcon className="w-9 h-9 text-white" />
                    <span className="text-[9px] text-white/50 font-medium">دائم</span>
                  </>
                ) : (
                  <>
                    <span className={`text-4xl font-black leading-none ${daysColor}`}>{days}</span>
                    <span className="text-[9px] text-white/50 text-center">يوم متبقٍّ</span>
                    {days !== null && days <= 30 && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                        days <= 7 ? "bg-red-400/30 text-red-200" : "bg-amber-400/30 text-amber-200"
                      }`}>{days <= 7 ? "⚠ عاجل" : "قريبًا"}</span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── BODY: full details when license exists ── */}
          {p && (
            <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
              <InfoCell label="Organization ID"   value={p.org_id}          copyId="oid" ck={ck} copy={copy} />
              <InfoCell label="License ID"        value={p.license_id}      copyId="lid" ck={ck} copy={copy} />
              <InfoCell label="Activation ID"     value={p.activation_id}   copyId="aid" ck={ck} copy={copy} />
              <InfoCell label="Device ID"         value={p.device_id || devInfo?.device_id} copyId="did" ck={ck} copy={copy} />
              <InfoCell label="تاريخ البداية"    value={fmtDate(p.start_date, true)} />
              <InfoCell
                label="تاريخ الانتهاء"
                value={isLifetime ? "دائم — لا ينتهي" : fmtDate(p.expiry_date, true)}
              />
              <InfoCell label="الجهة المصدرة"    value={p.issued_by} />
              {p.issued_at && (
                <InfoCell label="تاريخ الإصدار"  value={fmtDate(p.issued_at?.slice(0, 10), true)} />
              )}
            </div>
          )}

          {/* ── BODY: error/empty states ── */}
          {!p && (
            <div className="px-5 py-5">
              {isSlate && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xl font-black text-white">البرنامج غير مفعّل</p>
                    <p className="text-sm text-white/75 mt-1">
                      يرجى إدخال كود التفعيل أو استيراد ملف الترخيص من مزود النظام.
                    </p>
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
                    <p className="text-sm text-white/75 mt-1">
                      يرجى التواصل مع مزود النظام للحصول على ملف ترخيص صالح.
                    </p>
                  </div>
                  <div className="flex items-start gap-2 bg-red-500/15 border border-red-300/20 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 text-red-300 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-200/80 leading-relaxed">
                      لا تحاول تعديل ملف الترخيص يدوياً. أي تعديل سيُبطل التوقيع الرقمي
                      ويُوقف عمل النظام بالكامل.
                    </p>
                  </div>
                </div>
              )}
              {isDateTamper && (
                <div className="space-y-2">
                  <p className="text-xl font-black text-white">تم اكتشاف تلاعب بتاريخ الجهاز</p>
                  <p className="text-sm text-white/75">
                    يُرجى التحقق من إعدادات الساعة والتاريخ على هذا الجهاز، ثم أعد تشغيل النظام.
                  </p>
                </div>
              )}
              {isExpired && (
                <div className="space-y-2">
                  <p className="text-xl font-black text-white">انتهت صلاحية الترخيص</p>
                  <p className="text-sm text-white/75">
                    {lt === "trial"
                      ? "انتهت الفترة التجريبية. تواصل مع مزود النظام للحصول على ترخيص دائم."
                      : "انتهت صلاحية الترخيص. تواصل مع مزود النظام للتجديد."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── TRIAL INFO BANNER ── */}
          {isTrial && p && (
            <div className="border-t border-amber-400/20 bg-amber-500/15 px-5 py-3.5">
              <div className="flex items-center gap-2 mb-2.5">
                <Timer className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="text-sm font-bold text-amber-100">تفاصيل الفترة التجريبية</span>
                <span className="text-xs text-amber-200/60 mr-auto">هذه نسخة تجريبية محدودة — قابلة للتحديث إلى ترخيص كامل</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

          {/* ── EXPIRED banner (has payload with expiry data) ── */}
          {isExpired && p && (
            <div className="border-t border-red-400/20 bg-red-500/15 px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />
                <span className="text-sm font-bold text-red-100">الترخيص منتهٍ</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-[9px] text-red-200/50 uppercase tracking-wider mb-0.5">تاريخ البداية</p>
                  <p className="text-red-100 font-medium">{fmtDate(p.start_date, true)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-red-200/50 uppercase tracking-wider mb-0.5">تاريخ الانتهاء</p>
                  <p className="text-red-100 font-medium">{fmtDate(p.expiry_date, true)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-red-200/50 uppercase tracking-wider mb-0.5">منذ الانتهاء</p>
                  <p className="text-red-200 font-medium">انتهى</p>
                </div>
              </div>
              <p className="text-xs text-red-200/70 mt-2">
                {lt === "trial" ? "تواصل مع مزود النظام للحصول على ترخيص دائم." : "تواصل مع مزود النظام لتجديد الاشتراك."}
              </p>
            </div>
          )}
        </div>

        {/* ══ 3-COLUMN GRID ════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full">

          {/* ── حدود الترخيص ─────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <span className="text-base">🏅</span>
              <span className="font-semibold text-sm">حدود الترخيص</span>
            </div>

            {p ? (
              <>
                <div className="space-y-5">
                  <LimitRow
                    label="المستخدمون"
                    current={curUsers}
                    max={p.max_users}
                    icon={<Users className="w-3.5 h-3.5" />}
                  />
                  <LimitRow
                    label="الفروع"
                    current={curBranches}
                    max={p.max_branches}
                    icon={<GitBranch className="w-3.5 h-3.5" />}
                  />
                  <LimitRow
                    label="نقاط البيع"
                    current={0}
                    max={p.max_pos}
                    icon={<MonitorSmartphone className="w-3.5 h-3.5" />}
                  />
                  <LimitRow
                    label="الأجهزة"
                    current={0}
                    max={p.max_devices}
                    icon={<Fingerprint className="w-3.5 h-3.5" />}
                  />
                </div>
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">صلاحيات الوصول</p>
                  <BoolBadge label="واجهة الويب"    value={p.web_allowed}             icon={<Globe   className="w-3.5 h-3.5" />} />
                  <BoolBadge label="سطح المكتب"     value={p.desktop_allowed ?? true} icon={<Monitor className="w-3.5 h-3.5" />} />
                  <BoolBadge label="وضع الأوفلاين"  value={p.offline_allowed}         icon={<WifiOff className="w-3.5 h-3.5" />} />
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

          {/* ── الموديولات ───────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <span className="text-base">📦</span>
              <span className="font-semibold text-sm">الموديولات المفعّلة</span>
              {p && (
                <span className="mr-auto text-xs font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  {mods.size} / {MODULES.length}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {MODULES.map(m => (
                <ModuleChip key={m.id} label={m.label} icon={m.icon} enabled={!!p && mods.has(m.id)} />
              ))}
            </div>

            {!p && (
              <p className="text-center text-xs text-muted-foreground pt-1">
                فعّل الترخيص لرؤية الموديولات المتاحة
              </p>
            )}
          </div>

          {/* ── التفعيل ──────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <span className="text-base">🔑</span>
              <span className="font-semibold text-sm">تفعيل الترخيص</span>
            </div>

            {/* Tab buttons */}
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { key: "code",    icon: <Terminal      className="w-4 h-4" />, label1: "إدخال كود",   label2: "التفعيل" },
                { key: "file",    icon: <UploadCloud   className="w-4 h-4" />, label1: "استيراد",     label2: "license.ons" },
                { key: "request", icon: <ClipboardCopy className="w-4 h-4" />, label1: "توليد",       label2: "كود الطلب" },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setNotice(null); }}
                  className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-center text-[10px] font-semibold leading-tight transition-all ${
                    tab === t.key
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/50 border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {t.icon}
                  <span>{t.label1}</span>
                  <span className="opacity-75">{t.label2}</span>
                </button>
              ))}
            </div>

            {/* Note: Trial licenses are ONLY issued as signed files from License Center */}
            <p className="text-[10px] text-muted-foreground border border-dashed border-border rounded-lg px-3 py-2 leading-relaxed">
              ملاحظة: التفعيل التجريبي يتطلب ملف ترخيص موقّع من License Center — لا يوجد تجربة مفتوحة من هنا.
            </p>

            {/* ── Tab: Code ── */}
            {tab === "code" && (
              <div className="space-y-2.5">
                <label className="text-xs text-muted-foreground block">
                  أدخل كود التفعيل الذي حصلت عليه من مزود النظام.
                </label>
                <textarea
                  value={activCode}
                  onChange={e => setActivCode(e.target.value)}
                  rows={5}
                  placeholder="الصق كود التفعيل هنا..."
                  className="w-full text-[10px] font-mono erp-input resize-none leading-relaxed"
                  dir="ltr"
                />
                <button
                  onClick={() => { setNotice(null); byCode.mutate({ code: activCode.trim() }); }}
                  disabled={!activCode.trim() || byCode.isPending}
                  className="w-full erp-btn-primary text-sm py-2.5 flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  {byCode.isPending ? "جارٍ التحقق..." : "تفعيل الآن"}
                </button>
              </div>
            )}

            {/* ── Tab: File ── */}
            {tab === "file" && (
              <div className="space-y-2.5">
                <label className="text-xs text-muted-foreground block">
                  استورد ملف الترخيص (.ons) الصادر من مزود النظام.
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
                >
                  <FileUp className="w-7 h-7 mx-auto text-muted-foreground mb-1.5" />
                  {fileName
                    ? <><p className="text-xs font-medium text-foreground">{fileName}</p><p className="text-[10px] text-green-600 mt-0.5">✓ جاهز للاستيراد</p></>
                    : <p className="text-xs text-muted-foreground">اضغط لاختيار ملف .ons</p>
                  }
                </div>
                <input ref={fileRef} type="file" accept=".ons,.json" className="hidden" onChange={onFile} />
                <button
                  onClick={() => { setNotice(null); byFile.mutate({ content: fileContent }); }}
                  disabled={!fileContent || byFile.isPending}
                  className="w-full erp-btn-primary text-sm py-2.5 flex items-center justify-center gap-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  {byFile.isPending ? "جارٍ التحقق..." : "استيراد وتفعيل"}
                </button>
              </div>
            )}

            {/* ── Tab: Request Code ── */}
            {tab === "request" && (
              <div className="space-y-2.5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  وَلِّد كود الطلب وأرسله لمزود النظام للحصول على ملف الترخيص.
                </p>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">معرّف المؤسسة (اختياري)</label>
                  <input
                    value={reqOrgId}
                    onChange={e => setReqOrgId(e.target.value)}
                    placeholder="ORG-2026-XXXX"
                    className="w-full erp-input text-sm"
                    dir="ltr"
                  />
                </div>
                <button
                  onClick={() => genReq.mutate({ org_id: reqOrgId })}
                  disabled={genReq.isPending}
                  className="w-full erp-btn-secondary text-sm py-2 flex items-center justify-center gap-2"
                >
                  <ClipboardCopy className="w-4 h-4" />
                  {genReq.isPending ? "جارٍ التوليد..." : "توليد كود الطلب"}
                </button>
                {reqCode && (
                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <textarea
                        readOnly value={reqCode} rows={4}
                        className="flex-1 text-[9px] font-mono bg-muted rounded-lg p-2 border border-border resize-none select-all"
                        dir="ltr"
                      />
                      <button onClick={() => copy(reqCode, "rq")} className="p-2 rounded-lg hover:bg-accent text-muted-foreground shrink-0 border border-border mt-0.5" title="نسخ">
                        {ck === "rq" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[9px] text-muted-foreground">{reqCode.length} حرف — أرسل هذا الكود لمزود النظام</p>
                  </div>
                )}
              </div>
            )}

            {/* Success bar */}
            {isValid && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs dark:bg-green-950/30 dark:border-green-800 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
                <span>الترخيص مفعّل — جميع الخدمات تعمل بشكل طبيعي.</span>
              </div>
            )}
          </div>
        </div>

        {/* ══ DEVICE INFO ════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">

          {/* Device ID */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Fingerprint className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">معلومات الجهاز الحالي</span>
            </div>
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Device ID</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-muted px-3 py-2.5 rounded-lg border border-border select-all break-all">
                  {devInfo?.device_id ?? "جارٍ التحميل..."}
                </code>
                <button
                  onClick={() => devInfo?.device_id && copy(devInfo.device_id, "dv")}
                  className="p-2.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground shrink-0 border border-border transition-colors"
                >
                  {ck === "dv" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {devInfo?.hw_fingerprint && (
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">بصمة الجهاز (Hardware Fingerprint)</p>
                <code className="block text-[10px] font-mono bg-muted px-3 py-2 rounded-lg border border-border text-muted-foreground break-all">
                  {devInfo.hw_fingerprint}
                </code>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs pt-1 border-t border-border">
              {isValid
                ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span className="text-green-700 dark:text-green-400">الجهاز مرتبط بترخيص صالح</span></>
                : <><XCircle className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-muted-foreground">الجهاز غير مرتبط بأي ترخيص نشط</span></>
              }
            </div>
            <p className="text-[10px] text-muted-foreground">
              أرسل Device ID إلى مزود النظام لإصدار ترخيص مخصص لهذا الجهاز.
            </p>
          </div>

          {/* Request Code */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <ClipboardCopy className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Request Code — كود الطلب</span>
            </div>
            {reqCode ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <textarea
                    readOnly value={reqCode} rows={5}
                    className="flex-1 text-[9px] font-mono bg-muted rounded-lg p-2.5 border border-border resize-none select-all leading-relaxed"
                    dir="ltr"
                  />
                  <button onClick={() => copy(reqCode, "rq2")} className="p-2.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground shrink-0 border border-border mt-0.5 transition-colors">
                    {ck === "rq2" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  أرسل هذا الكود لمزود النظام للحصول على ملف الترخيص.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                <ClipboardCopy className="w-8 h-8 text-muted-foreground opacity-25" />
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
                  كود الطلب يحتوي على Device ID الخاص بهذا الجهاز ويُرسَل لمزود النظام للحصول على ترخيص مناسب.
                </p>
                <button
                  onClick={() => { setTab("request"); genReq.mutate({ org_id: "" }); }}
                  disabled={genReq.isPending}
                  className="erp-btn-secondary text-xs py-2 px-4 flex items-center gap-2"
                >
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  {genReq.isPending ? "جارٍ التوليد..." : "توليد كود الطلب"}
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
