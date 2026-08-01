import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTabManagerSafe } from "@/core/contexts/TabManagerContext";

type ExitApi = {
  onExitRequest?: (callback: () => void) => () => void;
  respondToExitRequest?: (response: "confirm" | "cancel") => void;
};

function getExitApi(): ExitApi | null {
  try {
    return (window as unknown as { erpAPI?: ExitApi }).erpAPI ?? null;
  } catch {
    return null;
  }
}

export default function ApplicationExitGuard() {
  const tabManager = useTabManagerSafe();
  const dirtyTabIds = tabManager?.dirtyTabIds ?? [];
  const [open, setOpen] = useState(false);
  const returnButtonRef = useRef<HTMLButtonElement>(null);
  const dirty = dirtyTabIds.length > 0;

  useEffect(() => {
    const api = getExitApi();
    if (!api?.onExitRequest) return;
    return api.onExitRequest(() => setOpen(true));
  }, []);

  useEffect(() => {
    if (!open) return;
    returnButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      getExitApi()?.respondToExitRequest?.("cancel");
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  if (!open) return null;

  const cancel = () => {
    setOpen(false);
    getExitApi()?.respondToExitRequest?.("cancel");
  };
  const confirm = () => {
    setOpen(false);
    if (dirty && tabManager) {
      // Keep Electron open while the first dirty screen asks whether to save
      // or discard. The user can retry application exit after handling it.
      getExitApi()?.respondToExitRequest?.("cancel");
      tabManager.closeTab(dirtyTabIds[0]);
      return;
    }
    getExitApi()?.respondToExitRequest?.("confirm");
  };

  return (
    <div
      role="presentation"
      onMouseDown={event => {
        // Clicking outside is intentionally inert.
        if (event.target === event.currentTarget) event.preventDefault();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.42)",
        direction: "rtl",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="onesoft-exit-title"
        onMouseDown={event => event.stopPropagation()}
        style={{
          width: "min(460px, calc(100vw - 32px))",
          borderRadius: 12,
          border: "1px solid var(--border, #ddd6c8)",
          background: "var(--background, #fff)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
          padding: 24,
          color: "var(--foreground, #172033)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <AlertTriangle aria-hidden="true" style={{ width: 22, height: 22, color: "#d97706", flexShrink: 0 }} />
          <div>
            <h2 id="onesoft-exit-title" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              إنهاء البرنامج
            </h2>
            <p
              data-has-unsaved-changes={dirty ? "true" : "false"}
              style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.8, color: "var(--muted-foreground, #64748b)" }}
            >
              سيؤدي هذا الإجراء إلى إنهاء العمل على OneSoft وإغلاق جميع الشاشات المفتوحة. هل تريد المتابعة؟
            </p>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-start", gap: 10, marginTop: 24 }}>
          <button
            type="button"
            ref={returnButtonRef}
            onClick={cancel}
            style={{
              minWidth: 120,
              height: 38,
              borderRadius: 7,
              border: "1px solid var(--border, #cbd5e1)",
              background: "transparent",
              color: "var(--foreground, #172033)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            لا، رجوع
          </button>
          <button
            type="button"
            onClick={confirm}
            style={{
              minWidth: 150,
              height: 38,
              borderRadius: 7,
              border: "1px solid #b91c1c",
              background: "#b91c1c",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            نعم، إنهاء البرنامج
          </button>
        </div>
      </section>
    </div>
  );
}