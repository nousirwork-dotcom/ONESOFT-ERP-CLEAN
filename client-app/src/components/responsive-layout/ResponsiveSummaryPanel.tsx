import React from "react";
import styles from "./ResponsiveLayout.module.css";

interface ResponsiveSummaryPanelProps {
  /** Additional className(s). */
  className?: string;
  /** Inline styles. */
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Fixed-width summary panel (totals / payment area) used in POS and
 * sales invoice screens.
 *
 * At full width it takes `clamp(250px, 22%, 320px)`.
 * Below the 760px container-query breakpoint it expands to 100% width.
 *
 * Must be a descendant of `<ResponsiveScreenLayout>`.
 *
 * Usage:
 * ```tsx
 * <div className="flex-1 flex overflow-hidden">
 *   <div className="flex-1 overflow-auto">…main content…</div>
 *   <ResponsiveSummaryPanel>…totals…</ResponsiveSummaryPanel>
 * </div>
 * ```
 */
export const ResponsiveSummaryPanel: React.FC<ResponsiveSummaryPanelProps> = ({
  className,
  style,
  children,
}) => {
  return (
    <div
      className={[styles.summaryPanel, className].filter(Boolean).join(" ")}
      style={style}
    >
      {children}
    </div>
  );
};

export default ResponsiveSummaryPanel;
