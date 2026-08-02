import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { products, productGroups } from '../schema.js';
import { eq, and, or, like, desc, asc, isNotNull, ne } from 'drizzle-orm';

// ── Helpers ─────────────────────────────────────────────────────────────────
function validateProductRequired(name: string, code?: string) {
  if (!name || !name.trim()) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'يرجى إدخال اسم الصنف بالعربي.' });
  }
  if (code !== undefined && !code.trim()) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'يرجى إدخال كود الصنف.' });
  }
}

async function assertProductCodeUnique(code: string, orgId: number, excludeId?: number) {
  const trimmed = code.trim();
  if (!trimmed) return;
  const existing = await db.query.products.findFirst({
    where: and(
      eq(products.orgId, orgId),
      eq(products.code, trimmed),
      eq(products.isActive, true),
      excludeId ? ne(products.id, excludeId) : undefined,
    ) as any,
  });
  if (existing) {
    throw new TRPCError({ code: 'CONFLICT', message: 'يوجد صنف مسجل بنفس الكود.' });
  }
}

export const productsRouter = router({
  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return db.query.products.findFirst({
        where: and(
          eq(products.id, input.id),
          eq(products.orgId, ctx.user.orgId),
          eq(products.isActive, true),
        ),
      });
    }),

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
      name: z.string().min(1, "يرجى إدخال اسم الصنف بالعربي."),
      name2: z.string().optional(),
      nameEn: z.string().optional(),
      sku: z.string().min(1, "يرجى إدخال كود الصنف."),
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
      taxId: z.number().int().positive().optional().nullable(),
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
      recordPolicy: z.enum(['flexible', 'locked', 'protected']).optional(),
      foundationKey: z.string().optional(),
      includeInFoundation: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const {
        name, name2, nameEn, sku,
        barcode, barcode2, barcode3,
        groupId, categoryId,
        unit, unit2, unit3, unitsJson, catsJson,
        salePrice, salePrice2, salePrice3, salePrice4, salePrice5,
        wholesalePrice, purchasePrice, costPrice,
        vatRate, taxRate, taxId, taxable, taxType,
        minStock, maxStock, reorderPoint,
        itemType, brand, model,
        description, notes,
        recordPolicy, foundationKey, includeInFoundation,
      } = input;

      validateProductRequired(name, sku);
      await assertProductCodeUnique(sku, ctx.user.orgId);

      const resolvedGroupId = groupId ?? categoryId ?? undefined;
      const extraData: Record<string, any> = {};
      if (name2)                extraData.name2         = name2;
      if (barcode2)             extraData.barcode2      = barcode2;
      if (barcode3)             extraData.barcode3      = barcode3;
      if (unit2)                extraData.unit2         = unit2;
      if (unit3)                extraData.unit3         = unit3;
      if (unitsJson)            extraData.unitsJson     = unitsJson;
      if (catsJson)             extraData.catsJson      = catsJson;
      if (salePrice2)           extraData.salePrice2    = salePrice2;
      if (salePrice3)           extraData.salePrice3    = salePrice3;
      if (salePrice4)           extraData.salePrice4    = salePrice4;
      if (salePrice5)           extraData.salePrice5    = salePrice5;
      if (wholesalePrice)       extraData.wholesalePrice= wholesalePrice;
      if (maxStock != null)     extraData.maxStock      = maxStock;
      if (reorderPoint != null) extraData.reorderPoint  = reorderPoint;
      if (taxable != null)      extraData.taxable       = taxable;
      if (taxType)              extraData.taxType       = taxType;
      if (itemType)             extraData.itemType      = itemType;
      if (brand)                extraData.brand         = brand;
      if (model)                extraData.model         = model;

      const notesStr = description
        ? (Object.keys(extraData).length ? `${description}\n---\n${JSON.stringify(extraData)}` : description)
        : (Object.keys(extraData).length ? JSON.stringify(extraData) : (notes ?? undefined));

      try {
        const [p] = await db.insert(products).values({
          name:               name.trim(),
          nameEn:             nameEn?.trim() || name2?.trim() || undefined,
          code:               sku?.trim() || undefined,
          barcode:            barcode?.trim() || undefined,
          groupId:            resolvedGroupId,
          unit:               unit?.trim() || "قطعة",
          salePrice:          salePrice || "0",
          purchasePrice:      costPrice || purchasePrice || "0",
          taxRate:            vatRate || taxRate || "0",
          taxId,
          minStock:           minStock != null ? String(minStock) : "0",
          isActive:           true,
          notes:              notesStr,
          orgId:              ctx.user.orgId,
          recordPolicy:       recordPolicy ?? 'flexible',
          foundationKey:      foundationKey ?? null,
          includeInFoundation: includeInFoundation ?? false,
        }).returning();
        return p;
      } catch (err: any) {
        throw new Error("فشل حفظ الصنف — تحقق من البيانات المدخلة");
      }
    }),

  bulkImport: protectedProcedure
    .input(z.object({
      rows: z.array(z.object({
        name: z.string().min(1, "يرجى إدخال اسم الصنف بالعربي."),
        nameEn: z.string().optional(),
        sku: z.string().min(1, "يرجى إدخال كود الصنف."),
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
      const seenCodes = new Set<string>();
      for (let i = 0; i < input.rows.length; i++) {
        const r = input.rows[i];
        const rowNum = i + 1;
        const code = r.sku?.trim() ?? "";
        const name = r.name?.trim() ?? "";
        if (!name) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `الصف ${rowNum}: يرجى إدخال اسم الصنف بالعربي.` });
        }
        if (!code) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `الصف ${rowNum}: يرجى إدخال كود الصنف.` });
        }
        if (seenCodes.has(code)) {
          throw new TRPCError({ code: 'CONFLICT', message: `الصف ${rowNum}: يوجد كود مكرر داخل ملف الاستيراد (${code}).` });
        }
        seenCodes.add(code);
        await assertProductCodeUnique(code, ctx.user.orgId);
      }

      const values = input.rows.map(r => ({
        name:          r.name.trim(),
        nameEn:        r.nameEn?.trim() || undefined,
        code:          r.sku.trim(),
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
      name: z.string().min(1, "يرجى إدخال اسم الصنف بالعربي."),
      name2: z.string().optional(),
      nameEn: z.string().optional(),
      sku: z.string().min(1, "يرجى إدخال كود الصنف."),
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
      taxId: z.number().int().positive().optional().nullable(),
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
      recordPolicy: z.enum(['flexible', 'locked', 'protected']).optional(),
      foundationKey: z.string().optional(),
      includeInFoundation: z.boolean().optional(),
    }).passthrough())
    .mutation(async ({ ctx, input }) => {
      const { id, sku, name2, nameEn, categoryId, costPrice, vatRate, taxId, taxable, taxType,
        barcode2, barcode3, unit2, unit3, unitsJson, catsJson,
        salePrice2, salePrice3, salePrice4, salePrice5,
        wholesalePrice, maxStock, reorderPoint, itemType, brand, model, description,
        recordPolicy, foundationKey, includeInFoundation,
        ...rest } = input as any;

      validateProductRequired(rest.name, sku);
      await assertProductCodeUnique(sku, ctx.user.orgId, id);

      const extraData: Record<string, any> = {};
      if (name2 !== undefined)         extraData.name2          = name2;
      if (barcode2 !== undefined)      extraData.barcode2       = barcode2;
      if (barcode3 !== undefined)      extraData.barcode3       = barcode3;
      if (unit2 !== undefined)         extraData.unit2          = unit2;
      if (unit3 !== undefined)         extraData.unit3          = unit3;
      if (unitsJson !== undefined)     extraData.unitsJson      = unitsJson;
      if (catsJson !== undefined)      extraData.catsJson       = catsJson;
      if (salePrice2 !== undefined)    extraData.salePrice2     = salePrice2;
      if (salePrice3 !== undefined)    extraData.salePrice3     = salePrice3;
      if (salePrice4 !== undefined)    extraData.salePrice4     = salePrice4;
      if (salePrice5 !== undefined)    extraData.salePrice5     = salePrice5;
      if (wholesalePrice !== undefined)extraData.wholesalePrice = wholesalePrice;
      if (maxStock !== undefined)      extraData.maxStock       = maxStock;
      if (reorderPoint !== undefined)  extraData.reorderPoint   = reorderPoint;
      if (taxable !== undefined)       extraData.taxable        = taxable;
      if (taxType !== undefined)       extraData.taxType        = taxType;
      if (itemType !== undefined)      extraData.itemType       = itemType;
      if (brand !== undefined)         extraData.brand          = brand;
      if (model !== undefined)         extraData.model          = model;

      const notesStr = description
        ? (Object.keys(extraData).length ? `${description}\n---\n${JSON.stringify(extraData)}` : description)
        : (Object.keys(extraData).length ? JSON.stringify(extraData) : rest.notes);

      const updateData: Record<string, any> = {};
      if (rest.name !== undefined)                           updateData.name          = rest.name;
      if (nameEn !== undefined || name2 !== undefined)       updateData.nameEn        = nameEn || name2;
      if (sku !== undefined || rest.code !== undefined)      updateData.code          = sku || rest.code;
      if (rest.barcode !== undefined)                        updateData.barcode       = rest.barcode;
      if (rest.groupId !== undefined || categoryId !== undefined) updateData.groupId  = rest.groupId || categoryId;
      if (rest.unit !== undefined)                           updateData.unit          = rest.unit;
      if (rest.salePrice !== undefined)                      updateData.salePrice     = rest.salePrice;
      if (costPrice !== undefined || rest.purchasePrice !== undefined) updateData.purchasePrice = costPrice || rest.purchasePrice;
      if (vatRate !== undefined || rest.taxRate !== undefined) updateData.taxRate     = vatRate || rest.taxRate;
      if (taxId !== undefined)                                updateData.taxId        = taxId;
      if (rest.minStock !== undefined)                       updateData.minStock      = String(rest.minStock);
      if (rest.isActive !== undefined)                       updateData.isActive      = rest.isActive;
      if (notesStr !== undefined)                            updateData.notes         = notesStr;
      if (recordPolicy !== undefined)                        updateData.recordPolicy  = recordPolicy;
      if (foundationKey !== undefined)                       updateData.foundationKey = foundationKey;
      if (includeInFoundation !== undefined)                 updateData.includeInFoundation = includeInFoundation;

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
});

