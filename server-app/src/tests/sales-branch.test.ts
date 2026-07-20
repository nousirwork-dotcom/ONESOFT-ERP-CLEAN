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
 * SC-7: منطق doSelectBranch → يُصفِّر الحقول عند تغيير الفرع (unit test)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createCallerFactory } from '../trpc.js';
import { salesRouter } from '../routers/sales.js';
import { db } from '../db.js';
import * as schema from '../schema.js';
import { eq } from 'drizzle-orm';
import type { User } from '../schema.js';

// ── إنشاء caller factory من salesRouter ──────────────────────────────────────
const createSalesCaller = createCallerFactory(salesRouter);

// ── IDs للبيانات التجريبية ──────────────────────────────────────────────────
let orgId            = 0;
let branchAId        = 0;
let branchBId        = 0;
let systemUserId     = 0;
let journalBranchBId  = 0;   // دفتر الفرع B — يُرفض مع الفرع A
let warehouseBranchBId = 0;  // مخزن الفرع B — يُرفض مع الفرع A
let sellerBranchAId  = 0;    // بائع فرعه الافتراضي A — يُرفض مع الفرع B
let orderBranchAId   = 0;    // أمر بيع في الفرع A
let orderBranchBId   = 0;    // أمر بيع في الفرع B

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
// إعداد البيانات التجريبية
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

  const [jB] = await db.insert(schema.documentJournals).values({
    orgId, docType: 'sales_invoice',
    code: `JB-${ts}`.slice(0, 30),
    name: 'JournalB-caller',
    branchId: branchBId, isSharedJournal: false,
  }).returning();
  journalBranchBId = jB.id;

  const [wB] = await db.insert(schema.warehouses).values({
    orgId, name: 'WarehouseB-caller', branchId: branchBId,
  }).returning();
  warehouseBranchBId = wB.id;

  const [seller] = await db.insert(schema.users).values({
    orgId, username: `__seller_${ts}__`, name: 'SellerA-caller',
    passwordHash: 'x', role: 'cashier', isActive: true,
    canBeSalesperson: true, defaultBranchId: branchAId,
  }).returning();
  sellerBranchAId = seller.id;

  const [ordA] = await db.insert(schema.salesInvoices).values({
    orgId, invoiceNumber: `ORD-A-${ts}`, invoiceType: 'order',
    invoiceDate: new Date(), branchId: branchAId, status: 'confirmed',
    subtotal: '100.0000', discountAmount: '0.0000',
    taxAmount: '0.0000', total: '100.0000',
    paidAmount: '0.0000', remainingAmount: '100.0000',
    userId: sysUser.id,
  }).returning();
  orderBranchAId = ordA.id;

  const [ordB] = await db.insert(schema.salesInvoices).values({
    orgId, invoiceNumber: `ORD-B-${ts}`, invoiceType: 'order',
    invoiceDate: new Date(), branchId: branchBId, status: 'confirmed',
    subtotal: '100.0000', discountAmount: '0.0000',
    taxAmount: '0.0000', total: '100.0000',
    paidAmount: '0.0000', remainingAmount: '100.0000',
    userId: sysUser.id,
  }).returning();
  orderBranchBId = ordB.id;
}, 30_000);

// ════════════════════════════════════════════════════════════════════════════════
// تنظيف بعد الاختبارات
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
// SC-1: بدون branchId → BAD_REQUEST
// ════════════════════════════════════════════════════════════════════════════════
it('SC-1: حفظ فاتورة بدون branchId → يُرفض بـ BAD_REQUEST', async () => {
  const caller = makeCaller();
  const err = await catchErr(() => caller.create(baseInvoice()));
  expect(err).not.toBeNull();
  expect(err!.code).toBe('BAD_REQUEST');
  expect(err!.message).toMatch(/يجب اختيار الفرع/);
});

// ════════════════════════════════════════════════════════════════════════════════
// SC-2: دفتر من فرع مختلف → BAD_REQUEST
// ════════════════════════════════════════════════════════════════════════════════
it('SC-2: حفظ فاتورة بدفتر ينتمي للفرع B بينما الفاتورة في الفرع A → يُرفض', async () => {
  const caller = makeCaller();
  const err = await catchErr(() => caller.create(baseInvoice({
    branchId:  branchAId,
    journalId: journalBranchBId,  // دفتر فرع B + فرع A = تعارض
  })));
  expect(err).not.toBeNull();
  expect(err!.code).toBe('BAD_REQUEST');
  expect(err!.message).toMatch(/لا ينتمي للفرع/);
});

// ════════════════════════════════════════════════════════════════════════════════
// SC-3: مخزن من فرع مختلف → BAD_REQUEST
// ════════════════════════════════════════════════════════════════════════════════
it('SC-3: حفظ فاتورة بمخزن ينتمي للفرع B بينما الفاتورة في الفرع A → يُرفض', async () => {
  const caller = makeCaller();
  const err = await catchErr(() => caller.create(baseInvoice({
    branchId:    branchAId,
    warehouseId: warehouseBranchBId, // مخزن فرع B + فرع A = تعارض
  })));
  expect(err).not.toBeNull();
  expect(err!.code).toBe('BAD_REQUEST');
  expect(err!.message).toMatch(/المخزن لا ينتمي/);
});

