/**
 * DesktopWorkWindow — نافذة العمل الداخلية.
 *
 * عند وجود WorkWindowPortalHost في WorkWindowContext (مُسجَّل بواسطة
 * AppWindow)، يُصيَّر المحتوى عبر createPortal داخل جذر إطار AppWindow،
 * فتغطي طبقة الحجب شريط العنوان الأزرق والمحتوى معاً.
 * عند غياب Portal Host (توافق للخلف) يُصيَّر inline كالمعتاد.
 *
 * يوفر:
 *  - طبقة حجب كريمية مع "اهتزاز الاهتمام" عند النقر خارج النافذة
 *  - موضع افتراضي أعلى اليمين (top-right) قابل للتعديل عبر placement
 *  - شريط عنوان قابل للسحب مع حدّ داخل الحاوية (إطار AppWindow كاملاً)
 *  - حصر التركيز (focus trap) داخل النافذة مع إعادته عند الإغلاق
 *  - ToolbarActionsProvider منعزل لشريط الأدوات الداخلي
 *  - WorkWindowToolbarFooter في قاع النافذة
 *
 * المسؤولية: كل شاشة تستدعي onClose وتتعامل مع dirty-check بنفسها.
 */
import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { WorkWindowTitleBar } from "./WorkWindowTitleBar";
import { useWorkWindowSafe } from "./WorkWindowContext";
import { ToolbarActionsProvider } from "@/components/unified-toolbar/ToolbarActionsContext";
import { WorkWindowToolbarFooter } from "./WorkWindowToolbarFooter";
import styles from "./DesktopWorkWindow.module.css";
import type { WorkWindowPreset, WorkWindowPlacement } from "./workWindow.types";

export interface DesktopWorkWindowProps {
  title:      string;
  preset:     WorkWindowPreset;
  /**
   * موضع فتح النافذة الافتراضي.
   * "top-right" (افتراضي) — أعلى اليمين.
   * "center"             — منتصف مساحة العمل.
   */
  placement?: WorkWindowPlacement;
  /** يُستدعى عند رغبة المستخدم في الإغلاق — المستدعي مسؤول عن dirty-check */
  onClose:    () => void;
  children:   ReactNode;
}

