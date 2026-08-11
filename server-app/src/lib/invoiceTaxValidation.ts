import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { db } from '../db.js';
import { products, taxDefinitions } from '../schema.js';

type TaxClient = typeof db | any;

type InvoiceTaxItem = {
  productId?: number;
  taxId?: number;
  productName: string;
  quantity: string;
  unitPrice: string;
  discountPercent?: string;
  discountAmount?: string;
  taxPercent?: string;
  taxAmount?: string;
  total: string;
  [key: string]: unknown;
};

function money(value: number): string {
  return value.toFixed(3);
}

/**
 * Resolve the tax definition for a new invoice line.
 *
 * taxId is the source of truth. The legacy products.taxRate is deliberately
 * never used to calculate a new document. Invoice lines receive a snapshot
 * taxPercent so later edits to the definition cannot rewrite history.
 */
export async function resolveInvoiceTaxItems<T extends InvoiceTaxItem>(
  items: T[],
  orgId: number,
  client: TaxClient = db,
): Promise<T[]> {
  const resolved: T[] = [];

  for (const item of items) {
    let productTaxId = item.taxId ?? null;
    if (productTaxId == null && item.productId) {
      const product = await client.query.products.findFirst({
        where: and(eq(products.id, item.productId), eq(products.orgId, orgId)),
        columns: { taxId: true },
      });
      productTaxId = product?.taxId ?? null;
    }

    let taxPercent = 0;
    if (productTaxId != null) {
      const definition = await client.query.taxDefinitions.findFirst({
        where: and(
          eq(taxDefinitions.id, productTaxId),
          eq(taxDefinitions.orgId, orgId),
        ),
      });
      if (!definition) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `تعريف الضريبة المرتبط بالصنف "${item.productName}" غير موجود`,
        });
      }
      if (!definition.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `الضريبة "${definition.name}" المرتبطة بالصنف "${item.productName}" موقوفة؛ اختر ضريبة فعّالة أو "بدون ضريبة" قبل إنشاء الفاتورة`,
        });
      }
      if (definition.valueType !== 'percentage') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `القيمة الثابتة للضريبة "${definition.name}" غير مدعومة في حساب الفواتير حاليًا`,
        });
      }
      if (definition.category !== 'tax' || definition.applicationScope !== 'products_sales') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `الضريبة "${definition.name}" غير مخصصة تلقائيًا للأصناف والمبيعات؛ حدّث كارت الصنف واختر ضريبة فعّالة مخصصة للأصناف والمبيعات`,
        });
      }
      taxPercent = Number(definition.value);
    }

    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const discountPercent = Number(item.discountPercent ?? 0) || 0;
    const base = quantity * unitPrice;
    const afterDiscount = base - (base * discountPercent) / 100;
    const taxAmount = (afterDiscount * taxPercent) / 100;

    resolved.push({
      ...item,
      taxId: productTaxId ?? undefined,
      taxPercent: String(taxPercent),
      taxAmount: money(taxAmount),
      total: money(afterDiscount + taxAmount),
    });
  }

  return resolved;
}