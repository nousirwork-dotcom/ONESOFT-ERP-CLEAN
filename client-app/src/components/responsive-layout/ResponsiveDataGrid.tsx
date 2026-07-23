import React from "react";
import type { DataColumnDef } from "./responsive-layout.types";

interface ResponsiveDataGridProps {
  /** Column definitions used to build the `<colgroup>`. */
  columns: DataColumnDef[];
  /** Additional className on the `<table>` element. */
  className?: string;
  /** Inline style for the `<table>` element. */
  style?: React.CSSProperties;
  /**
   * Render the `<thead>` content.  The caller is responsible for the
   * `<tr>` and `<th>` elements so they can apply their own styling.
   */
  renderHead: () => React.ReactNode;
  /**
   * Render the `<tbody>` content.
   */
  renderBody: () => React.ReactNode;
}

/**
 * Wraps a data table with a computed `<colgroup>` so column widths are
 * proportional and honour `minWidth` constraints from `DataColumnDef`.
 *
 * The component converts each column's `weight` into a percentage of the
 * total weight, then applies `min-width` via the `<col>` element's style.
 *
 * Usage:
 * ```tsx
 * <ResponsiveDataGrid
 *   columns={INVOICE_COLS}
 *   className="w-full border-collapse"
 *   renderHead={() => <tr>…</tr>}
 *   renderBody={() => lines.map(…)}
 * />
 * ```
 */
export const ResponsiveDataGrid: React.FC<ResponsiveDataGridProps> = ({
  columns,
  className,
  style,
  renderHead,
  renderBody,
}) => {
  const totalWeight = columns.reduce((s, c) => s + c.weight, 0);

  return (
    <table className={className} style={style}>
      <colgroup>
        {columns.map(col => {
          const pct = totalWeight > 0 ? (col.weight / totalWeight) * 100 : 0;
          const widthStr = col.fixed
            ? `${col.weight}px`
            : col.maxPercent
            ? `min(${col.maxPercent}%, ${pct.toFixed(2)}%)`
            : `${pct.toFixed(2)}%`;

          return (
            <col
              key={col.id}
              style={{
                width: widthStr,
                minWidth: col.minWidth,
              }}
            />
          );
        })}
      </colgroup>
      <thead>{renderHead()}</thead>
      <tbody>{renderBody()}</tbody>
    </table>
  );
};

export default ResponsiveDataGrid;