/** سلّة العناصر القابلة للتركيز داخل النافذة */
const FOCUSABLE_SEL = [
  "button:not([disabled]):not([tabindex=\"-1\"])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

const TITLE_BAR_H = 42; // px — ارتفاع شريط العنوان
/** يجب أن تتطابق مع top/right في CSS لحساب حدود السحب */
const CSS_TOP   = 6;
const CSS_RIGHT = 14;

export function DesktopWorkWindow({
  title,
  preset,
  placement = "top-right",
  onClose,
  children,
}: DesktopWorkWindowProps) {
  const ctx = useWorkWindowSafe();

  /* ─── refs للحاوية والنافذة ─── */
  const layerRef  = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  /* ─── حفظ التركيز وإعادته عند الإغلاق ─── */
  const savedFocusRef = useRef<Element | null>(null);
  useEffect(() => {
    savedFocusRef.current = document.activeElement;
    return () => {
      if (savedFocusRef.current instanceof HTMLElement) {
        try { savedFocusRef.current.focus(); } catch { /* تجاهل أخطاء التركيز */ }
      }
    };
  }, []);

  /* ─── حصر Tab داخل النافذة ─── */
  useEffect(() => {
    const win = windowRef.current;
    if (!win) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = Array.from(win.querySelectorAll<HTMLElement>(FOCUSABLE_SEL));
      if (!focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (!win.contains(document.activeElement) || document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!win.contains(document.activeElement) || document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ─── أبلغ السياق عند الوصل والفصل ─── */
  useEffect(() => {
    ctx?.reportWindowOpen();
    return () => ctx?.reportWindowClosed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentional: run once on mount/unmount

  /* ─── الموضع الأولي للتوسيط (center placement) ─── */
  useEffect(() => {
    if (placement !== "center") return;
    const layer = layerRef.current;
    const win   = windowRef.current;
    if (!layer || !win) return;
    // النافذة مثبّتة في CSS عند top:CSS_TOP right:CSS_RIGHT؛
    // نحسب الإزاحة اللازمة لتوسيطها داخل الحاوية.
    const cw = layer.offsetWidth;
    const ch = layer.offsetHeight;
    const ww = win.offsetWidth;
    const wh = win.offsetHeight;
    const dx = -(cw / 2) + ww / 2 + CSS_RIGHT;
    const dy = (ch - wh) / 2 - CSS_TOP;
    setDragOffset({ x: dx, y: dy });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // يعمل مرة واحدة بعد الوصل

  /* ─── حالة النافذة ─── */
  const [isMaximized, setIsMaximized] = useState(false);
  const [dragOffset, setDragOffset]   = useState<{ x: number; y: number } | null>(null);
  const [shaking,    setShaking]      = useState(false);

  /* ─── النقر على الخلفية → اهتزاز بدون إغلاق ─── */
  const handleBackdropMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (shaking) return;
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
  }, [shaking]);

  const handleToggleMax = useCallback(() => {
    setIsMaximized(m => !m);
    setDragOffset(null);
  }, []);

  /* ─── السحب مع حدّ داخل الحاوية (إطار AppWindow كاملاً عبر layerRef) ─── */
  const handleDragOffset = useCallback(
    (raw: { x: number; y: number } | null) => {
      if (!raw || isMaximized) { setDragOffset(raw); return; }

      const layer = layerRef.current;
      const win   = windowRef.current;
      if (!layer || !win) { setDragOffset(raw); return; }

      const cw = layer.offsetWidth;
      const ch = layer.offsetHeight;
      const ww = win.offsetWidth;

      // ─── حدود أفقية ───
      // النافذة مثبّتة عند right:CSS_RIGHT؛ الحافة اليسرى = cw - CSS_RIGHT - ww + dx
      // نضمن بقاء 60px على الأقل ظاهراً
      const MARGIN = 60;
      const dxMin = -(cw - CSS_RIGHT - MARGIN);
      const dxMax =  CSS_RIGHT;

      // ─── حدود رأسية ───
      // top = CSS_TOP + dy؛ يجب أن يظل شريط العنوان ضمن الحاوية
      const dyMin = -CSS_TOP;
      const dyMax = ch - CSS_TOP - TITLE_BAR_H;

      setDragOffset({
        x: Math.max(dxMin, Math.min(dxMax, raw.x)),
        y: Math.max(dyMin, Math.min(dyMax, raw.y)),
      });
    },
    [isMaximized],
  );

  const dx = dragOffset?.x ?? 0;
  const dy = dragOffset?.y ?? 0;

  const windowCls = [
    styles.window,
    isMaximized ? styles.maximized : "",
    shaking      ? styles.shaking  : "",
  ].filter(Boolean).join(" ");

  /* ─── JSX طبقة النافذة ─── */
  const layerJSX = (
    <div ref={layerRef} className={styles.layer}>

      {/* ── طبقة الحجب الكريمية — تمتص الأحداث وتشغّل الاهتزاز ── */}
      <div
        className={styles.backdrop}
        onMouseDown={handleBackdropMouseDown}
      />

      {/* ── إطار النافذة ── */}
      <div
        ref={windowRef}
        className={windowCls}
        data-preset={preset}
        data-placement={placement}
        style={{
          transform: `translate(${dx}px, ${dy}px)`,
          "--tx": `${dx}px`,
          "--ty": `${dy}px`,
        } as React.CSSProperties}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* ── شريط العنوان — يغطي العرض بالكامل (دون تأثر بـ padding) ── */}
        <div className={styles.titleBarWrapper}>
          <WorkWindowTitleBar
            title={title}
            isMaximized={isMaximized}
            onClose={onClose}
            onToggleMax={handleToggleMax}
            onDragOffset={handleDragOffset}
            currentOffset={dragOffset}
          />
        </div>

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

  /* ─── Portal إلى جذر AppWindow إذا كان متاحاً، وإلا inline ─── */
  const portalHost = ctx?.portalHost ?? null;
  return portalHost ? createPortal(layerJSX, portalHost) : layerJSX;
}
