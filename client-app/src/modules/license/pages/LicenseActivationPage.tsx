import { useState, useRef } from "react";
import { trpc } from "@/shared/lib/trpc";
import {
  ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion,
  Copy, Check, RefreshCw, KeyRound, FileUp, Users,
  GitBranch, MonitorSmartphone, Globe, Wifi, WifiOff,
  Lock, CheckCircle2, XCircle, Building2, Calendar,
  Hash, Fingerprint, Package, Award, Terminal,
  UploadCloud, ClipboardCopy, Info, Infinity,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const MODULE_DEFS = [
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

function deriveLicenseType(
  licenseType: LicType,
  expiryDate?: string,
): LicType {
  if (licenseType) return licenseType;
  if (!expiryDate) return undefined;
  if (expiryDate >= "2099-01-01") return "lifetime";
  return "subscription";
}

function daysRemaining(expiryDate: string): number {
  const now   = new Date();
  const exp   = new Date(expiryDate + "T23:59:59Z");
  const diffMs = exp.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / 86_400_000));
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("ar-SA", {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch {
    return d;
  }
}

function useCopy() {
  const [id, setId] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setId(key);
      setTimeout(() => setId(null), 2000);
    });
  };
  return { copiedId: id, copy };
}

// ─── Color Helpers ─────────────────────────────────────────────────────────────
type Variant = "green" | "amber" | "red" | "slate" | "blue";

function getVariant(valid: boolean, error?: string | null, licType?: LicType): Variant {
  if (valid) {
    if (licType === "trial") return "amber";
    return "green";
  }
  if (error === "license_not_found") return "slate";
  if (error === "expired")           return "red";
  return "red";
}

