import { z } from 'zod';
import { and, eq, desc, asc, sql, ilike, or, gte, lte } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { rePurchases, rePurchaseStatements, users, organizations } from '../schema.js';

// ─── التحقق من الصلاحيات ─────────────────────────────────────────────────────────

function assertViewPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  const hasPerm = user.extraPermissions?.['hs_re_purchases'] === true;
  if (!isAdmin && !hasPerm) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية الوصول إلى البيان التفصيلي للمشتريات' });
  }
}

function assertAddPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user);
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_purchases_add'] !== true) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية إضافة فاتورة مشتريات' });
  }
}

function assertEditPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user);
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_purchases_edit'] !== true) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية تعديل فاتورة مشتريات' });
  }
}

function assertDeletePerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user);
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_purchases_delete'] !== true) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية حذف فاتورة مشتريات' });
  }
}

function assertPrintPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user);
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_purchases_print'] !== true) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية الطباعة' });
  }
}

function assertExportPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user);
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_purchases_export'] !== true) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية التصدير' });
  }
}

function assertImportPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user);
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_purchases_import'] !== true) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية الاستيراد' });
  }
}

function assertAttachPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  assertViewPerm(user);
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return;
  if (user.extraPermissions?.['hs_re_purchases_attach'] !== true) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية عرض المرفقات' });
  }
}

// ─── الحساب التلقائي ──────────────────────────────────────────────────────────

function recalcFromPreTax(preTax: number, taxRate: number) {
  const tax = +(preTax * (taxRate / 100)).toFixed(4);
  const total = +(preTax + tax).toFixed(4);
  return { preTax, tax, total };
}

function recalcFromTotal(total: number, taxRate: number) {
  const preTax = +(total / (1 + taxRate / 100)).toFixed(4);
  const tax = +(total - preTax).toFixed(4);
  return { preTax, tax, total };
}

function recalcFromTax(tax: number, taxRate: number) {
  const preTax = +(tax / (taxRate / 100)).toFixed(4);
  const total = +(preTax + tax).toFixed(4);
  return { preTax, tax, total };
}

// ─── Schemas ────────────────────────────────────────────────────────────────────

const invoiceInputSchema = z.object({
  supplierName:  z.string().min(1).max(255),
  supplierTaxId: z.string().max(50).nullable().optional(),
  invoiceDate:   z.string().min(1),
  invoiceNumber: z.string().min(1).max(100),
  preTaxValue:   z.number().min(0).default(0),
  taxRate:       z.number().min(0).max(100).default(15),
  taxAmount:     z.number().min(0).default(0),
  totalValue:    z.number().min(0).default(0),
  notes:         z.string().nullable().optional(),
  attachmentUrl: z.string().nullable().optional(),
});

const statementInputSchema = z.object({
  name:     z.string().min(1).max(255),
  project:  z.string().max(255).nullable().optional(),
  dateFrom: z.string().min(1),
  dateTo:   z.string().min(1),
  notes:    z.string().nullable().optional(),
});

// ─── Duplicate detection ──────────────────────────────────────────────────────────