export const categoriesRouter = router({
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
});

export const productGroupsRouter = router({
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
      await db.update(productGroups).set(data as any)
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

  nextCode: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => {
      const group = await db.query.productGroups.findFirst({
        where: and(eq(productGroups.id, input.groupId), eq(productGroups.orgId, ctx.user.orgId)),
      });
      if (!group) return null;
      const prefix      = group.groupCode ?? '';
      const totalDigits = group.codeDigits ?? 5;
      const seqLen      = Math.max(1, totalDigits - prefix.length);
      const firstNum    = group.firstNumber ?? 1;
      const incr        = group.increment   ?? 1;
      const lastNum     = group.lastNumber  ?? 99999;
      const existing    = await db.select({ code: products.code })
        .from(products)
        .where(and(
          eq(products.orgId, ctx.user.orgId),
          prefix ? like(products.code, prefix + '%') : isNotNull(products.code)
        ))
        .orderBy(desc(products.code));
      let nextNum = firstNum;
      if (existing.length > 0) {
        const nums = existing
          .map(p => { const seq = (p.code ?? '').substring(prefix.length); const n = parseInt(seq, 10); return isNaN(n) ? -1 : n; })
          .filter(n => n >= 0);
        if (nums.length > 0) nextNum = Math.max(...nums) + incr;
      }
      if (nextNum > lastNum) return null;
      return prefix + String(nextNum).padStart(seqLen, '0');
    }),
});
