import { z } from 'zod';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { documentJournals } from '../schema.js';
import { assertCanUpdate, assertCanDelete, deriveFoundationKey } from '../lib/foundation-framework.js';

export const DOC_TYPES = [
  { id: 'sales_invoice',    label: 'فاتورة مبيعات' },
  { id: 'purchase_invoice', label: 'فاتورة مشتريات' },
  { id: 'receipt_voucher',  label: 'سند قبض' },
  { id: 'payment_voucher',  label: 'سند صرف' },
  { id: 'stock_receipt',    label: 'إذن استلام مخزني' },
  { id: 'stock_issue',      label: 'إذن صرف مخزني' },
  { id: 'stock_transfer',      label: 'سند تحويل مخزني' },
  { id: 'inventory_count',     label: 'جرد مخزني' },
  { id: 'sales_return',        label: 'مردود مبيعات' },
  { id: 'purchase_return',     label: 'مردود مشتريات' },
  { id: 'journal_entry',       label: 'سند قيد' },
  { id: 'stock_issue_items',   label: 'سند صرف أصناف' },
  { id: 'stock_receipt_items', label: 'سند توريد أصناف' },
  { id: 'customers_journal',   label: 'دفتر العملاء' },
  { id: 'suppliers_journal',   label: 'دفتر الموردين' },
];

const journalInputShape = {
  docType:          z.string(),
  code:             z.string().min(1),
  name:             z.string().min(1),
  name2:            z.string().optional(),
  description:      z.string().optional(),
  numberPrefix:     z.string().default('INV'),
  firstNumber:      z.number().default(1),
  lastNumber:       z.number().default(999999),
  increment:        z.number().default(1),
  numDigits:        z.number().default(6),
  includeYear:      z.boolean().default(false),
  warehouseId:      z.number().nullable().optional(),
  salesAccountId:   z.number().nullable().optional(),
  cashAccountId:    z.number().nullable().optional(),
  creditAccountId:  z.number().nullable().optional(),
  taxAccountId:     z.number().nullable().optional(),
  discountAccountId:z.number().nullable().optional(),
  defaultCurrency:  z.string().default('SAR'),
  defaultPayMethod: z.string().default('cash'),
  allowedUserGroup: z.string().nullable().optional(),
  allowedUserId:    z.number().nullable().optional(),
  printTemplate:    z.string().nullable().optional(),
  printTemplate2:   z.string().nullable().optional(),
  resetFrequency:   z.string().default('none'),
  autoSerial:       z.boolean().default(false),
  printOnSave:      z.boolean().default(false),
  customersJournal: z.string().nullable().optional(),
  suppliersJournal: z.string().nullable().optional(),
  paymentTypesConfig: z.record(z.string(), z.any()).nullable().optional(),
  issuanceConfig:   z.record(z.string(), z.any()).nullable().optional(),
  optionsConfig:    z.record(z.string(), z.any()).nullable().optional(),
  allowUnpost:      z.boolean().optional(),
  allowEditAfterPost: z.boolean().optional(),
  notes:               z.string().optional(),
  sortOrder:            z.number().default(0),
  recordPolicy:         z.enum(['protected', 'editable', 'flexible']).optional(),
  includeInFoundation:  z.boolean().optional(),
};

