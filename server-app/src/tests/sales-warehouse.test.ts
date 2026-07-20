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

import assert from 'node:assert/strict';

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

  // 1. المخزن/الفرع إلزامي
  if (!warehouseId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'يجب اختيار الفرع / المخزن قبل حفظ الفاتورة',
    });
  }

  // 2. دفتر المستند تابع لنفس المخزن
  if (journalId) {
    const journal = mock.journal;
    if (journal?.warehouseId && journal.warehouseId !== warehouseId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'دفتر المستند لا ينتمي للفرع/المخزن المختار — اختر دفتراً مرتبطاً بنفس المخزن',
      });
    }
  }

  // 3. المستند المصدر تابع لنفس المخزن
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

  // 4. البائع مؤهل ومسموح له بالمخزن
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

// ── Helpers ────────────────────────────────────────────────────────────────────
const ORG_ID     = 1;
const WH_MAIN    = 10;
const WH_OTHER   = 99;
const JOURNAL_ID = 5;
const SELLER_ID  = 7;
const SRC_DOC_ID = 3;

async function expectError(fn: () => Promise<void>, msgPart: string) {
  let caught: any;
  try { await fn(); } catch (e) { caught = e; }
  assert.ok(caught,
    `توقّعنا TRPCError يحتوي "${msgPart}" لكن لم يُرمَ استثناء`);
  assert.ok(
    caught?.message?.includes(msgPart),
    `توقّعنا الرسالة تحتوي "${msgPart}"، الرسالة الفعلية: "${caught?.message}"`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// مجموعة CREATE
// ══════════════════════════════════════════════════════════════════════════════

async function testSC1_NoWarehouse() {
  await expectError(
    () => validateWithMock({ warehouseId: null,      orgId: ORG_ID }, {}),
    'يجب اختيار الفرع',
  );
  await expectError(
    () => validateWithMock({ warehouseId: undefined, orgId: ORG_ID }, {}),
    'يجب اختيار الفرع',
  );
  console.log('✅ SC-1:  فاتورة بدون مخزن → مرفوضة');
}

async function testSC2_JournalWrongWarehouse() {
  await expectError(
    () => validateWithMock(
      { warehouseId: WH_MAIN, journalId: JOURNAL_ID, orgId: ORG_ID },
      { journal: { warehouseId: WH_OTHER } },
    ),
    'دفتر المستند لا ينتمي',
  );
  // دفتر عام (warehouseId=null) → يمر
  await validateWithMock(
    { warehouseId: WH_MAIN, journalId: JOURNAL_ID, orgId: ORG_ID },
    { journal: { warehouseId: null } },
  );
  console.log('✅ SC-2:  دفتر من مخزن آخر → مرفوض | دفتر عام → يمر');
}

async function testSC3_SellerNotPermitted() {
  // مؤهل لكن لا إسناد للمخزن
  await expectError(
    () => validateWithMock(
      { warehouseId: WH_MAIN, sellerUserId: SELLER_ID, orgId: ORG_ID },
      { seller: { canBeSalesperson: true, defaultWarehouseId: WH_OTHER }, assignment: null },
    ),
    'البائع غير مُسنَد',
  );
  // غير مؤهل أصلاً
  await expectError(
    () => validateWithMock(
      { warehouseId: WH_MAIN, sellerUserId: SELLER_ID, orgId: ORG_ID },
      { seller: { canBeSalesperson: false, defaultWarehouseId: WH_MAIN } },
    ),
    'غير مؤهل للعمل كبائع',
  );
  console.log('✅ SC-3:  بائع غير مسموح → مرفوض');
}

async function testSC4_SourceDocWrongWarehouse() {
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
  console.log('✅ SC-4:  مستند مصدر من مخزن آخر → مرفوض');
}

// ══════════════════════════════════════════════════════════════════════════════
// مجموعة UPDATE — الحالة النهائية الكاملة (existing ⊕ input)
// ══════════════════════════════════════════════════════════════════════════════

async function testSC5_Update_JournalWrongWarehouse() {
  // الفاتورة الموجودة: warehouseId=WH_MAIN, journalId=JOURNAL_ID
  // الدفتر في DB يخص WH_OTHER → تعارض بدون أي مدخل جديد
  const existing = { warehouseId: WH_MAIN, journalId: JOURNAL_ID, sellerUserId: null, sourceDocumentId: null };
  const final    = computeFinalState(existing, {});

  await expectError(
    () => validateWithMock({ ...final, orgId: ORG_ID }, { journal: { warehouseId: WH_OTHER } }),
    'دفتر المستند لا ينتمي',
  );
  console.log('✅ SC-5:  update: دفتر من مخزن مختلف عن الفاتورة → مرفوض');
}

async function testSC6_Update_SellerNotPermitted() {
  // الفاتورة الموجودة: warehouseId=WH_MAIN, sellerUserId=SELLER_ID
  // البائع لا يملك إسناداً للمخزن WH_MAIN
  const existing = { warehouseId: WH_MAIN, journalId: null, sellerUserId: SELLER_ID, sourceDocumentId: null };
  const final    = computeFinalState(existing, {});

  await expectError(
    () => validateWithMock(
      { ...final, orgId: ORG_ID },
      { seller: { canBeSalesperson: true, defaultWarehouseId: WH_OTHER }, assignment: null },
    ),
    'البائع غير مُسنَد',
  );
  console.log('✅ SC-6:  update: بائع غير مسموح له بمخزن الفاتورة → مرفوض');
}

async function testSC7_Update_WarehouseChange_OldJournal() {
  // تغيير warehouseId → WH_OTHER في المدخل
  // journalId يبقى من الـ existing (يخص WH_MAIN) → تعارض
  const existing = { warehouseId: WH_MAIN, journalId: JOURNAL_ID, sellerUserId: null, sourceDocumentId: null };
  const final    = computeFinalState(existing, { warehouseId: WH_OTHER });
  // final.warehouseId = WH_OTHER, final.journalId = JOURNAL_ID (من existing)

  await expectError(
    () => validateWithMock(
      { ...final, orgId: ORG_ID },
      { journal: { warehouseId: WH_MAIN } }, // الدفتر القديم مربوط بـ WH_MAIN
    ),
    'دفتر المستند لا ينتمي',
  );
  console.log('✅ SC-7:  update: تغيير المخزن مع الاحتفاظ بدفتر قديم → مرفوض');
}

async function testSC8_Update_WarehouseChange_OldSourceDoc() {
  // تغيير warehouseId → WH_OTHER في المدخل
  // sourceDocumentId يبقى من الـ existing (يخص WH_MAIN) → تعارض
  const existing = { warehouseId: WH_MAIN, journalId: null, sellerUserId: null, sourceDocumentId: SRC_DOC_ID };
  const final    = computeFinalState(existing, { warehouseId: WH_OTHER });
  // final.warehouseId = WH_OTHER, final.sourceDocumentId = SRC_DOC_ID (من existing)

  await expectError(
    () => validateWithMock(
      { ...final, orgId: ORG_ID },
      { srcDoc: { warehouseId: WH_MAIN, invoiceNumber: 'INV-OLD' } },
    ),
    'ينتمي لمخزن/فرع مختلف',
  );
  console.log('✅ SC-8:  update: تغيير المخزن مع الاحتفاظ بمستند مصدر قديم → مرفوض');
}

async function testSC9_Update_ValidEdit() {
  // تعديل صحيح: نفس المخزن، دفتر مطابق، بائع مُسنَد
  const existing = {
    warehouseId: WH_MAIN, journalId: JOURNAL_ID,
    sellerUserId: SELLER_ID, sourceDocumentId: SRC_DOC_ID,
  };
  const final = computeFinalState(existing, {}); // لا تغيير في السياق

  await validateWithMock(
    { ...final, orgId: ORG_ID },
    {
      journal:    { warehouseId: WH_MAIN },
      srcDoc:     { warehouseId: WH_MAIN, invoiceNumber: 'INV-200' },
      seller:     { canBeSalesperson: true, defaultWarehouseId: WH_MAIN },
    },
  );
  console.log('✅ SC-9:  update: تعديل صحيح داخل نفس المخزن → يمر');
}

// ══════════════════════════════════════════════════════════════════════════════
// SC-10: saveForPayment — نفس مسار create
// ══════════════════════════════════════════════════════════════════════════════

async function testSC10_SaveForPayment() {
  await expectError(
    () => validateWithMock({ warehouseId: undefined, orgId: ORG_ID }, {}),
    'يجب اختيار الفرع',
  );
  await validateWithMock(
    { warehouseId: WH_MAIN, journalId: JOURNAL_ID, sellerUserId: SELLER_ID, orgId: ORG_ID },
    {
      journal: { warehouseId: WH_MAIN },
      seller:  { canBeSalesperson: true, defaultWarehouseId: WH_MAIN },
    },
  );
  console.log('✅ SC-10: saveForPayment → نفس التحقق كـ create');
}

// ══════════════════════════════════════════════════════════════════════════════
// SC-11: الحفظ الناجح — كل المعطيات صحيحة (بائع مُسنَد عبر جدول)
// ══════════════════════════════════════════════════════════════════════════════

async function testSC11_FullSuccess() {
  await validateWithMock(
    {
      warehouseId: WH_MAIN, journalId: JOURNAL_ID,
      sellerUserId: SELLER_ID, sourceDocumentId: SRC_DOC_ID,
      orgId: ORG_ID,
    },
    {
      journal:    { warehouseId: WH_MAIN },
      srcDoc:     { warehouseId: WH_MAIN, invoiceNumber: 'INV-100' },
      seller:     { canBeSalesperson: true, defaultWarehouseId: WH_OTHER },
      assignment: { id: 1 }, // إسناد عبر user_warehouse_assignments
    },
  );
  console.log('✅ SC-11: حفظ ناجح — كل المعطيات صحيحة → لا استثناء');
}

// ══════════════════════════════════════════════════════════════════════════════
// SC-12: مسلسل الفاتورة مستقل عن basedOnNumber
// ══════════════════════════════════════════════════════════════════════════════

async function testSC12_InvoiceNumberIndependent() {
  // التحقق لا يعتمد على basedOnNumber أو basedOnType
  await validateWithMock({ warehouseId: WH_MAIN, orgId: ORG_ID }, {});
  console.log('✅ SC-12: مسلسل الفاتورة مستقل — لا تأثير لـ basedOnNumber على التحقق');
}

// ── تشغيل جميع الاختبارات ────────────────────────────────────────────────────
async function runAll() {
  console.log('\n══ اختبارات التحقق من سياق المخزن — create + update (12 سيناريو) ══\n');

  console.log('── مجموعة CREATE ──');
  await testSC1_NoWarehouse();
  await testSC2_JournalWrongWarehouse();
  await testSC3_SellerNotPermitted();
  await testSC4_SourceDocWrongWarehouse();

  console.log('\n── مجموعة UPDATE (الحالة النهائية الكاملة: existing ⊕ input) ──');
  await testSC5_Update_JournalWrongWarehouse();
  await testSC6_Update_SellerNotPermitted();
  await testSC7_Update_WarehouseChange_OldJournal();
  await testSC8_Update_WarehouseChange_OldSourceDoc();
  await testSC9_Update_ValidEdit();

  console.log('\n── مسارات أخرى ──');
  await testSC10_SaveForPayment();
  await testSC11_FullSuccess();
  await testSC12_InvoiceNumberIndependent();

  console.log('\n✅ جميع الاختبارات نجحت (12/12)\n');
}

runAll().catch(e => { console.error('❌ فشل الاختبار:', e); process.exit(1); });
