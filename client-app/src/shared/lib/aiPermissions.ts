// ─── صلاحيات «المساعد الذكي» ─────────────────────────────────────────────────
// نمط extra_permissions JSONB (نفس نمط وحدة المساعدة والخدمات):
// - admin / superadmin يملكون كل الصلاحيات دائمًا.
// - غير ذلك: تلزم صلاحية الوحدة ai_use + الصلاحية الفرعية المحددة.

export const AI_MODULE_PERM = "ai_use" as const;

export const AI_SUB_PERMS = [
  "ai_ask_customers",
  "ai_ask_rentals",
  "ai_ask_custody",
  "ai_ask_projects",
  "ai_ask_tasks",
  "ai_draft_messages",
  "ai_propose_tasks",
  "ai_confirm_tasks",
  "ai_view_history",
  "ai_delete_conversations",
  "ai_manage_settings",
] as const;

export type AiPerm = typeof AI_MODULE_PERM | (typeof AI_SUB_PERMS)[number];

export type AiUser = {
  role?: string | null;
  extraPermissions?: Record<string, boolean> | null;
} | null | undefined;

export function isAdminRole(role?: string | null): boolean {
  return role === "admin" || role === "superadmin";
}

export function canUseAi(user: AiUser): boolean {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  return user.extraPermissions?.[AI_MODULE_PERM] === true;
}

export function hasAiPerm(user: AiUser, perm: AiPerm): boolean {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  if (perm === AI_MODULE_PERM) return user.extraPermissions?.[AI_MODULE_PERM] === true;
  return (
    user.extraPermissions?.[AI_MODULE_PERM] === true &&
    user.extraPermissions?.[perm] === true
  );
}

// تعريفات الصلاحيات لعرضها في شاشة المستخدمين
export const AI_PERM_DEFS: Array<{ key: string; label: string; isModule?: boolean }> = [
  { key: AI_MODULE_PERM,           label: "استخدام المساعد الذكي", isModule: true },
  { key: "ai_ask_customers",       label: "سؤال عن العملاء" },
  { key: "ai_ask_rentals",         label: "سؤال عن الإيجارات والعقود" },
  { key: "ai_ask_custody",         label: "سؤال عن العهد والمصروفات" },
  { key: "ai_ask_projects",        label: "سؤال عن المشروعات" },
  { key: "ai_ask_tasks",           label: "سؤال عن المهام" },
  { key: "ai_draft_messages",      label: "إنشاء مسودات رسائل" },
  { key: "ai_propose_tasks",       label: "اقتراح مهام" },
  { key: "ai_confirm_tasks",       label: "تأكيد إنشاء المهام" },
  { key: "ai_view_history",        label: "عرض سجل المحادثات" },
  { key: "ai_delete_conversations", label: "حذف المحادثات" },
  { key: "ai_manage_settings",     label: "إدارة إعدادات الذكاء الاصطناعي" },
];
