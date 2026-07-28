import { z } from 'zod';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import {
  purchaseInvoices, purchaseInvoiceItems, documentJournals, warehouses,
  pendingAccountMovements, pendingStockMovements, inventory, products,
} from '../schema.js';
import { buildPurchaseInvoiceLines } from './posting.js';

type PurchaseClient = typeof db | any;

async function getPurchasePostingContext(invoice: any, orgId: number) {
  const journal = invoice.journalId
    ? await db.query.documentJournals.findFirst({
        where: and(eq(documentJournals.id, invoice.journalId), eq(documentJournals.orgId, orgId)),
      })
    : null;
  return {
    journal,
    effectiveJournal: {
      purchaseAccountId: journal?.purchaseAccountId ?? null,
      supplierAccountId: journal?.supplierAccountId ?? null,
      cashAccountId: journal?.cashAccountId ?? null,
      taxAccountId: journal?.taxAccountId ?? null,
      discountAccountId: journal?.discountAccountId ?? null,
    },
  };
}

async function syncUnpostedPurchaseEffects(
  tx: PurchaseClient,
  invoice: any,
  items: any[],
  orgId: number,
) {
  const sourceType = 'purchase_invoice';
  const oldStock = await tx.query.pendingStockMovements.findMany({
    where: and(
      eq(pendingStockMovements.orgId, orgId),
      eq(pendingStockMovements.sourceDocType, sourceType),
      eq(pendingStockMovements.sourceDocId, invoice.id),
      eq(pendingStockMovements.status, 'unposted'),
    ),
  });

  for (const old of oldStock) {
    const current = await tx.query.inventory.findFirst({
      where: and(
        eq(inventory.orgId, orgId),
        eq(inventory.productId, old.productId),
        eq(inventory.warehouseId, old.warehouseId),
      ),
    });
    if (current) {
      const nextQty = Number(current.quantity) - Number(old.quantity);
      if (nextQty < -0.0001) {
        throw new Error('لا يمكن تعديل الفاتورة: تم صرف أو بيع جزء من الكمية الناتجة عنها');
      }
      await tx.update(inventory).set({
        quantity: Math.max(0, nextQty).toFixed(4),
        updatedAt: new Date(),
      }).where(eq(inventory.id, current.id));
    }
  }

  await tx.delete(pendingAccountMovements).where(and(
    eq(pendingAccountMovements.orgId, orgId),
    eq(pendingAccountMovements.sourceDocType, sourceType),
    eq(pendingAccountMovements.sourceDocId, invoice.id),
  ));
  await tx.delete(pendingStockMovements).where(and(
    eq(pendingStockMovements.orgId, orgId),
    eq(pendingStockMovements.sourceDocType, sourceType),
    eq(pendingStockMovements.sourceDocId, invoice.id),
  ));

  const { effectiveJournal } = await getPurchasePostingContext(invoice, orgId);
  const { lines } = await buildPurchaseInvoiceLines(invoice, effectiveJournal, orgId);
  const accountRows = lines
    .filter((line) => Number(line.debit) !== 0 || Number(line.credit) !== 0)
    .map((line) => ({
      orgId,
      sourceDocType: sourceType,
      sourceDocId: invoice.id,
      sourceDocNumber: invoice.invoiceNumber,
      movementDate: invoice.invoiceDate,
      accountId: line.accountId ?? null,
      debit: line.debit,
      credit: line.credit,
      description: line.description ?? `فاتورة مشتريات ${invoice.invoiceNumber}`,
      status: 'unposted' as const,
      updatedAt: new Date(),
    }));
  if (accountRows.length) await tx.insert(pendingAccountMovements).values(accountRows);

  const stockItems = items.filter((item) => item.productId);
  if (!stockItems.length || !invoice.warehouseId) return;
  const productRows = await tx.query.products.findMany({
    where: and(eq(products.orgId, orgId), inArray(products.id, stockItems.map((item: any) => item.productId))),
  });
  const productMap = new Map(productRows.map((product: any) => [product.id, product]));

  for (const item of stockItems) {
    const product = productMap.get(item.productId) as { itemType?: string } | undefined;
    if (!product || product.itemType !== 'stock') continue;
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity === 0) continue;
    const unitCost = Number(item.unitPrice ?? 0);
    const current = await tx.query.inventory.findFirst({
      where: and(
        eq(inventory.orgId, orgId),
        eq(inventory.productId, item.productId),
        eq(inventory.warehouseId, invoice.warehouseId),
      ),
    });
    if (current) {
      const oldQty = Number(current.quantity);
      const oldCost = Number(current.avgCost ?? 0);
      const nextQty = oldQty + quantity;
      const nextCost = nextQty > 0 ? ((oldQty * oldCost) + (quantity * unitCost)) / nextQty : unitCost;
      await tx.update(inventory).set({
        quantity: nextQty.toFixed(4),
        avgCost: nextCost.toFixed(4),
        updatedAt: new Date(),
      }).where(eq(inventory.id, current.id));
    } else {
      await tx.insert(inventory).values({
        orgId,
        productId: item.productId,
        warehouseId: invoice.warehouseId,
        quantity: quantity.toFixed(4),
        avgCost: unitCost.toFixed(4),
      });
    }
    await tx.insert(pendingStockMovements).values({
      orgId,
      sourceDocType: sourceType,
      sourceDocId: invoice.id,
      sourceDocNumber: invoice.invoiceNumber,
      movementDate: invoice.invoiceDate,
      productId: item.productId,
      warehouseId: invoice.warehouseId,
      quantity: quantity.toFixed(4),
      unitCost: unitCost.toFixed(4),
      status: 'unposted',
      updatedAt: new Date(),
    });
  }
}

