import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { users, organizations, appSettings } from './schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { ENV } from './env.js';
import type { Request, Response } from 'express';
import { saveDevicePrefs } from './lib/devicePrefs.js';
import { logger } from './logger.js';

const SECRET = new TextEncoder().encode(ENV.jwtSecret);

// ─── خيارات Cookie المشتركة بين login وlogout ─────────────────────────────────
// يجب أن يكون clearCookie له نفس خيارات set بالضبط وإلا لن يُمسح في بعض البيئات.
export function getAuthCookieOptions(): {
  httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string;
} {
  return {
    httpOnly: true,
    secure:   ENV.nodeEnv === 'production',
    sameSite: 'lax',
    path:     '/',
  };
}

// ─── إنشاء JWT token ──────────────────────────────────────────────────────────
export async function createToken(payload: {
  userId: number;
  orgId: number;
  username: string;
  role: string;
  sessionVersion: number;
}): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .setIssuedAt()
    .sign(SECRET);
}

// ─── التحقق من JWT token ──────────────────────────────────────────────────────
export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { userId: number; orgId: number; username: string; role: string; sessionVersion?: number };
  } catch {
    return null;
  }
}

// ─── تشفير كلمة المرور ────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// ─── التحقق من كلمة المرور ───────────────────────────────────────────────────
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── استخراج المستخدم من الطلب ───────────────────────────────────────────────
export async function getUserFromRequest(req: Request) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );
  
  const token = cookies[ENV.cookieName];
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, payload.userId), eq(users.isActive, true)),
  });

  if (!user) return null;

  // ── فحص allowLogin (مقيّد الدخول) — يُوقف الجلسات النشطة فوراً ─────────────
  if (user.allowLogin === false) return null;

  // ── إبطال الجلسة إذا تغيّرت sessionVersion (تسجيل خروج كل الأجهزة) ──────────
  // الرموز القديمة التي لا تحمل sessionVersion تُعامَل كـ version=0
  // مما يجعل أي رفع للـ sessionVersion يُبطلها تلقائياً
  const tokenVersion = payload.sessionVersion ?? 0;
  if (user.sessionVersion !== tokenVersion) {
    return null;
  }

  return user;
}

