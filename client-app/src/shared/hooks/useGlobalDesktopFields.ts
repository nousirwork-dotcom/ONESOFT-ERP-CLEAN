import { useEffect } from "react";

const ALLOWED_TYPES = new Set([
  "text", "number", "email", "password", "url", "tel", "search", "",
]);
const SKIP_ATTR = "data-no-desktop-field";

function isEligible(el: Element): el is HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
  if (el.hasAttribute(SKIP_ATTR)) return false;
  if (el instanceof HTMLInputElement && !ALLOWED_TYPES.has(el.type)) return false;
  if ((el as HTMLInputElement).readOnly || (el as HTMLInputElement).disabled) return false;
  return true;
}

export function useGlobalDesktopFields() {
  useEffect(() => {
    let mouseDownOnBlurred = false;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as Element;
      if (!isEligible(target)) return;

      if (document.activeElement !== target) {
        mouseDownOnBlurred = true;
        e.preventDefault();
        (target as HTMLInputElement).focus();
        (target as HTMLInputElement).select();
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element;
      if (!isEligible(target)) return;

      if (mouseDownOnBlurred) {
        mouseDownOnBlurred = false;
        return;
      }

      requestAnimationFrame(() => {
        if (document.activeElement === target) {
          (target as HTMLInputElement).select();
        }
      });
    };

    const onMouseUp = () => { mouseDownOnBlurred = false; };

    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("mouseup", onMouseUp, true);

    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("mouseup", onMouseUp, true);
    };
  }, []);
}
