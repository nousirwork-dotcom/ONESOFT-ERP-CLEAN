import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { paymentMethods } from '../schema.js';

const DEFAULT_METHODS = [
  { code: 'CASH',   nameAr: 'نقدي',          nameEn: 'Cash',          icon: 'cash',   color: '#15803D', bgColor: '#F0FDF4', sortOrder: 1, isBuiltIn: true },
  { code: 'CARD',   nameAr: 'بطاقة بنكية',    nameEn: 'Card',          icon: 'card',   color: '#1D4ED8', bgColor: '#EFF6FF', sortOrder: 2, isBuiltIn: true },
  { code: 'BANK',   nameAr: 'تحويل بنكي',     nameEn: 'Bank Transfer', icon: 'bank',   color: '#6D28D9', bgColor: '#FAF5FF', sortOrder: 3, isBuiltIn: true },
  { code: 'TAMARA', nameAr: 'تمارا',           nameEn: 'Tamara',        icon: 'tamara', color: '#B45309', bgColor: '#FFFBEB', sortOrder: 4, isBuiltIn: false },
  { code: 'TABBY',  nameAr: 'تابي',            nameEn: 'Tabby',         icon: 'tabby',  color: '#047857', bgColor: '#F0FDF4', sortOrder: 5, isBuiltIn: false },
  { code: 'OTHER',  nameAr: 'أخرى',            nameEn: 'Other',         icon: 'other',  color: '#64748B', bgColor: '#F8FAFC', sortOrder: 6, isBuiltIn: false },
];

export const paymentMethodsRouter = router({

  list: protectedProcedure
    .query(async ({ ctx }) => {
      return db.select().from(paymentMethods)
        .where(eq(paymentMethods.orgId, ctx.user.orgId))
        .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.id));
    }),

  listActive: protectedProcedure
    .query(async ({ ctx }) => {
      return db.select().from(paymentMethods)
        .where(and(
          eq(paymentMethods.orgId, ctx.user.orgId),
          eq(paymentMethods.isActive, true),
          eq(paymentMethods.isVisible, true),
        ))
        .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.id));
    }),

  seedDefaults: protectedProcedure
    .mutation(async ({ ctx }) => {
      const existing = await db.select({ code: paymentMethods.code })
        .from(paymentMethods)
        .where(eq(paymentMethods.orgId, ctx.user.orgId));
      const existingCodes = new Set(existing.map(r => r.code));
      let count = 0;
      for (const m of DEFAULT_METHODS) {
        if (!existingCodes.has(m.code)) {
          await db.insert(paymentMethods).values({
            orgId: ctx.user.orgId,
            code: m.code, nameAr: m.nameAr, nameEn: m.nameEn,
            icon: m.icon, color: m.color, bgColor: m.bgColor,
            isActive: true, isVisible: true, isBuiltIn: m.isBuiltIn,
            sortOrder: m.sortOrder,
          });
          count++;
        }
      }
      return { seeded: count };
    }),

  create: protectedProcedure
    .input(z.object({
      code:      z.string().min(1).max(50),
      nameAr:    z.string().min(1).max(150),
      nameEn:    z.string().max(150).optional(),
      icon:      z.string().max(50).optional(),
      color:     z.string().max(20).optional(),
      bgColor:   z.string().max(20).optional(),
      accountId: z.number().int().optional().nullable(),
      isActive:  z.boolean().default(true),
      isVisible: z.boolean().default(true),
      sortOrder: z.number().int().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db.insert(paymentMethods).values({
        orgId: ctx.user.orgId,
        ...input,
        isBuiltIn: false,
      }).returning();
      return row;
    }),

  update: protectedProcedure
    .input(z.object({
      id:        z.number().int(),
      nameAr:    z.string().min(1).max(150).optional(),
      nameEn:    z.string().max(150).optional().nullable(),
      icon:      z.string().max(50).optional().nullable(),
      color:     z.string().max(20).optional().nullable(),
      bgColor:   z.string().max(20).optional().nullable(),
      accountId: z.number().int().optional().nullable(),
      isActive:  z.boolean().optional(),
      isVisible: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [row] = await db.update(paymentMethods)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(paymentMethods.id, id), eq(paymentMethods.orgId, ctx.user.orgId)))
        .returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db.select({ isBuiltIn: paymentMethods.isBuiltIn })
        .from(paymentMethods)
        .where(and(eq(paymentMethods.id, input.id), eq(paymentMethods.orgId, ctx.user.orgId)))
        .limit(1);
      if (row?.isBuiltIn) throw new Error('لا يمكن حذف وسيلة الدفع المدمجة — يمكنك إخفاؤها فقط');
      await db.update(paymentMethods)
        .set({ isActive: false, isVisible: false, updatedAt: new Date() })
        .where(and(eq(paymentMethods.id, input.id), eq(paymentMethods.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  reorder: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int()) }))
    .mutation(async ({ ctx, input }) => {
      for (let i = 0; i < input.ids.length; i++) {
        await db.update(paymentMethods)
          .set({ sortOrder: i + 1, updatedAt: new Date() })
          .where(and(eq(paymentMethods.id, input.ids[i]), eq(paymentMethods.orgId, ctx.user.orgId)));
      }
      return { success: true };
    }),
});
