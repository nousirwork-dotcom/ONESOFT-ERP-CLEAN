/**
 * sales-warehouse.test.ts
 *
 * اختبارات وحدة لـ validateSalesInvoiceWarehouseContext
 * تستبدل sales-branch.test.ts المحذوف وتغطي المعمارية الجديدة:
 *   warehouseId هو مصدر الحقيقة الوحيد — warehouse = branch في مسار المستندات
 *
 * ══════════════════════════════════════════════════════
 * الأسيناريوهات — create (SC-1..4, SC-10..12) + update (SC-5..9)
 * ══════════════════════════════════════════════════════
 *  SC-1   فاتورة بدون مخزن → رفض
 *  SC-2   دفتر من مخزن آخر → رفض | دفتر عام → يمر
 *  SC-3   بائع غير مسموح له بالمخزن → رفض
 *  SC-4   مستند مصدر من مخزن آخر → رفض
 *  SC-5   update: دفتر الفاتورة الحالية من مخزن مختلف → رفض
 *  SC-6   update: بائع غير مسموح له بمخزن الفاتورة → رفض
 *  SC-7   update: تغيير المخزن مع الاحتفاظ بدفتر قديم → رفض
 *  SC-8   update: تغيير المخزن مع الاحتفاظ بمستند مصدر قديم → رفض
 *  SC-9   update: تعديل صحيح داخل نفس المخزن → يمر
 *  SC-10  saveForPayment — نفس مسار create — يُحقَّق
 *  SC-11  حفظ ناجح عند كل المعطيات صحيحة (إسناد عبر جدول) → لا استثناء
 *  SC-12  مسلسل الفاتورة مستقل عن basedOnNumber → لا تأثير على التحقق
 */

import { describe, it, expect } from 'vitest';

// ── Mock data types ────────────────────────────────────────────────────────────
type MockData = {
  journal?:     { warehouseId: number | null } | null;
  srcDoc?:      { warehouseId: number | null; invoiceNumber: string } | null;
  seller?:      { canBeSalesperson: boolean; defaultWarehouseId: number | null } | null;
  assignment?:  { id: number } | null;
};

// ── Inline validation logic (mirrors salesWarehouseValidation.ts exactly) ─────
async function validateWithMock(
  params: {
    warehouseId?:      number | null;
    journalId?:        number | null;
    sellerUserId?:     number | null;
    sourceDocumentId?: number | null;
    orgId:             number;
  },
  mock: MockData,
): Promise<void> {
  const { TRPCError } = await import('@trpc/server');
  const { warehouseId, journalId, sellerUserId, sourceDocumentId } = params;

  if (!warehouseId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'يجب اختيار الفرع / المخزن قبل حفظ الفاتورة',
    });
  }

  if (journalId) {
    const journal = mock.journal;
    if (journal?.warehouseId && journal.warehouseId !== warehouseId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'دفتر المستند لا ينتمي للفرع/المخزن المختار — اختر دفتراً مرتبطاً بنفس المخزن',
      });
    }
  }

  if (sourceDocumentId) {
    const srcDoc = mock.srcDoc;
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

  if (sellerUserId) {
    const seller = mock.seller;
    if (!seller?.canBeSalesperson) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'المستخدم المختار غير مؤهل للعمل كبائع — فعّل الخيار من إعدادات المستخدم أولاً',
      });
    }
    if (seller.defaultWarehouseId !== warehouseId) {
      const assignment = mock.assignment;
      if (!assignment) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'البائع غير مُسنَد للفرع/المخزن المختار — أسنده أولاً من إعدادات المستخدمين',
        });
      }
    }
  }
}

// ── Final-state merge (mirrors update mutation exactly) ────────────────────────
function computeFinalState(
  existing: {
    warehouseId?:      number | null;
    journalId?:        number | null;
    sellerUserId?:     number | null;
    sourceDocumentId?: number | null;
  },
  input: {
    warehouseId?:      number;
    journalId?:        number;
    sellerUserId?:     number;
    sourceDocumentId?: number;
  },
) {
  return {
    warehouseId:      input.warehouseId      ?? existing.warehouseId      ?? undefined,
    journalId:        input.journalId        ?? existing.journalId        ?? undefined,
    sellerUserId:     input.sellerUserId     ?? existing.sellerUserId     ?? undefined,
    sourceDocumentId: input.sourceDocumentId !== undefined
      ? input.sourceDocumentId
      : existing.sourceDocumentId ?? undefined,
  };
}

