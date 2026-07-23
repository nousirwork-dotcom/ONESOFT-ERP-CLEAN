/**
 * DesktopWorkWindow — نافذة العمل الداخلية.
 *
 * مكوّن يُصيَّر مباشرةً داخل شاشة القائمة (inline) فوق محتواها.
 * يوفر:
 *  - طبقة تعتيم خلفية مع "اهتزاز الاهتمام" عند النقر خارج النافذة
 *  - شريط عنوان قابل للسحب مع أزرار التحكم
 *  - ToolbarActionsProvider منعزل لشريط الأدوات الداخلي
 *  - WorkWindowToolbarFooter في قاع النافذة
 *
 * المسؤولية: كل شاشة تستدعي onClose وتتعامل مع dirty-check بنفسها.
 */
import { useEffect, useState, useCallback, type ReactNode } from "react";
import { WorkWindowTitleBar } from "./WorkWindowTitleBar";
import { useWorkWindowSafe } from "./WorkWindowContext";
import { ToolbarActionsProvider } from "@/components/unified-toolbar/ToolbarActionsContext";
import { WorkWindowToolbarFooter } from "./WorkWindowToolbarFooter";
import styles from "./DesktopWorkWindow.module.css";
import type { WorkWindowPreset } from "./workWindow.types";

export interface DesktopWorkWindowProps {
  title:    string;
  preset:   WorkWindowPreset;
  /** يُستدعى عند رغبة المستخدم في الإغلاق — المستدعي مسؤول عن dirty-check */
  onClose:  () => void;
  children: ReactNode;
}

export function DesktopWorkWindow({ title, preset, onClose, children }: DesktopWorkWindowProps) {
  const ctx = useWorkWindowSafe();

  /* ─── أبلغ السياق عند الوصل والفصل ─── */
  useEffect(() => {
    ctx?.reportWindowOpen();
    return () => ctx?.reportWindowClosed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentional: run once on mount/unmount

  /* ─── حالة النافذة المحلية ─── */
  const [isMaximized, setIsMaximized] = useState(false);
  const [dragOffset, setDragOffset]   = useState<{ x: number; y: number } | null>(null);
  const [shaking, setShaking]         = useState(false);

  const handleOverlayClick = useCallback(() => {
    if (shaking) return;
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
  }, [shaking]);

  const handleToggleMax = useCallback(() => {
    setIsMaximized(m => !m);
    setDragOffset(null);
  }, []);

  const dx = dragOffset?.x ?? 0;
  const dy = dragOffset?.y ?? 0;

  const windowCls = [
    styles.window,
    isMaximized ? styles.maximized : "",
    shaking      ? styles.shaking  : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={styles.overlay} onMouseDown={handleOverlayClick}>
      <div
        className={windowCls}
        data-preset={preset}
        style={{
          transform: `translate(${dx}px, ${dy}px)`,
          "--tx": `${dx}px`,
          "--ty": `${dy}px`,
        } as React.CSSProperties}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* ── شريط العنوان ── */}
        <WorkWindowTitleBar
          title={title}
          isMaximized={isMaximized}
          onClose={onClose}
          onToggleMax={handleToggleMax}
          onDragOffset={setDragOffset}
          currentOffset={dragOffset}
        />

        {/* ── المحتوى + شريط الأدوات منعزلان ── */}
        <ToolbarActionsProvider>
          <div className={styles.content}>
            {children}
          </div>
          <div className={styles.footer}>
            <WorkWindowToolbarFooter />
          </div>
        </ToolbarActionsProvider>
      </div>
    </div>
  );
}
