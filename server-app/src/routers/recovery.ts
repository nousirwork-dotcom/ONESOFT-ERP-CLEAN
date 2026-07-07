import { z } from 'zod';
import { router, adminProcedure, publicProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { db } from '../db.js';
import {
  users,
  verificationTokens,
  passwordResetTokens,
  securityEvents,
} from '../schema.js';
import { and, eq, gt, isNull, or, count, desc } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../auth.js';
import { randomInt, randomUUID } from 'crypto';

const IS_DEV = process.env.NODE_ENV !== 'production';
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_OTP_SENDS_PER_15MIN = 3;
const MAX_OTP_ATTEMPTS = 5;

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

async function logEvent(data: {
  eventType: string;
  userId?: number | null;
  username?: string | null;
  phone?: string | null;
  email?: string | null;
  orgId?: number | null;
  result: 'success' | 'failed';
  reason?: string | null;
  ip?: string | null;
}) {
  try {
    await db.insert(securityEvents).values({
      eventType: data.eventType,
      userId:    data.userId    ?? null,
      username:  data.username  ?? null,
      phone:     data.phone     ?? null,
      email:     data.email     ?? null,
      orgId:     data.orgId     ?? null,
      result:    data.result,
      reason:    data.reason    ?? null,
      ip:        data.ip        ?? null,
    });
  } catch { /* don't let audit failure break the operation */ }
}

function mockSend(channel: 'phone' | 'email', target: string, otp: string, purpose: string) {
  if (IS_DEV) {
    console.log(`\n[OTP-MOCK] ═══════════════════════════════════`);
    console.log(`[OTP-MOCK] Channel : ${channel.toUpperCase()}`);
    console.log(`[OTP-MOCK] Target  : ${target}`);
    console.log(`[OTP-MOCK] Purpose : ${purpose}`);
    console.log(`[OTP-MOCK] CODE    : ${otp}`);
    console.log(`[OTP-MOCK] ═══════════════════════════════════\n`);
  }
}

export const recoveryRouter = router({

  // ── إرسال كود تحقق (المسؤول → جوال/بريد المستخدم) ──────────────────────────
  sendVerification: adminProcedure
    .input(z.object({
      userId:  z.number(),
      channel: z.enum(['phone', 'email']),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.query.users.findFirst({
        where: and(
          eq(users.id, input.userId),
          eq(users.orgId, ctx.user.orgId),
          eq(users.isActive, true),
        ),
      });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'المستخدم غير موجود' });

      const target = input.channel === 'phone' ? user.phone : user.email;
      if (!target) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: input.channel === 'phone'
            ? 'لا يوجد رقم جوال مسجل لهذا المستخدم'
            : 'لا يوجد بريد إلكتروني مسجل لهذا المستخدم',
        });
      }

      // Rate limit: max 3 sends per 15 min
      const since15 = new Date(Date.now() - 15 * 60 * 1000);
      const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(securityEvents)
        .where(and(
          eq(securityEvents.userId, input.userId),
          eq(securityEvents.eventType, `verify_${input.channel}_sent`),
          gt(securityEvents.createdAt, since15),
        ));
      if (Number(cnt) >= MAX_OTP_SENDS_PER_15MIN) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'تم تجاوز عدد طلبات الإرسال. يرجى الانتظار 15 دقيقة.' });
      }

      const otp = generateOtp();
      const otpHash = await hashPassword(otp);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

      // Invalidate previous tokens for same user+channel
      await db.update(verificationTokens)
        .set({ usedAt: new Date() })
        .where(and(
          eq(verificationTokens.userId, input.userId),
          eq(verificationTokens.targetType, input.channel),
          isNull(verificationTokens.usedAt),
        ));

      await db.insert(verificationTokens).values({
        userId:      input.userId,
        targetType:  input.channel,
        targetValue: target,
        otpHash,
        expiresAt,
      });

      mockSend(input.channel, target, otp, 'التحقق من الهوية');

      await logEvent({
        eventType: `verify_${input.channel}_sent`,
        userId: input.userId, username: user.username,
        phone: input.channel === 'phone' ? target : null,
        email: input.channel === 'email' ? target : null,
        orgId: ctx.user.orgId, result: 'success',
      });

      return { sent: true, ...(IS_DEV ? { devOtp: otp } : {}) };
    }),

  // ── تأكيد كود التحقق ─────────────────────────────────────────────────────────
  confirmVerification: adminProcedure
    .input(z.object({
      userId:  z.number(),
      channel: z.enum(['phone', 'email']),
      otp:     z.string().min(4).max(8),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.query.users.findFirst({
        where: and(eq(users.id, input.userId), eq(users.orgId, ctx.user.orgId)),
      });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'المستخدم غير موجود' });

      const [token] = await db
        .select()
        .from(verificationTokens)
        .where(and(
          eq(verificationTokens.userId, input.userId),
          eq(verificationTokens.targetType, input.channel),
          isNull(verificationTokens.usedAt),
          gt(verificationTokens.expiresAt, new Date()),
        ))
        .orderBy(desc(verificationTokens.createdAt))
        .limit(1);

      if (!token) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'كود التحقق غير صحيح أو منتهي الصلاحية.' });
      }

      if (token.attemptsCount >= MAX_OTP_ATTEMPTS) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'تم تجاوز عدد المحاولات. يرجى إعادة إرسال الكود.' });
      }

      const valid = await verifyPassword(input.otp, token.otpHash);
      if (!valid) {
        await db.update(verificationTokens)
          .set({ attemptsCount: token.attemptsCount + 1 })
          .where(eq(verificationTokens.id, token.id));
        await logEvent({ eventType: `verify_${input.channel}_failed`, userId: input.userId, username: user.username, orgId: ctx.user.orgId, result: 'failed', reason: 'wrong_otp' });
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'كود التحقق غير صحيح أو منتهي الصلاحية.' });
      }

      // Mark token used
      await db.update(verificationTokens).set({ usedAt: new Date() }).where(eq(verificationTokens.id, token.id));

      // Update verified timestamp
      const updateFields = input.channel === 'phone'
        ? { phoneVerifiedAt: new Date() }
        : { emailVerifiedAt: new Date() };
      await db.update(users).set({ ...updateFields, updatedAt: new Date() }).where(eq(users.id, input.userId));

      await logEvent({ eventType: `verify_${input.channel}_success`, userId: input.userId, username: user.username, orgId: ctx.user.orgId, result: 'success' });

      return { verified: true };
    }),

  // ── إعدادات الاستعادة (المسؤول) ──────────────────────────────────────────────
  setRecoveryOptions: adminProcedure
    .input(z.object({
      userId:               z.number(),
      recoveryEnabledPhone: z.boolean().optional(),
      recoveryEnabledEmail: z.boolean().optional(),
      forcePasswordChange:  z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { userId, ...opts } = input;
      const user = await db.query.users.findFirst({
        where: and(eq(users.id, userId), eq(users.orgId, ctx.user.orgId)),
      });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'المستخدم غير موجود' });

      if (opts.recoveryEnabledPhone === true && !user.phoneVerifiedAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'يجب التحقق من رقم الجوال أولاً لتفعيل الاستعادة عبر الجوال' });
      }
      if (opts.recoveryEnabledEmail === true && !user.emailVerifiedAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'يجب التحقق من البريد الإلكتروني أولاً لتفعيل الاستعادة عبره' });
      }

      await db.update(users).set({
        ...(opts.recoveryEnabledPhone !== undefined ? { recoveryEnabledPhone: opts.recoveryEnabledPhone } : {}),
        ...(opts.recoveryEnabledEmail !== undefined ? { recoveryEnabledEmail: opts.recoveryEnabledEmail } : {}),
        ...(opts.forcePasswordChange  !== undefined ? { forcePasswordChange:  opts.forcePasswordChange  } : {}),
        updatedAt: new Date(),
      }).where(eq(users.id, userId));

      return { success: true };
    }),

  // ── طلب استعادة كلمة المرور (عام — من شاشة الدخول) ─────────────────────────
  requestPasswordReset: publicProcedure
    .input(z.object({
      identifier: z.string().min(1),
      channel:    z.enum(['phone', 'email']),
    }))
    .mutation(async ({ input }) => {
      const GENERIC = 'إذا كانت البيانات صحيحة، سيتم إرسال كود الاستعادة.';

      const user = await db.query.users.findFirst({
        where: (u) => and(
          eq(u.isActive, true),
          or(
            eq(u.username, input.identifier),
            eq(u.phone,    input.identifier),
            eq(u.email,    input.identifier),
          ),
        ),
      });

      if (!user) {
        await logEvent({ eventType: 'password_reset_request', result: 'failed', reason: 'user_not_found', username: input.identifier });
        return { message: GENERIC };
      }

      const target     = input.channel === 'phone' ? user.phone    : user.email;
      const isEnabled  = input.channel === 'phone' ? user.recoveryEnabledPhone : user.recoveryEnabledEmail;
      const isVerified = input.channel === 'phone' ? user.phoneVerifiedAt      : user.emailVerifiedAt;

      if (!target || !isEnabled || !isVerified) {
        await logEvent({ eventType: 'password_reset_request', userId: user.id, username: user.username, result: 'failed', reason: 'channel_not_available' });
        return { message: GENERIC };
      }

      // Rate limit: max 3 requests per 15 min
      const since15 = new Date(Date.now() - 15 * 60 * 1000);
      const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(securityEvents)
        .where(and(
          eq(securityEvents.userId, user.id),
          eq(securityEvents.eventType, 'password_reset_otp_sent'),
          gt(securityEvents.createdAt, since15),
        ));
      if (Number(cnt) >= MAX_OTP_SENDS_PER_15MIN) {
        return { message: GENERIC }; // silent rate limit
      }

      // Invalidate old tokens
      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(
          eq(passwordResetTokens.userId, user.id),
          eq(passwordResetTokens.channel, input.channel),
          isNull(passwordResetTokens.usedAt),
        ));

      const otp        = generateOtp();
      const otpHash    = await hashPassword(otp);
      const resetToken = randomUUID();
      const expiresAt  = new Date(Date.now() + OTP_EXPIRY_MS);

      await db.insert(passwordResetTokens).values({
        userId:  user.id,
        channel: input.channel,
        otpHash,
        resetToken,
        expiresAt,
      });

      mockSend(input.channel, target, otp, 'استعادة كلمة المرور');

      await logEvent({
        eventType: 'password_reset_otp_sent',
        userId: user.id, username: user.username,
        phone: input.channel === 'phone' ? target : null,
        email: input.channel === 'email' ? target : null,
        result: 'success',
      });

      return {
        message:    GENERIC,
        resetToken,
        ...(IS_DEV ? { devOtp: otp } : {}),
      };
    }),

  // ── إعادة تعيين كلمة المرور بالكود ──────────────────────────────────────────
  resetPassword: publicProcedure
    .input(z.object({
      resetToken:  z.string(),
      otp:         z.string().min(4).max(8),
      newPassword: z.string().min(6),
    }))
    .mutation(async ({ input }) => {
      const [token] = await db
        .select()
        .from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.resetToken, input.resetToken),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ))
        .limit(1);

      if (!token) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'كود التحقق غير صحيح أو منتهي الصلاحية.' });
      }

      if (token.attemptsCount >= MAX_OTP_ATTEMPTS) {
        await logEvent({ eventType: 'password_reset_verify', userId: token.userId, result: 'failed', reason: 'max_attempts' });
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'تم تجاوز عدد المحاولات المسموح. يرجى طلب كود جديد.' });
      }

      const valid = await verifyPassword(input.otp, token.otpHash);
      if (!valid) {
        await db.update(passwordResetTokens)
          .set({ attemptsCount: token.attemptsCount + 1 })
          .where(eq(passwordResetTokens.id, token.id));
        await logEvent({ eventType: 'password_reset_verify', userId: token.userId, result: 'failed', reason: 'wrong_otp' });
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'كود التحقق غير صحيح أو منتهي الصلاحية.' });
      }

      // Mark token used
      await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, token.id));

      // Change password
      const passwordHash = await hashPassword(input.newPassword);
      await db.update(users).set({
        passwordHash,
        passwordChangedAt:   new Date(),
        forcePasswordChange: false,
        updatedAt:           new Date(),
      }).where(eq(users.id, token.userId));

      await logEvent({ eventType: 'password_reset_success', userId: token.userId, result: 'success' });

      return { success: true };
    }),
});
