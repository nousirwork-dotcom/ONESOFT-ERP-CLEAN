import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { documentTemplates } from '../schema.js';

const INV01_CONFIG = JSON.stringify({
  type: "config_v1",
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
      const existing = await db.query.documentTemplates.findFirst({
        where: and(
          eq(documentTemplates.orgId, ctx.user.orgId),
          eq(documentTemplates.docType, 'sales_invoice'),
        ),
      });
      if (existing) return { seeded: false };
      await db.insert(documentTemplates).values({
        orgId:       ctx.user.orgId,
        code:        'INV01',
        nameAr:      'نموذج المبيعات الأساسي',
        nameEn:      'Standard Sales Invoice',
        docType:     'sales_invoice',
        paperSize:   'A4',
        orientation: 'portrait',
        isDefault:   true,
        isActive:    true,
        sortOrder:   1,
        layoutJson:  INV01_CONFIG,
        notes:       'النموذج الافتراضي — فاتورة ضريبية ثنائية اللغة',
      });
      return { seeded: true };
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
