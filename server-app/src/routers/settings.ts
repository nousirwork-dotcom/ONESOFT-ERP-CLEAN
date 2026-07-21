import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { userGroups, userGroupMembers, userCategories, users, qrSettings, branches, units, freeProducts, warehouses, salesInvoices, inventoryCounts } from '../schema.js';
import { eq, and, desc, asc, ilike, or, ne, isNotNull, inArray } from 'drizzle-orm';
import { assertCanUpdate, assertCanDelete } from '../lib/foundation-framework.js';

// ─── Circular dependency guard for nested groups ───────────────────────────────
async function wouldCreateCycle(targetGroupId: number, candidateGroupId: number, orgId: number): Promise<boolean> {
  const visited = new Set<number>();
  const queue = [candidateGroupId];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === targetGroupId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const children = await db
      .select({ memberGroupId: userGroupMembers.memberGroupId })
      .from(userGroupMembers)
      .where(and(eq(userGroupMembers.groupId, current), eq(userGroupMembers.orgId, orgId), isNotNull(userGroupMembers.memberGroupId)));
    for (const c of children) {
      if (c.memberGroupId) queue.push(c.memberGroupId);
    }
  }
  return false;
}

export const userGroupsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(userGroups)
      .where(and(eq(userGroups.orgId, ctx.user.orgId), eq(userGroups.isActive, true)))
      .orderBy(userGroups.name);
  }),

  create: protectedProcedure
    .input(z.object({ code: z.string().optional(), name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [g] = await db.insert(userGroups).values({
        orgId: ctx.user.orgId, code: input.code, name: input.name, description: input.description,
      }).returning();
      return g;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), code: z.string().optional(), name: z.string().optional(), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      await db.update(userGroups).set(rest)
        .where(and(eq(userGroups.id, id), eq(userGroups.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(userGroups).set({ isActive: false })
        .where(and(eq(userGroups.id, input.id), eq(userGroups.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  // ── Membership procedures accessible under userGroups.* namespace ──────────

  validateNestedGroup: protectedProcedure
    .input(z.object({ groupId: z.number(), candidateGroupId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (input.candidateGroupId === input.groupId) {
        return { valid: false, reason: 'لا يمكن إضافة المجموعة إلى نفسها' };
      }
      const cycle = await wouldCreateCycle(input.groupId, input.candidateGroupId, ctx.user.orgId);
      if (cycle) return { valid: false, reason: 'ستؤدي هذه الإضافة إلى تبعية دائرية' };
      return { valid: true, reason: null };
    }),

  searchMembers: protectedProcedure
    .input(z.object({
      groupId:    z.number(),
      query:      z.string().min(1),
      memberType: z.enum(['user', 'group']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const q = `%${input.query}%`;

      const existingMembers = await db
        .select({ memberUserId: userGroupMembers.memberUserId, memberGroupId: userGroupMembers.memberGroupId })
        .from(userGroupMembers)
        .where(and(eq(userGroupMembers.groupId, input.groupId), eq(userGroupMembers.orgId, orgId)));
      const existingUserIds  = new Set(existingMembers.flatMap(m => m.memberUserId  != null ? [m.memberUserId]  : []));
      const existingGroupIds = new Set(existingMembers.flatMap(m => m.memberGroupId != null ? [m.memberGroupId] : []));

      const results: { id: number; name: string; code: string | null; type: 'user' | 'group' }[] = [];

      if (!input.memberType || input.memberType === 'user') {
        const allUsers = await db
          .select({ id: users.id, name: users.name, code: users.code })
          .from(users)
          .where(and(eq(users.orgId, orgId), eq(users.isActive, true), or(ilike(users.name, q), ilike(users.code, q))))
          .orderBy(asc(users.name)).limit(20);
        results.push(...allUsers.filter(u => !existingUserIds.has(u.id)).slice(0, 12).map(u => ({ ...u, type: 'user' as const })));
      }

      if (!input.memberType || input.memberType === 'group') {
        const allGroups = await db
          .select({ id: userGroups.id, name: userGroups.name, code: userGroups.code })
          .from(userGroups)
          .where(and(eq(userGroups.orgId, orgId), eq(userGroups.isActive, true), ne(userGroups.id, input.groupId), or(ilike(userGroups.name, q), ilike(userGroups.code, q))))
          .orderBy(asc(userGroups.name)).limit(10);
        results.push(...allGroups.filter(g => !existingGroupIds.has(g.id)).slice(0, 6).map(g => ({ ...g, type: 'group' as const })));
      }

      return results;
    }),

  addMember: protectedProcedure
    .input(z.object({
      groupId:       z.number(),
      memberType:    z.enum(['user', 'group']),
      memberUserId:  z.number().optional(),
      memberGroupId: z.number().optional(),
      memberCode:    z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let resolvedName: string | undefined;
      let resolvedCode: string | null | undefined;
      let resolvedUserId:  number | undefined;
      let resolvedGroupId: number | undefined;

      if (input.memberType === 'user') {
        if (!input.memberUserId && !input.memberCode) throw new TRPCError({ code: 'BAD_REQUEST', message: 'يجب تحديد مستخدم' });
        const found = input.memberUserId
          ? await db.select({ id: users.id, name: users.name, code: users.code }).from(users).where(and(eq(users.id, input.memberUserId), eq(users.orgId, ctx.user.orgId))).limit(1)
          : await db.select({ id: users.id, name: users.name, code: users.code }).from(users).where(and(eq(users.orgId, ctx.user.orgId), eq(users.code, input.memberCode!))).limit(1);
        if (!found.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'المستخدم غير موجود في النظام' });
        resolvedUserId = found[0].id; resolvedName = found[0].name; resolvedCode = found[0].code;
        const ex = await db.select({ id: userGroupMembers.id }).from(userGroupMembers).where(and(eq(userGroupMembers.groupId, input.groupId), eq(userGroupMembers.orgId, ctx.user.orgId), eq(userGroupMembers.memberUserId, resolvedUserId))).limit(1);
        if (ex.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'المستخدم موجود بالفعل في هذه المجموعة' });
      } else {
        if (!input.memberGroupId && !input.memberCode) throw new TRPCError({ code: 'BAD_REQUEST', message: 'يجب تحديد مجموعة' });
        const found = input.memberGroupId
          ? await db.select({ id: userGroups.id, name: userGroups.name, code: userGroups.code }).from(userGroups).where(and(eq(userGroups.id, input.memberGroupId), eq(userGroups.orgId, ctx.user.orgId), eq(userGroups.isActive, true))).limit(1)
          : await db.select({ id: userGroups.id, name: userGroups.name, code: userGroups.code }).from(userGroups).where(and(eq(userGroups.orgId, ctx.user.orgId), eq(userGroups.code, input.memberCode!), eq(userGroups.isActive, true))).limit(1);
        if (!found.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'المجموعة غير موجودة في النظام' });
        resolvedGroupId = found[0].id; resolvedName = found[0].name; resolvedCode = found[0].code;
        if (resolvedGroupId === input.groupId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن إضافة المجموعة إلى نفسها' });
        if (await wouldCreateCycle(input.groupId, resolvedGroupId, ctx.user.orgId)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن إضافة هذه المجموعة — ستؤدي إلى تبعية دائرية' });
        const ex = await db.select({ id: userGroupMembers.id }).from(userGroupMembers).where(and(eq(userGroupMembers.groupId, input.groupId), eq(userGroupMembers.orgId, ctx.user.orgId), eq(userGroupMembers.memberGroupId, resolvedGroupId))).limit(1);
        if (ex.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'المجموعة موجودة بالفعل في هذه المجموعة' });
      }

      try {
        const [m] = await db.insert(userGroupMembers).values({
          groupId: input.groupId, orgId: ctx.user.orgId, memberType: input.memberType,
          memberUserId: resolvedUserId, memberGroupId: resolvedGroupId, memberCode: resolvedCode, memberName: resolvedName,
        }).returning();
        return m;
      } catch (err: any) {
        if (err?.code === '23505') throw new TRPCError({ code: 'BAD_REQUEST', message: 'العضو موجود بالفعل في هذه المجموعة' });
        throw err;
      }
    }),

  removeMember: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(userGroupMembers)
        .where(and(eq(userGroupMembers.id, input.memberId), eq(userGroupMembers.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  getEffectiveMembers: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const visitedGroups = new Set<number>();
      const returnedUserIds = new Set<number>();
      const results: Array<{
        id: number; name: string; code: string | null;
        source: 'direct' | 'inherited'; inheritedFrom: string | null;
      }> = [];
      const queue: Array<{ gId: number; inheritedFrom: string | null }> = [{ gId: input.groupId, inheritedFrom: null }];

      while (queue.length) {
        const item = queue.shift()!;
        if (visitedGroups.has(item.gId)) continue;
        visitedGroups.add(item.gId);
        const members = await db.select().from(userGroupMembers)
          .where(and(eq(userGroupMembers.groupId, item.gId), eq(userGroupMembers.orgId, orgId)));
        for (const m of members) {
          if (m.memberType === 'user' && m.memberUserId && !returnedUserIds.has(m.memberUserId)) {
            returnedUserIds.add(m.memberUserId);
            results.push({ id: m.memberUserId, name: m.memberName ?? '—', code: m.memberCode ?? null,
              source: item.gId === input.groupId ? 'direct' : 'inherited', inheritedFrom: item.inheritedFrom });
          } else if (m.memberType === 'group' && m.memberGroupId && !visitedGroups.has(m.memberGroupId)) {
            queue.push({ gId: m.memberGroupId, inheritedFrom: m.memberName ?? String(m.memberGroupId) });
          }
        }
      }
      return results;
    }),
});

export const userCategoriesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(userCategories)
      .where(and(eq(userCategories.orgId, ctx.user.orgId), eq(userCategories.isActive, true)))
      .orderBy(userCategories.name);
  }),

  create: protectedProcedure
    .input(z.object({
      code:          z.string().optional(),
      name:          z.string().min(1),
      autoNumbering: z.boolean().optional(),
      firstNumber:   z.number().optional(),
      lastNumber:    z.number().optional(),
      increment:     z.number().optional(),
      codeDigits:    z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.code) {
        const dup = await db.select({ id: userCategories.id }).from(userCategories)
          .where(and(eq(userCategories.orgId, ctx.user.orgId), eq(userCategories.code, input.code), eq(userCategories.isActive, true)))
          .limit(1);
        if (dup.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'الكود مكرر — يوجد فئة بنفس الكود' });
      }
      const [c] = await db.insert(userCategories).values({
        orgId:         ctx.user.orgId,
        code:          input.code,
        name:          input.name,
        autoNumbering: input.autoNumbering ?? true,
        firstNumber:   input.firstNumber   ?? 1,
        lastNumber:    input.lastNumber    ?? 99999,
        increment:     input.increment     ?? 1,
        codeDigits:    input.codeDigits    ?? 5,
      }).returning();
      return c;
    }),

  update: protectedProcedure
    .input(z.object({
      id:            z.number(),
      code:          z.string().optional(),
      name:          z.string().optional(),
      autoNumbering: z.boolean().optional(),
      firstNumber:   z.number().optional(),
      lastNumber:    z.number().optional(),
      increment:     z.number().optional(),
      codeDigits:    z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      if (rest.code) {
        const dup = await db.select({ id: userCategories.id }).from(userCategories)
          .where(and(eq(userCategories.orgId, ctx.user.orgId), eq(userCategories.code, rest.code), eq(userCategories.isActive, true)))
          .limit(1);
        if (dup.length && dup[0].id !== id) throw new TRPCError({ code: 'BAD_REQUEST', message: 'الكود مكرر — يوجد فئة بنفس الكود' });
      }
      await db.update(userCategories).set(rest)
        .where(and(eq(userCategories.id, id), eq(userCategories.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(userCategories).set({ isActive: false })
        .where(and(eq(userCategories.id, input.id), eq(userCategories.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  nextCode: protectedProcedure
    .input(z.object({ categoryId: z.number() }))
    .query(async ({ ctx, input }) => {
      const cat = await db.select().from(userCategories)
        .where(and(eq(userCategories.id, input.categoryId), eq(userCategories.orgId, ctx.user.orgId)))
        .limit(1);
      if (!cat.length || !cat[0].autoNumbering) return null;
      const c        = cat[0];
      const prefix   = c.code ?? "";
      const numDigits = Math.max(c.codeDigits - prefix.length, 1);
      const catUsers  = await db.select({ code: users.code }).from(users)
        .where(and(eq(users.orgId, ctx.user.orgId), eq(users.categoryId, input.categoryId), eq(users.isActive, true)));
      let maxNum = c.firstNumber - c.increment;
      for (const u of catUsers) {
        if (!u.code) continue;
        const numPart = prefix && u.code.startsWith(prefix) ? u.code.slice(prefix.length) : u.code;
        const n = parseInt(numPart, 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
      const nextNum = maxNum < c.firstNumber ? c.firstNumber : maxNum + c.increment;
      if (nextNum > c.lastNumber) return null;
      return { code: prefix + String(nextNum).padStart(numDigits, '0'), category: c };
    }),
});

export const groupMembersRouter = router({
  list: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.select().from(userGroupMembers)
        .where(and(eq(userGroupMembers.groupId, input.groupId), eq(userGroupMembers.orgId, ctx.user.orgId)))
        .orderBy(userGroupMembers.createdAt);
    }),

  add: protectedProcedure
    .input(z.object({
      groupId:       z.number(),
      memberType:    z.enum(['user', 'group']),
      memberUserId:  z.number().optional(),
      memberGroupId: z.number().optional(),
      memberCode:    z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let resolvedName: string | undefined;
      let resolvedCode: string | null | undefined;
      let resolvedUserId:  number | undefined;
      let resolvedGroupId: number | undefined;

      if (input.memberType === 'user') {
        if (!input.memberUserId && !input.memberCode) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'يجب تحديد مستخدم' });
        }
        const found = input.memberUserId
          ? await db.select({ id: users.id, name: users.name, code: users.code })
              .from(users).where(and(eq(users.id, input.memberUserId), eq(users.orgId, ctx.user.orgId))).limit(1)
          : await db.select({ id: users.id, name: users.name, code: users.code })
              .from(users).where(and(eq(users.orgId, ctx.user.orgId), eq(users.code, input.memberCode!))).limit(1);
        if (!found.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'المستخدم غير موجود في النظام' });
        resolvedUserId = found[0].id;
        resolvedName   = found[0].name;
        resolvedCode   = found[0].code;

        const existing = await db.select({ id: userGroupMembers.id }).from(userGroupMembers)
          .where(and(eq(userGroupMembers.groupId, input.groupId), eq(userGroupMembers.orgId, ctx.user.orgId), eq(userGroupMembers.memberUserId, resolvedUserId)))
          .limit(1);
        if (existing.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'المستخدم موجود بالفعل في هذه المجموعة' });

      } else {
        if (!input.memberGroupId && !input.memberCode) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'يجب تحديد مجموعة' });
        }
        const found = input.memberGroupId
          ? await db.select({ id: userGroups.id, name: userGroups.name, code: userGroups.code })
              .from(userGroups).where(and(eq(userGroups.id, input.memberGroupId), eq(userGroups.orgId, ctx.user.orgId), eq(userGroups.isActive, true))).limit(1)
          : await db.select({ id: userGroups.id, name: userGroups.name, code: userGroups.code })
              .from(userGroups).where(and(eq(userGroups.orgId, ctx.user.orgId), eq(userGroups.code, input.memberCode!), eq(userGroups.isActive, true))).limit(1);
        if (!found.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'المجموعة غير موجودة في النظام' });
        resolvedGroupId = found[0].id;
        resolvedName    = found[0].name;
        resolvedCode    = found[0].code;

        if (resolvedGroupId === input.groupId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن إضافة المجموعة إلى نفسها' });
        }
        if (await wouldCreateCycle(input.groupId, resolvedGroupId, ctx.user.orgId)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن إضافة هذه المجموعة — ستؤدي إلى تبعية دائرية' });
        }
        const existing = await db.select({ id: userGroupMembers.id }).from(userGroupMembers)
          .where(and(eq(userGroupMembers.groupId, input.groupId), eq(userGroupMembers.orgId, ctx.user.orgId), eq(userGroupMembers.memberGroupId, resolvedGroupId)))
          .limit(1);
        if (existing.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'المجموعة موجودة بالفعل في هذه المجموعة' });
      }

      try {
        const [m] = await db.insert(userGroupMembers).values({
          groupId:       input.groupId,
          orgId:         ctx.user.orgId,
          memberType:    input.memberType,
          memberUserId:  resolvedUserId,
          memberGroupId: resolvedGroupId,
          memberCode:    resolvedCode,
          memberName:    resolvedName,
        }).returning();
        return m;
      } catch (err: any) {
        if (err?.code === '23505') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'العضو موجود بالفعل في هذه المجموعة' });
        }
        throw err;
      }
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(userGroupMembers)
        .where(and(eq(userGroupMembers.id, input.id), eq(userGroupMembers.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  effectiveMembers: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const visitedGroups = new Set<number>();
      const returnedUserIds = new Set<number>();
      const results: Array<{
        id: number; name: string; code: string | null;
        source: 'direct' | 'inherited'; inheritedFrom: string | null;
      }> = [];
      const queue: Array<{ gId: number; inheritedFrom: string | null }> = [{ gId: input.groupId, inheritedFrom: null }];

      while (queue.length) {
        const item = queue.shift()!;
        if (visitedGroups.has(item.gId)) continue;
        visitedGroups.add(item.gId);

        const members = await db.select().from(userGroupMembers)
          .where(and(eq(userGroupMembers.groupId, item.gId), eq(userGroupMembers.orgId, orgId)));

        for (const m of members) {
          if (m.memberType === 'user' && m.memberUserId) {
            if (!returnedUserIds.has(m.memberUserId)) {
              returnedUserIds.add(m.memberUserId);
              results.push({
                id:           m.memberUserId,
                name:         m.memberName ?? '—',
                code:         m.memberCode ?? null,
                source:       item.gId === input.groupId ? 'direct' : 'inherited',
                inheritedFrom: item.inheritedFrom,
              });
            }
          } else if (m.memberType === 'group' && m.memberGroupId && !visitedGroups.has(m.memberGroupId)) {
            queue.push({ gId: m.memberGroupId, inheritedFrom: m.memberName ?? String(m.memberGroupId) });
          }
        }
      }

      return results;
    }),

  resolveMember: protectedProcedure
    .input(z.object({
      memberType: z.enum(['user', 'group']),
      memberCode: z.string(),
      groupId:    z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const code = input.memberCode.trim();
      if (!code) return null;
      if (input.memberType === 'user') {
        const [u] = await db
          .select({ id: users.id, name: users.name, code: users.code })
          .from(users)
          .where(and(eq(users.orgId, ctx.user.orgId), eq(users.isActive, true), eq(users.code, code)))
          .limit(1);
        return u ? { id: u.id, name: u.name, code: u.code, type: 'user' as const } : null;
      } else {
        const [g] = await db
          .select({ id: userGroups.id, name: userGroups.name, code: userGroups.code })
          .from(userGroups)
          .where(and(
            eq(userGroups.orgId, ctx.user.orgId),
            eq(userGroups.isActive, true),
            ne(userGroups.id, input.groupId),
            eq(userGroups.code, code),
          ))
          .limit(1);
        return g ? { id: g.id, name: g.name, code: g.code, type: 'group' as const } : null;
      }
    }),

  searchCandidates: protectedProcedure
    .input(z.object({
      query:   z.string().min(1),
      groupId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const q = `%${input.query}%`;

      const [existingMembers, allUsers, allGroups] = await Promise.all([
        db.select({ memberUserId: userGroupMembers.memberUserId, memberGroupId: userGroupMembers.memberGroupId })
          .from(userGroupMembers)
          .where(and(eq(userGroupMembers.groupId, input.groupId), eq(userGroupMembers.orgId, orgId))),
        db.select({ id: users.id, name: users.name, code: users.code })
          .from(users)
          .where(and(eq(users.orgId, orgId), eq(users.isActive, true), or(ilike(users.name, q), ilike(users.code, q))))
          .orderBy(asc(users.name))
          .limit(20),
        db.select({ id: userGroups.id, name: userGroups.name, code: userGroups.code })
          .from(userGroups)
          .where(and(eq(userGroups.orgId, orgId), eq(userGroups.isActive, true), ne(userGroups.id, input.groupId), or(ilike(userGroups.name, q), ilike(userGroups.code, q))))
          .orderBy(asc(userGroups.name))
          .limit(10),
      ]);

      const existingUserIds  = new Set(existingMembers.flatMap(m => m.memberUserId  != null ? [m.memberUserId]  : []));
      const existingGroupIds = new Set(existingMembers.flatMap(m => m.memberGroupId != null ? [m.memberGroupId] : []));

      return {
        users:  allUsers .filter(u => !existingUserIds .has(u.id)).slice(0, 12).map(u => ({ ...u, type: 'user'  as const })),
        groups: allGroups.filter(g => !existingGroupIds.has(g.id)).slice(0, 6) .map(g => ({ ...g, type: 'group' as const })),
      };
    }),

  // ── Dialog-facing full list procedures ────────────────────────────────────

  listUsersForDialog: protectedProcedure
    .input(z.object({
      groupId:      z.number(),
      query:        z.string().optional(),
      showInactive: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;

      const existingMembers = await db
        .select({ memberUserId: userGroupMembers.memberUserId })
        .from(userGroupMembers)
        .where(and(eq(userGroupMembers.groupId, input.groupId), eq(userGroupMembers.orgId, orgId), isNotNull(userGroupMembers.memberUserId)));
      const existingUserIds = new Set(existingMembers.flatMap(m => m.memberUserId != null ? [m.memberUserId] : []));

      const q = input.query?.trim() ? `%${input.query.trim()}%` : null;

      // Pre-fetch all categories for this org (used for both name search and display)
      const allCategories = await db
        .select({ id: userCategories.id, name: userCategories.name })
        .from(userCategories)
        .where(eq(userCategories.orgId, orgId));
      const catMap: Record<number, string> = {};
      allCategories.forEach(c => { catMap[c.id] = c.name; });

      // Category IDs matching the search query (for filtering by category name)
      const matchingCatIds = q
        ? allCategories.filter(c => c.name.toLowerCase().includes(input.query!.trim().toLowerCase())).map(c => c.id)
        : [];

      const baseConditions: any[] = [eq(users.orgId, orgId)];
      if (!input.showInactive) baseConditions.push(eq(users.isActive, true));
      if (q) {
        const nameCodeCondition = or(ilike(users.name, q), ilike(users.code, q), ilike(users.username, q));
        const catCondition = matchingCatIds.length ? inArray(users.categoryId, matchingCatIds) : undefined;
        baseConditions.push(catCondition ? or(nameCodeCondition, catCondition) : nameCodeCondition);
      }

      const allUsers = await db
        .select({ id: users.id, name: users.name, code: users.code, username: users.username, isActive: users.isActive, categoryId: users.categoryId })
        .from(users)
        .where(and(...baseConditions))
        .orderBy(asc(users.name))
        .limit(300);

      return allUsers.map(u => ({
        id: u.id, name: u.name, code: u.code, username: u.username,
        isActive: u.isActive,
        categoryName: u.categoryId ? (catMap[u.categoryId] ?? null) : null,
        alreadyAdded: existingUserIds.has(u.id),
      }));
    }),

  listGroupsForDialog: protectedProcedure
    .input(z.object({
      groupId: z.number(),
      query:   z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;

      const existingMembers = await db
        .select({ memberGroupId: userGroupMembers.memberGroupId })
        .from(userGroupMembers)
        .where(and(eq(userGroupMembers.groupId, input.groupId), eq(userGroupMembers.orgId, orgId), isNotNull(userGroupMembers.memberGroupId)));
      const existingGroupIds = new Set(existingMembers.flatMap(m => m.memberGroupId != null ? [m.memberGroupId] : []));

      const q = input.query?.trim() ? `%${input.query.trim()}%` : null;
      const groupConditions: any[] = [eq(userGroups.orgId, orgId), eq(userGroups.isActive, true), ne(userGroups.id, input.groupId)];
      if (q) groupConditions.push(or(ilike(userGroups.name, q), ilike(userGroups.code, q)));

      const allGroups = await db
        .select({ id: userGroups.id, name: userGroups.name, code: userGroups.code })
        .from(userGroups)
        .where(and(...groupConditions))
        .orderBy(asc(userGroups.name))
        .limit(300);

      // Load all org memberships once (type + memberUserId + memberGroupId) for counts + cycle analysis
      const allMemberships = await db
        .select({
          groupId:       userGroupMembers.groupId,
          memberType:    userGroupMembers.memberType,
          memberUserId:  userGroupMembers.memberUserId,
          memberGroupId: userGroupMembers.memberGroupId,
        })
        .from(userGroupMembers)
        .where(eq(userGroupMembers.orgId, orgId));

      // Direct member count per group
      const directCountMap: Record<number, number> = {};
      for (const m of allMemberships) {
        directCountMap[m.groupId] = (directCountMap[m.groupId] ?? 0) + 1;
      }

      // Forward adjacency: groupId → set of member group IDs (for effective-user BFS)
      const forwardGraph = new Map<number, number[]>();
      // Per-group direct user sets
      const directUserMap = new Map<number, Set<number>>();
      for (const m of allMemberships) {
        if (m.memberType === 'user' && m.memberUserId != null) {
          if (!directUserMap.has(m.groupId)) directUserMap.set(m.groupId, new Set());
          directUserMap.get(m.groupId)!.add(m.memberUserId);
        }
        if (m.memberType === 'group' && m.memberGroupId != null) {
          if (!forwardGraph.has(m.groupId)) forwardGraph.set(m.groupId, []);
          forwardGraph.get(m.groupId)!.push(m.memberGroupId);
        }
      }

      function computeEffectiveCount(gId: number): number {
        const visitedG = new Set<number>();
        const userIds  = new Set<number>();
        const q2 = [gId];
        while (q2.length) {
          const cur = q2.shift()!;
          if (visitedG.has(cur)) continue;
          visitedG.add(cur);
          for (const uid of (directUserMap.get(cur) ?? [])) userIds.add(uid);
          for (const child of (forwardGraph.get(cur) ?? [])) if (!visitedG.has(child)) q2.push(child);
        }
        return userIds.size;
      }

      // Reverse-BFS from targetGroup to compute cycle risks
      const reverseGraph = new Map<number, number[]>();
      for (const m of allMemberships) {
        if (m.memberGroupId == null) continue;
        if (!reverseGraph.has(m.memberGroupId)) reverseGraph.set(m.memberGroupId, []);
        reverseGraph.get(m.memberGroupId)!.push(m.groupId);
      }
      const cycleRiskIds = new Set<number>();
      const bfsQ = [input.groupId];
      const bfsVisited = new Set<number>();
      while (bfsQ.length) {
        const cur = bfsQ.shift()!;
        if (bfsVisited.has(cur)) continue;
        bfsVisited.add(cur);
        for (const parent of (reverseGraph.get(cur) ?? [])) {
          cycleRiskIds.add(parent);
          bfsQ.push(parent);
        }
      }

      return allGroups.map(g => ({
        id: g.id, name: g.name, code: g.code,
        directMemberCount:    directCountMap[g.id] ?? 0,
        effectiveMemberCount: computeEffectiveCount(g.id),
        alreadyAdded:         existingGroupIds.has(g.id),
        cycleRisk:            cycleRiskIds.has(g.id),
        cycleReason:          cycleRiskIds.has(g.id) ? 'لا يمكن اختيار هذه المجموعة لأنها ستُنشئ علاقة دائرية' : null,
      }));
    }),

  addBulk: protectedProcedure
    .input(z.object({
      groupId: z.number(),
      members: z.array(z.object({
        memberType:    z.enum(['user', 'group']),
        memberUserId:  z.number().optional(),
        memberGroupId: z.number().optional(),
      })).min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      let added = 0;
      const skipped: string[] = [];

      for (const m of input.members) {
        try {
          if (m.memberType === 'user' && m.memberUserId) {
            const [u] = await db
              .select({ id: users.id, name: users.name, code: users.code })
              .from(users).where(and(eq(users.id, m.memberUserId), eq(users.orgId, orgId))).limit(1);
            if (!u) { skipped.push(`مستخدم #${m.memberUserId} غير موجود`); continue; }
            const ex = await db.select({ id: userGroupMembers.id }).from(userGroupMembers)
              .where(and(eq(userGroupMembers.groupId, input.groupId), eq(userGroupMembers.orgId, orgId), eq(userGroupMembers.memberUserId, u.id))).limit(1);
            if (ex.length) { skipped.push(`${u.name} مضاف بالفعل`); continue; }
            await db.insert(userGroupMembers).values({
              groupId: input.groupId, orgId, memberType: 'user',
              memberUserId: u.id, memberCode: u.code, memberName: u.name,
            }).onConflictDoNothing();
            added++;
          } else if (m.memberType === 'group' && m.memberGroupId) {
            const [g] = await db
              .select({ id: userGroups.id, name: userGroups.name, code: userGroups.code })
              .from(userGroups).where(and(eq(userGroups.id, m.memberGroupId), eq(userGroups.orgId, orgId), eq(userGroups.isActive, true))).limit(1);
            if (!g) { skipped.push(`مجموعة #${m.memberGroupId} غير موجودة`); continue; }
            if (g.id === input.groupId) { skipped.push(`${g.name}: لا يمكن إضافة المجموعة إلى نفسها`); continue; }
            if (await wouldCreateCycle(input.groupId, g.id, orgId)) { skipped.push(`${g.name}: دورة مرجعية`); continue; }
            const ex = await db.select({ id: userGroupMembers.id }).from(userGroupMembers)
              .where(and(eq(userGroupMembers.groupId, input.groupId), eq(userGroupMembers.orgId, orgId), eq(userGroupMembers.memberGroupId, g.id))).limit(1);
            if (ex.length) { skipped.push(`${g.name} مضافة بالفعل`); continue; }
            await db.insert(userGroupMembers).values({
              groupId: input.groupId, orgId, memberType: 'group',
              memberGroupId: g.id, memberCode: g.code, memberName: g.name,
            }).onConflictDoNothing();
            added++;
          }
        } catch (err: any) {
          if (err?.code !== '23505') throw err;
        }
      }

      return { added, skipped };
    }),
});

export const qrSettingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.select().from(qrSettings)
      .where(eq(qrSettings.orgId, ctx.user.orgId)).limit(1);
    return rows[0] ?? null;
  }),

  upsert: protectedProcedure
    .input(z.object({
      isEnabled:             z.boolean().optional(),
      countrySystem:         z.enum(['zatca', 'eta', 'custom']).optional(),
      customFormat:          z.string().optional().nullable(),
      sellerName:            z.string().optional().nullable(),
      taxNumber:             z.string().optional().nullable(),
      showOnSalesInvoice:    z.boolean().optional(),
      showOnPurchaseInvoice: z.boolean().optional(),
      showOnReceiptVoucher:  z.boolean().optional(),
      qrSize:                z.number().min(50).max(300).optional(),
      qrPosition:            z.string().optional(),
      notes:                 z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.select({ id: qrSettings.id }).from(qrSettings)
        .where(eq(qrSettings.orgId, ctx.user.orgId)).limit(1);
      if (existing.length) {
        const [updated] = await db.update(qrSettings)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(qrSettings.orgId, ctx.user.orgId))
          .returning();
        return updated;
      } else {
        const [inserted] = await db.insert(qrSettings)
          .values({ orgId: ctx.user.orgId, ...input })
          .returning();
        return inserted;
      }
    }),
});

export const branchesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.branches.findMany({
      where: and(eq(branches.orgId, ctx.user.orgId), eq(branches.isActive, true)),
      orderBy: (b, { asc }) => [asc(b.name)],
    });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), address: z.string().optional(), phone: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [b] = await db.insert(branches).values({ ...input, orgId: ctx.user.orgId, isActive: true }).returning();
      return b;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).optional(), address: z.string().optional(), phone: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const current = await db.query.branches.findFirst({
        where: and(eq(branches.id, id), eq(branches.orgId, ctx.user.orgId)),
      });
      if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'الفرع غير موجود' });
      assertCanUpdate(current.recordPolicy, current.name, ctx.user.role === 'superadmin');
      await db.update(branches).set(data as any).where(and(eq(branches.id, id), eq(branches.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const current = await db.query.branches.findFirst({
        where: and(eq(branches.id, input.id), eq(branches.orgId, ctx.user.orgId)),
      });
      if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'الفرع غير موجود' });
      assertCanDelete(current.recordPolicy, current.name, ctx.user.role === 'superadmin');
      const [hasWarehouses, hasInventoryCounts] = await Promise.all([
        db.select({ id: warehouses.id }).from(warehouses)
          .where(and(eq(warehouses.branchId, input.id), eq(warehouses.orgId, ctx.user.orgId), eq(warehouses.isActive, true))).limit(1),
        db.select({ id: inventoryCounts.id }).from(inventoryCounts)
          .where(and(eq(inventoryCounts.branchId, input.id), eq(inventoryCounts.orgId, ctx.user.orgId))).limit(1),
      ]);
      if (hasWarehouses.length > 0)     throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف الفرع لأنه مرتبط بمخازن' });
      if (hasInventoryCounts.length > 0)throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف الفرع لأنه مرتبط بعمليات جرد مخزني' });
      await db.update(branches).set({ isActive: false })
        .where(and(eq(branches.id, input.id), eq(branches.orgId, ctx.user.orgId)));
      return { success: true };
    }),
});

