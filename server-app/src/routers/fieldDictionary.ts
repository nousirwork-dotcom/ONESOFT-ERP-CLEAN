import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { fieldDictionary } from '../schema.js';
import { eq, and, asc } from 'drizzle-orm';

const fieldInput = z.object({
  code:        z.string().min(1).max(50).toUpperCase().regex(/^[A-Z0-9_]+$/, 'الكود يجب أن يحتوي على أحرف إنجليزية وأرقام وشرطة سفلية فقط'),
  nameAr:      z.string().min(1).max(150),
  nameEn:      z.string().min(1).max(150),
  fieldType:   z.string().min(1).max(50),
  category:    z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
  isActive:    z.boolean().default(true),
  sortOrder:   z.number().int().default(0),
});

const SEED_FIELDS = [
  // Document Fields
  { code: 'INVOICE_NO',      nameAr: 'رقم الفاتورة',          nameEn: 'Invoice No',        fieldType: 'Text',     category: 'Document Fields',  isSystem: true },
  { code: 'DOCUMENT_NO',     nameAr: 'رقم المستند',            nameEn: 'Document No',       fieldType: 'Text',     category: 'Document Fields',  isSystem: true },
  { code: 'INVOICE_DATE',    nameAr: 'تاريخ الفاتورة',         nameEn: 'Invoice Date',      fieldType: 'Date',     category: 'Document Fields',  isSystem: true },
  { code: 'DOCUMENT_DATE',   nameAr: 'تاريخ المستند',          nameEn: 'Document Date',     fieldType: 'Date',     category: 'Document Fields',  isSystem: true },
  { code: 'NOTES',           nameAr: 'ملاحظات',                nameEn: 'Notes',             fieldType: 'LongText', category: 'Document Fields',  isSystem: true },
  // Customer Fields
  { code: 'CUSTOMER_CODE',   nameAr: 'كود العميل',             nameEn: 'Customer Code',     fieldType: 'Text',     category: 'Customer Fields',  isSystem: true },
  { code: 'CUSTOMER_NAME',   nameAr: 'اسم العميل',             nameEn: 'Customer Name',     fieldType: 'Customer', category: 'Customer Fields',  isSystem: true },
  { code: 'CUSTOMER_MOBILE', nameAr: 'جوال العميل',            nameEn: 'Customer Mobile',   fieldType: 'Phone',    category: 'Customer Fields',  isSystem: true },
  { code: 'CUSTOMER_PHONE',  nameAr: 'هاتف العميل',            nameEn: 'Customer Phone',    fieldType: 'Phone',    category: 'Customer Fields',  isSystem: true },
  { code: 'CUSTOMER_EMAIL',  nameAr: 'بريد العميل',            nameEn: 'Customer Email',    fieldType: 'Email',    category: 'Customer Fields',  isSystem: true },
  { code: 'CUSTOMER_VAT',    nameAr: 'الرقم الضريبي للعميل',   nameEn: 'Customer VAT No',   fieldType: 'Text',     category: 'Customer Fields',  isSystem: true },
  { code: 'CUSTOMER_ADDRESS',nameAr: 'عنوان العميل',           nameEn: 'Customer Address',  fieldType: 'LongText', category: 'Customer Fields',  isSystem: true },
  // Vendor Fields
  { code: 'VENDOR_CODE',     nameAr: 'كود المورد',             nameEn: 'Vendor Code',       fieldType: 'Text',     category: 'Vendor Fields',    isSystem: true },
  { code: 'VENDOR_NAME',     nameAr: 'اسم المورد',             nameEn: 'Vendor Name',       fieldType: 'Vendor',   category: 'Vendor Fields',    isSystem: true },
  { code: 'VENDOR_MOBILE',   nameAr: 'جوال المورد',            nameEn: 'Vendor Mobile',     fieldType: 'Phone',    category: 'Vendor Fields',    isSystem: true },
  { code: 'VENDOR_VAT',      nameAr: 'الرقم الضريبي للمورد',   nameEn: 'Vendor VAT No',     fieldType: 'Text',     category: 'Vendor Fields',    isSystem: true },
  // Sales Fields
  { code: 'NETSALES',        nameAr: 'صافي المبيعات',          nameEn: 'Net Sales',         fieldType: 'Amount',   category: 'Sales Fields',     isSystem: true },
  { code: 'DISCOUNT',        nameAr: 'الخصم',                  nameEn: 'Discount',          fieldType: 'Amount',   category: 'Sales Fields',     isSystem: true },
  { code: 'TAX',             nameAr: 'الضريبة',                nameEn: 'Tax Amount',        fieldType: 'Amount',   category: 'Sales Fields',     isSystem: true },
  { code: 'TOTAL',           nameAr: 'إجمالي الفاتورة',        nameEn: 'Invoice Total',     fieldType: 'Amount',   category: 'Sales Fields',     isSystem: true },
  { code: 'PROFIT',          nameAr: 'الربح',                  nameEn: 'Profit',            fieldType: 'Amount',   category: 'Sales Fields',     isSystem: true },
  { code: 'COST',            nameAr: 'التكلفة',                nameEn: 'Cost',              fieldType: 'Amount',   category: 'Sales Fields',     isSystem: true },
  // Item Fields
  { code: 'ITEM_CODE',       nameAr: 'كود الصنف',              nameEn: 'Item Code',         fieldType: 'Text',     category: 'Item Fields',      isSystem: true },
  { code: 'ITEM_NAME',       nameAr: 'اسم الصنف',              nameEn: 'Item Name',         fieldType: 'Item',     category: 'Item Fields',      isSystem: true },
  { code: 'ITEM_BARCODE',    nameAr: 'باركود الصنف',           nameEn: 'Item Barcode',      fieldType: 'Text',     category: 'Item Fields',      isSystem: true },
  { code: 'QTY',             nameAr: 'الكمية',                 nameEn: 'Quantity',          fieldType: 'Number',   category: 'Item Fields',      isSystem: true },
  { code: 'PRICE',           nameAr: 'السعر',                  nameEn: 'Price',             fieldType: 'Amount',   category: 'Item Fields',      isSystem: true },
  { code: 'UNIT',            nameAr: 'وحدة القياس',            nameEn: 'Unit',              fieldType: 'Unit',     category: 'Item Fields',      isSystem: true },
  { code: 'LINE_TOTAL',      nameAr: 'إجمالي السطر',           nameEn: 'Line Total',        fieldType: 'Amount',   category: 'Item Fields',      isSystem: true },
  // Inventory Fields
  { code: 'STOCK_QTY',       nameAr: 'كمية المخزون',           nameEn: 'Stock Quantity',    fieldType: 'Number',   category: 'Inventory Fields', isSystem: true },
  { code: 'AVAILABLE_QTY',   nameAr: 'الكمية المتاحة',         nameEn: 'Available Qty',     fieldType: 'Number',   category: 'Inventory Fields', isSystem: true },
  // System Fields
  { code: 'USER_NAME',       nameAr: 'اسم المستخدم',           nameEn: 'User Name',         fieldType: 'User',     category: 'System Fields',    isSystem: true },
  { code: 'BRANCH_NAME',     nameAr: 'اسم الفرع',              nameEn: 'Branch Name',       fieldType: 'Branch',   category: 'System Fields',    isSystem: true },
  { code: 'COMPANY_NAME',    nameAr: 'اسم الشركة',             nameEn: 'Company Name',      fieldType: 'Text',     category: 'System Fields',    isSystem: true },
  { code: 'PRINT_DATE',      nameAr: 'تاريخ الطباعة',          nameEn: 'Print Date',        fieldType: 'Date',     category: 'System Fields',    isSystem: true },
  { code: 'PRINT_TIME',      nameAr: 'وقت الطباعة',            nameEn: 'Print Time',        fieldType: 'Time',     category: 'System Fields',    isSystem: true },
  // Payment Fields
  { code: 'CASH_AMOUNT',     nameAr: 'المبلغ النقدي',          nameEn: 'Cash Amount',       fieldType: 'Amount',   category: 'Payment Fields',   isSystem: true },
  { code: 'CARD_AMOUNT',     nameAr: 'مبلغ البطاقة',           nameEn: 'Card Amount',       fieldType: 'Amount',   category: 'Payment Fields',   isSystem: true },
  { code: 'BANK_AMOUNT',     nameAr: 'تحويل بنكي',             nameEn: 'Bank Transfer',     fieldType: 'Amount',   category: 'Payment Fields',   isSystem: true },
  { code: 'TAMARA_AMOUNT',   nameAr: 'مبلغ تمارا',             nameEn: 'Tamara Amount',     fieldType: 'Amount',   category: 'Payment Fields',   isSystem: true },
  { code: 'TABBY_AMOUNT',    nameAr: 'مبلغ تابي',              nameEn: 'Tabby Amount',      fieldType: 'Amount',   category: 'Payment Fields',   isSystem: true },
  { code: 'OTHER_AMOUNT',    nameAr: 'مبالغ أخرى',             nameEn: 'Other Amount',      fieldType: 'Amount',   category: 'Payment Fields',   isSystem: true },
  { code: 'PAYMENT_TOTAL',   nameAr: 'إجمالي المدفوع',         nameEn: 'Total Paid',        fieldType: 'Amount',   category: 'Payment Fields',   isSystem: true },
  { code: 'PAID',            nameAr: 'المدفوع',                nameEn: 'Paid Amount',       fieldType: 'Amount',   category: 'Payment Fields',   isSystem: true },
  { code: 'REMAINING',       nameAr: 'المتبقي',                nameEn: 'Remaining',         fieldType: 'Amount',   category: 'Payment Fields',   isSystem: true },
];

