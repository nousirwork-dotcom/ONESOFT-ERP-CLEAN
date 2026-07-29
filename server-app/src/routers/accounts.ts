import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { chartOfAccounts, costCenters, journalEntryLines } from '../schema.js';
import { eq, and, asc, isNull } from 'drizzle-orm';

// ─── ثوابت أنواع السجلات ──────────────────────────────────────────────────────
const RECORD_TYPE_LABELS: Record<string, string> = {
  system_protected: 'نظامي محمي',
  system_editable:  'نظامي قابل للتعديل',
  system_flexible:  'نظامي مرن',
  user:             'سجل مستخدم',
};

/** فحص إذا كان الحذف مسموحاً به بحسب نوع السجل */
function assertCanDelete(recordType: string, name: string): void {
  if (recordType === 'system_protected') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `لا يمكن حذف هذا السجل — سجل نظامي محمي (${name})` });
  }
  if (recordType === 'system_editable') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `لا يمكن حذف هذا السجل لوجود حركات أو بيانات مرتبطة به` });
  }
}

/** فحص إذا كان التعديل مسموحاً به */
function assertCanEdit(recordType: string, name: string): void {
  if (recordType === 'system_protected') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `لا يمكن تعديل هذا السجل — سجل نظامي محمي (${name})` });
  }
}

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
          recordType:   chartOfAccounts.recordType,
          systemKey:    chartOfAccounts.systemKey,
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
        recordType: 'user',   // العميل يضيف سجلات مستخدم دائماً
        systemKey: null,
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

  update: protectedProcedure
    .input(z.object({
      id:             z.number().int(),
      name:           z.string().min(1).optional(),
      nameEn:         z.string().optional(),
      notes:          z.string().optional(),
      openingBalance: z.string().optional(),
      openingBalanceType: z.string().optional(),
      costCenterType: z.enum(['not_allowed', 'optional', 'mandatory']).optional(),
      isActive:       z.boolean().optional(),
      nature:         z.string().optional(),
      allowPosting:   z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [acct] = await db
        .select({ id: chartOfAccounts.id, recordType: chartOfAccounts.recordType, name: chartOfAccounts.name })
        .from(chartOfAccounts)
        .where(and(eq(chartOfAccounts.id, input.id), eq(chartOfAccounts.orgId, ctx.user.orgId)))
        .limit(1);

      if (!acct) throw new TRPCError({ code: 'NOT_FOUND', message: 'الحساب غير موجود' });

      assertCanEdit(acct.recordType ?? 'user', acct.name ?? '');

      // system_editable: يسمح فقط بتغيير الاسم والملاحظات
      const { id: _id, ...updates } = input;
      let safeUpdates: Record<string, unknown> = {};

      if (acct.recordType === 'system_editable') {
        if (input.name !== undefined)  safeUpdates.name   = input.name;
        if (input.nameEn !== undefined) safeUpdates.nameEn = input.nameEn;
        if (input.notes !== undefined)  safeUpdates.notes  = input.notes;
      } else {
        // system_flexible / user: كل الحقول المسموح بها
        safeUpdates = Object.fromEntries(
          Object.entries(updates).filter(([, v]) => v !== undefined)
        );
      }

      if (Object.keys(safeUpdates).length === 0) return { success: true };

      await db.update(chartOfAccounts).set(safeUpdates as any)
        .where(and(eq(chartOfAccounts.id, input.id), eq(chartOfAccounts.orgId, ctx.user.orgId)));

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [acct] = await db
        .select({
          id:         chartOfAccounts.id,
          name:       chartOfAccounts.name,
          recordType: chartOfAccounts.recordType,
        })
        .from(chartOfAccounts)
        .where(and(eq(chartOfAccounts.id, input.id), eq(chartOfAccounts.orgId, ctx.user.orgId)))
        .limit(1);

      if (!acct) throw new TRPCError({ code: 'NOT_FOUND', message: 'الحساب غير موجود' });

      // فحص نوع السجل
      assertCanDelete(acct.recordType ?? 'user', acct.name ?? '');

      // فحص حسابات فرعية
      const children = await db
        .select({ id: chartOfAccounts.id })
        .from(chartOfAccounts)
        .where(and(
          eq(chartOfAccounts.parentId, input.id),
          eq(chartOfAccounts.orgId, ctx.user.orgId),
          eq(chartOfAccounts.isActive, true),
        ))
        .limit(1);
      if (children.length > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف هذا السجل لوجود حركات أو بيانات مرتبطة به' });
      }

      // فحص قيود محاسبية مرتبطة
      const lines = await db
        .select({ id: journalEntryLines.id })
        .from(journalEntryLines)
        .where(eq(journalEntryLines.accountId, input.id))
        .limit(1);
      if (lines.length > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف هذا السجل لوجود حركات أو بيانات مرتبطة به' });
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
      await db.insert(chartOfAccounts).values(
        toInsert.map(a => ({ ...a, orgId: ctx.user.orgId, recordType: 'user', systemKey: null }))
      );
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
