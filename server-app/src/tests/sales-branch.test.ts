/**
 * اختبارات التكامل: أمان الفرع في فاتورة المبيعات
 * Task #182 — 7 سيناريوهات باستخدام in-process tRPC caller
 *
 * SC-1: حفظ فاتورة بدون branchId → BAD_REQUEST
 * SC-2: حفظ فاتورة بدفتر من فرع مختلف → BAD_REQUEST
 * SC-3: حفظ فاتورة بمخزن من فرع مختلف → BAD_REQUEST
 * SC-4: حفظ فاتورة ببائع غير مُسنَد للفرع → BAD_REQUEST
 * SC-5: حفظ فاتورة بمستند مصدر من فرع مختلف → BAD_REQUEST
 * SC-6: getByNumber لأمر بيع → الرقم الأصلي محفوظ دون تغيير
 * SC-7: clearBranchDependentFields — unit test للدالة الحقيقية المستخرجة من SalesInvoicePage
 *
 * الـ isolation:
 *  - beforeAll: يُنشئ الكيانات الأساسية المشتركة (org, branches, systemUser)
 *  - كل اختبار (SC-2..SC-5) يُنشئ بياناته الخاصة ويُنظّفها في finally
 *  - afterAll: يُزيل الكيانات الأساسية
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createCallerFactory } from '../trpc.js';
import { salesRouter } from '../routers/sales.js';
import { db } from '../db.js';
import * as schema from '../schema.js';
import { eq, and } from 'drizzle-orm';
import type { User } from '../schema.js';
import {
  clearBranchDependentFields,
  type BranchDependentFields,
} from '../../../client-app/src/lib/invoiceBranchLogic.js';

// ── إنشاء caller factory من salesRouter ──────────────────────────────────────
const createSalesCaller = createCallerFactory(salesRouter);

// ── الكيانات الأساسية المشتركة (تُنشأ في beforeAll) ──────────────────────────
let orgId        = 0;
let branchAId    = 0;
let branchBId    = 0;
let systemUserId = 0;

// ── دالة: caller مع مستخدم تجريبي ────────────────────────────────────────────
function makeCaller() {
  const mockUser = {
    id: systemUserId,
    orgId,
    role: 'admin',
    isActive: true,
    name: 'Test Admin',
    username: '__test_caller_admin__',
    passwordHash: 'x',
    sessionVersion: 1,
    canBeSalesperson: false,
    allowLogin: true,
    passwordStatus: 'set',
    forcePasswordChange: false,
    recoveryEnabledPhone: false,
    recoveryEnabledEmail: false,
  } as User;

  return createSalesCaller({
    req: {} as any,
    res: {} as any,
    user: mockUser,
  });
}

// ── بيانات فاتورة أساسية ─────────────────────────────────────────────────────
function baseInvoice(overrides: Record<string, unknown> = {}) {
  return {
    invoiceNumber: `SC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    invoiceType:   'sale' as const,
    invoiceDate:   new Date().toISOString().slice(0, 10),
    items:         [] as any[],
    ...overrides,
  };
}

// ── helper: اصطياد TRPCError ─────────────────────────────────────────────────
async function catchErr(fn: () => Promise<unknown>): Promise<TRPCError | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    if (e instanceof TRPCError) return e;
    throw e;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// إعداد الكيانات الأساسية المشتركة
// ════════════════════════════════════════════════════════════════════════════════
beforeAll(async () => {
  const ts = Date.now();

  const [org] = await db.insert(schema.organizations).values({
    code: `TST-${ts}`.slice(0, 20),
    name: `__TST_INT_CALLER_${ts}__`,
  }).returning();
  orgId = org.id;

  const [brA] = await db.insert(schema.branches).values({ orgId, name: 'BranchA-caller' }).returning();
  const [brB] = await db.insert(schema.branches).values({ orgId, name: 'BranchB-caller' }).returning();
  branchAId = brA.id;
  branchBId = brB.id;

  const [sysUser] = await db.insert(schema.users).values({
    orgId, username: `__sys_${ts}__`, name: 'Sys Caller',
    passwordHash: 'x', role: 'admin', isActive: true,
  }).returning();
  systemUserId = sysUser.id;
}, 30_000);

// ════════════════════════════════════════════════════════════════════════════════
// تنظيف الكيانات الأساسية بعد جميع الاختبارات
// ════════════════════════════════════════════════════════════════════════════════
afterAll(async () => {
  if (!orgId) return;
  await db.delete(schema.userBranchAssignments).where(eq(schema.userBranchAssignments.orgId, orgId));
  await db.delete(schema.salesInvoiceItems).where(eq(schema.salesInvoiceItems.orgId, orgId));
  await db.delete(schema.salesInvoices).where(eq(schema.salesInvoices.orgId, orgId));
  await db.delete(schema.documentJournals).where(eq(schema.documentJournals.orgId, orgId));
  await db.delete(schema.warehouses).where(eq(schema.warehouses.orgId, orgId));
  await db.delete(schema.users).where(eq(schema.users.orgId, orgId));
  await db.delete(schema.branches).where(eq(schema.branches.orgId, orgId));
  await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
}, 30_000);

// ════════════════════════════════════════════════════════════════════════════════
// SC-1: بدون branchId → BAD_REQUEST (لا بيانات fixture مطلوبة)
// ════════════════════════════════════════════════════════════════════════════════
it('SC-1: حفظ فاتورة بدون branchId → يُرفض بـ BAD_REQUEST', async () => {
  const caller = makeCaller();
  const err = await catchErr(() => caller.create(baseInvoice()));
  expect(err).not.toBeNull();
  expect(err!.code).toBe('BAD_REQUEST');
  expect(err!.message).toMatch(/يجب اختيار الفرع/);
});

// ════════════════════════════════════════════════════════════════════════════════
// SC-2: دفتر من فرع مختلف → BAD_REQUEST — fixture محلي بـ try/finally
// ════════════════════════════════════════════════════════════════════════════════
it('SC-2: حفظ فاتورة بدفتر ينتمي للفرع B بينما الفاتورة في الفرع A → يُرفض', async () => {
  const ts = Date.now();
  const [j] = await db.insert(schema.documentJournals).values({
    orgId, docType: 'sales_invoice',
    code: `JB-${ts}`.slice(0, 30), name: 'JournalB-SC2',
    branchId: branchBId, isSharedJournal: false,
  }).returning();

  try {
    const caller = makeCaller();
    const err = await catchErr(() => caller.create(baseInvoice({
      branchId:  branchAId,
      journalId: j.id,
    })));
    expect(err).not.toBeNull();
    expect(err!.code).toBe('BAD_REQUEST');
    expect(err!.message).toMatch(/لا ينتمي للفرع/);
  } finally {
    await db.delete(schema.documentJournals).where(eq(schema.documentJournals.id, j.id));
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// SC-3: مخزن من فرع مختلف → BAD_REQUEST — fixture محلي بـ try/finally
// ════════════════════════════════════════════════════════════════════════════════
it('SC-3: حفظ فاتورة بمخزن ينتمي للفرع B بينما الفاتورة في الفرع A → يُرفض', async () => {
  const [w] = await db.insert(schema.warehouses).values({
    orgId, name: 'WarehouseB-SC3', branchId: branchBId,
  }).returning();

  try {
    const caller = makeCaller();
    const err = await catchErr(() => caller.create(baseInvoice({
      branchId:    branchAId,
      warehouseId: w.id,
    })));
    expect(err).not.toBeNull();
    expect(err!.code).toBe('BAD_REQUEST');
    expect(err!.message).toMatch(/المخزن لا ينتمي/);
  } finally {
    await db.delete(schema.warehouses).where(eq(schema.warehouses.id, w.id));
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// SC-4: بائع غير مُسنَد للفرع → BAD_REQUEST — fixture محلي بـ try/finally
// ════════════════════════════════════════════════════════════════════════════════
it('SC-4: حفظ فاتورة ببائع فرعه الافتراضي A بدون assignment للفرع B → يُرفض', async () => {
  const ts = Date.now();
  const [seller] = await db.insert(schema.users).values({
    orgId, username: `__seller_sc4_${ts}__`, name: 'SellerA-SC4',
    passwordHash: 'x', role: 'cashier', isActive: true,
    canBeSalesperson: true, defaultBranchId: branchAId,
  }).returning();

  try {
    const caller = makeCaller();
    const err = await catchErr(() => caller.create(baseInvoice({
      branchId:     branchBId,
      sellerUserId: seller.id,
    })));
    expect(err).not.toBeNull();
    expect(err!.code).toBe('BAD_REQUEST');
    expect(err!.message).toMatch(/غير مُسنَد للفرع/);
  } finally {
    await db.delete(schema.users).where(eq(schema.users.id, seller.id));
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// SC-5: مستند مصدر من فرع مختلف → BAD_REQUEST — fixture محلي بـ try/finally
// ════════════════════════════════════════════════════════════════════════════════
it('SC-5: حفظ فاتورة بمستند مصدر ينتمي للفرع B بينما الفاتورة في الفرع A → يُرفض', async () => {
  const ts = Date.now();
  const [ordB] = await db.insert(schema.salesInvoices).values({
    orgId, invoiceNumber: `ORD-B-SC5-${ts}`, invoiceType: 'order',
    invoiceDate: new Date(), branchId: branchBId, status: 'confirmed',
    subtotal: '0.0000', discountAmount: '0.0000',
    taxAmount: '0.0000', total: '0.0000',
    paidAmount: '0.0000', remainingAmount: '0.0000',
    userId: systemUserId,
  }).returning();

  try {
    const caller = makeCaller();
    const err = await catchErr(() => caller.create(baseInvoice({
      branchId:         branchAId,
      sourceDocumentId: ordB.id,
      basedOnType:      'order',
    })));
    expect(err).not.toBeNull();
    expect(err!.code).toBe('BAD_REQUEST');
    expect(err!.message).toMatch(/فرع مختلف/);
  } finally {
    await db.delete(schema.salesInvoices).where(eq(schema.salesInvoices.id, ordB.id));
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// SC-6: getByNumber لأمر بيع → الرقم الأصلي محفوظ دون تغيير
//       fixture محلي بـ try/finally
// ════════════════════════════════════════════════════════════════════════════════
it('SC-6: تحميل أمر بيع عبر getByNumber → رقم الأمر الأصلي مُعاد بدون تحوير', async () => {
  const ts = Date.now();
  const originalNumber = `ORD-A-SC6-${ts}`;
  const [ordA] = await db.insert(schema.salesInvoices).values({
    orgId, invoiceNumber: originalNumber, invoiceType: 'order',
    invoiceDate: new Date(), branchId: branchAId, status: 'confirmed',
    subtotal: '100.0000', discountAmount: '0.0000',
    taxAmount: '0.0000', total: '100.0000',
    paidAmount: '0.0000', remainingAmount: '100.0000',
    userId: systemUserId,
  }).returning();

  try {
    const caller = makeCaller();
    const result = await caller.getByNumber({ type: 'order', number: originalNumber });

    expect(result).not.toBeNull();
    // رقم الأمر في الرد يجب أن يطابق الأصل — لا يتغير عند التحميل
    expect(result!.number).toBe(originalNumber);
    expect(result!.sourceType).toBe('order');
  } finally {
    await db.delete(schema.salesInvoices).where(eq(schema.salesInvoices.id, ordA.id));
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// SC-7: clearBranchDependentFields — unit test للدالة الحقيقية المستخرجة
//       مستوردة من: client-app/src/lib/invoiceBranchLogic.ts
//       مُستخدَمة في: SalesInvoicePage.doSelectBranch
// ════════════════════════════════════════════════════════════════════════════════
describe('SC-7: clearBranchDependentFields (دالة حقيقية مستخرجة من SalesInvoicePage)', () => {
  const filledState: BranchDependentFields = {
    basedOnType:   'order',
    basedOnNumber: 'ORD-001',
    sellerUserId:  5,
    lines:         [{ productId: 1, qty: 2 }, { productId: 3, qty: 5 }],
  };

  it('SC-7.1: basedOnType يُصبح "" بعد استدعاء clearBranchDependentFields', () => {
    const after = clearBranchDependentFields(filledState);
    expect(after.basedOnType).toBe('');
  });

  it('SC-7.2: basedOnNumber يُصبح "" بعد استدعاء clearBranchDependentFields', () => {
    const after = clearBranchDependentFields(filledState);
    expect(after.basedOnNumber).toBe('');
  });

  it('SC-7.3: sellerUserId يُصبح null بعد استدعاء clearBranchDependentFields', () => {
    const after = clearBranchDependentFields(filledState);
    expect(after.sellerUserId).toBeNull();
  });

  it('SC-7.4: lines تُفرَّغ تماماً بعد استدعاء clearBranchDependentFields', () => {
    const after = clearBranchDependentFields(filledState);
    expect(after.lines).toHaveLength(0);
  });
});
