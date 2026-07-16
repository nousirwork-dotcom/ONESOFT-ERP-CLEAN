import { useEffect } from "react";

const FOCUSABLE_SELECTOR = [
  'input:not([disabled]):not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="reset"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[data-enter-nav="true"]:not([disabled])',
].join(", ");

function isFullyExcluded(el: HTMLElement): boolean {
  if (el.getAttribute("data-global-keyboard") === "false") return true;
  if (el.hasAttribute("data-no-desktop-field")) return true;
  if (!!el.closest('[data-global-keyboard="false"]')) return true;
  return false;
}

function isInInternalNavZone(el: HTMLElement): boolean {
  return !!el.closest("[data-nav-internal]");
}

function getVisible(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(
    (el) =>
      !isFullyExcluded(el) &&
      el.offsetParent !== null &&
      !(el.closest('[tabindex="-1"]') && !el.hasAttribute("data-enter-nav"))
  );
}

export function useGlobalEnterNavigation() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;

      const target = e.target as HTMLElement;

      if (isFullyExcluded(target)) return;

      if (isInInternalNavZone(target)) return;

      if (target.tagName === "BUTTON") return;
      if (
        target instanceof HTMLInputElement &&
        ["checkbox", "radio", "submit", "file", "button", "reset"].includes(
          target.type
        )
      )
        return;

      if (target.tagName === "TEXTAREA") {
        if (!e.ctrlKey) return;
      }

      // When a dropdown/combobox has its menu open, let the element handle Enter
      if (target.getAttribute("aria-expanded") === "true") return;

      e.preventDefault();

      const all = getVisible();
      const idx = all.indexOf(target);
      if (idx === -1) return;

      const next = e.shiftKey ? all[idx - 1] : all[idx + 1];
      if (next) next.focus();
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
