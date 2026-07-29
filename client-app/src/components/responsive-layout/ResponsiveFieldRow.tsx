import React from "react";

interface ResponsiveFieldRowProps {
  /** Label text shown to the right of the field (RTL). */
  label: string;
  /** Minimum label width. Defaults to CSS var(--label-w, 72px). */
  labelWidth?: string | number;
  /** Additional className for the wrapper div. */
  className?: string;
  children: React.ReactNode;
}

/**
 * A single label + field row used inside `<ResponsiveFormGrid>`.
 *
 * Renders a flex row with a fixed-width label and a flex-1 input area.
 * When the grid collapses to a single column the label stays inline.
 *
 * Usage:
 * ```tsx
 * <ResponsiveFieldRow label="اسم العميل">
 *   <input className="classic-input w-full" … />
 * </ResponsiveFieldRow>
 * ```
 */
export const ResponsiveFieldRow: React.FC<ResponsiveFieldRowProps> = ({
  label,
  labelWidth,
  className,
  children,
}) => {
  const minW = labelWidth ?? "var(--label-w, 72px)";
  const minWStr = typeof minW === "number" ? `${minW}px` : minW;

  return (
    <div
      className={["flex items-center gap-1", className].filter(Boolean).join(" ")}
    >
      <label
        style={{
          minWidth: minWStr,
          flexShrink: 0,
          fontSize: 10,
          fontWeight: 700,
          color: "#555",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
};

export default ResponsiveFieldRow;
