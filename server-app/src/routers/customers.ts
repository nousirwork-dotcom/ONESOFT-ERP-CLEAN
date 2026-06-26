import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { customers } from '../schema.js';
import { eq, and } from 'drizzle-orm';

export const customersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.customers.findMany({
      where: and(eq(customers.orgId, ctx.user.orgId), eq(customers.isActive, true)),
      orderBy: (c, { asc }) => [asc(c.name)],
    });
  }),
  create: protectedProcedure
    .input(z.object({
      code: z.string().optional(),
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      taxNumber: z.string().optional(),
      customerType: z.enum(['individual', 'organization']).optional(),
      registrationNumber: z.string().optional(),
      shortAddress: z.string().optional(),
      buildingNumber: z.string().optional(),
      additionalNumber: z.string().optional(),
      postalCode: z.string().optional(),
      city: z.string().optional(),
      creditLimit: z.string().optional(),
      priceLevel: z.number().int().min(1).max(5).optional(),
      maxDiscountPct: z.string().optional(),
      canSellOnCredit: z.boolean().optional(),
      whatsappPhone: z.string().optional(),
      telegramId: z.string().optional(),
      defaultSendMethod: z.enum(['whatsapp', 'telegram', 'email']).optional(),
      dealStartDate: z.string().optional().nullable(),
      dealEndDate:   z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { dealStartDate, dealEndDate, ...rest } = input;
      const [c] = await db.insert(customers).values({
        ...rest,
        customerType: rest.customerType ?? 'individual',
        priceLevel: rest.priceLevel ?? 1,
        maxDiscountPct: rest.maxDiscountPct ?? '0',
        canSellOnCredit: rest.canSellOnCredit ?? true,
        dealStartDate: dealStartDate ? new Date(dealStartDate) : null,
        dealEndDate:   dealEndDate   ? new Date(dealEndDate)   : null,
        orgId: ctx.user.orgId,
        isActive: true,
      }).returning();
      return c;
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      taxNumber: z.string().optional(),
      customerType: z.enum(['individual', 'organization']).optional(),
      registrationNumber: z.string().optional(),
      shortAddress: z.string().optional(),
      buildingNumber: z.string().optional(),
      additionalNumber: z.string().optional(),
      postalCode: z.string().optional(),
      city: z.string().optional(),
      creditLimit: z.string().optional(),
      priceLevel: z.number().int().min(1).max(5).optional(),
      maxDiscountPct: z.string().optional(),
      canSellOnCredit: z.boolean().optional(),
      whatsappPhone: z.string().optional(),
      telegramId: z.string().optional(),
      defaultSendMethod: z.enum(['whatsapp', 'telegram', 'email']).optional().nullable(),
      dealStartDate: z.string().optional().nullable(),
      dealEndDate:   z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, dealStartDate, dealEndDate, ...rest } = input;
      await db.update(customers).set({
        ...rest,
        dealStartDate: dealStartDate !== undefined ? (dealStartDate ? new Date(dealStartDate) : null) : undefined,
        dealEndDate:   dealEndDate   !== undefined ? (dealEndDate   ? new Date(dealEndDate)   : null) : undefined,
      }).where(and(eq(customers.id, id), eq(customers.orgId, ctx.user.orgId)));
      return { success: true };
    }),
});
