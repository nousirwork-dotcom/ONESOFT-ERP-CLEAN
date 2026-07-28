import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { chartOfAccounts, journalEntries, journalEntryLines, pendingAccountMovements } from '../schema.js';
import { eq, and, asc, gte, lte } from 'drizzle-orm';

export const accountingRouter = router({
  trialBalance: protectedProcedure
    .input(z.object({
      fromDate:     z.date().optional(),
      toDate:       z.date().optional(),
      costCenterId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { fromDate, toDate } = input;
      const endOfDay = (d: Date) => new Date(d.getTime() + 86399999);

      const [accounts, allLines, pendingLines] = await Promise.all([
        db.select({
          id:                 chartOfAccounts.id,
          code:               chartOfAccounts.code,
          name:               chartOfAccounts.name,
          nature:             chartOfAccounts.nature,
          isParent:           chartOfAccounts.isParent,
          level:              chartOfAccounts.level,
          parentId:           chartOfAccounts.parentId,
          accountType:        chartOfAccounts.accountType,
          openingBalance:     chartOfAccounts.openingBalance,
          openingBalanceType: chartOfAccounts.openingBalanceType,
        }).from(chartOfAccounts)
          .where(and(eq(chartOfAccounts.orgId, ctx.user.orgId), eq(chartOfAccounts.isActive, true)))
          .orderBy(asc(chartOfAccounts.code)),
        db.select({
          accountId: journalEntryLines.accountId,
          debit:     journalEntryLines.debit,
          credit:    journalEntryLines.credit,
          entryDate: journalEntries.entryDate,
        }).from(journalEntryLines)
          .innerJoin(journalEntries, and(
            eq(journalEntries.id, journalEntryLines.entryId),
            eq(journalEntries.status, 'posted'),
            eq(journalEntries.orgId, ctx.user.orgId),
          ))
          .where(eq(journalEntryLines.orgId, ctx.user.orgId)),
        db.select({
          accountId: pendingAccountMovements.accountId,
          debit: pendingAccountMovements.debit,
          credit: pendingAccountMovements.credit,
          entryDate: pendingAccountMovements.movementDate,
        }).from(pendingAccountMovements).where(and(
          eq(pendingAccountMovements.orgId, ctx.user.orgId),
          eq(pendingAccountMovements.status, 'unposted'),
        )),
      ]);

      type Agg = { priorD: number; priorC: number; moveD: number; moveC: number };
      const agg = new Map<number, Agg>();

      for (const ln of allLines) {
        if (!ln.accountId) continue;
        const d  = parseFloat(ln.debit  ?? '0');
        const cr = parseFloat(ln.credit ?? '0');
        const dt = ln.entryDate;

        const isPrior    = fromDate ? dt < fromDate : false;
        const isInPeriod = fromDate
          ? dt >= fromDate && (!toDate || dt <= endOfDay(toDate))
          : (!toDate || dt <= endOfDay(toDate));

        if (!agg.has(ln.accountId)) agg.set(ln.accountId, { priorD: 0, priorC: 0, moveD: 0, moveC: 0 });
        const a = agg.get(ln.accountId)!;
        if (isPrior)         { a.priorD += d; a.priorC += cr; }
        else if (isInPeriod) { a.moveD  += d; a.moveC  += cr; }
      }
      for (const ln of pendingLines) {
        if (!ln.accountId) continue;
        const d = parseFloat(ln.debit ?? '0');
        const cr = parseFloat(ln.credit ?? '0');
        const dt = ln.entryDate;
        const isPrior = fromDate ? dt < fromDate : false;
        const isInPeriod = fromDate
          ? dt >= fromDate && (!toDate || dt <= endOfDay(toDate))
          : (!toDate || dt <= endOfDay(toDate));
        if (!agg.has(ln.accountId)) agg.set(ln.accountId, { priorD: 0, priorC: 0, moveD: 0, moveC: 0 });
        const a = agg.get(ln.accountId)!;
        if (isPrior) { a.priorD += d; a.priorC += cr; }
        else if (isInPeriod) { a.moveD += d; a.moveC += cr; }
      }

      return accounts.map(acc => {
        const a          = agg.get(acc.id);
        const schemaOpen = parseFloat(acc.openingBalance ?? '0');
        let openD = acc.openingBalanceType === 'debit'  ? schemaOpen : 0;
        let openC = acc.openingBalanceType === 'credit' ? schemaOpen : 0;
        if (a) { openD += a.priorD; openC += a.priorC; }
        const moveD    = a?.moveD ?? 0;
        const moveC    = a?.moveC ?? 0;
        const netOpen  = openD - openC;
        const netClose = netOpen + moveD - moveC;
        return {
          accountId:          acc.id,
          code:               acc.code,
          name:               acc.name,
          nature:             acc.nature ?? 'debit',
          isParent:           acc.isParent ?? false,
          level:              acc.level,
          parentId:           acc.parentId ?? null,
          accountType:        acc.accountType,
          openingBalance:     Math.abs(netOpen),
          openingBalanceType: netOpen  >= 0 ? 'debit' : 'credit',
          movementDebit:      moveD,
          movementCredit:     moveC,
          closingBalance:     Math.abs(netClose),
          closingBalanceType: netClose >= 0 ? 'debit' : 'credit',
        };
      });
    }),

  accountStatement: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      fromDate:  z.date().optional(),
      toDate:    z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { accountId, fromDate, toDate } = input;
      const endOfDay = (d: Date) => new Date(d.getTime() + 86399999);

      const conds: ReturnType<typeof eq>[] = [
        eq(journalEntryLines.accountId, accountId),
        eq(journalEntryLines.orgId, ctx.user.orgId),
        eq(journalEntries.status, 'posted'),
      ];
      if (fromDate) conds.push(gte(journalEntries.entryDate, fromDate) as any);
      if (toDate)   conds.push(lte(journalEntries.entryDate, endOfDay(toDate)) as any);

      const lines = await db.select({
        entryId:       journalEntryLines.entryId,
        entryDate:     journalEntries.entryDate,
        entryNumber:   journalEntries.entryNumber,
        reference:     journalEntries.reference,
        sourceDocType: journalEntries.sourceDocType,
        description:   journalEntries.description,
        lineDesc:      journalEntryLines.description,
        debit:         journalEntryLines.debit,
        credit:        journalEntryLines.credit,
      }).from(journalEntryLines)
        .innerJoin(journalEntries, and(
          eq(journalEntries.id, journalEntryLines.entryId),
          eq(journalEntries.orgId, ctx.user.orgId),
        ))
        .where(and(...conds))
        .orderBy(asc(journalEntries.entryDate), asc(journalEntries.id));

      const pendingConds: any[] = [
        eq(pendingAccountMovements.accountId, accountId),
        eq(pendingAccountMovements.orgId, ctx.user.orgId),
        eq(pendingAccountMovements.status, 'unposted'),
      ];
      if (fromDate) pendingConds.push(gte(pendingAccountMovements.movementDate, fromDate));
      if (toDate) pendingConds.push(lte(pendingAccountMovements.movementDate, endOfDay(toDate)));
      const pending = await db.select({
        id: pendingAccountMovements.id,
        entryDate: pendingAccountMovements.movementDate,
        reference: pendingAccountMovements.sourceDocNumber,
        description: pendingAccountMovements.description,
        debit: pendingAccountMovements.debit,
        credit: pendingAccountMovements.credit,
      }).from(pendingAccountMovements).where(and(...pendingConds));

      const docTypeLabel = (src: string | null) => {
        switch (src) {
          case 'sales_invoice':    return 'فاتورة مبيعات';
          case 'sales_return':     return 'مردود مبيعات';
          case 'purchase_invoice': return 'فاتورة مشتريات';
          case 'purchase_return':  return 'مردود مشتريات';
          case 'receipt_voucher':  return 'سند قبض';
          case 'payment_voucher':  return 'سند صرف';
          default:                 return 'قيد';
        }
      };

      return [
        ...lines.map(l => ({
          entryId:     l.entryId,
          entryDate:   l.entryDate,
          entryNumber: l.entryNumber,
          reference:   l.reference,
          voucherType: docTypeLabel(l.sourceDocType),
          description: l.lineDesc ?? l.description,
          debit:       l.debit,
          credit:      l.credit,
          status:      'posted' as const,
        })),
        ...pending.map(l => ({
          entryId:     null,
          entryDate:   l.entryDate,
          entryNumber: null,
          reference:   l.reference,
          voucherType: 'فاتورة مشتريات',
          description: l.description ?? `فاتورة مشتريات ${l.reference}`,
          debit:       l.debit,
          credit:      l.credit,
          status:      'unposted' as const,
        })),
      ].sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
    }),
});
