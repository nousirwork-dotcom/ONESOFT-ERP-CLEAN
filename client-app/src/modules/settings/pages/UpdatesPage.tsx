/**
 * UpdatesPage.tsx — شاشة إدارة التحديثات (الإعدادات → النظام → التحديثات)
 *
 * الغرض: إدارة يدوية للتحديثات بعد أن تُغلق نافذة التشغيل.
 *
 * - تقرأ من updateStore: إذا أجّل المستخدم تحديثاً اختيارياً، يظهر هنا.
 * - استخدام Electron IPC مباشرةً للبحث / التحميل / التثبيت.
 * - تقرأ معلومات الإصدار الحالي من tRPC (بيانات الخادم).
 */

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/shared/lib/trpc";
import { Button } from "@/core/ui/button";
import { Badge } from "@/core/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";
import {
  RefreshCw, Download, CheckCircle2, XCircle, AlertTriangle,
  Info, Shield, Clock, Cpu, HardDrive, Wifi, WifiOff,
  ChevronDown, ChevronRight, Package, History, Zap,
  ArrowUpCircle, Server, ShieldAlert, CheckCircle,
} from "lucide-react";
import { useUpdateState } from "@/shared/lib/update-store";
import type { PendingManifest } from "@/shared/lib/update-store";

// ─── Electron updater bridge ──────────────────────────────────────────────────
interface ElectronUpdater {
  onUpdateStatus:     (cb: (e: unknown, data: unknown) => void) => () => void;
  onUpdateProgress:   (cb: (e: unknown, data: unknown) => void) => () => void;
  onUpdateDownloaded: (cb: (e: unknown, data: unknown) => void) => () => void;
  onUpdateError:      (cb: (e: unknown, data: unknown) => void) => () => void;
  onUpdateLog?:       (cb: (e: unknown, data: unknown) => void) => () => void;
  startDownload:      () => Promise<{ ok: boolean; error?: string }>;
  installNow:         () => Promise<{ ok: boolean; error?: string }>;
  skipUpdate:         () => Promise<void>;
  checkNow:           () => Promise<{ ok: boolean; error?: string }>;
}
interface InstallerBridge {
  updater?: ElectronUpdater;
  getVersion?: () => Promise<string>;
}
function getUpdater(): ElectronUpdater | null {
  const w = window as unknown as { installer?: InstallerBridge };
  return w?.installer?.updater ?? null;
}
function getInstaller(): InstallerBridge | null {
  const w = window as unknown as { installer?: InstallerBridge };
  return w?.installer ?? null;
}
const isElectron = !!getUpdater();

