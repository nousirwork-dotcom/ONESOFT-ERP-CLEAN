import { useEffect } from "react";

const FOCUSABLE_SELECTOR = [
  'input:not([disabled]):not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="reset"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
].join(", ");

function isExcluded(el: HTMLElement): boolean {
  if (el.getAttribute("data-global-keyboard") === "false") return true;
  if (el.hasAttribute("data-no-desktop-field")) return true;
  if (!!el.closest('[data-global-keyboard="false"]')) return true;
  return false;
}

function getVisible(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(
    (el) =>
      !isExcluded(el) &&
      el.offsetParent !== null &&
      !(el.closest("[tabindex=\"-1\"]"))
  );
}

export function useGlobalEnterNavigation() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;

      const target = e.target as HTMLElement;

      if (isExcluded(target)) return;

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
