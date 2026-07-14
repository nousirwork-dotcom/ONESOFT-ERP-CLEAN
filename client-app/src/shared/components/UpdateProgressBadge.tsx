/**
 * UpdateProgressBadge — شريط التحميل العائم في الخلفية
 *
 * يظهر في أسفل اليسار فقط عندما يكون التحميل جارياً في الخلفية.
 * يختفي تلقائياً عند الاكتمال (تظهر نافذة التثبيت بدلاً منه).
 */

import { ArrowDownToLine, X, Eye } from "lucide-react";
import { useUpdateState } from "@/shared/lib/update-store";
import { updateStore } from "@/shared/lib/update-store";

interface ElectronUpdater {
  cancelDownload?: () => Promise<{ ok: boolean }>;
}
function getUpdater(): ElectronUpdater | null {
  const w = window as unknown as { installer?: { updater?: ElectronUpdater } };
  return w?.installer?.updater ?? null;
}

export default function UpdateProgressBadge() {
  const state = useUpdateState();

  if (!state.backgroundDownloading) return null;

  const pct = Math.round(state.downloadPercent);

  async function handleCancel() {
    const updater = getUpdater();
    if (updater?.cancelDownload) {
      await updater.cancelDownload();
    }
    updateStore.setDownloadCancelled();
  }

  function handleShow() {
    updateStore.showDialog();
  }

  return (
    <div
      className="fixed bottom-4 left-4 z-[9998] flex items-center gap-2.5 px-3 py-2 rounded-xl shadow-lg"
      style={{
        backgroundColor: "#1B2B5C",
        color: "#fff",
        minWidth: 220,
        maxWidth: 300,
        border: "1px solid rgba(201,168,76,0.3)",
      }}
      dir="rtl"
    >
      {/* أيقونة */}
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
        <ArrowDownToLine size={15} className="animate-bounce" />
      </div>

      {/* نص + شريط التقدم */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold leading-tight truncate">
          تحميل التحديث... {pct}%
        </p>
        <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, #C9A84C, #f0c040)" }}
          />
        </div>
      </div>

      {/* زر عرض */}
      <button
        onClick={handleShow}
        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 hover:bg-white/20 transition-colors"
        title="عرض نافذة التحديث"
      >
        <Eye size={13} />
      </button>

      {/* زر إلغاء */}
      <button
        onClick={handleCancel}
        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 hover:bg-red-500/30 transition-colors"
        title="إلغاء التحميل"
      >
        <X size={13} />
      </button>
    </div>
  );
}
