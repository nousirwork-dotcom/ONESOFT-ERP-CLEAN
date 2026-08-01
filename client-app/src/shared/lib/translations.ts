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

  // ─── Toolbar — button labels ──────────────────
  tbSave:    "حفظ",
  tbDraft:   "مسودة",
  tbNew:     "جديد",
  tbCopy:    "نسخة",
  tbTools:   "أدوات",
  tbToolsNotAvailable: "غير متاح لهذا المستند",
  tbEdit:    "تعديل",
  tbDelete:  "حذف",
  tbFirst:   "الأول",
  tbPrev:    "السابق",
  tbNext:    "التالي",
  tbLast:    "الأخير",
  tbApprove: "اعتماد",
  tbCancel:  "إلغاء",
  tbPreview: "معاينة",
  tbSend:    "إرسال",
  tbPrint:   "طباعة",
  tbExit:    "خروج",

  // ─── Toolbar — tools dropdown ─────────────────
  tbReverse:        "عكس المستند",
  tbPost:           "ترحيل المستند",
  tbUnpost:         "إلغاء ترحيل المستند",
  tbSuspendPosting: "تعليق ترحيل المستند",
  tbRelatedDocs:    "مستندات مرتبطة",
  tbUserActivity:   "نشاط المستخدمين",
  tbAttach:         "إرفاق مستند",
  tbAttachments:    "إرفاق المستندات",

  // ─── Toolbar — status bar ─────────────────────
  tbModeView:   "عرض",
  tbModeNew:    "إدخال",
  tbModeEdit:   "تعديل",
  tbModeSearch: "بحث",
  tbRecord:     "السجل",
  tbMode:       "الوضع",
  tbShortcuts:  "F2=حفظ · F3=جديد · F4=تعديل · Esc=خروج",

  // ─── Toolbar — posting status ─────────────────
  tbPostedBadge:    "✓ مرحَّل",
  tbUnpostedBadge:  "غير مرحَّل",
  tbCancelledBadge: "✕ ملغي",

  // ─── Unsaved changes dialog ───────────────────
  unsavedTitle:   "تعديلات غير محفوظة",
  unsavedMessage: "توجد تعديلات غير محفوظة في هذه الشاشة، هل تريد إغلاقها دون حفظ؟",
  unsavedSave:        "حفظ",
  unsavedSaveAsDraft: "حفظ كمسودة",
  unsavedSaving:      "جاري الحفظ...",
  unsavedDiscard:     "تجاهل",
  unsavedCancel:      "إلغاء",
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
  tbSave:    "Save",
  tbDraft:   "Draft",
  tbNew:     "New",
  tbCopy:    "Copy",
  tbTools:   "Tools",
  tbToolsNotAvailable: "Not available for this document",
  tbEdit:    "Edit",
  tbDelete:  "Delete",
  tbFirst:   "First",
  tbPrev:    "Previous",
  tbNext:    "Next",
  tbLast:    "Last",
  tbApprove: "Approve",
  tbCancel:  "Cancel",
  tbPreview: "Preview",
  tbSend:    "Send",
  tbPrint:   "Print",
  tbExit:    "Exit",
  tbReverse:        "Reverse Document",
  tbPost:           "Post Document",
  tbUnpost:         "Unpost Document",
  tbSuspendPosting: "Suspend Posting",
  tbRelatedDocs:    "Related Documents",
  tbUserActivity:   "User Activity",
  tbAttach:         "Attach Document",
  tbAttachments:    "Document Attachments",
  tbModeView:   "View",
  tbModeNew:    "New Entry",
  tbModeEdit:   "Edit",
  tbModeSearch: "Search",
  tbRecord:     "Record",
  tbMode:       "Mode",
  tbShortcuts:  "F2=Save · F3=New · F4=Edit · Esc=Exit",
  tbPostedBadge:    "✓ Posted",
  tbUnpostedBadge:  "Unposted",
  tbCancelledBadge: "✕ Cancelled",
  unsavedTitle:   "Unsaved Changes",
  unsavedMessage: "This screen has unsaved changes. Close it without saving?",
  unsavedSave:    "Save",
  unsavedSaveAsDraft: "Save as Draft",
  unsavedSaving:  "Saving...",
  unsavedDiscard: "Discard",
  unsavedCancel:  "Cancel",
};

export const TRANSLATIONS = { ar: AR, en: EN };

export function t(lang: "ar" | "en", key: TranslationKey): string {
  return TRANSLATIONS[lang][key];
}