export const fieldDictionaryRouter = router({

  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(fieldDictionary)
      .where(eq(fieldDictionary.orgId, ctx.user.orgId))
      .orderBy(asc(fieldDictionary.category), asc(fieldDictionary.sortOrder), asc(fieldDictionary.code));
  }),

  create: protectedProcedure
    .input(fieldInput)
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user.orgId;
      const dup = await db.select({ id: fieldDictionary.id }).from(fieldDictionary)
        .where(and(eq(fieldDictionary.orgId, orgId), eq(fieldDictionary.code, input.code)))
        .limit(1);
      if (dup.length) throw new TRPCError({ code: 'BAD_REQUEST', message: `كود الحقل "${input.code}" موجود مسبقاً` });
      const [row] = await db.insert(fieldDictionary).values({ orgId, ...input, isSystem: false }).returning();
      return row;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number() }).merge(fieldInput.partial()))
    .mutation(async ({ input, ctx }) => {
      const { id, ...rest } = input;
      const orgId = ctx.user.orgId;
      const existing = await db.select({ isSystem: fieldDictionary.isSystem }).from(fieldDictionary)
        .where(and(eq(fieldDictionary.id, id), eq(fieldDictionary.orgId, orgId))).limit(1);
      if (!existing.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'الحقل غير موجود' });
      if (existing[0].isSystem && rest.code)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن تعديل كود الحقل النظامي' });
      if (rest.code) {
        const dup = await db.select({ id: fieldDictionary.id }).from(fieldDictionary)
          .where(and(eq(fieldDictionary.orgId, orgId), eq(fieldDictionary.code, rest.code))).limit(1);
        if (dup.length && dup[0].id !== id)
          throw new TRPCError({ code: 'BAD_REQUEST', message: `كود الحقل "${rest.code}" موجود مسبقاً` });
      }
      const [row] = await db.update(fieldDictionary).set(rest)
        .where(and(eq(fieldDictionary.id, id), eq(fieldDictionary.orgId, orgId)))
        .returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user.orgId;
      const existing = await db.select({ isSystem: fieldDictionary.isSystem }).from(fieldDictionary)
        .where(and(eq(fieldDictionary.id, input.id), eq(fieldDictionary.orgId, orgId))).limit(1);
      if (!existing.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'الحقل غير موجود' });
      if (existing[0].isSystem) throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف الحقول النظامية' });
      await db.delete(fieldDictionary).where(and(eq(fieldDictionary.id, input.id), eq(fieldDictionary.orgId, orgId)));
      return { success: true };
    }),

  seedDefaults: protectedProcedure.mutation(async ({ ctx }) => {
    const orgId = ctx.user.orgId;
    const existing = await db.select({ id: fieldDictionary.id }).from(fieldDictionary)
      .where(eq(fieldDictionary.orgId, orgId)).limit(1);
    if (existing.length) return { seeded: false };
    await db.insert(fieldDictionary).values(
      SEED_FIELDS.map((f, i) => ({ orgId, ...f, sortOrder: i, isActive: true }))
    );
    return { seeded: true };
  }),
});
