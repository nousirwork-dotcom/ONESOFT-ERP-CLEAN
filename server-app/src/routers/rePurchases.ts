import { z } from 'zod';
import { and, eq, desc, asc, sql, ilike, or, gte, lte } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { rePurchases, users, organizations } from '../schema.js';

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

// ─── Schemas ───────────────────────────────────────────────────────────────────────────────────

const purchaseInputSchema = z.object({
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

// ─── Duplicate detection ──────────────────────────────────────────────────────────────────────────────

async function findDuplicate(supplierTaxId: string | null | undefined, invoiceNumber: string, excludeId?: number) {
  if (!supplierTaxId || !invoiceNumber) return null;
  const conditions = [
    eq(rePurchases.supplierTaxId, supplierTaxId),
    eq(rePurchases.invoiceNumber, invoiceNumber),
  ];
  if (excludeId !== undefined) {
    conditions.push(sql`${rePurchases.id} <> ${excludeId}`);
  }
  const rows = await db.select()
    .from(rePurchases)
    .where(and(...conditions))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Router ───────────────────────────────────────────────────────────────────────────────────────────

export const rePurchasesRouter = router({

  // ─── قائمة فواتير المشتريات (مع الإجماليات) ──────────────────────────────
  list: protectedProcedure
    .input(z.object({
      search:        z.string().optional(),
      supplierName:  z.string().optional(),
      supplierTaxId: z.string().optional(),
      dateFrom:      z.string().optional(),
      dateTo:        z.string().optional(),
      sortBy:        z.enum(['supplierName', 'supplierTaxId', 'invoiceDate', 'id']).optional(),
      sortDir:       z.enum(['asc', 'desc']).optional(),
      page:          z.number().default(1),
      limit:         z.number().default(200),
    }).optional())
    .query(async ({ ctx, input }) => {
      assertViewPerm(ctx.user);

      const orgId = ctx.user.orgId;
      const rows = await db.execute(sql`
        SELECT
          p.id,
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
        ORDER BY p.invoice_date DESC, p.id DESC
      `);

      let data = rows.rows as Array<Record<string, any>>;

      // Search by name / invoice number / tax id
      const q = input?.search?.trim();
      if (q) {
        const ql = q.toLowerCase();
        data = data.filter((r) =>
          (r.supplier_name ?? '').toLowerCase().includes(ql) ||
          (r.invoice_number ?? '').toLowerCase().includes(ql) ||
          (r.supplier_tax_id ?? '').toLowerCase().includes(ql)
        );
      }

      // Filter by supplier name
      if (input?.supplierName) {
        const f = input.supplierName.toLowerCase();
        data = data.filter(r => (r.supplier_name ?? '').toLowerCase().includes(f));
      }

      // Filter by supplier tax id
      if (input?.supplierTaxId) {
        data = data.filter(r => (r.supplier_tax_id ?? '').includes(input.supplierTaxId!));
      }

      // Date range filter
      if (input?.dateFrom) {
        const from = new Date(input.dateFrom); from.setHours(0, 0, 0, 0);
        data = data.filter(r => new Date(r.invoice_date) >= from);
      }
      if (input?.dateTo) {
        const to = new Date(input.dateTo); to.setHours(23, 59, 59, 999);
        data = data.filter(r => new Date(r.invoice_date) <= to);
      }

      // Sorting
      const sortBy = input?.sortBy ?? 'invoiceDate';
      const sortDir = input?.sortDir ?? 'desc';
      const dir = sortDir === 'asc' ? 1 : -1;
      data.sort((a, b) => {
        const va = a[sortBy] ?? '';
        const vb = b[sortBy] ?? '';
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va).localeCompare(String(vb), 'ar') * dir;
      });

      // Totals before pagination
      const totals = {
        preTax:   data.reduce((s, r) => s + Number(r.pre_tax_value  ?? 0), 0),
        tax:      data.reduce((s, r) => s + Number(r.tax_amount     ?? 0), 0),
        total:    data.reduce((s, r) => s + Number(r.total_value    ?? 0), 0),
        count:    data.length,
      };

      // Pagination
      const limit = input?.limit || 200;
      const page  = input?.page  || 1;
      const paginated = data.slice((page - 1) * limit, page * limit);

      return { rows: paginated, totals };
    }),

  // ─── جلب فاتورة واحدة ─────────────────────────────────────────────────────────────────────────────────────
  get: protectedProcedure
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

  // ─── اكتشاف المكرر ───────────────────────────────────────────────────────────────────────────────────────────────
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
      return {
        id: dup.id,
        supplierName: dup.supplierName,
        invoiceDate: dup.invoiceDate,
        totalValue: dup.totalValue,
      };
    }),

  // ─── إضافة فاتورة ─────────────────────────────────────────────────────────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      data: purchaseInputSchema,
      allowDuplicate: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAddPerm(ctx.user);
      const { data, allowDuplicate } = input;

      // Duplicate check across ALL organizations
      if (data.supplierTaxId && !allowDuplicate) {
        const dup = await findDuplicate(data.supplierTaxId, data.invoiceNumber);
        if (dup) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `تنبيه: توجد فاتورة مسجلة سابقاً لنفس المورد بنفس رقم الفاتورة. المورد: ${dup.supplierName} | التاريخ: ${String(dup.invoiceDate).split('T')[0]} | القيمة: ${dup.totalValue}`,
          });
        }
      }

      // Recalculate from preTax to ensure consistency
      const calc = recalcFromPreTax(data.preTaxValue, data.taxRate);

      const [row] = await db.insert(rePurchases).values({
        orgId:         ctx.user.orgId,
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

  // ─── تعديل فاتورة ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      data: purchaseInputSchema,
      allowDuplicate: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      assertEditPerm(ctx.user);
      const { data, allowDuplicate } = input;

      // Verify ownership
      const [existing] = await db.select()
        .from(rePurchases)
        .where(and(
          eq(rePurchases.id, input.id),
          eq(rePurchases.orgId, ctx.user.orgId)
        ));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'الفاتورة غير موجودة' });

      // Duplicate check across ALL organizations
      if (data.supplierTaxId && !allowDuplicate) {
        const dup = await findDuplicate(data.supplierTaxId, data.invoiceNumber, input.id);
        if (dup) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `تنبيه: توجد فاتورة مسجلة سابقاً لنفس المورد بنفس رقم الفاتورة. المورد: ${dup.supplierName} | التاريخ: ${String(dup.invoiceDate).split('T')[0]} | القيمة: ${dup.totalValue}`,
          });
        }
      }

      // Recalculate from preTax to ensure consistency
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

  // ─── حذف فاتورة ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  delete: protectedProcedure
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