// ─── Diagnostic log entry ─────────────────────────────────────────────────────
interface DiagEntry {
  event: string;
  currentVersion?: string;
  latestVersion?: string;
  isNewer?: boolean;
  downloadUrl?: string;
  source?: string;
  url?: string;
  [key: string]: unknown;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type CheckPhase = "idle" | "checking" | "no-update" | "update-available" | "error";
type DownloadPhase = "idle" | "downloading" | "downloaded" | "installing" | "error";

interface DownloadProgress {
  percent:        number;
  transferred:    number;
  total:          number;
  bytesPerSecond: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`;
  if (b >= 1_048_576)     return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1_024)         return `${(b / 1_024).toFixed(0)} KB`;
  return `${b} B`;
}
function fmtSpeed(bps: number): string {
  if (bps >= 1_048_576) return `${(bps / 1_048_576).toFixed(1)} MB/ث`;
  if (bps >= 1_024)     return `${(bps / 1_024).toFixed(0)} KB/ث`;
  return `${bps} B/ث`;
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* ══════════════════════════════════════════════════════════════════════════════
   UpdatesPage
══════════════════════════════════════════════════════════════════════════════ */
export default function UpdatesPage() {
  const store = useUpdateState();

  // ─── الإصدار الحقيقي من app.getVersion() عبر IPC ───────────────────────────
  const [electronVersion, setElectronVersion] = useState("");
  useEffect(() => {
    getInstaller()?.getVersion?.()
      .then((v) => { if (v) setElectronVersion(v); })
      .catch(() => {});
  }, []);

  // ─── حالة الفحص ────────────────────────────────────────────────────────────
  const [checkPhase, setCheckPhase]     = useState<CheckPhase>("idle");
  const [checkError, setCheckError]     = useState("");
  const [manifest, setManifest]         = useState<PendingManifest | null>(null);
  const [currentVer, setCurrentVer]     = useState("");

  // ─── لوجات التشخيص ─────────────────────────────────────────────────────────
  const [diagLogs, setDiagLogs]         = useState<DiagEntry[]>([]);
  const [showDiag, setShowDiag]         = useState(false);

  // ─── حالة التحميل / التثبيت ────────────────────────────────────────────────
  const [dlPhase, setDlPhase]           = useState<DownloadPhase>("idle");
  const [dlProgress, setDlProgress]     = useState<DownloadProgress | null>(null);
  const [dlError, setDlError]           = useState("");

  // ─── UI ─────────────────────────────────────────────────────────────────────
  const [showNotes, setShowNotes]       = useState(true);
  const [showChangelog, setShowChangelog] = useState(false);

  // ─── tRPC: معلومات الإصدار الحالي (بيانات الخادم) ──────────────────────────
  const versionQ   = trpc.updates.getCurrentVersion.useQuery(undefined, { staleTime: 60_000 });
  const changelogQ = trpc.updates.getChangelog.useQuery(undefined, { staleTime: 60_000 });
  const versionInfo = versionQ.data;
  const changelog   = changelogQ.data ?? [];

  // ─── قراءة حالة التحديث من updateStore (من UpdateDialog) ─────────────────
  useEffect(() => {
    if (store.pendingManifest && store.updateType) {
      setManifest(store.pendingManifest);
      setCurrentVer(store.currentVersion);
      setCheckPhase("update-available");
    } else if (store.lastChecked && !store.pendingManifest) {
      setCurrentVer(store.currentVersion);
      setCheckPhase("no-update");
    }
    if (store.lastError && !store.pendingManifest) {
      setCheckError(store.lastError);
      setCheckPhase("error");
    }
  }, [store.pendingManifest, store.updateType, store.lastChecked, store.lastError, store.currentVersion]);

  // ─── الاشتراك في IPC events لتلقي نتائج الفحص والتحميل ────────────────────
  useEffect(() => {
    const updater = getUpdater();
    if (!updater) return;

    const offStatus = updater.onUpdateStatus((_, raw) => {
      const data = raw as { type: string; manifest?: PendingManifest; currentVersion?: string; message?: string };
      if (data.type === "checking") {
        setCheckPhase("checking");
        setCheckError("");
        setManifest(null);
        setDiagLogs([]);
      } else if (data.type === "optional" || data.type === "mandatory") {
        setManifest(data.manifest ?? null);
        setCurrentVer(data.currentVersion ?? "");
        setCheckPhase("update-available");
        setShowDiag(true);
      } else if (data.type === "no-update") {
        setManifest(null);
        setCurrentVer(data.currentVersion ?? "");
        setCheckPhase("no-update");
        setShowDiag(true);
      } else if (data.type === "error") {
        setCheckError(data.message ?? "خطأ غير معروف");
        setCheckPhase("error");
        setShowDiag(true);
      }
    });

    const offProgress = updater.onUpdateProgress((_, raw) => {
      setDlProgress(raw as DownloadProgress);
    });

    const offDownloaded = updater.onUpdateDownloaded(() => {
      setDlPhase("downloaded");
    });

    const offError = updater.onUpdateError((_, raw) => {
      const data = raw as { message: string };
      setDlError(data.message);
      setDlPhase("error");
    });

    const offLog = updater.onUpdateLog?.((_, raw) => {
      setDiagLogs((prev) => [...prev.slice(-30), raw as DiagEntry]);
    });

    return () => { offStatus(); offProgress(); offDownloaded(); offError(); offLog?.(); };
  }, []);

  // ─── البحث اليدوي عن تحديثات ────────────────────────────────────────────
  const handleCheck = useCallback(async () => {
    const updater = getUpdater();
    if (!updater) return;
    setCheckPhase("checking");
    setCheckError("");
    setManifest(null);
    setDlPhase("idle");
    setDlProgress(null);
    setDlError("");
    const result = await updater.checkNow();
    if (!result.ok && result.error) {
      setCheckError(result.error);
      setCheckPhase("error");
    }
  }, []);

  // ─── تحميل التحديث ───────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    const updater = getUpdater();
    if (!updater) return;
    setDlPhase("downloading");
    setDlProgress(null);
    setDlError("");
    const result = await updater.startDownload();
    if (!result.ok) {
      setDlError(result.error ?? "فشل التحميل");
      setDlPhase("error");
    }
  }, []);

  // ─── تثبيت التحديث (إعادة التشغيل) ─────────────────────────────────────
  const handleInstall = useCallback(async () => {
    const updater = getUpdater();
    if (!updater) return;
    setDlPhase("installing");
    await updater.installNow();
  }, []);

  // ─── Retry التحميل ──────────────────────────────────────────────────────
  const handleRetry = useCallback(async () => {
    setDlPhase("idle");
    setDlProgress(null);
    setDlError("");
    await handleDownload();
  }, [handleDownload]);

  /* ──────────────────────────────────────────────────────────────────────────
     الواجهة
  ────────────────────────────────────────────────────────────────────────── */
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" dir="rtl">

      {/* ── العنوان ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <Package className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">التحديثات</h1>
          <p className="text-sm text-gray-500">إدارة إصدارات OneSoft ERP وتحديثاتها يدوياً</p>
        </div>
      </div>

      {/* ── معلومات الإصدار الحالي (من tRPC) ────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-4 h-4 text-amber-600" />
            الإصدار الحالي
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versionQ.isLoading && !electronVersion ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-100 rounded w-1/3" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* الإصدار: مصدره app.getVersion() عبر IPC — هو الرقم الحقيقي المثبت */}
              <InfoTile icon={<Package className="w-4 h-4" />}    label="الإصدار (Electron)" value={electronVersion || versionInfo?.version || "—"} gold />
              <InfoTile icon={<Zap className="w-4 h-4" />}        label="رقم البناء"          value={versionInfo?.build || "—"} />
              <InfoTile icon={<Clock className="w-4 h-4" />}      label="تاريخ الإصدار"       value={versionInfo?.releaseDate || "—"} />
              <InfoTile icon={<Cpu className="w-4 h-4" />}        label="المنصة"              value={versionInfo ? `${versionInfo.platform} ${versionInfo.arch}` : "—"} />
              <InfoTile icon={<Server className="w-4 h-4" />}     label="Node.js"             value={versionInfo?.nodeVersion || "—"} />
              <InfoTile icon={<HardDrive className="w-4 h-4" />}  label="الذاكرة"             value={versionInfo ? `${versionInfo.memoryMb} MB` : "—"} />
              <InfoTile icon={<Clock className="w-4 h-4" />}      label="وقت التشغيل"         value={versionInfo?.uptime || "—"} />
              <InfoTile icon={<Shield className="w-4 h-4" />}     label="Schema"              value={versionInfo?.schemaVersion ? versionInfo.schemaVersion.slice(0, 8) + "…" : "—"} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── البحث عن تحديثات ────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 flex-wrap">

            {/* آخر فحص */}
            {store.lastChecked && checkPhase !== "checking" && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5" />
                آخر فحص: {fmtTime(store.lastChecked)}
              </div>
            )}

            {/* حالة الفحص */}
            <div className="flex-1" />
            <StatusPill phase={checkPhase} error={checkError} />

            {/* زر البحث */}
            {isElectron ? (
              <Button
                onClick={handleCheck}
                disabled={checkPhase === "checking" || dlPhase === "downloading" || dlPhase === "installing"}
                className="gap-2 bg-[#1B2B5C] hover:bg-[#162247] text-white"
              >
                <RefreshCw className={`w-4 h-4 ${checkPhase === "checking" ? "animate-spin" : ""}`} />
                البحث عن تحديثات
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                <Info className="w-4 h-4" />
                <span>متاح داخل تطبيق OneSoft المثبّت</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── تحديث متاح ──────────────────────────────────────────────────────── */}
      {checkPhase === "update-available" && manifest && (
        <Card className="border-amber-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              {store.updateType === "mandatory"
                ? <><ShieldAlert className="w-5 h-5 text-amber-600" /> تحديث إجباري مطلوب</>
                : <><ArrowUpCircle className="w-5 h-5" /> تحديث متاح</>}
              <Badge className={`text-xs text-white ${store.updateType === "mandatory" ? "bg-red-500" : "bg-amber-500"}`}>
                {store.updateType === "mandatory" ? "إجباري" : "اختياري"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* إصدارات */}
            <div className="flex gap-3">
              <VersionBadge label="الإصدار الحالي" version={currentVer || versionInfo?.version || "—"} />
              <span className="self-center text-gray-400 text-xl">←</span>
              <VersionBadge label="الإصدار الجديد" version={manifest.latestVersion} gold />
            </div>

            {/* معلومات إضافية */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              {manifest.fileSizeBytes && (
                <span className="flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" />
                  الحجم: <strong className="text-gray-700">{fmtBytes(manifest.fileSizeBytes)}</strong>
                </span>
              )}
              {manifest.sha512 && (
                <span className="flex items-center gap-1 text-green-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  SHA512 مُفعَّل
                </span>
              )}
              {manifest.publishedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(manifest.publishedAt).toLocaleDateString("ar-SA")}
                </span>
              )}
            </div>

            {/* رسالة التحديث */}
            {manifest.messageAr && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                {manifest.messageAr}
              </div>
            )}

            {/* ملاحظات الإصدار */}
            {manifest.releaseNotes && manifest.releaseNotes.length > 0 && (
              <div>
                <button
                  onClick={() => setShowNotes((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2"
                >
                  {showNotes ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  ما الجديد في هذا الإصدار ({manifest.releaseNotes.length})
                </button>
                {showNotes && (
                  <ul className="space-y-1.5 pr-4 bg-white rounded-lg border border-amber-100 p-3">
                    {manifest.releaseNotes.map((note, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500" />
                        {note}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* ─── شريط التحميل ─────────────────────────────────────────────── */}
            {dlPhase === "downloading" && (
              <DownloadProgressBar progress={dlProgress} />
            )}

            {/* ─── اكتمل التحميل ────────────────────────────────────────────── */}
            {dlPhase === "downloaded" && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-700">اكتمل التحميل والتحقق</p>
                  <p className="text-xs text-green-600">البرنامج سيُعاد تشغيله بعد الضغط على الزر</p>
                </div>
                <Button
                  onClick={handleInstall}
                  disabled={dlPhase === "installing"}
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                >
                  <RefreshCw className={`w-4 h-4 ${dlPhase === "installing" ? "animate-spin" : ""}`} />
                  إعادة التشغيل والتحديث
                </Button>
              </div>
            )}

            {/* ─── خطأ في التحميل ──────────────────────────────────────────── */}
            {dlPhase === "error" && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-700">تعذّر تحميل التحديث</p>
                  <p className="text-xs text-red-600 mt-1 break-all">{dlError}</p>
                </div>
                <Button size="sm" onClick={handleRetry} variant="outline" className="border-red-300 text-red-600 gap-1">
                  <RefreshCw className="w-3.5 h-3.5" />
                  إعادة المحاولة
                </Button>
              </div>
            )}

            {/* ─── زر التحميل ──────────────────────────────────────────────── */}
            {(dlPhase === "idle") && isElectron && (
              <div className="flex items-center gap-3 pt-1">
                <Button
                  onClick={handleDownload}
                  className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Download className="w-4 h-4" />
                  تحميل التحديث
                </Button>
                {manifest.sha512 && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    سيتم التحقق من سلامة الملف (SHA512) بعد التحميل
                  </p>
                )}
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* ── أحدث إصدار ──────────────────────────────────────────────────────── */}
      {checkPhase === "no-update" && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-700">أنت تستخدم أحدث إصدار</p>
              <p className="text-xs text-green-600 mt-0.5">
                الإصدار {currentVer || electronVersion || versionInfo?.version} — لا توجد تحديثات متاحة حالياً
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Panel تشخيصي ─────────────────────────────────────────────────────── */}
      {diagLogs.length > 0 && (
        <Card className="border-gray-200">
          <CardHeader className="pb-2">
            <button
              className="flex items-center gap-2 w-full text-right"
              onClick={() => setShowDiag((v) => !v)}
            >
              <Info className="w-4 h-4 text-gray-500" />
              <span className="font-semibold text-sm text-gray-700">تشخيص المقارنة (Diagnostic Log)</span>
              <span className="mr-auto text-gray-400">
                {showDiag ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </span>
            </button>
          </CardHeader>
          {showDiag && (
            <CardContent className="pt-0">
              <div className="rounded-lg bg-gray-950 text-green-400 font-mono text-xs p-3 space-y-1 overflow-x-auto" dir="ltr">
                {diagLogs.map((entry, i) => {
                  if (entry.event === 'semver-comparison') {
                    return (
                      <div key={i} className="space-y-0.5">
                        <div className="text-yellow-400 font-bold">── semver comparison ──</div>
                        <div>app.getVersion()     = <span className="text-white">{entry.currentVersion ?? '—'}</span></div>
                        <div>manifest.latestVersion = <span className="text-white">{entry.latestVersion ?? '—'}</span></div>
                        <div>isNewer (update needed) = <span className={entry.isNewer ? 'text-green-300' : 'text-red-400'}>{String(entry.isNewer)}</span></div>
                        <div>downloadUrl = <span className="text-blue-400 break-all">{entry.downloadUrl ?? '—'}</span></div>
                        <div>source = <span className="text-gray-300">{entry.source ?? '—'}</span></div>
                      </div>
                    );
                  }
                  if (entry.event === 'update-not-available') {
                    return (
                      <div key={i} className="text-red-400">
                        ✗ update-not-available — current={entry.currentVersion} latest={entry.latestVersion}
                      </div>
                    );
                  }
                  if (entry.event === 'update-available') {
                    return (
                      <div key={i} className="text-green-300">
                        ✓ update-available — {entry.currentVersion} → {entry.latestVersion}
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="text-gray-400">
                      [{entry.event}] {JSON.stringify(entry, null, 0).slice(0, 200)}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── خطأ في الفحص ────────────────────────────────────────────────────── */}
      {checkPhase === "error" && checkError && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-4 flex items-center gap-3">
            <WifiOff className="w-6 h-6 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">تعذّر الاتصال بخادم التحديثات</p>
              <p className="text-xs text-red-500 mt-0.5">تحقق من الاتصال بالإنترنت ثم أعد المحاولة</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── سجل التحديثات (Changelog) ───────────────────────────────────────── */}
      {changelog.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <button
              className="flex items-center gap-2 w-full text-right"
              onClick={() => setShowChangelog((v) => !v)}
            >
              <History className="w-4 h-4 text-amber-600" />
              <span className="font-semibold text-sm">سجل التحديثات (Changelog)</span>
              <span className="mr-auto text-gray-400">
                {showChangelog ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </span>
            </button>
          </CardHeader>
          {showChangelog && (
            <CardContent className="pt-0 space-y-4">
              {changelog.map((entry: any) => (
                <ChangelogCard key={entry.version} entry={entry} />
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* ── سجل التحديثات المنفذة ───────────────────────────────────────────── */}
      {(versionInfo?.updateLog?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="font-semibold text-sm">تاريخ التحديثات المنفذة</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {versionInfo?.updateLog?.map((log: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-sm py-2 border-b last:border-0">
                {log.status === "success"
                  ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                <span className="font-medium">{log.from} ← {log.to}</span>
                <Badge variant="outline" className={`text-xs ${log.status === "success" ? "border-green-200 text-green-600" : "border-amber-200 text-amber-600"}`}>
                  {log.status === "success" ? "نجح" : "استرجاع"}
                </Badge>
                <span className="text-gray-400 text-xs mr-auto">
                  {new Date(log.date).toLocaleDateString("ar-SA")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Sub-components
══════════════════════════════════════════════════════════════════════════════ */

function InfoTile({ icon, label, value, gold }: { icon: React.ReactNode; label: string; value: string; gold?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-gray-500">{icon}<span className="text-xs">{label}</span></div>
      <p className={`text-sm font-semibold ${gold ? "text-amber-600" : "text-gray-800"}`}>{value}</p>
    </div>
  );
}

function VersionBadge({ label, version, gold }: { label: string; version: string; gold?: boolean }) {
  return (
    <div className="flex-1 rounded-xl p-3 text-center" style={{ backgroundColor: gold ? "rgba(201,168,76,0.08)" : "rgba(107,114,128,0.06)", border: `1px solid ${gold ? "rgba(201,168,76,0.4)" : "rgba(107,114,128,0.15)"}` }}>
      <p className="text-xs mb-1 text-gray-500">{label}</p>
      <p className={`font-extrabold text-base ${gold ? "text-amber-700" : "text-gray-400"}`}>v{version}</p>
    </div>
  );
}

function StatusPill({ phase, error }: { phase: CheckPhase; error: string }) {
  if (phase === "idle") return null;
  const configs: Record<CheckPhase, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    idle:             { color: "text-gray-500",  bg: "bg-gray-50",   icon: <Info className="w-3.5 h-3.5" />,                              label: "" },
    checking:         { color: "text-blue-600",  bg: "bg-blue-50",   icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,            label: "جارٍ البحث..." },
    "no-update":      { color: "text-green-600", bg: "bg-green-50",  icon: <CheckCircle2 className="w-3.5 h-3.5" />,                      label: "أحدث إصدار" },
    "update-available": { color: "text-amber-600", bg: "bg-amber-50", icon: <ArrowUpCircle className="w-3.5 h-3.5" />,                    label: "يوجد تحديث" },
    error:            { color: "text-red-500",   bg: "bg-red-50",    icon: <WifiOff className="w-3.5 h-3.5" />,                           label: error ? "فشل الاتصال" : "خطأ" },
  };
  const c = configs[phase];
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${c.bg} ${c.color}`}>
      {c.icon}{c.label}
    </div>
  );
}

