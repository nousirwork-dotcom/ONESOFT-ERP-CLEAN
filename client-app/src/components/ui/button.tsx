import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[2px] text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#406B93]/40",
  {
    variants: {
      variant: {
        default:     "bg-[#406B93] text-white hover:bg-[#345878] border border-[#2F5070]",
        destructive: "bg-[#C0392B] text-white hover:bg-[#A93226] border border-[#992D22]",
        outline:     "border border-[#D4CDC1] bg-[#F6F4EE] text-[#2F2F2F] hover:bg-[#EEF3F7] dark:bg-transparent dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700",
        secondary:   "bg-[#E4DFDA] text-[#2F2F2F] hover:bg-[#D4CDC1] border border-[#C8C1B8]",
        ghost:       "hover:bg-[#EEF3F7] text-[#2F2F2F] dark:hover:bg-slate-700 dark:text-slate-200",
        link:        "text-[#406B93] underline-offset-4 hover:underline",
      },
      size: {
        default:   "h-7 px-3 py-1",
        sm:        "h-6 px-2 text-[12px]",
        lg:        "h-8 px-4",
        icon:      "size-7",
        "icon-sm": "size-6",
        "icon-lg": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
