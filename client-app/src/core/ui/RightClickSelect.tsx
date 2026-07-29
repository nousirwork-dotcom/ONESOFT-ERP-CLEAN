/**
 * RightClickSelect — حقل اختيار بكليك يمين
 *
 * - كليك يسار: يُحدِّد/يُبرز الحقل فقط (لا يفتح القائمة)
 * - كليك يمين: يفتح قائمة الاختيار
 * - أيقونة ListFilter كإشارة بصرية
 * - Tooltip يوضّح السلوك
 */
import React, { useRef, useState } from "react";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/core/ui/select";

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
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
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
          onClick={() => { if (!editMode && !disabled) setOpen(true); }}
          onDoubleClick={() => {
            if (disabled) return;
            setEditText(value);
            setEditMode(true);
            setOpen(false);
            window.setTimeout(() => {
              inputRef.current?.focus();
              inputRef.current?.select();
            }, 0);
          }}
          onBlur={() => setFocused(false)}
          onContextMenu={e => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) { setFocused(true); setOpen(true); }
          }}
          tabIndex={disabled ? -1 : 0}
        >
          {editMode ? (
            <input
              ref={inputRef}
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onBlur={() => { setEditMode(false); }}
              onKeyDown={e => {
                if (e.key === "Enter") setEditMode(false);
                if (e.key === "Escape") setEditMode(false);
              }}
              className="h-full w-full border-0 bg-transparent p-0 text-right outline-none"
            />
          ) : <Select
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
            <SelectContent onPointerDownOutside={() => setOpen(false)}>
              {children}
            </SelectContent>
          </Select>}
    </div>
  );
}
