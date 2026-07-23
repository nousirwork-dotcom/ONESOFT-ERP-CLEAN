/**
 * WorkWindowContext — الغرض الوحيد: تتبع ما إذا كانت نافذة عمل مفتوحة الآن أم لا.
 * تستخدم UnifiedScreenShell هذه المعلومة لإخفاء شريط الأدوات الخلفي.
 * كل شاشة تُصيَّر DesktopWorkWindow مباشرةً وتتحكم في محتواه بنفسها.
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface WorkWindowContextValue {
  isOpen: boolean;
  reportWindowOpen:  () => void;
  reportWindowClosed: () => void;
}

const WorkWindowContext = createContext<WorkWindowContextValue | null>(null);

export function WorkWindowProvider({ children }: { children: ReactNode }) {
  // استخدم عداداً لدعم نوافذ متعددة محتملة في المستقبل
  const [openCount, setOpenCount] = useState(0);

  const reportWindowOpen   = useCallback(() => setOpenCount(n => n + 1), []);
  const reportWindowClosed = useCallback(() => setOpenCount(n => Math.max(0, n - 1)), []);

  return (
    <WorkWindowContext.Provider value={{ isOpen: openCount > 0, reportWindowOpen, reportWindowClosed }}>
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