// ─── تسجيل الدخول ────────────────────────────────────────────────────────────
export async function loginHandler(req: Request, res: Response) {
  const { username, password, orgCode } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'اسم المستخدم مطلوب' });
  }
  // كلمة المرور قد تكون فارغة إذا لم يُعيَّن كلمة مرور أثناء التثبيت
  const safePassword = password ?? '';

  try {
    // البحث عن المؤسسة
    let orgId: number | null = null;
    let orgRecord: typeof organizations.$inferSelect | null = null;
    if (orgCode) {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.code, orgCode.toUpperCase()),
      });
      if (!org) return res.status(401).json({ error: 'كود المؤسسة غير صحيح' });
      if (org.status === 'suspended') return res.status(403).json({ error: 'تم تعليق اشتراك المؤسسة' });
      if (org.status === 'expired') return res.status(403).json({ error: 'انتهى اشتراك المؤسسة' });
      orgId     = org.id;
      orgRecord = org;
    }

    // ── رسالة الخطأ العامة (لا تكشف سبب الرفض لأسباب أمنية) ───────────────────
    const loginErrorMsg = 'اسم المستخدم أو البريد الإلكتروني أو كلمة المرور غير صحيحة';

    // ── البحث عن المستخدم حسب نوع المدخل ────────────────────────────────────────
    // كل مستخدم يملك loginMethod خاصاً به: 'username' | 'username_or_email' | 'email'
    const loginInput = String(username).trim();
    const isEmailInput = loginInput.includes('@');
    let user: typeof import('./schema.js').users.$inferSelect | undefined;
    let foundByEmail = false;

    if (isEmailInput) {
      // ── البحث بالبريد: نقبل فقط من loginMethod يسمح بالبريد ──────────────
      const emailVal = loginInput.toLowerCase();
      const emailCond = orgId
        ? and(eq(sql`lower(trim(${users.email}))`, emailVal), eq(users.orgId, orgId), eq(users.isActive, true))
        : and(eq(sql`lower(trim(${users.email}))`, emailVal), eq(users.isActive, true));
      const emailUser = await db.query.users.findFirst({ where: emailCond });
      if (emailUser && emailUser.loginMethod !== 'username') {
        user = emailUser;
        foundByEmail = true;
      }
    } else {
      // ── البحث باسم المستخدم: نقبل فقط من loginMethod يسمح باسم المستخدم ──
      const usernameVal = loginInput.toLowerCase();
      const userCond = orgId
        ? and(eq(sql`lower(trim(${users.username}))`, usernameVal), eq(users.orgId, orgId), eq(users.isActive, true))
        : and(eq(sql`lower(trim(${users.username}))`, usernameVal), eq(users.isActive, true));
      const usernameUser = await db.query.users.findFirst({ where: userCond });
      if (usernameUser && usernameUser.loginMethod !== 'email') {
        user = usernameUser;
      }
    }

    if (!user) return res.status(401).json({ error: loginErrorMsg });

    // ── فحص السماح بتسجيل الدخول (allowLogin) ────────────────────────────────
    if (user.allowLogin === false) {
      return res.status(403).json({ error: 'غير مسموح لهذا المستخدم بتسجيل الدخول. يرجى التواصل مع مدير النظام.' });
    }

    // ── منطق التخطي عن كلمة المرور ─────────────────────────────────────────────
    // يُسمح بالدخول بكلمة مرور فارغة حصراً لحساب ADMIN الذي لم تُعيَّن له كلمة مرور بعد
    // (أول تشغيل)، شرط أن يكون الدخول باسم المستخدم لا بالبريد.
    // أي مستخدم آخر (accountant, cashier …) لا يُسمح له بالدخول بدون كلمة مرور حتى لو
    // كان passwordStatus='not_set'.
    const skipPassword =
      user.passwordStatus === 'not_set' &&
      safePassword === ''               &&
      !foundByEmail                     &&
      user.role === 'admin';

    if (!skipPassword) {
      const valid = await verifyPassword(safePassword, user.passwordHash ?? '');
      if (!valid) return res.status(401).json({ error: loginErrorMsg });
    }

    // ── أمان: حساب افتراضي بكلمة مرور غير مُعيَّنة (ADMIN أول تشغيل) ──────────
    // يُسمح بالدخول إليه فقط من نفس الجهاز (localhost) حتى تُعيَّن كلمة مرور.
    // في الإنتاج: الحرس يشتغل فقط في production. في التطوير (Replit) مسموح.
    // المستخدمون العاديون (password_status='set') لا يتأثرون.
    if (user.passwordStatus === 'not_set' && ENV.nodeEnv === 'production') {
      const remoteAddr = req.socket.remoteAddress ?? '';
      const isLocalhost = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddr);
      if (!isLocalhost) {
        return res.status(403).json({
          error: 'يجب تعيين كلمة مرور لهذا الحساب قبل الدخول عن بُعد. سجّل الدخول من التطبيق على الجهاز نفسه أولاً ثم عيّن كلمة المرور.',
        });
      }
    }

    // تحديث آخر دخول
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    logger.info('auth', 'login success identity', {
      userId: user.id,
      username: user.username,
      displayName: user.name,
      organizationId: user.orgId,
      role: user.role,
      groupId: user.userGroupId ?? null,
      permissionKeys: Object.keys((user.extraPermissions ?? {}) as Record<string, boolean>),
    });

    // حفظ كود المؤسسة على الجهاز (إن تم تحديده)
    if (orgRecord) {
      saveDevicePrefs({ savedOrgCode: orgRecord.code, savedOrgName: orgRecord.name });
    } else if (!orgCode) {
      // لم يُحدَّد كود المؤسسة — احفظ كود المؤسسة من سجل المستخدم
      try {
        const userOrg = await db.query.organizations.findFirst({
          where: eq(organizations.id, user.orgId),
        });
        if (userOrg) saveDevicePrefs({ savedOrgCode: userOrg.code, savedOrgName: userOrg.name });
      } catch { /* صامت */ }
    }

    // إنشاء token (يتضمن sessionVersion لإبطال الجلسات عند الحاجة)
    const token = await createToken({
      userId: user.id,
      orgId: user.orgId,
      username: user.username,
      role: user.role,
      sessionVersion: user.sessionVersion ?? 1,
    });

    res.cookie(ENV.cookieName, token, {
      ...getAuthCookieOptions(),
      maxAge: ENV.sessionExpiry,
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        orgId: user.orgId,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
}

// ─── تسجيل الخروج ────────────────────────────────────────────────────────────
export function logoutHandler(req: Request, res: Response) {
  res.clearCookie(ENV.cookieName, getAuthCookieOptions());
  if (req.method === 'GET') {
    return res.redirect('/');
  }
  return res.json({ success: true });
}

// ─── معلومات المستخدم الحالي ─────────────────────────────────────────────────
export async function meHandler(req: Request, res: Response) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'غير مسجل الدخول' });
  
  return res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    orgId: user.orgId,
  });
}
