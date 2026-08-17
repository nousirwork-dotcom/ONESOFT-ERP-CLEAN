import { and, eq, inArray } from 'drizzle-orm';
import {
  chartOfAccounts,
  documentJournals,
  inventory,
  journalEntries,
  pendingAccountMovements,
  pendingStockMovements,
  products,
  salesInvoiceItems,
  salesInvoices,
  stockVoucherItems,
  stockVouchers,
} from '../schema.js';
import { db } from '../db.js';
import {
  buildSalesPostingLines,
  insertJournalEntry,
  resolveDocTypeAccountsByJournal,
  reserveDocumentNumber,
  validateAccounts,
} from './PostingEngine.js';
import { assertJournalAccess } from '../lib/salesPermissions.js';

type DbClient = typeof db | any;
type SalesInvoice = typeof salesInvoices.$inferSelect;

const isReturnDocument = (invoiceType: string | null | undefined) =>
  invoiceType === 'return' || invoiceType === 'credit_note';

const affectsStock = (invoiceType: string | null | undefined) =>
  invoiceType === 'sale' || isReturnDocument(invoiceType);

const sourceTypeFor = (invoice: SalesInvoice) =>
  isReturnDocument(invoice.invoiceType) ? 'sales_return' : 'sales_invoice';

/**
 * Saves the operational effect of an unposted sales document exactly once.
 * Inventory is deliberately changed here, while accounting and stock documents
 * are only represented in the pending tables until the user posts the invoice.
 */
export async function syncUnpostedSalesEffects(
  tx: DbClient,
  invoice: SalesInvoice,
  items: Array<typeof salesInvoiceItems.$inferSelect>,
  orgId: number,
) {
  await removeUnpostedSalesEffects(tx, invoice, orgId);

  const sourceDocType = sourceTypeFor(invoice);
  const journal = invoice.journalId
    ? await tx.query.documentJournals.findFirst({
        where: and(eq(documentJournals.id, invoice.journalId), eq(documentJournals.orgId, orgId)),
      })
    : null;
  const { lines } = await buildSalesPostingLines(invoice, journal, orgId);

  const accountRowMap = new Map<string, {
    orgId: number;
    sourceDocType: string;
    sourceDocId: number;
    sourceDocNumber: string;
    movementDate: Date;
    accountId: number | null;
    debit: string;
    credit: string;
    description: string;
    status: 'unposted';
    updatedAt: Date;
  }>();
  for (const line of lines) {
    if (Number(line.debit) === 0 && Number(line.credit) === 0) continue;
    const accountId = line.accountId ?? null;
    const key = accountId == null ? `null:${line.description ?? ''}` : String(accountId);
    const previous = accountRowMap.get(key);
    accountRowMap.set(key, {
      orgId,
      sourceDocType,
      sourceDocId: invoice.id,
      sourceDocNumber: invoice.invoiceNumber,
      movementDate: invoice.invoiceDate,
      accountId,
      debit: (Number(previous?.debit ?? 0) + Number(line.debit ?? 0)).toFixed(4),
      credit: (Number(previous?.credit ?? 0) + Number(line.credit ?? 0)).toFixed(4),
      description: previous?.description ?? line.description ?? `فاتورة مبيعات ${invoice.invoiceNumber}`,
      status: 'unposted',
      updatedAt: new Date(),
    });
  }
  const accountRows = [...accountRowMap.values()];
  if (accountRows.length) await tx.insert(pendingAccountMovements).values(accountRows);

  if (!affectsStock(invoice.invoiceType) || !invoice.warehouseId) return;

  const stockItemMap = new Map<number, { item: typeof items[number]; quantity: number }>();
  for (const item of items) {
    if (!item.productId || Number(item.quantity) === 0) continue;
    const previous = stockItemMap.get(item.productId);
    stockItemMap.set(item.productId, {
      item: previous?.item ?? item,
      quantity: (previous?.quantity ?? 0) + Number(item.quantity),
    });
  }
  const stockItems = [...stockItemMap.values()];
  if (!stockItems.length) return;

  const productRows = await tx.query.products.findMany({
    where: and(
      eq(products.orgId, orgId),
      inArray(products.id, stockItems.map(({ item }) => item.productId!)),
    ),
  });
  const productMap = new Map(productRows.map((product: any) => [product.id, product]));
  const direction = isReturnDocument(invoice.invoiceType) ? 1 : -1;

  for (const item of stockItems) {
    const product = productMap.get(item.item.productId!) as { itemType?: string } | undefined;
    if (!product || product.itemType !== 'stock') continue;

    const quantity = item.quantity;
    const signedQuantity = direction * quantity;
    const current = await tx.query.inventory.findFirst({
      where: and(
        eq(inventory.orgId, orgId),
        eq(inventory.productId, item.item.productId!),
        eq(inventory.warehouseId, invoice.warehouseId),
      ),
    });
    const currentQuantity = Number(current?.quantity ?? 0);
    const nextQuantity = currentQuantity + signedQuantity;
    if (nextQuantity < -0.0001) {
      throw new Error(`لا يمكن حفظ الفاتورة: الكمية المتاحة للصنف "${item.item.productName}" أقل من الكمية المطلوبة`);
    }

    const unitCost = Number(current?.avgCost ?? 0);
    if (current) {
      await tx.update(inventory)
        .set({ quantity: Math.max(0, nextQuantity).toFixed(4), updatedAt: new Date() })
        .where(eq(inventory.id, current.id));
    } else {
      await tx.insert(inventory).values({
        orgId,
        productId: item.item.productId!,
        warehouseId: invoice.warehouseId,
        quantity: Math.max(0, nextQuantity).toFixed(4),
        avgCost: unitCost.toFixed(4),
      });
    }

    await tx.insert(pendingStockMovements).values({
      orgId,
      sourceDocType,
      sourceDocId: invoice.id,
      sourceDocNumber: invoice.invoiceNumber,
      movementDate: invoice.invoiceDate,
      productId: item.item.productId!,
      warehouseId: invoice.warehouseId,
      quantity: signedQuantity.toFixed(4),
      unitCost: unitCost.toFixed(4),
      status: 'unposted',
      updatedAt: new Date(),
    });
  }
}

