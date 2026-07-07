/**
 * UpdateDialog — نافذة التحديث التلقائي لـ OneSoft ERP  (v2)
 *
 * نوعان من التحديث:
 *   optional  → زر "لاحقاً" (تأجيل 24 ساعة) + "تحديث الآن"
 *   mandatory → زر "تحديث الآن" فقط — يمنع الدخول الكامل للنظام
 *
 * تصميم OneSoft:
 *   خلفية: #FAF7F0 (كريم) | Navy: #1B2B5C | Gold: #C9A84C
 *
 * useIsMandatoryBlocked()  — hook يُستخدم في App.tsx لمنع توجيه المسارات
 */

import { useEffect, useRef, useState } from "react";
import {
  Download, RefreshCw, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Clock, Zap, ShieldAlert,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UpdateManifest {
  latestVersion:       string;
  minSupportedVersion: string;
  mandatory:           boolean;
  messageAr:           string;
  messageEn:           string;
  releaseNotes:        string[];
  downloadUrl:         string;
  fileSizeBytes?:      number;
  sha512?:             string;
  publishedAt?:        string;
}

type UpdateStatusEvent =
  | { type: "checking" }
  | { type: "no-update";  currentVersion: string }
  | { type: "optional";   manifest: UpdateManifest; currentVersion: string }
  | { type: "mandatory";  manifest: UpdateManifest; currentVersion: string }
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

// ─── Module-level mandatory signal — يُقرأ من App.tsx ──────────────────────────
let _mandatoryActive = false;
const _mandatoryListeners = new Set<(v: boolean) => void>();

function _setMandatory(v: boolean): void {
  _mandatoryActive = v;
  _mandatoryListeners.forEach((fn) => fn(v));
}

/**
 * يُرجع true عندما يكون هناك تحديث إجباري نشط.
 * استخدمه في App.tsx لمنع تحميل أي مسار.
 */
export function useIsMandatoryBlocked(): boolean {
  const [blocked, setBlocked] = useState(_mandatoryActive);
  useEffect(() => {
    _mandatoryListeners.add(setBlocked);
    return () => { _mandatoryListeners.delete(setBlocked); };
  }, []);
  return blocked;
}

// ─── Electron bridge ──────────────────────────────────────────────────────────
interface ElectronUpdater {
  onUpdateStatus:     (cb: (e: unknown, data: UpdateStatusEvent) => void) => () => void;
  onUpdateProgress:   (cb: (e: unknown, data: DownloadProgress) => void) => () => void;
  onUpdateDownloaded: (cb: (e: unknown, data: { version: string }) => void) => () => void;
  onUpdateError:      (cb: (e: unknown, data: { message: string }) => void) => () => void;
  startDownload:      () => Promise<{ ok: boolean; error?: string }>;
  installNow:         () => Promise<{ ok: boolean; error?: string }>;
  skipUpdate:         () => Promise<void>;
}

function getUpdater(): ElectronUpdater | null {
  const w = window as unknown as { installer?: { updater?: ElectronUpdater } };
  return w?.installer?.updater ?? null;
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

// ─── UpdateDialog ─────────────────────────────────────────────────────────────
export default function UpdateDialog() {
  const [state, setState]           = useState<DialogState>("idle");
  const [manifest, setManifest]     = useState<UpdateManifest | null>(null);
  const [currentVer, setCurrentVer] = useState("");
  const [progress, setProgress]     = useState<DownloadProgress | null>(null);
  const [errMsg, setErrMsg]         = useState("");
  const [showNotes, setShowNotes]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const downloadedRef               = useRef(false);

  useEffect(() => {
    const updater = getUpdater();
    if (!updater) return;

    const offStatus = updater.onUpdateStatus((_, data) => {
      if (data.type === "optional") {
        setManifest(data.manifest);
        setCurrentVer(data.currentVersion);
        setState("optional");
        _setMandatory(false);
      } else if (data.type === "mandatory") {
        setManifest(data.manifest);
        setCurrentVer(data.currentVersion);
        setState("mandatory");
        _setMandatory(true);   // ← يمنع الدخول للنظام من App.tsx
      }
    });

    const offProgress = updater.onUpdateProgress((_, data) => {
      setProgress(data);
    });

    const offDownloaded = updater.onUpdateDownloaded(() => {
      downloadedRef.current = true;
      setLoading(false);
      setState("downloaded");
      // mandatory يبقى مفعّلاً حتى يُعيد المستخدم تشغيل البرنامج
    });

    const offError = updater.onUpdateError((_, data) => {
      setErrMsg(data.message);
      setLoading(false);
      setState(downloadedRef.current ? "downloaded" : "error");
    });

    return () => { offStatus(); offProgress(); offDownloaded(); offError(); };
  }, []);

  if (state === "idle") return null;

  const isMandatory = state === "mandatory" || _mandatoryActive;

  // ─── Handlers ────────────────────────────────────────────────────────────
  async function handleDownload() {
    const updater = getUpdater();
    if (!updater) return;
    setLoading(true);
    setState("downloading");
    setProgress(null);
    const result = await updater.startDownload();
    if (!result.ok) {
      setErrMsg(result.error ?? "فشل التحميل");
      setLoading(false);
      setState("error");
    }
  }

  async function handleInstall() {
    const updater = getUpdater();
    if (!updater) return;
    setLoading(true);
    await updater.installNow();
  }

  async function handleSkip() {
    const updater = getUpdater();
    if (updater) await updater.skipUpdate();
    _setMandatory(false);
    setState("idle");
  }

  async function handleRetry() {
    downloadedRef.current = false;
    setErrMsg("");
    setProgress(null);
    await handleDownload();
  }

  // ─── Overlay ──────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        backgroundColor: "rgba(27,43,92,0.55)",
        backdropFilter:  "blur(6px)",
        // تأكيد: لا يمكن النقر خلف النافذة حتى في الحالة الاختيارية
        pointerEvents: "all",
      }}
      dir="rtl"
    >
      {/* Card */}
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: "#FAF7F0" }}
      >
        {/* شريط التحذير — إجباري */}
        {isMandatory && state !== "downloaded" && (
          <div
            className="flex items-center gap-2 px-5 py-3"
            style={{ backgroundColor: "#C9A84C", color: "#fff" }}
          >
            <ShieldAlert size={17} strokeWidth={2.5} />
            <div>
              <p className="text-sm font-bold leading-tight">تحديث إجباري مطلوب</p>
              <p className="text-xs opacity-90 mt-0.5">لا يمكن استخدام النظام قبل إتمام التحديث</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 pt-5 pb-4"
          style={{ borderBottom: "1px solid rgba(201,168,76,0.25)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(27,43,92,0.08)" }}
          >
            {state === "downloaded"
              ? <CheckCircle2 size={22} style={{ color: "#22c55e" }} />
              : state === "downloading"
              ? <Download size={22} style={{ color: "#1B2B5C" }} className="animate-bounce" />
              : state === "error"
              ? <AlertTriangle size={22} style={{ color: "#dc2626" }} />
              : <RefreshCw size={22} style={{ color: "#1B2B5C" }} />
            }
          </div>
          <div>
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
                  : "يوجد تحديث جديد يتضمن تحسينات في الأداء وإصلاح مشاكل.")}
              </p>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">

          {/* إصدارات */}
          {manifest && (
            <div className="flex gap-3">
              <VersionBadge label="الإصدار الحالي" version={currentVer} dim />
              <span className="self-center text-gray-400 text-lg">←</span>
              <VersionBadge label="الإصدار الجديد" version={manifest.latestVersion} highlight />
            </div>
          )}

          {/* حجم التحديث */}
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

          {/* Progress bar */}
          {state === "downloading" && (
            <ProgressSection progress={progress} />
          )}

          {/* Downloaded */}
          {state === "downloaded" && (
            <div
              className="flex items-center gap-2 p-3 rounded-xl"
              style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}
            >
              <CheckCircle2 size={18} style={{ color: "#22c55e" }} />
              <p className="text-sm font-semibold" style={{ color: "#15803d" }}>
                اكتمل التحميل — سيتم إعادة تشغيل البرنامج لتطبيق التحديث
              </p>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div
              className="p-3 rounded-xl text-sm"
              style={{
                backgroundColor: "rgba(239,68,68,0.07)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#b91c1c",
              }}
            >
              <p className="font-semibold mb-1">تعذّر إتمام التحميل</p>
              <p className="text-xs opacity-80 break-all">{errMsg}</p>
            </div>
          )}

          {/* ملاحظات الإصدار */}
          {manifest?.releaseNotes && manifest.releaseNotes.length > 0 && (
            <div>
              <button
                onClick={() => setShowNotes((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                style={{ color: "#1B2B5C" }}
              >
                {showNotes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                ملخص التغييرات ({manifest.releaseNotes.length})
              </button>
              {showNotes && (
                <ul className="mt-2 space-y-1.5 pr-4">
                  {manifest.releaseNotes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "#374151" }}>
                      <span
                        className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: "#C9A84C" }}
                      />
                      {note}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* تاريخ الإصدار */}
          {manifest?.publishedAt && (
            <p className="text-xs" style={{ color: "#9ca3af" }}>
              تاريخ الإصدار: {new Date(manifest.publishedAt).toLocaleDateString("ar-SA")}
            </p>
          )}
        </div>

        {/* Footer — أزرار */}
        <div
          className="flex items-center gap-3 px-6 pb-5 pt-2"
          style={{ borderTop: "1px solid rgba(201,168,76,0.15)" }}
        >
          {/* زر التحديث / الإعادة / الخطأ */}
          {state === "downloaded" ? (
            <button
              onClick={handleInstall}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-opacity"
              style={{ backgroundColor: "#1B2B5C", color: "#fff", opacity: loading ? 0.7 : 1 }}
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              إعادة التشغيل والتحديث
            </button>
          ) : state === "error" ? (
            <button
              onClick={handleRetry}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
              style={{ backgroundColor: "#1B2B5C", color: "#fff" }}
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              إعادة المحاولة
            </button>
          ) : state === "downloading" ? (
            <div
              className="flex-1 py-2.5 rounded-xl text-center text-sm font-semibold"
              style={{ backgroundColor: "rgba(27,43,92,0.08)", color: "#1B2B5C" }}
            >
              <span className="flex items-center justify-center gap-2">
                <Zap size={14} className="animate-pulse" />
                {progress
                  ? `${Math.round(progress.percent)}% — ${fmtSpeed(progress.bytesPerSecond)}`
                  : "جاري التحميل..."}
              </span>
            </div>
          ) : (
            <button
              onClick={handleDownload}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-opacity"
              style={{ backgroundColor: "#1B2B5C", color: "#fff", opacity: loading ? 0.7 : 1 }}
            >
              <Download size={15} />
              تحديث الآن
            </button>
          )}

          {/* زر "لاحقاً" — اختياري فقط + ليس أثناء التحميل */}
          {!isMandatory && state !== "downloading" && state !== "downloaded" && (
            <button
              onClick={handleSkip}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
              style={{ backgroundColor: "rgba(107,114,128,0.1)", color: "#4b5563" }}
            >
              <span className="flex items-center gap-1.5">
                <Clock size={14} />
                لاحقاً
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── VersionBadge ─────────────────────────────────────────────────────────────
function VersionBadge({
  label, version, dim, highlight,
}: { label: string; version: string; dim?: boolean; highlight?: boolean }) {
  return (
    <div
      className="flex-1 rounded-xl p-3 text-center"
      style={{
        backgroundColor: highlight ? "rgba(27,43,92,0.06)" : "rgba(107,114,128,0.06)",
        border: `1px solid ${highlight ? "rgba(27,43,92,0.2)" : "rgba(107,114,128,0.15)"}`,
      }}
    >
      <p className="text-xs mb-1" style={{ color: dim ? "#9ca3af" : "#6b7280" }}>{label}</p>
      <p className="font-extrabold text-base" style={{ color: highlight ? "#1B2B5C" : "#9ca3af" }}>
        v{version}
      </p>
    </div>
  );
}

// ─── ProgressSection ──────────────────────────────────────────────────────────
function ProgressSection({ progress }: { progress: DownloadProgress | null }) {
  const pct = progress ? Math.round(progress.percent) : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs" style={{ color: "#6b7280" }}>
        <span>
          {progress
            ? `${fmtBytes(progress.transferred)} / ${fmtBytes(progress.total)}`
            : "جاري التحضير..."}
        </span>
        <span className="font-bold" style={{ color: "#1B2B5C" }}>{pct}%</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(27,43,92,0.1)" }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width:      `${pct}%`,
            background: "linear-gradient(90deg, #1B2B5C, #C9A84C)",
          }}
        />
      </div>
      {progress && progress.bytesPerSecond > 0 && (
        <p className="text-xs text-center" style={{ color: "#6b7280" }}>
          سرعة التحميل: <strong>{fmtSpeed(progress.bytesPerSecond)}</strong>
        </p>
      )}
    </div>
  );
}
