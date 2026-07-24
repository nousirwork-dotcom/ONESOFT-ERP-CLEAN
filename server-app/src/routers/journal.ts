import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { journalEntries, journalEntryLines, chartOfAccounts } from '../schema.js';
import { eq, and, desc, asc, inArray, sql } from 'drizzle-orm';

export const journalRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.journalEntries.findMany({
      where: eq(journalEntries.orgId, ctx.user.orgId),
      orderBy: [desc(journalEntries.createdAt)],
      limit: 100,
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const entry = await db.query.journalEntries.findFirst({
        where: and(eq(journalEntries.id, input.id), eq(journalEntries.orgId, ctx.user.orgId)),
      });
      if (!entry) throw new Error('القيد غير موجود');
      const lines = await db.query.journalEntryLines.findMany({
        where: eq(journalEntryLines.entryId, input.id),
        orderBy: (l, { asc }) => [asc(l.sortOrder)],
      });
      return { ...entry, lines };
    }),

  nextNumber: protectedProcedure.query(async ({ ctx }) => {
    const last = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.orgId, ctx.user.orgId),
      orderBy: [desc(journalEntries.id)],
    });
    const raw = last ? parseInt(last.entryNumber.replace(/\D/g, '') || '0') : 0;
    const num = raw > 9_000_000 ? 1 : raw + 1;
    return `JE-${String(num).padStart(4, '0')}`;
  }),

  create: protectedProcedure
    .input(z.object({
      entryDate:       z.string(),
      description:     z.string().optional(),
      reference:       z.string().optional(),
      totalDebit:      z.string(),
      totalCredit:     z.string(),
      sourceDocType:   z.string().optional(),
      sourceDocId:     z.number().optional(),
      sourceDocNumber: z.string().optional(),
      entryType:       z.enum(['manual', 'auto']).optional(),
      status:          z.enum(['draft', 'posted', 'cancelled']).optional(),
      lines: z.array(z.object({
        accountId:   z.number().optional(),
        accountCode: z.string().optional(),
        accountName: z.string().optional(),
        description: z.string().optional(),
        debit:       z.string().default('0'),
        credit:      z.string().default('0'),
        sortOrder:   z.number().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { lines, entryDate, ...rest } = input;

      // 1) المدين = الدائن
      const totalD = lines.reduce((s, l) => s + parseFloat(l.debit  ?? '0'), 0);
      const totalC = lines.reduce((s, l) => s + parseFloat(l.credit ?? '0'), 0);
      if (Math.abs(totalD - totalC) > 0.001)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حفظ القيد: المدين لا يساوي الدائن' });

      // 2) التحقق من سلامة الحسابات
      const accountIds = lines.map(l => l.accountId).filter((id): id is number => !!id);
      if (accountIds.length > 0) {
        const accs = await db.query.chartOfAccounts.findMany({ where: inArray(chartOfAccounts.id, accountIds) });
        const accMap = new Map(accs.map(a => [a.id, a]));
        for (const l of lines) {
          if (!l.accountId) continue;
          const acc = accMap.get(l.accountId);
          if (!acc)
            throw new TRPCError({ code: 'BAD_REQUEST', message: `الحساب بالكود ${l.accountCode ?? l.accountId} غير موجود` });
          if (!acc.isActive)
            throw new TRPCError({ code: 'BAD_REQUEST', message: `الحساب "${acc.code} - ${acc.name}" موقوف ولا يمكن الترحيل عليه` });
          if (acc.isParent)
            throw new TRPCError({ code: 'BAD_REQUEST', message: `الحساب "${acc.code} - ${acc.name}" تجميعي — يجب اختيار حساب فرعي` });
          if (acc.allowPosting === false)
            throw new TRPCError({ code: 'BAD_REQUEST', message: `الحساب "${acc.code} - ${acc.name}" لا يسمح بالترحيل` });
        }
      }

      // 3) توليد الرقم التسلسلي ذرياً مع advisory lock لمنع race conditions
      // المسودة لا تستهلك الرقم الرسمي من مسلسل القيود.
      const orgId = ctx.user.orgId;
      const isDraft = rest.status === 'draft';
      const entry = await db.transaction(async (tx) => {
        let entryNumber: string;
        if (isDraft) {
          entryNumber = `DRAFT-${Date.now()}`;
        } else {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${orgId}::bigint)`);
          const lastEntry = await tx.query.journalEntries.findFirst({
            where: eq(journalEntries.orgId, orgId),
            orderBy: [desc(journalEntries.id)],
          });
          const lastNum = lastEntry ? parseInt(lastEntry.entryNumber.replace(/\D/g, '') || '0') : 0;
          const safeLastNum = lastNum > 9_000_000 ? 0 : lastNum;
          entryNumber = `JE-${String(safeLastNum + 1).padStart(4, '0')}`;
        }
        const [newEntry] = await tx.insert(journalEntries).values({
          ...rest,
          entryNumber,
          entryType: rest.entryType ?? 'manual',
          orgId,
          userId: ctx.user.id,
          entryDate: new Date(entryDate),
          status: isDraft ? 'draft' : 'posted',
        }).returning();
        if (lines.length > 0) {
          await tx.insert(journalEntryLines).values(
            lines.map((l, i) => ({ ...l, entryId: newEntry.id, orgId, sortOrder: l.sortOrder ?? i }))
          );
        }
        return newEntry;
      });
      return entry;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(journalEntries)
        .set({ status: 'cancelled' })
        .where(and(eq(journalEntries.id, input.id), eq(journalEntries.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  getByNumber: protectedProcedure
    .input(z.object({ entryNumber: z.string() }))
    .query(async ({ ctx, input }) => {
      const entry = await db.query.journalEntries.findFirst({
        where: and(eq(journalEntries.entryNumber, input.entryNumber), eq(journalEntries.orgId, ctx.user.orgId)),
      });
      if (!entry) return null;
      const lines = await db.query.journalEntryLines.findMany({
        where: eq(journalEntryLines.entryId, entry.id),
        orderBy: (l, { asc }) => [asc(l.sortOrder)],
      });
      return { ...entry, lines };
    }),
});
