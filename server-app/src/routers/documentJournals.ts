import { z } from 'zod';
import { eq, and, asc, desc } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { documentJournals, salesInvoices } from '../schema.js';

// أنواع المستندات المدعومة
export const DOC_TYPES = [
  { id: 'sales_invoice',      label: 'فاتورة مبيعات' },
  { id: 'purchase_invoice',   label: 'فاتورة مشتريات' },
  { id: 'receipt_voucher',    label: 'سند قبض' },
  { id: 'payment_voucher',    label: 'سند صرف' },
  { id: 'stock_receipt',      label: 'إذن استلام مخزني' },
  { id: 'stock_issue',        label: 'إذن صرف مخزني' },
  { id: 'stock_transfer',     label: 'تحويل مخزني' },
  { id: 'inventory_count',    label: 'جرد مخزني' },
  { id: 'sales_return',       label: 'مردود مبيعات' },
  { id: 'purchase_return',    label: 'مردود مشتريات' },
];

export const documentJournalsRouter = router({

  // قائمة الدفاتر (اختياري: فلتر بنوع المستند)
  list: protectedProcedure
    .input(z.object({ docType: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await db.query.documentJournals.findMany({
        where: input?.docType
          ? and(
              eq(documentJournals.orgId, ctx.user.orgId),
              eq(documentJournals.docType, input.docType),
              eq(documentJournals.isActive, true),
            )
          : and(
              eq(documentJournals.orgId, ctx.user.orgId),
              eq(documentJournals.isActive, true),
            ),
        orderBy: [asc(documentJournals.sortOrder), asc(documentJournals.id)],
      });
      return rows;
    }),

  // دفتر واحد بالـ id
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const row = await db.query.documentJournals.findFirst({
        where: and(
          eq(documentJournals.id, input.id),
          eq(documentJournals.orgId, ctx.user.orgId),
        ),
      });
      if (!row) throw new Error('الدفتر غير موجود');
      return row;
    }),

  // إنشاء دفتر جديد
  create: protectedProcedure
    .input(z.object({
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
      includeYear:      z.boolean().default(true),
      warehouseId:      z.number().optional(),
      branchId:         z.number().optional(),
      salesAccountId:   z.number().optional(),
      cashAccountId:    z.number().optional(),
      creditAccountId:  z.number().optional(),
      taxAccountId:     z.number().optional(),
      discountAccountId:z.number().optional(),
      defaultCurrency:  z.string().default('SAR'),
      defaultPayMethod: z.string().default('cash'),
      allowedUserGroup: z.string().optional(),
      allowedUserId:    z.number().optional(),
      printTemplate:    z.string().optional(),
      notes:            z.string().optional(),
      sortOrder:        z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db.insert(documentJournals).values({
        ...input,
        orgId: ctx.user.orgId,
        currentSeq: 0,
        isActive: true,
      }).returning();
      return row;
    }),

  // تعديل دفتر
  update: protectedProcedure
    .input(z.object({
      id:               z.number(),
      code:             z.string().optional(),
      name:             z.string().optional(),
      name2:            z.string().optional(),
      description:      z.string().optional(),
      numberPrefix:     z.string().optional(),
      firstNumber:      z.number().optional(),
      lastNumber:       z.number().optional(),
      increment:        z.number().optional(),
      numDigits:        z.number().optional(),
      includeYear:      z.boolean().optional(),
      warehouseId:      z.number().nullable().optional(),
      branchId:         z.number().nullable().optional(),
      salesAccountId:   z.number().nullable().optional(),
      cashAccountId:    z.number().nullable().optional(),
      creditAccountId:  z.number().nullable().optional(),
      taxAccountId:     z.number().nullable().optional(),
      discountAccountId:z.number().nullable().optional(),
      defaultCurrency:  z.string().optional(),
      defaultPayMethod: z.string().optional(),
      allowedUserGroup: z.string().optional(),
      allowedUserId:    z.number().nullable().optional(),
      printTemplate:    z.string().optional(),
      notes:            z.string().optional(),
      isActive:         z.boolean().optional(),
      sortOrder:        z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [row] = await db.update(documentJournals)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(documentJournals.id, id), eq(documentJournals.orgId, ctx.user.orgId)))
        .returning();
      return row;
    }),

  // حذف دفتر
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(documentJournals)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(documentJournals.id, input.id), eq(documentJournals.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  // الرقم التالي للدفتر — يُحدّث currentSeq ذرياً
  nextNumber: protectedProcedure
    .input(z.object({ journalId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const journal = await db.query.documentJournals.findFirst({
        where: and(
          eq(documentJournals.id, input.journalId),
          eq(documentJournals.orgId, ctx.user.orgId),
        ),
      });
      if (!journal) throw new Error('الدفتر غير موجود');

      const nextSeq = (journal.currentSeq ?? 0) + (journal.increment ?? 1);
      const clamped = Math.min(nextSeq, journal.lastNumber ?? 999999);

      // حفظ الرقم الجديد
      await db.update(documentJournals)
        .set({ currentSeq: clamped, updatedAt: new Date() })
        .where(eq(documentJournals.id, journal.id));

      // بناء رقم المستند
      const prefix = journal.numberPrefix ?? 'INV';
      const digits  = journal.numDigits ?? 6;
      const numPart = String(clamped).padStart(digits, '0');

      if (journal.includeYear) {
        const year = new Date().getFullYear();
        return `${prefix}-${year}-${numPart}`;
      }
      return `${prefix}-${numPart}`;
    }),

  // معاينة الرقم التالي (بدون حفظ)
  previewNextNumber: protectedProcedure
    .input(z.object({ journalId: z.number() }))
    .query(async ({ ctx, input }) => {
      const journal = await db.query.documentJournals.findFirst({
        where: and(
          eq(documentJournals.id, input.journalId),
          eq(documentJournals.orgId, ctx.user.orgId),
        ),
      });
      if (!journal) return null;
      const nextSeq = (journal.currentSeq ?? 0) + (journal.increment ?? 1);
      const clamped = Math.min(nextSeq, journal.lastNumber ?? 999999);
      const prefix  = journal.numberPrefix ?? 'INV';
      const digits  = journal.numDigits ?? 6;
      const numPart = String(clamped).padStart(digits, '0');
      if (journal.includeYear) {
        return `${prefix}-${new Date().getFullYear()}-${numPart}`;
      }
      return `${prefix}-${numPart}`;
    }),
});
