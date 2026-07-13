import { z } from 'zod';
import { and, desc, eq, lt } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import {
  aiSettings, aiConversations, aiMessages, aiActionProposals, hsTasks, users,
  type User,
} from '../schema.js';
import { encrypt, decrypt } from '../config-crypto.js';
import { isModuleAllowed } from '../lib/license.js';
import {
  assertAiLicense, assertAiPerm, hasAiPerm, AI_ALL_PERMS,
} from '../lib/ai/permissions.js';
import { chatComplete, AiProviderError, type AiChatMessage } from '../lib/ai/provider.js';
import { buildContext, type AiSource } from '../lib/ai/contextBuilder.js';
import { extractActionBlock, validateProposedAction } from '../lib/ai/actionValidator.js';
import { auditAi } from '../lib/ai/audit.js';

// ─── راوتر المساعد الذكي — المرحلة الأولى (قراءة واقتراح فقط) ────────────────

const NOT_CONFIGURED_MSG = 'المساعد الذكي غير مهيأ بعد — يرجى ضبط الإعدادات من شاشة «إعدادات المساعد الذكي»';
const DISABLED_MSG       = 'المساعد الذكي معطَّل حاليًا من الإعدادات';

// ── جلب إعدادات المؤسسة ──────────────────────────────────────────────────────
async function getOrgAiSettings(orgId: number) {
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.orgId, orgId)).limit(1);
  return row ?? null;
}

function requireReadySettings(s: Awaited<ReturnType<typeof getOrgAiSettings>>) {
  if (!s || !s.apiKeyEnc) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: NOT_CONFIGURED_MSG });
  if (!s.enabled)         throw new TRPCError({ code: 'PRECONDITION_FAILED', message: DISABLED_MSG });
  return s;
}

// ── System Prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(user: User, contextText: string, canProposeTasks: boolean): string {
  const parts: string[] = [];
  parts.push(
`أنت «المساعد الذكي» داخل نظام OneSoft ERP. مهمتك مساعدة المستخدم في البحث والتلخيص والمتابعة وكتابة المسودات داخل النظام فقط.

قواعد صارمة:
1. أجب فقط من «بيانات النظام» المرفقة أدناه. إذا لم تكفِ البيانات للإجابة قل حرفيًا: «لم أجد بيانات كافية للإجابة داخل النظام» — ممنوع الاختلاق أو التخمين.
2. ممنوع منعًا باتًا اقتراح أو محاولة: إنشاء قيود محاسبية، الترحيل أو إلغاء الترحيل، الحذف أو التعديل على البيانات، الاعتماد، تغيير الصلاحيات أو المستخدمين أو الترخيص أو الإعدادات. إذا طُلب منك ذلك فاعتذر واذكر أن هذه العمليات غير متاحة للمساعد.
3. عند طلب كتابة رسالة أو نص: اكتب «مسودة» فقط وأوضح أنها لن تُرسل تلقائيًا.
4. أجب بلغة المستخدم (العربية غالبًا) بإيجاز ووضوح.`);

  if (canProposeTasks) {
    parts.push(
`5. إذا طلب المستخدم إنشاء مهمة أو تذكير، لا تنشئها مباشرة، بل اقترحها بإضافة بلوك واحد في نهاية إجابتك بهذه الصيغة حرفيًا:
\`\`\`onesoft_action
{"type":"create_task","payload":{"title":"...","details":"...","assigneeName":"اسم المستخدم إن ذُكر","dueDate":"YYYY-MM-DD إن ذُكر","dueTime":"HH:MM إن ذُكر","priority":"low|normal|high"}}
\`\`\`
ولا تكتب داخل نص الإجابة أن المهمة أُنشئت — هي مجرد اقتراح ينتظر تأكيد المستخدم.`);
  } else {
    parts.push('5. المستخدم لا يملك صلاحية اقتراح المهام — إذا طلب إنشاء مهمة فاعتذر بلطف واذكر أنه يحتاج صلاحية «اقتراح مهمة».');
  }

  parts.push(`\nاسم المستخدم الحالي: ${user.name} (المعرّف #${user.id})\nتاريخ اليوم: ${new Date().toISOString().slice(0, 10)}`);

  parts.push(contextText
    ? `\n=== بيانات النظام المتاحة لك ===\n${contextText}\n=== نهاية بيانات النظام ===`
    : '\n=== بيانات النظام المتاحة لك ===\n(لا توجد بيانات متاحة)\n=== نهاية بيانات النظام ===');

  return parts.join('\n');
}

