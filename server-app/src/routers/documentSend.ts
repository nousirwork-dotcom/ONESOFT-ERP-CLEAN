/**
 * documentSend.ts — الإرسال الإلكتروني للمستندات
 * يدعم: WhatsApp (wa.me) | Telegram (Bot API) | Email (Resend)
 */
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { documentSendLogs, sendSettings, organizations } from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';

/* ── قوالب الرسائل الافتراضية ────────────────────────────────────── */
const TPL_WA = `عزيزي {{customerName}}،
مرفق لكم {{docTypeName}} رقم {{docNumber}}
بمبلغ {{amount}} {{currency}}.

شكراً لتعاملكم معنا.`;

const TPL_TG = `عزيزي {{customerName}}،
مرفق لكم {{docTypeName}} رقم {{docNumber}}
بمبلغ {{amount}} {{currency}}.

شكراً لتعاملكم معنا.`;

const TPL_EMAIL_SUBJECT = `{{docTypeName}} رقم {{docNumber}} — {{sellerName}}`;

const TPL_EMAIL_BODY = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#406B93">{{sellerName}}</h2>
  <p>عزيزي {{customerName}}،</p>
  <p>نرفق لكم <strong>{{docTypeName}}</strong> رقم <strong>{{docNumber}}</strong>
     بمبلغ <strong>{{amount}} {{currency}}</strong>.</p>
  <p style="color:#555">شكراً لتعاملكم معنا.</p>
