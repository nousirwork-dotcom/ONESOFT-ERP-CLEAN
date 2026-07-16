import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { userGroups, userGroupMembers, userCategories, users, qrSettings, branches, units, freeProducts, warehouses, salesInvoices, inventoryCounts } from '../schema.js';
import { eq, and, desc, asc } from 'drizzle-orm';
import { assertCanUpdate, assertCanDelete } from '../lib/foundation-framework.js';

export const userGroupsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(userGroups)
      .where(and(eq(userGroups.orgId, ctx.user.orgId), eq(userGroups.isActive, true)))
      .orderBy(userGroups.name);
  }),

  create: protectedProcedure
    .input(z.object({ code: z.string().optional(), name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [g] = await db.insert(userGroups).values({
        orgId: ctx.user.orgId, code: input.code, name: input.name, description: input.description,
      }).returning();
      return g;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), code: z.string().optional(), name: z.string().optional(), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      await db.update(userGroups).set(rest)
        .where(and(eq(userGroups.id, id), eq(userGroups.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(userGroups).set({ isActive: false })
        .where(and(eq(userGroups.id, input.id), eq(userGroups.orgId, ctx.user.orgId)));
      return { success: true };
    }),
});

export const userCategoriesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(userCategories)
      .where(and(eq(userCategories.orgId, ctx.user.orgId), eq(userCategories.isActive, true)))
      .orderBy(userCategories.name);
  }),

  create: protectedProcedure
    .input(z.object({
      code:          z.string().optional(),
      name:          z.string().min(1),
      autoNumbering: z.boolean().optional(),
      firstNumber:   z.number().optional(),
      lastNumber:    z.number().optional(),
      increment:     z.number().optional(),
      codeDigits:    z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.code) {
        const dup = await db.select({ id: userCategories.id }).from(userCategories)
          .where(and(eq(userCategories.orgId, ctx.user.orgId), eq(userCategories.code, input.code), eq(userCategories.isActive, true)))
          .limit(1);
        if (dup.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'الكود مكرر — يوجد فئة بنفس الكود' });
      }
      const [c] = await db.insert(userCategories).values({
        orgId:         ctx.user.orgId,
        code:          input.code,
        name:          input.name,
        autoNumbering: input.autoNumbering ?? true,
        firstNumber:   input.firstNumber   ?? 1,
        lastNumber:    input.lastNumber    ?? 99999,
        increment:     input.increment     ?? 1,
        codeDigits:    input.codeDigits    ?? 5,
      }).returning();
      return c;
    }),

  update: protectedProcedure
    .input(z.object({
      id:            z.number(),
      code:          z.string().optional(),
      name:          z.string().optional(),
      autoNumbering: z.boolean().optional(),
      firstNumber:   z.number().optional(),
      lastNumber:    z.number().optional(),
      increment:     z.number().optional(),
      codeDigits:    z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      if (rest.code) {
        const dup = await db.select({ id: userCategories.id }).from(userCategories)
          .where(and(eq(userCategories.orgId, ctx.user.orgId), eq(userCategories.code, rest.code), eq(userCategories.isActive, true)))
          .limit(1);
        if (dup.length && dup[0].id !== id) throw new TRPCError({ code: 'BAD_REQUEST', message: 'الكود مكرر — يوجد فئة بنفس الكود' });
      }
      await db.update(userCategories).set(rest)
        .where(and(eq(userCategories.id, id), eq(userCategories.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(userCategories).set({ isActive: false })
        .where(and(eq(userCategories.id, input.id), eq(userCategories.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  nextCode: protectedProcedure
    .input(z.object({ categoryId: z.number() }))
    .query(async ({ ctx, input }) => {
      const cat = await db.select().from(userCategories)
        .where(and(eq(userCategories.id, input.categoryId), eq(userCategories.orgId, ctx.user.orgId)))
        .limit(1);
      if (!cat.length || !cat[0].autoNumbering) return null;
      const c        = cat[0];
      const prefix   = c.code ?? "";
      const numDigits = Math.max(c.codeDigits - prefix.length, 1);
      const catUsers  = await db.select({ code: users.code }).from(users)
        .where(and(eq(users.orgId, ctx.user.orgId), eq(users.categoryId, input.categoryId), eq(users.isActive, true)));
      let maxNum = c.firstNumber - c.increment;
      for (const u of catUsers) {
        if (!u.code) continue;
        const numPart = prefix && u.code.startsWith(prefix) ? u.code.slice(prefix.length) : u.code;
        const n = parseInt(numPart, 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
      const nextNum = maxNum < c.firstNumber ? c.firstNumber : maxNum + c.increment;
      if (nextNum > c.lastNumber) return null;
      return { code: prefix + String(nextNum).padStart(numDigits, '0'), category: c };
    }),
});

export const groupMembersRouter = router({
  list: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.select().from(userGroupMembers)
        .where(and(eq(userGroupMembers.groupId, input.groupId), eq(userGroupMembers.orgId, ctx.user.orgId)))
        .orderBy(userGroupMembers.createdAt);
    }),

  add: protectedProcedure
    .input(z.object({
      groupId:     z.number(),
      memberType:  z.enum(['user', 'group']),
      memberCode:  z.string().min(1),
      memberName:  z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let resolvedName = input.memberName;
      if (input.memberType === 'user') {
        const found = await db.select({ id: users.id, name: users.name }).from(users)
          .where(and(eq(users.orgId, ctx.user.orgId), eq(users.code, input.memberCode))).limit(1);
        if (!found.length) throw new TRPCError({ code: 'BAD_REQUEST', message: `كود المستخدم "${input.memberCode}" غير موجود في النظام` });
        resolvedName = found[0].name;
      } else {
        const found = await db.select({ id: userGroups.id, name: userGroups.name }).from(userGroups)
          .where(and(eq(userGroups.orgId, ctx.user.orgId), eq(userGroups.code, input.memberCode), eq(userGroups.isActive, true))).limit(1);
        if (!found.length) throw new TRPCError({ code: 'BAD_REQUEST', message: `كود المجموعة "${input.memberCode}" غير موجود في النظام` });
        resolvedName = found[0].name;
      }
      const existing = await db.select({ id: userGroupMembers.id }).from(userGroupMembers)
        .where(and(
          eq(userGroupMembers.groupId,    input.groupId),
          eq(userGroupMembers.orgId,      ctx.user.orgId),
          eq(userGroupMembers.memberType, input.memberType),
          eq(userGroupMembers.memberCode, input.memberCode),
        )).limit(1);
      if (existing.length) throw new TRPCError({ code: 'BAD_REQUEST', message: `العضو تم تكرار بالجدول` });
      const [m] = await db.insert(userGroupMembers).values({
        groupId:    input.groupId,
        orgId:      ctx.user.orgId,
        memberType: input.memberType,
        memberCode: input.memberCode,
        memberName: resolvedName,
      }).returning();
      return m;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(userGroupMembers)
        .where(and(eq(userGroupMembers.id, input.id), eq(userGroupMembers.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  addBulk: protectedProcedure
    .input(z.object({
      groupId: z.number(),
      members: z.array(z.object({
        memberType: z.enum(['user', 'group']),
        memberCode: z.string().min(1),
        memberName: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.members.length) return { count: 0 };
      const seen   = new Set<string>();
      const unique = input.members.filter(m => {
        const key = `${m.memberType}:${m.memberCode}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const existingMembers = await db.select({ memberType: userGroupMembers.memberType, memberCode: userGroupMembers.memberCode })
        .from(userGroupMembers)
        .where(and(eq(userGroupMembers.groupId, input.groupId), eq(userGroupMembers.orgId, ctx.user.orgId)));
      const existingSet = new Set(existingMembers.map(m => `${m.memberType}:${m.memberCode}`));
      const toInsert    = unique.filter(m => !existingSet.has(`${m.memberType}:${m.memberCode}`));
      if (!toInsert.length) return { count: 0 };
      const resolved = await Promise.all(toInsert.map(async m => {
        let name = m.memberName;
        if (m.memberType === 'user') {
          const found = await db.select({ name: users.name }).from(users)
            .where(and(eq(users.orgId, ctx.user.orgId), eq(users.code, m.memberCode))).limit(1);
          if (!found.length) throw new TRPCError({ code: 'BAD_REQUEST', message: `كود المستخدم "${m.memberCode}" غير موجود في النظام` });
          name = found[0].name;
        } else {
          const found = await db.select({ name: userGroups.name }).from(userGroups)
            .where(and(eq(userGroups.orgId, ctx.user.orgId), eq(userGroups.code, m.memberCode), eq(userGroups.isActive, true))).limit(1);
          if (!found.length) throw new TRPCError({ code: 'BAD_REQUEST', message: `كود المجموعة "${m.memberCode}" غير موجود في النظام` });
          name = found[0].name;
        }
        return { groupId: input.groupId, orgId: ctx.user.orgId, memberType: m.memberType, memberCode: m.memberCode, memberName: name };
      }));
      await db.insert(userGroupMembers).values(resolved);
      return { count: resolved.length };
    }),
});

export const qrSettingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.select().from(qrSettings)
      .where(eq(qrSettings.orgId, ctx.user.orgId)).limit(1);
    return rows[0] ?? null;
  }),

  upsert: protectedProcedure
    .input(z.object({
      isEnabled:             z.boolean().optional(),
      countrySystem:         z.enum(['zatca', 'eta', 'custom']).optional(),
      customFormat:          z.string().optional().nullable(),
      sellerName:            z.string().optional().nullable(),
      taxNumber:             z.string().optional().nullable(),
      showOnSalesInvoice:    z.boolean().optional(),
      showOnPurchaseInvoice: z.boolean().optional(),
      showOnReceiptVoucher:  z.boolean().optional(),
      qrSize:                z.number().min(50).max(300).optional(),
      qrPosition:            z.string().optional(),
      notes:                 z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.select({ id: qrSettings.id }).from(qrSettings)
        .where(eq(qrSettings.orgId, ctx.user.orgId)).limit(1);
      if (existing.length) {
        const [updated] = await db.update(qrSettings)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(qrSettings.orgId, ctx.user.orgId))
          .returning();
        return updated;
      } else {
        const [inserted] = await db.insert(qrSettings)
          .values({ orgId: ctx.user.orgId, ...input })
          .returning();
        return inserted;
      }
    }),
});

export const branchesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.branches.findMany({
      where: and(eq(branches.orgId, ctx.user.orgId), eq(branches.isActive, true)),
      orderBy: (b, { asc }) => [asc(b.name)],
    });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), address: z.string().optional(), phone: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [b] = await db.insert(branches).values({ ...input, orgId: ctx.user.orgId, isActive: true }).returning();
      return b;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).optional(), address: z.string().optional(), phone: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const current = await db.query.branches.findFirst({
        where: and(eq(branches.id, id), eq(branches.orgId, ctx.user.orgId)),
      });
      if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'الفرع غير موجود' });
      assertCanUpdate(current.recordPolicy, current.name, ctx.user.role === 'superadmin');
      await db.update(branches).set(data as any).where(and(eq(branches.id, id), eq(branches.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const current = await db.query.branches.findFirst({
        where: and(eq(branches.id, input.id), eq(branches.orgId, ctx.user.orgId)),
      });
      if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'الفرع غير موجود' });
      assertCanDelete(current.recordPolicy, current.name, ctx.user.role === 'superadmin');
      const [hasWarehouses, hasInvoices, hasInventoryCounts] = await Promise.all([
        db.select({ id: warehouses.id }).from(warehouses)
          .where(and(eq(warehouses.branchId, input.id), eq(warehouses.orgId, ctx.user.orgId), eq(warehouses.isActive, true))).limit(1),
        db.select({ id: salesInvoices.id }).from(salesInvoices)
          .where(and(eq(salesInvoices.branchId, input.id), eq(salesInvoices.orgId, ctx.user.orgId))).limit(1),
        db.select({ id: inventoryCounts.id }).from(inventoryCounts)
          .where(and(eq(inventoryCounts.branchId, input.id), eq(inventoryCounts.orgId, ctx.user.orgId))).limit(1),
      ]);
      if (hasWarehouses.length > 0)     throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف الفرع لأنه مرتبط بمخازن' });
      if (hasInvoices.length > 0)       throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف الفرع لأنه مرتبط بفواتير مبيعات' });
      if (hasInventoryCounts.length > 0)throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف الفرع لأنه مرتبط بعمليات جرد مخزني' });
      await db.update(branches).set({ isActive: false })
        .where(and(eq(branches.id, input.id), eq(branches.orgId, ctx.user.orgId)));
      return { success: true };
    }),
});

export const unitsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.units.findMany({ where: eq(units.orgId, ctx.user.orgId), orderBy: (u, { asc }) => [asc(u.name)] });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), symbol: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [u] = await db.insert(units).values({ ...input, orgId: ctx.user.orgId }).returning();
      return u;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).optional(), symbol: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const current = await db.query.units.findFirst({
        where: and(eq(units.id, id), eq(units.orgId, ctx.user.orgId)),
      });
      if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'وحدة القياس غير موجودة' });
      assertCanUpdate(current.recordPolicy, current.name, ctx.user.role === 'superadmin');
      await db.update(units).set(data as any).where(and(eq(units.id, id), eq(units.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const current = await db.query.units.findFirst({
        where: and(eq(units.id, input.id), eq(units.orgId, ctx.user.orgId)),
      });
      if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'وحدة القياس غير موجودة' });
      assertCanDelete(current.recordPolicy, current.name, ctx.user.role === 'superadmin');
      await db.delete(units).where(and(eq(units.id, input.id), eq(units.orgId, ctx.user.orgId)));
      return { success: true };
    }),
});

export const freeProductsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.freeProducts.findMany({
      where: and(eq(freeProducts.orgId, ctx.user.orgId), eq(freeProducts.isActive, true)),
      orderBy: [desc(freeProducts.createdAt)],
    });
  }),

  create: protectedProcedure
    .input(z.object({
      productId:   z.number().optional(),
      productCode: z.string().optional(),
      productName: z.string().min(1),
      unit:        z.string().optional(),
      baseQty:     z.string().default('1'),
      freeQty:     z.string().default('1'),
      offerStart:  z.string().optional(),
      offerEnd:    z.string().optional(),
      notes:       z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db.insert(freeProducts).values({
        orgId:       ctx.user.orgId,
        productId:   input.productId,
        productCode: input.productCode,
        productName: input.productName,
        unit:        input.unit,
        baseQty:     input.baseQty,
        freeQty:     input.freeQty,
        offerStart:  input.offerStart ? new Date(input.offerStart) : undefined,
        offerEnd:    input.offerEnd   ? new Date(input.offerEnd)   : undefined,
        notes:       input.notes,
      }).returning();
      return row;
    }),

  update: protectedProcedure
    .input(z.object({
      id:          z.number(),
      productCode: z.string().optional(),
      productName: z.string().optional(),
      unit:        z.string().optional(),
      baseQty:     z.string().optional(),
      freeQty:     z.string().optional(),
      offerStart:  z.string().optional(),
      offerEnd:    z.string().optional(),
      notes:       z.string().optional(),
      isActive:    z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, offerStart, offerEnd, ...rest } = input;
      await db.update(freeProducts).set({
        ...rest,
        offerStart: offerStart ? new Date(offerStart) : undefined,
        offerEnd:   offerEnd   ? new Date(offerEnd)   : undefined,
      } as any).where(and(eq(freeProducts.id, id), eq(freeProducts.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(freeProducts).set({ isActive: false } as any)
        .where(and(eq(freeProducts.id, input.id), eq(freeProducts.orgId, ctx.user.orgId)));
      return { success: true };
    }),
});
