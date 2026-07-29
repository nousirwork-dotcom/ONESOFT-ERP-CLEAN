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
import { FocusedEntityProvider } from "@/components/unified-toolbar/FocusedEntityRegistry";
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
  /**
   * أبعاد مخصصة تتجاوز preset (اختياري).
   * يُستخدم عندما تريد شاشة معينة حجماً مختلفاً عن preset القياسي.
   */
  defaultSize?: { width: number; height: number };
  /**
   * يمنع التكبير التلقائي للنافذة (افتراضي false).
   * autoMaximize={false} = لا تتكبّر النافذة تلقائياً تحت أي ظرف.
   */
  autoMaximize?: boolean;
  /**
   * وضع احتواء الحجم:
   * - "clamp" (افتراضي) — يقص الحجم داخل المساحة المتاحة دون تكبير أبداً.
   * - "auto"            — يحاول فتح النافذة بالحجم المطلوب، وإذا ضاقت المساحة يُكبّر.
   */
  fitMode?: "auto" | "clamp";
  /** الحد الأدنى للعرض (افتراضي 680px) */
  minWidth?: number;
  /** الحد الأدنى للارتفاع (افتراضي 480px) */
  minHeight?: number;
  /** حشوة أفقية تُطرح من المساحة المتاحة (افتراضي 28px) */
  widthPad?: number;
  /** حشوة رأسية تُطرح من المساحة المتاحة (افتراضي 24px) */
  heightPad?: number;
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

/* ─── مقاسات كل Preset ─── */
const PRESET_LAYOUTS: Record<WorkWindowPreset, { width: number; height: number }> = {
  compact:  { width: 760,  height: 520 },
  standard: { width: 980,  height: 620 },
  wide:     { width: 1180, height: 680 },
  fullscreen: { width: 1920, height: 1080 }, /* يُتجاهل في auto-fit */
};

