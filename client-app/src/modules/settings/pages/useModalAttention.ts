import * as React from "react";

export function useModalAttention() {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const attractAttention = React.useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    el.setAttribute("data-attention", "true");
    timerRef.current = setTimeout(() => {
      if (contentRef.current) {
        contentRef.current.setAttribute("data-attention", "false");
      }
      timerRef.current = null;
    }, 320);
  }, []);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { contentRef, attractAttention };
}