// ── تنظيف المحادثات الأقدم من مدة الاحتفاظ ──────────────────────────────────
async function cleanupOldConversations(orgId: number, retentionDays: number) {
  try {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 3600 * 1000);
    await db.delete(aiConversations).where(and(
      eq(aiConversations.orgId, orgId),
      lt(aiConversations.updatedAt, cutoff),
    ));
  } catch { /* غير حرج */ }
}

export const aiRouter = router({

  // ═══ الحالة العامة (لشاشة المحادثة والبطاقة) ═══════════════════════════════
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const licenseAllowed = isModuleAllowed('AI_ASSISTANT');
    const s = await getOrgAiSettings(ctx.user.orgId);
    const perms: Record<string, boolean> = {};
    for (const p of AI_ALL_PERMS) perms[p] = hasAiPerm(ctx.user, p);
    return {
      licenseAllowed,
      configured: !!(s && s.apiKeyEnc),
      enabled:    !!(s && s.enabled),
      keepHistory: s?.keepHistory ?? true,
      lastError:  s?.lastError ?? null,
      lastOkAt:   s?.lastOkAt ?? null,
      perms,
    };
  }),

  // ═══ الإعدادات (صلاحية ai_manage_settings) ═════════════════════════════════
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    assertAiPerm(ctx.user, 'ai_manage_settings');
    const s = await getOrgAiSettings(ctx.user.orgId);
    return {
      enabled:       s?.enabled ?? false,
      provider:      s?.provider ?? 'openai',
      baseUrl:       s?.baseUrl ?? 'https://api.openai.com/v1',
      model:         s?.model ?? 'gpt-4o-mini',
      // المفتاح لا يُعاد أبدًا — فقط مؤشر وجوده وآخر 4 أحرف مقنّعة
      hasApiKey:     !!s?.apiKeyEnc,
      apiKeyMasked:  s?.apiKeyEnc ? maskKey(decrypt(s.apiKeyEnc)) : null,
      maxTokens:     s?.maxTokens ?? 1024,
      temperature:   s ? Number(s.temperature) : 0.3,
      allowOrgData:  s?.allowOrgData ?? true,
      keepHistory:   s?.keepHistory ?? true,
      retentionDays: s?.retentionDays ?? 90,
      lastError:     s?.lastError ?? null,
      lastOkAt:      s?.lastOkAt ?? null,
    };
  }),

  saveSettings: protectedProcedure
    .input(z.object({
      enabled:       z.boolean(),
      provider:      z.string().min(1).max(50),
      baseUrl:       z.string().url().max(500),
      model:         z.string().min(1).max(100),
      apiKey:        z.string().max(500).optional(),   // إن غاب → يبقى المفتاح السابق
      maxTokens:     z.number().int().min(64).max(32000),
      temperature:   z.number().min(0).max(2),
      allowOrgData:  z.boolean(),
      keepHistory:   z.boolean(),
      retentionDays: z.number().int().min(1).max(3650),
    }))
    .mutation(async ({ input, ctx }) => {
      assertAiPerm(ctx.user, 'ai_manage_settings');
      const existing = await getOrgAiSettings(ctx.user.orgId);
      const apiKeyEnc = input.apiKey?.trim()
        ? encrypt(input.apiKey.trim())
        : existing?.apiKeyEnc ?? null;

      const values = {
        enabled:       input.enabled,
        provider:      input.provider,
        baseUrl:       input.baseUrl,
        model:         input.model,
        apiKeyEnc,
        maxTokens:     input.maxTokens,
        temperature:   input.temperature.toFixed(2),
        allowOrgData:  input.allowOrgData,
        keepHistory:   input.keepHistory,
        retentionDays: input.retentionDays,
        updatedAt:     new Date(),
      };
      if (existing) {
        await db.update(aiSettings).set(values).where(eq(aiSettings.id, existing.id));
      } else {
        await db.insert(aiSettings).values({ orgId: ctx.user.orgId, ...values });
      }
      await auditAi({ orgId: ctx.user.orgId, userId: ctx.user.id, operationType: 'save_settings' });
      return { success: true };
    }),

  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    assertAiPerm(ctx.user, 'ai_manage_settings');
    const s = await getOrgAiSettings(ctx.user.orgId);
    if (!s || !s.apiKeyEnc) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: NOT_CONFIGURED_MSG });
    try {
      await chatComplete(
        {
          baseUrl: s.baseUrl, apiKey: decrypt(s.apiKeyEnc), model: s.model,
          maxTokens: 16, temperature: 0, timeoutMs: 20_000,
        },
        [{ role: 'user', content: 'قل: تم الاتصال' }],
      );
      await db.update(aiSettings).set({ lastError: null, lastOkAt: new Date(), updatedAt: new Date() })
        .where(eq(aiSettings.id, s.id));
      await auditAi({ orgId: ctx.user.orgId, userId: ctx.user.id, operationType: 'test_connection', provider: s.provider, model: s.model });
      return { success: true, message: 'تم الاتصال بالخدمة بنجاح' };
    } catch (e: any) {
      const msg = e instanceof AiProviderError ? e.message : 'تعذر الاتصال بالخدمة';
      await db.update(aiSettings).set({ lastError: msg, updatedAt: new Date() })
        .where(eq(aiSettings.id, s.id));
      await auditAi({
        orgId: ctx.user.orgId, userId: ctx.user.id, operationType: 'test_connection',
        result: 'error', errorMessage: msg, provider: s.provider, model: s.model,
      });
      throw new TRPCError({ code: 'BAD_REQUEST', message: msg });
    }
  }),

  // ═══ المحادثات ═════════════════════════════════════════════════════════════
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    assertAiLicense();
    assertAiPerm(ctx.user, 'ai_view_history');
    return db.select({
      id: aiConversations.id, title: aiConversations.title,
      createdAt: aiConversations.createdAt, updatedAt: aiConversations.updatedAt,
    })
      .from(aiConversations)
      .where(and(eq(aiConversations.orgId, ctx.user.orgId), eq(aiConversations.userId, ctx.user.id)))
      .orderBy(desc(aiConversations.updatedAt))
      .limit(50);
  }),

  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      assertAiLicense();
      assertAiPerm(ctx.user, 'ai_use');
      const [conv] = await db.select().from(aiConversations).where(and(
        eq(aiConversations.id, input.conversationId),
        eq(aiConversations.orgId, ctx.user.orgId),
        eq(aiConversations.userId, ctx.user.id),
      )).limit(1);
      if (!conv) throw new TRPCError({ code: 'NOT_FOUND', message: 'المحادثة غير موجودة' });
      return db.select().from(aiMessages)
        .where(eq(aiMessages.conversationId, conv.id))
        .orderBy(aiMessages.id);
    }),

  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      assertAiLicense();
      assertAiPerm(ctx.user, 'ai_delete_conversations');
      const res = await db.delete(aiConversations).where(and(
        eq(aiConversations.id, input.conversationId),
        eq(aiConversations.orgId, ctx.user.orgId),
        eq(aiConversations.userId, ctx.user.id),
      )).returning({ id: aiConversations.id });
      if (!res.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'المحادثة غير موجودة' });
      await auditAi({ orgId: ctx.user.orgId, userId: ctx.user.id, conversationId: input.conversationId, operationType: 'delete_conversation' });
      return { success: true };
    }),

  // ═══ السؤال الرئيسي ═══════════════════════════════════════════════════════
  ask: protectedProcedure
    .input(z.object({
      question:       z.string().min(1).max(4000),
      conversationId: z.number().int().positive().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      assertAiLicense();
      assertAiPerm(ctx.user, 'ai_use');
      const s = requireReadySettings(await getOrgAiSettings(ctx.user.orgId));

      // ── بناء السياق حسب صلاحيات المستخدم ─────────────────────────────────
      const { contextText, usedSections, sources } = s.allowOrgData
        ? await buildContext(ctx.user)
        : { contextText: '', usedSections: [] as string[], sources: [] as AiSource[] };

      const canProposeTasks = hasAiPerm(ctx.user, 'ai_propose_tasks');
      const systemPrompt = buildSystemPrompt(ctx.user, contextText, canProposeTasks);

      // ── تاريخ المحادثة (آخر 12 رسالة) ────────────────────────────────────
      let conversationId = input.conversationId ?? null;
      const history: AiChatMessage[] = [];
      if (conversationId && s.keepHistory) {
        const [conv] = await db.select().from(aiConversations).where(and(
          eq(aiConversations.id, conversationId),
          eq(aiConversations.orgId, ctx.user.orgId),
          eq(aiConversations.userId, ctx.user.id),
        )).limit(1);
        if (!conv) conversationId = null;
        else {
          const prev = await db.select().from(aiMessages)
            .where(eq(aiMessages.conversationId, conv.id))
            .orderBy(desc(aiMessages.id)).limit(12);
          prev.reverse().forEach(m => history.push({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          }));
        }
      }

      // ── استدعاء المزود ───────────────────────────────────────────────────
      let rawAnswer: string;
      try {
        rawAnswer = await chatComplete(
          {
            baseUrl: s.baseUrl, apiKey: decrypt(s.apiKeyEnc!), model: s.model,
            maxTokens: s.maxTokens, temperature: Number(s.temperature),
          },
          [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: input.question }],
        );
        await db.update(aiSettings).set({ lastError: null, lastOkAt: new Date() }).where(eq(aiSettings.id, s.id));
      } catch (e: any) {
        const msg = e instanceof AiProviderError ? e.message : 'المساعد الذكي غير متاح حاليًا بسبب عدم وجود اتصال بالخدمة.';
        await db.update(aiSettings).set({ lastError: msg }).where(eq(aiSettings.id, s.id));
        await auditAi({
          orgId: ctx.user.orgId, userId: ctx.user.id, conversationId,
          question: input.question, operationType: 'ask', sections: usedSections,
          result: 'error', errorMessage: msg, provider: s.provider, model: s.model,
        });
        throw new TRPCError({ code: 'BAD_REQUEST', message: msg });
      }

      // ── استخراج اقتراح العملية (إن وجد) والتحقق منه في الخادم ────────────
      const { cleanAnswer, action } = extractActionBlock(rawAnswer);
      let proposal: { id: number; actionType: string; payload: Record<string, any> } | null = null;

      if (action && canProposeTasks) {
        const v = validateProposedAction(action);
        if (v.ok) {
          // مطابقة اسم المسؤول إلى مستخدم فعلي في المؤسسة (إن ذُكر)
          const payload: Record<string, any> = { ...v.payload };
          if (payload.assigneeName && !payload.assigneeUserId) {
            const name = String(payload.assigneeName).trim();
            const orgUsers = await db.select({ id: users.id, name: users.name }).from(users)
              .where(and(eq(users.orgId, ctx.user.orgId), eq(users.isActive, true)));
            const match = orgUsers.find(u => u.name === name)
              ?? orgUsers.find(u => u.name.includes(name) || name.includes(u.name));
            if (match) { payload.assigneeUserId = match.id; payload.assigneeName = match.name; }
          }
          const [row] = await db.insert(aiActionProposals).values({
            orgId: ctx.user.orgId, userId: ctx.user.id, conversationId,
            actionType: v.actionType, payload,
          }).returning({ id: aiActionProposals.id });
          proposal = { id: row.id, actionType: v.actionType, payload };
        }
      }

      // ── حفظ الرسائل (حسب إعداد الاحتفاظ) ─────────────────────────────────
      if (s.keepHistory) {
        if (!conversationId) {
          const title = input.question.slice(0, 60) + (input.question.length > 60 ? '…' : '');
          const [conv] = await db.insert(aiConversations)
            .values({ orgId: ctx.user.orgId, userId: ctx.user.id, title })
            .returning({ id: aiConversations.id });
          conversationId = conv.id;
        } else {
          await db.update(aiConversations).set({ updatedAt: new Date() })
            .where(eq(aiConversations.id, conversationId));
        }
        await db.insert(aiMessages).values([
          { orgId: ctx.user.orgId, conversationId, userId: ctx.user.id, role: 'user', content: input.question },
          { orgId: ctx.user.orgId, conversationId, userId: ctx.user.id, role: 'assistant', content: cleanAnswer, sources },
        ]);
        cleanupOldConversations(ctx.user.orgId, s.retentionDays);
      }

      await auditAi({
        orgId: ctx.user.orgId, userId: ctx.user.id, conversationId,
        question: input.question, operationType: 'ask',
        sections: usedSections,
        recordsUsed: sources.slice(0, 50).map(src => ({ type: src.type, id: src.id })),
        answerSummary: cleanAnswer.slice(0, 500),
        proposed: !!proposal, provider: s.provider, model: s.model,
      });

      return {
        answer: cleanAnswer || 'لم أجد بيانات كافية للإجابة داخل النظام',
        sources,
        conversationId,
        proposal,
      };
    }),

  // ═══ تأكيد / إلغاء اقتراح عملية ═══════════════════════════════════════════
  confirmProposal: protectedProcedure
    .input(z.object({
      proposalId: z.number().int().positive(),
      // تعديلات المستخدم على المعاينة قبل التأكيد
      title:          z.string().min(2).max(300),
      details:        z.string().max(4000).optional().default(''),
      assigneeUserId: z.number().int().positive().nullable().optional(),
      dueDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      dueTime:        z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
      priority:       z.enum(['low', 'normal', 'high']).default('normal'),
    }))
    .mutation(async ({ input, ctx }) => {
      assertAiLicense();
      // إعادة التحقق من الصلاحية في الخادم — لا اعتماد على الواجهة
      assertAiPerm(ctx.user, 'ai_confirm_tasks');

      const [prop] = await db.select().from(aiActionProposals).where(and(
        eq(aiActionProposals.id, input.proposalId),
        eq(aiActionProposals.orgId, ctx.user.orgId),
        eq(aiActionProposals.userId, ctx.user.id),
      )).limit(1);
      if (!prop) throw new TRPCError({ code: 'NOT_FOUND', message: 'الاقتراح غير موجود' });
      if (prop.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'هذا الاقتراح تمت معالجته من قبل' });
      }
      if (prop.actionType !== 'create_task') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'نوع العملية غير مسموح به' });
      }

      // التحقق من أن المسؤول (إن حُدد) مستخدم نشط في نفس المؤسسة
      let assigneeUserId: number | null = input.assigneeUserId ?? null;
      if (assigneeUserId) {
        const [assignee] = await db.select({ id: users.id }).from(users).where(and(
          eq(users.id, assigneeUserId), eq(users.orgId, ctx.user.orgId), eq(users.isActive, true),
        )).limit(1);
        if (!assignee) throw new TRPCError({ code: 'BAD_REQUEST', message: 'المستخدم المسؤول غير موجود في المؤسسة' });
      }

      try {
        const [task] = await db.insert(hsTasks).values({
          orgId: ctx.user.orgId,
          createdByUserId: ctx.user.id,
          assigneeUserId,
          title: input.title.trim(),
          details: input.details?.trim() || null,
          dueDate: input.dueDate ?? null,
          dueTime: input.dueTime ?? null,
          priority: input.priority,
          source: 'ai',
        }).returning({ id: hsTasks.id });

        await db.update(aiActionProposals).set({
          status: 'confirmed',
          resultMessage: `تم إنشاء المهمة #${task.id}`,
          updatedAt: new Date(),
        }).where(eq(aiActionProposals.id, prop.id));

        await auditAi({
          orgId: ctx.user.orgId, userId: ctx.user.id, conversationId: prop.conversationId,
          operationType: 'confirm_action', proposed: true, confirmed: true,
          answerSummary: `create_task → hs_tasks#${task.id}: ${input.title}`,
        });
        return { success: true, taskId: task.id };
      } catch (e: any) {
        await db.update(aiActionProposals).set({
          status: 'failed', resultMessage: 'فشل إنشاء المهمة', updatedAt: new Date(),
        }).where(eq(aiActionProposals.id, prop.id));
        await auditAi({
          orgId: ctx.user.orgId, userId: ctx.user.id, conversationId: prop.conversationId,
          operationType: 'confirm_action', proposed: true, confirmed: true,
          result: 'error', errorMessage: String(e?.message ?? e),
        });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'تعذر إنشاء المهمة — حاول مرة أخرى' });
      }
    }),

  cancelProposal: protectedProcedure
    .input(z.object({ proposalId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      assertAiLicense();
      assertAiPerm(ctx.user, 'ai_use');
      const res = await db.update(aiActionProposals).set({
        status: 'cancelled', updatedAt: new Date(),
      }).where(and(
        eq(aiActionProposals.id, input.proposalId),
        eq(aiActionProposals.orgId, ctx.user.orgId),
        eq(aiActionProposals.userId, ctx.user.id),
        eq(aiActionProposals.status, 'pending'),
      )).returning({ id: aiActionProposals.id });
      if (!res.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'الاقتراح غير موجود أو تمت معالجته' });
      await auditAi({
        orgId: ctx.user.orgId, userId: ctx.user.id,
        operationType: 'cancel_action', proposed: true, confirmed: false,
      });
      return { success: true };
    }),
});

// ── تقنيع المفتاح للعرض فقط (sk-****abcd) ────────────────────────────────────
function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 3)}••••••••${key.slice(-4)}`;
}
