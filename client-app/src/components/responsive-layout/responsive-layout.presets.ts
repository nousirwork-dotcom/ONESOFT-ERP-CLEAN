import type { ScreenLayoutPreset, DataColumnDef } from "./responsive-layout.types";

/**
 * Shared column definitions for the standard invoice-lines table.
 * Used by DocumentInvoicePage, SalesInvoicePage, and any future
 * purchase / return screens so that column proportions stay in sync.
 *
 * fixed: true  → weight is treated as exact pixels.
 * flex  cols   → weight is a proportional share (like CSS fr units).
 *               The 9 flex weights sum to 99, so each value ≈ its
 *               target percentage point.
 */
export const INVOICE_TABLE_COLS: DataColumnDef[] = [
  { id: "row-num",   label: "#",         minWidth: 30,  weight: 30, fixed: true },
  { id: "item-code", label: "رقم الصنف", minWidth: 70,  weight: 11              },
  { id: "item-name", label: "اسم الصنف", minWidth: 100, weight: 24              },
  { id: "qty",       label: "الكمية",    minWidth: 60,  weight:  9              },
  { id: "unit",      label: "الوحدة",    minWidth: 60,  weight:  9              },
  { id: "price",     label: "السعر",     minWidth: 70,  weight: 11              },
  { id: "disc-pct",  label: "خصم%",      minWidth: 50,  weight:  8              },
  { id: "disc-amt",  label: "الخصم ﷼",   minWidth: 60,  weight:  8              },
  { id: "tax-pct",   label: "ض%",        minWidth: 50,  weight:  7              },
  { id: "total",     label: "الإجمالي",  minWidth: 75,  weight: 12              },
  { id: "delete",    label: "",           minWidth: 28,  weight: 28, fixed: true },
];

/** Number of header-form columns for each preset at full width. */
export const PRESET_COLS: Record<ScreenLayoutPreset, number> = {
  document:    5,
  "master-data": 4,
  settings:    4,
  list:        0,
  report:      4,
  pos:         0,
};

/** Whether the preset shows a fixed-width summary panel on the right/left. */
export const PRESET_HAS_SUMMARY: Record<ScreenLayoutPreset, boolean> = {
  document:    false,
  "master-data": false,
  settings:    false,
  list:        false,
  report:      false,
  pos:         true,
};