export const unitsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.units.findMany({ where: eq(units.orgId, ctx.user.orgId), orderBy: (u, { asc }) => [asc(u.name)] });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), symbol: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [u] = await db.insert(units).values({ ...input, orgId: ctx.user.orgId }).returning();
      return u;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).optional(), symbol: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const current = await db.query.units.findFirst({
        where: and(eq(units.id, id), eq(units.orgId, ctx.user.orgId)),
      });
      if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'وحدة القياس غير موجودة' });
      assertCanUpdate(current.recordPolicy, current.name, ctx.user.role === 'superadmin');
      await db.update(units).set(data as any).where(and(eq(units.id, id), eq(units.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const current = await db.query.units.findFirst({
        where: and(eq(units.id, input.id), eq(units.orgId, ctx.user.orgId)),
      });
      if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'وحدة القياس غير موجودة' });
      assertCanDelete(current.recordPolicy, current.name, ctx.user.role === 'superadmin');
      await db.delete(units).where(and(eq(units.id, input.id), eq(units.orgId, ctx.user.orgId)));
      return { success: true };
    }),
});

export const freeProductsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.freeProducts.findMany({
      where: and(eq(freeProducts.orgId, ctx.user.orgId), eq(freeProducts.isActive, true)),
      orderBy: [desc(freeProducts.createdAt)],
    });
  }),

  create: protectedProcedure
    .input(z.object({
      productId:   z.number().optional(),
      productCode: z.string().optional(),
      productName: z.string().min(1),
      unit:        z.string().optional(),
      baseQty:     z.string().default('1'),
      freeQty:     z.string().default('1'),
      offerStart:  z.string().optional(),
      offerEnd:    z.string().optional(),
      notes:       z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db.insert(freeProducts).values({
        orgId:       ctx.user.orgId,
        productId:   input.productId,
        productCode: input.productCode,
        productName: input.productName,
        unit:        input.unit,
        baseQty:     input.baseQty,
        freeQty:     input.freeQty,
        offerStart:  input.offerStart ? new Date(input.offerStart) : undefined,
        offerEnd:    input.offerEnd   ? new Date(input.offerEnd)   : undefined,
        notes:       input.notes,
      }).returning();
      return row;
    }),

  update: protectedProcedure
    .input(z.object({
      id:          z.number(),
      productCode: z.string().optional(),
      productName: z.string().optional(),
      unit:        z.string().optional(),
      baseQty:     z.string().optional(),
      freeQty:     z.string().optional(),
      offerStart:  z.string().optional(),
      offerEnd:    z.string().optional(),
      notes:       z.string().optional(),
      isActive:    z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, offerStart, offerEnd, ...rest } = input;
      await db.update(freeProducts).set({
        ...rest,
        offerStart: offerStart ? new Date(offerStart) : undefined,
        offerEnd:   offerEnd   ? new Date(offerEnd)   : undefined,
      } as any).where(and(eq(freeProducts.id, id), eq(freeProducts.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(freeProducts).set({ isActive: false } as any)
        .where(and(eq(freeProducts.id, input.id), eq(freeProducts.orgId, ctx.user.orgId)));
      return { success: true };
    }),
});