async function removeUnpostedPurchaseEffects(tx: PurchaseClient, invoice: any, orgId: number) {
  const oldStock = await tx.query.pendingStockMovements.findMany({
    where: and(
      eq(pendingStockMovements.orgId, orgId),
      eq(pendingStockMovements.sourceDocType, 'purchase_invoice'),
      eq(pendingStockMovements.sourceDocId, invoice.id),
      eq(pendingStockMovements.status, 'unposted'),
    ),
  });
  for (const old of oldStock) {
    const current = await tx.query.inventory.findFirst({
      where: and(eq(inventory.orgId, orgId), eq(inventory.productId, old.productId), eq(inventory.warehouseId, old.warehouseId)),
    });
    if (current) {
      const nextQty = Number(current.quantity) - Number(old.quantity);
      if (nextQty < -0.0001) throw new Error('لا يمكن حذف الفاتورة: تم صرف أو بيع جزء من الكمية الناتجة عنها');
      await tx.update(inventory).set({ quantity: Math.max(0, nextQty).toFixed(4), updatedAt: new Date() }).where(eq(inventory.id, current.id));
    }
  }
  await tx.delete(pendingAccountMovements).where(and(
    eq(pendingAccountMovements.orgId, orgId),
    eq(pendingAccountMovements.sourceDocType, 'purchase_invoice'),
    eq(pendingAccountMovements.sourceDocId, invoice.id),
  ));
  await tx.delete(pendingStockMovements).where(and(
    eq(pendingStockMovements.orgId, orgId),
    eq(pendingStockMovements.sourceDocType, 'purchase_invoice'),
    eq(pendingStockMovements.sourceDocId, invoice.id),
  ));
}

// ── تحديد المخزن/الفرع الصحيح: إذا لم يُرسل warehouseId نحله من دفتر المستندات ──
async function resolvePurchaseWarehouseId(
  tx: any,
  inputWarehouseId: number | null | undefined,
  journalId: number | null | undefined,
  orgId: number,
): Promise<number> {
  if (inputWarehouseId) return inputWarehouseId;

  if (journalId) {
    const journal = await tx.query.documentJournals.findFirst({
      where: and(eq(documentJournals.id, journalId), eq(documentJournals.orgId, orgId)),
    });
    if (journal?.warehouseId) return journal.warehouseId;
  }

  throw new Error('لم يتم تحديد المخزن/الفرع — يجب اختيار دفتر مرتبط بمخزن');
}

