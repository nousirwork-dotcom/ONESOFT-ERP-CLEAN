import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { documentTypes } from '../schema.js';

const inputShape = {
  typeId:               z.string(),
  nameAr:               z.string().min(1),
  nameEn:               z.string().optional(),
  codeEn:               z.string().optional(),
  codeAr:               z.string().optional(),
  docType:              z.string().optional(),
  userGroup:            z.string().optional(),
  user_:               z.string().optional(),
  warehouse:            z.string().optional(),
  journal:              z.string().optional(),
  customersJournal:     z.string().optional(),
  suppliersJournal:     z.string().optional(),
  systemOnly:           z.boolean().default(false),
  entryType:            z.string().optional(),
  entryJournal:         z.string().optional(),
  stockDocType:         z.string().optional(),
  stockJournal:         z.string().optional(),
  printTemplate:        z.string().optional(),
  printTemplate2:       z.string().optional(),
  trackQty:             z.boolean().default(false),
  noTax:                z.boolean().default(false),
  sellerStats:          z.boolean().default(false),
  itemStats:            z.boolean().default(false),
  customerStats:        z.boolean().default(false),
  noStockDispatch:      z.boolean().default(false),
  requireNote:          z.boolean().default(false),
  preventEditIfLinked:  z.boolean().default(false),
  requireCustomerCode:  z.boolean().default(false),
  requireEmployeeCode:  z.boolean().default(false),
  acctDebit:            z.string().optional(),
  acctCredit:           z.string().optional(),
  acctDiscount:         z.string().optional(),
  acctCash:             z.string().optional(),
  acctTax:              z.string().optional(),
  salesAccountId:       z.number().nullable().optional(),
  cashAccountId:        z.number().nullable().optional(),
  creditAccountId:      z.number().nullable().optional(),
  taxAccountId:         z.number().nullable().optional(),
  discountAccountId:    z.number().nullable().optional(),
  purchaseAccountId:    z.number().nullable().optional(),
  supplierAccountId:    z.number().nullable().optional(),
  sortOrder:            z.number().default(0),
};

export const documentTypesRouter = router({
  list: protectedProcedure
    .input(z.object({ typeId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await db.select().from(documentTypes)
        .where(
          input?.typeId
            ? and(eq(documentTypes.orgId, ctx.user.orgId), eq(documentTypes.typeId, input.typeId), eq(documentTypes.isActive, true))
            : and(eq(documentTypes.orgId, ctx.user.orgId), eq(documentTypes.isActive, true))
        )
        .orderBy(asc(documentTypes.sortOrder), asc(documentTypes.id));
      return rows;
    }),

  create: protectedProcedure
    .input(z.object(inputShape))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db.insert(documentTypes).values({
        ...input,
        orgId: ctx.user.orgId,
        isActive: true,
      }).returning();
      return row;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), ...Object.fromEntries(Object.entries(inputShape).map(([k, v]) => [k, (v as any).optional()])) }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [row] = await db.update(documentTypes)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(documentTypes.id, id), eq(documentTypes.orgId, ctx.user.orgId)))
        .returning();
      if (!row) throw new Error('نوع المستند غير موجود');
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(documentTypes)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(documentTypes.id, input.id), eq(documentTypes.orgId, ctx.user.orgId)));
      return { ok: true };
    }),
});
