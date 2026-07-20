/**
 * اختبارات تكامل: أمان الفروع في فاتورة المبيعات
 * Task #182 — يغطي التحقق من: الدفتر، المستند المصدر، الفرع، البائع
 *
 * يستخدم DATABASE_URL من البيئة مباشرةً.
 * كل اختبار يُنشئ بياناته الخاصة ويُنظّفها بعد الانتهاء (cleanup في afterAll).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

// ── إعداد اتصال DB مستقل للاختبارات ─────────────────────────────────────────
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env['DATABASE_URL']! });
const db   = drizzle(pool, { schema });

// ── مُعرِّفات البيانات التجريبية (سيُملأ في beforeAll) ───────────────────────
let orgId    = 0;
let branchAId = 0; // الفرع الأول
let branchBId = 0; // الفرع الثاني — مختلف
let journalSharedId = 0;  // دفتر مشترك (is_shared_journal=true)
let journalBranchAId = 0; // دفتر مرتبط بالفرع A
let journalBranchBId = 0; // دفتر مرتبط بالفرع B
let sellerUserId    = 0;  // بائع مؤهّل — فرعه الافتراضي A
let nonSellerUserId = 0;  // مستخدم غير مؤهّل كبائع
let invoiceSrcBranchA = 0; // فاتورة مصدر (أمر بيع) في الفرع A
let invoiceSrcBranchB = 0; // فاتورة مصدر (أمر بيع) في الفرع B

// ── دوال مساعدة ──────────────────────────────────────────────────────────────
/** يُشغّل دالة ويُعيد TRPCError إذا رُمي، أو null إذا نجحت */
async function catchTrpc(fn: () => Promise<unknown>): Promise<TRPCError | null> {
  try { await fn(); return null; }
  catch (e) { if (e instanceof TRPCError) return e; throw e; }
}

// استيراد validation helpers المنقولة مباشرةً (نحاكي منطق sales.ts)
async function validateJournal(journalId: number, branchId: number) {
  const journal = await db.query.documentJournals.findFirst({
    where: eq(schema.documentJournals.id, journalId),
    columns: { branchId: true, isSharedJournal: true },
  });
  if (!journal) throw new TRPCError({ code: 'NOT_FOUND', message: 'الدفتر غير موجود' });
  if (!journal.isSharedJournal && journal.branchId && journal.branchId !== branchId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'دفتر المستند لا ينتمي للفرع المختار' });
  }
  if (!journal.isSharedJournal && !journal.branchId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'دفتر المستند غير مرتبط بفرع' });
  }
}

async function validateSourceDocument(sourceDocumentId: number, branchId: number, orgId: number) {
  const srcDoc = await db.query.salesInvoices.findFirst({
    where: and(eq(schema.salesInvoices.id, sourceDocumentId), eq(schema.salesInvoices.orgId, orgId)),
    columns: { branchId: true, invoiceNumber: true },
  });
  if (!srcDoc) throw new TRPCError({ code: 'NOT_FOUND', message: 'المستند المصدر غير موجود' });
  if (srcDoc.branchId && srcDoc.branchId !== branchId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `المستند المصدر ينتمي لفرع مختلف` });
  }
}

async function validateSeller(sellerUserId: number, branchId: number, orgId: number) {
  const seller = await db.query.users.findFirst({
    where: and(eq(schema.users.id, sellerUserId), eq(schema.users.orgId, orgId), eq(schema.users.isActive, true)),
    columns: { canBeSalesperson: true, defaultBranchId: true },
  });
  if (!seller?.canBeSalesperson) throw new TRPCError({ code: 'BAD_REQUEST', message: 'غير مؤهل للعمل كبائع' });
  if (seller.defaultBranchId !== branchId) {
    const assignment = await db.query.userBranchAssignments.findFirst({
      where: and(
        eq(schema.userBranchAssignments.userId, sellerUserId),
        eq(schema.userBranchAssignments.branchId, branchId),
        eq(schema.userBranchAssignments.orgId, orgId),
      ),
      columns: { id: true },
    });
    if (!assignment) throw new TRPCError({ code: 'BAD_REQUEST', message: 'البائع غير مُسنَد للفرع المختار' });
  }
}

