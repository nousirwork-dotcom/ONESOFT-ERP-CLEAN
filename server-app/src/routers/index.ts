import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure, superAdminProcedure } from '../trpc.js';
import { orgsRouter } from './orgs.js';
import { usersRouter } from './users.js';
import { salesRouter } from './sales.js';
import { chatRouter } from './chat.js';
import { db } from '../db.js';
import { products, customers, suppliers, chartOfAccounts, warehouses, branches, units, productGroups, journalEntries, journalEntryLines, vouchers, inventory, stockVouchers, stockVoucherItems, inventoryCounts, inventoryCountItems, freeProducts, salesInvoices, salesInvoiceItems, warehouseAccountLinks, userGroups, userGroupMembers, userCategories, users } from '../schema.js';
import { eq, and, desc, like, or, sql, isNotNull, isNull, asc } from 'drizzle-orm';

export const appRouter = router({
  // ─── Auth ────────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      return ctx.user ? {
        id: ctx.user.id,
        name: ctx.user.name,
        username: ctx.user.username,
        role: ctx.user.role,
        orgId: ctx.user.orgId,
      } : null;
    }),
  }),

  // ─── Organizations ────────────────────────────────────────────────────────────
  orgs: orgsRouter,

  // ─── Users ───────────────────────────────────────────────────────────────────
  users: usersRouter,

  // ─── User Groups ─────────────────────────────────────────────────────────────
  userGroups: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.select().from(userGroups)
        .where(and(eq(userGroups.orgId, ctx.user.orgId), eq(userGroups.isActive, true)))
        .orderBy(userGroups.name);
    }),
    create: protectedProcedure
      .input(z.object({ code: z.string().optional(), name: z.string().min(1), description: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const [g] = await db.insert(userGroups).values({
          orgId: ctx.user.orgId, code: input.code, name: input.name, description: input.description,
        }).returning();
        return g;
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), code: z.string().optional(), name: z.string().optional(), description: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...rest } = input;
        await db.update(userGroups).set(rest)
          .where(and(eq(userGroups.id, id), eq(userGroups.orgId, ctx.user.orgId)));
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.update(userGroups).set({ isActive: false })
          .where(and(eq(userGroups.id, input.id), eq(userGroups.orgId, ctx.user.orgId)));
        return { success: true };
      }),
  }),

  // ─── User Categories ─────────────────────────────────────────────────────────
  userCategories: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.select().from(userCategories)
        .where(and(eq(userCategories.orgId, ctx.user.orgId), eq(userCategories.isActive, true)))
        .orderBy(userCategories.name);
    }),
    create: protectedProcedure
      .input(z.object({
        code: z.string().optional(),
        name: z.string().min(1),
        autoNumbering: z.boolean().optional(),
        firstNumber: z.number().optional(),
        lastNumber: z.number().optional(),
        increment: z.number().optional(),
        codeDigits: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.code) {
          const dup = await db.select({ id: userCategories.id }).from(userCategories)
            .where(and(eq(userCategories.orgId, ctx.user.orgId), eq(userCategories.code, input.code), eq(userCategories.isActive, true)))
            .limit(1);
          if (dup.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'الكود مكرر — يوجد فئة بنفس الكود' });
        }
        const [c] = await db.insert(userCategories).values({
          orgId: ctx.user.orgId,
          code: input.code,
          name: input.name,
          autoNumbering: input.autoNumbering ?? true,
          firstNumber: input.firstNumber ?? 1,
          lastNumber: input.lastNumber ?? 99999,
          increment: input.increment ?? 1,
          codeDigits: input.codeDigits ?? 5,
        }).returning();
        return c;
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        code: z.string().optional(),
        name: z.string().optional(),
        autoNumbering: z.boolean().optional(),
        firstNumber: z.number().optional(),
        lastNumber: z.number().optional(),
        increment: z.number().optional(),
        codeDigits: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
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
      .mutation(async ({ input, ctx }) => {
        await db.update(userCategories).set({ isActive: false })
          .where(and(eq(userCategories.id, input.id), eq(userCategories.orgId, ctx.user.orgId)));
        return { success: true };
      }),
    nextCode: protectedProcedure
      .input(z.object({ categoryId: z.number() }))
      .query(async ({ input, ctx }) => {
        const cat = await db.select().from(userCategories)
          .where(and(eq(userCategories.id, input.categoryId), eq(userCategories.orgId, ctx.user.orgId)))
          .limit(1);
        if (!cat.length || !cat[0].autoNumbering) return null;
        const c = cat[0];
        const prefix = c.code ?? "";
        const numDigits = Math.max(c.codeDigits - prefix.length, 1);
        // find all users in this category to get max used number
        const catUsers = await db.select({ code: users.code })
          .from(users)
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
        const nextCode = prefix + String(nextNum).padStart(numDigits, '0');
        return { code: nextCode, category: c };
      }),
  }),

  // ─── User Group Members ───────────────────────────────────────────────────────
  groupMembers: router({
    list: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ input, ctx }) => {
        return db.select().from(userGroupMembers)
          .where(and(eq(userGroupMembers.groupId, input.groupId), eq(userGroupMembers.orgId, ctx.user.orgId)))
          .orderBy(userGroupMembers.createdAt);
      }),
    add: protectedProcedure
      .input(z.object({
        groupId: z.number(),
        memberType: z.enum(['user', 'group']),
        memberCode: z.string().min(1),
        memberName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        let resolvedName = input.memberName;
        if (input.memberType === 'user') {
          const found = await db.select({ id: users.id, name: users.name })
            .from(users)
            .where(and(eq(users.orgId, ctx.user.orgId), eq(users.code, input.memberCode)))
            .limit(1);
          if (!found.length) throw new TRPCError({ code: 'BAD_REQUEST', message: `كود المستخدم "${input.memberCode}" غير موجود في النظام` });
          resolvedName = found[0].name;
        } else {
          const found = await db.select({ id: userGroups.id, name: userGroups.name })
            .from(userGroups)
            .where(and(eq(userGroups.orgId, ctx.user.orgId), eq(userGroups.code, input.memberCode), eq(userGroups.isActive, true)))
            .limit(1);
          if (!found.length) throw new TRPCError({ code: 'BAD_REQUEST', message: `كود المجموعة "${input.memberCode}" غير موجود في النظام` });
          resolvedName = found[0].name;
        }
        const existing = await db.select({ id: userGroupMembers.id })
          .from(userGroupMembers)
          .where(and(
            eq(userGroupMembers.groupId, input.groupId),
            eq(userGroupMembers.orgId, ctx.user.orgId),
            eq(userGroupMembers.memberType, input.memberType),
            eq(userGroupMembers.memberCode, input.memberCode),
          )).limit(1);
        if (existing.length) throw new TRPCError({ code: 'BAD_REQUEST', message: `العضو تم تكرار بالجدول` });
        const [m] = await db.insert(userGroupMembers).values({
          groupId: input.groupId,
          orgId: ctx.user.orgId,
          memberType: input.memberType,
          memberCode: input.memberCode,
          memberName: resolvedName,
        }).returning();
        return m;
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
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
      .mutation(async ({ input, ctx }) => {
        if (!input.members.length) return { count: 0 };
        // deduplicate the input array by (memberType + memberCode)
        const seen = new Set<string>();
        const unique = input.members.filter(m => {
          const key = `${m.memberType}:${m.memberCode}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        // check for duplicates against existing members in the group
        const existingMembers = await db.select({ memberType: userGroupMembers.memberType, memberCode: userGroupMembers.memberCode })
          .from(userGroupMembers)
          .where(and(eq(userGroupMembers.groupId, input.groupId), eq(userGroupMembers.orgId, ctx.user.orgId)));
        const existingSet = new Set(existingMembers.map(m => `${m.memberType}:${m.memberCode}`));
        const toInsert = unique.filter(m => !existingSet.has(`${m.memberType}:${m.memberCode}`));
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
  }),

  // ─── Sales ───────────────────────────────────────────────────────────────────
  sales: salesRouter,

  // ─── Chat ────────────────────────────────────────────────────────────────────
  chat: chatRouter,

  // ─── Dashboard ───────────────────────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user.orgId;
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [todayRows, monthRows, productCountRow, pendingTransferRow] = await Promise.all([
        db.select({
          total: sql<string>`coalesce(sum(${salesInvoices.total}), 0)`,
          count: sql<string>`count(*)`,
        }).from(salesInvoices).where(
          and(
            eq(salesInvoices.orgId, orgId),
            sql`${salesInvoices.invoiceDate} >= ${todayStart}`,
            sql`${salesInvoices.invoiceType} = 'sale'`,
            sql`${salesInvoices.status} != 'cancelled'`,
          )
        ),
        db.select({
          total: sql<string>`coalesce(sum(${salesInvoices.total}), 0)`,
          count: sql<string>`count(*)`,
        }).from(salesInvoices).where(
          and(
            eq(salesInvoices.orgId, orgId),
            sql`${salesInvoices.invoiceDate} >= ${monthStart}`,
            sql`${salesInvoices.invoiceType} = 'sale'`,
            sql`${salesInvoices.status} != 'cancelled'`,
          )
        ),
        db.select({ count: sql<string>`count(*)` }).from(products).where(
          and(eq(products.orgId, orgId), eq(products.isActive, true))
        ),
        db.select({ count: sql<string>`count(*)` }).from(stockVouchers).where(
          and(eq(stockVouchers.orgId, orgId), sql`${stockVouchers.type}::text = 'transfer'`, eq(stockVouchers.status, 'draft'))
        ),
      ]);

      return {
        todaySales: Number(todayRows[0]?.total ?? 0),
        todayInvoices: Number(todayRows[0]?.count ?? 0),
        monthSales: Number(monthRows[0]?.total ?? 0),
        monthInvoices: Number(monthRows[0]?.count ?? 0),
        productCount: Number(productCountRow[0]?.count ?? 0),
        pendingTransfers: Number(pendingTransferRow[0]?.count ?? 0),
      };
    }),

    salesChart: protectedProcedure
      .input(z.object({ days: z.number().default(7) }))
      .query(async ({ ctx, input }) => {
        const orgId = ctx.user.orgId;
        const since = new Date();
        since.setDate(since.getDate() - input.days);

        const rows = await db.select({
          date: sql<string>`date_trunc('day', ${salesInvoices.invoiceDate})::date`,
          total: sql<string>`coalesce(sum(${salesInvoices.total}), 0)`,
          count: sql<string>`count(*)`,
        }).from(salesInvoices).where(
          and(
            eq(salesInvoices.orgId, orgId),
            sql`${salesInvoices.invoiceDate} >= ${since}`,
            sql`${salesInvoices.invoiceType} = 'sale'`,
            sql`${salesInvoices.status} != 'cancelled'`,
          )
        ).groupBy(sql`date_trunc('day', ${salesInvoices.invoiceDate})::date`)
          .orderBy(sql`date_trunc('day', ${salesInvoices.invoiceDate})::date`);

        return rows.map(r => ({ date: r.date, total: Number(r.total), count: Number(r.count) }));
      }),

    topProducts: protectedProcedure
      .input(z.object({ limit: z.number().default(5) }))
      .query(async ({ ctx, input }) => {
        const orgId = ctx.user.orgId;
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const rows = await db.select({
          productId: salesInvoiceItems.productId,
          productName: salesInvoiceItems.productName,
          totalQty: sql<string>`sum(${salesInvoiceItems.quantity})`,
          totalRevenue: sql<string>`sum(${salesInvoiceItems.total})`,
        }).from(salesInvoiceItems)
          .innerJoin(salesInvoices, eq(salesInvoiceItems.invoiceId, salesInvoices.id))
          .where(
            and(
              eq(salesInvoices.orgId, orgId),
              sql`${salesInvoices.invoiceDate} >= ${monthStart}`,
              sql`${salesInvoices.invoiceType} = 'sale'`,
              sql`${salesInvoices.status} != 'cancelled'`,
            )
          )
          .groupBy(salesInvoiceItems.productId, salesInvoiceItems.productName)
          .orderBy(desc(sql`sum(${salesInvoiceItems.total})`))
          .limit(input.limit);

        return rows.map(r => ({
          productId: r.productId,
          productName: r.productName,
          totalQty: Number(r.totalQty),
          totalRevenue: Number(r.totalRevenue),
        }));
      }),
  }),

  // ─── Products ────────────────────────────────────────────────────────────────
  products: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        categoryId: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const conditions = [eq(products.orgId, ctx.user.orgId), eq(products.isActive, true)];
        if (input?.search) {
          conditions.push(or(
            like(products.name, `%${input.search}%`),
            like(products.code, `%${input.search}%`),
            like(products.barcode, `%${input.search}%`)
          ) as any);
        }
        if (input?.categoryId) {
          conditions.push(eq(products.groupId, input.categoryId));
        }
        return db.query.products.findMany({
          where: and(...conditions),
          orderBy: (p, { asc }) => [asc(p.name)],
        });
      }),
    search: protectedProcedure
      .input(z.object({ q: z.string() }))
      .query(async ({ ctx, input }) => {
        return db.query.products.findMany({
          where: and(
            eq(products.orgId, ctx.user.orgId),
            eq(products.isActive, true),
            or(like(products.name, `%${input.q}%`), like(products.code, `%${input.q}%`))
          ),
          limit: 20,
        });
      }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1, "اسم الصنف مطلوب"),
        name2: z.string().optional(),
        nameEn: z.string().optional(),
        sku: z.string().optional(),
        barcode: z.string().optional(),
        barcode2: z.string().optional(),
        barcode3: z.string().optional(),
        groupId: z.number().int().positive().optional(),
        categoryId: z.number().int().positive().optional(),
        unit: z.string().optional(),
        unit2: z.string().optional(),
        unit3: z.string().optional(),
        unitsJson: z.string().optional(),
        catsJson: z.string().optional(),
        salePrice: z.string().optional(),
        salePrice2: z.string().optional(),
        salePrice3: z.string().optional(),
        salePrice4: z.string().optional(),
        salePrice5: z.string().optional(),
        wholesalePrice: z.string().optional(),
        purchasePrice: z.string().optional(),
        costPrice: z.string().optional(),
        vatRate: z.string().optional(),
        taxRate: z.string().optional(),
        taxable: z.boolean().optional(),
        taxType: z.string().optional(),
        minStock: z.number().optional(),
        maxStock: z.number().optional(),
        reorderPoint: z.number().optional(),
        itemType: z.string().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        description: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const {
          name, name2, nameEn, sku,
          barcode, barcode2, barcode3,
          groupId, categoryId,
          unit, unit2, unit3, unitsJson, catsJson,
          salePrice, salePrice2, salePrice3, salePrice4, salePrice5,
          wholesalePrice, purchasePrice, costPrice,
          vatRate, taxRate, taxable, taxType,
          minStock, maxStock, reorderPoint,
          itemType, brand, model,
          description, notes,
        } = input;

        if (!name || !name.trim()) {
          throw new Error("اسم الصنف مطلوب");
        }

        const resolvedGroupId = groupId ?? categoryId ?? undefined;

        const extraData: Record<string, any> = {};
        if (name2)           extraData.name2 = name2;
        if (barcode2)        extraData.barcode2 = barcode2;
        if (barcode3)        extraData.barcode3 = barcode3;
        if (unit2)           extraData.unit2 = unit2;
        if (unit3)           extraData.unit3 = unit3;
        if (unitsJson)       extraData.unitsJson = unitsJson;
        if (catsJson)        extraData.catsJson = catsJson;
        if (salePrice2)      extraData.salePrice2 = salePrice2;
        if (salePrice3)      extraData.salePrice3 = salePrice3;
        if (salePrice4)      extraData.salePrice4 = salePrice4;
        if (salePrice5)      extraData.salePrice5 = salePrice5;
        if (wholesalePrice)  extraData.wholesalePrice = wholesalePrice;
        if (maxStock != null)       extraData.maxStock = maxStock;
        if (reorderPoint != null)   extraData.reorderPoint = reorderPoint;
        if (taxable != null)        extraData.taxable = taxable;
        if (taxType)         extraData.taxType = taxType;
        if (itemType)        extraData.itemType = itemType;
        if (brand)           extraData.brand = brand;
        if (model)           extraData.model = model;

        const notesStr = description
          ? (Object.keys(extraData).length ? `${description}\n---\n${JSON.stringify(extraData)}` : description)
          : (Object.keys(extraData).length ? JSON.stringify(extraData) : (notes ?? undefined));

        console.log("[products.create] inserting:", {
          name: name.trim(),
          code: sku || undefined,
          groupId: resolvedGroupId,
          unit: unit || "قطعة",
          salePrice: salePrice || "0",
        });

        try {
          const [p] = await db.insert(products).values({
            name:          name.trim(),
            nameEn:        nameEn?.trim() || name2?.trim() || undefined,
            code:          sku?.trim() || undefined,
            barcode:       barcode?.trim() || undefined,
            groupId:       resolvedGroupId,
            unit:          unit?.trim() || "قطعة",
            salePrice:     salePrice || "0",
            purchasePrice: costPrice || purchasePrice || "0",
            taxRate:       vatRate || taxRate || "0",
            minStock:      minStock != null ? String(minStock) : "0",
            isActive:      true,
            notes:         notesStr,
            orgId:         ctx.user.orgId,
          }).returning();
          return p;
        } catch (err: any) {
          console.error("[products.create] DB error:", err?.message ?? err);
          throw new Error("فشل حفظ الصنف — تحقق من البيانات المدخلة");
        }
      }),
    bulkImport: protectedProcedure
      .input(z.object({
        rows: z.array(z.object({
          name: z.string().min(1),
          nameEn: z.string().optional(),
          sku: z.string().optional(),
          barcode: z.string().optional(),
          unit: z.string().optional(),
          salePrice: z.string().optional(),
          purchasePrice: z.string().optional(),
          taxRate: z.string().optional(),
          minStock: z.string().optional(),
          notes: z.string().optional(),
        })).min(1).max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const values = input.rows.map(r => ({
          name:          r.name.trim(),
          nameEn:        r.nameEn?.trim() || undefined,
          code:          r.sku?.trim() || undefined,
          barcode:       r.barcode?.trim() || undefined,
          unit:          r.unit?.trim() || "قطعة",
          salePrice:     r.salePrice || "0",
          purchasePrice: r.purchasePrice || "0",
          taxRate:       r.taxRate || "0",
          minStock:      r.minStock || "0",
          notes:         r.notes?.trim() || undefined,
          isActive:      true as const,
          orgId:         ctx.user.orgId,
        }));
        const inserted = await db.insert(products).values(values).returning({ id: products.id });
        return { count: inserted.length };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        name2: z.string().optional(),
        nameEn: z.string().optional(),
        sku: z.string().optional(),
        barcode: z.string().optional(),
        barcode2: z.string().optional(),
        barcode3: z.string().optional(),
        groupId: z.number().optional(),
        categoryId: z.number().optional(),
        unit: z.string().optional(),
        unit2: z.string().optional(),
        unit3: z.string().optional(),
        unitsJson: z.string().optional(),
        catsJson: z.string().optional(),
        salePrice: z.string().optional(),
        salePrice2: z.string().optional(),
        salePrice3: z.string().optional(),
        salePrice4: z.string().optional(),
        salePrice5: z.string().optional(),
        wholesalePrice: z.string().optional(),
        purchasePrice: z.string().optional(),
        costPrice: z.string().optional(),
        vatRate: z.string().optional(),
        taxRate: z.string().optional(),
        taxable: z.boolean().optional(),
        taxType: z.string().optional(),
        minStock: z.number().optional(),
        maxStock: z.number().optional(),
        reorderPoint: z.number().optional(),
        itemType: z.string().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        notes: z.string().optional(),
      }).passthrough())
      .mutation(async ({ ctx, input }) => {
        const { id, sku, name2, nameEn, categoryId, costPrice, vatRate, taxable, taxType,
          barcode2, barcode3, unit2, unit3, unitsJson, catsJson,
          salePrice2, salePrice3, salePrice4, salePrice5,
          wholesalePrice, maxStock, reorderPoint, itemType, brand, model, description,
          ...rest } = input as any;

        const extraData: Record<string, any> = {};
        if (name2 !== undefined) extraData.name2 = name2;
        if (barcode2 !== undefined) extraData.barcode2 = barcode2;
        if (barcode3 !== undefined) extraData.barcode3 = barcode3;
        if (unit2 !== undefined) extraData.unit2 = unit2;
        if (unit3 !== undefined) extraData.unit3 = unit3;
        if (unitsJson !== undefined) extraData.unitsJson = unitsJson;
        if (catsJson !== undefined) extraData.catsJson = catsJson;
        if (salePrice2 !== undefined) extraData.salePrice2 = salePrice2;
        if (salePrice3 !== undefined) extraData.salePrice3 = salePrice3;
        if (salePrice4 !== undefined) extraData.salePrice4 = salePrice4;
        if (salePrice5 !== undefined) extraData.salePrice5 = salePrice5;
        if (wholesalePrice !== undefined) extraData.wholesalePrice = wholesalePrice;
        if (maxStock !== undefined) extraData.maxStock = maxStock;
        if (reorderPoint !== undefined) extraData.reorderPoint = reorderPoint;
        if (taxable !== undefined) extraData.taxable = taxable;
        if (taxType !== undefined) extraData.taxType = taxType;
        if (itemType !== undefined) extraData.itemType = itemType;
        if (brand !== undefined) extraData.brand = brand;
        if (model !== undefined) extraData.model = model;

        const notesStr = description
          ? (Object.keys(extraData).length ? `${description}\n---\n${JSON.stringify(extraData)}` : description)
          : (Object.keys(extraData).length ? JSON.stringify(extraData) : rest.notes);

        const updateData: Record<string, any> = {};
        if (rest.name !== undefined) updateData.name = rest.name;
        if (nameEn !== undefined || name2 !== undefined) updateData.nameEn = nameEn || name2;
        if (sku !== undefined || rest.code !== undefined) updateData.code = sku || rest.code;
        if (rest.barcode !== undefined) updateData.barcode = rest.barcode;
        if (rest.groupId !== undefined || categoryId !== undefined) updateData.groupId = rest.groupId || categoryId;
        if (rest.unit !== undefined) updateData.unit = rest.unit;
        if (rest.salePrice !== undefined) updateData.salePrice = rest.salePrice;
        if (costPrice !== undefined || rest.purchasePrice !== undefined) updateData.purchasePrice = costPrice || rest.purchasePrice;
        if (vatRate !== undefined || rest.taxRate !== undefined) updateData.taxRate = vatRate || rest.taxRate;
        if (rest.minStock !== undefined) updateData.minStock = String(rest.minStock);
        if (rest.isActive !== undefined) updateData.isActive = rest.isActive;
        if (notesStr !== undefined) updateData.notes = notesStr;

        await db.update(products).set(updateData as any)
          .where(and(eq(products.id, id), eq(products.orgId, ctx.user.orgId)));
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.update(products).set({ isActive: false } as any)
          .where(and(eq(products.id, input.id), eq(products.orgId, ctx.user.orgId)));
        return { success: true };
      }),
  }),

  // ─── Categories (Product Groups used as categories) ───────────────────────────
  categories: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const rows = await db.query.productGroups.findMany({
        where: eq(productGroups.orgId, ctx.user.orgId),
        orderBy: (g, { asc }) => [asc(g.name)],
      });
      return rows.map(r => ({ ...r, uuid: String(r.id), isActive: r.isActive ?? true }));
    }),
    tree: protectedProcedure.query(async ({ ctx }) => {
      const rows = await db.query.productGroups.findMany({
        where: eq(productGroups.orgId, ctx.user.orgId),
        orderBy: (g, { asc }) => [asc(g.name)],
      });
      return rows.map(r => ({ ...r, uuid: String(r.id), isActive: r.isActive ?? true }));
    }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        parentId: z.number().optional(),
        description: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const [g] = await db.insert(productGroups).values({
          orgId: ctx.user.orgId,
          name: input.name,
          parentId: input.parentId,
          description: input.description,
          color: input.color,
        }).returning();
        return { ...g, uuid: String(g.id), isActive: g.isActive ?? true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.update(productGroups)
          .set(data)
          .where(and(eq(productGroups.id, id), eq(productGroups.orgId, ctx.user.orgId)));
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.delete(productGroups)
          .where(and(eq(productGroups.id, input.id), eq(productGroups.orgId, ctx.user.orgId)));
        return { success: true };
      }),
  }),

  // ─── Product Groups ───────────────────────────────────────────────────────────
  productGroups: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.productGroups.findMany({
        where: eq(productGroups.orgId, ctx.user.orgId),
        orderBy: (g, { asc }) => [asc(g.groupCode), asc(g.name)],
      });
    }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        name2: z.string().optional(),
        groupCode: z.string().optional(),
        description: z.string().optional(),
        parentId: z.number().optional(),
        groupType: z.string().optional(),
        level: z.number().optional(),
        autoNumbering: z.boolean().optional(),
        firstNumber: z.number().optional(),
        lastNumber: z.number().optional(),
        increment: z.number().optional(),
        codeDigits: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const [g] = await db.insert(productGroups).values({ ...input, orgId: ctx.user.orgId }).returning();
        return g;
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        name2: z.string().optional(),
        groupCode: z.string().optional(),
        description: z.string().optional(),
        parentId: z.number().optional(),
        groupType: z.string().optional(),
        level: z.number().optional(),
        autoNumbering: z.boolean().optional(),
        firstNumber: z.number().optional(),
        lastNumber: z.number().optional(),
        increment: z.number().optional(),
        codeDigits: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.update(productGroups).set(data as any).where(and(eq(productGroups.id, id), eq(productGroups.orgId, ctx.user.orgId)));
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.delete(productGroups)
          .where(and(eq(productGroups.id, input.id), eq(productGroups.orgId, ctx.user.orgId)));
        return { success: true };
      }),
    nextCode: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        const group = await db.query.productGroups.findFirst({
          where: and(eq(productGroups.id, input.groupId), eq(productGroups.orgId, ctx.user.orgId)),
        });
        if (!group) return null;
        const prefix = group.groupCode ?? '';
        const totalDigits = group.codeDigits ?? 5;
        const seqLen = Math.max(1, totalDigits - prefix.length);
        const firstNum = group.firstNumber ?? 1;
        const incr = group.increment ?? 1;
        const lastNum = group.lastNumber ?? 99999;
        // Find the last product code in this group using proper drizzle helpers
        const existing = await db.select({ code: products.code })
          .from(products)
          .where(
            and(
              eq(products.orgId, ctx.user.orgId),
              prefix
                ? like(products.code, prefix + '%')
                : isNotNull(products.code)
            )
          )
          .orderBy(desc(products.code));
        let nextNum = firstNum;
        if (existing.length > 0) {
          const nums = existing
            .map(p => {
              const seq = (p.code ?? '').substring(prefix.length);
              const n = parseInt(seq, 10);
              return isNaN(n) ? -1 : n;
            })
            .filter(n => n >= 0);
          if (nums.length > 0) {
            nextNum = Math.max(...nums) + incr;
          }
        }
        if (nextNum > lastNum) return null;
        const seqPart = String(nextNum).padStart(seqLen, '0');
        return prefix + seqPart;
      }),
  }),

  // ─── Customers ───────────────────────────────────────────────────────────────
  customers: router({
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
      }))
      .mutation(async ({ ctx, input }) => {
        const [c] = await db.insert(customers).values({
          ...input,
          orgId: ctx.user.orgId,
          isActive: true,
        }).returning();
        return c;
      }),
  }),

  // ─── Suppliers ───────────────────────────────────────────────────────────────
  suppliers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.suppliers.findMany({
        where: and(eq(suppliers.orgId, ctx.user.orgId), eq(suppliers.isActive, true)),
        orderBy: (s, { asc }) => [asc(s.name)],
      });
    }),
  }),

  // ─── Chart of Accounts ───────────────────────────────────────────────────────
  accounts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.chartOfAccounts.findMany({
        where: and(eq(chartOfAccounts.orgId, ctx.user.orgId), eq(chartOfAccounts.isActive, true)),
        orderBy: (a, { asc }) => [asc(a.code)],
      });
    }),
    children: protectedProcedure
      .input(z.object({ parentId: z.number().int().nullable() }))
      .query(async ({ ctx, input }) => {
        const parentCond = input.parentId === null
          ? isNull(chartOfAccounts.parentId)
          : eq(chartOfAccounts.parentId, input.parentId);
        return db
          .select({
            id:          chartOfAccounts.id,
            code:        chartOfAccounts.code,
            name:        chartOfAccounts.name,
            accountType: chartOfAccounts.accountType,
            nature:      chartOfAccounts.nature,
            level:       chartOfAccounts.level,
            isParent:    chartOfAccounts.isParent,
            allowPosting:chartOfAccounts.allowPosting,
            parentId:    chartOfAccounts.parentId,
          })
          .from(chartOfAccounts)
          .where(and(
            eq(chartOfAccounts.orgId, ctx.user.orgId),
            eq(chartOfAccounts.isActive, true),
            parentCond,
          ))
          .orderBy(asc(chartOfAccounts.code));
      }),
    create: protectedProcedure
      .input(z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        nameEn: z.string().optional(),
        accountType: z.string().default('assets'),
        nature: z.string().default('debit'),
        level: z.number().int().min(1).max(10).default(1),
        parentId: z.number().int().optional(),
        isParent: z.boolean().default(false),
        allowPosting: z.boolean().default(true),
        costCenterType: z.enum(['not_allowed', 'optional', 'mandatory']).default('not_allowed'),
        isActive: z.boolean().default(true),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // تحقق تكرار الكود
        const exists = await db.select({ id: chartOfAccounts.id }).from(chartOfAccounts)
          .where(and(eq(chartOfAccounts.orgId, ctx.user.orgId), eq(chartOfAccounts.code, input.code), eq(chartOfAccounts.isActive, true)))
          .limit(1);
        if (exists.length > 0) throw new TRPCError({ code: 'BAD_REQUEST', message: `كود الحساب "${input.code}" موجود بالفعل` });
        // تحقق الحساب الأب: يجب أن يكون isParent = true
        if (input.parentId) {
          const parent = await db.select({ id: chartOfAccounts.id, isParent: chartOfAccounts.isParent }).from(chartOfAccounts)
            .where(and(eq(chartOfAccounts.id, input.parentId), eq(chartOfAccounts.orgId, ctx.user.orgId)))
            .limit(1);
          if (!parent.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'الحساب الأب غير موجود' });
          if (!parent[0].isParent) throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن إضافة حساب تحت حساب فرعي — الحساب الفرعي لا يقبل حسابات تحته' });
        }
        const insertData: Record<string, unknown> = {
          orgId: ctx.user.orgId,
          code: input.code,
          name: input.name,
          accountType: input.accountType,
          nature: input.nature,
          level: input.level,
          isParent: input.isParent,
          allowPosting: input.allowPosting,
          costCenterType: input.costCenterType,
          isActive: input.isActive,
        };
        if (input.nameEn)   insertData.nameEn  = input.nameEn;
        if (input.parentId) insertData.parentId = input.parentId;
        if (input.notes)    insertData.notes    = input.notes;

        const [account] = await db.insert(chartOfAccounts).values(insertData as any).returning();
        // تحديث الحساب الأب: اضبط isParent=true إذا لم يكن كذلك
        if (input.parentId) {
          await db.update(chartOfAccounts).set({ isParent: true })
            .where(and(eq(chartOfAccounts.id, input.parentId), eq(chartOfAccounts.orgId, ctx.user.orgId)));
        }
        return account;
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // تحقق: هل يوجد حسابات فرعية نشطة مرتبطة بهذا الحساب؟
        const children = await db
          .select({ id: chartOfAccounts.id, code: chartOfAccounts.code, name: chartOfAccounts.name })
          .from(chartOfAccounts)
          .where(and(
            eq(chartOfAccounts.parentId, input.id),
            eq(chartOfAccounts.orgId, ctx.user.orgId),
            eq(chartOfAccounts.isActive, true),
          ))
          .limit(1);
        if (children.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `لا يمكن حذف هذا الحساب لأنه يحتوي على حسابات فرعية — يجب حذف الحسابات الفرعية أولاً`,
          });
        }
        await db.update(chartOfAccounts).set({ isActive: false })
          .where(and(eq(chartOfAccounts.id, input.id), eq(chartOfAccounts.orgId, ctx.user.orgId)));
        return { success: true };
      }),
    import: protectedProcedure
      .input(z.object({
        accounts: z.array(z.object({
          code: z.string().min(1),
          name: z.string().min(1),
          nameEn: z.string().optional(),
          accountType: z.string().default('assets'),
          nature: z.string().default('debit'),
          level: z.number().int().min(1).max(10).default(1),
          isParent: z.boolean().default(false),
          allowPosting: z.boolean().default(true),
          openingBalance: z.string().optional(),
          openingBalanceType: z.string().default('debit'),
        })),
        skipDuplicates: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.select({ code: chartOfAccounts.code }).from(chartOfAccounts)
          .where(and(eq(chartOfAccounts.orgId, ctx.user.orgId), eq(chartOfAccounts.isActive, true)));
        const existingCodes = new Set(existing.map(r => r.code));
        const toInsert = input.accounts.filter(a => !existingCodes.has(a.code) || !input.skipDuplicates);
        if (toInsert.length === 0) return { inserted: 0, skipped: input.accounts.length };
        await db.insert(chartOfAccounts).values(toInsert.map(a => ({ ...a, orgId: ctx.user.orgId })));
        return { inserted: toInsert.length, skipped: input.accounts.length - toInsert.length };
      }),
  }),

  // ─── Journal Entries ─────────────────────────────────────────────────────────
  journal: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.journalEntries.findMany({
        where: eq(journalEntries.orgId, ctx.user.orgId),
        orderBy: [desc(journalEntries.createdAt)],
        limit: 100,
      });
    }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const entry = await db.query.journalEntries.findFirst({
          where: and(eq(journalEntries.id, input.id), eq(journalEntries.orgId, ctx.user.orgId)),
        });
        if (!entry) throw new Error('القيد غير موجود');
        const lines = await db.query.journalEntryLines.findMany({
          where: eq(journalEntryLines.entryId, input.id),
          orderBy: (l, { asc }) => [asc(l.sortOrder)],
        });
        return { ...entry, lines };
      }),
    nextNumber: protectedProcedure.query(async ({ ctx }) => {
      const last = await db.query.journalEntries.findFirst({
        where: eq(journalEntries.orgId, ctx.user.orgId),
        orderBy: [desc(journalEntries.id)],
      });
      const num = last ? parseInt(last.entryNumber.replace(/\D/g, '') || '0') + 1 : 1;
      return `JE-${String(num).padStart(4, '0')}`;
    }),
    create: protectedProcedure
      .input(z.object({
        entryNumber: z.string(),
        entryDate: z.string(),
        description: z.string().optional(),
        reference: z.string().optional(),
        totalDebit: z.string(),
        totalCredit: z.string(),
        lines: z.array(z.object({
          accountId: z.number().optional(),
          accountCode: z.string().optional(),
          accountName: z.string().optional(),
          description: z.string().optional(),
          debit: z.string().default('0'),
          credit: z.string().default('0'),
          sortOrder: z.number().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const { lines, entryDate, ...rest } = input;
        const [entry] = await db.insert(journalEntries).values({
          ...rest,
          orgId: ctx.user.orgId,
          userId: ctx.user.id,
          entryDate: new Date(entryDate),
          status: 'posted',
        }).returning();
        if (lines.length > 0) {
          await db.insert(journalEntryLines).values(
            lines.map((l, i) => ({ ...l, entryId: entry.id, orgId: ctx.user.orgId, sortOrder: l.sortOrder ?? i }))
          );
        }
        return entry;
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.update(journalEntries)
          .set({ status: 'cancelled' })
          .where(and(eq(journalEntries.id, input.id), eq(journalEntries.orgId, ctx.user.orgId)));
        return { success: true };
      }),
    getByNumber: protectedProcedure
      .input(z.object({ entryNumber: z.string() }))
      .query(async ({ ctx, input }) => {
        const entry = await db.query.journalEntries.findFirst({
          where: and(eq(journalEntries.entryNumber, input.entryNumber), eq(journalEntries.orgId, ctx.user.orgId)),
        });
        if (!entry) return null;
        const lines = await db.query.journalEntryLines.findMany({
          where: eq(journalEntryLines.entryId, entry.id),
          orderBy: (l, { asc }) => [asc(l.sortOrder)],
        });
        return { ...entry, lines };
      }),
  }),

  // ─── Vouchers ────────────────────────────────────────────────────────────────
  vouchers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.vouchers.findMany({
        where: eq(vouchers.orgId, ctx.user.orgId),
        orderBy: [desc(vouchers.createdAt)],
        limit: 100,
      });
    }),
    nextNumber: protectedProcedure
      .input(z.object({ type: z.enum(['receipt', 'payment']) }))
      .query(async ({ ctx, input }) => {
        const last = await db.query.vouchers.findFirst({
          where: and(eq(vouchers.orgId, ctx.user.orgId), eq(vouchers.voucherType, input.type)),
          orderBy: [desc(vouchers.id)],
        });
        const prefix = input.type === 'receipt' ? 'RV' : 'PV';
        const num = last ? parseInt(last.voucherNumber.replace(/\D/g, '') || '0') + 1 : 1;
        return `${prefix}-${String(num).padStart(4, '0')}`;
      }),
    create: protectedProcedure
      .input(z.object({
        voucherNumber: z.string(),
        voucherType: z.enum(['receipt', 'payment']),
        voucherDate: z.string(),
        amount: z.string(),
        paymentMethod: z.enum(['cash', 'bank', 'credit', 'check', 'other']).default('cash'),
        accountCode: z.string().optional(),
        accountName: z.string().optional(),
        partyType: z.string().optional(),
        partyName: z.string().optional(),
        description: z.string().optional(),
        reference: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const [v] = await db.insert(vouchers).values({
          ...input,
          orgId: ctx.user.orgId,
          userId: ctx.user.id,
          voucherDate: new Date(input.voucherDate),
          status: 'posted',
        }).returning();
        return v;
      }),
  }),

  // ─── Branches ────────────────────────────────────────────────────────────────
  branches: router({
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
        await db.update(branches).set(data as any).where(and(eq(branches.id, id), eq(branches.orgId, ctx.user.orgId)));
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const hasWarehouses = await db.select({ id: warehouses.id }).from(warehouses)
          .where(and(eq(warehouses.branchId, input.id), eq(warehouses.orgId, ctx.user.orgId), eq(warehouses.isActive, true)))
          .limit(1);
        if (hasWarehouses.length > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف الفرع لأنه مرتبط بمخازن' });
        }
        const hasInvoices = await db.select({ id: salesInvoices.id }).from(salesInvoices)
          .where(and(eq(salesInvoices.branchId, input.id), eq(salesInvoices.orgId, ctx.user.orgId)))
          .limit(1);
        if (hasInvoices.length > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف الفرع لأنه مرتبط بفواتير مبيعات' });
        }
        const hasInventoryCounts = await db.select({ id: inventoryCounts.id }).from(inventoryCounts)
          .where(and(eq(inventoryCounts.branchId, input.id), eq(inventoryCounts.orgId, ctx.user.orgId)))
          .limit(1);
        if (hasInventoryCounts.length > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف الفرع لأنه مرتبط بعمليات جرد مخزني' });
        }
        await db.update(branches).set({ isActive: false })
          .where(and(eq(branches.id, input.id), eq(branches.orgId, ctx.user.orgId)));
        return { success: true };
      }),
  }),

  // ─── Warehouses ──────────────────────────────────────────────────────────────
  warehouses: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.warehouses.findMany({
        where: and(eq(warehouses.orgId, ctx.user.orgId), eq(warehouses.isActive, true)),
        orderBy: (w, { asc }) => [asc(w.name)],
      });
    }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        code: z.string().optional(),
        branchId: z.number().optional(),
        name2: z.string().optional(),
        fullName1: z.string().optional(),
        fullName2: z.string().optional(),
        description: z.string().optional(),
        invAccountId: z.number().optional(),
        cogsAccount1Id: z.number().optional(),
        cogsAccount2Id: z.number().optional(),
        cashAccountId: z.number().optional(),
        bankAccountId: z.number().optional(),
        salesAccount1Id: z.number().optional(),
        allowedUserId: z.number().optional(),
        allowedUserGroup: z.string().optional(),
        copyFromWarehouseId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { description, ...rest } = input;
        const [w] = await db.insert(warehouses).values({ ...rest, address: description, orgId: ctx.user.orgId, isActive: true }).returning();
        return w;
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        code: z.string().optional(),
        branchId: z.number().optional(),
        name2: z.string().optional(),
        fullName1: z.string().optional(),
        fullName2: z.string().optional(),
        description: z.string().optional(),
        invAccountId: z.number().optional(),
        cogsAccount1Id: z.number().optional(),
        cogsAccount2Id: z.number().optional(),
        cashAccountId: z.number().optional(),
        bankAccountId: z.number().optional(),
        salesAccount1Id: z.number().optional(),
        allowedUserId: z.number().optional(),
        allowedUserGroup: z.string().optional(),
        copyFromWarehouseId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, description, ...rest } = input;
        await db.update(warehouses).set({ ...rest, address: description } as any).where(and(eq(warehouses.id, id), eq(warehouses.orgId, ctx.user.orgId)));
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const hasInventory = await db.select({ id: inventory.id }).from(inventory)
          .where(and(eq(inventory.warehouseId, input.id), eq(inventory.orgId, ctx.user.orgId)))
          .limit(1);
        if (hasInventory.length > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف المخزن لأنه مرتبط بمنتجات في المخزون' });
        }
        const hasVouchers = await db.select({ id: stockVouchers.id }).from(stockVouchers)
          .where(and(eq(stockVouchers.warehouseId, input.id), eq(stockVouchers.orgId, ctx.user.orgId)))
          .limit(1);
        if (hasVouchers.length > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف المخزن لأنه مرتبط بحركات مخزنية' });
        }
        const hasInventoryCounts = await db.select({ id: inventoryCounts.id }).from(inventoryCounts)
          .where(and(eq(inventoryCounts.warehouseId, input.id), eq(inventoryCounts.orgId, ctx.user.orgId)))
          .limit(1);
        if (hasInventoryCounts.length > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف المخزن لأنه مرتبط بعمليات جرد مخزني' });
        }
        const hasSalesInvoices = await db.select({ id: salesInvoices.id }).from(salesInvoices)
          .where(and(eq(salesInvoices.warehouseId, input.id), eq(salesInvoices.orgId, ctx.user.orgId)))
          .limit(1);
        if (hasSalesInvoices.length > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن حذف المخزن لأنه مرتبط بفواتير مبيعات' });
        }
        await db.update(warehouses).set({ isActive: false } as any)
          .where(and(eq(warehouses.id, input.id), eq(warehouses.orgId, ctx.user.orgId)));
        return { success: true };
      }),
    accountLinks: router({
      list: protectedProcedure
        .input(z.object({ warehouseId: z.number() }))
        .query(async ({ input }) => {
          return db.select().from(warehouseAccountLinks)
            .where(eq(warehouseAccountLinks.warehouseId, input.warehouseId))
            .orderBy(warehouseAccountLinks.sortOrder);
        }),
      save: protectedProcedure
        .input(z.object({
          warehouseId: z.number(),
          links: z.array(z.object({
            id: z.number().optional(),
            label: z.string().min(1),
            accountId: z.number().nullable().optional(),
            sortOrder: z.number().default(0),
          })),
        }))
        .mutation(async ({ input }) => {
          await db.delete(warehouseAccountLinks).where(eq(warehouseAccountLinks.warehouseId, input.warehouseId));
          if (input.links.length > 0) {
            await db.insert(warehouseAccountLinks).values(
              input.links.map((l, i) => ({
                warehouseId: input.warehouseId,
                label: l.label,
                accountId: l.accountId ?? null,
                sortOrder: i,
              }))
            );
          }
          return { success: true };
        }),
    }),
  }),

  // ─── Units ───────────────────────────────────────────────────────────────────
  units: router({
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
        await db.update(units).set(data as any).where(and(eq(units.id, id), eq(units.orgId, ctx.user.orgId)));
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.delete(units).where(and(eq(units.id, input.id), eq(units.orgId, ctx.user.orgId)));
        return { success: true };
      }),
  }),

  // ─── Stock Vouchers (سندات المخزن) ───────────────────────────────────────────
  stockVouchers: router({
    list: protectedProcedure
      .input(z.object({ type: z.enum(['receipt', 'issue', 'transfer']).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const conds = [eq(stockVouchers.orgId, ctx.user.orgId)];
        if (input?.type) conds.push(eq(stockVouchers.type, input.type));
        return db.query.stockVouchers.findMany({
          where: and(...conds),
          orderBy: [desc(stockVouchers.createdAt)],
          limit: 200,
        });
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const v = await db.query.stockVouchers.findFirst({
          where: and(eq(stockVouchers.id, input.id), eq(stockVouchers.orgId, ctx.user.orgId)),
        });
        if (!v) throw new Error('السند غير موجود');
        const items = await db.query.stockVoucherItems.findMany({ where: eq(stockVoucherItems.voucherId, input.id) });
        return { ...v, items };
      }),
    create: protectedProcedure
      .input(z.object({
        type: z.enum(['receipt', 'issue', 'transfer']),
        warehouseId: z.number(),
        branchId: z.number(),
        supplierId: z.number().optional(),
        reason: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(z.object({
          productId: z.number(),
          productName: z.string(),
          quantity: z.string(),
          unitCost: z.string(),
          totalCost: z.string(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const { items, ...rest } = input;
        const totalCost = items.reduce((s, i) => s + Number(i.totalCost), 0).toFixed(4);
        // توليد رقم السند
        const last = await db.query.stockVouchers.findFirst({
          where: eq(stockVouchers.orgId, ctx.user.orgId),
          orderBy: [desc(stockVouchers.id)],
        });
        const num = last ? parseInt(last.voucherNumber.replace(/\D/g, '') || '0') + 1 : 1;
        const prefix = rest.type === 'receipt' ? 'SV-IN' : rest.type === 'issue' ? 'SV-OUT' : 'SV-TR';
        const voucherNumber = `${prefix}-${String(num).padStart(4, '0')}`;
        const [v] = await db.insert(stockVouchers).values({
          ...rest, orgId: ctx.user.orgId, userId: ctx.user.id, voucherNumber, totalCost, status: 'confirmed',
        }).returning();
        if (items.length > 0) {
          await db.insert(stockVoucherItems).values(
            items.map((item, i) => ({ ...item, voucherId: v.id, orgId: ctx.user.orgId, sortOrder: i }))
          );
        }
        // تحديث المخزون
        for (const item of items) {
          const existing = await db.query.inventory.findFirst({
            where: and(eq(inventory.orgId, ctx.user.orgId), eq(inventory.productId, item.productId), eq(inventory.warehouseId, rest.warehouseId)),
          });
          const qty = Number(item.quantity);
          const diff = rest.type === 'receipt' ? qty : -qty;
          if (existing) {
            await db.update(inventory).set({ quantity: String(Number(existing.quantity) + diff), updatedAt: new Date() })
              .where(eq(inventory.id, existing.id));
          } else {
            await db.insert(inventory).values({ orgId: ctx.user.orgId, productId: item.productId, warehouseId: rest.warehouseId, quantity: String(Math.max(0, diff)), avgCost: item.unitCost });
          }
        }
        return v;
      }),
  }),

  // ─── Inventory Count (جرد المخزون) ────────────────────────────────────────────
  inventoryCount: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.inventoryCounts.findMany({
        where: eq(inventoryCounts.orgId, ctx.user.orgId),
        orderBy: [desc(inventoryCounts.createdAt)],
        limit: 100,
      });
    }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const count = await db.query.inventoryCounts.findFirst({
          where: and(eq(inventoryCounts.id, input.id), eq(inventoryCounts.orgId, ctx.user.orgId)),
        });
        if (!count) throw new Error('جلسة الجرد غير موجودة');
        const items = await db.query.inventoryCountItems.findMany({
          where: eq(inventoryCountItems.countId, input.id),
          orderBy: (i, { asc }) => [asc(i.sortOrder)],
        });
        return { ...count, items };
      }),
    create: protectedProcedure
      .input(z.object({ warehouseId: z.number(), branchId: z.number().optional(), notes: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const last = await db.query.inventoryCounts.findFirst({
          where: eq(inventoryCounts.orgId, ctx.user.orgId),
          orderBy: [desc(inventoryCounts.id)],
        });
        const num = last ? parseInt(last.countNumber.replace(/\D/g, '') || '0') + 1 : 1;
        const countNumber = `CNT-${String(num).padStart(4, '0')}`;
        const [count] = await db.insert(inventoryCounts).values({
          ...input, orgId: ctx.user.orgId, userId: ctx.user.id, countNumber, status: 'draft',
        }).returning();
        // جلب كميات المخزون الحالية للمخزن المحدد وإضافتها كعناصر جرد
        const invItems = await db.query.inventory.findMany({
          where: and(eq(inventory.orgId, ctx.user.orgId), eq(inventory.warehouseId, input.warehouseId)),
        });
        if (invItems.length > 0) {
          const productIds = invItems.map(i => i.productId);
          const prods = await db.query.products.findMany({
            where: and(eq(products.orgId, ctx.user.orgId)),
          });
          const prodMap = new Map(prods.map(p => [p.id, p]));
          await db.insert(inventoryCountItems).values(
            invItems.map((inv, i) => ({
              countId: count.id,
              orgId: ctx.user.orgId,
              productId: inv.productId,
              productName: prodMap.get(inv.productId)?.name ?? `#${inv.productId}`,
              systemQuantity: inv.quantity,
              actualQuantity: inv.quantity,
              difference: '0',
              sortOrder: i,
            }))
          );
        }
        return count.id;
      }),
    updateItem: protectedProcedure
      .input(z.object({ id: z.number(), actualQuantity: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const item = await db.query.inventoryCountItems.findFirst({ where: eq(inventoryCountItems.id, input.id) });
        if (!item) throw new Error('العنصر غير موجود');
        const diff = (Number(input.actualQuantity) - Number(item.systemQuantity)).toFixed(4);
        await db.update(inventoryCountItems).set({ actualQuantity: input.actualQuantity, difference: diff }).where(eq(inventoryCountItems.id, input.id));
        return { success: true };
      }),
    confirm: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const count = await db.query.inventoryCounts.findFirst({
          where: and(eq(inventoryCounts.id, input.id), eq(inventoryCounts.orgId, ctx.user.orgId)),
        });
        if (!count) throw new Error('جلسة الجرد غير موجودة');
        if (count.status !== 'draft') throw new Error('تم تأكيد الجرد مسبقاً');
        const items = await db.query.inventoryCountItems.findMany({ where: eq(inventoryCountItems.countId, input.id) });
        // تطبيق الفروقات على المخزون
        for (const item of items) {
          if (!item.productId || !count.warehouseId) continue;
          const existing = await db.query.inventory.findFirst({
            where: and(eq(inventory.orgId, ctx.user.orgId), eq(inventory.productId, item.productId), eq(inventory.warehouseId, count.warehouseId)),
          });
          if (existing) {
            await db.update(inventory).set({ quantity: item.actualQuantity, updatedAt: new Date() }).where(eq(inventory.id, existing.id));
          } else {
            await db.insert(inventory).values({ orgId: ctx.user.orgId, productId: item.productId, warehouseId: count.warehouseId, quantity: item.actualQuantity });
          }
        }
        await db.update(inventoryCounts).set({ status: 'confirmed', confirmedAt: new Date() }).where(eq(inventoryCounts.id, input.id));
        return { success: true };
      }),
  }),

  // ─── Reports ──────────────────────────────────────────────────────────────────
  reports: router({
    stockByWarehouse: protectedProcedure
      .input(z.object({ warehouseId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const conds = [eq(inventory.orgId, ctx.user.orgId)];
        if (input?.warehouseId) conds.push(eq(inventory.warehouseId, input.warehouseId));
        const invRows = await db.query.inventory.findMany({ where: and(...conds) });
        const prods = await db.query.products.findMany({ where: eq(products.orgId, ctx.user.orgId) });
        const warehouseList = await db.query.warehouses.findMany({ where: eq(warehouses.orgId, ctx.user.orgId) });
        const prodMap = new Map(prods.map(p => [p.id, p]));
        const whMap = new Map(warehouseList.map(w => [w.id, w]));
        return invRows.map(r => {
          const p = prodMap.get(r.productId);
          const costPrice = r.avgCost ?? p?.purchasePrice ?? '0';
          const totalValue = Number(r.quantity) * Number(costPrice);
          return {
            productId: r.productId,
            productName: p?.name ?? `#${r.productId}`,
            warehouseId: r.warehouseId,
            warehouseName: whMap.get(r.warehouseId ?? 0)?.name ?? `#${r.warehouseId}`,
            totalQuantity: r.quantity,
            costPrice,
            totalValue: totalValue.toFixed(4),
            minStock: p?.minStock ?? '0',
            isLow: Number(r.quantity) < Number(p?.minStock ?? 0),
          };
        });
      }),
    voucherSummary: protectedProcedure.query(async ({ ctx }) => {
      const all = await db.query.stockVouchers.findMany({
        where: eq(stockVouchers.orgId, ctx.user.orgId),
      });
      const grouped: Record<string, { type: string; count: number; totalCost: number }> = {};
      for (const v of all) {
        if (!grouped[v.type]) grouped[v.type] = { type: v.type, count: 0, totalCost: 0 };
        grouped[v.type].count++;
        grouped[v.type].totalCost += Number(v.totalCost ?? 0);
      }
      return Object.values(grouped).map(g => ({ ...g, totalCost: g.totalCost.toFixed(4) }));
    }),
    lowStockAlert: protectedProcedure.query(async ({ ctx }) => {
      const invRows = await db.query.inventory.findMany({ where: eq(inventory.orgId, ctx.user.orgId) });
      const prods = await db.query.products.findMany({ where: and(eq(products.orgId, ctx.user.orgId), eq(products.isActive, true)) });
      const warehouseList = await db.query.warehouses.findMany({ where: eq(warehouses.orgId, ctx.user.orgId) });
      const prodMap = new Map(prods.map(p => [p.id, p]));
      const whMap = new Map(warehouseList.map(w => [w.id, w]));
      return invRows.filter(r => {
        const p = prodMap.get(r.productId);
        return p && Number(r.quantity) < Number(p.minStock ?? 0);
      }).map(r => {
        const p = prodMap.get(r.productId)!;
        return {
          productId: r.productId,
          productName: p.name,
          warehouseName: whMap.get(r.warehouseId ?? 0)?.name ?? `#${r.warehouseId}`,
          quantity: r.quantity,
          minQuantity: p.minStock,
        };
      });
    }),
  }),

  // ─── الأصناف المجانية (Free Products / Offers) ──────────────────────────────
  freeProducts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.freeProducts.findMany({
        where: and(eq(freeProducts.orgId, ctx.user.orgId), eq(freeProducts.isActive, true)),
        orderBy: [desc(freeProducts.createdAt)],
      });
    }),
    create: protectedProcedure
      .input(z.object({
        productId: z.number().optional(),
        productCode: z.string().optional(),
        productName: z.string().min(1),
        unit: z.string().optional(),
        baseQty: z.string().default('1'),
        freeQty: z.string().default('1'),
        offerStart: z.string().optional(),
        offerEnd: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const [row] = await db.insert(freeProducts).values({
          orgId: ctx.user.orgId,
          productId: input.productId,
          productCode: input.productCode,
          productName: input.productName,
          unit: input.unit,
          baseQty: input.baseQty,
          freeQty: input.freeQty,
          offerStart: input.offerStart ? new Date(input.offerStart) : undefined,
          offerEnd: input.offerEnd ? new Date(input.offerEnd) : undefined,
          notes: input.notes,
        }).returning();
        return row;
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        productCode: z.string().optional(),
        productName: z.string().optional(),
        unit: z.string().optional(),
        baseQty: z.string().optional(),
        freeQty: z.string().optional(),
        offerStart: z.string().optional(),
        offerEnd: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, offerStart, offerEnd, ...rest } = input;
        await db.update(freeProducts).set({
          ...rest,
          offerStart: offerStart ? new Date(offerStart) : undefined,
          offerEnd: offerEnd ? new Date(offerEnd) : undefined,
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
  }),

  // ─── Accounting Reports ───────────────────────────────────────────────────
  accounting: router({
    trialBalance: protectedProcedure
      .input(z.object({
        fromDate:     z.date().optional(),
        toDate:       z.date().optional(),
        costCenterId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { fromDate, toDate } = input;

        // 1. All active accounts for this org
        const accounts = await db
          .select({
            id:                 chartOfAccounts.id,
            code:               chartOfAccounts.code,
            name:               chartOfAccounts.name,
            nature:             chartOfAccounts.nature,
            isParent:           chartOfAccounts.isParent,
            level:              chartOfAccounts.level,
            openingBalance:     chartOfAccounts.openingBalance,
            openingBalanceType: chartOfAccounts.openingBalanceType,
          })
          .from(chartOfAccounts)
          .where(and(eq(chartOfAccounts.orgId, ctx.user.orgId), eq(chartOfAccounts.isActive, true)))
          .orderBy(asc(chartOfAccounts.code));

        // 2. All lines from POSTED entries
        const allLines = await db
          .select({
            accountId: journalEntryLines.accountId,
            debit:     journalEntryLines.debit,
            credit:    journalEntryLines.credit,
            entryDate: journalEntries.entryDate,
          })
          .from(journalEntryLines)
          .innerJoin(journalEntries, and(
            eq(journalEntries.id, journalEntryLines.entryId),
            eq(journalEntries.status, 'posted'),
            eq(journalEntries.orgId, ctx.user.orgId),
          ))
          .where(eq(journalEntryLines.orgId, ctx.user.orgId));

        // 3. Aggregate per account
        type Agg = { priorD: number; priorC: number; moveD: number; moveC: number };
        const agg = new Map<number, Agg>();

        const endOfDay = (d: Date) => new Date(d.getTime() + 86399999);

        for (const ln of allLines) {
          if (!ln.accountId) continue;
          const d  = parseFloat(ln.debit  ?? '0');
          const cr = parseFloat(ln.credit ?? '0');
          const dt = ln.entryDate;

          const isPrior    = fromDate ? dt < fromDate : false;
          const isInPeriod = fromDate
            ? dt >= fromDate && (!toDate || dt <= endOfDay(toDate))
            : (!toDate || dt <= endOfDay(toDate));

          if (!agg.has(ln.accountId)) agg.set(ln.accountId, { priorD: 0, priorC: 0, moveD: 0, moveC: 0 });
          const a = agg.get(ln.accountId)!;
          if (isPrior)         { a.priorD += d; a.priorC += cr; }
          else if (isInPeriod) { a.moveD  += d; a.moveC  += cr; }
        }

        // 4. Build result rows
        const rows = [];
        for (const acc of accounts) {
          const a = agg.get(acc.id);
          const schemaOpen = parseFloat(acc.openingBalance ?? '0');

          let openD = acc.openingBalanceType === 'debit'  ? schemaOpen : 0;
          let openC = acc.openingBalanceType === 'credit' ? schemaOpen : 0;
          if (a) { openD += a.priorD; openC += a.priorC; }

          const moveD = a?.moveD ?? 0;
          const moveC = a?.moveC ?? 0;

          const netOpen  = openD - openC;
          const netClose = netOpen + moveD - moveC;
          if (netOpen === 0 && moveD === 0 && moveC === 0) continue;

          rows.push({
            accountId:          acc.id,
            code:               acc.code,
            name:               acc.name,
            nature:             acc.nature ?? 'debit',
            isParent:           acc.isParent ?? false,
            openingBalance:     Math.abs(netOpen),
            openingBalanceType: netOpen >= 0 ? 'debit' : 'credit',
            movementDebit:      moveD,
            movementCredit:     moveC,
            closingBalance:     Math.abs(netClose),
            closingBalanceType: netClose >= 0 ? 'debit' : 'credit',
          });
        }
        return rows;
      }),
  }),
});

export type AppRouter = typeof appRouter;
