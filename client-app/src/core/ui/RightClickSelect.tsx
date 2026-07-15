/**
 * RightClickSelect — حقل اختيار بكليك يمين
 *
 * - كليك يسار: يُحدِّد/يُبرز الحقل فقط (لا يفتح القائمة)
 * - كليك يمين: يفتح قائمة الاختيار
 * - أيقونة ListFilter كإشارة بصرية
 * - Tooltip يوضّح السلوك
 */
import React, { useState } from "react";
import { ListFilter } from "lucide-react";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/ui/tooltip";

export interface RightClickSelectProps {
  id?: string;
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  dir?: "rtl" | "ltr";
}

export default function RightClickSelect({
  id, value, onValueChange, children, placeholder,
  disabled, className, dir = "rtl",
}: RightClickSelectProps) {
  const [open, setOpen]       = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          id={id}
          className={[
            "relative flex items-center rounded border bg-white h-7 px-2 text-[11px]",
            "cursor-text select-none transition-all",
            focused
              ? "border-indigo-400 ring-1 ring-indigo-200"
              : "border-slate-200 hover:border-slate-300",
            disabled ? "opacity-50 pointer-events-none" : "",
            className ?? "",
          ].join(" ")}
          onPointerDown={e => {
            if (e.button === 0) {
              e.preventDefault();
              e.stopPropagation();
              setFocused(true);
            }
          }}
          onBlur={() => setFocused(false)}
          onContextMenu={e => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) { setFocused(true); setOpen(true); }
          }}
          tabIndex={disabled ? -1 : 0}
        >
          <Select
            value={value || ""}
            onValueChange={v => { onValueChange(v); setOpen(false); }}
            open={open}
            onOpenChange={isOpen => { if (!isOpen) setOpen(false); }}
            disabled={disabled}
          >
            <SelectTrigger
              hideArrow
              dir={dir}
              className="h-full w-full border-0 bg-transparent p-0 shadow-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 cursor-text text-right"
            >
              <SelectValue placeholder={placeholder ?? ""} />
            </SelectTrigger>
            <SelectContent onInteractOutside={() => setOpen(false)}>
              {children}
            </SelectContent>
          </Select>
          <span className="absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
            <ListFilter className="w-3 h-3 text-slate-400" />
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center">
        كليك يمين لعرض الاختيارات
      </TooltipContent>
    </Tooltip>
  );
}
