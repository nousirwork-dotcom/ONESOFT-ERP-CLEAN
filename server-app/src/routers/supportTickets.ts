import { z } from 'zod';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import {
  supportTicketsLocal, supportTicketMessagesLocal,
  lcSupportTickets, lcSupportTicketMessages,
  organizations, users,
} from '../schema.js';

// ─── مولِّد رقم التذكرة ────────────────────────────────────────────────────────
async function genTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db.execute(sql`SELECT nextval('support_ticket_seq') AS n`);
  const row = (result as any).rows?.[0] ?? (result as any)[0] ?? {};
  const n = Number(row.n ?? 1);
  return `SUP-${year}-${String(n).padStart(6, '0')}`;
}

// ─── صلاحية الدعم الفني ────────────────────────────────────────────────────────
function assertSupportPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  const hasPerm = user.extraPermissions?.['hs_support'] === true;
  if (!isAdmin && !hasPerm) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية الوصول إلى الدعم الفني' });
  }
}

function canManageAll(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  return ['admin', 'superadmin'].includes(user.role)
    || user.extraPermissions?.['hs_support_manage'] === true;
}

// ─── مزامنة الرد إلى جانب LC (في نفس قاعدة البيانات) ─────────────────────────
async function syncReplyToLc(ticketRef: string, senderName: string, body: string) {
  try {
    const [lcTicket] = await db.select().from(lcSupportTickets)
      .where(eq(lcSupportTickets.ticketNumber, ticketRef));
    if (!lcTicket) return;
    await db.insert(lcSupportTicketMessages).values({
      ticketId:   lcTicket.id,
      senderType: 'client',
      senderName,
      body,
      isReadBySupport: false,
      isReadByClient:  true,
    });
    await db.update(lcSupportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(lcSupportTickets.id, lcTicket.id));
  } catch (e) {
    console.warn('[SupportTickets] syncReplyToLc failed:', e);
  }
}

// ─── سحب الردود الجديدة من LC ──────────────────────────────────────────────────
async function pullRepliesFromLc(ticketId: number, ticketRef: string) {
  try {
    const [lcTicket] = await db.select().from(lcSupportTickets)
      .where(eq(lcSupportTickets.ticketNumber, ticketRef));
    if (!lcTicket) return 0;

    const lcMessages = await db.select().from(lcSupportTicketMessages)
      .where(and(
        eq(lcSupportTicketMessages.ticketId, lcTicket.id),
        eq(lcSupportTicketMessages.senderType, 'support'),
        eq(lcSupportTicketMessages.isReadByClient, false),
      ));

    for (const msg of lcMessages) {
      const existing = await db.select().from(supportTicketMessagesLocal)
        .where(and(
          eq(supportTicketMessagesLocal.ticketId, ticketId),
          eq(supportTicketMessagesLocal.lcMsgRef, String(msg.id)),
        ));
      if (existing.length) continue;

      await db.insert(supportTicketMessagesLocal).values({
        ticketId,
        senderType: 'support',
        senderName: msg.senderName ?? 'فريق الدعم',
        body:       msg.body,
        isRead:     false,
        sentAt:     msg.createdAt,
        lcMsgRef:   String(msg.id),
      });

      await db.update(lcSupportTicketMessages)
        .set({ isReadByClient: true })
        .where(eq(lcSupportTicketMessages.id, msg.id));
    }

    if (lcTicket.status !== 'open' && lcTicket.status !== 'in_progress') {
      const newStatus = lcTicket.status === 'resolved' ? 'resolved' : 'closed';
      await db.update(supportTicketsLocal)
        .set({ status: newStatus, resolvedAt: lcTicket.resolvedAt ?? undefined, updatedAt: new Date() })
        .where(eq(supportTicketsLocal.id, ticketId));
    }

    return lcMessages.length;
  } catch (e) {
    console.warn('[SupportTickets] pullRepliesFromLc failed:', e);
    return 0;
  }
}

