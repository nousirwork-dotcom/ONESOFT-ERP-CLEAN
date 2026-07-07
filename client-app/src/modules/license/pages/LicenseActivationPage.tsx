import { useState, useRef } from "react";
import { trpc } from "@/shared/lib/trpc";
import {
  ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion,
  Copy, Check, RefreshCw, KeyRound, FileUp,
  Users, GitBranch, MonitorSmartphone, Fingerprint,
  Globe, Monitor, WifiOff, Lock, CheckCircle2, XCircle,
  Terminal, UploadCloud, ClipboardCopy, Infinity,
  HelpCircle, Timer, Info,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
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
  const ms = new Date(exp + "T23:59:59Z").getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "2-digit", day: "2-digit" }); }
  catch { return d; }
}

// ─── useCopy ─────────────────────────────────────────────────────────────────
function useCopy() {
  const [key, setKey] = useState<string | null>(null);
  const copy = (text: string, k: string) => {
    navigator.clipboard.writeText(text).then(() => { setKey(k); setTimeout(() => setKey(null), 2000); });
  };
  return { copiedKey: key, copy };
}

// ─── CopyBtn ─────────────────────────────────────────────────────────────────
function CopyBtn({ value, id, copiedKey, copy }: { value?: string | null; id: string; copiedKey: string | null; copy: (v: string, k: string) => void }) {
  if (!value) return null;
  return (
    <button onClick={() => copy(value, id)} className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0" title="نسخ">
      {copiedKey === id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ─── MetricBox ───────────────────────────────────────────────────────────────
function MetricBox({ label, current, max, icon }: { label: string; current: number; max: number; icon: React.ReactNode }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const color = pct >= 90 ? "text-red-600" : pct >= 70 ? "text-amber-600" : "text-blue-600";
  return (
    <div className="flex flex-col items-center gap-1 bg-muted/50 rounded-xl p-3 border border-border text-center">
      <div className="text-muted-foreground">{icon}</div>
      <div className={`text-lg font-black leading-none ${color}`}>{current} <span className="text-sm font-semibold text-foreground">/ {max}</span></div>
      <div className="text-[10px] font-medium text-muted-foreground">{label}</div>
      <div className="text-[9px] text-muted-foreground">{pct}% مستخدَم</div>
    </div>
  );
}

// ─── BoolRow ─────────────────────────────────────────────────────────────────
function BoolRow({ label, value, icon }: { label: string; value?: boolean | null; icon: React.ReactNode }) {
  const on = value === true;
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border ${on ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400" : "bg-muted border-border text-muted-foreground"}`}>
      <div className="flex items-center gap-2">{icon}<span className="font-medium">{label}</span></div>
      <span className={`font-semibold ${on ? "text-green-600" : "text-muted-foreground"}`}>{on ? "مفعّل" : "غير مفعّل"}</span>
    </div>
  );
}

// ─── ModChip ─────────────────────────────────────────────────────────────────
function ModChip({ label, icon, enabled }: { label: string; icon: string; enabled: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-all ${enabled ? "bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800" : "bg-muted/40 border-border opacity-55"}`}>
      <span className="text-xl leading-none">{icon}</span>
      <span className={`text-[10px] font-semibold leading-tight ${enabled ? "text-green-800 dark:text-green-300" : "text-muted-foreground"}`}>{label}</span>
      {enabled
        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
        : <Lock className="w-3 h-3 text-muted-foreground" />
      }
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LicenseActivationPage() {
  const [tab,         setTab]         = useState<"code" | "file" | "trial">("code");
  const [activCode,   setActivCode]   = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileName,    setFileName]    = useState("");
  const [reqOrgId,    setReqOrgId]    = useState("");
  const [reqCode,     setReqCode]     = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { copiedKey, copy } = useCopy();

  const utils = trpc.useUtils();
  const { data: status, refetch } = trpc.license.getStatus.useQuery(undefined, { retry: false });
  const { data: devInfo }         = trpc.license.getDeviceInfo.useQuery(undefined, { retry: false });
  const { data: stats }           = trpc.license.getCurrentStats.useQuery(undefined, { retry: false });

  const genReq = trpc.license.generateRequestCode.useMutation({
    onSuccess: (d) => setReqCode(d.code),
    onError:   (e) => setNotice({ ok: false, msg: e.message }),
  });
  const byCode = trpc.license.activateByCode.useMutation({
    onSuccess: (d) => { setNotice({ ok: true, msg: `تم التفعيل — ${d.customer}` }); setActivCode(""); utils.license.getStatus.invalidate(); refetch(); },
    onError:   (e) => setNotice({ ok: false, msg: e.message }),
  });
  const byFile = trpc.license.activateByFile.useMutation({
    onSuccess: (d) => { setNotice({ ok: true, msg: `تم التفعيل — ${d.customer}` }); setFileContent(""); setFileName(""); utils.license.getStatus.invalidate(); refetch(); },
    onError:   (e) => setNotice({ ok: false, msg: e.message }),
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setFileName(f.name);
    new FileReader().addEventListener("load", ev => setFileContent((ev.target?.result as string) ?? ""));
    const r = new FileReader(); r.onload = ev => setFileContent((ev.target?.result as string) ?? ""); r.readAsText(f);
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const p       = status?.payload;
  const isValid = !!status?.valid;
  const err     = status?.error as string | null | undefined;
  const lt      = deriveLicType(p?.license_type as LicType, p?.expiry_date);
  const days    = p?.expiry_date && lt !== "lifetime" ? daysLeft(p.expiry_date) : null;
  const curUsers = stats?.current_users ?? 0;
  const mods     = new Set(p?.enabled_modules ?? []);

  // Colors
  const isAmber  = isValid && lt === "trial";
  const isGreen  = isValid && !isAmber;
  const isSlate  = !isValid && err === "license_not_found";
  const statusBg =
    isGreen  ? "from-green-600  to-green-800"
    : isAmber ? "from-amber-500 to-amber-700"
    : isSlate ? "from-slate-500 to-slate-700"
    : "from-red-600 to-red-800";

  const statusText =
    isValid       ? (lt === "trial" ? "فترة تجريبية" : "الترخيص مفعّل")
    : err === "license_not_found" ? "غير مفعّل"
    : err === "expired"           ? "انتهت الصلاحية"
    : err === "invalid_signature" ? "ترخيص غير صالح"
    : "غير محدد";

  const ltLabel =
    lt === "trial"        ? "فترة تجريبية"
    : lt === "lifetime"   ? "دائم"
    : lt === "subscription" ? "اشتراك"
    : "غير مفعّل";

  const alertMsg =
    isSlate                            ? "البرنامج غير مفعّل. يرجى إدخال كود التفعيل أو استيراد ملف الترخيص."
    : !isValid && err === "expired"    ? "انتهت صلاحية الترخيص. يرجى التواصل مع مزود النظام للتجديد."
    : !isValid && err === "invalid_signature" ? "ملف الترخيص غير صالح أو تم تعديله."
    : !isValid && err === "date_manipulation_suspected" ? "تم اكتشاف تلاعب بتاريخ الجهاز."
    : null;

  const ShieldIcon = isGreen ? ShieldCheck : isAmber ? ShieldCheck : isSlate ? ShieldQuestion : ShieldOff;

  return (
    <div className="h-full overflow-auto bg-muted/20" dir="rtl">
      <div className="p-4 space-y-4 max-w-[1300px]">

        {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              <h2 className="erp-page-title">الترخيص والتفعيل</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">إدارة ترخيص النظام وتفعيله والاطلاع على حالة الاشتراك والقيود</p>
          </div>
          <button onClick={() => { refetch(); setNotice(null); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> تحديث
          </button>
        </div>

        {/* ══ NOTICE ══════════════════════════════════════════════════════════ */}
        {notice && (
          <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 border ${notice.ok ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"}`}>
            {notice.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{notice.msg}</span>
            <button onClick={() => setNotice(null)} className="text-lg leading-none opacity-50 hover:opacity-100">×</button>
          </div>
        )}

        {/* ══ STATUS CARD ═════════════════════════════════════════════════════ */}
        <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-sm">
          <div className={`bg-gradient-to-l ${statusBg} p-5`}>
            <div className="flex items-stretch gap-5 flex-wrap">

              {/* Shield — يمين (leading in RTL) */}
              <div className="flex flex-col items-center justify-center gap-3 min-w-[110px]">
                <div className="w-[88px] h-[88px] rounded-2xl bg-white/15 backdrop-blur border border-white/30 flex items-center justify-center shadow-inner">
                  <ShieldIcon className="w-12 h-12 text-white drop-shadow" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-white/90 bg-white/15 border border-white/30 px-2.5 py-0.5 rounded-full">
                    {statusText}
                  </span>
                  <span className="text-[10px] text-white/60">{ltLabel}</span>
                </div>
              </div>

              {/* Info — وسط */}
              <div className="flex-1 min-w-[220px] text-white">
                {p ? (
                  <>
                    <div className="mb-3">
                      <div className="text-xs text-white/60 mb-0.5">الباقة الحالية</div>
                      <h3 className="text-xl font-black text-white leading-none">
                        {p.package_name ?? "Standard"}
                      </h3>
                      <p className="text-sm text-white/70 mt-0.5">{p.customer_name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      {[
                        { label: "Device ID",      val: p.device_id || devInfo?.device_id, k: "did" },
                        { label: "Organization ID", val: p.org_id, k: "oid" },
                        { label: "تاريخ التفعيل",  val: fmtDate(p.start_date), k: "" },
                        { label: "تاريخ الانتهاء", val: lt === "lifetime" ? "دائم ♾️" : fmtDate(p.expiry_date), k: "" },
                      ].map(({ label, val, k }) => (
                        <div key={label}>
                          <div className="text-[9px] font-medium text-white/50 uppercase tracking-wide mb-0.5">{label}</div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-mono text-white/90 truncate">{val ?? "—"}</span>
                            {k && val && (
                              <button onClick={() => copy(val, k)} className="text-white/50 hover:text-white transition-colors shrink-0">
                                {copiedKey === k ? <Check className="w-3 h-3 text-green-300" /> : <Copy className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col justify-center h-full py-3">
                    <h3 className="text-xl font-black text-white mb-1">{statusText}</h3>
                    {alertMsg && <p className="text-sm text-white/70">{alertMsg}</p>}
                  </div>
                )}
              </div>

              {/* Days Counter — يسار (trailing in RTL) */}
              {isValid && days !== null && lt !== "lifetime" && (
                <div className="shrink-0 flex flex-col items-center justify-center gap-1 bg-white/10 backdrop-blur border border-white/20 rounded-xl px-5 py-4 min-w-[100px]">
                  <div className={`text-4xl font-black text-white leading-none ${days <= 7 ? "text-red-300" : days <= 30 ? "text-amber-300" : "text-white"}`}>{days}</div>
                  <div className="text-[10px] text-white/60 font-medium text-center">يوم متبقٍّ</div>
                  <div className="text-[9px] text-white/40 text-center">باقٍ حتى الانتهاء</div>
                  <div className="mt-1 text-[9px] text-white/50">{fmtDate(p?.expiry_date)}</div>
                </div>
              )}

              {isValid && lt === "lifetime" && (
                <div className="shrink-0 flex flex-col items-center justify-center gap-1 bg-white/10 border border-white/20 rounded-xl px-5 py-4 min-w-[100px]">
                  <Infinity className="w-10 h-10 text-white" />
                  <div className="text-[10px] text-white/60 font-medium">ترخيص دائم</div>
                </div>
              )}
            </div>
          </div>

          {/* Alert bar inside card */}
          {alertMsg && (
            <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-t border-amber-200 text-amber-800 text-xs dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
              <Info className="w-4 h-4 shrink-0" />
              {alertMsg}
            </div>
          )}
        </div>

        {/* ══ 3-COL GRID ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── حدود الترخيص ─────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <span className="text-base">🏅</span>
              <span className="font-semibold text-sm">حدود الترخيص</span>
            </div>

            {p ? (
              <>
                {/* Metrics grid 2×2 */}
                <div className="grid grid-cols-2 gap-2">
                  <MetricBox label="مستخدمون"   current={curUsers}  max={p.max_users}    icon={<Users        className="w-4 h-4" />} />
                  <MetricBox label="فروع"        current={0}         max={p.max_branches} icon={<GitBranch    className="w-4 h-4" />} />
                  <MetricBox label="نقاط البيع"  current={0}         max={p.max_pos}      icon={<MonitorSmartphone className="w-4 h-4" />} />
                  <MetricBox label="أجهزة"       current={0}         max={p.max_devices}  icon={<Fingerprint  className="w-4 h-4" />} />
                </div>
                {/* Bool rows */}
                <div className="space-y-1.5 pt-1 border-t border-border">
                  <BoolRow label="الويب"          value={p.web_allowed}             icon={<Globe   className="w-3.5 h-3.5" />} />
                  <BoolRow label="سطح المكتب"     value={p.desktop_allowed ?? true} icon={<Monitor className="w-3.5 h-3.5" />} />
                  <BoolRow label="العمل أوفلاين"  value={p.offline_allowed}         icon={<WifiOff className="w-3.5 h-3.5" />} />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <Lock className="w-8 h-8 opacity-25" />
                <span className="text-sm">لا يوجد ترخيص مفعّل</span>
              </div>
            )}
          </div>

          {/* ── الموديولات ───────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <span className="text-base">📦</span>
              <span className="font-semibold text-sm">الموديولات المفعّلة</span>
              {p && (
                <span className="mr-auto text-xs font-semibold text-muted-foreground">{mods.size} / {MODULES.length}</span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {MODULES.map(m => (
                <ModChip key={m.id} label={m.label} icon={m.icon} enabled={!!p && mods.has(m.id)} />
              ))}
            </div>

            {!p && (
              <p className="text-center text-xs text-muted-foreground">فعّل الترخيص لرؤية الموديولات المتاحة</p>
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
                { key: "code",  icon: <Terminal     className="w-4 h-4" />, label: "إدخال كود\nالتفعيل" },
                { key: "file",  icon: <UploadCloud  className="w-4 h-4" />, label: "استيراد ملف\nlicense.ons" },
                { key: "trial", icon: <Timer        className="w-4 h-4" />, label: "التفعيل\nالتجريبي" },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setNotice(null); }}
                  className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border text-center transition-all text-[10px] font-semibold leading-tight whitespace-pre-wrap ${
                    tab === t.key
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/50 border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab: Code */}
            {tab === "code" && (
              <div className="space-y-2.5">
                <label className="text-xs text-muted-foreground block">
                  أدخل كود التفعيل الذي حصلت عليه من دعم OneSoft ERP.
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

            {/* Tab: File */}
            {tab === "file" && (
              <div className="space-y-2.5">
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:border-primary hover:bg-accent transition-colors"
                >
                  <FileUp className="w-7 h-7 mx-auto text-muted-foreground mb-1.5" />
                  <p className="text-xs text-muted-foreground">{fileName || "اضغط لاختيار ملف .ons"}</p>
                  {fileName && <p className="text-[10px] text-green-600 mt-0.5">✓ {fileName}</p>}
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

            {/* Tab: Trial */}
            {tab === "trial" && (
              <div className="space-y-2.5">
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-800 text-xs dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
                  <div className="font-semibold mb-1">الفترة التجريبية</div>
                  <p>للحصول على فترة تجريبية، تواصل مع فريق دعم OneSoft ERP. سيتم إرسال ملف ترخيص تجريبي لمدة 30 يوم.</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">معرّف المؤسسة (اختياري)</label>
                  <input value={reqOrgId} onChange={e => setReqOrgId(e.target.value)} placeholder="ORG-2026-XXXX" className="w-full erp-input text-sm" dir="ltr" />
                </div>
                <button
                  onClick={() => genReq.mutate({ org_id: reqOrgId })}
                  disabled={genReq.isPending}
                  className="w-full erp-btn-secondary text-sm py-2.5 flex items-center justify-center gap-2"
                >
                  <ClipboardCopy className="w-4 h-4" />
                  {genReq.isPending ? "جارٍ التوليد..." : "توليد كود الطلب"}
                </button>
                {reqCode && (
                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <textarea readOnly value={reqCode} rows={3} className="flex-1 text-[9px] font-mono bg-muted rounded-lg p-2 border border-border resize-none select-all" dir="ltr" />
                      <button onClick={() => copy(reqCode, "req")} className="p-1.5 rounded hover:bg-accent text-muted-foreground shrink-0 mt-0.5">
                        {copiedKey === "req" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Success bar */}
            {isValid && p && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs dark:bg-green-950/30 dark:border-green-800 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>الترخيص مفعّل وجميع الخدمات تعمل بشكل طبيعي.</span>
              </div>
            )}
          </div>
        </div>

        {/* ══ DEVICE INFO STRIP ════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Fingerprint className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">معلومات الجهاز (هذا الجهاز)</span>
            </div>
            <div>
              <div className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Device ID</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-muted px-3 py-2 rounded-lg border border-border select-all break-all">
                  {devInfo?.device_id ?? "جارٍ التحميل..."}
                </code>
                <button
                  onClick={() => devInfo?.device_id && copy(devInfo.device_id, "dev")}
                  className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground shrink-0 border border-border"
                >
                  {copiedKey === "dev" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              أرسل هذا المعرّف إلى الدعم الفني لإصدار الترخيص المناسب لجهازك.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <ClipboardCopy className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Request Code (كود الطلب)</span>
            </div>
            {reqCode ? (
              <div>
                <div className="flex items-start gap-2">
                  <textarea readOnly value={reqCode} rows={3} className="flex-1 text-[9px] font-mono bg-muted rounded-lg p-2 border border-border resize-none select-all" dir="ltr" />
                  <button onClick={() => copy(reqCode, "req2")} className="p-2 rounded-lg hover:bg-accent text-muted-foreground shrink-0 border border-border mt-0.5">
                    {copiedKey === "req2" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">استخدم هذا الكود للتواصل مع دعم OneSoft ERP للحصول على ترخيص مناسب.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">وَلِّد كود الطلب من تبويب "التفعيل التجريبي" أعلاه، ثم أرسله للدعم الفني.</p>
                <button
                  onClick={() => { setTab("trial"); genReq.mutate({ org_id: "" }); }}
                  disabled={genReq.isPending}
                  className="erp-btn-secondary text-xs py-1.5 px-3"
                >
                  {genReq.isPending ? "جارٍ التوليد..." : "توليد كود الطلب الآن"}
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