</div>`;

function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

type SendStatus = 'sent' | 'failed' | 'pending';

/* ── Input schemas ────────────────────────────────────────────────── */
const docInfoSchema = z.object({
  docType:     z.string(),
  docId:       z.number().optional(),
  docNumber:   z.string(),
  docTypeName: z.string(),
  amount:      z.string(),
  currency:    z.string().default('SAR'),
  customerName:z.string(),
  customMessage: z.string().optional(),
});

/* ══════════════════════════════════════════════════════════════════ */
export const documentSendRouter = router({

  /* ── إعدادات الإرسال ──────────────────────────────────────────── */
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const row = await db.query.sendSettings.findFirst({
      where: eq(sendSettings.orgId, ctx.user.orgId),
    });
    return row ?? {
      id: 0, orgId: ctx.user.orgId,
      whatsappEnabled: true, telegramEnabled: false, emailEnabled: false,
      telegramBotToken: null, emailProvider: 'resend' as const,
      emailApiKey: null, emailFromName: null, emailFromEmail: null,
      whatsappMessageTemplate: TPL_WA,
      telegramMessageTemplate: TPL_TG,
      emailSubjectTemplate: TPL_EMAIL_SUBJECT,
      emailBodyTemplate: TPL_EMAIL_BODY,
      createdAt: new Date(), updatedAt: new Date(),
    };
  }),

  updateSettings: protectedProcedure
    .input(z.object({
      whatsappEnabled:         z.boolean().optional(),
      telegramEnabled:         z.boolean().optional(),
      emailEnabled:            z.boolean().optional(),
      telegramBotToken:        z.string().nullable().optional(),
      emailProvider:           z.enum(['resend', 'smtp']).optional(),
      emailApiKey:             z.string().nullable().optional(),
      emailFromName:           z.string().nullable().optional(),
      emailFromEmail:          z.string().nullable().optional(),
      whatsappMessageTemplate: z.string().nullable().optional(),
      telegramMessageTemplate: z.string().nullable().optional(),
      emailSubjectTemplate:    z.string().nullable().optional(),
      emailBodyTemplate:       z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.sendSettings.findFirst({
        where: eq(sendSettings.orgId, ctx.user.orgId),
      });
      if (existing) {
        await db.update(sendSettings)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(sendSettings.orgId, ctx.user.orgId));
      } else {
        await db.insert(sendSettings).values({ orgId: ctx.user.orgId, ...input });
      }
      return { success: true };
    }),

  /* ── إرسال واتساب ─────────────────────────────────────────────── */
  sendWhatsApp: protectedProcedure
    .input(docInfoSchema.extend({
      customerPhone: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [cfg, org] = await Promise.all([
        db.query.sendSettings.findFirst({ where: eq(sendSettings.orgId, ctx.user.orgId) }),
        db.query.organizations.findFirst({ where: eq(organizations.id, ctx.user.orgId) }),
      ]);

      const tpl     = input.customMessage || cfg?.whatsappMessageTemplate || TPL_WA;
      const message = interpolate(tpl, {
        customerName: input.customerName, docTypeName: input.docTypeName,
        docNumber: input.docNumber, amount: input.amount,
        currency: input.currency, sellerName: org?.name ?? '',
      });

      // تحويل الرقم: 05xxxxxxxx → 9665xxxxxxxx
      let phone = input.customerPhone.replace(/[\s\-\(\)]/g, '');
      if (phone.startsWith('0')) phone = '966' + phone.slice(1);
      if (!phone.startsWith('+')) phone = phone.replace(/^\+/, '');
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

      await db.insert(documentSendLogs).values({
        orgId: ctx.user.orgId, docType: input.docType,
        docId: input.docId, docNumber: input.docNumber,
        method: 'whatsapp', status: 'sent',
        recipientName: input.customerName, recipientContact: input.customerPhone,
        messageSent: message, sentByUserId: ctx.user.id,
      });

      return { waUrl, message, status: 'sent' as SendStatus };
    }),

  /* ── إرسال تيليجرام ───────────────────────────────────────────── */
  sendTelegram: protectedProcedure
    .input(docInfoSchema.extend({
      telegramId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [cfg, org] = await Promise.all([
        db.query.sendSettings.findFirst({ where: eq(sendSettings.orgId, ctx.user.orgId) }),
        db.query.organizations.findFirst({ where: eq(organizations.id, ctx.user.orgId) }),
      ]);

      const tpl     = input.customMessage || cfg?.telegramMessageTemplate || TPL_TG;
      const message = interpolate(tpl, {
        customerName: input.customerName, docTypeName: input.docTypeName,
        docNumber: input.docNumber, amount: input.amount,
        currency: input.currency, sellerName: org?.name ?? '',
      });

      const botToken = cfg?.telegramBotToken;
      let status: SendStatus = 'pending';
      let errorMessage: string | undefined;
      let tgUrl: string | undefined;

      if (botToken) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: input.telegramId, text: message }),
          });
          const json = await res.json() as { ok: boolean; description?: string };
          status       = json.ok ? 'sent' : 'failed';
          errorMessage = json.ok ? undefined : json.description;
        } catch (e: any) {
          status = 'failed'; errorMessage = e.message;
        }
      } else {
        // بدون Bot — رابط فتح المحادثة (إن كان username)
        const tid = input.telegramId.trim();
        tgUrl  = tid.startsWith('@')
          ? `https://t.me/${tid.slice(1)}`
          : `https://t.me/${tid}`;
        status = 'pending';
      }

      await db.insert(documentSendLogs).values({
        orgId: ctx.user.orgId, docType: input.docType,
        docId: input.docId, docNumber: input.docNumber,
        method: 'telegram', status,
        recipientName: input.customerName, recipientContact: input.telegramId,
        messageSent: message, errorMessage,
        sentByUserId: ctx.user.id,
      });

      return { status, message, tgUrl, hasBotToken: !!botToken };
    }),

  /* ── إرسال بريد إلكتروني ──────────────────────────────────────── */
  sendEmail: protectedProcedure
    .input(docInfoSchema.extend({
      customerEmail:  z.string().email(),
      customSubject:  z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [cfg, org] = await Promise.all([
        db.query.sendSettings.findFirst({ where: eq(sendSettings.orgId, ctx.user.orgId) }),
        db.query.organizations.findFirst({ where: eq(organizations.id, ctx.user.orgId) }),
      ]);

      const vars = {
        customerName: input.customerName, docTypeName: input.docTypeName,
        docNumber: input.docNumber, amount: input.amount,
        currency: input.currency, sellerName: org?.name ?? '',
      };

      const subject = input.customSubject
        || interpolate(cfg?.emailSubjectTemplate || TPL_EMAIL_SUBJECT, vars);
      const bodyHtml = input.customMessage
        || interpolate(cfg?.emailBodyTemplate || TPL_EMAIL_BODY, vars);

      const apiKey    = cfg?.emailApiKey;
      const fromEmail = cfg?.emailFromEmail || 'noreply@onesoft.sa';
      const fromName  = cfg?.emailFromName  || org?.name || 'OneSoft ERP';
      let status: SendStatus = 'pending';
      let errorMessage: string | undefined;

      if (apiKey && cfg?.emailEnabled) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              from: `${fromName} <${fromEmail}>`,
              to:   input.customerEmail,
              subject,
              html: bodyHtml,
            }),
          });
          const json = await res.json() as { id?: string; message?: string };
          status       = res.ok ? 'sent' : 'failed';
          errorMessage = res.ok ? undefined : (json.message || `HTTP ${res.status}`);
        } catch (e: any) {
          status = 'failed'; errorMessage = e.message;
        }
      } else {
        status       = 'pending';
        errorMessage = 'لم يتم تهيئة خدمة البريد الإلكتروني';
      }

      await db.insert(documentSendLogs).values({
        orgId: ctx.user.orgId, docType: input.docType,
        docId: input.docId, docNumber: input.docNumber,
        method: 'email', status,
        recipientName: input.customerName, recipientContact: input.customerEmail,
        messageSent: `${subject}\n\n${bodyHtml}`,
        errorMessage, sentByUserId: ctx.user.id,
      });

      return { status, subject, emailEnabled: !!apiKey };
    }),

  /* ── سجل الإرسال ──────────────────────────────────────────────── */
  getLogs: protectedProcedure
    .input(z.object({
      docType: z.string().optional(),
      docId:   z.number().optional(),
      limit:   z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const where = [eq(documentSendLogs.orgId, ctx.user.orgId)];
      if (input.docType) where.push(eq(documentSendLogs.docType, input.docType));
      if (input.docId !== undefined) where.push(eq(documentSendLogs.docId, input.docId));
      return db.select()
        .from(documentSendLogs)
        .where(and(...where))
        .orderBy(desc(documentSendLogs.sentAt))
        .limit(input.limit);
    }),
});
