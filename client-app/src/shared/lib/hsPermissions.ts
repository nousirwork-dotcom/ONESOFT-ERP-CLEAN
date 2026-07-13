// ─── صلاحيات وحدة «المساعدة والخدمات» ────────────────────────────────────────
// نمط extra_permissions JSONB (نفس نمط manage_branding):
// - admin / superadmin يرون كل شيء دائمًا.
// - غير ذلك: تلزم صلاحية الوحدة help_services + صلاحية الشاشة المحددة.

export const HS_MODULE_PERM = "help_services" as const;

export const HS_SCREEN_PERMS = [
  "hs_rentals",
  "hs_custody",
  "hs_customers",
  "hs_tasks",
  "hs_gov_links",
  "hs_notes",
  "hs_internal_comm",
  "hs_support",
] as const;

export type HsScreenPerm = (typeof HS_SCREEN_PERMS)[number];

export type HsUser = {
  role?: string | null;
  extraPermissions?: Record<string, boolean> | null;
} | null | undefined;

export function isAdminRole(role?: string | null): boolean {
  return role === "admin" || role === "superadmin";
}

export function canViewHelpServices(user: HsUser): boolean {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  return user.extraPermissions?.[HS_MODULE_PERM] === true;
}

export function canViewHsScreen(user: HsUser, perm: HsScreenPerm): boolean {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  return (
    user.extraPermissions?.[HS_MODULE_PERM] === true &&
    user.extraPermissions?.[perm] === true
  );
}

// مسار كل شاشة → مفتاح صلاحيتها (يُستخدم في فهرس البحث وحراسة الفتح)
export const HS_PATH_PERM: Record<string, HsScreenPerm> = {
  "/hs/rentals":       "hs_rentals",
  "/hs/custody":       "hs_custody",
  "/hs/customers":     "hs_customers",
  "/hs/tasks":         "hs_tasks",
  "/hs/gov-links":     "hs_gov_links",
  "/hs/notes":         "hs_notes",
  "/hs/internal-comm": "hs_internal_comm",
  "/hs/support":       "hs_support",
};
