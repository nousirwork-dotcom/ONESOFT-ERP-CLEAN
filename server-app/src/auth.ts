import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { users, organizations } from './schema.js';
import { eq, and } from 'drizzle-orm';
import { ENV } from './env.js';
import type { Request, Response } from 'express';

const SECRET = new TextEncoder().encode(ENV.jwtSecret);

// ─── إنشاء JWT token ──────────────────────────────────────────────────────────
export async function createToken(payload: {
  userId: number;
  orgId: number;
  username: string;
  role: string;
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
    return payload as { userId: number; orgId: number; username: string; role: string };
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

  return user || null;
}

// ─── تسجيل الدخول ────────────────────────────────────────────────────────────
export async function loginHandler(req: Request, res: Response) {
  const { username, password, orgCode } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
  }

  try {
    // البحث عن المؤسسة
    let orgId: number | null = null;
    if (orgCode) {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.code, orgCode.toUpperCase()),
      });
      if (!org) return res.status(401).json({ error: 'كود المؤسسة غير صحيح' });
      if (org.status === 'suspended') return res.status(403).json({ error: 'تم تعليق اشتراك المؤسسة' });
      if (org.status === 'expired') return res.status(403).json({ error: 'انتهى اشتراك المؤسسة' });
      orgId = org.id;
    }

    // البحث عن المستخدم
    const conditions = orgId
      ? and(eq(users.username, username), eq(users.orgId, orgId), eq(users.isActive, true))
      : and(eq(users.username, username), eq(users.isActive, true));

    const user = await db.query.users.findFirst({ where: conditions });

    if (!user) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

    // تحديث آخر دخول
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    // إنشاء token
    const token = await createToken({
      userId: user.id,
      orgId: user.orgId,
      username: user.username,
      role: user.role,
    });

    res.cookie(ENV.cookieName, token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
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
export function logoutHandler(_req: Request, res: Response) {
  res.clearCookie(ENV.cookieName, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
  });
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
