import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Request, Response } from 'express';
import { getUserFromRequest } from './auth.js';
import type { User } from './schema.js';

export type Context = {
  req: Request;
  res: Response;
  user: User | null;
};

export async function createContext({ req, res }: { req: Request; res: Response }): Promise<Context> {
  const user = await getUserFromRequest(req);
  return { req, res, user };
}

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

const requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول أولاً' });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول أولاً' });
  if (!['superadmin', 'admin'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireSuperAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول أولاً' });
  if (ctx.user.role !== 'superadmin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'هذه الصفحة للمدير العام فقط' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/**
 * ownerOnlyProcedure — مزدوج الحماية:
 *
 * 1. CLIENT_BUILD=true  → جميع الإجراءات تُرجع NOT_FOUND (كأن endpoint غير موجود)
 *    يُضبط هذا المتغير في بيئة Electron عند بناء نسخة العميل.
 *
 * 2. دور المستخدم       → فقط superadmin يُسمح له بالوصول (في بيئة المالك).
 *
 * هذا يضمن:
 * - في نسخة العميل: جميع LC endpoints تُرجع 404 حتى لو جرّب المطوّر الوصول
 * - في بيئة المالك (License Center): فقط superadmin يستطيع استخدامها
 */
const requireOwner = t.middleware(({ ctx, next }) => {
  // ── طبقة 1: منع الوصول الكامل في بيئة العميل ──────────────────────────
  if (process.env.CLIENT_BUILD === 'true') {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'هذه الخدمة غير متاحة في هذه البيئة',
    });
  }
  // ── طبقة 2: التحقق من الدور (superadmin فقط في بيئة المالك) ──────────
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول أولاً' });
  }
  if (ctx.user.role !== 'superadmin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'هذه الخدمة مخصصة لمالك النظام فقط' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure  = t.procedure.use(requireAuth);
export const adminProcedure       = t.procedure.use(requireAdmin);
export const superAdminProcedure  = t.procedure.use(requireSuperAdmin);
export const ownerOnlyProcedure   = t.procedure.use(requireOwner);
