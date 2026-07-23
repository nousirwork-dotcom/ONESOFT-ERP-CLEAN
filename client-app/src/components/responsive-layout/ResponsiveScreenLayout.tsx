import React from "react";
import styles from "./ResponsiveLayout.module.css";

interface ResponsiveScreenLayoutProps {
  /** Additional className(s) for the root element. */
  className?: string;
  /** Inline styles for the root element. */
  style?: React.CSSProperties;
  children: React.ReactNode;
  /** HTML dir attribute. Defaults to "rtl". */
  dir?: "rtl" | "ltr";
}

/**
 * Root container for any ERP screen.
 *
 * Applies `container-type: inline-size` with the named container
 * `erp-screen` so all child `.formGrid*` classes and `@container`
 * rules react to the panel width rather than the viewport.
 *
 * Usage:
 * ```tsx
 * <ResponsiveScreenLayout className="flex flex-col h-full …" dir="rtl">
 *   …screen content…
 * </ResponsiveScreenLayout>
 * ```
 */
export const ResponsiveScreenLayout: React.FC<ResponsiveScreenLayoutProps> = ({
  className,
  style,
  children,
  dir = "rtl",
}) => {
  return (
    <div
      className={[styles.screenContainer, className].filter(Boolean).join(" ")}
      style={style}
      dir={dir}
    >
      {children}
    </div>
  );
};

export default ResponsiveScreenLayout;
