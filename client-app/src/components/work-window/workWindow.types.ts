import type { ReactNode } from "react";

/** أحجام النوافذ المسبقة الإعداد */
export type WorkWindowPreset = "compact" | "standard" | "wide" | "fullscreen";

/**
 * موضع فتح نافذة العمل الافتراضي.
 * "top-right" — أعلى اليمين بمسافة 18px (الافتراضي لجميع الشاشات الأربع).
 * "center"    — منتصف مساحة العمل (للنوافذ الصغيرة مستقبلاً).
 */
export type WorkWindowPlacement = "top-right" | "center";

/** طريقة عرض الشاشة في نظام التسجيل المركزي */
export type ScreenPresentation = "module-home" | "list" | "work-window" | "workspace" | "fullscreen";

/** الحالة الكاملة لنافذة العمل */
export interface WorkWindowState {
  isOpen: boolean;
  title: string;
  preset: WorkWindowPreset;
  isMaximized: boolean;
  /** الإزاحة عن المركز بالسحب (null = مُوسَّط) */
  dragOffset: { x: number; y: number } | null;
  isDirty: boolean;
}

/** إعداد فتح نافذة عمل */
export interface WorkWindowConfig {
  title: string;
  preset: WorkWindowPreset;
  children: ReactNode;
  /** شريط الأدوات السفلي — يُوضع في workWindowFooter */
  footer?: ReactNode;
}

/** قيمة الـ Context المُصدَّرة */
export interface WorkWindowContextValue {
  state: WorkWindowState;
  openWorkWindow: (config: WorkWindowConfig) => void;
  closeWorkWindow: () => void;
  requestClose: () => void; // مع فحص isDirty
  setWorkWindowTitle: (title: string) => void;
  setUnsavedChanges: (dirty: boolean) => void;
  toggleMaximize: () => void;
  setDragOffset: (offset: { x: number; y: number } | null) => void;
  /** المحتوى الحالي (للـ WorkWindowHost) */
  currentChildren: ReactNode;
  currentFooter: ReactNode;
}
