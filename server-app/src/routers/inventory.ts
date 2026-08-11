import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { stockVouchers, stockVoucherItems, inventory, inventoryCounts, inventoryCountItems, products, documentJournals } from '../schema.js';
import { TRPCError } from '@trpc/server';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';

export const stockVouchersRouter = router({
  reserveNumber: protectedProcedure
    .input(z.object({ warehouseId: z.number(), type: z.enum(['receipt', 'issue', 'transfer']).default('receipt') }))
    .mutation(async ({ ctx, input }) => {
      const [journal] = await db.select().from(documentJournals).where(and(
        eq(documentJournals.orgId, ctx.user.orgId),
        eq(documentJournals.warehouseId, input.warehouseId),
        eq(documentJournals.docType, input.type === 'receipt' ? 'stock_receipt' : input.type === 'issue' ? 'stock_issue' : 'stock_transfer'),
        eq(documentJournals.isActive, true),
      )).limit(1);
      if (!journal) throw new Error('لا يوجد دفتر سند مرتبط بالمخزن المحدد');
      const [updated] = await db.update(documentJournals).set({
        currentSeq: sql`LEAST(
          CASE WHEN ${documentJournals.currentSeq} = 0
            THEN ${documentJournals.firstNumber}
            ELSE GREATEST(${documentJournals.currentSeq} + ${documentJournals.increment}, ${documentJournals.firstNumber})
          END,
          ${documentJournals.lastNumber}
        )`,
        updatedAt: new Date(),
      }).where(and(
        eq(documentJournals.id, journal.id),
        eq(documentJournals.orgId, ctx.user.orgId),
        eq(documentJournals.isActive, true),
      )).returning();
      if (!updated) throw new Error('تعذر حجز رقم السند');
      const seq = updated.currentSeq ?? updated.firstNumber ?? 1;
      const number = `${updated.numberPrefix ?? 'SV-IN'}${updated.includeYear ? new Date().getFullYear() + '-' : ''}${String(seq).padStart(updated.numDigits ?? 6, '0')}`;
      return { journalId: updated.id, warehouseId: updated.warehouseId, voucherNumber: number };
    }),
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
      type:        z.enum(['receipt', 'issue', 'transfer']),
      warehouseId: z.number(),
      branchId:    z.number(),
      supplierId:  z.number().optional(),
      reason:      z.string().optional(),
      notes:       z.string().optional(),
       voucherDate: z.string().optional(),
       sourceDocType: z.string().optional(),
       sourceDocNumber: z.string().optional(),
       voucherNumber: z.string().optional(),
       sourceJournalId: z.number().optional(),
       receiverUserId: z.number().optional(),
      items: z.array(z.object({
        productId:   z.number(),
        productName: z.string().optional(),
        quantity:    z.string(),
        unitCost:    z.string(),
        totalCost:   z.string(),
         productCode: z.string().optional(),
         unit: z.string().optional(),
         batchNumber: z.string().optional(),
         expiryDate: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { items, ...rest } = input;
      if (!items.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'أضف صنفًا واحدًا على الأقل' });
      }

      return db.transaction(async (tx) => {
        const productIds = [...new Set(items.map(item => item.productId))];
        const productRows = await tx.query.products.findMany({
          where: and(
            eq(products.orgId, ctx.user.orgId),
            eq(products.isActive, true),
            inArray(products.id, productIds),
          ),
        });
        const productMap = new Map(productRows.map(product => [product.id, product]));
        const validatedItems = items.map((item, index) => {
          const product = productMap.get(item.productId);
          const quantity = Number(item.quantity);
          const unitCost = Number(item.unitCost);
          if (!product) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `الصنف في السطر ${index + 1} غير موجود` });
          }
          if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `الكمية يجب أن تكون أكبر من صفر في السطر ${index + 1}` });
          }
          if (!Number.isFinite(unitCost) || unitCost < 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `سعر الوحدة غير صحيح في السطر ${index + 1}` });
          }
          const submittedCode = item.productCode?.trim();
          const acceptedCodes = [product.code, product.barcode].filter(Boolean).map(String);
          if (submittedCode && !acceptedCodes.includes(submittedCode)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `كود الصنف لا يطابق الصنف في السطر ${index + 1}` });
          }
          if (!(item.unit?.trim() || product.unit?.trim())) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `الوحدة مفقودة في السطر ${index + 1}` });
          }
          return {
            ...item,
            productName: product.name,
            productCode: product.code ?? product.barcode ?? submittedCode ?? undefined,
            unit: item.unit?.trim() || product.unit || undefined,
            quantity: quantity.toFixed(4),
            unitCost: unitCost.toFixed(4),
            totalCost: (quantity * unitCost).toFixed(4),
          };
        });
        const totalCost = validatedItems.reduce((sum, item) => sum + Number(item.totalCost), 0).toFixed(4);

        const last = await tx.query.stockVouchers.findFirst({
          where: eq(stockVouchers.orgId, ctx.user.orgId),
          orderBy: [desc(stockVouchers.id)],
        });
        const num = last ? parseInt(last.voucherNumber.replace(/\D/g, '') || '0') + 1 : 1;
        const prefix = rest.type === 'receipt' ? 'SV-IN' : rest.type === 'issue' ? 'SV-OUT' : 'SV-TR';
        const voucherNumber = rest.voucherNumber ?? `${prefix}-${String(num).padStart(4, '0')}`;

        const [v] = await tx.insert(stockVouchers).values({
          ...rest,
          voucherDate: rest.voucherDate ? new Date(rest.voucherDate) : undefined,
          orgId: ctx.user.orgId,
          userId: ctx.user.id,
          voucherNumber,
          totalCost,
          status: 'confirmed',
        }).returning();

        await tx.insert(stockVoucherItems).values(
          validatedItems.map((item, i) => ({ ...item, voucherId: v.id, orgId: ctx.user.orgId, sortOrder: i })),
        );

        for (const item of validatedItems) {
          const existing = await tx.query.inventory.findFirst({
            where: and(
              eq(inventory.orgId, ctx.user.orgId),
              eq(inventory.productId, item.productId),
              eq(inventory.warehouseId, rest.warehouseId),
            ),
          });
          const qty = Number(item.quantity);
          const diff = rest.type === 'receipt' ? qty : -qty;
          if (existing) {
            await tx.update(inventory)
              .set({ quantity: String(Number(existing.quantity) + diff), updatedAt: new Date() })
              .where(eq(inventory.id, existing.id));
          } else {
            await tx.insert(inventory).values({
              orgId: ctx.user.orgId,
              productId: item.productId,
              warehouseId: rest.warehouseId,
              quantity: String(Math.max(0, diff)),
              avgCost: item.unitCost,
            });
          }
        }
        return v;
      });
    }),
});