export const purchasesRouter = router({
  // قائمة فواتير المشتريات
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(200),
      search: z.string().optional(),
      invoiceType: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      warehouseId: z.number().optional(),
      numberPrefix: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const allRecords = await db.query.purchaseInvoices.findMany({
        where: eq(purchaseInvoices.orgId, orgId),
        orderBy: [desc(purchaseInvoices.invoiceDate)],
      });
      let filtered = allRecords;
      if (input?.invoiceType) filtered = filtered.filter(r => r.invoiceType === input.invoiceType);
      if (input?.warehouseId) filtered = filtered.filter(r => r.warehouseId === input.warehouseId);
      if (input?.search) {
        const q = input.search.toLowerCase();
        filtered = filtered.filter(r =>
          r.invoiceNumber?.toLowerCase().includes(q) ||
          r.supplierName?.toLowerCase().includes(q)
        );
      }
      if (input?.dateFrom) {
        const from = new Date(input.dateFrom); from.setHours(0, 0, 0, 0);
        filtered = filtered.filter(r => new Date(r.invoiceDate) >= from);
      }
      if (input?.dateTo) {
        const to = new Date(input.dateTo); to.setHours(23, 59, 59, 999);
        filtered = filtered.filter(r => new Date(r.invoiceDate) <= to);
      }
      if (input?.numberPrefix) {
        const pfx = input.numberPrefix.toLowerCase();
        filtered = filtered.filter(r => r.invoiceNumber?.toLowerCase().startsWith(pfx));
      }
      const limit = input?.limit || 200;
      const page = input?.page || 1;
      return filtered.slice((page - 1) * limit, page * limit);
    }),

  // الرقم التالي للمستند
  nextNumber: protectedProcedure
    .input(z.object({ prefix: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const prefix = input?.prefix || 'PUR';
      const year = new Date().getFullYear();
      const yearPrefix = `${prefix}-${year}-`;
      const last = await db.query.purchaseInvoices.findFirst({
        where: eq(purchaseInvoices.orgId, ctx.user.orgId),
        orderBy: [desc(purchaseInvoices.id)],
      });
      if (!last) return `${yearPrefix}000001`;
      const match = last.invoiceNumber.match(new RegExp(`${prefix}-(\\d{4})-(\\d+)`));
      if (match && parseInt(match[1]) === year) {
        const num = parseInt(match[2]) + 1;
        return `${yearPrefix}${String(num).padStart(6, '0')}`;
      }
      return `${yearPrefix}000001`;
    }),

  // تفاصيل مستند
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const invoice = await db.query.purchaseInvoices.findFirst({
        where: and(eq(purchaseInvoices.id, input.id), eq(purchaseInvoices.orgId, ctx.user.orgId)),
      });
      if (!invoice) throw new Error('المستند غير موجود');
      const items = await db.query.purchaseInvoiceItems.findMany({
        where: eq(purchaseInvoiceItems.invoiceId, input.id),
        orderBy: (i, { asc }) => [asc(i.sortOrder)],
      });

      let warehouseName: string | null = null;
      if (invoice.warehouseId) {
        const wh = await db.query.warehouses.findFirst({
          where: and(eq(warehouses.id, invoice.warehouseId), eq(warehouses.orgId, ctx.user.orgId)),
        });
        warehouseName = wh?.name ?? null;
      }

      return { ...invoice, warehouseName, items };
    }),

  // إنشاء مستند مشتريات
  create: protectedProcedure
    .input(z.object({
      invoiceNumber: z.string(),
      invoiceType: z.string().default('invoice'),
      invoiceDate: z.string(),
      dueDate: z.string().optional(),
      supplierId: z.number().optional(),
      supplierName: z.string().optional(),
      supplierInvoiceNumber: z.string().optional(),
      warehouseId: z.number().optional(),
      journalId: z.number().optional(),
      currency: z.string().default('SAR'),
      exchangeRate: z.string().default('1'),
      subtotal: z.string().default('0'),
      discountPercent: z.string().default('0'),
      discountAmount: z.string().default('0'),
      taxAmount: z.string().default('0'),
      total: z.string().default('0'),
      paidAmount: z.string().default('0'),
      remainingAmount: z.string().default('0'),
      paymentMethod: z.enum(['cash', 'bank', 'credit', 'check', 'other']).default('cash'),
      status: z.enum(['draft', 'confirmed', 'cancelled', 'paid']).default('confirmed'),
      notes: z.string().optional(),
      items: z.array(z.object({
        productId: z.number().optional(),
        productCode: z.string().optional(),
        productName: z.string(),
        unit: z.string().optional(),
        quantity: z.string(),
        unitPrice: z.string(),
        discountPercent: z.string().default('0'),
        discountAmount: z.string().default('0'),
        taxPercent: z.string().default('0'),
        taxAmount: z.string().default('0'),
        total: z.string(),
         batchNumber: z.string().optional(),
         expiryDate: z.string().optional(),
        sortOrder: z.number().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { items, dueDate, ...invoiceData } = input;
      const orgId = ctx.user.orgId;
      const resolvedWarehouseId = await resolvePurchaseWarehouseId(
        db,
        invoiceData.warehouseId,
        invoiceData.journalId,
        orgId,
      );
      return db.transaction(async (tx) => {
        const [invoice] = await tx.insert(purchaseInvoices).values({
          ...invoiceData,
          warehouseId: resolvedWarehouseId,
          orgId,
          userId: ctx.user.id,
          invoiceDate: new Date(invoiceData.invoiceDate),
          ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        }).returning();
        if (items.length > 0) {
          await tx.insert(purchaseInvoiceItems).values(
            items.map((item, idx) => ({
              ...item,
              invoiceId: invoice.id,
              orgId,
              sortOrder: item.sortOrder ?? idx,
            }))
          );
        }
        const savedItems = await tx.query.purchaseInvoiceItems.findMany({
          where: eq(purchaseInvoiceItems.invoiceId, invoice.id),
        });
        await syncUnpostedPurchaseEffects(tx, invoice, savedItems, orgId);
        return invoice;
      });
    }),

  // تعديل مستند
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      invoiceDate: z.string().optional(),
      supplierId: z.number().optional(),
      supplierName: z.string().optional(),
      warehouseId: z.number().optional(),
      journalId: z.number().optional(),
      subtotal: z.string().optional(),
      discountAmount: z.string().optional(),
      taxAmount: z.string().optional(),
      total: z.string().optional(),
      paidAmount: z.string().optional(),
      remainingAmount: z.string().optional(),
      status: z.enum(['draft', 'confirmed', 'cancelled', 'paid']).optional(),
      notes: z.string().optional(),
      docTypeId: z.number().optional(),
      items: z.array(z.object({
        productId: z.number().optional(),
        productCode: z.string().optional(),
        productName: z.string(),
        unit: z.string().optional(),
        quantity: z.string(),
        unitPrice: z.string(),
        discountPercent: z.string().default('0'),
        discountAmount: z.string().default('0'),
        taxPercent: z.string().default('0'),
        taxAmount: z.string().default('0'),
        total: z.string(),
         batchNumber: z.string().optional(),
         expiryDate: z.string().optional(),
        sortOrder: z.number().optional(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, items, invoiceDate, ...rest } = input;
      const existing = await db.query.purchaseInvoices.findFirst({
        where: and(eq(purchaseInvoices.id, id), eq(purchaseInvoices.orgId, ctx.user.orgId)),
      });
      if (existing?.isPosted)
        throw new Error('لا يمكن تعديل مستند مرحَّل — يجب فك الترحيل أولاً');
      const resolvedWarehouseId = await resolvePurchaseWarehouseId(
        db,
        rest.warehouseId ?? existing?.warehouseId,
        rest.journalId ?? existing?.journalId,
        ctx.user.orgId,
      );
      return db.transaction(async (tx) => {
        await removeUnpostedPurchaseEffects(tx, existing, ctx.user.orgId);
        await tx.update(purchaseInvoices).set({
          ...rest,
          warehouseId: resolvedWarehouseId,
          ...(invoiceDate ? { invoiceDate: new Date(invoiceDate) } : {}),
          updatedAt: new Date(),
        }).where(and(eq(purchaseInvoices.id, id), eq(purchaseInvoices.orgId, ctx.user.orgId)));
        if (items) {
          await tx.delete(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.invoiceId, id));
          if (items.length > 0) {
            await tx.insert(purchaseInvoiceItems).values(
              items.map((item, idx) => ({
                ...item,
                invoiceId: id,
                orgId: ctx.user.orgId,
                sortOrder: item.sortOrder ?? idx,
              }))
            );
          }
        }
        const updated = await tx.query.purchaseInvoices.findFirst({
          where: and(eq(purchaseInvoices.id, id), eq(purchaseInvoices.orgId, ctx.user.orgId)),
        });
        if (!updated) throw new Error('المستند غير موجود');
        const updatedItems = await tx.query.purchaseInvoiceItems.findMany({
          where: eq(purchaseInvoiceItems.invoiceId, id),
        });
        await syncUnpostedPurchaseEffects(tx, updated, updatedItems, ctx.user.orgId);
        return { success: true };
      });
    }),

  // حذف مستند
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.purchaseInvoices.findFirst({
        where: and(eq(purchaseInvoices.id, input.id), eq(purchaseInvoices.orgId, ctx.user.orgId)),
      });
      if (existing?.isPosted)
        throw new Error('لا يمكن حذف مستند مرحَّل — يجب فك الترحيل أولاً');
      return db.transaction(async (tx) => {
        await removeUnpostedPurchaseEffects(tx, existing, ctx.user.orgId);
        await tx.delete(purchaseInvoices).where(
          and(eq(purchaseInvoices.id, input.id), eq(purchaseInvoices.orgId, ctx.user.orgId))
        );
        return { success: true };
      });
    }),
});
