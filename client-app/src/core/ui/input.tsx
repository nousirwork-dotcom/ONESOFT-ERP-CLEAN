import { useDialogComposition } from "@/core/ui/dialog";
import { useComposition } from "@/shared/hooks/useComposition";
import { useDesktopField } from "@/shared/hooks/useDesktopField";
import { cn } from "@/shared/lib/utils";
import * as React from "react";

function Input({
  className,
  type,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  onFocus: externalOnFocus,
  onBlur: externalOnBlur,
  onMouseDown: externalOnMouseDown,
  disableSelectOnFocus,
  ...props
}: React.ComponentProps<"input"> & {
  disableSelectOnFocus?: boolean;
}) {
  const dialogComposition = useDialogComposition();
  const {
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
    onKeyDown: handleKeyDown,
  } = useComposition<HTMLInputElement>({
    onKeyDown: (e) => {
      const isComposing = (e.nativeEvent as any).isComposing || dialogComposition.justEndedComposing();
      if (e.key === "Enter" && isComposing) return;
      onKeyDown?.(e);
    },
    onCompositionStart: e => { dialogComposition.setComposing(true); onCompositionStart?.(e); },
    onCompositionEnd: e => {
      dialogComposition.markCompositionEnd();
      setTimeout(() => { dialogComposition.setComposing(false); }, 100);
      onCompositionEnd?.(e);
    },
  });

  const {
    onMouseDown: deskMouseDown,
    onFocus:    deskFocus,
    onBlur:     deskBlur,
  } = useDesktopField<HTMLInputElement>();

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!disableSelectOnFocus) deskFocus(e);
    externalOnFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    deskBlur();
    externalOnBlur?.(e);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
    if (!disableSelectOnFocus) deskMouseDown(e);
    externalOnMouseDown?.(e);
  };

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground border-input bg-white dark:bg-slate-800 dark:border-slate-600",
        "h-7 w-full min-w-0 rounded-[2px] border px-1.5 py-0.5 text-[13px]",
        "outline-none transition-colors",
        "focus:border-[#406B93] focus:ring-1 focus:ring-[#406B93]/30",
        "disabled:pointer-events-none disabled:opacity-50",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium",
        className
      )}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseDown={handleMouseDown}
      {...props}
    />
  );
}

export { Input };
