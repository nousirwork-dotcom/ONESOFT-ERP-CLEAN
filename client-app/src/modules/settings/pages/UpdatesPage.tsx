/**
 * UpdatesPage.tsx — شاشة نظام التحديثات
 * الإعدادات → النظام → التحديثات
 */
import { useState, useEffect } from "react";
import { trpc } from "@/shared/lib/trpc";
import { Button } from "@/core/ui/button";
import { Badge } from "@/core/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";
import { toast } from "sonner";
import {
  RefreshCw, Download, CheckCircle, XCircle, AlertTriangle,
  Info, Shield, Clock, Cpu, HardDrive, Wifi, WifiOff,
  ChevronDown, ChevronRight, Package, History, Zap,
  ArrowUpCircle, Server,
} from "lucide-react";

/* ── أنواع ─────────────────────────────────────────────────────────────────── */
type CheckStatus = "idle" | "checking" | "up_to_date" | "update_available" | "offline" | "error";
type InstallStep =
  | "backup" | "download" | "verify" | "apply"
  | "migrate" | "verify_install" | "done" | "rollback";

interface InstallProgress {
  step:    InstallStep;
  percent: number;
  message: string;
}

const STEP_LABELS: Record<InstallStep, string> = {
  backup:         "أخذ نسخة احتياطية",
  download:       "تنزيل التحديث",
  verify:         "التحقق من سلامة الملفات",
  apply:          "تطبيق التحديث",
  migrate:        "تحديث قاعدة البيانات",
  verify_install: "التحقق من نجاح التحديث",
  done:           "اكتمل التحديث",
  rollback:       "استرجاع النسخة السابقة",
};

