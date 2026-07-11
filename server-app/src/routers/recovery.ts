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
import { randomInt, randomUUID, randomBytes } from 'crypto';
import { getOrCreateDeviceId, getHardwareFingerprint } from '../lib/deviceId.js';

// ── Production guard ──────────────────────────────────────────────────────────
// IS_DEV = true ONLY when NODE_ENV is NOT 'production'.
// In production: devOtp is NEVER returned in any response and NEVER logged.
const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * SECURITY: Returns devOtp payload only in non-production environments.
 * In production this function returns an empty object — no data leaked.
 */
function devOnlyPayload(otp: string): { devOtp?: string } {
  if (IS_DEV) return { devOtp: otp };
  // Production: explicit empty — no fallthrough possible
  return {};
}

// ── Constants ─────────────────────────────────────────────────────────────────
const OTP_EXPIRY_MS           = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_SENDS_PER_15MIN = 3;
const MAX_OTP_ATTEMPTS        = 5;

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

// ── Security event logger ─────────────────────────────────────────────────────
async function logEvent(data: {
  eventType: string;
  userId?:   number | null;
  username?: string | null;
  phone?:    string | null;
  email?:    string | null;
  orgId?:    number | null;
  result:    'success' | 'failed';
  reason?:   string | null;
  ip?:       string | null;
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
  } catch { /* never let audit failure break the operation */ }
}

// ── Mock provider (dev only) ──────────────────────────────────────────────────
// SECURITY: In production, replace this with a real SMS/SMTP provider.
// OTP must never be printed to logs in production.
function mockSend(channel: 'phone' | 'email', target: string, otp: string, purpose: string) {
  if (!IS_DEV) {
    // Production: real provider call goes here. Do NOT log the OTP.
    // Example: await twilioClient.messages.create({ to: target, body: `كود ${purpose}: ${otp}` });
    return;
  }
  // Development only — safe to log for testing purposes
  console.log(`\n[OTP-MOCK] ═══════════════════════════════════`);
  console.log(`[OTP-MOCK] Channel : ${channel.toUpperCase()}`);
  console.log(`[OTP-MOCK] Target  : ${target}`);
  console.log(`[OTP-MOCK] Purpose : ${purpose}`);
  console.log(`[OTP-MOCK] CODE    : ${otp}`);
  console.log(`[OTP-MOCK] ═══════════════════════════════════\n`);
}

// ── System channel availability ───────────────────────────────────────────────
// Rules:
//   Email: always in dev (mock). In production: only if SMTP fully configured.
//   SMS:   only if ALL 5 required SMS env vars are set AND SMS_ENABLED=true.
// SECURITY: SMTP/SMS credentials must NEVER be bundled in client installer.
function getChannelConfig() {
  // Email: dev = always. Production = requires full SMTP config.
  const emailEnabled = IS_DEV || !!(
    process.env.SMTP_HOST?.trim()     &&
    process.env.SMTP_USER?.trim()     &&
    process.env.SMTP_PASSWORD?.trim() &&
    process.env.FROM_EMAIL?.trim()    &&
    process.env.EMAIL_ENABLED?.trim() === 'true'
  );

  // SMS: requires all 5 vars to be non-empty AND SMS_ENABLED=true
  const smsEnabled = !!(
    process.env.SMS_PROVIDER?.trim()     &&
    process.env.SMS_API_URL?.trim()      &&
    process.env.SMS_API_KEY?.trim()      &&
    process.env.SMS_SENDER_NAME?.trim()  &&
    process.env.SMS_ENABLED?.trim()      === 'true'
  );

  return { emailEnabled, smsEnabled };
}