async function findDuplicate(supplierTaxId: string | null | undefined, invoiceNumber: string, excludeId?: number) {
  if (!supplierTaxId || !invoiceNumber) return null;
  const conditions = [
    eq(rePurchases.supplierTaxId, supplierTaxId),
    eq(rePurchases.invoiceNumber, invoiceNumber),
  ];
  if (excludeId !== undefined) {
    conditions.push(sql`${rePurchases.id} <> ${excludeId}`);
  }
  const rows = await db.select({
    id: rePurchases.id,
    statementId: rePurchases.statementId,
    supplierName: rePurchases.supplierName,
    invoiceDate: rePurchases.invoiceDate,
    totalValue: rePurchases.totalValue,
  })
    .from(rePurchases)
    .where(and(...conditions))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Router ───────────────────────────────────────────────────────────────────────

export const rePurchasesRouter = router({

  // ════════════════════════════════════════════════════════════════════════════
  //  STATEMENTS
  // ════════════════════════════════════════════════════════════════════════════

  // ─── قائمة البيانات (مع الإجماليات) ─────────────────────────────────────────
  listStatements: protectedProcedure
    .input(z.object({
      search:   z.string().optional(),
      project:  z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo:   z.string().optional(),
      sortBy:   z.enum(['name', 'project', 'dateFrom', 'id']).optional(),
      sortDir:  z.enum(['asc', 'desc']).optional(),
      page:     z.number().default(1),
      limit:    z.number().default(200),
    }).optional())
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      const orgId = ctx.user.orgId;

      const rows = await db.execute(sql`
        SELECT
          s.id,
          s.name,
          s.project,
          s.date_from,
          s.date_to,
          s.notes,
          s.created_at,
          s.updated_at,
          u1.name AS created_by_name,
          COALESCE(COUNT(p.id), 0)   AS invoice_count,
          COALESCE(SUM(p.pre_tax_value), 0) AS pre_tax_total,
          COALESCE(SUM(p.tax_amount), 0)    AS tax_total,
          COALESCE(SUM(p.total_value), 0)   AS grand_total
        FROM re_purchase_statements s
        LEFT JOIN re_purchases p ON p.statement_id = s.id
        LEFT JOIN users u1 ON u1.id = s.created_by
        WHERE s.org_id = ${orgId}
        GROUP BY s.id, s.name, s.project, s.date_from, s.date_to, s.notes, s.created_at, s.updated_at, u1.name
        ORDER BY s.created_at DESC, s.id DESC
      `);

      let data = rows.rows as Array<Record<string, any>>;

      const q = input?.search?.trim();
      if (q) {
        const ql = q.toLowerCase();
        data = data.filter((r) =>
          (r.name ?? '').toLowerCase().includes(ql) ||
          (r.project ?? '').toLowerCase().includes(ql)
        );
      }

      if (input?.project) {
        const f = input.project.toLowerCase();
        data = data.filter(r => (r.project ?? '').toLowerCase().includes(f));
      }

      if (input?.dateFrom) {
        const from = new Date(input.dateFrom); from.setHours(0,0,0,0);
        data = data.filter(r => new Date(r.date_from) >= from);
      }
      if (input?.dateTo) {
        const to = new Date(input.dateTo); to.setHours(23,59,59,999);
        data = data.filter(r => new Date(r.date_to) <= to);
      }

      const sortBy = input?.sortBy ?? 'created_at';
      const sortDir = input?.sortDir ?? 'desc';
      const dir = sortDir === 'asc' ? 1 : -1;
      data.sort((a, b) => {
        const va = a[sortBy] ?? '';
        const vb = b[sortBy] ?? '';
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va).localeCompare(String(vb), 'ar') * dir;
      });

      const totals = {
        preTax: data.reduce((s, r) => s + Number(r.pre_tax_total ?? 0), 0),
        tax:    data.reduce((s, r) => s + Number(r.tax_total    ?? 0), 0),
        total:  data.reduce((s, r) => s + Number(r.grand_total  ?? 0), 0),
        count:  data.length,
      };

      const limit = input?.limit || 200;
      const page  = input?.page  || 1;
      const paginated = data.slice((page - 1) * limit, page * limit);

      return { rows: paginated, totals };
    }),

  // ─── جلب بيان واحد ──────────────────────────────────────────────────────────
  getStatement: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      const [row] = await db.select()
        .from(rePurchaseStatements)
        .where(and(
          eq(rePurchaseStatements.id, input.id),
          eq(rePurchaseStatements.orgId, ctx.user.orgId)
        ));
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'البيان غير موجود' });
      return row;
    }),

  // ─── إنشاء بيان جديد ───────────────────────────────────────────────────────
  createStatement: protectedProcedure
    .input(z.object({ data: statementInputSchema }))
    .mutation(async ({ ctx, input }) => {
      assertAddPerm(ctx.user);
      const [row] = await db.insert(rePurchaseStatements).values({
        orgId:     ctx.user.orgId,
        name:      input.data.name,
        project:   input.data.project ?? null,
        dateFrom:  new Date(input.data.dateFrom),
        dateTo:    new Date(input.data.dateTo),
        notes:     input.data.notes ?? null,
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      }).returning();
      return row;
    }),

  // ─── تعديل بيان ────────────────────────────────────────────────────────────
  updateStatement: protectedProcedure
    .input(z.object({ id: z.number(), data: statementInputSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      assertEditPerm(ctx.user);
      const [existing] = await db.select()
        .from(rePurchaseStatements)
        .where(and(
          eq(rePurchaseStatements.id, input.id),
          eq(rePurchaseStatements.orgId, ctx.user.orgId)
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'البيان غير موجود' });

      const updateData: Record<string, any> = { updatedBy: ctx.user.id, updatedAt: new Date() };
      if (input.data.name !== undefined) updateData.name = input.data.name;
      if (input.data.project !== undefined) updateData.project = input.data.project ?? null;
      if (input.data.dateFrom !== undefined) updateData.dateFrom = new Date(input.data.dateFrom);
      if (input.data.dateTo !== undefined) updateData.dateTo = new Date(input.data.dateTo);
      if (input.data.notes !== undefined) updateData.notes = input.data.notes ?? null;

      const [row] = await db.update(rePurchaseStatements)
        .set(updateData)
        .where(eq(rePurchaseStatements.id, input.id))
        .returning();
      return row;
    }),

  // ─── حذف بيان ──────────────────────────────────────────────────────────────
  deleteStatement: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertDeletePerm(ctx.user);
      const [existing] = await db.select()
        .from(rePurchaseStatements)
        .where(and(
          eq(rePurchaseStatements.id, input.id),
          eq(rePurchaseStatements.orgId, ctx.user.orgId)
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'البيان غير موجود' });
      await db.delete(rePurchaseStatements).where(eq(rePurchaseStatements.id, input.id));
      return { success: true };
    }),

  // ─── نسخ بيان (مع جميع فواتيره) ─────────────────────────────────────────────
  copyStatement: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertAddPerm(ctx.user);
      const orgId = ctx.user.orgId;
      const [src] = await db.select().from(rePurchaseStatements).where(
        and(eq(rePurchaseStatements.id, input.id), eq(rePurchaseStatements.orgId, orgId))
      );
      if (!src) throw new TRPCError({ code: 'NOT_FOUND', message: 'البيان غير موجود' });

      // Create copy
      const [newStmt] = await db.insert(rePurchaseStatements).values({
        orgId, name: `${src.name} (نسخ)`,
        project: src.project, dateFrom: src.dateFrom, dateTo: src.dateTo,
        notes: src.notes, createdBy: ctx.user.id, updatedBy: ctx.user.id,
      }).returning();

      // Copy invoices
      const invoices = await db.select().from(rePurchases).where(
        and(eq(rePurchases.statementId, src.id), eq(rePurchases.orgId, orgId))
      );
      for (const inv of invoices) {
        await db.insert(rePurchases).values({
          orgId, statementId: newStmt.id,
          supplierName: inv.supplierName, supplierTaxId: inv.supplierTaxId,
          invoiceDate: inv.invoiceDate, invoiceNumber: inv.invoiceNumber,
          preTaxValue: inv.preTaxValue, taxRate: inv.taxRate,
          taxAmount: inv.taxAmount, totalValue: inv.totalValue,
          notes: inv.notes, attachmentUrl: inv.attachmentUrl,
          createdBy: ctx.user.id, updatedBy: ctx.user.id,
        });
      }

      return newStmt;
    }),

  // ════════════════════════════════════════════════════════════════════════════
  //  INVOICES (WITHIN A STATEMENT)
  // ════════════════════════════════════════════════════════════════════════════

  // ─── قائمة فواتير بيان محدد ─────────────────────────────────────────────────
  listInvoices: protectedProcedure
    .input(z.object({
      statementId: z.number(),
      search:      z.string().optional(),
      supplierName: z.string().optional(),
      supplierTaxId: z.string().optional(),
      dateFrom:    z.string().optional(),
      dateTo:      z.string().optional(),
      sortBy:      z.enum(['supplierName', 'supplierTaxId', 'invoiceDate', 'id']).optional(),
      sortDir:     z.enum(['asc', 'desc']).optional(),
      page:        z.number().default(1),
      limit:       z.number().default(200),
    }))
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      const orgId = ctx.user.orgId;

      // Verify statement ownership
      const [stmt] = await db.select()
        .from(rePurchaseStatements)
        .where(and(
          eq(rePurchaseStatements.id, input.statementId),
          eq(rePurchaseStatements.orgId, orgId)
        ));
      if (!stmt) throw new TRPCError({ code: 'NOT_FOUND', message: 'البيان غير موجود' });

      const rows = await db.execute(sql`
        SELECT
          p.id,
          p.statement_id,
          p.supplier_name,
          p.supplier_tax_id,
          p.invoice_date,
          p.invoice_number,
          p.pre_tax_value,
          p.tax_rate,
          p.tax_amount,
          p.total_value,
          p.notes,
          p.attachment_url,
          p.created_at,
          p.updated_at,
          u1.name AS created_by_name,
          u2.name AS updated_by_name
        FROM re_purchases p
        LEFT JOIN users u1 ON u1.id = p.created_by
        LEFT JOIN users u2 ON u2.id = p.updated_by
        WHERE p.org_id = ${orgId}
          AND p.statement_id = ${input.statementId}
        ORDER BY p.invoice_date DESC, p.id DESC
      `);

      let data = rows.rows as Array<Record<string, any>>;

      const q = input.search?.trim();
      if (q) {
        const ql = q.toLowerCase();
        data = data.filter((r) =>
          (r.supplier_name ?? '').toLowerCase().includes(ql) ||
          (r.invoice_number ?? '').toLowerCase().includes(ql) ||
          (r.supplier_tax_id ?? '').toLowerCase().includes(ql)
        );
      }

      if (input.supplierName) {
        const f = input.supplierName.toLowerCase();
        data = data.filter(r => (r.supplier_name ?? '').toLowerCase().includes(f));
      }
      if (input.supplierTaxId) {
        data = data.filter(r => (r.supplier_tax_id ?? '').includes(input.supplierTaxId));
      }
      if (input.dateFrom) {
        const from = new Date(input.dateFrom); from.setHours(0,0,0,0);
        data = data.filter(r => new Date(r.invoice_date) >= from);
      }
      if (input.dateTo) {
        const to = new Date(input.dateTo); to.setHours(23,59,59,999);
        data = data.filter(r => new Date(r.invoice_date) <= to);
      }

      const sortBy = input.sortBy ?? 'invoiceDate';
      const sortDir = input.sortDir ?? 'desc';
      const dir = sortDir === 'asc' ? 1 : -1;
      data.sort((a, b) => {
        const va = a[sortBy] ?? '';
        const vb = b[sortBy] ?? '';
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va).localeCompare(String(vb), 'ar') * dir;
      });

      const totals = {
        preTax: data.reduce((s, r) => s + Number(r.pre_tax_value  ?? 0), 0),
        tax:    data.reduce((s, r) => s + Number(r.tax_amount     ?? 0), 0),
        total:  data.reduce((s, r) => s + Number(r.total_value    ?? 0), 0),
        count:  data.length,
      };

      const limit = input.limit || 200;
      const page  = input.page  || 1;
      const paginated = data.slice((page - 1) * limit, page * limit);

      return { rows: paginated, totals, statement: stmt };
    }),

  // ─── جلب فاتورة واحدة ─────────────────────────────────────────────────────
  getInvoice: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      const [row] = await db.select()
        .from(rePurchases)
        .where(and(
          eq(rePurchases.id, input.id),
          eq(rePurchases.orgId, ctx.user.orgId)
        ));
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'الفاتورة غير موجودة' });
      return row;
    }),

  // ─── اكتشاف المكرر ─────────────────────────────────────────────────────────
  checkDuplicate: protectedProcedure
    .input(z.object({
      supplierTaxId: z.string().max(50),
      invoiceNumber: z.string().max(100),
      excludeId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);
      const dup = await findDuplicate(input.supplierTaxId, input.invoiceNumber, input.excludeId);
      if (!dup) return null;
      let stmtName: string | null = null;
      if (dup.statementId) {
        const [s] = await db.select({ name: rePurchaseStatements.name })
          .from(rePurchaseStatements)
          .where(eq(rePurchaseStatements.id, dup.statementId));
        stmtName = s?.name ?? null;
      }
      return {
        id: dup.id,
        statementId: dup.statementId,
        statementName: stmtName,
        supplierName: dup.supplierName,
        invoiceDate: dup.invoiceDate,
        totalValue: dup.totalValue,
      };
    }),

  // ─── إضافة فاتورة ──────────────────────────────────────────────────────────
  createInvoice: protectedProcedure
    .input(z.object({
      statementId:    z.number(),
      data:           invoiceInputSchema,
      allowDuplicate: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAddPerm(ctx.user);
      const { data, allowDuplicate } = input;

      // Verify statement ownership
      const [stmt] = await db.select()
        .from(rePurchaseStatements)
        .where(and(
          eq(rePurchaseStatements.id, input.statementId),
          eq(rePurchaseStatements.orgId, ctx.user.orgId)
        ));
      if (!stmt) throw new TRPCError({ code: 'NOT_FOUND', message: 'البيان غير موجود' });

      // Duplicate check across ALL organizations
      if (data.supplierTaxId && !allowDuplicate) {
        const dup = await findDuplicate(data.supplierTaxId, data.invoiceNumber);
        if (dup) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `تنبيه: توجد فاتورة مسجلة سابقاً لنفس المورد بنفس رقم الفاتورة.`,
          });
        }
      }

      const calc = recalcFromPreTax(data.preTaxValue, data.taxRate);

      const [row] = await db.insert(rePurchases).values({
        orgId:         ctx.user.orgId,
        statementId:   input.statementId,
        supplierName:  data.supplierName,
        supplierTaxId: data.supplierTaxId ?? null,
        invoiceDate:   new Date(data.invoiceDate),
        invoiceNumber: data.invoiceNumber,
        preTaxValue:   String(calc.preTax),
        taxRate:       String(data.taxRate),
        taxAmount:     String(calc.tax),
        totalValue:    String(calc.total),
        notes:         data.notes ?? null,
        attachmentUrl: data.attachmentUrl ?? null,
        createdBy:     ctx.user.id,
        updatedBy:     ctx.user.id,
      }).returning();

      return row;
    }),

  // ─── إضافة فواتير بالجملة (للجدول المباشر) ─────────────────────────────────
  bulkCreateInvoices: protectedProcedure
    .input(z.object({
      statementId: z.number(),
      invoices:    z.array(invoiceInputSchema.extend({
        allowDuplicate: z.boolean().default(false),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAddPerm(ctx.user);

      const [stmt] = await db.select()
        .from(rePurchaseStatements)
        .where(and(
          eq(rePurchaseStatements.id, input.statementId),
          eq(rePurchaseStatements.orgId, ctx.user.orgId)
        ));
      if (!stmt) throw new TRPCError({ code: 'NOT_FOUND', message: 'البيان غير موجود' });

      const results: any[] = [];
      const errors: string[] = [];

      for (const inv of input.invoices) {
        try {
          if (inv.supplierTaxId && !inv.allowDuplicate) {
            const dup = await findDuplicate(inv.supplierTaxId, inv.invoiceNumber);
            if (dup) {
              errors.push(`فاتورة مكررة: ${inv.invoiceNumber} — الرقم الضريبي ${inv.supplierTaxId}`);
              continue;
            }
          }
          const calc = recalcFromPreTax(inv.preTaxValue, inv.taxRate);
          const [row] = await db.insert(rePurchases).values({
            orgId:         ctx.user.orgId,
            statementId:   input.statementId,
            supplierName:  inv.supplierName,
            supplierTaxId: inv.supplierTaxId ?? null,
            invoiceDate:   new Date(inv.invoiceDate),
            invoiceNumber: inv.invoiceNumber,
            preTaxValue:   String(calc.preTax),
            taxRate:       String(inv.taxRate),
            taxAmount:     String(calc.tax),
            totalValue:    String(calc.total),
            notes:         inv.notes ?? null,
            attachmentUrl: inv.attachmentUrl ?? null,
            createdBy:     ctx.user.id,
            updatedBy:     ctx.user.id,
          }).returning();
          results.push(row);
        } catch (e: any) {
          errors.push(inv.invoiceNumber + ': ' + (e.message ?? 'خطأ غير معروف'));
        }
      }

      return { results, errors, successCount: results.length, errorCount: errors.length };
    }),

  // ─── تعديل فاتورة ───────────────────────────────────────────────────────────
  updateInvoice: protectedProcedure
    .input(z.object({
      id: z.number(),
      data: invoiceInputSchema,
      allowDuplicate: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      assertEditPerm(ctx.user);
      const { data, allowDuplicate } = input;

      const [existing] = await db.select()
        .from(rePurchases)
        .where(and(
          eq(rePurchases.id, input.id),
          eq(rePurchases.orgId, ctx.user.orgId)
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'الفاتورة غير موجودة' });

      if (data.supplierTaxId && !allowDuplicate) {
        const dup = await findDuplicate(data.supplierTaxId, data.invoiceNumber, input.id);
        if (dup) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `تنبيه: توجد فاتورة مسجلة سابقاً لنفس المورد بنفس رقم الفاتورة.`,
          });
        }
      }

      const calc = recalcFromPreTax(data.preTaxValue, data.taxRate);

      const [row] = await db.update(rePurchases)
        .set({
          supplierName:  data.supplierName,
          supplierTaxId: data.supplierTaxId ?? null,
          invoiceDate:   new Date(data.invoiceDate),
          invoiceNumber: data.invoiceNumber,
          preTaxValue:   String(calc.preTax),
          taxRate:       String(data.taxRate),
          taxAmount:     String(calc.tax),
          totalValue:    String(calc.total),
          notes:         data.notes ?? null,
          attachmentUrl: data.attachmentUrl ?? null,
          updatedBy:     ctx.user.id,
          updatedAt:     new Date(),
        })
        .where(eq(rePurchases.id, input.id))
        .returning();

      return row;
    }),

  // ─── حذف فاتورة ────────────────────────────────────────────────────────────
  deleteInvoice: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertDeletePerm(ctx.user);
      const [existing] = await db.select()
        .from(rePurchases)
        .where(and(
          eq(rePurchases.id, input.id),
          eq(rePurchases.orgId, ctx.user.orgId)
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'الفاتورة غير موجودة' });
      await db.delete(rePurchases).where(eq(rePurchases.id, input.id));
      return { success: true };
    }),
});
