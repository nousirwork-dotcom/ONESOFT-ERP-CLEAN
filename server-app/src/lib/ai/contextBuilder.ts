import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '../../db.js';
import { users, messages, hsTasks, type User } from '../../schema.js';
import { hasAiPerm, type AiPerm, AI_MODULE_PERM } from './permissions.js';

// ─── مسجّل مصادر البيانات (قابل للتوسعة) ─────────────────────────────────────
// كل وحدة تُوصَل هنا عند تفعيلها لاحقًا. المساعد لا يرى إلا ما يراه المستخدم
// نفسه: كل fetch يمر بصلاحيات المستخدم ويقيَّد بالمؤسسة وبالمستخدم حيث يلزم.
// لا SQL حر — قراءات محددة فقط عبر Drizzle.

export interface AiSource {
  type:  string;   // نوع السجل (user | message | hs_task | ...)
  id:    number | string;
  label: string;   // نص العنصر القابل للنقر
  path?: string;   // مسار الشاشة الأصلية داخل التطبيق
}

export interface AiSectionResult {
  sectionId: string;      // معرّف القسم
  titleAr:   string;      // اسم القسم بالعربية
  text:      string | null; // نص السياق للنموذج (null = لا بيانات بعد)
  sources:   AiSource[];
}

interface AiDataSection {
  id:      string;
  titleAr: string;
  perm:    AiPerm;                 // الصلاحية المطلوبة لهذا القسم
  fetch:   (user: User) => Promise<{ text: string | null; sources: AiSource[] }>;
}

// ─── الأقسام الحية (المرحلة الأولى) ──────────────────────────────────────────
const SECTIONS: AiDataSection[] = [
  {
    id: 'org_users',
    titleAr: 'مستخدمو المؤسسة',
    perm: AI_MODULE_PERM,
    fetch: async (user) => {
      const rows = await db.select({ id: users.id, name: users.name, role: users.role })
        .from(users)
        .where(and(eq(users.orgId, user.orgId), eq(users.isActive, true)))
        .limit(50);
      if (!rows.length) return { text: null, sources: [] };
      const text = 'مستخدمو المؤسسة النشطون:\n' +
        rows.map(r => `- (#${r.id}) ${r.name} — الدور: ${r.role}`).join('\n');
      return {
        text,
        sources: rows.map(r => ({ type: 'user', id: r.id, label: r.name, path: '/users' })),
      };
    },
  },
  {
    id: 'internal_messages',
    titleAr: 'التواصل الداخلي',
    perm: AI_MODULE_PERM,
    fetch: async (user) => {
      // رسائل المستخدم نفسه فقط (مرسلة أو مستقبلة) — لا اطلاع على رسائل الآخرين
      const rows = await db.select({
        id: messages.id, senderId: messages.senderId, receiverId: messages.receiverId,
        content: messages.content, createdAt: messages.createdAt,
      })
        .from(messages)
        .where(and(
          eq(messages.orgId, user.orgId),
          or(eq(messages.senderId, user.id), eq(messages.receiverId, user.id)),
        ))
        .orderBy(desc(messages.createdAt))
        .limit(20);
      if (!rows.length) return { text: null, sources: [] };
      const text = 'آخر رسائل التواصل الداخلي الخاصة بالمستخدم (الأحدث أولًا):\n' +
        rows.map(r =>
          `- [${r.createdAt.toISOString().slice(0, 16).replace('T', ' ')}] ` +
          `${r.senderId === user.id ? 'أرسلتَ' : 'استلمتَ'}: ${r.content.slice(0, 200)}`
        ).join('\n');
      return {
        text,
        sources: [{ type: 'messages', id: 'internal', label: 'التواصل الداخلي', path: '/hs/internal-comm' }],
      };
    },
  },
  {
    id: 'hs_tasks',
    titleAr: 'المهام والتذكيرات',
    perm: 'ai_ask_tasks',
    fetch: async (user) => {
      // مهام المستخدم: التي أنشأها أو المُسندة إليه
      const rows = await db.select()
        .from(hsTasks)
        .where(and(
          eq(hsTasks.orgId, user.orgId),
          or(eq(hsTasks.createdByUserId, user.id), eq(hsTasks.assigneeUserId, user.id)),
        ))
        .orderBy(desc(hsTasks.createdAt))
        .limit(30);
      if (!rows.length) return { text: null, sources: [] };
      const stat: Record<string, string> = { open: 'مفتوحة', done: 'منجزة', cancelled: 'ملغاة' };
      const prio: Record<string, string> = { low: 'منخفضة', normal: 'عادية', high: 'عالية' };
      const text = 'مهام المستخدم (الأحدث أولًا):\n' +
        rows.map(t =>
          `- (#${t.id}) ${t.title} — الحالة: ${stat[t.status] ?? t.status}، الأولوية: ${prio[t.priority] ?? t.priority}` +
          (t.dueDate ? `، الاستحقاق: ${t.dueDate}${t.dueTime ? ' ' + t.dueTime : ''}` : '') +
          (t.details ? ` — ${t.details.slice(0, 120)}` : '')
        ).join('\n');
      return {
        text,
        sources: rows.map(t => ({ type: 'hs_task', id: t.id, label: t.title, path: '/hs/tasks' })),
      };
    },
  },
  // ── أقسام مسجَّلة للمراحل القادمة (بلا بيانات بعد) ─────────────────────────
  { id: 'hs_customers', titleAr: 'متابعة العملاء',    perm: 'ai_ask_customers', fetch: async () => ({ text: null, sources: [] }) },
  { id: 'hs_rentals',   titleAr: 'الإيجارات والعقود', perm: 'ai_ask_rentals',   fetch: async () => ({ text: null, sources: [] }) },
  { id: 'hs_custody',   titleAr: 'العهد والمصروفات',  perm: 'ai_ask_custody',   fetch: async () => ({ text: null, sources: [] }) },
  { id: 'projects',     titleAr: 'المشروعات العقارية', perm: 'ai_ask_projects',  fetch: async () => ({ text: null, sources: [] }) },
];

// ─── بناء السياق ─────────────────────────────────────────────────────────────
export async function buildContext(user: User): Promise<{
  contextText: string;
  usedSections: string[];
  sources: AiSource[];
}> {
  const results: AiSectionResult[] = [];
  for (const section of SECTIONS) {
    if (!hasAiPerm(user, section.perm)) continue;
    try {
      const r = await section.fetch(user);
      results.push({ sectionId: section.id, titleAr: section.titleAr, ...r });
    } catch {
      // فشل قراءة قسم لا يوقف بقية الأقسام
    }
  }

  const withData = results.filter(r => r.text);
  const contextText = withData.length
    ? withData.map(r => `### ${r.titleAr}\n${r.text}`).join('\n\n')
    : '';

  return {
    contextText,
    usedSections: withData.map(r => r.sectionId),
    sources: withData.flatMap(r => r.sources),
  };
}
