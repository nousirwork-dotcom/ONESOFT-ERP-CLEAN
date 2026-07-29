import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { suppliers } from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';

export const suppliersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.suppliers.findMany({
      where: and(eq(suppliers.orgId, ctx.user.orgId), eq(suppliers.isActive, true)),
      orderBy: (s, { asc }) => [asc(s.name)],
    });
  }),
  create: protectedProcedure
    .input(z.object({
      code: z.string().optional(),
      name: z.string().min(1),
      supplierType: z.enum(["individual", "organization"]).default("individual"),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      taxNumber: z.string().optional(),
       registrationNumber: z.string().optional(),
       recordPolicy: z.enum(["strict", "flexible", "foundation"]).optional(),
       foundationKey: z.string().optional(),
       includeInFoundation: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const latest = await db.query.suppliers.findFirst({
        where: eq(suppliers.orgId, ctx.user.orgId),
        orderBy: [desc(suppliers.id)],
        columns: { code: true },
      });
      const nextNumber = (Number(latest?.code?.match(/(\d+)$/)?.[1] ?? 0) || 0) + 1;
      const [supplier] = await db.insert(suppliers).values({
        orgId: ctx.user.orgId,
        code: input.code?.trim() || `SU-${String(nextNumber).padStart(3, '0')}`,
        name: input.name.trim(),
        supplierType: input.supplierType,
        phone: input.phone?.trim() || undefined,
        email: input.email?.trim() || undefined,
        address: input.address?.trim() || undefined,
        taxNumber: input.taxNumber?.trim() || undefined,
         registrationNumber: input.registrationNumber?.trim() || undefined,
         recordPolicy: input.recordPolicy,
         foundationKey: input.foundationKey?.trim() || undefined,
         includeInFoundation: input.includeInFoundation,
        isActive: true,
      }).returning();
      return supplier;
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      code: z.string().optional(),
      name: z.string().min(1),
      supplierType: z.enum(["individual", "organization"]).default("individual"),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      taxNumber: z.string().optional(),
      registrationNumber: z.string().optional(),
      recordPolicy: z.enum(["strict", "flexible", "foundation"]).optional(),
      foundationKey: z.string().optional(),
      includeInFoundation: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [supplier] = await db.update(suppliers)
        .set({
          code: input.code?.trim() || undefined,
          name: input.name.trim(),
          supplierType: input.supplierType,
          phone: input.phone?.trim() || undefined,
          email: input.email?.trim() || undefined,
          address: input.address?.trim() || undefined,
          taxNumber: input.taxNumber?.trim() || undefined,
          registrationNumber: input.registrationNumber?.trim() || undefined,
          recordPolicy: input.recordPolicy,
          foundationKey: input.foundationKey?.trim() || undefined,
          includeInFoundation: input.includeInFoundation,
        })
        .where(and(eq(suppliers.id, input.id), eq(suppliers.orgId, ctx.user.orgId)))
        .returning();
      if (!supplier) throw new Error("المورد غير موجود");
      return supplier;
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [supplier] = await db.update(suppliers)
        .set({ isActive: false })
        .where(and(eq(suppliers.id, input.id), eq(suppliers.orgId, ctx.user.orgId)))
        .returning({ id: suppliers.id });
      if (!supplier) throw new Error("المورد غير موجود");
      return supplier;
    }),
});
