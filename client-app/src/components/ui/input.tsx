import { useDialogComposition } from "@/components/ui/dialog";
import { useComposition } from "@/hooks/useComposition";
import { cn } from "@/lib/utils";
import * as React from "react";

function Input({
  className,
  type,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  ...props
}: React.ComponentProps<"input">) {
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
      {...props}
    />
  );
}

export { Input };