// ─── Router ────────────────────────────────────────────────────────────────────
export const supportTicketsRouter = router({

  // ── إنشاء مسودة ─────────────────────────────────────────────────────────────
  createDraft: protectedProcedure
    .input(z.object({
      subject:     z.string().min(5, 'الموضوع يجب أن يكون 5 أحرف على الأقل').max(500),
      description: z.string().min(10, 'الوصف يجب أن يكون 10 أحرف على الأقل'),
      category:    z.enum(['general', 'technical', 'billing', 'feature', 'urgent']).default('general'),
      priority:    z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    }))
    .mutation(async ({ ctx, input }) => {
      assertSupportPerm(ctx.user);
      const ticketNumber = await genTicketNumber();

      const [org] = await db.select({ name: organizations.name })
        .from(organizations).where(eq(organizations.id, ctx.user.orgId));

      const sourceInfo = {
        orgId:   ctx.user.orgId,
        orgName: org?.name ?? '',
        userId:  ctx.user.id,
        userName: ctx.user.name ?? ctx.user.username,
      };

      const [ticket] = await db.insert(supportTicketsLocal).values({
        ticketNumber,
        orgId:           ctx.user.orgId,
        createdByUserId: ctx.user.id,
        subject:         input.subject,
        description:     input.description,
        category:        input.category,
        priority:        input.priority,
        status:          'draft',
        sourceInfo,
      }).returning();

      return ticket;
    }),

  // ── تقديم / إرسال التذكرة ────────────────────────────────────────────────────
  submitTicket: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertSupportPerm(ctx.user);

      const [ticket] = await db.select().from(supportTicketsLocal)
        .where(and(
          eq(supportTicketsLocal.id, input.ticketId),
          eq(supportTicketsLocal.orgId, ctx.user.orgId),
        ));
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'التذكرة غير موجودة' });
      if (ticket.status !== 'draft')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'التذكرة مُرسَلة بالفعل' });

      const now = new Date();

      // ── تسجيل في جانب LC (نفس قاعدة البيانات) ──────────────────────────────
      // lcTicketRef يبقى null حتى يتم إدراج LC بنجاح؛ retryOutbox يعيد المحاولة عند null
      let lcTicketRef: string | null = null;
      try {
        const srcInfo = (ticket.sourceInfo ?? {}) as Record<string, any>;
        const [lcRow] = await db.insert(lcSupportTickets).values({
          ticketNumber:   ticket.ticketNumber,
          orgId:          String(srcInfo.orgId ?? ctx.user.orgId),
          orgName:        String(srcInfo.orgName ?? ''),
          subject:        ticket.subject,
          description:    ticket.description,
          category:       ticket.category,
          priority:       ticket.priority,
          status:         'open',
          submitterName:  ctx.user.name ?? ctx.user.username,
          submitterEmail: '',
          sourceInfo:     ticket.sourceInfo ?? {},
        }).returning();
        lcTicketRef = lcRow.ticketNumber;

        await db.insert(lcSupportTicketMessages).values({
          ticketId:        lcRow.id,
          senderType:      'client',
          senderName:      ctx.user.name ?? ctx.user.username,
          body:            ticket.description,
          isReadBySupport: false,
          isReadByClient:  true,
        });
      } catch (e) {
        console.error('[SupportTickets] LC insert failed — will retry later:', e);
      }

      const [updated] = await db.update(supportTicketsLocal)
        .set({
          status:      'submitted',
          submittedAt: now,
          lcTicketRef,
          updatedAt:   now,
        })
        .where(eq(supportTicketsLocal.id, input.ticketId))
        .returning();

      return updated;
    }),

  // ── قائمة تذاكر المستخدم ─────────────────────────────────────────────────────
  listMyTickets: protectedProcedure
    .input(z.object({ includeAll: z.boolean().default(false) }).optional())
    .query(async ({ ctx, input }) => {
      assertSupportPerm(ctx.user);
      const all = input?.includeAll && canManageAll(ctx.user);

      const rows = await db.select().from(supportTicketsLocal)
        .where(
          all
            ? eq(supportTicketsLocal.orgId, ctx.user.orgId)
            : and(
                eq(supportTicketsLocal.orgId, ctx.user.orgId),
                eq(supportTicketsLocal.createdByUserId, ctx.user.id),
              )
        )
        .orderBy(desc(supportTicketsLocal.updatedAt));

      return rows;
    }),

  // ── تفاصيل تذكرة واحدة ───────────────────────────────────────────────────────
  getTicket: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .query(async ({ ctx, input }) => {
      assertSupportPerm(ctx.user);

      const [ticket] = await db.select().from(supportTicketsLocal)
        .where(and(
          eq(supportTicketsLocal.id, input.ticketId),
          eq(supportTicketsLocal.orgId, ctx.user.orgId),
        ));
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'التذكرة غير موجودة' });

      if (ticket.lcTicketRef && ['submitted', 'open', 'in_progress'].includes(ticket.status)) {
        await pullRepliesFromLc(ticket.id, ticket.lcTicketRef);
        const [fresh] = await db.select().from(supportTicketsLocal)
          .where(eq(supportTicketsLocal.id, ticket.id));
        Object.assign(ticket, fresh);
      }

      const messages = await db.select().from(supportTicketMessagesLocal)
        .where(eq(supportTicketMessagesLocal.ticketId, ticket.id))
        .orderBy(supportTicketMessagesLocal.sentAt);

      await db.update(supportTicketsLocal)
        .set({ unreadReplies: 0 })
        .where(eq(supportTicketsLocal.id, ticket.id));

      await db.update(supportTicketMessagesLocal)
        .set({ isRead: true })
        .where(and(
          eq(supportTicketMessagesLocal.ticketId, ticket.id),
          eq(supportTicketMessagesLocal.isRead, false),
        ));

      return { ticket, messages };
    }),

  // ── إضافة رد ─────────────────────────────────────────────────────────────────
  addReply: protectedProcedure
    .input(z.object({
      ticketId: z.number(),
      body:     z.string().min(1, 'لا يمكن إرسال رد فارغ').max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      assertSupportPerm(ctx.user);

      const [ticket] = await db.select().from(supportTicketsLocal)
        .where(and(
          eq(supportTicketsLocal.id, input.ticketId),
          eq(supportTicketsLocal.orgId, ctx.user.orgId),
        ));
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'التذكرة غير موجودة' });
      if (['resolved', 'closed', 'cancelled'].includes(ticket.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن الرد على تذكرة مغلقة أو ملغاة' });
      }

      const senderName = ctx.user.name ?? ctx.user.username;
      const now = new Date();

      const [msg] = await db.insert(supportTicketMessagesLocal).values({
        ticketId:   ticket.id,
        senderType: 'user',
        senderName,
        body:       input.body,
        isRead:     true,
        sentAt:     now,
      }).returning();

      await db.update(supportTicketsLocal)
        .set({ lastReplyAt: now, updatedAt: now })
        .where(eq(supportTicketsLocal.id, ticket.id));

      if (ticket.lcTicketRef) {
        await syncReplyToLc(ticket.lcTicketRef, senderName, input.body);
      }

      return msg;
    }),

  // ── إلغاء التذكرة ────────────────────────────────────────────────────────────
  cancelTicket: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertSupportPerm(ctx.user);

      const [ticket] = await db.select().from(supportTicketsLocal)
        .where(and(
          eq(supportTicketsLocal.id, input.ticketId),
          eq(supportTicketsLocal.orgId, ctx.user.orgId),
          eq(supportTicketsLocal.createdByUserId, ctx.user.id),
        ));
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'التذكرة غير موجودة' });
      if (['resolved', 'closed', 'cancelled'].includes(ticket.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'التذكرة مغلقة بالفعل' });
      }

      const now = new Date();
      const [updated] = await db.update(supportTicketsLocal)
        .set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
        .where(eq(supportTicketsLocal.id, input.ticketId))
        .returning();

      return updated;
    }),

  // ── تقييم الخدمة ──────────────────────────────────────────────────────────────
  rateTicket: protectedProcedure
    .input(z.object({
      ticketId: z.number(),
      rating:   z.number().int().min(1).max(5),
      comment:  z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertSupportPerm(ctx.user);

      const [ticket] = await db.select().from(supportTicketsLocal)
        .where(and(
          eq(supportTicketsLocal.id, input.ticketId),
          eq(supportTicketsLocal.orgId, ctx.user.orgId),
          eq(supportTicketsLocal.createdByUserId, ctx.user.id),
        ));
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'التذكرة غير موجودة' });
      if (!['resolved', 'closed'].includes(ticket.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'التقييم متاح فقط للتذاكر المحلولة أو المغلقة' });
      }
      if (ticket.rating !== null) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'تم التقييم مسبقًا' });
      }

      const now = new Date();
      const [updated] = await db.update(supportTicketsLocal)
        .set({
          rating:        input.rating,
          ratingComment: input.comment,
          ratedAt:       now,
          updatedAt:     now,
        })
        .where(eq(supportTicketsLocal.id, input.ticketId))
        .returning();

      return updated;
    }),

  // ── استطلاع الردود الجديدة (polling) ─────────────────────────────────────────
  pollReplies: protectedProcedure
    .query(async ({ ctx }) => {
      const tickets = await db.select().from(supportTicketsLocal)
        .where(and(
          eq(supportTicketsLocal.orgId, ctx.user.orgId),
          eq(supportTicketsLocal.createdByUserId, ctx.user.id),
        ));

      let totalNew = 0;
      for (const t of tickets) {
        if (t.lcTicketRef && ['submitted', 'open', 'in_progress'].includes(t.status)) {
          const pulled = await pullRepliesFromLc(t.id, t.lcTicketRef);
          if (pulled > 0) {
            const now = new Date();
            await db.update(supportTicketsLocal)
              .set({
                unreadReplies: (t.unreadReplies ?? 0) + pulled,
                lastReplyAt:   now,
                updatedAt:     now,
              })
              .where(eq(supportTicketsLocal.id, t.id));
            totalNew += pulled;
          }
        }
      }

      const unreadSum = await db.select({ total: sql<number>`COALESCE(SUM(unread_replies), 0)` })
        .from(supportTicketsLocal)
        .where(and(
          eq(supportTicketsLocal.orgId, ctx.user.orgId),
          eq(supportTicketsLocal.createdByUserId, ctx.user.id),
        ));

      return { newReplies: totalNew, totalUnread: Number(unreadSum[0]?.total ?? 0) };
    }),

  // ── إعادة محاولة الإرسال (outbox retry) ──────────────────────────────────────
  retryOutbox: protectedProcedure
    .mutation(async ({ ctx }) => {
      assertSupportPerm(ctx.user);

      const pending = await db.select().from(supportTicketsLocal)
        .where(and(
          eq(supportTicketsLocal.orgId, ctx.user.orgId),
          eq(supportTicketsLocal.status, 'submitted'),
        ))
        .orderBy(supportTicketsLocal.submittedAt);

      let retried = 0;
      for (const ticket of pending) {
        if (ticket.lcTicketRef) continue;
        try {
          const srcInfo = (ticket.sourceInfo ?? {}) as Record<string, any>;
          const [lcRow] = await db.insert(lcSupportTickets).values({
            ticketNumber:   ticket.ticketNumber,
            orgId:          String(srcInfo.orgId ?? ctx.user.orgId),
            orgName:        String(srcInfo.orgName ?? ''),
            subject:        ticket.subject,
            description:    ticket.description,
            category:       ticket.category,
            priority:       ticket.priority,
            status:         'open',
            submitterName:  ctx.user.name ?? ctx.user.username,
            submitterEmail: '',
            sourceInfo:     ticket.sourceInfo ?? {},
          }).returning();

          await db.update(supportTicketsLocal)
            .set({ lcTicketRef: lcRow.ticketNumber, updatedAt: new Date() })
            .where(eq(supportTicketsLocal.id, ticket.id));

          retried++;
        } catch { /* continue */ }
      }

      return { retried };
    }),

  // ── تقرير التشخيص ────────────────────────────────────────────────────────────
  getDiagnosticReport: protectedProcedure
    .query(async ({ ctx }) => {
      const [org] = await db.select({ name: organizations.name })
        .from(organizations).where(eq(organizations.id, ctx.user.orgId));

      return {
        orgId:     ctx.user.orgId,
        orgName:   org?.name ?? '',
        userId:    ctx.user.id,
        userName:  ctx.user.name ?? ctx.user.username,
        role:      ctx.user.role,
        timestamp: new Date().toISOString(),
        platform:  process.platform,
        nodeVer:   process.version,
      };
    }),
});