export const inventoryCountRouter = router({
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
    .input(z.object({
      warehouseId: z.number(),
      branchId:    z.number().optional(),
      notes:       z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const last = await db.query.inventoryCounts.findFirst({
        where: eq(inventoryCounts.orgId, ctx.user.orgId),
        orderBy: [desc(inventoryCounts.id)],
      });
      const num         = last ? parseInt(last.countNumber.replace(/\D/g, '') || '0') + 1 : 1;
      const countNumber = `CNT-${String(num).padStart(4, '0')}`;
      const [count]     = await db.insert(inventoryCounts).values({
        ...input, orgId: ctx.user.orgId, userId: ctx.user.id, countNumber, status: 'draft',
      }).returning();

      const invItems = await db.query.inventory.findMany({
        where: and(eq(inventory.orgId, ctx.user.orgId), eq(inventory.warehouseId, input.warehouseId)),
      });
      if (invItems.length > 0) {
        const prods   = await db.query.products.findMany({ where: eq(products.orgId, ctx.user.orgId) });
        const prodMap = new Map(prods.map(p => [p.id, p]));
        await db.insert(inventoryCountItems).values(
          invItems.map((inv, i) => ({
            countId:        count.id,
            orgId:          ctx.user.orgId,
            productId:      inv.productId,
            productName:    prodMap.get(inv.productId)?.name ?? `#${inv.productId}`,
            systemQuantity: inv.quantity,
            actualQuantity: inv.quantity,
            difference:     '0',
            sortOrder:      i,
          }))
        );
      }
      return count.id;
    }),

  updateItem: protectedProcedure
    .input(z.object({ id: z.number(), actualQuantity: z.string() }))
    .mutation(async ({ input }) => {
      const item = await db.query.inventoryCountItems.findFirst({ where: eq(inventoryCountItems.id, input.id) });
      if (!item) throw new Error('العنصر غير موجود');
      const diff = (Number(input.actualQuantity) - Number(item.systemQuantity)).toFixed(4);
      await db.update(inventoryCountItems)
        .set({ actualQuantity: input.actualQuantity, difference: diff })
        .where(eq(inventoryCountItems.id, input.id));
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
      for (const item of items) {
        if (!item.productId || !count.warehouseId) continue;
        const existing = await db.query.inventory.findFirst({
          where: and(eq(inventory.orgId, ctx.user.orgId), eq(inventory.productId, item.productId), eq(inventory.warehouseId, count.warehouseId)),
        });
        if (existing) {
          await db.update(inventory).set({ quantity: item.actualQuantity ?? '0', updatedAt: new Date() }).where(eq(inventory.id, existing.id));
        } else {
          await db.insert(inventory).values({ orgId: ctx.user.orgId, productId: item.productId, warehouseId: count.warehouseId, quantity: item.actualQuantity ?? '0' });
        }
      }
      await db.update(inventoryCounts).set({ status: 'confirmed', confirmedAt: new Date() }).where(eq(inventoryCounts.id, input.id));
      return { success: true };
    }),
});
