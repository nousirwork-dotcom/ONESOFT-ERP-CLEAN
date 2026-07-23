/**
 * reTrialBalance.ts -- ميزان المراجعة المبسط (Phase 3)
 * Simplified trial balance for non-accountants in Real Estate Developer module.
 */
import { z } from 'zod';
import { and, eq, desc, asc, sql, ilike, or, gte, lte, count, isNull } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import {
  reTrialBalances, reTbAccounts, reTbEntries, reTbTaxReturns,
  reTbPurchaseLinks, reTbAuditLog, reTbSettlements,
  reProjects, users, organizations,
} from '../schema.js';

// ─── Permissions ───────────────────────────────────────────────────────
function assertViewPerm(user: { role: string; extraPermissions?: Record<string,boolean>|null }) {
  const isAdmin = ['admin','superadmin'].includes(user.role);
  if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_trial_balance'] !== true && user.extraPermissions?.['help_services'] !== true) {
    throw new TRPCError({ code:'FORBIDDEN', message:'ليس لديك صلاحية الوصول لميزان المراجعة' });
  }
}
function assertAddPerm(user: { role: string; extraPermissions?: Record<string,boolean>|null }) {
  assertViewPerm(user); const isAdmin = ['admin','superadmin'].includes(user.role); if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_trial_balance_add'] !== true) throw new TRPCError({ code:'FORBIDDEN', message:'ليس لديك صلاحية الإضافة' });
}
function assertEditPerm(user: { role: string; extraPermissions?: Record<string,boolean>|null }) {
  assertViewPerm(user); const isAdmin = ['admin','superadmin'].includes(user.role); if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_trial_balance_edit'] !== true) throw new TRPCError({ code:'FORBIDDEN', message:'ليس لديك صلاحية التعديل' });
}
function assertDeletePerm(user: { role: string; extraPermissions?: Record<string,boolean>|null }) {
  assertViewPerm(user); const isAdmin = ['admin','superadmin'].includes(user.role); if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_trial_balance_delete'] !== true) throw new TRPCError({ code:'FORBIDDEN', message:'ليس لديك صلاحية الحذف' });
}
function assertExportPerm(user: { role: string; extraPermissions?: Record<string,boolean>|null }) {
  assertViewPerm(user); const isAdmin = ['admin','superadmin'].includes(user.role); if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_trial_balance_export'] !== true) throw new TRPCError({ code:'FORBIDDEN', message:'ليس لديك صلاحية التصدير' });
}
function assertChartPerm(user: { role: string; extraPermissions?: Record<string,boolean>|null }) {
  assertViewPerm(user); const isAdmin = ['admin','superadmin'].includes(user.role); if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_trial_balance_chart'] !== true) throw new TRPCError({ code:'FORBIDDEN', message:'ليس لديك صلاحية إدارة الدليل' });
}
function assertReviewPerm(user: { role: string; extraPermissions?: Record<string,boolean>|null }) {
  assertViewPerm(user); const isAdmin = ['admin','superadmin'].includes(user.role); if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_trial_balance_review'] !== true) throw new TRPCError({ code:'FORBIDDEN', message:'ليس لديك صلاحية المراجعة' });
}
function assertSettlementPerm(user: { role: string; extraPermissions?: Record<string,boolean>|null }) {
  assertViewPerm(user); const isAdmin = ['admin','superadmin'].includes(user.role); if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_trial_balance_settlement'] !== true) throw new TRPCError({ code:'FORBIDDEN', message:'ليس لديك صلاحية التسوية' });
}

// ─── Helpers ───────────────────────────────────────────────────────────
function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function calcEnding(entry: { openingDebit:string|number; openingCredit:string|number; movementDebit:string|number; movementCredit:string|number; endingDebit:string|number; endingCredit:string|number }): { endingDebit:number; endingCredit:number } {
  const od = toNum(entry.openingDebit);
  const oc = toNum(entry.openingCredit);
  const md = toNum(entry.movementDebit);
  const mc = toNum(entry.movementCredit);
  const net = od - oc + md - mc;
  if (net >= 0) return { endingDebit: +net.toFixed(2), endingCredit: 0 };
  return { endingDebit: 0, endingCredit: +(-net).toFixed(2) };
}

async function logAction(opts: {
  orgId: number; trialBalanceId: number; accountId?: number|null;
  action: string; fieldName?: string|null; oldValue?: string|null; newValue?: string|null;
  userId?: number|null; userName?: string|null;
}) {
  await db.insert(reTbAuditLog).values({
    orgId: opts.orgId,
    trialBalanceId: opts.trialBalanceId,
    accountId: opts.accountId ?? null,
    action: opts.action,
    fieldName: opts.fieldName ?? null,
    oldValue: opts.oldValue ?? null,
    newValue: opts.newValue ?? null,
    userId: opts.userId ?? null,
    userName: opts.userName ?? null,
  });
}

