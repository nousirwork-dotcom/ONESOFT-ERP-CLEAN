import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { db } from '../db.js';
import { documentJournals, salesInvoices, users, userWarehouseAssignments } from '../schema.js';

/**
 * validateSalesInvoiceWarehouseContext
 *
 * خدمة التحقق الموحدة لفاتورة المبيعات — warehouseId هو مصدر الحقيقة الوحيد.
 * المخزن = الفرع في مسار المستندات؛ لا يوجد branchId مستقل.
 *
 * تُستدعى من: create | update | updatePayment | approve | أي مسار حفظ
 */
export async function validateSalesInvoiceWarehouseContext(params: {
  warehouseId: number | undefined | null;
  journalId?: number | null;
  sellerUserId?: number | null;
  sourceDocumentId?: number | null;
  orgId: number;
}): Promise<void> {
  const { warehouseId, journalId, sellerUserId, sourceDocumentId, orgId } = params;

  // ── 1. المخزن/الفرع إلزامي ────────────────────────────────────────────────
  if (!warehouseId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'يجب اختيار الفرع / المخزن قبل حفظ الفاتورة',
    });
  }

  // ── 2. دفتر المستند تابع لنفس المخزن ─────────────────────────────────────
  if (journalId) {
    const journal = await db.query.documentJournals.findFirst({
      where: eq(documentJournals.id, journalId),
      columns: { warehouseId: true },
    });
    if (journal?.warehouseId && journal.warehouseId !== warehouseId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'دفتر المستند لا ينتمي للفرع/المخزن المختار — اختر دفتراً مرتبطاً بنفس المخزن',
      });
    }
  }

  // ── 3. المستند المصدر تابع لنفس المخزن ────────────────────────────────────
  if (sourceDocumentId) {
    const srcDoc = await db.query.salesInvoices.findFirst({
      where: and(
        eq(salesInvoices.id, sourceDocumentId),
        eq(salesInvoices.orgId, orgId),
      ),
      columns: { warehouseId: true, invoiceNumber: true },
    });
    if (!srcDoc) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'المستند المصدر غير موجود' });
    }
    if (srcDoc.warehouseId && srcDoc.warehouseId !== warehouseId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `المستند المصدر (${srcDoc.invoiceNumber}) ينتمي لمخزن/فرع مختلف — لا يمكن إنشاء فاتورة بمخزن مغاير لمصدرها`,
      });
    }
  }

  // ── 4. البائع مؤهل ومسموح له بالمخزن ────────────────────────────────────
  // مصدر التحقق: جدول users (canBeSalesperson) — نفس ما تُظهره شاشة المستخدمين.
  if (sellerUserId) {
    const seller = await db.query.users.findFirst({
      where: and(
        eq(users.id, sellerUserId),
        eq(users.orgId, orgId),
      ),
      columns: { id: true, name: true, username: true, isActive: true, canBeSalesperson: true, defaultWarehouseId: true },
    });
    if (!seller) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'المستخدم المختار كبائع غير موجود في المؤسسة',
      });
    }
    if (!seller.isActive) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `المستخدم ${seller.name || seller.username} موقوف، لا يمكن العمل كبائع`,
      });
    }
    if (!seller.canBeSalesperson) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `المستخدم ${seller.name || seller.username} غير مفعّل كبائع من إعدادات المستخدمين`,
      });
    }
    // تحقق: defaultWarehouseId يطابق، أو مُسنَد عبر user_warehouse_assignments
    if (seller.defaultWarehouseId !== warehouseId) {
      const assignment = await db.query.userWarehouseAssignments.findFirst({
        where: and(
          eq(userWarehouseAssignments.userId, sellerUserId),
          eq(userWarehouseAssignments.warehouseId, warehouseId),
          eq(userWarehouseAssignments.orgId, orgId),
        ),
        columns: { id: true },
      });
      if (!assignment) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `البائع ${seller.name || seller.username} غير مُسنَد للفرع/المخزن المختار — أسنده أولاً من إعدادات المستخدمين`,
        });
      }
    }
  }
}
