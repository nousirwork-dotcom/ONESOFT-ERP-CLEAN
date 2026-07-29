import React from "react";
import type { DataColumnDef } from "./responsive-layout.types";
import { INVOICE_TABLE_COLS } from "./responsive-layout.presets";

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

// ─── InvoiceTableColgroup ─────────────────────────────────────────────────────
// Renders the standard <colgroup> for invoice-lines tables, derived from the
// centrally-defined INVOICE_TABLE_COLS.  Drop into any invoice <table> to keep
// column proportions identical across Sales, Purchase, and Return screens.
// Any future column-weight change only needs to be made in presets.ts.

const _flexWeight = INVOICE_TABLE_COLS
  .filter(c => !c.fixed)
  .reduce((s, c) => s + c.weight, 0);

export const InvoiceTableColgroup: React.FC = () => (
  <colgroup>
    {INVOICE_TABLE_COLS.map(col => (
      <col
        key={col.id}
        style={
          col.fixed
            ? { width: col.weight, minWidth: col.minWidth }
            : {
                width: `${((col.weight / _flexWeight) * 100).toFixed(2)}%`,
                minWidth: col.minWidth,
              }
        }
      />
    ))}
  </colgroup>
);
