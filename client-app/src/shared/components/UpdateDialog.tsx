/**
 * UpdateDialog — نافذة التحديث التلقائي لـ OneSoft ERP  (v4)
 *
 * optional  → "تحديث الآن" + "تحميل في الخلفية" + "لاحقاً"
 * mandatory → "تحديث الآن" / "تحميل في الخلفية" — يمنع الدخول
 * downloading → "تحميل في الخلفية" + "إلغاء التحميل"
 * downloaded → نافذة خفيفة (غير حاجبة): "تثبيت الآن" + "لاحقاً"
 *
 * تاريخ الإصدار: ميلادي فقط yyyy-MM-dd من publishedAt في manifest
 */

import { useEffect, useRef, useState } from "react";
import {
  Download, RefreshCw, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Clock, Zap, ShieldAlert, X,
  ArrowDownToLine,
} from "lucide-react";
import { updateStore } from "@/shared/lib/update-store";
import type { PendingManifest } from "@/shared/lib/update-store";

type UpdateStatusEvent =
  | { type: "checking" }
  | { type: "no-update";  currentVersion: string }
  | { type: "optional";   manifest: PendingManifest; currentVersion: string }
  | { type: "mandatory";  manifest: PendingManifest; currentVersion: string }
  | { type: "error";      message: string };

interface DownloadProgress {
  percent:        number;
  transferred:    number;
  total:          number;
  bytesPerSecond: number;
}

type DialogState =
  | "idle"
  | "optional"
  | "mandatory"
  | "downloading"
  | "downloaded"
  | "error";

interface ElectronUpdater {
  onUpdateStatus:      (cb: (e: unknown, data: UpdateStatusEvent) => void) => () => void;
  onUpdateProgress:    (cb: (e: unknown, data: DownloadProgress) => void) => () => void;
  onUpdateDownloaded:  (cb: (e: unknown, data: { version: string }) => void) => () => void;
  onUpdateError:       (cb: (e: unknown, data: { message: string }) => void) => () => void;
  onUpdateCancelled?:  (cb: (e: unknown) => void) => () => void;
  startDownload:       () => Promise<{ ok: boolean; error?: string }>;
  installNow:          () => Promise<{ ok: boolean; error?: string }>;
  skipUpdate:          () => Promise<void>;
  skipVersion?:        () => Promise<{ ok: boolean; error?: string }>;
  cancelDownload?:     () => Promise<{ ok: boolean }>;
}
function getUpdater(): ElectronUpdater | null {
  const w = window as unknown as { installer?: { updater?: ElectronUpdater } };
  return w?.installer?.updater ?? null;
}

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

/** تنسيق تاريخ الإصدار: ميلادي yyyy-MM-dd فقط */
function fmtReleaseDate(publishedAt?: string): string {
  if (!publishedAt) return "";
  try {
    return new Date(publishedAt).toISOString().slice(0, 10);
  } catch {
    return publishedAt.slice(0, 10);
  }
}

