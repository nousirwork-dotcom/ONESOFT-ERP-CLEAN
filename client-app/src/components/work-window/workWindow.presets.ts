import type { WorkWindowPreset } from "./workWindow.types";

interface PresetDimensions {
  width: string;
  height: string;
}

/** مقاسات مسبقة الإعداد — استخدم min() لضمان عدم تجاوز حدود الشاشة */
export const WORK_WINDOW_PRESETS: Record<WorkWindowPreset, PresetDimensions> = {
  compact: {
    width:  "min(760px, calc(100% - 40px))",
    height: "min(520px, calc(100% - 80px))",
  },
  standard: {
    width:  "min(980px, calc(100% - 40px))",
    height: "min(620px, calc(100% - 80px))",
  },
  wide: {
    width:  "min(1180px, calc(100% - 40px))",
    height: "min(650px, calc(100% - 80px))",
  },
  fullscreen: {
    width:  "calc(100% - 12px)",
    height: "calc(100% - 12px)",
  },
};