function DownloadProgressBar({ progress }: { progress: DownloadProgress | null }) {
  const pct = progress ? Math.round(progress.percent) : 0;
  return (
    <div className="bg-white rounded-lg border border-amber-200 p-4 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500 animate-pulse" />
          {progress ? `${fmtBytes(progress.transferred)} / ${fmtBytes(progress.total)}` : "جاري التحضير..."}
        </span>
        <span className="text-amber-600 font-bold">{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div className="h-2.5 rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #1B2B5C, #C9A84C)" }} />
      </div>
      {progress && progress.bytesPerSecond > 0 && (
        <p className="text-xs text-gray-500 text-center">
          سرعة التحميل: <strong className="text-gray-700">{fmtSpeed(progress.bytesPerSecond)}</strong>
        </p>
      )}
    </div>
  );
}

function ChangelogCard({ entry }: { entry: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        className="flex items-center gap-3 w-full px-4 py-3 text-right hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <Package className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="font-semibold text-sm text-gray-800">الإصدار {entry.version}</span>
        {entry.date && <span className="text-xs text-gray-400">{entry.date}</span>}
        <span className="mr-auto text-gray-400">{open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</span>
      </button>
      {open && entry.changes?.length > 0 && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-gray-100 pt-3">
          {entry.changes.map((c: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-amber-400" />
              {c.text ?? c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
