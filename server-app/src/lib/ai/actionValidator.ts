import { z } from 'zod';

// ─── قائمة العمليات المحظورة (تُفرض في الخادم — المرحلة الأولى) ──────────────
// أي نوع عملية غير موجود في ALLOWED_ACTIONS مرفوض تلقائيًا.
// المحظورات تشمل (على سبيل الحصر لا المثال): إنشاء/تعديل/حذف القيود المحاسبية،
// الترحيل وإلغاء الترحيل، الاعتماد، حذف أو تعديل بيانات أساسية، تغيير الصلاحيات
// أو المستخدمين، تعديل الترخيص أو الإعدادات الحساسة، إرسال رسائل خارجية.

export const ALLOWED_ACTIONS = ['create_task'] as const;
export type AiActionType = (typeof ALLOWED_ACTIONS)[number];

// ─── مخطط اقتراح إنشاء مهمة ──────────────────────────────────────────────────
export const createTaskPayloadSchema = z.object({
  title:        z.string().min(2).max(300),
  details:      z.string().max(4000).optional().default(''),
  assigneeName: z.string().max(200).optional(),          // اسم المسؤول كما ذكره النموذج
  assigneeUserId: z.number().int().positive().optional(), // يُحدَّد بعد المطابقة
  dueDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueTime:      z.string().regex(/^\d{2}:\d{2}$/).optional(),
  priority:     z.enum(['low', 'normal', 'high']).optional().default('normal'),
});

export type CreateTaskPayload = z.infer<typeof createTaskPayloadSchema>;

// ─── التحقق من اقتراح قادم من النموذج ────────────────────────────────────────
export function validateProposedAction(raw: any):
  | { ok: true; actionType: AiActionType; payload: CreateTaskPayload }
  | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'صيغة الاقتراح غير صالحة' };
  const type = String(raw.type ?? '');
  if (!ALLOWED_ACTIONS.includes(type as AiActionType)) {
    return { ok: false, reason: `العملية «${type}» غير مسموح بها في المرحلة الحالية` };
  }
  const parsed = createTaskPayloadSchema.safeParse(raw.payload ?? raw);
  if (!parsed.success) return { ok: false, reason: 'بيانات المهمة المقترحة غير مكتملة أو غير صالحة' };
  return { ok: true, actionType: 'create_task', payload: parsed.data };
}

// ─── استخراج بلوك الاقتراح من إجابة النموذج ──────────────────────────────────
// النموذج يقترح عملية عبر بلوك: ```onesoft_action { ... } ```
const ACTION_BLOCK_RE = /```onesoft_action\s*([\s\S]*?)```/;

export function extractActionBlock(answer: string): { cleanAnswer: string; action: any | null } {
  const m = answer.match(ACTION_BLOCK_RE);
  if (!m) return { cleanAnswer: answer, action: null };
  let action: any = null;
  try { action = JSON.parse(m[1].trim()); } catch { action = null; }
  const cleanAnswer = answer.replace(ACTION_BLOCK_RE, '').trim();
  return { cleanAnswer, action };
}
