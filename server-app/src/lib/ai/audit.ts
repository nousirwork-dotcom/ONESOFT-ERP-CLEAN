import { db } from '../../db.js';
import { aiAuditLogs } from '../../schema.js';

// ─── تسجيل تدقيق المساعد الذكي ───────────────────────────────────────────────
// يُسجَّل كل طلب وكل عملية. لا تُكتب أي كلمات مرور أو مفاتيح API هنا إطلاقًا.

export interface AiAuditEntry {
  orgId:          number;
  userId:         number;
  conversationId?: number | null;
  question?:      string | null;
  operationType:  string;               // ask | test_connection | confirm_action | cancel_action | ...
  sections?:      string[];
  recordsUsed?:   Array<Record<string, any>>;
  answerSummary?: string | null;
  proposed?:      boolean;
  confirmed?:     boolean;
  result?:        'ok' | 'error' | 'denied';
  errorMessage?:  string | null;
  provider?:      string | null;
  model?:         string | null;
}

export async function auditAi(entry: AiAuditEntry): Promise<void> {
  try {
    await db.insert(aiAuditLogs).values({
      orgId:          entry.orgId,
      userId:         entry.userId,
      conversationId: entry.conversationId ?? null,
      question:       entry.question?.slice(0, 4000) ?? null,
      operationType:  entry.operationType,
      sections:       entry.sections ?? [],
      recordsUsed:    entry.recordsUsed ?? [],
      answerSummary:  entry.answerSummary?.slice(0, 2000) ?? null,
      proposed:       entry.proposed ?? false,
      confirmed:      entry.confirmed ?? false,
      result:         entry.result ?? 'ok',
      errorMessage:   entry.errorMessage?.slice(0, 2000) ?? null,
      provider:       entry.provider ?? null,
      model:          entry.model ?? null,
    });
  } catch (e) {
    // فشل التدقيق لا يوقف الخدمة — لكن يُسجَّل في سجل الخادم
    console.error('[ai-audit] failed to write audit log:', e);
  }
}