const INSTALL_STEPS: InstallStep[] = [
  "backup", "download", "verify", "apply", "migrate", "verify_install", "done"
];

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function UpdatesPage() {
  const [checkStatus,   setCheckStatus]   = useState<CheckStatus>("idle");
  const [checkResult,   setCheckResult]   = useState<any>(null);
  const [installing,    setInstalling]    = useState(false);
  const [progress,      setProgress]      = useState<InstallProgress | null>(null);
  const [expandChangelog, setExpandChangelog] = useState(true);
  const [expandHistory,   setExpandHistory]   = useState(false);

  /* ── tRPC queries ── */
  const versionQ   = trpc.updates.getCurrentVersion.useQuery(undefined, { staleTime: 60_000 });
  const changelogQ = trpc.updates.getChangelog.useQuery(undefined, { staleTime: 60_000 });
  const pingQ      = trpc.updates.pingUpdateServer.useQuery(undefined, {
    staleTime: 30_000,
    retry: false,
  });

  const checkMut   = trpc.updates.checkForUpdates.useMutation();
  const installMut = trpc.updates.installUpdate.useMutation();

  const versionInfo = versionQ.data;
  const changelog   = changelogQ.data ?? [];
  const ping        = pingQ.data;

  /* ── البحث عن تحديثات ── */
  async function handleCheck() {
    setCheckStatus("checking");
    setCheckResult(null);
    try {
      const result = await checkMut.mutateAsync({ channel: "stable" });
      setCheckResult(result);
      setCheckStatus(result.status as CheckStatus);
    } catch {
      setCheckStatus("error");
    }
  }

  /* ── تشغيل التحديث مع محاكاة التقدم ── */
  async function handleInstall() {
    if (!checkResult?.manifest) return;
    setInstalling(true);

    const steps: { step: InstallStep; percent: number; message: string; delay: number }[] = [
      { step: "backup",         percent: 10, message: "جارٍ أخذ نسخة احتياطية من البيانات...",        delay: 1200 },
      { step: "download",       percent: 35, message: "جارٍ تنزيل حزمة التحديث...",                   delay: 2500 },
      { step: "verify",         percent: 50, message: "التحقق من سلامة الملفات (Checksum)...",        delay: 800  },
      { step: "apply",          percent: 70, message: "تطبيق ملفات التحديث...",                       delay: 1500 },
      { step: "migrate",        percent: 85, message: "تحديث قاعدة البيانات (Migrations)...",         delay: 1000 },
      { step: "verify_install", percent: 95, message: "التحقق من نجاح التحديث...",                   delay: 800  },
    ];

    for (const s of steps) {
      setProgress({ step: s.step, percent: s.percent, message: s.message });
      await new Promise(r => setTimeout(r, s.delay));
    }

    try {
      const result = await installMut.mutateAsync({
        targetVersion: checkResult.manifest.version,
        downloadUrl:   checkResult.manifest.downloadUrl,
        checksum:      checkResult.manifest.checksum,
      });

      if (result.success) {
        setProgress({ step: "done", percent: 100, message: "اكتمل التحديث بنجاح!" });
        toast.success(`✅ تم التحديث إلى الإصدار ${checkResult.manifest.version}`);
        versionQ.refetch();
      } else {
        setProgress({ step: "rollback", percent: 0, message: result.message });
        toast.error("فشل التحديث — تم استرجاع النسخة السابقة تلقائياً");
      }
    } catch {
      setProgress({ step: "rollback", percent: 0, message: "فشل التحديث — تم استرجاع النسخة السابقة" });
      toast.error("حدث خطأ أثناء التحديث");
    } finally {
      setInstalling(false);
    }
  }

  /* ── ألوان الحالة ── */
  const statusConfig: Record<CheckStatus, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    idle:             { color: "text-gray-500",  bg: "bg-gray-50",   icon: <Info className="w-4 h-4" />,          label: "لم يتم الفحص بعد" },
    checking:         { color: "text-blue-600",  bg: "bg-blue-50",   icon: <RefreshCw className="w-4 h-4 animate-spin" />, label: "جارٍ البحث..." },
    up_to_date:       { color: "text-green-600", bg: "bg-green-50",  icon: <CheckCircle className="w-4 h-4" />,   label: "أحدث إصدار" },
    update_available: { color: "text-amber-600", bg: "bg-amber-50",  icon: <ArrowUpCircle className="w-4 h-4" />, label: "يوجد تحديث" },
    offline:          { color: "text-red-500",   bg: "bg-red-50",    icon: <WifiOff className="w-4 h-4" />,       label: "لا يوجد اتصال" },
    error:            { color: "text-red-500",   bg: "bg-red-50",    icon: <XCircle className="w-4 h-4" />,       label: "خطأ" },
  };
  const sc = statusConfig[checkStatus];

  /* ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">

      {/* ── العنوان ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#D19C05]/10 flex items-center justify-center">
          <Package className="w-5 h-5 text-[#D19C05]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">التحديثات</h1>
          <p className="text-sm text-gray-500">إدارة إصدارات OneSoft ERP وتحديثاتها</p>
        </div>
      </div>

      {/* ── معلومات الإصدار الحالي ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-4 h-4 text-[#D19C05]" />
            الإصدار الحالي
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versionQ.isLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-100 rounded w-1/3" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ) : versionInfo ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoTile icon={<Package className="w-4 h-4" />}  label="الإصدار"       value={versionInfo.version} highlight />
              <InfoTile icon={<Zap className="w-4 h-4" />}      label="رقم البناء"    value={versionInfo.build} />
              <InfoTile icon={<Clock className="w-4 h-4" />}    label="تاريخ الإصدار" value={versionInfo.releaseDate} />
              <InfoTile icon={<Cpu className="w-4 h-4" />}      label="المنصة"        value={`${versionInfo.platform} ${versionInfo.arch}`} />
              <InfoTile icon={<Server className="w-4 h-4" />}   label="Node.js"       value={versionInfo.nodeVersion} />
              <InfoTile icon={<HardDrive className="w-4 h-4" />} label="الذاكرة"      value={`${versionInfo.memoryMb} MB`} />
              <InfoTile icon={<Clock className="w-4 h-4" />}    label="وقت التشغيل"   value={versionInfo.uptime} />
              <InfoTile icon={<Shield className="w-4 h-4" />}   label="Schema"        value={versionInfo.schemaVersion?.slice(0, 6) + "..."} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── حالة الاتصال بخادم التحديثات ── */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {pingQ.isLoading ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm">جارٍ فحص الاتصال...</span>
                </div>
              ) : ping?.online ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Wifi className="w-4 h-4" />
                  <span className="text-sm font-medium">متصل بخادم التحديثات</span>
                  <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
                    {ping.latencyMs}ms
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-500">
                  <WifiOff className="w-4 h-4" />
                  <span className="text-sm font-medium">غير متصل بخادم التحديثات</span>
                </div>
              )}
            </div>

            {/* ── نتيجة الفحص ── */}
            {checkResult && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${sc.bg} ${sc.color}`}>
                {sc.icon}
                {checkResult.message}
                {checkResult.checkedAt && (
                  <span className="text-xs opacity-60 mr-2">
                    {new Date(checkResult.checkedAt).toLocaleTimeString("ar-SA")}
                  </span>
                )}
              </div>
            )}

            <Button
              onClick={handleCheck}
              disabled={checkStatus === "checking" || installing}
              className="gap-2 bg-[#D19C05] hover:bg-[#B8890A] text-white"
            >
              <RefreshCw className={`w-4 h-4 ${checkStatus === "checking" ? "animate-spin" : ""}`} />
              البحث عن تحديثات
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── تحديث متاح ── */}
      {checkStatus === "update_available" && checkResult?.manifest && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <ArrowUpCircle className="w-5 h-5" />
              تحديث متاح — الإصدار {checkResult.manifest.version}
              {checkResult.manifest.isCritical && (
                <Badge className="bg-red-500 text-white text-xs">تحديث أمني حرج</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <InfoTile icon={<Package className="w-4 h-4 text-amber-600" />} label="الإصدار الجديد"  value={checkResult.manifest.version} />
              <InfoTile icon={<Clock className="w-4 h-4 text-amber-600" />}   label="تاريخ الإصدار"  value={checkResult.manifest.releaseDate} />
              <InfoTile icon={<HardDrive className="w-4 h-4 text-amber-600" />} label="حجم التحديث" value={checkResult.manifest.size ?? "—"} />
            </div>

            {/* ما الجديد */}
            {checkResult.manifest.changelog?.length > 0 && (
              <div className="bg-white rounded-lg border border-amber-200 p-4">
                <p className="text-sm font-semibold text-amber-800 mb-3">ما الجديد في هذا الإصدار:</p>
                <ul className="space-y-1.5">
                  {checkResult.manifest.changelog[0]?.changes?.map((c: any, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      {categoryIcon(c.category)}
                      <span>{c.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* شريط التقدم */}
            {installing && progress && (
              <InstallProgressBar progress={progress} />
            )}

            {/* أزرار التثبيت */}
            {!installing && progress?.step !== "done" && (
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleInstall}
                  disabled={installing}
                  className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Download className="w-4 h-4" />
                  تنزيل وتثبيت التحديث
                </Button>
                <p className="text-xs text-gray-500">
                  سيتم أخذ نسخة احتياطية تلقائياً قبل التحديث
                </p>
              </div>
            )}

            {/* نجاح التثبيت */}
            {progress?.step === "done" && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-700">اكتمل التحديث بنجاح</p>
                  <p className="text-xs text-green-600">أعد تشغيل البرنامج لتطبيق التغييرات</p>
                </div>
                <Button
                  size="sm"
                  className="mr-auto bg-green-600 hover:bg-green-700 text-white gap-1"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="w-3 h-3" />
                  إعادة التشغيل
                </Button>
              </div>
            )}

            {/* فشل التثبيت */}
            {progress?.step === "rollback" && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">فشل التحديث</p>
                  <p className="text-xs text-red-600 mt-1">{progress.message}</p>
                  <p className="text-xs text-red-500 mt-1">تم استرجاع النسخة السابقة تلقائياً — النظام يعمل بشكل طبيعي</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── أحدث إصدار ── */}
      {checkStatus === "up_to_date" && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-700">أنت تستخدم أحدث إصدار</p>
              <p className="text-xs text-green-600">الإصدار {checkResult?.currentVersion} — لا توجد تحديثات متاحة حالياً</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── غير متصل ── */}
      {checkStatus === "offline" && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-4 flex items-center gap-3">
            <WifiOff className="w-6 h-6 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">تعذر الاتصال بخادم التحديثات</p>
              <p className="text-xs text-red-600">تحقق من الاتصال بالإنترنت وحاول مجدداً</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── CHANGELOG ── */}
      <Card>
        <CardHeader className="pb-2">
          <button
            className="flex items-center gap-2 w-full text-right"
            onClick={() => setExpandChangelog(v => !v)}
          >
            <History className="w-4 h-4 text-[#D19C05]" />
            <span className="font-semibold text-sm">سجل التحديثات (Changelog)</span>
            <span className="mr-auto">
              {expandChangelog ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </span>
          </button>
        </CardHeader>
        {expandChangelog && (
          <CardContent className="space-y-4 pt-0">
            {changelog.map(entry => (
              <ChangelogCard key={entry.version} entry={entry} />
            ))}
            {changelog.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">لا يوجد سجل تحديثات</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── سجل عمليات التحديث ── */}
      {(versionInfo?.updateLog?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <button
              className="flex items-center gap-2 w-full text-right"
              onClick={() => setExpandHistory(v => !v)}
            >
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="font-semibold text-sm">تاريخ التحديثات المنفذة</span>
              <span className="mr-auto">
                {expandHistory ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </span>
            </button>
          </CardHeader>
          {expandHistory && (
            <CardContent className="pt-0">
              <div className="space-y-2">
                {versionInfo?.updateLog?.map((log: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-sm py-2 border-b last:border-0">
                    {log.status === "success"
                      ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    }
                    <span className="font-medium">{log.from} → {log.to}</span>
                    <Badge variant="outline" className={`text-xs ${log.status === "success" ? "border-green-200 text-green-600" : "border-amber-200 text-amber-600"}`}>
                      {log.status === "success" ? "نجح" : "استرجاع"}
                    </Badge>
                    <span className="text-gray-400 text-xs mr-auto">
                      {new Date(log.date).toLocaleDateString("ar-SA")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── ميزات قادمة ── */}
      <Card className="border-dashed border-gray-200 bg-gray-50/50">
        <CardContent className="pt-4">
          <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">ميزات قادمة في نظام التحديثات</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              "التحقق التلقائي عند بدء التشغيل",
              "التنزيل في الخلفية",
              "Delta Updates (الملفات المتغيرة فقط)",
              "التحديث التلقائي المجدول",
              "التحقق من الترخيص قبل التحديث",
              "قناة Beta للاختبار",
            ].map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-gray-500">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

/* ══════════════════ Sub-components ══════════════════ */

function InfoTile({ icon, label, value, highlight }: {
  icon: React.ReactNode; label: string; value: string; highlight?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-gray-500">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-sm font-semibold ${highlight ? "text-[#D19C05]" : "text-gray-800"}`}>
        {value}
      </p>
    </div>
  );
}