// ─── Standalone balance-sheet computation (no self-reference in router) ────────
async function computeBalanceSheet(trialBalanceId: number) {
  const accounts = await db.select().from(reTbAccounts)
    .where(eq(reTbAccounts.trialBalanceId, trialBalanceId))
    .orderBy(asc(reTbAccounts.sortOrder));
  const entries = await db.select().from(reTbEntries).where(eq(reTbEntries.trialBalanceId, trialBalanceId));
  const entryMap = new Map(entries.map(e => [e.accountId, e]));

  const parentIds = new Set<number>();
  for (const a of accounts) if (a.parentId) parentIds.add(a.parentId);

  const rows = accounts.map(a => {
    const e = entryMap.get(a.id);
    const hasChildren = parentIds.has(a.id);
    let aggEntry = null;
    if (hasChildren) {
      const children = accounts.filter(ca => ca.parentId === a.id);
      const od = children.reduce((sum, c) => sum + toNum(entryMap.get(c.id)?.openingDebit ?? 0), 0);
      const oc = children.reduce((sum, c) => sum + toNum(entryMap.get(c.id)?.openingCredit ?? 0), 0);
      const md = children.reduce((sum, c) => sum + toNum(entryMap.get(c.id)?.movementDebit ?? 0), 0);
      const mc = children.reduce((sum, c) => sum + toNum(entryMap.get(c.id)?.movementCredit ?? 0), 0);
      const net = od - oc + md - mc;
      aggEntry = {
        openingDebit: od.toFixed(2), openingCredit: oc.toFixed(2),
        movementDebit: md.toFixed(2), movementCredit: mc.toFixed(2),
        endingDebit: net >= 0 ? net.toFixed(2) : '0',
        endingCredit: net < 0 ? (-net).toFixed(2) : '0',
      } as any;
    }
    return { account: { ...a, hasChildren }, entry: hasChildren ? aggEntry : (e ?? null), isParent: hasChildren };
  });
  const totals = { openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0, endingDebit: 0, endingCredit: 0 };
  for (const r of rows) {
    totals.openingDebit  += toNum(r.entry?.openingDebit);
    totals.openingCredit += toNum(r.entry?.openingCredit);
    totals.movementDebit += toNum(r.entry?.movementDebit);
    totals.movementCredit += toNum(r.entry?.movementCredit);
    totals.endingDebit += toNum(r.entry?.endingDebit);
    totals.endingCredit += toNum(r.entry?.endingCredit);
  }
  const difference = +(totals.endingDebit - totals.endingCredit).toFixed(2);
  return { rows, totals, difference, status: difference === 0 ? 'balanced' : 'unbalanced' };
}

// Default simplified chart of accounts
function getDefaultAccounts(): Array<{
  code: string; name: string; category: string; nature: string; sortOrder: number; isSystem: boolean;
}> {
  return [
    // Assets
    { code:'1.1',   name:'النقدية',               category:'assets',      nature:'debit',  sortOrder:10, isSystem:true },
    { code:'1.2',   name:'البنوك',                category:'assets',      nature:'debit',  sortOrder:20, isSystem:true },
    { code:'1.3',   name:'العملاء',               category:'assets',      nature:'debit',  sortOrder:30, isSystem:true },
    { code:'1.4',   name:'الموردون/المقاولين',       category:'assets',      nature:'debit',  sortOrder:40, isSystem:true },
    { code:'1.5',   name:'المشاريع العقارية',       category:'assets',      nature:'debit',  sortOrder:50, isSystem:true },
    { code:'1.6',   name:'الرخص الإيجاري/المعدات',category:'assets',      nature:'debit',  sortOrder:60, isSystem:true },
    { code:'1.7',   name:'تأمينات العمول',            category:'assets',      nature:'debit',  sortOrder:70, isSystem:true },
    // Liabilities
    { code:'2.1',   name:'الموردون/المقاولين',       category:'liabilities',nature:'credit', sortOrder:110, isSystem:true },
    { code:'2.2',   name:'القروض/التسهيلات المالية', category:'liabilities',nature:'credit', sortOrder:120, isSystem:true },
    { code:'2.3',   name:'المتراكمات الرأسمالية',     category:'liabilities',nature:'credit', sortOrder:130, isSystem:true },
    // Equity
    { code:'3.1',   name:'رأس المال',              category:'equity',      nature:'credit', sortOrder:210, isSystem:true },
    { code:'3.2',   name:'حساب الجاري',            category:'equity',      nature:'credit', sortOrder:220, isSystem:true },
    { code:'3.3',   name:'حساب شريك/(شركاء)',       category:'equity',      nature:'credit', sortOrder:230, isSystem:true },
    { code:'3.4',   name:'الأرباح المحتجزة',            category:'equity',      nature:'credit', sortOrder:240, isSystem:true },
    { code:'3.5',   name:'ربح/خسارة الفترة',       category:'equity',      nature:'credit', sortOrder:250, isSystem:true },
    // Revenue
    { code:'4.1',   name:'إيرادات المبيعات/المشاريع', category:'revenue',     nature:'credit', sortOrder:310, isSystem:true },
    // Costs & Expenses
    { code:'5.1',   name:'تكاليف المشاريع/الإنشاء', category:'expenses',    nature:'debit',  sortOrder:410, isSystem:true },
    { code:'5.2',   name:'المصروفات التشغيلية',          category:'expenses',    nature:'debit',  sortOrder:420, isSystem:true },
    { code:'5.3',   name:'المصروفات الإدارية/التسويق',   category:'expenses',    nature:'debit',  sortOrder:430, isSystem:true },
    { code:'5.4',   name:'المصاريف/الرسوم البلدية',   category:'expenses',    nature:'debit',  sortOrder:440, isSystem:true },
    { code:'5.5',   name:'تكاليف التشغيل والتشغيل',     category:'expenses',    nature:'debit',  sortOrder:450, isSystem:true },
    { code:'5.6',   name:'المصروفات الأخرى',            category:'expenses',    nature:'debit',  sortOrder:460, isSystem:true },
    { code:'5.7',   name:'الإهلاك المؤجر',              category:'expenses',    nature:'debit',  sortOrder:470, isSystem:true },
    { code:'5.8',   name:'عمولات التعمير/المولدة',   category:'expenses',    nature:'debit',  sortOrder:480, isSystem:true },
  ];
}

