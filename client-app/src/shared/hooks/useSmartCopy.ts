/**
 * useSmartCopy — نسخ سريع عالمي بـ Ctrl + C
 *
 * السلوك:
 *  - إذا كان هناك نص محدد → يعمل Ctrl+C بالطريقة الاعتيادية (لا تدخّل).
 *  - إذا لم يكن هناك تحديد والتركيز على عنصر يحتوي بيانات → ينسخ القيمة كاملة.
 *
 * يعمل على:
 *  - <input> / <textarea>  → element.value
 *  - <select>              → قيمة الخيار المحدد
 *  - <td> / <th>           → textContent الخلية
 *  - أي عنصر آخر          → textContent
 */
import { useEffect } from "react";
import { toast } from "sonner";

function getElementText(el: Element): string | null {
  const tag = el.tagName.toLowerCase();

  if (tag === "input") {
    const input = el as HTMLInputElement;
    if (input.type === "checkbox" || input.type === "radio") return null;
    return input.value || null;
  }

  if (tag === "textarea") {
    return (el as HTMLTextAreaElement).value || null;
  }

  if (tag === "select") {
    const sel = el as HTMLSelectElement;
    const opt = sel.options[sel.selectedIndex];
    return opt ? opt.text : null;
  }

  const text = (el as HTMLElement).textContent?.trim() || null;
  return text || null;
}

export function useSmartCopy() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (!ctrlOrCmd || e.key.toLowerCase() !== "c") return;

      const selection = window.getSelection();
      const hasSelection = selection && selection.toString().length > 0;

      if (hasSelection) return;

      const active = document.activeElement;
      if (!active || active === document.body) return;

      const text = getElementText(active);
      if (!text) return;

      e.preventDefault();

      navigator.clipboard.writeText(text).then(() => {
        const short = text.length > 40 ? text.slice(0, 40) + "…" : text;
        toast.success(`تم النسخ: ${short}`, {
          duration: 1400,
          position: "bottom-center",
          style: { fontSize: 12, padding: "6px 14px", minWidth: "unset" },
        });
      }).catch(() => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        active instanceof HTMLElement && active.focus();
        const short = text.length > 40 ? text.slice(0, 40) + "…" : text;
        toast.success(`تم النسخ: ${short}`, {
          duration: 1400,
          position: "bottom-center",
          style: { fontSize: 12, padding: "6px 14px", minWidth: "unset" },
        });
      });
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);
}
