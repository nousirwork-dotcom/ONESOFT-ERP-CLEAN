import { useDialogComposition } from "@/core/ui/dialog";
import { useComposition } from "@/shared/hooks/useComposition";
import { useDesktopField } from "@/shared/hooks/useDesktopField";
import { cn } from "@/shared/lib/utils";
import * as React from "react";

function Textarea({
  className,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  onFocus: externalOnFocus,
  onBlur: externalOnBlur,
  onMouseDown: externalOnMouseDown,
  disableSelectOnFocus,
  ...props
}: React.ComponentProps<"textarea"> & {
  disableSelectOnFocus?: boolean;
}) {
  const dialogComposition = useDialogComposition();

  const {
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
    onKeyDown: handleKeyDown,
  } = useComposition<HTMLTextAreaElement>({
    onKeyDown: (e) => {
      const isComposing = (e.nativeEvent as any).isComposing || dialogComposition.justEndedComposing();
      if (e.key === "Enter" && !e.shiftKey && isComposing) return;
      onKeyDown?.(e);
    },
    onCompositionStart: e => {
      dialogComposition.setComposing(true);
      onCompositionStart?.(e);
    },
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
  } = useDesktopField<HTMLTextAreaElement>();

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (!disableSelectOnFocus) deskFocus(e);
    externalOnFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    deskBlur();
    externalOnBlur?.(e);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!disableSelectOnFocus) deskMouseDown(e);
    externalOnMouseDown?.(e);
  };

  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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

export { Textarea };
