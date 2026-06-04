import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { documentTemplates } from '../schema.js';

const POS01_CONFIG = JSON.stringify({
  type: "pos_config_v1",
  paperWidth: "80mm",
  primaryColor: "#406B93",
  taxPct: 15,
  taxInclusive: true,
  show: {
    logo: false, taxNumber: true, commercialReg: true,
    address: true, phone: true, customerName: false,
    cashierName: true, itemCode: false, discount: true,
    prices: true, branchName: true, qr: true,
    amountInWords: false, thankYou: true,
    paymentMethod: true, changeAmount: true,
  },
  printMode: "detailed",
  thankYouMsg: "شكراً لتسوقكم معنا",
  copies: 1,
});

const INV01_CONFIG = JSON.stringify({
  version: 1,
  type: "config_v1",
  paperSize: "A4",
  orientation: "portrait",
  language: "bilingual",
  primaryColor: "#406B93",
  columns: {
    num: true, code: true, name: true, unit: false,
    qty: true, price: true, discount: true,
    taxable: true, taxRate: true, taxAmt: true, total: true,
  },
  minRows: 5,
  sections: {
    sellerInfo: true, customerInfo: true,
    amountInWords: true, pageNumber: true, signatures: false,
  },
  elements: [
    { id: "e_qr",    type: "qr",           x: 5,   y: 5,   w: 26,  h: 26,  border: false },
    { id: "e_title", type: "text",          x: 72,  y: 7,   w: 62,  h: 16,  content: "فاتورة ضريبية\nTAX INVOICE", fontSize: 13, fontWeight: "bold", textAlign: "center", color: "#222222" },
    { id: "e_co",    type: "company_info",  x: 112, y: 5,   w: 93,  h: 28,  fontSize: 9 },
    { id: "e_d1",    type: "line",          x: 5,   y: 36,  w: 200, h: 1,   color: "#406B93" },
    { id: "e_inv",   type: "invoice_info",  x: 5,   y: 39,  w: 200, h: 13,  fontSize: 9 },
    { id: "e_d2",    type: "line",          x: 5,   y: 54,  w: 200, h: 1,   color: "#cccccc" },
    { id: "e_cust",  type: "customer_info", x: 5,   y: 57,  w: 95,  h: 32,  fontSize: 9, border: true },
    { id: "e_d3",    type: "line",          x: 5,   y: 92,  w: 200, h: 1,   color: "#cccccc" },
    { id: "e_items", type: "items_table",   x: 5,   y: 95,  w: 200, h: 82,  fontSize: 9 },
    { id: "e_total", type: "totals",        x: 115, y: 181, w: 90,  h: 44,  fontSize: 10, border: true },
    { id: "e_words", type: "notes",         x: 5,   y: 181, w: 106, h: 12,  content: "المبلغ كتابةً: {{AmountInWords}}", fontSize: 9 },
    { id: "e_notes", type: "notes",         x: 5,   y: 196, w: 106, h: 12,  content: "ملاحظات: {{Notes}}", fontSize: 9 },
    { id: "e_d4",    type: "line",          x: 5,   y: 229, w: 200, h: 1,   color: "#cccccc" },
    { id: "e_foot",  type: "text",          x: 5,   y: 232, w: 200, h: 8,   content: "OneSoft ERP  ·  صفحة 1 من 1 / Page 1 of 1", fontSize: 8, textAlign: "center", color: "#888888" },
  ],
});