// ─── Zod schemas ──────────────────────────────────────────────────────────
const tbInput = z.object({
  name:        z.string().min(1).max(255),
  periodLabel: z.string().max(100).nullable().optional(),
  fromDate:    z.string().nullable().optional(),
  toDate:      z.string().nullable().optional(),
  projectId:   z.number().nullable().optional(),
  scope:       z.enum(['org','project']).default('org'),
  notes:       z.string().nullable().optional(),
});
const accountInput = z.object({
  code:     z.string().min(1).max(50),
  name:     z.string().min(1).max(255),
  category: z.enum(['assets','liabilities','equity','revenue','expenses']),
  nature:   z.enum(['debit','credit']).default('debit'),
  sortOrder: z.number().default(0),
  parentId: z.number().nullable().optional(),
});
const entryInput = z.object({
  accountId:       z.number().int(),
  openingDebit:    z.number().min(0).default(0),
  openingCredit:   z.number().min(0).default(0),
  movementDebit:   z.number().min(0).default(0),
  movementCredit:  z.number().min(0).default(0),
  notes:           z.string().nullable().optional(),
});
const taxReturnInput = z.object({
  periodLabel:         z.string().max(100).nullable().optional(),
  purchasesPreTax:     z.number().default(0),
  purchaseReturns:     z.number().default(0),
  netPurchases:        z.number().default(0),
  deductibleTax:       z.number().default(0),
  openingTaxBalance:   z.number().default(0),
  actualRefund:        z.number().default(0),
  actualOffset:        z.number().default(0),
  refundStatus:        z.enum(['not_submitted','under_review','approved','refunded','offset']).default('not_submitted'),
  notes:               z.string().nullable().optional(),
});
const purchaseLinkInput = z.object({
  accountId: z.number().int(),
});
const settlementInput = z.object({
  accountId:     z.number().int(),
  difference:    z.number(),
  direction:     z.enum(['debit','credit']),
  prevBalanceDebit:  z.number().default(0),
  prevBalanceCredit: z.number().default(0),
  newBalanceDebit:   z.number().default(0),
  newBalanceCredit:  z.number().default(0),
  userConfirmed:     z.boolean().default(false),
  notes:             z.string().nullable().optional(),
});
const reviewInput = z.object({
  accountId:     z.number().int(),
  reviewStatus:  z.enum(['not_reviewed','reviewed','has_diff','needs_doc']),
});

