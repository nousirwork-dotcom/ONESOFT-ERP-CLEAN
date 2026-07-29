/**
 * WorkWindowContext — يتتبع حالة نوافذ العمل المفتوحة،
 * ويوفر مرجع portalHost الذي يُسجِّله WorkWindowPortalHost
 * عند جذر AppWindow؛ يستخدمه DesktopWorkWindow لـ createPortal.
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface WorkWindowContextValue {
  isOpen: boolean;
  reportWindowOpen:   () => void;
  reportWindowClosed: () => void;
  /** العنصر الذي يُصيَّر فيه Portal نافذة العمل (جذر إطار AppWindow) */
  portalHost: HTMLDivElement | null;
  setPortalHost: (el: HTMLDivElement | null) => void;
}

const WorkWindowContext = createContext<WorkWindowContextValue | null>(null);

export function WorkWindowProvider({ children }: { children: ReactNode }) {
  const [openCount,  setOpenCount]  = useState(0);
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null);

  const reportWindowOpen   = useCallback(() => setOpenCount(n => n + 1), []);
  const reportWindowClosed = useCallback(() => setOpenCount(n => Math.max(0, n - 1)), []);

  return (
    <WorkWindowContext.Provider value={{
      isOpen: openCount > 0,
      reportWindowOpen,
      reportWindowClosed,
      portalHost,
      setPortalHost,
    }}>
      {children}
    </WorkWindowContext.Provider>
  );
}

/** للمكوّنات التي تتطلب وجود Provider — تُطلق خطأً إذا لم يوجد */
export function useWorkWindow(): WorkWindowContextValue {
  const ctx = useContext(WorkWindowContext);
  if (!ctx) throw new Error("useWorkWindow must be inside WorkWindowProvider");
  return ctx;
}

/** للمكوّنات التي قد تعمل خارج WorkWindowProvider — تُرجع null بدلاً من الخطأ */
export function useWorkWindowSafe(): WorkWindowContextValue | null {
  return useContext(WorkWindowContext);
}
