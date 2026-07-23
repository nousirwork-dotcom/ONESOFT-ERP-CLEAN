import type { ScreenLayoutPreset } from "./responsive-layout.types";

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