export const documentTemplatesRouter = router({

  list: protectedProcedure
    .input(z.object({ docType: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where = input?.docType
        ? and(eq(documentTemplates.orgId, ctx.user.orgId), eq(documentTemplates.docType, input.docType), eq(documentTemplates.isActive, true))
        : and(eq(documentTemplates.orgId, ctx.user.orgId), eq(documentTemplates.isActive, true));
      return db.query.documentTemplates.findMany({
        where,
        orderBy: [asc(documentTemplates.sortOrder), asc(documentTemplates.id)],
      });
    }),

  getDefault: protectedProcedure
    .input(z.object({ docType: z.string() }))
    .query(async ({ ctx, input }) => {
      const tpl = await db.query.documentTemplates.findFirst({
        where: and(
          eq(documentTemplates.orgId, ctx.user.orgId),
          eq(documentTemplates.docType, input.docType),
          eq(documentTemplates.isDefault, true),
          eq(documentTemplates.isActive, true),
        ),
      });
      return tpl ?? null;
    }),

  seedDefaults: protectedProcedure
    .mutation(async ({ ctx }) => {
      const defaults = [
        {
          code: 'INV01', nameAr: 'نموذج المبيعات الأساسي', nameEn: 'Standard Sales Invoice',
          docType: 'sales_invoice', paperSize: 'A4', layoutJson: INV01_CONFIG,
          notes: 'النموذج الافتراضي — فاتورة ضريبية ثنائية اللغة',
        },
        {
          code: 'POS01', nameAr: 'نموذج نقاط البيع الحراري', nameEn: 'POS Thermal Receipt',
          docType: 'pos_receipt', paperSize: '80mm', layoutJson: POS01_CONFIG,
          notes: 'إيصال حراري لنقاط البيع — ZATCA/ETA QR',
        },
      ];
      let seededCount = 0;
      for (const def of defaults) {
        const existing = await db.query.documentTemplates.findFirst({
          where: and(
            eq(documentTemplates.orgId, ctx.user.orgId),
            eq(documentTemplates.code, def.code),
          ),
        });
        if (!existing) {
          await db.insert(documentTemplates).values({
            orgId: ctx.user.orgId, code: def.code, nameAr: def.nameAr, nameEn: def.nameEn,
            docType: def.docType, paperSize: def.paperSize, orientation: 'portrait',
            isDefault: true, isActive: true, sortOrder: 1,
            layoutJson: def.layoutJson, notes: def.notes,
          });
          seededCount++;
        } else if (!existing.layoutJson) {
          // تحديث النموذج الموجود إذا كان بدون تصميم
          await db.update(documentTemplates)
            .set({ layoutJson: def.layoutJson, isDefault: true, updatedAt: new Date() })
            .where(and(eq(documentTemplates.id, existing.id), eq(documentTemplates.orgId, ctx.user.orgId)));
          seededCount++;
        }
      }
      return { seeded: seededCount > 0, count: seededCount };
    }),

  create: protectedProcedure
    .input(z.object({
      code:        z.string().min(1),
      nameAr:      z.string().min(1),
      nameEn:      z.string().optional(),
      docType:     z.string().min(1),
      paperSize:   z.string().default('A4'),
      orientation: z.string().default('portrait'),
      isDefault:   z.boolean().default(false),
      layoutJson:  z.string().nullable().optional(),
      notes:       z.string().optional(),
      sortOrder:   z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.isDefault) {
        await db.update(documentTemplates)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(eq(documentTemplates.orgId, ctx.user.orgId), eq(documentTemplates.docType, input.docType)));
      }
      const [row] = await db.insert(documentTemplates).values({
        ...input, orgId: ctx.user.orgId, isActive: true,
      }).returning();
      return row;
    }),

  update: protectedProcedure
    .input(z.object({
      id:          z.number(),
      code:        z.string().optional(),
      nameAr:      z.string().optional(),
      nameEn:      z.string().optional(),
      docType:     z.string().optional(),
      paperSize:   z.string().optional(),
      orientation: z.string().optional(),
      isDefault:   z.boolean().optional(),
      layoutJson:  z.string().nullable().optional(),
      notes:       z.string().optional(),
      sortOrder:   z.number().optional(),
      isActive:    z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (data.isDefault && data.docType) {
        await db.update(documentTemplates)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(eq(documentTemplates.orgId, ctx.user.orgId), eq(documentTemplates.docType, data.docType)));
      }
      const [row] = await db.update(documentTemplates)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(documentTemplates.id, id), eq(documentTemplates.orgId, ctx.user.orgId)))
        .returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(documentTemplates)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(documentTemplates.id, input.id), eq(documentTemplates.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  clone: protectedProcedure
    .input(z.object({ id: z.number(), newCode: z.string(), newNameAr: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const src = await db.query.documentTemplates.findFirst({
        where: and(eq(documentTemplates.id, input.id), eq(documentTemplates.orgId, ctx.user.orgId)),
      });
      if (!src) throw new Error('النموذج غير موجود');
      const [row] = await db.insert(documentTemplates).values({
        orgId: ctx.user.orgId, code: input.newCode, nameAr: input.newNameAr,
        nameEn: src.nameEn ? `Copy of ${src.nameEn}` : undefined,
        docType: src.docType, paperSize: src.paperSize ?? 'A4',
        orientation: src.orientation ?? 'portrait',
        isDefault: false, isActive: true,
        layoutJson: src.layoutJson, notes: src.notes,
        sortOrder: (src.sortOrder ?? 0) + 1,
      }).returning();
      return row;
    }),
});
