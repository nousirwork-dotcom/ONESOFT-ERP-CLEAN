import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { vouchers, receiptVouchers, paymentVouchers, chartOfAccounts } from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { insertJournalEntry } from '../services/PostingEngine.js';

export const vouchersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.vouchers.findMany({
      where: eq(vouchers.orgId, ctx.user.orgId),
      orderBy: [desc(vouchers.createdAt)],
      limit: 100,
    });
  }),

  nextNumber: protectedProcedure
    .input(z.object({ type: z.enum(['receipt', 'payment']) }))
    .query(async ({ ctx, input }) => {
      const last = await db.query.vouchers.findFirst({
        where: and(eq(vouchers.orgId, ctx.user.orgId), eq(vouchers.voucherType, input.type)),
        orderBy: [desc(vouchers.id)],
      });
      const prefix = input.type === 'receipt' ? 'RV' : 'PV';
      const num    = last ? parseInt(last.voucherNumber.replace(/\D/g, '') || '0') + 1 : 1;
      return `${prefix}-${String(num).padStart(4, '0')}`;
    }),

  create: protectedProcedure
    .input(z.object({
      voucherNumber: z.string(),
      voucherType:   z.enum(['receipt', 'payment']),
      voucherDate:   z.string(),
      amount:        z.string(),
      paymentMethod: z.enum(['cash', 'bank', 'credit', 'check', 'other']).default('cash'),
      accountCode:   z.string().optional(),
      accountName:   z.string().optional(),
      partyType:     z.string().optional(),
      partyName:     z.string().optional(),
      description:   z.string().optional(),
      reference:     z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [v] = await db.insert(vouchers).values({
        ...input,
        orgId:       ctx.user.orgId,
        userId:      ctx.user.id,
        voucherDate: new Date(input.voucherDate),
        status:      'posted',
      }).returning();
      return v;
    }),
});

export const receiptVouchersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(receiptVouchers)
      .where(eq(receiptVouchers.orgId, ctx.user.orgId))
      .orderBy(desc(receiptVouchers.createdAt))
      .limit(200);
  }),

  create: protectedProcedure
    .input(z.object({
      voucherNumber:   z.string(),
      voucherDate:     z.date(),
      receivedFrom:    z.string().optional(),
      amount:          z.string(),
      paymentMethod:   z.enum(['cash', 'bank', 'credit', 'check', 'other']).default('cash'),
      bankAccount:     z.string().optional(),
      checkNumber:     z.string().optional(),
      description:     z.string().optional(),
      accountId:       z.number().optional(),
      contraAccountId: z.number().optional(),
      costCenterId:    z.number().optional(),
      notes:           z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let journalEntryId: number | undefined;
      let journalEntryNumber: string | undefined;

      if (input.accountId && input.contraAccountId) {
        const [accDebit, accCredit] = await Promise.all([
          db.query.chartOfAccounts.findFirst({ where: eq(chartOfAccounts.id, input.accountId) }),
          db.query.chartOfAccounts.findFirst({ where: eq(chartOfAccounts.id, input.contraAccountId) }),
        ]);
        const entry = await insertJournalEntry({
          orgId:           ctx.user.orgId,
          userId:          ctx.user.id,
          date:            input.voucherDate,
          description:     `سند قبض رقم ${input.voucherNumber}${input.receivedFrom ? ` - ${input.receivedFrom}` : ""}`,
          reference:       input.voucherNumber,
          sourceDocType:   'receipt_voucher',
          sourceDocId:     0,
          sourceDocNumber: input.voucherNumber,
          lines: [
            { accountId: input.accountId,       accountCode: accDebit?.code  ?? '---', accountName: accDebit?.name  ?? '', debit: input.amount, credit: '0',          description: input.description ?? '' },
            { accountId: input.contraAccountId, accountCode: accCredit?.code ?? '---', accountName: accCredit?.name ?? '', debit: '0',          credit: input.amount, description: input.description ?? '' },
          ],
        });
        journalEntryId     = entry.id;
        journalEntryNumber = entry.entryNumber;
      }

      const [v] = await db.insert(receiptVouchers).values({
        orgId:           ctx.user.orgId,
        userId:          ctx.user.id,
        voucherNumber:   input.voucherNumber,
        voucherDate:     input.voucherDate,
        receivedFrom:    input.receivedFrom,
        amount:          input.amount,
        paymentMethod:   input.paymentMethod,
        bankAccount:     input.bankAccount,
        checkNumber:     input.checkNumber,
        description:     input.description,
        accountId:       input.accountId,
        contraAccountId: input.contraAccountId,
        costCenterId:    input.costCenterId,
        notes:           input.notes,
        journalEntryId,
        status:          'posted',
      }).returning();
      return { ...v, journalEntryNumber };
    }),
});

export const paymentVouchersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(paymentVouchers)
      .where(eq(paymentVouchers.orgId, ctx.user.orgId))
      .orderBy(desc(paymentVouchers.createdAt))
      .limit(200);
  }),

  create: protectedProcedure
    .input(z.object({
      voucherNumber:   z.string(),
      voucherDate:     z.date(),
      paidTo:          z.string().optional(),
      amount:          z.string(),
      paymentMethod:   z.enum(['cash', 'bank', 'credit', 'check', 'other']).default('cash'),
      bankAccount:     z.string().optional(),
      checkNumber:     z.string().optional(),
      description:     z.string().optional(),
      accountId:       z.number().optional(),
      contraAccountId: z.number().optional(),
      notes:           z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let journalEntryId: number | undefined;
      let journalEntryNumber: string | undefined;

      if (input.accountId && input.contraAccountId) {
        const [accDebit, accCredit] = await Promise.all([
          db.query.chartOfAccounts.findFirst({ where: eq(chartOfAccounts.id, input.contraAccountId) }),
          db.query.chartOfAccounts.findFirst({ where: eq(chartOfAccounts.id, input.accountId) }),
        ]);
        const entry = await insertJournalEntry({
          orgId:           ctx.user.orgId,
          userId:          ctx.user.id,
          date:            input.voucherDate,
          description:     `سند صرف رقم ${input.voucherNumber}${input.paidTo ? ` - ${input.paidTo}` : ""}`,
          reference:       input.voucherNumber,
          sourceDocType:   'payment_voucher',
          sourceDocId:     0,
          sourceDocNumber: input.voucherNumber,
          lines: [
            { accountId: input.contraAccountId, accountCode: accDebit?.code  ?? '---', accountName: accDebit?.name  ?? '', debit: input.amount, credit: '0',          description: input.description ?? '' },
            { accountId: input.accountId,       accountCode: accCredit?.code ?? '---', accountName: accCredit?.name ?? '', debit: '0',          credit: input.amount, description: input.description ?? '' },
          ],
        });
        journalEntryId     = entry.id;
        journalEntryNumber = entry.entryNumber;
      }

      const [v] = await db.insert(paymentVouchers).values({
        orgId:           ctx.user.orgId,
        userId:          ctx.user.id,
        voucherNumber:   input.voucherNumber,
        voucherDate:     input.voucherDate,
        paidTo:          input.paidTo,
        amount:          input.amount,
        paymentMethod:   input.paymentMethod,
        bankAccount:     input.bankAccount,
        checkNumber:     input.checkNumber,
        description:     input.description,
        accountId:       input.accountId,
        contraAccountId: input.contraAccountId,
        notes:           input.notes,
        journalEntryId,
        status:          'posted',
      }).returning();
      return { ...v, journalEntryNumber };
    }),
});
