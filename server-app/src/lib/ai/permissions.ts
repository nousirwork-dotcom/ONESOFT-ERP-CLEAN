import { TRPCError } from '@trpc/server';
import type { User } from '../../schema.js';
import { isModuleAllowed } from '../license.js';

// ─── صلاحيات المساعد الذكي (extra_permissions JSONB) ─────────────────────────
// admin / superadmin مستثنون دائمًا (يملكون كل الصلاحيات).

export const AI_MODULE_PERM = 'ai_use' as const;

export const AI_SUB_PERMS = [
  'ai_ask_customers',       // سؤال عن العملاء
  'ai_ask_rentals',         // الإيجارات والعقود
  'ai_ask_custody',         // العهد والمصروفات
  'ai_ask_projects',        // المشروعات العقارية
  'ai_ask_tasks',           // المهام
  'ai_draft_messages',      // إنشاء مسودة رسالة
  'ai_propose_tasks',       // اقتراح مهمة
  'ai_confirm_tasks',       // تأكيد إنشاء مهمة
  'ai_view_history',        // عرض سجل المحادثات
  'ai_delete_conversations',// حذف المحادثات
  'ai_manage_settings',     // إدارة إعدادات الذكاء الاصطناعي
] as const;

export type AiPerm = typeof AI_MODULE_PERM | (typeof AI_SUB_PERMS)[number];

export const AI_ALL_PERMS: readonly AiPerm[] = [AI_MODULE_PERM, ...AI_SUB_PERMS];

// ─── فحوصات ──────────────────────────────────────────────────────────────────
export function isAdminRole(role?: string | null): boolean {
  return role === 'admin' || role === 'superadmin';
}

export function hasAiPerm(user: User, perm: AiPerm): boolean {
  if (isAdminRole(user.role)) return true;
  const extra = (user.extraPermissions ?? {}) as Record<string, boolean>;
  if (perm === AI_MODULE_PERM) return extra[AI_MODULE_PERM] === true;
  return extra[AI_MODULE_PERM] === true && extra[perm] === true;
}

// ─── حُرّاس تُرمى أخطاؤها بالعربية ───────────────────────────────────────────
export function assertAiLicense(): void {
  if (!isModuleAllowed('AI_ASSISTANT')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'ميزة المساعد الذكي غير مفعّلة في ترخيصك الحالي — تواصل مع الدعم الفني لتفعيلها',
    });
  }
}

export function assertAiPerm(user: User, perm: AiPerm): void {
  if (!hasAiPerm(user, perm)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'لا تملك صلاحية تنفيذ هذا الإجراء في المساعد الذكي',
    });
  }
}
