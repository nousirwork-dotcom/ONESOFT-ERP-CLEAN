import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { documentTemplates } from '../schema.js';

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
        ...input,
        orgId: ctx.user.orgId,
        isActive: true,
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
});
