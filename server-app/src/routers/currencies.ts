import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { currencies } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { assertCanUpdate, assertCanDelete } from '../lib/foundation-framework.js';

const currencyInput = z.object({
  code:          z.string().min(1).max(10).toUpperCase(),
  nameAr:        z.string().min(1).max(100),
  nameEn:        z.string().min(1).max(100),
  symbol:        z.string().min(1).max(10),
  symbolIntl:    z.string().max(10).optional().nullable(),
  exchangeRate:  z.string().default('1'),
  decimalPlaces: z.number().int().min(0).max(8).default(2),
  isBase:        z.boolean().default(false),
  mainUnitAr:    z.string().max(50).optional().nullable(),
  subUnitAr:     z.string().max(50).optional().nullable(),
  mainUnitEn:    z.string().max(50).optional().nullable(),
  subUnitEn:     z.string().max(50).optional().nullable(),
  isActive:      z.boolean().default(true),
});

export const currenciesRouter = router({

  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(currencies)
      .where(eq(currencies.orgId, ctx.user.orgId))
      .orderBy(currencies.code);
  }),

  create: protectedProcedure
    .input(currencyInput)
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user.orgId;
      const dup = await db.select({ id: currencies.id }).from(currencies)
        .where(and(eq(currencies.orgId, orgId), eq(currencies.code, input.code)))
        .limit(1);
      if (dup.length) throw new TRPCError({ code: 'BAD_REQUEST', message: `كود العملة "${input.code}" موجود مسبقاً` });

      if (input.isBase) {
        await db.update(currencies).set({ isBase: false })
          .where(and(eq(currencies.orgId, orgId), eq(currencies.isBase, true)));
      }
      const [row] = await db.insert(currencies).values({ orgId, ...input }).returning();
      return row;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number() }).merge(currencyInput.partial()))
    .mutation(async ({ input, ctx }) => {
      const { id, ...rest } = input;
      const orgId = ctx.user.orgId;

      const current = await db.query.currencies.findFirst({
        where: and(eq(currencies.id, id), eq(currencies.orgId, orgId)),
      });
      if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'العملة غير موجودة' });
      assertCanUpdate(current.recordPolicy, current.nameAr, ctx.user.role === 'superadmin');

      if (rest.code) {
        const dup = await db.select({ id: currencies.id }).from(currencies)
          .where(and(eq(currencies.orgId, orgId), eq(currencies.code, rest.code)))
          .limit(1);
        if (dup.length && dup[0].id !== id)
          throw new TRPCError({ code: 'BAD_REQUEST', message: `كود العملة "${rest.code}" موجود مسبقاً` });
      }

      if (rest.isBase) {
        await db.update(currencies).set({ isBase: false })
          .where(and(eq(currencies.orgId, orgId), eq(currencies.isBase, true)));
      }

      const [row] = await db.update(currencies)
        .set({ ...rest, updatedAt: new Date() })
        .where(and(eq(currencies.id, id), eq(currencies.orgId, orgId)))
        .returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user.orgId;
      const current = await db.query.currencies.findFirst({
        where: and(eq(currencies.id, input.id), eq(currencies.orgId, orgId)),
      });
      if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'العملة غير موجودة' });
      if (current.isBase) throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف العملة الأساسية' });
      assertCanDelete(current.recordPolicy, current.nameAr, ctx.user.role === 'superadmin');
      await db.update(currencies).set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(currencies.id, input.id), eq(currencies.orgId, orgId)));
      return { success: true };
    }),

  seedDefaults: protectedProcedure.mutation(async ({ ctx }) => {
    const orgId = ctx.user.orgId;
    const existing = await db.select({ id: currencies.id }).from(currencies)
      .where(eq(currencies.orgId, orgId)).limit(1);
    if (existing.length) return { seeded: false };

    const defaults = [
      { code: 'SAR', nameAr: 'ريال سعودي',   nameEn: 'Saudi Riyal',    symbol: 'ر.س', symbolIntl: 'SAR', exchangeRate: '1',    decimalPlaces: 2, isBase: true,  mainUnitAr: 'ريال',  subUnitAr: 'هللة',   mainUnitEn: 'Riyal',  subUnitEn: 'Halala',  isActive: true },
      { code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US Dollar',       symbol: '$',   symbolIntl: 'USD', exchangeRate: '3.75', decimalPlaces: 2, isBase: false, mainUnitAr: 'دولار', subUnitAr: 'سنت',    mainUnitEn: 'Dollar', subUnitEn: 'Cent',    isActive: true },
      { code: 'EUR', nameAr: 'يورو',          nameEn: 'Euro',            symbol: '€',   symbolIntl: 'EUR', exchangeRate: '4.10', decimalPlaces: 2, isBase: false, mainUnitAr: 'يورو',  subUnitAr: 'سنت',    mainUnitEn: 'Euro',   subUnitEn: 'Cent',    isActive: true },
      { code: 'AED', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham',      symbol: 'د.إ', symbolIntl: 'AED', exchangeRate: '1.02', decimalPlaces: 2, isBase: false, mainUnitAr: 'درهم',  subUnitAr: 'فلس',    mainUnitEn: 'Dirham', subUnitEn: 'Fils',    isActive: true },
      { code: 'GBP', nameAr: 'جنيه إسترليني',nameEn: 'British Pound',   symbol: '£',   symbolIntl: 'GBP', exchangeRate: '4.75', decimalPlaces: 2, isBase: false, mainUnitAr: 'جنيه',  subUnitAr: 'بنس',    mainUnitEn: 'Pound',  subUnitEn: 'Penny',   isActive: true },
    ];
    await db.insert(currencies).values(defaults.map(d => ({ orgId, ...d })));
    return { seeded: true };
  }),

  getBase: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.select().from(currencies)
      .where(and(eq(currencies.orgId, ctx.user.orgId), eq(currencies.isBase, true)))
      .limit(1);
    return rows[0] ?? null;
  }),
});
