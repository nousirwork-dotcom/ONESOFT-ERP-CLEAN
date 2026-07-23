import React from "react";
import styles from "./ResponsiveLayout.module.css";

type ColVariant = 4 | 5 | 6;

interface ResponsiveFormGridProps {
  /** Column count at full width. Defaults to 4. */
  cols?: ColVariant;
  /** Additional className(s). */
  className?: string;
  /** Inline styles (e.g. columnGap / rowGap overrides). */
  style?: React.CSSProperties;
  children: React.ReactNode;
}

const STYLE_MAP: Record<ColVariant, string> = {
  4: styles.formGrid,
  5: styles.formGrid5,
  6: styles.formGrid6,
};

/**
 * Responsive header-form grid.
 *
 * Collapses from the full column count down to 3 → 2 → 1 columns as
 * the enclosing `erp-screen` container shrinks (via container queries).
 *
 * Must be a descendant of `<ResponsiveScreenLayout>` (or any element
 * that applies `styles.screenContainer`).
 *
 * Usage:
 * ```tsx
 * <ResponsiveFormGrid cols={5}>
 *   <HF label="…"><input … /></HF>
 *   …
 * </ResponsiveFormGrid>
 * ```
 */
export const ResponsiveFormGrid: React.FC<ResponsiveFormGridProps> = ({
  cols = 4,
  className,
  style,
  children,
}) => {
  const gridClass = STYLE_MAP[cols] ?? styles.formGrid;
  return (
    <div
      className={[gridClass, className].filter(Boolean).join(" ")}
      style={style}
    >
      {children}
    </div>
  );
};

export default ResponsiveFormGrid;