function InstallProgressBar({ progress }: { progress: InstallProgress }) {
  const stepIndex  = INSTALL_STEPS.indexOf(progress.step);
  const totalSteps = INSTALL_STEPS.length;

  return (
    <div className="bg-white rounded-lg border border-amber-200 p-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{progress.message}</span>
        <span className="text-amber-600 font-bold">{progress.percent}%</span>
      </div>

      {/* شريط التقدم */}
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="h-2 rounded-full bg-amber-500 transition-all duration-500"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      {/* خطوات التقدم */}
      <div className="flex justify-between mt-1">
        {INSTALL_STEPS.filter(s => s !== "done").map((step, i) => (
          <div key={step} className="flex flex-col items-center gap-1">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
              i < stepIndex
                ? "bg-green-500 text-white"
                : i === stepIndex
                  ? "bg-amber-500 text-white animate-pulse"
                  : "bg-gray-200 text-gray-400"
            }`}>
              {i < stepIndex ? "✓" : i + 1}
            </div>
            <span className="text-[9px] text-gray-400 text-center max-w-[50px] leading-tight hidden sm:block">
              {STEP_LABELS[step]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangelogCard({ entry }: { entry: any }) {
  const [open, setOpen] = useState(true);
  const typeColors: Record<string, string> = {
    major: "bg-purple-100 text-purple-700",
    minor: "bg-blue-100   text-blue-700",
    patch: "bg-gray-100   text-gray-600",
  };
  const typeLabels: Record<string, string> = {
    major: "إصدار رئيسي",
    minor: "إصدار فرعي",
    patch: "إصلاحات",
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-right"
        onClick={() => setOpen(v => !v)}
      >
        <span className="font-bold text-gray-800">v{entry.version}</span>
        <Badge className={`text-xs ${typeColors[entry.type] ?? typeColors.patch}`}>
          {typeLabels[entry.type] ?? entry.type}
        </Badge>
        <span className="text-xs text-gray-500">{entry.date}</span>
        {entry.title && <span className="text-xs text-gray-600 mr-2">{entry.title}</span>}
        <span className="mr-auto">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </span>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-1.5">
          {entry.changes?.map((c: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
              {categoryIcon(c.category)}
              <span>{c.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function categoryIcon(cat: string) {
  const icons: Record<string, React.ReactNode> = {
    added:    <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />,
    fixed:    <Shield      className="w-3.5 h-3.5 text-blue-500  shrink-0 mt-0.5" />,
    improved: <Zap         className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />,
    security: <Shield      className="w-3.5 h-3.5 text-red-500   shrink-0 mt-0.5" />,
    breaking: <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />,
  };
  return icons[cat] ?? <div className="w-3.5 h-3.5 rounded-full bg-gray-300 shrink-0 mt-0.5" />;
}