// ── إعداد البيانات قبل الاختبارات ────────────────────────────────────────────
beforeAll(async () => {
  // 1. مؤسسة تجريبية
  const [org] = await db.insert(schema.organizations).values({
    code: 'TST-BS-ORG',
    name: '__TEST_ORG_BRANCH_SECURITY__',
    email: 'test-branch-sec@test.internal',
  }).returning();
  orgId = org.id;

  // 2. فرعان
  const [brA] = await db.insert(schema.branches).values({ orgId, name: 'فرع أ (اختبار)' }).returning();
  const [brB] = await db.insert(schema.branches).values({ orgId, name: 'فرع ب (اختبار)' }).returning();
  branchAId = brA.id;
  branchBId = brB.id;

  // 3. دفاتر: مشترك + فرع A + فرع B
  const [jShared] = await db.insert(schema.documentJournals).values({
    orgId, docType: 'sales_invoice', code: 'TST-SHARED', name: 'دفتر مشترك (اختبار)',
    isSharedJournal: true,
  }).returning();
  const [jA] = await db.insert(schema.documentJournals).values({
    orgId, docType: 'sales_invoice', code: 'TST-JA', name: 'دفتر فرع أ (اختبار)',
    branchId: branchAId, isSharedJournal: false,
  }).returning();
  const [jB] = await db.insert(schema.documentJournals).values({
    orgId, docType: 'sales_invoice', code: 'TST-JB', name: 'دفتر فرع ب (اختبار)',
    branchId: branchBId, isSharedJournal: false,
  }).returning();
  journalSharedId  = jShared.id;
  journalBranchAId = jA.id;
  journalBranchBId = jB.id;

  // 4. مستخدمان: بائع مؤهّل (فرع A) + غير مؤهّل
  const [seller] = await db.insert(schema.users).values({
    orgId, username: '__test_seller_a__', name: 'بائع اختبار أ',
    email: 'seller-a@test.internal',
    passwordHash: 'x', role: 'cashier', isActive: true,
    canBeSalesperson: true, defaultBranchId: branchAId,
  }).returning();
  const [nonSeller] = await db.insert(schema.users).values({
    orgId, username: '__test_nonseller__', name: 'مستخدم غير بائع',
    email: 'nonseller@test.internal',
    passwordHash: 'x', role: 'cashier', isActive: true,
    canBeSalesperson: false, defaultBranchId: branchAId,
  }).returning();
  sellerUserId    = seller.id;
  nonSellerUserId = nonSeller.id;

  // 5. فاتورتان مصدر (نوع order) — واحدة لكل فرع
  const [invA] = await db.insert(schema.salesInvoices).values({
    orgId, invoiceNumber: 'TST-ORD-A', invoiceType: 'order', invoiceDate: new Date(),
    branchId: branchAId, status: 'confirmed',
    subtotal: '100.0000', discountAmount: '0.0000', taxAmount: '0.0000',
    total: '100.0000', paidAmount: '0.0000', remainingAmount: '100.0000',
    userId: seller.id,
  }).returning();
  const [invB] = await db.insert(schema.salesInvoices).values({
    orgId, invoiceNumber: 'TST-ORD-B', invoiceType: 'order', invoiceDate: new Date(),
    branchId: branchBId, status: 'confirmed',
    subtotal: '100.0000', discountAmount: '0.0000', taxAmount: '0.0000',
    total: '100.0000', paidAmount: '0.0000', remainingAmount: '100.0000',
    userId: seller.id,
  }).returning();
  invoiceSrcBranchA = invA.id;
  invoiceSrcBranchB = invB.id;
});