export default function UpdateDialog() {
  const [state, setState]           = useState<DialogState>("idle");
  const [manifest, setManifest]     = useState<PendingManifest | null>(null);
  const [currentVer, setCurrentVer] = useState("");
  const [progress, setProgress]     = useState<DownloadProgress | null>(null);
  const [errMsg, setErrMsg]         = useState("");
  const [showNotes, setShowNotes]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [dontRemind, setDontRemind] = useState(false);
  const downloadedRef               = useRef(false);

  // مزامنة رؤية النافذة مع update-store
  const storeState = updateStore.getState();

  useEffect(() => {
    const updater = getUpdater();
    if (!updater) return;

    const offStatus = updater.onUpdateStatus((_, data) => {
      if (data.type === "optional") {
        setManifest(data.manifest);
        setCurrentVer(data.currentVersion);
        setDontRemind(false);
        setState("optional");
        updateStore.setOptional(data.manifest, data.currentVersion);
      } else if (data.type === "mandatory") {
        setManifest(data.manifest);
        setCurrentVer(data.currentVersion);
        setState("mandatory");
        updateStore.setMandatory(data.manifest, data.currentVersion);
      } else if (data.type === "no-update") {
        updateStore.setNoUpdate(data.currentVersion);
      } else if (data.type === "error") {
        updateStore.setError(data.message);
      }
    });

    const offProgress = updater.onUpdateProgress((_, data) => {
      setProgress(data);
      updateStore.setDownloading(Math.round(data.percent));
    });

    const offDownloaded = updater.onUpdateDownloaded(() => {
      downloadedRef.current = true;
      setLoading(false);
      setState("downloaded");
      updateStore.setDownloadDone();
    });

    const offError = updater.onUpdateError((_, data) => {
      const wasCancelled = data.message?.includes("download-cancelled") ||
                           data.message?.includes("cancelled");
      if (wasCancelled) {
        // إلغاء طوعي — لا نعرض خطأ
        setLoading(false);
        setState(storeState.updateType === "mandatory" ? "mandatory" : "optional");
        updateStore.setDownloadCancelled();
        return;
      }
      setErrMsg(data.message);
      setLoading(false);
      setState(downloadedRef.current ? "downloaded" : "error");
      updateStore.setError(data.message);
    });

    const offCancelled = updater.onUpdateCancelled?.((_, ) => {
      setLoading(false);
      setState(storeState.updateType === "mandatory" ? "mandatory" : "optional");
      updateStore.setDownloadCancelled();
    });

    return () => {
      offStatus();
      offProgress();
      offDownloaded();
      offError();
      offCancelled?.();
    };
  }, []);

  // مزامنة عرض النافذة من store (مثلاً عند الضغط على "عرض" في الـ badge)
  useEffect(() => {
    return updateStore.subscribe(() => {
      const s = updateStore.getState();
      if (s.dialogVisible && s.downloadReady && state !== "downloaded") {
        setState("downloaded");
      }
    });
  }, [state]);

  // إخفاء النافذة عند طلب الإخفاء من store
  useEffect(() => {
    return updateStore.subscribe(() => {
      const s = updateStore.getState();
      if (!s.dialogVisible && state !== "idle" && state !== "downloading") {
        // لا نُخفي أثناء التحميل إلا إذا انتقل للخلفية
      }
    });
  }, [state]);

  const visible = state !== "idle";
  if (!visible) return null;

  const isMandatory = state === "mandatory";
  // النافذة حاجبة فقط إذا: تحديث إجباري، أو اختياري قبل بدء التحميل، أو خطأ
  const isBlocking = isMandatory || state === "optional" || state === "error";
  // بعد اكتمال التحميل: نافذة خفيفة غير حاجبة
  const isReadyDialog = state === "downloaded";

  // ─── Handlers ──────────────────────────────────────────────────────────────
  async function handleDownload() {
    const updater = getUpdater();
    if (!updater) return;
    setLoading(true);
    setState("downloading");
    setProgress(null);
    const result = await updater.startDownload();
    if (!result.ok) {
      const wasCancelled = result.error?.includes("cancelled");
      if (!wasCancelled) {
        setErrMsg(result.error ?? "فشل التحميل");
        setLoading(false);
        setState("error");
      }
    }
  }

  async function handleDownloadBackground() {
    const updater = getUpdater();
    if (!updater) return;

    const isCurrentlyDownloading = state === "downloading";

    // أغلق النافذة فقط
    setState("idle");
    updateStore.hideDialog();

    if (isCurrentlyDownloading) {
      // التحميل جارٍ بالفعل — لا داعي لبدء جديد
      return;
    }

    // ابدأ التحميل في الخلفية
    setLoading(false);
    setProgress(null);
    downloadedRef.current = false;
    updateStore.setDownloading(0);
    const result = await updater.startDownload();
    if (!result.ok) {
      const wasCancelled = result.error?.includes("cancelled");
      if (!wasCancelled) {
        setErrMsg(result.error ?? "فشل التحميل");
        setState("error");
        updateStore.setError(result.error ?? "فشل التحميل");
        updateStore.showDialog();
      }
    }
  }

  async function handleCancelDownload() {
    const updater = getUpdater();
    if (updater?.cancelDownload) {
      await updater.cancelDownload();
    }
    setLoading(false);
    setState(isMandatory ? "mandatory" : "optional");
    updateStore.setDownloadCancelled();
  }

  async function handleInstall() {
    const updater = getUpdater();
    if (!updater) return;
    setLoading(true);
    await updater.installNow();
  }

  async function handleSkip() {
    const updater = getUpdater();
    if (updater) {
      if (dontRemind && updater.skipVersion) {
        await updater.skipVersion();
      } else {
        await updater.skipUpdate();
      }
    }
    updateStore.setOptional(manifest!, currentVer);
    updateStore.hideDialog();
    setDontRemind(false);
    setState("idle");
  }

  async function handleRetry() {
    downloadedRef.current = false;
    setErrMsg("");
    setProgress(null);
    await handleDownload();
  }

  // ─── Overlay (حاجب أو شفاف) ────────────────────────────────────────────────
  const overlayStyle = isBlocking
    ? { backgroundColor: "rgba(27,43,92,0.55)", backdropFilter: "blur(6px)", pointerEvents: "all" as const }
    : { backgroundColor: "rgba(0,0,0,0.15)", backdropFilter: "blur(2px)", pointerEvents: "all" as const };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={overlayStyle}
      dir="rtl"
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: "#FAF7F0" }}
      >
        {/* شريط تحذير إجباري */}
        {isMandatory && state !== "downloaded" && (
          <div className="flex items-center gap-2 px-5 py-3" style={{ backgroundColor: "#C9A84C", color: "#fff" }}>
            <ShieldAlert size={17} strokeWidth={2.5} />
            <div>
              <p className="text-sm font-bold leading-tight">تحديث إجباري مطلوب</p>
              <p className="text-xs opacity-90 mt-0.5">لا يمكن استخدام النظام قبل إتمام التحديث</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(201,168,76,0.25)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(27,43,92,0.08)" }}>
            {state === "downloaded"   ? <CheckCircle2 size={22} style={{ color: "#22c55e" }} />
             : state === "downloading" ? <Download size={22} style={{ color: "#1B2B5C" }} className="animate-bounce" />
             : state === "error"       ? <AlertTriangle size={22} style={{ color: "#dc2626" }} />
             : <RefreshCw size={22} style={{ color: "#1B2B5C" }} />}
          </div>
          <div className="flex-1">
            <h2 className="font-extrabold text-lg leading-tight" style={{ color: "#1B2B5C" }}>
              {state === "downloaded"   ? "التحديث جاهز للتثبيت"
               : state === "downloading" ? "جاري تحميل التحديث..."
               : state === "error"       ? "تعذّر تحميل التحديث"
               : isMandatory            ? "تحديث إجباري مطلوب"
               : "يوجد تحديث جديد متاح"}
            </h2>
            {manifest && (
              <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                {manifest.messageAr || (isMandatory
                  ? "هذا التحديث إجباري ويحتوي على تعديلات مهمة."
                  : "يوجد تحديث جديد — يمكنك التحديث الآن أو لاحقاً.")}
              </p>
            )}
          </div>
          {/* زر إغلاق للنافذة الخفيفة فقط (حالة downloaded) */}
          {isReadyDialog && (
            <button
              onClick={handleSkip}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
              title="لاحقاً"
            >
              <X size={16} style={{ color: "#9ca3af" }} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {manifest && (
            <div className="flex gap-3">
              <VersionBadge label="الإصدار الحالي" version={currentVer} dim />
              <span className="self-center text-gray-400 text-lg">←</span>
              <VersionBadge label="الإصدار الجديد" version={manifest.latestVersion} highlight />
            </div>
          )}

          {manifest?.fileSizeBytes && state !== "downloading" && state !== "downloaded" && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#6b7280" }}>
              <Download size={13} />
              <span>حجم التحديث: <strong>{fmtBytes(manifest.fileSizeBytes)}</strong></span>
              {manifest.sha512 && (
                <span className="mr-2 flex items-center gap-1 text-green-700 font-semibold">
                  <CheckCircle2 size={11} /> SHA512
                </span>
              )}
            </div>
          )}

          {state === "downloading" && <ProgressSection progress={progress} />}

          {state === "downloaded" && (
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <CheckCircle2 size={18} style={{ color: "#22c55e" }} />
              <p className="text-sm font-semibold" style={{ color: "#15803d" }}>
                اكتمل التحميل — سيُعاد تشغيل البرنامج لتطبيق التحديث
              </p>
            </div>
          )}

          {state === "error" && (
            <div className="p-3 rounded-xl text-sm" style={{ backgroundColor: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", color: "#b91c1c" }}>
              <p className="font-semibold mb-1">تعذّر إتمام التحميل</p>
              <p className="text-xs opacity-80 break-all">{errMsg}</p>
            </div>
          )}

          {manifest?.releaseNotes && manifest.releaseNotes.length > 0 && (
            <div>
              <button onClick={() => setShowNotes((v) => !v)} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#1B2B5C" }}>
                {showNotes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                ملخص التغييرات ({manifest.releaseNotes.length})
              </button>
              {showNotes && (
                <ul className="mt-2 space-y-1.5 pr-4">
                  {manifest.releaseNotes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "#374151" }}>
                      <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#C9A84C" }} />
                      {note}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {manifest?.publishedAt && (
            <p className="text-xs" style={{ color: "#9ca3af" }}>
              تاريخ الإصدار: <strong>{fmtReleaseDate(manifest.publishedAt)}</strong>
            </p>
          )}
        </div>

        {/* خيار "لا تذكرني بهذا الإصدار" */}
        {!isMandatory && state === "optional" && (
          <label className="flex items-center gap-2 px-6 pb-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontRemind}
              onChange={(e) => setDontRemind(e.target.checked)}
              className="w-4 h-4 rounded accent-[#1B2B5C]"
            />
            <span className="text-xs" style={{ color: "#6b7280" }}>
              لا تذكرني بهذا الإصدار مرة أخرى
            </span>
          </label>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 pb-5 pt-2 flex-wrap" style={{ borderTop: "1px solid rgba(201,168,76,0.15)" }}>

          {/* ── حالة: التحميل اكتمل ──────────────────────────────────────── */}
          {state === "downloaded" && (
            <>
              <button
                onClick={handleInstall}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
                style={{ backgroundColor: "#1B2B5C", color: "#fff", opacity: loading ? 0.7 : 1 }}
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                إعادة التشغيل والتثبيت
              </button>
              <button
                onClick={handleSkip}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm"
                style={{ backgroundColor: "rgba(107,114,128,0.1)", color: "#4b5563" }}
              >
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  لاحقاً
                </span>
              </button>
            </>
          )}

          {/* ── حالة: خطأ ────────────────────────────────────────────────── */}
          {state === "error" && (
            <>
              <button
                onClick={handleRetry}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
                style={{ backgroundColor: "#1B2B5C", color: "#fff" }}
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                إعادة المحاولة
              </button>
              {!isMandatory && (
                <button
                  onClick={handleSkip}
                  className="px-4 py-2.5 rounded-xl font-semibold text-sm"
                  style={{ backgroundColor: "rgba(107,114,128,0.1)", color: "#4b5563" }}
                >
                  لاحقاً
                </button>
              )}
            </>
          )}

          {/* ── حالة: جارٍ التحميل ───────────────────────────────────────── */}
          {state === "downloading" && (
            <>
              <button
                onClick={handleDownloadBackground}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
                style={{ backgroundColor: "rgba(27,43,92,0.08)", color: "#1B2B5C", border: "1px solid rgba(27,43,92,0.2)" }}
              >
                <ArrowDownToLine size={15} />
                تحميل في الخلفية
              </button>
              <button
                onClick={handleCancelDownload}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm"
                style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <span className="flex items-center gap-1.5">
                  <X size={14} />
                  إلغاء
                </span>
              </button>
            </>
          )}

          {/* ── حالة: تحديث متاح (اختياري أو إجباري) ────────────────────── */}
          {(state === "optional" || state === "mandatory") && (
            <>
              <button
                onClick={handleDownload}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
                style={{ backgroundColor: "#1B2B5C", color: "#fff", opacity: loading ? 0.7 : 1 }}
              >
                <Download size={15} />
                تحديث الآن
              </button>
              <button
                onClick={handleDownloadBackground}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-sm"
                style={{ backgroundColor: "rgba(27,43,92,0.06)", color: "#1B2B5C", border: "1px solid rgba(27,43,92,0.15)" }}
                title="تحميل في الخلفية ومتابعة العمل"
              >
                <ArrowDownToLine size={14} />
                <span className="hidden sm:inline">في الخلفية</span>
              </button>
              {!isMandatory && (
                <button
                  onClick={handleSkip}
                  className="px-4 py-2.5 rounded-xl font-semibold text-sm"
                  style={{ backgroundColor: "rgba(107,114,128,0.1)", color: "#4b5563" }}
                >
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} />
                    لاحقاً
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VersionBadge({ label, version, dim, highlight }: { label: string; version: string; dim?: boolean; highlight?: boolean }) {
  return (
    <div className="flex-1 rounded-xl p-3 text-center" style={{ backgroundColor: highlight ? "rgba(27,43,92,0.06)" : "rgba(107,114,128,0.06)", border: `1px solid ${highlight ? "rgba(27,43,92,0.2)" : "rgba(107,114,128,0.15)"}` }}>
      <p className="text-xs mb-1" style={{ color: dim ? "#9ca3af" : "#6b7280" }}>{label}</p>
      <p className="font-extrabold text-base" style={{ color: highlight ? "#1B2B5C" : "#9ca3af" }}>v{version}</p>
    </div>
  );
}

function ProgressSection({ progress }: { progress: { percent: number; transferred: number; total: number; bytesPerSecond: number } | null }) {
  const pct = progress ? Math.round(progress.percent) : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs" style={{ color: "#6b7280" }}>
        <span>{progress ? `${fmtBytes(progress.transferred)} / ${fmtBytes(progress.total)}` : "جاري التحضير..."}</span>
        <span className="font-bold" style={{ color: "#1B2B5C" }}>{pct}%</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(27,43,92,0.1)" }}>
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #1B2B5C, #C9A84C)" }} />
      </div>
      {progress && progress.bytesPerSecond > 0 && (
        <p className="text-xs text-center flex items-center justify-center gap-1.5" style={{ color: "#6b7280" }}>
          <Zap size={11} className="text-amber-500" />
          سرعة التحميل: <strong>{fmtSpeed(progress.bytesPerSecond)}</strong>
        </p>
      )}
    </div>
  );
}