// ─── Router ──────────────────────────────────────────────────────────────
export const reTrialBalanceRouter = router({

  // ─── Trial Balances CRUD ─────────────────────────────────────────
  listTrialBalances: protectedProcedure
    .input(z.object({
      q: z.string().optional(),
      scope: z.enum(['org','project']).optional(),
      status: z.string().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      const orgId = ctx.user.orgId ?? 0;
      const conditions: any[] = [eq(reTrialBalances.orgId, orgId)];
      const q = input?.q?.trim();
      if (q) conditions.push(or(
        ilike(reTrialBalances.name, `%${q}%`),
        ilike(reTrialBalances.periodLabel ?? '', `%${q}%`),
        ilike(reTrialBalances.notes ?? '', `%${q}%`),
      ));
      if (input?.scope) conditions.push(eq(reTrialBalances.scope, input.scope));
      if (input?.status) conditions.push(eq(reTrialBalances.status, input.status));
      if (input?.fromDate) conditions.push(gte(reTrialBalances.fromDate, new Date(input.fromDate)));
      if (input?.toDate) conditions.push(lte(reTrialBalances.toDate, new Date(input.toDate)));

      const total = await db.select({ count: count() }).from(reTrialBalances).where(and(...conditions)).then(r => Number(r[0]?.count ?? 0));
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const items = await db.select().from(reTrialBalances)
        .where(and(...conditions))
        .orderBy(desc(reTrialBalances.createdAt))
        .limit(pageSize).offset((page - 1) * pageSize);
      return { items, total, page, pageSize };
    }),

  getTrialBalance: protectedProcedure
    .input(z.number())
    .query(async ({ ctx, input: id }) => {
      assertViewPerm(ctx.user);
      const rows = await db.select().from(reTrialBalances).where(eq(reTrialBalances.id, id)).limit(1);
      return rows[0] ?? null;
    }),

  createTrialBalance: protectedProcedure
    .input(tbInput)
    .mutation(async ({ ctx, input }) => {
      assertAddPerm(ctx.user);
      const orgId = ctx.user.orgId ?? 0;
      const userId = ctx.user.id;
      const inserted = await db.insert(reTrialBalances).values({
        orgId, name: input.name, periodLabel: input.periodLabel ?? null,
        fromDate: input.fromDate ? new Date(input.fromDate) : null,
        toDate: input.toDate ? new Date(input.toDate) : null,
        projectId: input.projectId ?? null,
        scope: input.scope, notes: input.notes ?? null,
        createdBy: userId, updatedBy: userId,
      }).returning() as any[];
      const row = inserted[0];
      // Seed default accounts
      const defaults = getDefaultAccounts();
      for (const d of defaults) {
        await db.insert(reTbAccounts).values({
          orgId, trialBalanceId: row.id, code: d.code, name: d.name,
          category: d.category, nature: d.nature, sortOrder: d.sortOrder, isSystem: d.isSystem,
        });
      }
      // Seed matching entries
      const accounts = await db.select().from(reTbAccounts).where(eq(reTbAccounts.trialBalanceId, row.id));
      for (const a of accounts) {
        await db.insert(reTbEntries).values({ orgId, trialBalanceId: row.id, accountId: a.id, createdBy: userId, updatedBy: userId });
      }
      // Seed empty tax return
      await db.insert(reTbTaxReturns).values({ orgId, trialBalanceId: row.id, createdBy: userId, updatedBy: userId });
      await logAction({ orgId, trialBalanceId: row.id, action:'create', userId, userName: ctx.user.name ?? null });
      return row;
    }),

  updateTrialBalance: protectedProcedure
    .input(z.object({ id: z.number().int(), data: tbInput }))
    .mutation(async ({ ctx, input }) => {
      assertEditPerm(ctx.user);
      const userId = ctx.user.id;
      const [row] = await db.update(reTrialBalances).set({
        name: input.data.name,
        periodLabel: input.data.periodLabel ?? null,
        fromDate: input.data.fromDate ? new Date(input.data.fromDate) : null,
        toDate: input.data.toDate ? new Date(input.data.toDate) : null,
        projectId: input.data.projectId ?? null,
        scope: input.data.scope,
        notes: input.data.notes ?? null,
        updatedBy: userId,
        updatedAt: new Date(),
      }).where(eq(reTrialBalances.id, input.id)).returning();
      await logAction({
        orgId: ctx.user.orgId ?? 0, trialBalanceId: input.id, action:'update',
        userId, userName: ctx.user.name ?? null,
      });
      return row;
    }),

  deleteTrialBalance: protectedProcedure
    .input(z.number().int())
    .mutation(async ({ ctx, input: id }) => {
      assertDeletePerm(ctx.user);
      await db.delete(reTrialBalances).where(eq(reTrialBalances.id, id));
      return { ok: true };
    }),

  // ─── Accounts ───────────────────────────────────────────────────────────
  listAccounts: protectedProcedure
    .input(z.number().int())
    .query(async ({ ctx, input: trialBalanceId }) => {
      assertViewPerm(ctx.user);
      const rows = await db.select().from(reTbAccounts)
        .where(eq(reTbAccounts.trialBalanceId, trialBalanceId))
        .orderBy(asc(reTbAccounts.sortOrder), asc(reTbAccounts.id));
      return rows;
    }),

  createAccount: protectedProcedure
    .input(z.object({ trialBalanceId: z.number().int(), data: accountInput }))
    .mutation(async ({ ctx, input }) => {
      assertChartPerm(ctx.user);
      const orgId = ctx.user.orgId ?? 0;
      const inserted = await db.insert(reTbAccounts).values({
        orgId, trialBalanceId: input.trialBalanceId,
        code: input.data.code, name: input.data.name,
        category: input.data.category, nature: input.data.nature,
        sortOrder: input.data.sortOrder, parentId: input.data.parentId ?? null,
        isSystem: false,
      }).returning() as any[];
      const row = inserted[0];
      // Create empty entry
      await db.insert(reTbEntries).values({ orgId, trialBalanceId: input.trialBalanceId, accountId: row.id,
        createdBy: ctx.user.id, updatedBy: ctx.user.id });
      return row;
    }),

  updateAccount: protectedProcedure
    .input(z.object({ id: z.number().int(), data: accountInput.partial() }))
    .mutation(async ({ ctx, input }) => {
      assertChartPerm(ctx.user);
      const setObj: Record<string,any> = {};
      if (input.data.code !== undefined) setObj.code = input.data.code;
      if (input.data.name !== undefined) setObj.name = input.data.name;
      if (input.data.category !== undefined) setObj.category = input.data.category;
      if (input.data.nature !== undefined) setObj.nature = input.data.nature;
      if (input.data.sortOrder !== undefined) setObj.sortOrder = input.data.sortOrder;
      if (input.data.parentId !== undefined) setObj.parentId = input.data.parentId ?? null;
      setObj.updatedAt = new Date();
      const [row] = await db.update(reTbAccounts).set(setObj).where(eq(reTbAccounts.id, input.id)).returning();
      return row;
    }),

  deleteAccount: protectedProcedure
    .input(z.number().int())
    .mutation(async ({ ctx, input: id }) => {
      assertChartPerm(ctx.user);
      const acc = await db.select().from(reTbAccounts).where(eq(reTbAccounts.id, id)).limit(1);
      if (acc[0]?.isSystem) throw new TRPCError({ code:'BAD_REQUEST', message:'لا يمكن حذف الحساب المبني بالنظام' });
      await db.delete(reTbAccounts).where(eq(reTbAccounts.id, id));
      return { ok: true };
    }),

  reorderAccounts: protectedProcedure
    .input(z.object({ trialBalanceId: z.number().int(), ids: z.array(z.number().int()) }))
    .mutation(async ({ ctx, input }) => {
      assertChartPerm(ctx.user);
      for (let i = 0; i < input.ids.length; i++) {
        await db.update(reTbAccounts).set({ sortOrder: (i + 1) * 10 }).where(eq(reTbAccounts.id, input.ids[i]));
      }
      return { ok: true };
    }),

  resetDefaultAccounts: protectedProcedure
    .input(z.number().int())
    .mutation(async ({ ctx, input: trialBalanceId }) => {
      assertChartPerm(ctx.user);
      const orgId = ctx.user.orgId ?? 0;
      // Delete non-system accounts + entries + purchaseLinks + settlements
      const all = await db.select().from(reTbAccounts).where(eq(reTbAccounts.trialBalanceId, trialBalanceId));
      const nonSystemIds = all.filter(a => !a.isSystem).map(a => a.id);
      if (nonSystemIds.length > 0) {
        for (const aid of nonSystemIds) {
          await db.delete(reTbEntries).where(eq(reTbEntries.accountId, aid));
          await db.delete(reTbPurchaseLinks).where(eq(reTbPurchaseLinks.accountId, aid));
          await db.delete(reTbSettlements).where(eq(reTbSettlements.accountId, aid));
        }
        await db.delete(reTbAccounts).where(sql`${reTbAccounts.trialBalanceId} = ${trialBalanceId} AND ${reTbAccounts.isSystem} = false`);
      }
      // Clear entries for system accounts
      await db.update(reTbEntries).set({
        openingDebit: '0', openingCredit: '0', movementDebit: '0', movementCredit: '0',
        endingDebit: '0', endingCredit: '0', updatedBy: ctx.user.id, updatedAt: new Date(),
      }).where(eq(reTbEntries.trialBalanceId, trialBalanceId));
      // Reset tax return
      await db.update(reTbTaxReturns).set({
        purchasesPreTax:'0', purchaseReturns:'0', netPurchases:'0', deductibleTax:'0',
        openingTaxBalance:'0', actualRefund:'0', actualOffset:'0', refundStatus:'not_submitted', notes:'',
        updatedBy: ctx.user.id, updatedAt: new Date(),
      }).where(eq(reTbTaxReturns.trialBalanceId, trialBalanceId));
      await logAction({ orgId, trialBalanceId, action:'reset_accounts', userId: ctx.user.id, userName: ctx.user.name ?? null });
      return { ok: true };
    }),

  // ─── Entries (batch save) ───────────────────────────────────────────────────
  saveEntries: protectedProcedure
    .input(z.object({
      trialBalanceId: z.number().int(),
      entries: z.array(z.object({
        accountId: z.number().int(),
        openingDebit:   z.number().min(0).default(0),
        openingCredit:  z.number().min(0).default(0),
        movementDebit:  z.number().min(0).default(0),
        movementCredit: z.number().min(0).default(0),
        notes: z.string().nullable().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      assertEditPerm(ctx.user);
      const orgId = ctx.user.orgId ?? 0;
      const userId = ctx.user.id;
      const existing = await db.select().from(reTbEntries).where(eq(reTbEntries.trialBalanceId, input.trialBalanceId));
      const existingMap = new Map(existing.map(e => [e.accountId, e]));
      for (const e of input.entries) {
        const end = calcEnding({
          openingDebit: e.openingDebit, openingCredit: e.openingCredit,
          movementDebit: e.movementDebit, movementCredit: e.movementCredit,
          endingDebit: 0, endingCredit: 0,
        });
        const existingEntry = existingMap.get(e.accountId);
        if (existingEntry) {
          const oldVals = `${existingEntry.openingDebit}|${existingEntry.openingCredit}|${existingEntry.movementDebit}|${existingEntry.movementCredit}`;
          const newVals = `${e.openingDebit}|${e.openingCredit}|${e.movementDebit}|${e.movementCredit}`;
          if (oldVals !== newVals) {
            await db.update(reTbEntries).set({
              openingDebit: e.openingDebit.toFixed(2),
              openingCredit: e.openingCredit.toFixed(2),
              movementDebit: e.movementDebit.toFixed(2),
              movementCredit: e.movementCredit.toFixed(2),
              endingDebit: end.endingDebit.toFixed(2),
              endingCredit: end.endingCredit.toFixed(2),
              notes: e.notes ?? existingEntry.notes,
              updatedBy: userId,
              updatedAt: new Date(),
            }).where(eq(reTbEntries.id, existingEntry.id));
          }
        }
      }
      // Recalc status
      await recalcStatus(input.trialBalanceId);
      await logAction({ orgId, trialBalanceId: input.trialBalanceId, action:'update', userId, userName: ctx.user.name ?? null });
      return { ok: true };
    }),

  getEntries: protectedProcedure
    .input(z.number().int())
    .query(async ({ ctx, input: trialBalanceId }) => {
      assertViewPerm(ctx.user);
      const rows = await db.select().from(reTbEntries).where(eq(reTbEntries.trialBalanceId, trialBalanceId));
      return rows;
    }),

  // ─── Tax Return ──────────────────────────────────────────────────────────────
  getTaxReturn: protectedProcedure
    .input(z.number().int())
    .query(async ({ ctx, input: trialBalanceId }) => {
      assertViewPerm(ctx.user);
      const rows = await db.select().from(reTbTaxReturns).where(eq(reTbTaxReturns.trialBalanceId, trialBalanceId)).limit(1);
      return rows[0] ?? null;
    }),

  saveTaxReturn: protectedProcedure
    .input(z.object({ trialBalanceId: z.number().int(), data: taxReturnInput }))
    .mutation(async ({ ctx, input }) => {
      assertEditPerm(ctx.user);
      const userId = ctx.user.id;
      const existing = await db.select().from(reTbTaxReturns).where(eq(reTbTaxReturns.trialBalanceId, input.trialBalanceId)).limit(1);
      const setObj: Record<string,any> = {};
      if (input.data.periodLabel !== undefined) setObj.periodLabel = input.data.periodLabel ?? null;
      if (input.data.purchasesPreTax !== undefined) setObj.purchasesPreTax = input.data.purchasesPreTax.toFixed(2);
      if (input.data.purchaseReturns !== undefined) setObj.purchaseReturns = input.data.purchaseReturns.toFixed(2);
      if (input.data.netPurchases !== undefined) setObj.netPurchases = input.data.netPurchases.toFixed(2);
      if (input.data.deductibleTax !== undefined) setObj.deductibleTax = input.data.deductibleTax.toFixed(2);
      if (input.data.openingTaxBalance !== undefined) setObj.openingTaxBalance = input.data.openingTaxBalance.toFixed(2);
      if (input.data.actualRefund !== undefined) setObj.actualRefund = input.data.actualRefund.toFixed(2);
      if (input.data.actualOffset !== undefined) setObj.actualOffset = input.data.actualOffset.toFixed(2);
      if (input.data.refundStatus !== undefined) setObj.refundStatus = input.data.refundStatus;
      if (input.data.notes !== undefined) setObj.notes = input.data.notes ?? null;
      setObj.updatedBy = userId;
      setObj.updatedAt = new Date();
      if (existing[0]) {
        await db.update(reTbTaxReturns).set(setObj).where(eq(reTbTaxReturns.id, existing[0].id));
        return existing[0];
      } else {
        const [row] = await db.insert(reTbTaxReturns).values({
          orgId: ctx.user.orgId ?? 0, trialBalanceId: input.trialBalanceId,
          ...setObj, createdBy: userId, updatedBy: userId,
        }).returning();
        return row;
      }
    }),

  // ─── Purchase Links ──────────────────────────────────────────────────────────
  getPurchaseLinks: protectedProcedure
    .input(z.number().int())
    .query(async ({ ctx, input: trialBalanceId }) => {
      assertViewPerm(ctx.user);
      const rows = await db.select().from(reTbPurchaseLinks).where(eq(reTbPurchaseLinks.trialBalanceId, trialBalanceId));
      return rows;
    }),

  savePurchaseLinks: protectedProcedure
    .input(z.object({ trialBalanceId: z.number().int(), links: z.array(purchaseLinkInput) }))
    .mutation(async ({ ctx, input }) => {
      assertEditPerm(ctx.user);
      await db.delete(reTbPurchaseLinks).where(eq(reTbPurchaseLinks.trialBalanceId, input.trialBalanceId));
      const orgId = ctx.user.orgId ?? 0;
      for (const l of input.links) {
        await db.insert(reTbPurchaseLinks).values({ orgId, trialBalanceId: input.trialBalanceId, accountId: l.accountId });
      }
      return { ok: true };
    }),

  // ─── Audit Log ───────────────────────────────────────────────────────────────
  getAuditLog: protectedProcedure
    .input(z.number().int())
    .query(async ({ ctx, input: trialBalanceId }) => {
      assertViewPerm(ctx.user);
      const rows = await db.select().from(reTbAuditLog)
        .where(eq(reTbAuditLog.trialBalanceId, trialBalanceId))
        .orderBy(desc(reTbAuditLog.createdAt))
        .limit(200);
      return rows;
    }),

  // ─── Settlement ───────────────────────────────────────────────────────────
  getSettlement: protectedProcedure
    .input(z.number().int())
    .query(async ({ ctx, input: trialBalanceId }) => {
      assertViewPerm(ctx.user);
      const rows = await db.select().from(reTbSettlements).where(eq(reTbSettlements.trialBalanceId, trialBalanceId));
      return rows;
    }),

  saveSettlement: protectedProcedure
    .input(z.object({ trialBalanceId: z.number().int(), data: settlementInput }))
    .mutation(async ({ ctx, input }) => {
      assertSettlementPerm(ctx.user);
      const orgId = ctx.user.orgId ?? 0;
      const userId = ctx.user.id;
      const existing = await db.select().from(reTbSettlements)
        .where(and(eq(reTbSettlements.trialBalanceId, input.trialBalanceId), eq(reTbSettlements.accountId, input.data.accountId)))
        .limit(1);
      const s = input.data;
      if (existing[0]) {
        await db.update(reTbSettlements).set({
          difference: s.difference.toFixed(2),
          direction: s.direction,
          previousBalanceDebit: s.prevBalanceDebit.toFixed(2),
          previousBalanceCredit: s.prevBalanceCredit.toFixed(2),
          newBalanceDebit: s.newBalanceDebit.toFixed(2),
          newBalanceCredit: s.newBalanceCredit.toFixed(2),
          userConfirmed: s.userConfirmed,
          confirmedAt: s.userConfirmed ? new Date() : null,
          notes: s.notes ?? null,
          createdBy: userId,
        }).where(eq(reTbSettlements.id, existing[0].id));
      } else {
        await db.insert(reTbSettlements).values({
          orgId, trialBalanceId: input.trialBalanceId,
          accountId: s.accountId,
          difference: s.difference.toFixed(2),
          direction: s.direction,
          previousBalanceDebit: s.prevBalanceDebit.toFixed(2),
          previousBalanceCredit: s.prevBalanceCredit.toFixed(2),
          newBalanceDebit: s.newBalanceDebit.toFixed(2),
          newBalanceCredit: s.newBalanceCredit.toFixed(2),
          userConfirmed: s.userConfirmed,
          confirmedAt: s.userConfirmed ? new Date() : null,
          notes: s.notes ?? null,
          createdBy: userId,
        });
      }
      return { ok: true };
    }),

  // ─── Review Panel ──────────────────────────────────────────────────────────────
  getReviewPanel: protectedProcedure
    .input(z.number().int())
    .query(async ({ ctx, input: trialBalanceId }) => {
      assertViewPerm(ctx.user);
      const accounts = await db.select().from(reTbAccounts)
        .where(eq(reTbAccounts.trialBalanceId, trialBalanceId))
        .orderBy(asc(reTbAccounts.sortOrder));
      const entries = await db.select().from(reTbEntries).where(eq(reTbEntries.trialBalanceId, trialBalanceId));
      const entryMap = new Map(entries.map(e => [e.accountId, e]));
      const items = accounts.map(a => {
        const e = entryMap.get(a.id);
        const od = toNum(e?.openingDebit); const oc = toNum(e?.openingCredit);
        const md = toNum(e?.movementDebit); const mc = toNum(e?.movementCredit);
        const ed = toNum(e?.endingDebit); const ec = toNum(e?.endingCredit);
        const hasActivity = od > 0 || oc > 0 || md > 0 || mc > 0 || ed > 0 || ec > 0;
        return {
          account: a,
          entry: e ?? null,
          reviewStatus: a.reviewStatus,
          hasActivity,
          balanceText: ed > 0 ? `${ed.toFixed(2)} د.` : ec > 0 ? `${ec.toFixed(2)} ج.` : '0',
        };
      });
      return items;
    }),

  updateReview: protectedProcedure
    .input(z.object({ trialBalanceId: z.number().int(), reviews: z.array(reviewInput) }))
    .mutation(async ({ ctx, input }) => {
      assertReviewPerm(ctx.user);
      for (const r of input.reviews) {
        await db.update(reTbAccounts).set({ reviewStatus: r.reviewStatus }).where(eq(reTbAccounts.id, r.accountId));
      }
      return { ok: true };
    }),

  // ─── Computed Balance Sheet ─────────────────────────────────────────────────
  getBalanceSheet: protectedProcedure
    .input(z.number().int())
    .query(async ({ ctx, input: trialBalanceId }) => {
      assertViewPerm(ctx.user);
      return computeBalanceSheet(trialBalanceId);
    }),

  // ─── Export (raw data for print/Excel/PDF) ───────────────────────────────────
  exportTrialBalance: protectedProcedure
    .input(z.object({
      trialBalanceId: z.number().int(),
      format: z.enum(['json','csv']).default('json'),
    }))
    .query(async ({ ctx, input }) => {
      assertExportPerm(ctx.user);
      const bs = await computeBalanceSheet(input.trialBalanceId);
      const tb = await db.select().from(reTrialBalances).where(eq(reTrialBalances.id, input.trialBalanceId)).limit(1).then(r => r[0]);
      const tax = await db.select().from(reTbTaxReturns).where(eq(reTbTaxReturns.trialBalanceId, input.trialBalanceId)).limit(1).then(r => r[0] ?? null);
      const result = {
        trialBalance: tb,
        balanceSheet: bs,
        taxReturn: tax,
        generatedAt: new Date().toISOString(),
      };
      if (input.format === 'csv') {
        let csv = 'الكود,الحساب,التصنيف,رأسي/دائن,رأس المبالاغ,دائن المبالاغ,حركة د.,حركة ج.,رأس الإقفال,دائن الإقفال\n';
        for (const r of bs.rows) {
          const a = r.account; const e = r.entry;
          csv += `${a.code},${a.name},${a.category},${a.nature},${e?.openingDebit ?? 0},${e?.openingCredit ?? 0},${e?.movementDebit ?? 0},${e?.movementCredit ?? 0},${e?.endingDebit ?? 0},${e?.endingCredit ?? 0}\n`;
        }
        csv += `المجموع,,,,${bs.totals.openingDebit},${bs.totals.openingCredit},${bs.totals.movementDebit},${bs.totals.movementCredit},${bs.totals.endingDebit},${bs.totals.endingCredit}\n`;
        return { format: 'csv', data: csv, filename: `tb_${tb?.name || 'export'}.csv` };
      }
      return { format: 'json', data: result };
    }),

  // ─── Projects list (for selector) ────────────────────────────────────────────
  listProjects: protectedProcedure
    .query(async ({ ctx }) => {
      assertViewPerm(ctx.user);
      const orgId = ctx.user.orgId ?? 0;
      return db.select({ id: reProjects.id, code: reProjects.code, name: reProjects.name })
        .from(reProjects).where(eq(reProjects.orgId, orgId)).orderBy(asc(reProjects.name));
    }),
});

// ─── Recalculate trial balance status ─────────────────────────────────────────────────
async function recalcStatus(trialBalanceId: number) {
  const entries = await db.select().from(reTbEntries).where(eq(reTbEntries.trialBalanceId, trialBalanceId));
  let endDebit = 0, endCredit = 0;
  for (const e of entries) {
    endDebit += toNum(e.endingDebit);
    endCredit += toNum(e.endingCredit);
  }
  const diff = +(endDebit - endCredit).toFixed(2);
  const status = Math.abs(diff) < 0.01 ? 'balanced' : 'unbalanced';
  await db.update(reTrialBalances).set({ status }).where(eq(reTrialBalances.id, trialBalanceId));
}