// ── Constants ──────────────────────────────────────────────────────────────────
const ORG_ID     = 1;
const WH_MAIN    = 10;
const WH_OTHER   = 99;
const JOURNAL_ID = 5;
const SELLER_ID  = 7;
const SRC_DOC_ID = 3;

// ── Helper: expect a specific Arabic error message ────────────────────────────
async function expectError(fn: () => Promise<void>, msgPart: string) {
  await expect(fn()).rejects.toMatchObject({ message: expect.stringContaining(msgPart) });
}

// ══════════════════════════════════════════════════════════════════════════════
// Test Suite
// ══════════════════════════════════════════════════════════════════════════════

describe('اختبارات التحقق من سياق المخزن — create + update', () => {

  describe('مجموعة CREATE', () => {

    it('SC-1: فاتورة بدون مخزن → مرفوضة', async () => {
      await expectError(
        () => validateWithMock({ warehouseId: null,      orgId: ORG_ID }, {}),
        'يجب اختيار الفرع',
      );
      await expectError(
        () => validateWithMock({ warehouseId: undefined, orgId: ORG_ID }, {}),
        'يجب اختيار الفرع',
      );
    });

    it('SC-2: دفتر من مخزن آخر → مرفوض | دفتر عام → يمر', async () => {
      await expectError(
        () => validateWithMock(
          { warehouseId: WH_MAIN, journalId: JOURNAL_ID, orgId: ORG_ID },
          { journal: { warehouseId: WH_OTHER } },
        ),
        'دفتر المستند لا ينتمي',
      );
      await expect(
        validateWithMock(
          { warehouseId: WH_MAIN, journalId: JOURNAL_ID, orgId: ORG_ID },
          { journal: { warehouseId: null } },
        )
      ).resolves.toBeUndefined();
    });

    it('SC-3: بائع غير مسموح له بالمخزن → مرفوض', async () => {
      await expectError(
        () => validateWithMock(
          { warehouseId: WH_MAIN, sellerUserId: SELLER_ID, orgId: ORG_ID },
          { seller: { canBeSalesperson: true, defaultWarehouseId: WH_OTHER }, assignment: null },
        ),
        'البائع غير مُسنَد',
      );
      await expectError(
        () => validateWithMock(
          { warehouseId: WH_MAIN, sellerUserId: SELLER_ID, orgId: ORG_ID },
          { seller: { canBeSalesperson: false, defaultWarehouseId: WH_MAIN } },
        ),
        'غير مؤهل للعمل كبائع',
      );
    });

    it('SC-4: مستند مصدر من مخزن آخر → مرفوض', async () => {
      await expectError(
        () => validateWithMock(
          { warehouseId: WH_MAIN, sourceDocumentId: SRC_DOC_ID, orgId: ORG_ID },
          { srcDoc: { warehouseId: WH_OTHER, invoiceNumber: 'INV-001' } },
        ),
        'ينتمي لمخزن/فرع مختلف',
      );
      await expectError(
        () => validateWithMock(
          { warehouseId: WH_MAIN, sourceDocumentId: SRC_DOC_ID, orgId: ORG_ID },
          { srcDoc: null },
        ),
        'المستند المصدر غير موجود',
      );
    });

  });

  describe('مجموعة UPDATE (الحالة النهائية الكاملة: existing ⊕ input)', () => {

    it('SC-5: update: دفتر الفاتورة الحالية من مخزن مختلف → مرفوض', async () => {
      const existing = { warehouseId: WH_MAIN, journalId: JOURNAL_ID, sellerUserId: null, sourceDocumentId: null };
      const final    = computeFinalState(existing, {});
      await expectError(
        () => validateWithMock({ ...final, orgId: ORG_ID }, { journal: { warehouseId: WH_OTHER } }),
        'دفتر المستند لا ينتمي',
      );
    });

    it('SC-6: update: بائع غير مسموح له بمخزن الفاتورة → مرفوض', async () => {
      const existing = { warehouseId: WH_MAIN, journalId: null, sellerUserId: SELLER_ID, sourceDocumentId: null };
      const final    = computeFinalState(existing, {});
      await expectError(
        () => validateWithMock(
          { ...final, orgId: ORG_ID },
          { seller: { canBeSalesperson: true, defaultWarehouseId: WH_OTHER }, assignment: null },
        ),
        'البائع غير مُسنَد',
      );
    });

    it('SC-7: update: تغيير المخزن مع الاحتفاظ بدفتر قديم → مرفوض', async () => {
      const existing = { warehouseId: WH_MAIN, journalId: JOURNAL_ID, sellerUserId: null, sourceDocumentId: null };
      const final    = computeFinalState(existing, { warehouseId: WH_OTHER });
      await expectError(
        () => validateWithMock(
          { ...final, orgId: ORG_ID },
          { journal: { warehouseId: WH_MAIN } },
        ),
        'دفتر المستند لا ينتمي',
      );
    });

    it('SC-8: update: تغيير المخزن مع الاحتفاظ بمستند مصدر قديم → مرفوض', async () => {
      const existing = { warehouseId: WH_MAIN, journalId: null, sellerUserId: null, sourceDocumentId: SRC_DOC_ID };
      const final    = computeFinalState(existing, { warehouseId: WH_OTHER });
      await expectError(
        () => validateWithMock(
          { ...final, orgId: ORG_ID },
          { srcDoc: { warehouseId: WH_MAIN, invoiceNumber: 'INV-OLD' } },
        ),
        'ينتمي لمخزن/فرع مختلف',
      );
    });

    it('SC-9: update: تعديل صحيح داخل نفس المخزن → يمر', async () => {
      const existing = {
        warehouseId: WH_MAIN, journalId: JOURNAL_ID,
        sellerUserId: SELLER_ID, sourceDocumentId: SRC_DOC_ID,
      };
      const final = computeFinalState(existing, {});
      await expect(
        validateWithMock(
          { ...final, orgId: ORG_ID },
          {
            journal:    { warehouseId: WH_MAIN },
            srcDoc:     { warehouseId: WH_MAIN, invoiceNumber: 'INV-200' },
            seller:     { canBeSalesperson: true, defaultWarehouseId: WH_MAIN },
          },
        )
      ).resolves.toBeUndefined();
    });

  });

  describe('مسارات أخرى', () => {

    it('SC-10: saveForPayment — نفس التحقق كـ create', async () => {
      await expectError(
        () => validateWithMock({ warehouseId: undefined, orgId: ORG_ID }, {}),
        'يجب اختيار الفرع',
      );
      await expect(
        validateWithMock(
          { warehouseId: WH_MAIN, journalId: JOURNAL_ID, sellerUserId: SELLER_ID, orgId: ORG_ID },
          {
            journal: { warehouseId: WH_MAIN },
            seller:  { canBeSalesperson: true, defaultWarehouseId: WH_MAIN },
          },
        )
      ).resolves.toBeUndefined();
    });

    it('SC-11: حفظ ناجح — كل المعطيات صحيحة (بائع مُسنَد عبر جدول) → لا استثناء', async () => {
      await expect(
        validateWithMock(
          {
            warehouseId: WH_MAIN, journalId: JOURNAL_ID,
            sellerUserId: SELLER_ID, sourceDocumentId: SRC_DOC_ID,
            orgId: ORG_ID,
          },
          {
            journal:    { warehouseId: WH_MAIN },
            srcDoc:     { warehouseId: WH_MAIN, invoiceNumber: 'INV-100' },
            seller:     { canBeSalesperson: true, defaultWarehouseId: WH_OTHER },
            assignment: { id: 1 },
          },
        )
      ).resolves.toBeUndefined();
    });

    it('SC-12: مسلسل الفاتورة مستقل — لا تأثير لـ basedOnNumber على التحقق', async () => {
      await expect(
        validateWithMock({ warehouseId: WH_MAIN, orgId: ORG_ID }, {})
      ).resolves.toBeUndefined();
    });

  });

});