const V = {
  green: {
    bg:       "bg-green-50 dark:bg-green-950/30",
    border:   "border-green-300 dark:border-green-700",
    badge:    "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300",
    icon:     "text-green-600",
    iconBg:   "bg-green-100 dark:bg-green-900/50",
    title:    "text-green-700 dark:text-green-400",
    bar:      "bg-green-500",
    progress: "bg-green-100 dark:bg-green-900/30",
  },
  amber: {
    bg:       "bg-amber-50 dark:bg-amber-950/30",
    border:   "border-amber-300 dark:border-amber-700",
    badge:    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300",
    icon:     "text-amber-600",
    iconBg:   "bg-amber-100 dark:bg-amber-900/50",
    title:    "text-amber-700 dark:text-amber-400",
    bar:      "bg-amber-500",
    progress: "bg-amber-100 dark:bg-amber-900/30",
  },
  red: {
    bg:       "bg-red-50 dark:bg-red-950/30",
    border:   "border-red-300 dark:border-red-700",
    badge:    "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300",
    icon:     "text-red-600",
    iconBg:   "bg-red-100 dark:bg-red-900/50",
    title:    "text-red-700 dark:text-red-400",
    bar:      "bg-red-500",
    progress: "bg-red-100 dark:bg-red-900/30",
  },
  slate: {
    bg:       "bg-slate-50 dark:bg-slate-900/30",
    border:   "border-slate-300 dark:border-slate-700",
    badge:    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
    icon:     "text-slate-500",
    iconBg:   "bg-slate-100 dark:bg-slate-800",
    title:    "text-slate-700 dark:text-slate-300",
    bar:      "bg-slate-400",
    progress: "bg-slate-100 dark:bg-slate-800/50",
  },
  blue: {
    bg:       "bg-blue-50 dark:bg-blue-950/30",
    border:   "border-blue-300 dark:border-blue-700",
    badge:    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300",
    icon:     "text-blue-600",
    iconBg:   "bg-blue-100 dark:bg-blue-900/50",
    title:    "text-blue-700 dark:text-blue-400",
    bar:      "bg-blue-500",
    progress: "bg-blue-100 dark:bg-blue-900/30",
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, onCopy, copyKey, copiedId }: {
  label: string;
  value?: string | null;
  onCopy?: (v: string, k: string) => void;
  copyKey?: string;
  copiedId?: string | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm font-mono font-medium text-foreground truncate">
          {value || "—"}
        </span>
        {onCopy && value && copyKey && (
          <button
            onClick={() => onCopy(value, copyKey)}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title={`نسخ ${label}`}
          >
            {copiedId === copyKey
              ? <Check className="w-3 h-3 text-green-500" />
              : <Copy className="w-3 h-3" />
            }
          </button>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ label, current, max, icon, variant }: {
  label: string;
  current: number;
  max: number;
  icon: React.ReactNode;
  variant: Variant;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const barVariant: Variant = pct >= 90 ? "red" : pct >= 70 ? "amber" : variant;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
          {icon}
          {label}
        </div>
        <span className="font-semibold text-foreground">
          {current} <span className="text-muted-foreground font-normal">/ {max}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${V[barVariant].bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-right text-[10px] text-muted-foreground">{pct}% مستخدَم</div>
    </div>
  );
}

function BoolBadge({ label, value, icon }: {
  label: string;
  value?: boolean | null;
  icon: React.ReactNode;
}) {
  const enabled = value === true;
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border ${
      enabled
        ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400"
        : "bg-muted border-border text-muted-foreground"
    }`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      {enabled
        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
        : <XCircle className="w-4 h-4 text-muted-foreground" />
      }
    </div>
  );
}

function ModuleChip({ id, label, icon, enabled }: {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all ${
      enabled
        ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300"
        : "bg-muted/50 border-border text-muted-foreground opacity-60"
    }`}>
      <span className="text-base leading-none">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {enabled
        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
        : <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
      }
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LicenseActivationPage() {
  const [activTab, setActivTab] = useState<"code" | "file" | "request">("code");
  const [activCode,   setActivCode]   = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileName,    setFileName]    = useState("");
  const [reqOrgId,    setReqOrgId]    = useState("");
  const [requestCode, setRequestCode] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { copiedId, copy } = useCopy();

  const utils = trpc.useUtils();
  const { data: status,     refetch: refetchStatus } = trpc.license.getStatus.useQuery(undefined, { retry: false });
  const { data: deviceInfo }                         = trpc.license.getDeviceInfo.useQuery(undefined, { retry: false });
  const { data: stats }                              = trpc.license.getCurrentStats.useQuery(undefined, { retry: false });

  const genRequestCode = trpc.license.generateRequestCode.useMutation({
    onSuccess: (d) => setRequestCode(d.code),
    onError:   (e) => setNotice({ ok: false, msg: e.message }),
  });

  const activateByCode = trpc.license.activateByCode.useMutation({
    onSuccess: (d) => {
      setNotice({ ok: true, msg: `✅ تم التفعيل بنجاح — ${d.customer}` });
      setActivCode("");
      utils.license.getStatus.invalidate();
      refetchStatus();
    },
    onError: (e) => setNotice({ ok: false, msg: e.message }),
  });

  const activateByFile = trpc.license.activateByFile.useMutation({
    onSuccess: (d) => {
      setNotice({ ok: true, msg: `✅ تم التفعيل بنجاح — ${d.customer}` });
      setFileContent(""); setFileName("");
      utils.license.getStatus.invalidate();
      refetchStatus();
    },
    onError: (e) => setNotice({ ok: false, msg: e.message }),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setFileContent((ev.target?.result as string) ?? "");
    reader.readAsText(file);
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const p       = status?.payload;
  const isValid = status?.valid === true;
  const err     = status?.error as string | null | undefined;
  const licType = deriveLicenseType(p?.license_type as LicType, p?.expiry_date);
  const variant  = getVariant(isValid, err, licType);
  const c        = V[variant];
  const days     = p?.expiry_date && licType !== "lifetime" ? daysRemaining(p.expiry_date) : null;
  const currentUsers = stats?.current_users ?? 0;
  const enabledSet   = new Set(p?.enabled_modules ?? []);

  // ── Status display helpers ──────────────────────────────────────────────────
  const STATUS_ICON = isValid
    ? <ShieldCheck className={`w-10 h-10 ${c.icon}`} />
    : err === "license_not_found"
      ? <ShieldQuestion className={`w-10 h-10 ${c.icon}`} />
      : err === "expired"
        ? <ShieldAlert className={`w-10 h-10 ${c.icon}`} />
        : <ShieldOff className={`w-10 h-10 ${c.icon}`} />;

  const STATUS_LABEL =
    isValid       ? (licType === "trial" ? "فترة تجريبية" : "مفعّل")
    : err === "license_not_found"           ? "غير مفعّل"
    : err === "expired"                     ? "انتهت الصلاحية"
    : err === "invalid_signature"           ? "ترخيص غير صالح"
    : err === "date_manipulation_suspected" ? "تلاعب بالتاريخ"
    : err === "invalid_json"               ? "ملف تالف"
    : err === "read_error"                  ? "خطأ في القراءة"
    : "غير محدد";

  const LIC_TYPE_LABEL =
    licType === "trial"        ? "فترة تجريبية"
    : licType === "lifetime"   ? "دائم"
    : licType === "subscription" ? "اشتراك"
    : undefined;

  const ALERT_MSG =
    !isValid && err === "license_not_found"           ? "البرنامج غير مفعّل. يرجى إدخال كود التفعيل أو استيراد ملف الترخيص."
    : !isValid && err === "expired" && licType === "trial" ? "انتهت الفترة التجريبية. يرجى التواصل مع مزود النظام لتفعيل الترخيص."
    : !isValid && err === "expired"                   ? "انتهت صلاحية الترخيص. يرجى التواصل مع مزود النظام للتجديد."
    : !isValid && err === "invalid_signature"         ? "ملف الترخيص غير صالح أو تم تعديله."
    : !isValid && err === "date_manipulation_suspected" ? "تم اكتشاف تلاعب بتاريخ الجهاز. يرجى التحقق من إعدادات الساعة."
    : null;

  return (
    <div className="h-full overflow-auto" dir="rtl">
      <div className="p-5 space-y-4 max-w-[1400px]">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              <h2 className="erp-page-title">الترخيص والتفعيل</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              إدارة ترخيص النظام وتفعيله والاطلاع على حالة الاشتراك والقيود
            </p>
          </div>
          <button
            onClick={() => { refetchStatus(); setNotice(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="تحديث حالة الترخيص"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            تحديث
          </button>
        </div>

        {/* ── Notice Banner ── */}
        {notice && (
          <div className={`flex items-start gap-2 text-sm rounded-xl px-4 py-3 border ${
            notice.ok
              ? "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800"
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800"
          }`}>
            {notice.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{notice.msg}</span>
            <button onClick={() => setNotice(null)} className="mr-auto text-lg leading-none opacity-50 hover:opacity-100">×</button>
          </div>
        )}

        {/* ── Status Card ── */}
        <div className={`rounded-2xl border-2 p-5 ${c.bg} ${c.border}`}>
          <div className="flex items-start gap-5 flex-wrap">

            {/* Shield + Status */}
            <div className="flex flex-col items-center gap-2 min-w-[100px]">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${c.iconBg} border-2 ${c.border}`}>
                {STATUS_ICON}
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${c.badge}`}>
                {STATUS_LABEL}
              </span>
              {LIC_TYPE_LABEL && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-background/70 border border-border text-muted-foreground">
                  {LIC_TYPE_LABEL}
                </span>
              )}
            </div>

            {/* Main Info */}
            <div className="flex-1 min-w-[260px]">
              {p ? (
                <>
                  <div className="mb-3">
                    <h3 className={`text-xl font-bold ${c.title}`}>{p.customer_name}</h3>
                    {p.package_name && (
                      <span className="text-sm text-muted-foreground">{p.package_name}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                    <InfoRow label="Organization ID" value={p.org_id} onCopy={copy} copyKey="org_id" copiedId={copiedId} />
                    <InfoRow label="License ID"      value={p.license_id} onCopy={copy} copyKey="lic_id" copiedId={copiedId} />
                    <InfoRow label="Activation ID"   value={p.activation_id} onCopy={copy} copyKey="act_id" copiedId={copiedId} />
                    <InfoRow label="تاريخ التفعيل"   value={formatDate(p.start_date)} />
                    <InfoRow label="تاريخ الانتهاء"  value={licType === "lifetime" ? "دائم ♾️" : formatDate(p.expiry_date)} />
                    <InfoRow label="الجهة المصدرة"   value={p.issued_by} />
                  </div>
                </>
              ) : (
                <div className="flex flex-col justify-center h-full py-2">
                  <h3 className={`text-lg font-bold ${c.title} mb-1`}>{STATUS_LABEL}</h3>
                  {ALERT_MSG && (
                    <p className="text-sm text-muted-foreground">{ALERT_MSG}</p>
                  )}
                </div>
              )}
            </div>

            {/* Days remaining counter */}
            {isValid && days !== null && licType !== "lifetime" && (
              <div className={`shrink-0 text-center px-5 py-4 rounded-xl border-2 ${c.border} bg-background/70`}>
                <div className={`text-4xl font-black ${
                  days <= 7 ? "text-red-600" : days <= 30 ? "text-amber-600" : c.title
                }`}>{days}</div>
                <div className="text-xs text-muted-foreground mt-1 font-medium">يوم متبقٍّ</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">باقٍ حتى الانتهاء</div>
              </div>
            )}

            {isValid && licType === "lifetime" && (
              <div className={`shrink-0 text-center px-5 py-4 rounded-xl border-2 ${c.border} bg-background/70`}>
                <Infinity className={`w-10 h-10 mx-auto ${c.title}`} />
                <div className="text-xs text-muted-foreground mt-2 font-medium">ترخيص دائم</div>
              </div>
            )}
          </div>

          {/* Alert message bar */}
          {ALERT_MSG && (
            <div className={`mt-4 flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${c.badge}`}>
              <Info className="w-4 h-4 shrink-0" />
              {ALERT_MSG}
            </div>
          )}
        </div>

        {/* ── 3-column grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Col 1: حدود الترخيص ── */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Award className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">حدود الترخيص</span>
            </div>

            {p ? (
              <>
                <div className="space-y-4">
                  <ProgressBar
                    label="المستخدمون"
                    current={currentUsers}
                    max={p.max_users}
                    icon={<Users className="w-3.5 h-3.5" />}
                    variant="blue"
                  />
                  <ProgressBar
                    label="الفروع"
                    current={0}
                    max={p.max_branches}
                    icon={<GitBranch className="w-3.5 h-3.5" />}
                    variant="blue"
                  />
                  <ProgressBar
                    label="نقاط البيع"
                    current={0}
                    max={p.max_pos}
                    icon={<MonitorSmartphone className="w-3.5 h-3.5" />}
                    variant="blue"
                  />
                  <ProgressBar
                    label="الأجهزة"
                    current={0}
                    max={p.max_devices}
                    icon={<Fingerprint className="w-3.5 h-3.5" />}
                    variant="blue"
                  />
                </div>
                <div className="space-y-2 pt-2 border-t border-border">
                  <BoolBadge label="الويب" value={p.web_allowed} icon={<Globe className="w-3.5 h-3.5" />} />
                  <BoolBadge label="سطح المكتب" value={p.desktop_allowed ?? true} icon={<MonitorSmartphone className="w-3.5 h-3.5" />} />
                  <BoolBadge label="العمل أوفلاين" value={p.offline_allowed} icon={<WifiOff className="w-3.5 h-3.5" />} />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm gap-2">
                <Lock className="w-8 h-8 opacity-30" />
                <span>لا يوجد ترخيص مفعّل</span>
              </div>
            )}
          </div>

          {/* ── Col 2: الموديولات ── */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Package className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">الموديولات المفعّلة</span>
              {p && (
                <span className="mr-auto text-xs text-muted-foreground">
                  {enabledSet.size} / {MODULE_DEFS.length}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {MODULE_DEFS.map(m => (
                <ModuleChip
                  key={m.id}
                  id={m.id}
                  label={m.label}
                  icon={m.icon}
                  enabled={!p ? false : enabledSet.has(m.id)}
                />
              ))}
            </div>

            {!p && (
              <p className="text-center text-xs text-muted-foreground pt-2">
                فعّل الترخيص لرؤية الموديولات المتاحة
              </p>
            )}
          </div>

          {/* ── Col 3: التفعيل ── */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <KeyRound className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">تفعيل الترخيص</span>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-lg">
              {([
                { key: "code",    icon: <Terminal    className="w-3.5 h-3.5" />, label: "كود" },
                { key: "file",    icon: <UploadCloud className="w-3.5 h-3.5" />, label: "ملف" },
                { key: "request", icon: <ClipboardCopy className="w-3.5 h-3.5" />, label: "طلب" },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => { setActivTab(t.key); setNotice(null); }}
                  className={`flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium transition-all ${
                    activTab === t.key
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab: Code */}
            {activTab === "code" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  أدخل كود التفعيل الذي حصلت عليه من دعم OneSoft ERP.
                </p>
                <textarea
                  value={activCode}
                  onChange={e => setActivCode(e.target.value)}
                  rows={6}
                  placeholder="الصق كود التفعيل هنا..."
                  className="w-full text-xs font-mono erp-input resize-none"
                  dir="ltr"
                />
                <button
                  onClick={() => { setNotice(null); activateByCode.mutate({ code: activCode.trim() }); }}
                  disabled={!activCode.trim() || activateByCode.isPending}
                  className="w-full erp-btn-primary text-sm py-2"
                >
                  {activateByCode.isPending ? "جارٍ التحقق..." : "تفعيل الآن"}
                </button>
              </div>
            )}

            {/* Tab: File */}
            {activTab === "file" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  استورد ملف الترخيص (.ons) الذي أرسله لك الدعم الفني.
                </p>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary hover:bg-accent transition-colors"
                >
                  <FileUp className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {fileName || "اضغط لاختيار ملف .ons"}
                  </p>
                  {fileName && (
                    <p className="text-xs text-green-600 mt-1 font-medium">✓ {fileName}</p>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".ons,.json"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => { setNotice(null); activateByFile.mutate({ content: fileContent }); }}
                  disabled={!fileContent || activateByFile.isPending}
                  className="w-full erp-btn-primary text-sm py-2"
                >
                  {activateByFile.isPending ? "جارٍ التحقق..." : "استيراد وتفعيل"}
                </button>
              </div>
            )}

            {/* Tab: Request Code */}
            {activTab === "request" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  أنشئ كود الطلب وأرسله لفريق الدعم للحصول على كود التفعيل.
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
                  onClick={() => genRequestCode.mutate({ org_id: reqOrgId })}
                  disabled={genRequestCode.isPending}
                  className="w-full erp-btn-secondary text-sm py-2"
                >
                  {genRequestCode.isPending ? "جارٍ التوليد..." : "توليد كود الطلب"}
                </button>
                {requestCode && (
                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <textarea
                        readOnly
                        value={requestCode}
                        rows={4}
                        className="w-full text-[10px] font-mono bg-muted rounded-lg p-2 border border-border resize-none select-all"
                        dir="ltr"
                      />
                      <button
                        onClick={() => copy(requestCode, "req_code")}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground mt-0.5 shrink-0"
                        title="نسخ"
                      >
                        {copiedId === "req_code"
                          ? <Check className="w-4 h-4 text-green-500" />
                          : <Copy className="w-4 h-4" />
                        }
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-left">{requestCode.length} حرف</p>
                  </div>
                )}
              </div>
            )}

            {/* Last activation success */}
            {isValid && p && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs dark:bg-green-950/30 dark:border-green-800 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>الترخيص مفعّل وجميع الخدمات تعمل بشكل طبيعي.</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Device Info Row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Device Info */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Fingerprint className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">معلومات الجهاز (هذا الجهاز)</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Device ID</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-muted px-3 py-2 rounded-lg border border-border select-all break-all">
                    {deviceInfo?.device_id ?? "جارٍ التحميل..."}
                  </code>
                  <button
                    onClick={() => deviceInfo?.device_id && copy(deviceInfo.device_id, "device_id")}
                    className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground shrink-0 border border-border"
                    title="نسخ معرّف الجهاز"
                  >
                    {copiedId === "device_id"
                      ? <Check className="w-4 h-4 text-green-500" />
                      : <Copy className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                أرسل هذا المعرّف إلى الدعم الفني لإصدار الترخيص المناسب لجهازك.
              </p>
            </div>
          </div>

          {/* HW Fingerprint */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">بيانات التحقق من الجهاز</span>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">بصمة الجهاز</div>
                  <code className="text-[10px] font-mono bg-muted px-2 py-1.5 rounded border border-border block truncate">
                    {deviceInfo?.hw_fingerprint
                      ? deviceInfo.hw_fingerprint.substring(0, 20) + "…"
                      : "—"}
                  </code>
                </div>
                <div>
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">حالة التحقق</div>
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded border ${
                    isValid
                      ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400"
                      : "bg-muted border-border text-muted-foreground"
                  }`}>
                    {isValid
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /> مطابق</>
                      : <><XCircle className="w-3.5 h-3.5" /> غير مُتحقَّق</>
                    }
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                يتم ربط الترخيص بهذا الجهاز تحديداً لمنع الاستخدام غير المصرّح به.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
