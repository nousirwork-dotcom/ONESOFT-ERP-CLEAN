import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { chartOfAccounts, costCenters } from '../schema.js';
import { eq, and, asc, isNull } from 'drizzle-orm';

export const accountsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.chartOfAccounts.findMany({
      where: and(eq(chartOfAccounts.orgId, ctx.user.orgId), eq(chartOfAccounts.isActive, true)),
      orderBy: (a, { asc }) => [asc(a.code)],
    });
  }),

  children: protectedProcedure
    .input(z.object({ parentId: z.number().int().nullable() }))
    .query(async ({ ctx, input }) => {
      const parentCond = input.parentId === null
        ? isNull(chartOfAccounts.parentId)
        : eq(chartOfAccounts.parentId, input.parentId);
      return db
        .select({
          id:           chartOfAccounts.id,
          code:         chartOfAccounts.code,
          name:         chartOfAccounts.name,
          accountType:  chartOfAccounts.accountType,
          nature:       chartOfAccounts.nature,
          level:        chartOfAccounts.level,
          isParent:     chartOfAccounts.isParent,
          allowPosting: chartOfAccounts.allowPosting,
          parentId:     chartOfAccounts.parentId,
        })
        .from(chartOfAccounts)
        .where(and(
          eq(chartOfAccounts.orgId, ctx.user.orgId),
          eq(chartOfAccounts.isActive, true),
          parentCond,
        ))
        .orderBy(asc(chartOfAccounts.code));
    }),

  create: protectedProcedure
    .input(z.object({
      code:           z.string().min(1),
      name:           z.string().min(1),
      nameEn:         z.string().optional(),
      accountType:    z.string().default('assets'),
      nature:         z.string().default('debit'),
      level:          z.number().int().min(1).max(10).default(1),
      parentId:       z.number().int().optional(),
      isParent:       z.boolean().default(false),
      allowPosting:   z.boolean().default(true),
      costCenterType: z.enum(['not_allowed', 'optional', 'mandatory']).default('not_allowed'),
      isActive:       z.boolean().default(true),
      notes:          z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const exists = await db.select({ id: chartOfAccounts.id }).from(chartOfAccounts)
        .where(and(eq(chartOfAccounts.orgId, ctx.user.orgId), eq(chartOfAccounts.code, input.code), eq(chartOfAccounts.isActive, true)))
        .limit(1);
      if (exists.length > 0) throw new TRPCError({ code: 'BAD_REQUEST', message: `كود الحساب "${input.code}" موجود بالفعل` });
      if (input.parentId) {
        const parent = await db.select({ id: chartOfAccounts.id, isParent: chartOfAccounts.isParent }).from(chartOfAccounts)
          .where(and(eq(chartOfAccounts.id, input.parentId), eq(chartOfAccounts.orgId, ctx.user.orgId)))
          .limit(1);
        if (!parent.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'الحساب الأب غير موجود' });
        if (!parent[0].isParent) throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن إضافة حساب تحت حساب فرعي — الحساب الفرعي لا يقبل حسابات تحته' });
      }
      const insertData: Record<string, unknown> = {
        orgId: ctx.user.orgId,
        code: input.code, name: input.name,
        accountType: input.accountType, nature: input.nature,
        level: input.level, isParent: input.isParent,
        allowPosting: input.allowPosting, costCenterType: input.costCenterType,
        isActive: input.isActive,
      };
      if (input.nameEn)   insertData.nameEn   = input.nameEn;
      if (input.parentId) insertData.parentId  = input.parentId;
      if (input.notes)    insertData.notes     = input.notes;
      const [account] = await db.insert(chartOfAccounts).values(insertData as any).returning();
      if (input.parentId) {
        await db.update(chartOfAccounts).set({ isParent: true })
          .where(and(eq(chartOfAccounts.id, input.parentId), eq(chartOfAccounts.orgId, ctx.user.orgId)));
      }
      return account;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const children = await db
        .select({ id: chartOfAccounts.id, code: chartOfAccounts.code, name: chartOfAccounts.name })
        .from(chartOfAccounts)
        .where(and(
          eq(chartOfAccounts.parentId, input.id),
          eq(chartOfAccounts.orgId, ctx.user.orgId),
          eq(chartOfAccounts.isActive, true),
        ))
        .limit(1);
      if (children.length > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `لا يمكن حذف هذا الحساب لأنه يحتوي على حسابات فرعية — يجب حذف الحسابات الفرعية أولاً` });
      }
      await db.update(chartOfAccounts).set({ isActive: false })
        .where(and(eq(chartOfAccounts.id, input.id), eq(chartOfAccounts.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  import: protectedProcedure
    .input(z.object({
      accounts: z.array(z.object({
        code:               z.string().min(1),
        name:               z.string().min(1),
        nameEn:             z.string().optional(),
        accountType:        z.string().default('assets'),
        nature:             z.string().default('debit'),
        level:              z.number().int().min(1).max(10).default(1),
        isParent:           z.boolean().default(false),
        allowPosting:       z.boolean().default(true),
        openingBalance:     z.string().optional(),
        openingBalanceType: z.string().default('debit'),
      })),
      skipDuplicates: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.select({ code: chartOfAccounts.code }).from(chartOfAccounts)
        .where(and(eq(chartOfAccounts.orgId, ctx.user.orgId), eq(chartOfAccounts.isActive, true)));
      const existingCodes = new Set(existing.map(r => r.code));
      const toInsert = input.accounts.filter(a => !existingCodes.has(a.code) || !input.skipDuplicates);
      if (toInsert.length === 0) return { inserted: 0, skipped: input.accounts.length };
      await db.insert(chartOfAccounts).values(toInsert.map(a => ({ ...a, orgId: ctx.user.orgId })));
      return { inserted: toInsert.length, skipped: input.accounts.length - toInsert.length };
    }),
});

export const costCentersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(costCenters)
      .where(and(eq(costCenters.orgId, ctx.user.orgId), eq(costCenters.isActive, true)))
      .orderBy(asc(costCenters.code));
  }),

  create: protectedProcedure
    .input(z.object({
      code:       z.string().min(1),
      name:       z.string().min(1),
      name2:      z.string().optional(),
      centerType: z.enum(['root', 'general', 'branch']).default('branch'),
      parentId:   z.number().optional(),
      level:      z.number().default(1),
      notes:      z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [c] = await db.insert(costCenters).values({ ...input, orgId: ctx.user.orgId }).returning();
      return c;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(costCenters)
        .set({ isActive: false })
        .where(and(eq(costCenters.id, input.id), eq(costCenters.orgId, ctx.user.orgId)));
      return { success: true };
    }),
});