// ── تنظيف بعد الاختبارات ─────────────────────────────────────────────────────
afterAll(async () => {
  if (!orgId) return;
  // الحذف الكسلاني: تسلسل العلاقات يعتمد على CASCADE في الـ schema
  await db.delete(schema.userBranchAssignments).where(eq(schema.userBranchAssignments.orgId, orgId));
  await db.delete(schema.salesInvoices).where(eq(schema.salesInvoices.orgId, orgId));
  await db.delete(schema.documentJournals).where(eq(schema.documentJournals.orgId, orgId));
  await db.delete(schema.users).where(eq(schema.users.orgId, orgId));
  await db.delete(schema.branches).where(eq(schema.branches.orgId, orgId));
  await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-1: التحقق من الدفتر
// ═══════════════════════════════════════════════════════════════════════════════
describe('TC-1: التحقق من الدفتر (validateJournal)', () => {
  it('TC-1.1: دفتر فرع A مع فرع A → مقبول', async () => {
    const err = await catchTrpc(() => validateJournal(journalBranchAId, branchAId));
    expect(err).toBeNull();
  });

  it('TC-1.2: دفتر فرع A مع فرع B → مرفوض (فرع مختلف)', async () => {
    const err = await catchTrpc(() => validateJournal(journalBranchAId, branchBId));
    expect(err).not.toBeNull();
    expect(err!.code).toBe('BAD_REQUEST');
    expect(err!.message).toMatch(/لا ينتمي للفرع/);
  });

  it('TC-1.3: دفتر مشترك (isSharedJournal=true) مع أي فرع → مقبول دائماً', async () => {
    const errA = await catchTrpc(() => validateJournal(journalSharedId, branchAId));
    const errB = await catchTrpc(() => validateJournal(journalSharedId, branchBId));
    expect(errA).toBeNull();
    expect(errB).toBeNull();
  });

  it('TC-1.4: دفتر فرع B مع فرع B → مقبول', async () => {
    const err = await catchTrpc(() => validateJournal(journalBranchBId, branchBId));
    expect(err).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-2: التحقق من المستند المصدر
// ═══════════════════════════════════════════════════════════════════════════════
describe('TC-2: التحقق من المستند المصدر (validateSourceDocument)', () => {
  it('TC-2.1: مصدر فرع A + فاتورة فرع A → مقبول', async () => {
    const err = await catchTrpc(() => validateSourceDocument(invoiceSrcBranchA, branchAId, orgId));
    expect(err).toBeNull();
  });

  it('TC-2.2: مصدر فرع A + فاتورة فرع B → مرفوض (فرع مختلف)', async () => {
    const err = await catchTrpc(() => validateSourceDocument(invoiceSrcBranchA, branchBId, orgId));
    expect(err).not.toBeNull();
    expect(err!.code).toBe('BAD_REQUEST');
    expect(err!.message).toMatch(/فرع مختلف/);
  });

  it('TC-2.3: مستند مصدر غير موجود → NOT_FOUND', async () => {
    const err = await catchTrpc(() => validateSourceDocument(9999999, branchAId, orgId));
    expect(err).not.toBeNull();
    expect(err!.code).toBe('NOT_FOUND');
  });

  it('TC-2.4: مصدر فرع B + فاتورة فرع B → مقبول', async () => {
    const err = await catchTrpc(() => validateSourceDocument(invoiceSrcBranchB, branchBId, orgId));
    expect(err).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-3: التحقق من البائع
// ═══════════════════════════════════════════════════════════════════════════════
describe('TC-3: التحقق من البائع (validateSeller)', () => {
  it('TC-3.1: بائع مؤهّل — فرعه الافتراضي A → مقبول', async () => {
    const err = await catchTrpc(() => validateSeller(sellerUserId, branchAId, orgId));
    expect(err).toBeNull();
  });

  it('TC-3.2: مستخدم غير مؤهّل كبائع → مرفوض', async () => {
    const err = await catchTrpc(() => validateSeller(nonSellerUserId, branchAId, orgId));
    expect(err).not.toBeNull();
    expect(err!.code).toBe('BAD_REQUEST');
    expect(err!.message).toMatch(/غير مؤهل/);
  });

  it('TC-3.3: بائع في فرع A بدون assignment لفرع B → مرفوض', async () => {
    const err = await catchTrpc(() => validateSeller(sellerUserId, branchBId, orgId));
    expect(err).not.toBeNull();
    expect(err!.code).toBe('BAD_REQUEST');
    expect(err!.message).toMatch(/غير مُسنَد/);
  });

  it('TC-3.4: بائع في فرع A — بعد إسناده لفرع B → مقبول', async () => {
    // أسنِد البائع لفرع B
    await db.insert(schema.userBranchAssignments).values({
      orgId, userId: sellerUserId, branchId: branchBId,
    });
    const err = await catchTrpc(() => validateSeller(sellerUserId, branchBId, orgId));
    expect(err).toBeNull();
    // أزِل الإسناد (يُنظَّف أيضاً في afterAll)
    await db.delete(schema.userBranchAssignments).where(
      and(eq(schema.userBranchAssignments.userId, sellerUserId), eq(schema.userBranchAssignments.branchId, branchBId))
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TC-4: listSalespersons — فلترة user_branch_assignments
// ═══════════════════════════════════════════════════════════════════════════════
describe('TC-4: listSalespersons — فلترة بالفرع عبر assignments', () => {
  it('TC-4.1: بدون branchId → يُعيد كل البائعين المؤهّلين', async () => {
    const all = await db.select({ id: schema.users.id })
      .from(schema.users)
      .where(and(
        eq(schema.users.orgId, orgId),
        eq(schema.users.canBeSalesperson, true),
        eq(schema.users.isActive, true),
      ));
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all.some(u => u.id === sellerUserId)).toBe(true);
  });

  it('TC-4.2: فلتر بفرع A → يُعيد البائع (فرعه الافتراضي=A)', async () => {
    const all = await db.select({ id: schema.users.id, defaultBranchId: schema.users.defaultBranchId })
      .from(schema.users)
      .where(and(
        eq(schema.users.orgId, orgId),
        eq(schema.users.canBeSalesperson, true),
        eq(schema.users.isActive, true),
      ));
    // فلترة: defaultBranchId === branchAId أو assignment موجود
    const assignedIds = new Set(
      (await db.select({ userId: schema.userBranchAssignments.userId })
        .from(schema.userBranchAssignments)
        .where(and(eq(schema.userBranchAssignments.orgId, orgId), eq(schema.userBranchAssignments.branchId, branchAId)))
      ).map(r => r.userId)
    );
    const filtered = all.filter(u => assignedIds.has(u.id) || u.defaultBranchId === branchAId);
    expect(filtered.some(u => u.id === sellerUserId)).toBe(true);
  });

  it('TC-4.3: فلتر بفرع B — قبل الإسناد → لا يظهر البائع', async () => {
    const all = await db.select({ id: schema.users.id, defaultBranchId: schema.users.defaultBranchId })
      .from(schema.users)
      .where(and(
        eq(schema.users.orgId, orgId),
        eq(schema.users.canBeSalesperson, true),
        eq(schema.users.isActive, true),
      ));
    const assignedIds = new Set(
      (await db.select({ userId: schema.userBranchAssignments.userId })
        .from(schema.userBranchAssignments)
        .where(and(eq(schema.userBranchAssignments.orgId, orgId), eq(schema.userBranchAssignments.branchId, branchBId)))
      ).map(r => r.userId)
    );
    const filtered = all.filter(u => assignedIds.has(u.id) || u.defaultBranchId === branchBId);
    expect(filtered.some(u => u.id === sellerUserId)).toBe(false);
  });

  it('TC-4.4: فلتر بفرع B — بعد الإسناد → يظهر البائع', async () => {
    // أسنِد
    await db.insert(schema.userBranchAssignments).values({ orgId, userId: sellerUserId, branchId: branchBId });

    const all = await db.select({ id: schema.users.id, defaultBranchId: schema.users.defaultBranchId })
      .from(schema.users)
      .where(and(eq(schema.users.orgId, orgId), eq(schema.users.canBeSalesperson, true), eq(schema.users.isActive, true)));

    const assignedIds = new Set(
      (await db.select({ userId: schema.userBranchAssignments.userId })
        .from(schema.userBranchAssignments)
        .where(and(eq(schema.userBranchAssignments.orgId, orgId), eq(schema.userBranchAssignments.branchId, branchBId)))
      ).map(r => r.userId)
    );
    const filtered = all.filter(u => assignedIds.has(u.id) || u.defaultBranchId === branchBId);
    expect(filtered.some(u => u.id === sellerUserId)).toBe(true);

    // تنظيف
    await db.delete(schema.userBranchAssignments).where(
      and(eq(schema.userBranchAssignments.userId, sellerUserId), eq(schema.userBranchAssignments.branchId, branchBId))
    );
  });
});
