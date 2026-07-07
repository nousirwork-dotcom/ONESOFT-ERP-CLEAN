import { useState, useRef } from "react";
import { trpc } from "@/shared/lib/trpc";
import {
  ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion,
  Copy, Check, RefreshCw, KeyRound, FileUp,
  Users, GitBranch, MonitorSmartphone, Fingerprint,
  Globe, Monitor, WifiOff, Lock, CheckCircle2, XCircle,
  Terminal, UploadCloud, ClipboardCopy, Info,
  Timer, Infinity as InfinityIcon,
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

// ─── CopyBtn ─────────────────────────────────────────────────────────────────
function CopyBtn({ val, id, ck, copy, cls = "" }: {
  val?: string | null; id: string; ck: string | null;
  copy: (v: string, k: string) => void; cls?: string;
}) {
  if (!val) return null;
  return (
    <button onClick={() => copy(val, id)}
      className={`p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0 ${cls}`}
      title="نسخ">
      {ck === id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ─── LimitRow (progress bar + numbers) ──────────────────────────────────────
function LimitRow({ label, current, max, icon }: {
  label: string; current: number; max: number; icon: React.ReactNode;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const barColor = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-blue-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
          {icon}
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`font-bold text-sm ${pct >= 90 ? "text-red-600" : "text-foreground"}`}>{current}</span>
          <span className="text-muted-foreground text-xs">/ {max}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{pct}% مستخدَم</span>
        <span>{max - current} متاح</span>
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
      <span className={on ? "text-green-600" : "text-muted-foreground"}>{on ? "مفعّل" : "غير مفعّل"}</span>
    </div>
  );
}

// ─── ModuleChip ──────────────────────────────────────────────────────────────
function ModuleChip({ label, icon, enabled }: { label: string; icon: string; enabled: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border text-center ${
      enabled ? "bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800"
              : "bg-muted/30 border-border opacity-55"
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

// ─── InfoCell ────────────────────────────────────────────────────────────────
function InfoCell({ label, value, copyId, ck, copy }: {
  label: string; value?: string | null;
  copyId?: string; ck?: string | null;
  copy?: (v: string, k: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] font-semibold text-white/50 uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-white/90 truncate">{value ?? "—"}</span>
        {copyId && value && copy && (
          <button onClick={() => copy(value, copyId)}
            className="text-white/40 hover:text-white transition-colors shrink-0">
            {ck === copyId ? <Check className="w-3 h-3 text-green-300" /> : <Copy className="w-3 h-3" />}
          </button>
        )}
      </div>
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
    onSuccess: d  => { setReqCode(d.code); setTab("request"); },
    onError:   e  => setNotice({ ok: false, msg: e.message }),
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
  const p        = status?.payload;
  const isValid  = !!status?.valid;
  const err      = status?.error as string | null | undefined;
  const lt       = deriveLicType(p?.license_type as LicType, p?.expiry_date);
  const days     = p?.expiry_date && lt !== "lifetime" ? daysLeft(p.expiry_date) : null;
  const curUsers = stats?.current_users ?? 0;
  const curBranches = (stats as { current_branches?: number } | undefined)?.current_branches ?? 0;
  const mods     = new Set(p?.enabled_modules ?? []);

  // ── Status variant ─────────────────────────────────────────────────────────
  const isTrial  = isValid && lt === "trial";
  const isActive = isValid && !isTrial;
  const isSlate  = !isValid && err === "license_not_found";
  const isExpired = !isValid && err === "expired";

  const gradient =
    isActive  ? "from-green-700 to-green-900"
    : isTrial  ? "from-amber-600 to-amber-800"
    : isExpired ? "from-red-600   to-red-900"
    : isSlate   ? "from-slate-600 to-slate-800"
    : "from-red-700 to-red-900";

  const statusLabel =
    isActive  ? "مفعّل"
    : isTrial  ? "نسخة تجريبية"
    : isExpired ? "انتهت الصلاحية"
    : err === "license_not_found"            ? "غير مفعّل"
    : err === "invalid_signature"            ? "ترخيص غير صالح"
    : err === "date_manipulation_suspected"  ? "تلاعب بالتاريخ"
    : err === "invalid_json"                 ? "ملف تالف"
    : "غير محدد";

  const licTypeLabel =
    lt === "trial"        ? "فترة تجريبية"
    : lt === "lifetime"   ? "ترخيص دائم"
    : lt === "subscription" ? "اشتراك"
    : null;

  const alertMsg =
    isSlate   ? "البرنامج غير مفعّل. يرجى إدخال كود التفعيل أو استيراد ملف الترخيص."
    : isExpired && lt === "trial" ? "انتهت الفترة التجريبية. تواصل مع مزود النظام لتفعيل ترخيص دائم."
    : isExpired ? "انتهت صلاحية الترخيص. تواصل مع مزود النظام للتجديد."
    : err === "invalid_signature" ? "ملف الترخيص غير صالح أو تم تعديله. تواصل مع مزود النظام."
    : err === "date_manipulation_suspected" ? "تم اكتشاف تلاعب بتاريخ الجهاز. تحقق من إعدادات الساعة."
    : null;

  const ShieldIcon =
    isActive  ? ShieldCheck
    : isTrial  ? ShieldCheck
    : isSlate   ? ShieldQuestion
    : isExpired ? ShieldAlert
    : ShieldOff;

  // ── Days urgency ────────────────────────────────────────────────────────────
  const daysColor =
    days === null    ? "text-white"
    : days <= 7      ? "text-red-300"
    : days <= 30     ? "text-amber-300"
    : "text-white";

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="h-full overflow-auto" dir="rtl">
      <div className="p-4 space-y-4 w-full">

        {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
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

        {/* ══ NOTICE ══════════════════════════════════════════════════════════ */}
        {notice && (
          <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 border w-full ${
            notice.ok
              ? "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800"
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800"
          }`}>
            {notice.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{notice.msg}</span>
            <button onClick={() => setNotice(null)} className="text-xl leading-none opacity-40 hover:opacity-80 transition-opacity">×</button>
          </div>
        )}

        {/* ══ STATUS CARD — full width gradient ═══════════════════════════════ */}
        <div className={`w-full rounded-2xl bg-gradient-to-l ${gradient} shadow-lg overflow-hidden`}>
          <div className="p-5">
            <div className="flex items-stretch gap-6 flex-wrap">

              {/* Shield ── leading (right in RTL) */}
              <div className="flex flex-col items-center justify-center gap-2.5 min-w-[100px]">
                <div className="w-20 h-20 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-inner backdrop-blur-sm">
                  <ShieldIcon className="w-11 h-11 text-white drop-shadow-lg" />
                </div>
                <span className="text-xs font-bold bg-white/20 text-white border border-white/25 px-3 py-1 rounded-full text-center">
                  {statusLabel}
                </span>
                {licTypeLabel && (
                  <span className="text-[10px] text-white/60 text-center">{licTypeLabel}</span>
                )}
              </div>

              {/* Main info ── center */}
              <div className="flex-1 min-w-[200px] text-white">
                {p ? (
                  <>
                    <div className="mb-3">
                      <p className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">الباقة الحالية</p>
                      <h3 className="text-2xl font-black text-white leading-none">
                        {p.package_name ?? "Standard"}
                      </h3>
                      <p className="text-sm text-white/70 mt-1">{p.customer_name}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-3">
                      <InfoCell label="Organization ID" value={p.org_id}         copyId="oid" ck={ck} copy={copy} />
                      <InfoCell label="License ID"      value={p.license_id}     copyId="lid" ck={ck} copy={copy} />
                      <InfoCell label="Activation ID"   value={p.activation_id}  copyId="aid" ck={ck} copy={copy} />
                      <InfoCell label="Device ID"       value={p.device_id || devInfo?.device_id} copyId="did" ck={ck} copy={copy} />
                      <InfoCell label="تاريخ التفعيل"  value={fmtDate(p.start_date, true)} />
                      <InfoCell label="الجهة المصدرة"  value={p.issued_by} />
                    </div>
                  </>
                ) : (
                  <div className="py-2">
                    <h3 className="text-xl font-black text-white mb-1.5">{statusLabel}</h3>
                    {alertMsg && <p className="text-sm text-white/70 leading-relaxed max-w-md">{alertMsg}</p>}
                    {isSlate && (
                      <p className="text-xs text-white/50 mt-2">
                        سيتم عرض حدود الترخيص والموديولات المتاحة بعد التفعيل.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Expiry / Days counter ── trailing (left in RTL) */}
              {p && (
                <div className="shrink-0 flex flex-col items-center justify-center gap-2 bg-white/10 border border-white/20 rounded-2xl px-6 py-4 min-w-[110px] backdrop-blur-sm">
                  {lt === "lifetime" ? (
                    <>
                      <InfinityIcon className="w-10 h-10 text-white" />
                      <span className="text-xs text-white/60 font-medium text-center">ترخيص دائم</span>
                    </>
                  ) : (
                    <>
                      <span className={`text-4xl font-black leading-none ${daysColor}`}>{days}</span>
                      <span className="text-[10px] text-white/50 text-center">يوم متبقٍّ</span>
                      <div className="w-full h-px bg-white/15 my-0.5" />
                      <span className="text-[10px] text-white/50 text-center font-mono">
                        {fmtDate(p.expiry_date)}
                      </span>
                      {days !== null && days <= 30 && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          days <= 7 ? "bg-red-500/30 text-red-200" : "bg-amber-500/30 text-amber-200"
                        }`}>
                          {days <= 7 ? "⚠ عاجل" : "قريبًا"}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Alert bar */}
          {alertMsg && (
            <div className="flex items-start gap-2 px-5 py-2.5 bg-black/20 text-white/90 text-xs border-t border-white/10">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/60" />
              {alertMsg}
            </div>
          )}

          {/* Trial notice */}
          {isTrial && (
            <div className="flex items-center gap-2 px-5 py-2 bg-amber-500/20 text-amber-200 text-xs border-t border-amber-400/20">
              <Timer className="w-3.5 h-3.5 shrink-0" />
              هذه نسخة تجريبية محدودة — قابلة للتحديث إلى ترخيص كامل
            </div>
          )}
        </div>

        {/* ══ 3-COLUMN GRID ═══════════════════════════════════════════════════ */}
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
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-2">صلاحيات الوصول</p>
                  <BoolBadge label="واجهة الويب"     value={p.web_allowed}             icon={<Globe    className="w-3.5 h-3.5" />} />
                  <BoolBadge label="سطح المكتب"      value={p.desktop_allowed ?? true} icon={<Monitor  className="w-3.5 h-3.5" />} />
                  <BoolBadge label="وضع الأوفلاين"   value={p.offline_allowed}         icon={<WifiOff  className="w-3.5 h-3.5" />} />
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
                <span className="mr-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
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

            {/* Big tab buttons */}
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { key: "code",    icon: <Terminal     className="w-4 h-4" />, label1: "إدخال كود", label2: "التفعيل" },
                { key: "file",    icon: <UploadCloud  className="w-4 h-4" />, label1: "استيراد", label2: "license.ons" },
                { key: "request", icon: <ClipboardCopy className="w-4 h-4" />, label1: "توليد", label2: "كود الطلب" },
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
                  <span className="opacity-80">{t.label2}</span>
                </button>
              ))}
            </div>

            {/* ── Tab: Code ── */}
            {tab === "code" && (
              <div className="space-y-2.5">
                <label className="text-xs text-muted-foreground block leading-relaxed">
                  أدخل كود التفعيل الذي حصلت عليه من دعم OneSoft ERP.
                </label>
                <textarea
                  value={activCode}
                  onChange={e => setActivCode(e.target.value)}
                  rows={6}
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
                  استورد ملف الترخيص (.ons) الذي أرسله الدعم الفني.
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
                  وَلِّد كود الطلب وأرسله لفريق الدعم للحصول على كود التفعيل أو ملف الترخيص.
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
                    <p className="text-[9px] text-muted-foreground">{reqCode.length} حرف — أرسل هذا الكود لدعم OneSoft</p>
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

        {/* ══ DEVICE INFO ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">

          {/* Device ID */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Fingerprint className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">معلومات الجهاز (هذا الجهاز)</span>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Device ID</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-muted px-3 py-2.5 rounded-lg border border-border select-all break-all leading-relaxed">
                    {devInfo?.device_id ?? "جارٍ التحميل..."}
                  </code>
                  <button
                    onClick={() => devInfo?.device_id && copy(devInfo.device_id, "dv")}
                    className="p-2.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground shrink-0 border border-border transition-colors"
                    title="نسخ معرّف الجهاز"
                  >
                    {ck === "dv" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {devInfo?.hw_fingerprint && (
                <div>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">بصمة الجهاز</p>
                  <code className="block text-[10px] font-mono bg-muted px-3 py-2 rounded-lg border border-border text-muted-foreground break-all">
                    {devInfo.hw_fingerprint}
                  </code>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs">
                {isValid
                  ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span className="text-green-700 dark:text-green-400">الجهاز مرتبط بترخيص صالح</span></>
                  : <><XCircle className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-muted-foreground">الجهاز غير مرتبط بأي ترخيص</span></>
                }
              </div>
              <p className="text-[10px] text-muted-foreground border-t border-border pt-2">
                أرسل Device ID إلى الدعم الفني لإصدار ترخيص مخصص لهذا الجهاز.
              </p>
            </div>
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
                    readOnly value={reqCode} rows={4}
                    className="flex-1 text-[9px] font-mono bg-muted rounded-lg p-2 border border-border resize-none select-all leading-relaxed"
                    dir="ltr"
                  />
                  <button onClick={() => copy(reqCode, "rq2")} className="p-2.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground shrink-0 border border-border mt-0.5 transition-colors">
                    {ck === "rq2" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  أرسل هذا الكود لدعم OneSoft ERP للحصول على كود التفعيل أو ملف الترخيص.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                <ClipboardCopy className="w-8 h-8 text-muted-foreground opacity-30" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  كود الطلب يُرسَل لفريق الدعم للحصول على ترخيص مناسب.
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
