export type TranslationKey = keyof typeof AR;

const AR = {
  // ─── Nav groups ───────────────────────────────
  mainMenu: "القائمة الرئيسية",

  // ─── Nav items ────────────────────────────────
  dashboard: "لوحة التحكم",
  salesMgmt: "المبيعات",
  purchasesMgmt: "المشتريات",
  inventoryMgmt: "المخزون",
  manufacturingMgmt: "التصنيع",
  accounting: "الحسابات العامة",
  hr: "الموارد البشرية",
  fixedAssets: "الأصول الثابتة",
  helpServices: "المساعدة والخدمات",
  settings: "الإعدادات",

  // ─── Header ───────────────────────────────────
  systemSubtitle: "نظام إدارة الأعمال",
  online: "متصل",
  offline: "غير متصل",
  switchToHorizontal: "تبديل إلى العرض الأفقي",
  switchToVertical: "تبديل إلى العرض الرأسي",
  horizontal: "أفقية",
  vertical: "رأسية",
  central: "مركزية",

  // ─── User menu ────────────────────────────────
  user: "مستخدم",
  logout: "تسجيل الخروج",

  // ─── Role labels ──────────────────────────────
  roleAdmin: "مدير النظام",
  roleCashier: "كاشير",
  roleWarehouseManager: "مدير مخزن",

  // ─── Language toggle ──────────────────────────
  switchToEnglish: "English",
  switchToArabic: "عربي",

  // ─── Auth ─────────────────────────────────────
  verifyingSession: "جاري التحقق من الجلسة...",

  // ─── Date locale ──────────────────────────────
  dateLocale: "ar-SA",
} as const;

const EN: Record<keyof typeof AR, string> = {
  mainMenu: "Main Menu",
  dashboard: "Dashboard",
  salesMgmt: "Sales Management",
  purchasesMgmt: "Purchases Management",
  inventoryMgmt: "Inventory Management",
  manufacturingMgmt: "Manufacturing Management",
  accounting: "General Accounting",
  hr: "Human Resources",
  fixedAssets: "Fixed Assets",
  helpServices: "Help & Services",
  settings: "Settings",
  systemSubtitle: "Business Management System",
  online: "Online",
  offline: "Offline",
  switchToHorizontal: "Switch to Horizontal View",
  switchToVertical: "Switch to Vertical View",
  horizontal: "Horizontal",
  vertical: "Vertical",
  central: "Centered",
  user: "User",
  logout: "Logout",
  roleAdmin: "System Admin",
  roleCashier: "Cashier",
  roleWarehouseManager: "Warehouse Manager",
  switchToEnglish: "English",
  switchToArabic: "عربي",
  verifyingSession: "Verifying session...",
  dateLocale: "en-US",
};

export const TRANSLATIONS = { ar: AR, en: EN };

export function t(lang: "ar" | "en", key: TranslationKey): string {
  return TRANSLATIONS[lang][key];
}
