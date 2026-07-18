import { useRef, useCallback } from "react";

/**
 * useDesktopField — سلوك حقل سطح المكتب المحاسبي
 *
 * المنطق:
 *  • أول دخول للحقل (Tab / Enter / نقرة ماوس أولى):
 *      — يُحدَّد المحتوى بالكامل (select-all)
 *      — يُمنع وضع المؤشر التلقائي من الـ mouseup
 *  • نقرة داخل حقل مُركَّز بالفعل:
 *      — لا تدخل من الـ hook، يضع المتصفح المؤشر في مكان النقرة بشكل طبيعي
 *  • عند مغادرة الحقل: تُعاد تهيئة الحالة
 *
 * يصلح لـ <input> و <textarea> على حدٍّ سواء.
 */
export function useDesktopField<
  T extends HTMLInputElement | HTMLTextAreaElement = HTMLInputElement,
>() {
  const mouseDownOnBlurredRef = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent<T>) => {
    const el = e.currentTarget as T;
    if (document.activeElement !== el) {
      mouseDownOnBlurredRef.current = true;
      e.preventDefault();
      el.focus();
      try { el.select(); } catch {}
    }
  }, []);

  const onFocus = useCallback((e: React.FocusEvent<T>) => {
    if (!mouseDownOnBlurredRef.current) {
      const el = e.currentTarget as T;
      requestAnimationFrame(() => {
        if (document.activeElement === el) {
          try { el.select(); } catch {}
        }
      });
    }
    mouseDownOnBlurredRef.current = false;
  }, []);

  const onBlur = useCallback(() => {
    mouseDownOnBlurredRef.current = false;
  }, []);

  return { onMouseDown, onFocus, onBlur } as const;
}
