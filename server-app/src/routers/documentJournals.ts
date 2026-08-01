import { z } from 'zod';
import { eq, and, asc, inArray, sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { documentJournals, zatcaPosUnits } from '../schema.js';
import { assertCanUpdate, assertCanDelete, deriveFoundationKey } from '../lib/foundation-framework.js';
import { TRPCError } from '@trpc/server';

export const DOC_TYPES = [
  { id: 'sales_invoice',        label: 'فاتورة مبيعات' },
  { id: 'sales_return',         label: 'مردود مبيعات' },
  { id: 'sales_order',          label: 'أمر بيع' },
  { id: 'sales_quote',          label: 'عرض سعر مبيعات' },
  { id: 'purchase_invoice',     label: 'فاتورة مشتريات' },
  { id: 'purchase_return',      label: 'مردود مشتريات' },
  { id: 'purchase_order',       label: 'أمر شراء' },
  { id: 'purchase_quote',       label: 'عرض سعر مشتريات' },
  { id: 'receipt_voucher',      label: 'سند قبض' },
  { id: 'payment_voucher',      label: 'سند صرف' },
  { id: 'stock_receipt',        label: 'إذن استلام مخزني' },
  { id: 'stock_issue',          label: 'إذن صرف مخزني' },
  { id: 'stock_transfer',       label: 'سند تحويل مخزني' },
  { id: 'inventory_count',      label: 'جرد مخزني' },
  { id: 'journal_entry',        label: 'سند قيد' },
  { id: 'stock_issue_items',    label: 'سند صرف أصناف' },
  { id: 'stock_receipt_items',  label: 'سند توريد أصناف' },
  { id: 'customers_journal',    label: 'دفتر العملاء' },
  { id: 'suppliers_journal',    label: 'دفتر الموردين' },
];

const journalInputShape = {
  docType:          z.string(),
  code:             z.string().min(1),
  name:             z.string().min(1),
  name2:            z.string().optional(),
  description:      z.string().optional(),
  numberPrefix:      z.string().default('INV'),
  firstNumber:       z.number().default(1),
  lastNumber:        z.number().default(999999),
  increment:         z.number().default(1),
  numDigits:         z.number().default(6),
  includeYear:       z.boolean().default(false),
  draftAutoSerial:   z.boolean().default(false),
  draftNumberPrefix: z.string().default('DRAFT'),
  draftFirstNumber:  z.number().default(1),
  draftLastNumber:   z.number().default(999999),
  draftNumDigits:    z.number().default(6),
  warehouseId:       z.number().nullable().optional(),
  zatcaPosUnitId:    z.number().nullable().optional(),
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

const ZATCA_JOURNAL_DOC_TYPES = new Set([
  'sales_invoice',
  'sales_return',
  'credit_note',
  'debit_note',
]);

async function assertZatcaBinding(params: {
  orgId: number;
  docType: string;
  warehouseId: number | null | undefined;
  zatcaPosUnitId: number | null | undefined;
}) {
  const { orgId, docType, warehouseId, zatcaPosUnitId } = params;
  if (zatcaPosUnitId == null) return;
  if (!ZATCA_JOURNAL_DOC_TYPES.has(docType)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'لا يمكن ربط هذا النوع من الدفاتر بوحدة ZATCA — اربط دفاتر المبيعات والمردود والدائن والمدين فقط',
    });
  }
  if (warehouseId == null) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'لا يمكن ربط دفتر ZATCA قبل ربطه بمخزن/فرع',
    });
  }
  const unit = await db.query.zatcaPosUnits.findFirst({
    where: and(
      eq(zatcaPosUnits.id, zatcaPosUnitId),
      eq(zatcaPosUnits.orgId, orgId),
      eq(zatcaPosUnits.isActive, true),
      eq(zatcaPosUnits.isDeleted, false),
    ),
    columns: { id: true, warehouseId: true },
  });
  if (!unit) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'وحدة ربط نقطة البيع مع ZATCA غير موجودة أو غير فعالة' });
  }
  if (unit.warehouseId !== warehouseId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'وحدة ربط ZATCA لا تنتمي إلى المخزن/الفرع المحدد للدفتر',
    });
  }
}

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
      await assertZatcaBinding({
        orgId: ctx.user.orgId,
        docType: input.docType,
        warehouseId: input.warehouseId ?? null,
        zatcaPosUnitId: input.zatcaPosUnitId ?? null,
      });
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
      await assertZatcaBinding({
        orgId: ctx.user.orgId,
        docType: (data as any).docType ?? current.docType,
        warehouseId: (data as any).warehouseId ?? current.warehouseId,
        zatcaPosUnitId: (data as any).zatcaPosUnitId !== undefined
          ? (data as any).zatcaPosUnitId
          : current.zatcaPosUnitId,
      });
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

  // إعادة ضبط الترقيم الرسمي
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

  // إعادة ضبط ترقيم المسودات
  resetDraftNumbering: protectedProcedure
    .input(z.object({ journalId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const journal = await db.query.documentJournals.findFirst({
        where: and(eq(documentJournals.id, input.journalId), eq(documentJournals.orgId, ctx.user.orgId)),
      });
      if (!journal) throw new Error('الدفتر غير موجود');
      await db.update(documentJournals)
        .set({ draftCurrentSeq: (journal.draftFirstNumber ?? 1) - 1, updatedAt: new Date() })
        .where(eq(documentJournals.id, journal.id));
      return { success: true, resetTo: (journal.draftFirstNumber ?? 1) - 1 };
    }),

  // الرقم التالي — transaction-safe
  nextNumber: protectedProcedure
    .input(z.object({ journalId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // One UPDATE statement both locks the journal row and advances the
      // sequence. This prevents two browser sessions from receiving the same
      // number when a branch is selected at the same time.
      const [journal] = await db.update(documentJournals)
        .set({
          currentSeq: sql`LEAST(
            CASE
              WHEN ${documentJournals.currentSeq} = 0 THEN ${documentJournals.firstNumber}
              ELSE GREATEST(
                ${documentJournals.currentSeq} + ${documentJournals.increment},
                ${documentJournals.firstNumber}
              )
            END,
            ${documentJournals.lastNumber}
          )`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(documentJournals.id, input.journalId),
          eq(documentJournals.orgId, ctx.user.orgId),
          eq(documentJournals.isActive, true),
        ))
        .returning();
      if (!journal) throw new Error('الدفتر غير موجود أو غير فعال');
      const clamped = journal.currentSeq ?? journal.firstNumber ?? 1;
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