/**
 * Reverses only unposted effects. Posted documents must use the unpost flow,
 * which preserves the generated journal and stock documents as cancelled.
 */
export async function removeUnpostedSalesEffects(
  tx: DbClient,
  invoice: SalesInvoice,
  orgId: number,
) {
  const sourceDocType = sourceTypeFor(invoice);
  const oldStock = await tx.query.pendingStockMovements.findMany({
    where: and(
      eq(pendingStockMovements.orgId, orgId),
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
    if (!current) continue;
    const nextQuantity = Number(current.quantity) - Number(old.quantity);
    if (nextQuantity < -0.0001) {
      throw new Error(`لا يمكن تعديل أو حذف الفاتورة: توجد حركة مخزنية لاحقة للصنف`);
    }
    await tx.update(inventory)
      .set({ quantity: Math.max(0, nextQuantity).toFixed(4), updatedAt: new Date() })
      .where(eq(inventory.id, current.id));
  }

  await tx.delete(pendingAccountMovements).where(and(
    eq(pendingAccountMovements.orgId, orgId),
    eq(pendingAccountMovements.sourceDocId, invoice.id),
  ));
  await tx.delete(pendingStockMovements).where(and(
    eq(pendingStockMovements.orgId, orgId),
    eq(pendingStockMovements.sourceDocId, invoice.id),
  ));
}

type IssuanceConfig = {
  journalEntryType?: string | null;
  journalBookId?: string | number | null;
  inventoryDocType?: string | null;
  inventoryDocBookId?: string | number | null;
};

function readIssuanceConfig(value: unknown): IssuanceConfig {
  return value && typeof value === 'object' ? value as IssuanceConfig : {};
}

async function getStockJournal(
  tx: DbClient,
  invoice: SalesInvoice,
  orgId: number,
  user: { id: number; orgId: number; role: string; userGroupId?: number | null; extraPermissions?: Record<string, boolean> | null },
) {
  const sourceJournal = invoice.journalId
    ? await tx.query.documentJournals.findFirst({
        where: and(eq(documentJournals.id, invoice.journalId), eq(documentJournals.orgId, orgId)),
      })
    : null;
  const issuance = readIssuanceConfig(sourceJournal?.issuanceConfig);
  const stockJournalId = Number(issuance.inventoryDocBookId);
  const expectedDocType = isReturnDocument(invoice.invoiceType) ? 'stock_receipt_items' : 'stock_issue_items';
  if (!Number.isInteger(stockJournalId) || !issuance.inventoryDocType) {
    throw new Error('لا يمكن الترحيل: خصائص السندات المصدرة لا تحدد دفتر سند المخزون');
  }
  if (!String(issuance.inventoryDocType).includes(isReturnDocument(invoice.invoiceType) ? 'receipt' : 'issue')) {
    throw new Error('لا يمكن الترحيل: نوع سند المخزون المحدد لا يطابق نوع مستند المبيعات');
  }
  const journal = await tx.query.documentJournals.findFirst({
    where: and(
      eq(documentJournals.id, stockJournalId),
      eq(documentJournals.orgId, orgId),
      eq(documentJournals.isActive, true),
    ),
  });
  if (!journal || journal.docType !== expectedDocType) {
    throw new Error(`دفتر سند المخزون المحدد في خصائص السندات المصدرة غير صالح (${expectedDocType})`);
  }
  await assertJournalAccess(user, journal.id);
  const docTypeAccounts = await resolveDocTypeAccountsByJournal(journal.id, orgId, tx);
  const inventoryAccountId = docTypeAccounts?.inventoryAccountId ?? journal.inventoryAccountId;
  const cogsAccountId = docTypeAccounts?.cogsAccountId ?? journal.cogsAccountId;
  if (!inventoryAccountId || !cogsAccountId) {
    throw new Error('دفتر سند المخزون يجب أن يحدد روابط حساب المخزون وتكلفة المبيعات');
  }

  const cogsIssuance = readIssuanceConfig(journal.issuanceConfig);
  const cogsJournalId = Number(cogsIssuance.journalBookId);
  if (!Number.isInteger(cogsJournalId) || !cogsIssuance.journalEntryType) {
    throw new Error('لا يمكن الترحيل: خصائص سند المخزون لا تحدد دفتر قيد COGS');
  }
  const cogsJournal = await tx.query.documentJournals.findFirst({
    where: and(
      eq(documentJournals.id, cogsJournalId),
      eq(documentJournals.orgId, orgId),
      eq(documentJournals.isActive, true),
    ),
  });
  if (!cogsJournal || cogsJournal.docType !== cogsIssuance.journalEntryType) {
    throw new Error('دفتر قيد COGS المحدد في خصائص سند المخزون غير صالح');
  }
  await assertJournalAccess(user, cogsJournal.id);
  await validateAccounts([inventoryAccountId, cogsAccountId], tx);
  return { journal, cogsJournal, inventoryAccountId, cogsAccountId };
}

/**
 * Creates the stock issue/receipt and its COGS journal. It does not touch
 * inventory: the quantity was already applied while saving the invoice.
 */
export async function postSalesStockMovement(
  tx: DbClient,
  invoice: SalesInvoice,
  orgId: number,
  user: { id: number; orgId: number; role: string; userGroupId?: number | null; extraPermissions?: Record<string, boolean> | null },
) {
  if (!affectsStock(invoice.invoiceType)) return null;
  const sourceDocType = sourceTypeFor(invoice);
  const existing = await tx.query.stockVouchers.findFirst({
    where: and(
      eq(stockVouchers.orgId, orgId),
      eq(stockVouchers.sourceDocType, sourceDocType),
      eq(stockVouchers.sourceDocId, invoice.id),
      eq(stockVouchers.status, 'confirmed'),
    ),
  });
  if (existing) return existing;

  const pending = await tx.query.pendingStockMovements.findMany({
    where: and(
      eq(pendingStockMovements.orgId, orgId),
      eq(pendingStockMovements.sourceDocType, sourceDocType),
      eq(pendingStockMovements.sourceDocId, invoice.id),
      eq(pendingStockMovements.status, 'unposted'),
    ),
  });
  if (!pending.length) return null;

  const { journal, cogsJournal, inventoryAccountId, cogsAccountId } = await getStockJournal(tx, invoice, orgId, user);
  const { number: voucherNumber } = await reserveDocumentNumber(journal.id, orgId, tx);
  const totalCost = pending.reduce(
    (sum: number, row: any) => sum + Math.abs(Number(row.quantity)) * Number(row.unitCost ?? 0),
    0,
  ).toFixed(4);
  const isReturn = isReturnDocument(invoice.invoiceType);

  const [voucher] = await tx.insert(stockVouchers).values({
    orgId,
    voucherNumber,
    type: isReturn ? 'receipt' : 'issue',
    voucherDate: invoice.invoiceDate,
    warehouseId: invoice.warehouseId,
    reason: `${isReturn ? 'استلام مردود' : 'صرف مبيعات'} من المستند ${invoice.invoiceNumber}`,
    notes: invoice.notes,
    totalCost,
    status: 'confirmed',
    userId: user.id,
    sourceDocType,
    sourceDocId: invoice.id,
    sourceDocNumber: invoice.invoiceNumber,
    sourceJournalId: journal.id,
  }).returning();

  await tx.insert(stockVoucherItems).values(pending.map((row: any, index: number) => ({
    voucherId: voucher.id,
    orgId,
    productId: row.productId,
    productName: row.productId ? `صنف ${row.productId}` : 'صنف',
    quantity: Math.abs(Number(row.quantity)).toFixed(4),
    unitCost: Number(row.unitCost ?? 0).toFixed(4),
    totalCost: (Math.abs(Number(row.quantity)) * Number(row.unitCost ?? 0)).toFixed(4),
    sortOrder: index,
  })));

  const cogsAccount = await tx.query.chartOfAccounts.findFirst({
    where: eq(chartOfAccounts.id, cogsAccountId),
    columns: { code: true, name: true },
  });
  const inventoryAccount = await tx.query.chartOfAccounts.findFirst({
    where: eq(chartOfAccounts.id, inventoryAccountId),
    columns: { code: true, name: true },
  });
  const costEntry = await insertJournalEntry({
    orgId,
    userId: user.id,
    date: invoice.invoiceDate,
    description: `${isReturn ? 'عكس تكلفة' : 'تكلفة مبيعات'} سند ${voucherNumber}`,
    reference: voucherNumber,
    sourceDocType: isReturn ? 'sales_return_cogs' : 'sales_cogs',
    sourceDocId: voucher.id,
    sourceDocNumber: voucherNumber,
    journalId: cogsJournal.id,
    generatedDocType: cogsJournal.docType,
    lines: isReturn ? [
      { accountId: inventoryAccountId, accountCode: inventoryAccount?.code ?? '', accountName: inventoryAccount?.name ?? 'المخزون', debit: totalCost, credit: '0.0000', description: `إرجاع مخزون ${voucherNumber}` },
      { accountId: cogsAccountId, accountCode: cogsAccount?.code ?? '', accountName: cogsAccount?.name ?? 'تكلفة المبيعات', debit: '0.0000', credit: totalCost, description: `عكس تكلفة ${voucherNumber}` },
    ] : [
      { accountId: cogsAccountId, accountCode: cogsAccount?.code ?? '', accountName: cogsAccount?.name ?? 'تكلفة المبيعات', debit: totalCost, credit: '0.0000', description: `تكلفة مبيعات ${voucherNumber}` },
      { accountId: inventoryAccountId, accountCode: inventoryAccount?.code ?? '', accountName: inventoryAccount?.name ?? 'المخزون', debit: '0.0000', credit: totalCost, description: `صرف مخزون ${voucherNumber}` },
    ],
    tx,
  });
  await tx.update(stockVouchers)
    .set({ generatedJournalEntryId: costEntry.id })
    .where(and(eq(stockVouchers.id, voucher.id), eq(stockVouchers.orgId, orgId)));

  await tx.update(pendingStockMovements)
    .set({ status: 'linked', linkedJournalEntryId: costEntry.id, linkedStockVoucherId: voucher.id, updatedAt: new Date() })
    .where(and(
      eq(pendingStockMovements.orgId, orgId),
      eq(pendingStockMovements.sourceDocType, sourceDocType),
      eq(pendingStockMovements.sourceDocId, invoice.id),
      eq(pendingStockMovements.status, 'unposted'),
    ));
  return { ...voucher, generatedJournalEntryId: costEntry.id };
}

export async function deleteSalesStockMovement(
  tx: DbClient,
  invoice: SalesInvoice,
  orgId: number,
) {
  const sourceDocType = sourceTypeFor(invoice);
  const voucher = await tx.query.stockVouchers.findFirst({
    where: and(
      eq(stockVouchers.orgId, orgId),
      eq(stockVouchers.sourceDocType, sourceDocType),
      eq(stockVouchers.sourceDocId, invoice.id),
      eq(stockVouchers.status, 'confirmed'),
    ),
  });
  if (!voucher) return;

  const costEntry = voucher.generatedJournalEntryId
    ? await tx.query.journalEntries.findFirst({
        where: and(eq(journalEntries.id, voucher.generatedJournalEntryId), eq(journalEntries.orgId, orgId)),
      })
    : null;
  const deletedDocuments = [
    costEntry && {
      documentType: 'journal_entry',
      documentId: costEntry.id,
      documentNumber: costEntry.entryNumber,
      journalId: costEntry.journalId,
      generatedDocumentType: 'cogs',
    },
    {
      documentType: 'stock_voucher',
      documentId: voucher.id,
      documentNumber: voucher.voucherNumber,
      journalId: voucher.sourceJournalId,
      generatedDocumentType: voucher.type,
    },
  ].filter(Boolean);

  if (costEntry) {
    await tx.delete(journalEntries)
      .where(and(eq(journalEntries.id, costEntry.id), eq(journalEntries.orgId, orgId)));
  }
  await tx.delete(stockVouchers)
    .where(and(eq(stockVouchers.id, voucher.id), eq(stockVouchers.orgId, orgId)));
  return { voucher, costEntry, deletedDocuments };
}