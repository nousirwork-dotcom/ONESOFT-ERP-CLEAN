/** Which screen preset drives the responsive behaviour. */
export type ScreenLayoutPreset =
  | "document"     // Invoice / journal entry pages  (5-col header grid)
  | "master-data"  // Customer / product / user lists (4-col header grid)
  | "settings"     // Settings / configuration pages  (4-col header grid)
  | "list"         // Pure list pages (no header form grid)
  | "report"       // Report viewer pages
  | "pos";         // Point-of-sale full-screen layout

/** A single data-grid column descriptor. */
export interface DataColumnDef {
  /** Unique column identifier (matched to <th> key). */
  id: string;
  /** Displayed column header label. */
  label: string;
  /**
   * Minimum pixel width below which the column must not shrink.
   * The browser will honour this even if the table is scrollable.
   */
  minWidth: number;
  /**
   * Relative weight used to distribute remaining table width.
   * Think of it as a CSS `fr` unit: weight 2 gets twice the extra
   * space of weight 1.
   */
  weight: number;
  /** Cap the column's final percentage width (e.g. 28 means ≤28%). */
  maxPercent?: number;
  /** Text alignment inside cells. Defaults to "start". */
  align?: "start" | "center" | "end";
  /** Whether the column is fixed-size (ignores container queries). */
  fixed?: boolean;
}
