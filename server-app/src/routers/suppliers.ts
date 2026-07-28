import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { suppliers } from '../schema.js';
import { eq, and } from 'drizzle-orm';

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
    }))
    .mutation(async ({ ctx, input }) => {
      const [supplier] = await db.insert(suppliers).values({
        orgId: ctx.user.orgId,
        code: input.code?.trim() || undefined,
        name: input.name.trim(),
        supplierType: input.supplierType,
        phone: input.phone?.trim() || undefined,
        email: input.email?.trim() || undefined,
        address: input.address?.trim() || undefined,
        taxNumber: input.taxNumber?.trim() || undefined,
        isActive: true,
      }).returning();
      return supplier;
    }),
});
