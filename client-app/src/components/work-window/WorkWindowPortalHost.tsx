/**
 * WorkWindowPortalHost — يُعرَض عند جذر إطار AppWindow.
 *
 * يُسجِّل العنصر في WorkWindowContext ليستخدمه DesktopWorkWindow
 * عبر createPortal، فتغطي طبقة نافذة العمل شريط AppWindow كاملاً
 * (العنوان الأزرق + المحتوى) دون تجاوز رأس البرنامج أو تبويبات MDI
 * أو نوافذ AppWindow الأخرى غير النشطة.
 *
 * الـ div نفسه شفاف وبلا pointer-events حتى لا يعترض التفاعل
 * حين لا توجد نافذة عمل مفتوحة.
 */
import { useRef, useEffect } from "react";
import { useWorkWindowSafe } from "./WorkWindowContext";

export function WorkWindowPortalHost() {
  const ref = useRef<HTMLDivElement>(null);
  const ctx = useWorkWindowSafe();

  useEffect(() => {
    if (!ctx) return;
    ctx.setPortalHost(ref.current);
    return () => ctx.setPortalHost(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentional: run once — ctx.setPortalHost is stable (useCallback)

  return (
    <div
      ref={ref}
      style={{
        position:      "absolute",
        inset:         0,
        zIndex:        3000,
        pointerEvents: "none",
      }}
    />
  );
}