export const documentJournalsRouter = router({

  list: protectedProcedure
    .input(z.object({
      docType:  z.string().optional(),
      docTypes: z.array(z.string()).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const types = input?.docTypes ?? (input?.docType ? [input.docType] : null);
      const rows = await db.query.documentJournals.findMany({
        where: types && types.length > 0
          ? and(eq(documentJournals.orgId, ctx.user.orgId), inArray(documentJournals.docType, types), eq(documentJournals.isActive, true))
          : and(eq(documentJournals.orgId, ctx.user.orgId), eq(documentJournals.isActive, true)),
        orderBy: [asc(documentJournals.sortOrder), asc(documentJournals.id)],
      });
      return rows;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const row = await db.query.documentJournals.findFirst({
        where: and(eq(documentJournals.id, input.id), eq(documentJournals.orgId, ctx.user.orgId)),
      });
      if (!row) throw new Error('الدفتر غير موجود');
      return row;
    }),

  create: protectedProcedure
    .input(z.object(journalInputShape))
    .mutation(async ({ ctx, input }) => {
      const { recordPolicy: _rp, includeInFoundation: _if, ...inputData } = input;
      const [row] = await db.insert(documentJournals).values({
        ...inputData,
        orgId: ctx.user.orgId,
        currentSeq: 0,
        isActive: true,
        recordPolicy: 'flexible',
        includeInFoundation: false,
        foundationKey: null,
      }).returning();
      return row;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), ...Object.fromEntries(Object.entries(journalInputShape).map(([k, v]) => [k, (v as any).optional()])) }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rawData } = input;
      const inputAny = input as any;
      const newPolicy = inputAny.recordPolicy as 'protected' | 'editable' | 'flexible' | undefined;
      const newInclude = inputAny.includeInFoundation as boolean | undefined;
      // Strip policy fields from data going into Drizzle to avoid type mismatch
      const { recordPolicy: _rp, includeInFoundation: _if, ...data } = rawData as any;
      const current = await db.query.documentJournals.findFirst({
        where: and(eq(documentJournals.id, id), eq(documentJournals.orgId, ctx.user.orgId)),
      });
      if (!current) throw new Error('الدفتر غير موجود');
      const isSuperadmin = ctx.user.role === 'superadmin';
      assertCanUpdate(current.recordPolicy, current.name, isSuperadmin);
      const policyFields: Record<string, unknown> = {};
      if (isSuperadmin) {
        if (newPolicy !== undefined) policyFields.recordPolicy = newPolicy;
        if (newInclude !== undefined) {
          policyFields.includeInFoundation = newInclude;
          if (newInclude && !current.foundationKey) {
            policyFields.foundationKey = deriveFoundationKey('document_journals', {
              docType: ((data as any).docType ?? current.docType) as string,
              code:    ((data as any).code    ?? current.code)    as string,
            });
          } else if (!newInclude) {
            policyFields.foundationKey = null;
          }
        }
      }
      const [row] = await db.update(documentJournals)
        .set({ ...data, ...policyFields, updatedAt: new Date() } as any)
        .where(and(eq(documentJournals.id, id), eq(documentJournals.orgId, ctx.user.orgId)))
        .returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const current = await db.query.documentJournals.findFirst({
        where: and(eq(documentJournals.id, input.id), eq(documentJournals.orgId, ctx.user.orgId)),
      });
      if (!current) throw new Error('الدفتر غير موجود');
      assertCanDelete(current.recordPolicy, current.name, ctx.user.role === 'superadmin');
      await db.update(documentJournals)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(documentJournals.id, input.id), eq(documentJournals.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  // إعادة ضبط الترقيم
  resetNumbering: protectedProcedure
    .input(z.object({ journalId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const journal = await db.query.documentJournals.findFirst({
        where: and(eq(documentJournals.id, input.journalId), eq(documentJournals.orgId, ctx.user.orgId)),
      });
      if (!journal) throw new Error('الدفتر غير موجود');
      await db.update(documentJournals)
        .set({ currentSeq: (journal.firstNumber ?? 1) - 1, updatedAt: new Date() })
        .where(eq(documentJournals.id, journal.id));
      return { success: true, resetTo: (journal.firstNumber ?? 1) - 1 };
    }),

  // الرقم التالي — transaction-safe
  nextNumber: protectedProcedure
    .input(z.object({ journalId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const journal = await db.query.documentJournals.findFirst({
        where: and(eq(documentJournals.id, input.journalId), eq(documentJournals.orgId, ctx.user.orgId)),
      });
      if (!journal) throw new Error('الدفتر غير موجود');
      const currentSeq  = journal.currentSeq ?? 0;
      const firstNumber = journal.firstNumber ?? 1;
      const increment   = journal.increment ?? 1;
      // إذا لم يُستخدم الدفتر بعد (currentSeq=0) ابدأ من firstNumber، وإلا زِد بمقدار increment
      const nextSeq = currentSeq === 0 ? firstNumber : Math.max(currentSeq + increment, firstNumber);
      const clamped = Math.min(nextSeq, journal.lastNumber ?? 999999);
      await db.update(documentJournals)
        .set({ currentSeq: clamped, updatedAt: new Date() })
        .where(eq(documentJournals.id, journal.id));
      const prefix  = journal.numberPrefix ?? 'INV';
      const digits  = journal.numDigits ?? 6;
      const numPart = String(clamped).padStart(digits, '0');
      if (journal.includeYear) {
        return `${prefix}${new Date().getFullYear()}-${numPart}`;
      }
      return `${prefix}${numPart}`;
    }),

  previewNextNumber: protectedProcedure
    .input(z.object({ journalId: z.number() }))
    .query(async ({ ctx, input }) => {
      const journal = await db.query.documentJournals.findFirst({
        where: and(eq(documentJournals.id, input.journalId), eq(documentJournals.orgId, ctx.user.orgId)),
      });
      if (!journal) return null;
      const currentSeq  = journal.currentSeq ?? 0;
      const firstNumber = journal.firstNumber ?? 1;
      const increment   = journal.increment ?? 1;
      const nextSeq = currentSeq === 0 ? firstNumber : Math.max(currentSeq + increment, firstNumber);
      const clamped = Math.min(nextSeq, journal.lastNumber ?? 999999);
      const prefix  = journal.numberPrefix ?? 'INV';
      const digits  = journal.numDigits ?? 6;
      const numPart = String(clamped).padStart(digits, '0');
      if (journal.includeYear) return `${prefix}${new Date().getFullYear()}-${numPart}`;
      return `${prefix}${numPart}`;
    }),
});