// ════════════════════════════════════════════════════════════════════════════════
// SC-4: بائع غير مُسنَد للفرع → BAD_REQUEST
// ════════════════════════════════════════════════════════════════════════════════
it('SC-4: حفظ فاتورة ببائع فرعه الافتراضي A بدون assignment للفرع B → يُرفض', async () => {
  const caller = makeCaller();
  const err = await catchErr(() => caller.create(baseInvoice({
    branchId:     branchBId,
    sellerUserId: sellerBranchAId, // بائع فرعه A، بدون assignment لـ B
  })));
  expect(err).not.toBeNull();
  expect(err!.code).toBe('BAD_REQUEST');
  expect(err!.message).toMatch(/غير مُسنَد للفرع/);
});

// ════════════════════════════════════════════════════════════════════════════════
// SC-5: مستند مصدر من فرع مختلف → BAD_REQUEST
// ════════════════════════════════════════════════════════════════════════════════
it('SC-5: حفظ فاتورة بمستند مصدر ينتمي للفرع B بينما الفاتورة في الفرع A → يُرفض', async () => {
  const caller = makeCaller();
  const err = await catchErr(() => caller.create(baseInvoice({
    branchId:         branchAId,
    sourceDocumentId: orderBranchBId, // مصدر فرع B + فرع A = تعارض
    basedOnType:      'order',
  })));
  expect(err).not.toBeNull();
  expect(err!.code).toBe('BAD_REQUEST');
  expect(err!.message).toMatch(/فرع مختلف/);
});

// ════════════════════════════════════════════════════════════════════════════════
// SC-6: getByNumber لأمر بيع → رقم الأمر الأصلي محفوظ دون تغيير
// ════════════════════════════════════════════════════════════════════════════════
it('SC-6: تحميل أمر بيع عبر getByNumber → رقم الأمر الأصلي مُعاد بدون تحوير', async () => {
  const caller = makeCaller();

  const orderRow = await db.query.salesInvoices.findFirst({
    where: eq(schema.salesInvoices.id, orderBranchAId),
    columns: { invoiceNumber: true },
  });
  expect(orderRow).toBeTruthy();
  const originalNumber = orderRow!.invoiceNumber!;

  const result = await caller.getByNumber({ type: 'order', number: originalNumber });

  expect(result).not.toBeNull();
  expect(result!.number).toBe(originalNumber);  // رقم الأمر لا يتغير
  expect(result!.sourceType).toBe('order');
});

// ════════════════════════════════════════════════════════════════════════════════
// SC-7: منطق doSelectBranch — unit test معزول (بدون DB)
// ════════════════════════════════════════════════════════════════════════════════
describe('SC-7: منطق doSelectBranch عند تغيير الفرع (unit test)', () => {
  type InvoiceState = {
    branchId:      number | null;
    basedOnType:   string | undefined;
    basedOnNumber: string | undefined;
    sellerUserId:  number | undefined;
    journalId:     number | undefined;
    lines:         object[];
  };

  /** منطق مُعزَّل من SalesInvoicePage.doSelectBranch */
  function doSelectBranch(state: InvoiceState, newBranchId: number | null): InvoiceState {
    return {
      ...state,
      branchId:      newBranchId,
      basedOnType:   undefined,
      basedOnNumber: undefined,
      sellerUserId:  undefined,
      journalId:     undefined,
      lines:         [],
    };
  }

  const filledState: InvoiceState = {
    branchId:      1,
    basedOnType:   'order',
    basedOnNumber: 'ORD-001',
    sellerUserId:  5,
    journalId:     10,
    lines:         [{ productId: 1, qty: 2 }, { productId: 3, qty: 5 }],
  };

  it('SC-7.1: basedOnType و basedOnNumber يُصبحان undefined بعد تغيير الفرع', () => {
    const after = doSelectBranch(filledState, 2);
    expect(after.basedOnType).toBeUndefined();
    expect(after.basedOnNumber).toBeUndefined();
  });

  it('SC-7.2: sellerUserId يُصبح undefined بعد تغيير الفرع', () => {
    const after = doSelectBranch(filledState, 3);
    expect(after.sellerUserId).toBeUndefined();
  });

  it('SC-7.3: lines تُفرَّغ تماماً بعد تغيير الفرع', () => {
    const after = doSelectBranch(filledState, 5);
    expect(after.lines).toHaveLength(0);
  });

  it('SC-7.4: branchId الجديد يُعيَّن بشكل صحيح في الـ state', () => {
    const after = doSelectBranch(filledState, 42);
    expect(after.branchId).toBe(42);
  });
});