export function DesktopWorkWindow({
  title,
  preset,
  placement = "top-right",
  defaultSize: customDefaultSize,
  autoMaximize = false,
  fitMode = "clamp",
  minWidth: minWProp,
  minHeight: minHProp,
  widthPad: widthPadProp,
  heightPad: heightPadProp,
  onClose,
  children,
}: DesktopWorkWindowProps) {
  const ctx = useWorkWindowSafe();

  /* ─── refs للحاوية والنافذة ─── */
  const layerRef  = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  /* ─── Density Mode — ثلاث مستويات ثابتة للتكبير البسيط ─── */
  const [density, setDensity] = useState<"compact" | "normal" | "large">("normal");
  const densityObsRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const win = windowRef.current;
    if (!win) return;

    function recalcDensity() {
      if (!win) return;
      const w = win.clientWidth;
      const next = w < 1000 ? "compact" : w < 1400 ? "normal" : "large";
      setDensity(prev => (prev === next ? prev : next));
    }

    recalcDensity();
    densityObsRef.current = new ResizeObserver(recalcDensity);
    densityObsRef.current.observe(win);

    return () => {
      if (densityObsRef.current) {
        densityObsRef.current.disconnect();
        densityObsRef.current = null;
      }
    };
  }, []);

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

  /* ─── حالة النافذة ─── */
  const [isMaximized, setIsMaximized] = useState(false);
  const [dragOffset, setDragOffset]   = useState<{ x: number; y: number } | null>(null);
  const [shaking,    setShaking]      = useState(false);
  const dx = dragOffset?.x ?? 0;
  const dy = dragOffset?.y ?? 0;

  /* ─── تخزين الأبعاد والموضع الطبيعي قبل التكبير ─── */
  const [normalBounds, setNormalBounds] = useState<{
    width: number; height: number; x: number; y: number;
  } | null>(null);
  const normalBoundsRef = useRef(normalBounds);
  normalBoundsRef.current = normalBounds;

  /* ─── Auto-Fit الذكي عبر ResizeObserver ─── */
  const [autoSize, setAutoSize] = useState<{ width: number; height: number } | null>(null);
  const prevSizeRef = useRef<string>("");

  // إعادة ضبط isMaximized عند كل فتح جديد
  useEffect(() => {
    if (!autoMaximize) {
      setIsMaximized(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ResizeObserver واحد مستقر — لا يُعاد إنشاؤه مع كل render
  const resizeRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    // لا نطبق auto-fit في fullscreen أو maximized
    if (preset === "fullscreen" || isMaximized) {
      setAutoSize(null);
      return;
    }

    const BORDER_PAD = 12;
    const PAD_W = widthPadProp ?? 28;
    const PAD_H = heightPadProp ?? 24;
    const MIN_W = minWProp ?? 680;
    const MIN_H = minHProp ?? 480;

    function recalc() {
      if (!layer) return;
      const availW = layer.clientWidth  - BORDER_PAD;
      const availH = layer.clientHeight - BORDER_PAD;

      // ─── استخدم normalBounds إذا كانت مناسبة (لا تعِد حساب من preset) ───
      const nb = normalBoundsRef.current;
      if (nb && !isMaximized) {
        const fitsW = nb.width <= availW - PAD_W;
        const fitsH = nb.height <= availH - PAD_H;
        if (fitsW && fitsH && nb.width >= MIN_W && nb.height >= MIN_H) {
          const key = `${nb.width}x${nb.height}`;
          if (key === prevSizeRef.current) return;
          prevSizeRef.current = key;
          console.debug(`[AutoFit] restored normalBounds ${nb.width}x${nb.height}`);
          setAutoSize({ width: nb.width, height: nb.height });
          return;
        }
      }

      // ─── حساب عادي من الـPreset ───
      const layout = PRESET_LAYOUTS[preset] ?? PRESET_LAYOUTS.standard;
      const target = customDefaultSize ?? layout;

      const calcW = Math.max(MIN_W, Math.min(target.width, availW - PAD_W));
      const calcH = Math.max(MIN_H, Math.min(target.height, availH - PAD_H));

      // ─── منع حلقات ResizeObserver — لا نحدّث State إذا الحجم نفسه ───
      const key = `${calcW}x${calcH}`;
      if (key === prevSizeRef.current) return;
      prevSizeRef.current = key;

      console.debug(`[AutoFit] preset=${preset}`, {
        availableWidth:    availW,
        availableHeight:   availH,
        targetWidth:       target.width,
        targetHeight:      target.height,
        calculatedWidth:   calcW,
        calculatedHeight:  calcH,
        isMaximized,
      });

      setAutoSize({ width: calcW, height: calcH });
    }

    // أول حساب فوري
    recalc();

    // ResizeObserver واحد — نعيد استخدامه إذا موجود
    if (!resizeRef.current) {
      resizeRef.current = new ResizeObserver(() => { recalc(); });
    }
    resizeRef.current.observe(layer);

    return () => {
      if (resizeRef.current) {
        resizeRef.current.disconnect();
        resizeRef.current = null;
      }
    };
  }, [preset, isMaximized, customDefaultSize]);

  /* ─── حافظ على normalBounds محدّثاً عند تغيير الأبعاد/الموضع (خارج التكبير) ─── */
  useEffect(() => {
    if (isMaximized) return;
    if (!autoSize) return;

    const bounds = {
      width:  autoSize.width,
      height: autoSize.height,
      x:      dragOffset?.x ?? 0,
      y:      dragOffset?.y ?? 0,
    };

    setNormalBounds(prev => {
      if (!prev) return bounds;
      if (
        prev.width  === bounds.width  &&
        prev.height === bounds.height &&
        prev.x      === bounds.x      &&
        prev.y      === bounds.y
      ) return prev;
      return bounds;
    });
  }, [autoSize, dragOffset, isMaximized]);

  /* وازن autoSize مع preset الداخلي */
  const winStyle: React.CSSProperties = autoSize
    ? {
        ...(preset === "fullscreen" ? {} : { width: autoSize.width, height: autoSize.height }),
        transform: `translate(${dx}px, ${dy}px)`,
        "--tx": `${dx}px`,
        "--ty": `${dy}px`,
      } as React.CSSProperties
    : {
        transform: `translate(${dx}px, ${dy}px)`,
        "--tx": `${dx}px`,
        "--ty": `${dy}px`,
      } as React.CSSProperties;

  /* ─── الموضع الأولي للتوسيط (center placement) ─── */
  useEffect(() => {
    if (placement !== "center") return;
    const layer = layerRef.current;
    const win   = windowRef.current;
    if (!layer || !win) return;
    // النافذة مثبّتة في CSS عند top/right؛ نحسب الإزاحة اللازمة لتوسيطها.
    const cw = layer.offsetWidth;
    const ch = layer.offsetHeight;
    const ww = win.offsetWidth;
    const wh = win.offsetHeight;
    const dx = -(cw / 2) + ww / 2 + CSS_RIGHT;
    const dy = (ch - wh) / 2 - CSS_TOP;
    setDragOffset({ x: dx, y: dy });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // يعمل مرة واحدة بعد الوصل

  /* ─── النقر على الخلفية → اهتزاز بدون إغلاق ─── */
  const handleBackdropMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (shaking) return;
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
  }, [shaking]);

  const handleToggleMax = useCallback(() => {
    if (isMaximized) {
      // ─── استعادة: أعد الأبعاد والموضع المحفوظين كما هما ───
      const nb = normalBoundsRef.current;
      if (nb) {
        setAutoSize({ width: nb.width, height: nb.height });
        setDragOffset(
          nb.x !== 0 || nb.y !== 0 ? { x: nb.x, y: nb.y } : null,
        );
      } else {
        setDragOffset(null);
      }
      setIsMaximized(false);
    } else {
      // ─── تكبير: احفظ الأبعاد والموضع الحاليين أولاً ───
      const win = windowRef.current;
      const bounds = {
        width:  autoSize?.width  ?? win?.offsetWidth  ?? 800,
        height: autoSize?.height ?? win?.offsetHeight ?? 600,
        x:      dragOffset?.x ?? 0,
        y:      dragOffset?.y ?? 0,
      };
      setNormalBounds(bounds);
      setIsMaximized(true);
      setDragOffset(null);
    }
  }, [isMaximized, autoSize, dragOffset]);

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
      // الحافة اليسرى = cw - CSS_RIGHT - ww + dx؛ نضمن بقاء 60px ظاهراً
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
        data-density={density}
        style={winStyle}
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

        <div className={styles.workBody}>
          <FocusedEntityProvider>
            <ToolbarActionsProvider>
              <div className={styles.content}>
                {children}
              </div>
              <div className={styles.footer}>
                <WorkWindowToolbarFooter />
              </div>
            </ToolbarActionsProvider>
          </FocusedEntityProvider>
        </div>
      </div>
    </div>
  );

  /* ─── Portal إلى جذر AppWindow إذا كان متاحاً، وإلا inline ─── */
  const portalHost = ctx?.portalHost ?? null;
  return portalHost ? createPortal(layerJSX, portalHost) : layerJSX;
}