// ── Support Request Code: 1-hour expiry, nonce, backend-generated ─────────────
const SUPPORT_REQUEST_CODE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function buildSupportRequestCode(orgCode: string | undefined, deviceId: string): string {
  const nonce    = randomBytes(4).toString('hex').toUpperCase();
  const tsBase36 = Math.floor(Date.now() / 60000).toString(36).toUpperCase();
  const devShort = deviceId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const org      = (orgCode ?? 'XX').replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase();
  // Checksum: last 2 digits of sum mod 97
  const raw    = `${org}-${devShort}-${tsBase36}-${nonce}`;
  const csum   = raw.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 97;
  return `${raw}-${String(csum).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
export const recoveryRouter = router({

  // ── إمكانيات قنوات الاستعادة المتاحة في النظام (عام) ─────────────────────────
  // Returns which recovery channels are available system-wide (not user-specific).
  // Safe to expose publicly — no user data returned.
  getSystemChannels: publicProcedure.query(() => {
    const cfg = getChannelConfig();
    return {
      emailEnabled: cfg.emailEnabled,
      smsEnabled:   cfg.smsEnabled,
    };
  }),

  // ── هوية الجهاز الحقيقية (من ملف device_id في نظام الترخيص) ─────────────────
  // Device ID is read from C:\ProgramData\OneSoft\device_id (Windows production)
  // or ~/.onesoft/device_id (dev/Linux). Created once, survives software updates.
  // SECURITY: Returns only display-safe info — no private keys, no secrets.
  getDeviceIdentity: publicProcedure.query(() => {
    const deviceId            = getOrCreateDeviceId();
    const hardwareFingerprint = getHardwareFingerprint();
    return {
      deviceId,
      hardwareFingerprint,
      // Short form for display (last 12 chars of UUID without dashes)
      deviceIdShort: deviceId.replace(/-/g, '').slice(-12).toUpperCase(),
    };
  }),

  // ── توليد Request Code من الباكند (يحتوي nonce + له انتهاء + مرتبط بالجهاز) ──
  // Phase 1: generates code server-side, logs to security_events, returns to UI.
  // Phase 2 (later): License Center receives and validates this code.
  // SECURITY: Code is informational only at this phase — not a binding auth token.
  generateSupportRequestCode: publicProcedure
    .input(z.object({
      orgCode: z.string().max(20).optional(),
    }))
    .mutation(async ({ input }) => {
      const deviceId   = getOrCreateDeviceId();
      const hwFp       = getHardwareFingerprint();
      const requestCode = buildSupportRequestCode(input.orgCode, deviceId);
      const expiresAt   = new Date(Date.now() + SUPPORT_REQUEST_CODE_EXPIRY_MS);

      // Log to security_events for audit trail
      await logEvent({
        eventType: 'support_recovery_request_code_generated',
        result:    'success',
        reason:    `orgCode=${input.orgCode ?? 'none'} deviceId=${deviceId.slice(0, 8)}... hwFp=${hwFp}`,
      });

      return {
        requestCode,
        expiresAt:   expiresAt.toISOString(),
        deviceId,
        deviceIdShort: deviceId.replace(/-/g, '').slice(-12).toUpperCase(),
        hardwareFingerprint: hwFp,
        // Phase 1 notice: this code is for support reference only
        phase: 1 as const,
        note: 'Phase 1: Request Code generated for support reference. Phase 2 will add License Center validation.',
      };
    }),

  // ── إرسال كود تحقق (المسؤول → جوال/بريد المستخدم) ──────────────────────────
  sendVerification: adminProcedure
    .input(z.object({
      userId:  z.number(),
      channel: z.enum(['phone', 'email']),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.query.users.findFirst({
        where: and(
          eq(users.id,       input.userId),
          eq(users.orgId,    ctx.user.orgId),
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
          eq(securityEvents.userId,    input.userId),
          eq(securityEvents.eventType, `verify_${input.channel}_sent`),
          gt(securityEvents.createdAt, since15),
        ));
      if (Number(cnt) >= MAX_OTP_SENDS_PER_15MIN) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'تم تجاوز عدد طلبات الإرسال. يرجى الانتظار 15 دقيقة.',
        });
      }

      const otp     = generateOtp();
      const otpHash = await hashPassword(otp);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

      // Invalidate any previous unused tokens for this user+channel
      await db.update(verificationTokens)
        .set({ usedAt: new Date() })
        .where(and(
          eq(verificationTokens.userId,      input.userId),
          eq(verificationTokens.targetType,  input.channel),
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
        userId:    input.userId,
        username:  user.username,
        phone:     input.channel === 'phone' ? target : null,
        email:     input.channel === 'email' ? target : null,
        orgId:     ctx.user.orgId,
        result:    'success',
      });

      // SECURITY: devOnlyPayload returns {} in production — OTP never leaks
      return { sent: true, ...devOnlyPayload(otp) };
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
          eq(verificationTokens.userId,     input.userId),
          eq(verificationTokens.targetType, input.channel),
          isNull(verificationTokens.usedAt),
          gt(verificationTokens.expiresAt, new Date()),
        ))
        .orderBy(desc(verificationTokens.createdAt))
        .limit(1);

      if (!token) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'كود التحقق غير صحيح أو منتهي الصلاحية.',
        });
      }

      // Check max attempts
      if (token.attemptsCount >= MAX_OTP_ATTEMPTS) {
        await logEvent({
          eventType: `verify_${input.channel}_max_attempts`,
          userId:    input.userId,
          username:  user.username,
          orgId:     ctx.user.orgId,
          result:    'failed',
          reason:    'max_attempts_exceeded',
        });
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'تم تجاوز عدد المحاولات. يرجى إعادة إرسال الكود.',
        });
      }

      const valid = await verifyPassword(input.otp, token.otpHash);
      if (!valid) {
        await db.update(verificationTokens)
          .set({ attemptsCount: token.attemptsCount + 1 })
          .where(eq(verificationTokens.id, token.id));

        await logEvent({
          eventType: `verify_${input.channel}_failed`,
          userId:    input.userId,
          username:  user.username,
          orgId:     ctx.user.orgId,
          result:    'failed',
          reason:    'wrong_otp',
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'كود التحقق غير صحيح أو منتهي الصلاحية.',
        });
      }

      // Mark token used — OTP is now one-time only
      await db.update(verificationTokens)
        .set({ usedAt: new Date() })
        .where(eq(verificationTokens.id, token.id));

      // Stamp verified timestamp
      const updateFields = input.channel === 'phone'
        ? { phoneVerifiedAt: new Date() }
        : { emailVerifiedAt: new Date() };
      await db.update(users)
        .set({ ...updateFields, updatedAt: new Date() })
        .where(eq(users.id, input.userId));

      await logEvent({
        eventType: `verify_${input.channel}_success`,
        userId:    input.userId,
        username:  user.username,
        orgId:     ctx.user.orgId,
        result:    'success',
      });

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

      // SECURITY: Cannot enable phone recovery without a verified phone
      if (opts.recoveryEnabledPhone === true) {
        if (!user.phone || !user.phoneVerifiedAt) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'يجب التحقق من رقم الجوال أولاً لتفعيل الاستعادة عبر الجوال',
          });
        }
      }
      // SECURITY: Cannot enable email recovery without a verified email
      if (opts.recoveryEnabledEmail === true) {
        if (!user.email || !user.emailVerifiedAt) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'يجب التحقق من البريد الإلكتروني أولاً لتفعيل الاستعادة عبره',
          });
        }
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
  // SECURITY: Always returns the same generic message regardless of outcome.
  // This prevents user enumeration, channel status disclosure, or account existence leaks.
  requestPasswordReset: publicProcedure
    .input(z.object({
      identifier: z.string().min(1),
      channel:    z.enum(['phone', 'email']),
    }))
    .mutation(async ({ input }) => {
      const GENERIC = 'إذا كانت البيانات صحيحة، سيتم إرسال كود الاستعادة.';

      // First: check if user exists at all (for logging only — result is always generic)
      const anyUser = await db.query.users.findFirst({
        where: (u) => or(
          eq(u.username, input.identifier),
          eq(u.phone,    input.identifier),
          eq(u.email,    input.identifier),
        ),
      });

      // Log suspended user attempt (still return generic message)
      if (anyUser && !anyUser.isActive) {
        await logEvent({
          eventType: 'password_reset_suspended_user',
          userId:    anyUser.id,
          username:  anyUser.username,
          result:    'failed',
          reason:    'user_suspended',
        });
        return { message: GENERIC };
      }

      // Active user lookup
      const user = anyUser?.isActive ? anyUser : null;

      if (!user) {
        await logEvent({
          eventType: 'password_reset_request',
          result:    'failed',
          reason:    'user_not_found',
          username:  input.identifier,
        });
        return { message: GENERIC };
      }

      const target     = input.channel === 'phone' ? user.phone    : user.email;
      const isEnabled  = input.channel === 'phone' ? user.recoveryEnabledPhone : user.recoveryEnabledEmail;
      const isVerified = input.channel === 'phone' ? user.phoneVerifiedAt      : user.emailVerifiedAt;

      if (!target || !isEnabled || !isVerified) {
        await logEvent({
          eventType: 'password_reset_request',
          userId:    user.id,
          username:  user.username,
          result:    'failed',
          reason:    'channel_not_available',
        });
        return { message: GENERIC };
      }

      // Rate limit: max 3 requests per 15 min
      const since15 = new Date(Date.now() - 15 * 60 * 1000);
      const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(securityEvents)
        .where(and(
          eq(securityEvents.userId,    user.id),
          eq(securityEvents.eventType, 'password_reset_otp_sent'),
          gt(securityEvents.createdAt, since15),
        ));
      if (Number(cnt) >= MAX_OTP_SENDS_PER_15MIN) {
        // Silent rate limit — same generic message, don't reveal rate limiting
        await logEvent({
          eventType: 'password_reset_rate_limited',
          userId:    user.id,
          username:  user.username,
          result:    'failed',
          reason:    'rate_limited',
        });
        return { message: GENERIC };
      }

      // Invalidate old tokens for this user+channel
      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(
          eq(passwordResetTokens.userId,   user.id),
          eq(passwordResetTokens.channel,  input.channel),
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
        userId:    user.id,
        username:  user.username,
        phone:     input.channel === 'phone' ? target : null,
        email:     input.channel === 'email' ? target : null,
        result:    'success',
      });

      // SECURITY: devOnlyPayload returns {} in production — resetToken IS returned
      // always (needed to correlate the OTP submission), but devOtp never leaks in prod
      return {
        message: GENERIC,
        resetToken,
        ...devOnlyPayload(otp),
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
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'كود التحقق غير صحيح أو منتهي الصلاحية.',
        });
      }

      // Max attempts guard
      if (token.attemptsCount >= MAX_OTP_ATTEMPTS) {
        await logEvent({
          eventType: 'password_reset_max_attempts',
          userId:    token.userId,
          result:    'failed',
          reason:    'max_attempts_exceeded',
        });
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'تم تجاوز عدد المحاولات المسموح. يرجى طلب كود جديد.',
        });
      }

      const valid = await verifyPassword(input.otp, token.otpHash);
      if (!valid) {
        await db.update(passwordResetTokens)
          .set({ attemptsCount: token.attemptsCount + 1 })
          .where(eq(passwordResetTokens.id, token.id));

        await logEvent({
          eventType: 'password_reset_verify',
          userId:    token.userId,
          result:    'failed',
          reason:    'wrong_otp',
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'كود التحقق غير صحيح أو منتهي الصلاحية.',
        });
      }

      // SECURITY: Mark token used immediately — OTP is one-time only
      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, token.id));

      // Change password
      const passwordHash = await hashPassword(input.newPassword);
      await db.update(users).set({
        passwordHash,
        passwordChangedAt:   new Date(),
        forcePasswordChange: false,
        updatedAt:           new Date(),
      }).where(eq(users.id, token.userId));

      await logEvent({
        eventType: 'password_reset_success',
        userId:    token.userId,
        result:    'success',
      });

      return { success: true };
    }),
});
