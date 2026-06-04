/**
 * documentSend.ts — الإرسال الإلكتروني للمستندات
 * يدعم: WhatsApp (wa.me + Business API) | Telegram (Bot API) | Email (Resend)
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
      wabaEnabled: false, wabaApiUrl: null, wabaAccessToken: null,
      wabaPhoneNumberId: null, wabaSenderName: null,
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
      wabaEnabled:             z.boolean().optional(),
      wabaApiUrl:              z.string().nullable().optional(),
      wabaAccessToken:         z.string().nullable().optional(),
      wabaPhoneNumberId:       z.string().nullable().optional(),
      wabaSenderName:          z.string().nullable().optional(),
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

  /* ── اختبار اتصال WhatsApp Business API ──────────────────────── */
  testWabaConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const cfg = await db.query.sendSettings.findFirst({
      where: eq(sendSettings.orgId, ctx.user.orgId),
    });
    if (!cfg?.wabaApiUrl || !cfg?.wabaAccessToken || !cfg?.wabaPhoneNumberId) {
      return { success: false, message: 'لم يتم إدخال بيانات الاتصال كاملة (API URL، Access Token، Phone Number ID)' };
    }
    try {
      const url = `${cfg.wabaApiUrl.replace(/\/$/, '')}/${cfg.wabaPhoneNumberId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${cfg.wabaAccessToken}` },
      });
      const json = await res.json() as { id?: string; display_phone_number?: string; error?: { message?: string } };
      if (res.ok && json.id) {
        return { success: true, message: `✓ الاتصال ناجح — رقم الهاتف: ${json.display_phone_number ?? cfg.wabaPhoneNumberId}` };
      }
      return { success: false, message: json.error?.message || `فشل الاتصال (HTTP ${res.status})` };
    } catch (e: any) {
      return { success: false, message: e.message || 'خطأ في الشبكة' };
    }
  }),

  /* ── اختبار اتصال Telegram Bot ───────────────────────────────── */
  testTelegramConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const cfg = await db.query.sendSettings.findFirst({
      where: eq(sendSettings.orgId, ctx.user.orgId),
    });
    if (!cfg?.telegramBotToken) {
      return { success: false, message: 'لم يتم إدخال Bot Token' };
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${cfg.telegramBotToken}/getMe`);
      const json = await res.json() as { ok: boolean; result?: { username?: string; first_name?: string }; description?: string };
      if (json.ok && json.result) {
        return { success: true, message: `✓ اتصال ناجح — البوت: @${json.result.username ?? json.result.first_name}` };
      }
      return { success: false, message: json.description || 'فشل التحقق من البوت' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
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

      let phone = input.customerPhone.replace(/[\s\-\(\)]/g, '');
      if (phone.startsWith('0')) phone = '966' + phone.slice(1);
      if (!phone.startsWith('+')) phone = phone.replace(/^\+/, '');
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

      let status: SendStatus = 'sent';
      let errorMessage: string | undefined;

      // إذا كان WhatsApp Business API مُفعَّلاً — استخدمه بدل wa.me
      if (cfg?.wabaEnabled && cfg?.wabaApiUrl && cfg?.wabaAccessToken && cfg?.wabaPhoneNumberId) {
        try {
          const url = `${cfg.wabaApiUrl.replace(/\/$/, '')}/${cfg.wabaPhoneNumberId}/messages`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${cfg.wabaAccessToken}`,
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: phone,
              type: 'text',
              text: { body: message },
            }),
          });
          const json = await res.json() as { messages?: { id: string }[]; error?: { message?: string } };
          status = res.ok ? 'sent' : 'failed';
          errorMessage = res.ok ? undefined : (json.error?.message || `HTTP ${res.status}`);
        } catch (e: any) {
          status = 'failed'; errorMessage = e.message;
        }
      }

      await db.insert(documentSendLogs).values({
        orgId: ctx.user.orgId, docType: input.docType,
        docId: input.docId, docNumber: input.docNumber,
        method: 'whatsapp', status,
        recipientName: input.customerName, recipientContact: input.customerPhone,
        messageSent: message, errorMessage, sentByUserId: ctx.user.id,
      });

      return { waUrl, message, status };
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
        const tid = input.telegramId.trim();
        tgUrl  = tid.startsWith('@') ? `https://t.me/${tid.slice(1)}` : `https://t.me/${tid}`;
        status = 'pending';
      }

      await db.insert(documentSendLogs).values({
        orgId: ctx.user.orgId, docType: input.docType,
        docId: input.docId, docNumber: input.docNumber,
        method: 'telegram', status,
        recipientName: input.customerName, recipientContact: input.telegramId,
        messageSent: message, errorMessage, sentByUserId: ctx.user.id,
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

      const subject  = input.customSubject || interpolate(cfg?.emailSubjectTemplate || TPL_EMAIL_SUBJECT, vars);
      const bodyHtml = input.customMessage  || interpolate(cfg?.emailBodyTemplate    || TPL_EMAIL_BODY,    vars);

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

  /* ── سجل إرسال كامل (للوحة الإدارة) ─────────────────────────── */
  getAllLogs: protectedProcedure
    .input(z.object({ limit: z.number().default(100) }))
    .query(async ({ ctx, input }) => {
      return db.select()
        .from(documentSendLogs)
        .where(eq(documentSendLogs.orgId, ctx.user.orgId))
        .orderBy(desc(documentSendLogs.sentAt))
        .limit(input.limit);
    }),
});
