import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { organizations, salesInvoices, zatcaLogs } from '../schema.js';
import { eq, and, desc, count, sql } from 'drizzle-orm';

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const ZatcaConfigSchema = z.object({
  enabled:          z.boolean().default(false),
  environment:      z.enum(['sandbox', 'production']).default('sandbox'),
  vatNumber:        z.string().default(''),
  businessName:     z.string().default(''),
  businessNameEn:   z.string().default(''),
  crNumber:         z.string().default(''),
  buildingNumber:   z.string().default(''),
  streetName:       z.string().default(''),
  district:         z.string().default(''),
  city:             z.string().default(''),
  postalCode:       z.string().default(''),
  countryCode:      z.string().default('SA'),
  sellerType:       z.enum(['B2B', 'B2C', 'both']).default('both'),
  autoSubmit:       z.boolean().default(false),
  submitOnPost:     z.boolean().default(true),
  csid:             z.string().default(''),
  secretKey:        z.string().default(''),
  apiBaseUrl:       z.string().default('https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal'),
  apiVersion:       z.string().default('V2'),
  onboardingStep:   z.number().default(0),
  lastOnboardedAt:  z.string().nullable().default(null),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const zatcaRouter = router({

  // ── إعدادات ZATCA للمنشأة ─────────────────────────────────────────────────
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, ctx.orgId),
      columns: { zatcaConfig: true },
    });
    const cfg = (org?.zatcaConfig ?? {}) as Record<string, unknown>;
    return ZatcaConfigSchema.parse(cfg);
  }),

  saveConfig: protectedProcedure
    .input(ZatcaConfigSchema)
    .mutation(async ({ ctx, input }) => {
      await db.update(organizations)
        .set({ zatcaConfig: input as any, updatedAt: new Date() })
        .where(eq(organizations.id, ctx.orgId));

      await db.insert(zatcaLogs).values({
        orgId:      ctx.orgId,
        eventType:  'config_update',
        status:     'success',
        environment: input.environment,
        requestBody: JSON.stringify({ action: 'config_update', environment: input.environment }),
      });

      return { ok: true };
    }),

  // ── بيانات ZATCA لفاتورة معينة ────────────────────────────────────────────
  getInvoiceZatca: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const inv = await db.query.salesInvoices.findFirst({
        where: and(
          eq(salesInvoices.id, input.invoiceId),
          eq(salesInvoices.orgId, ctx.orgId),
        ),
        columns: {
          id: true,
          invoiceNumber: true,
          zatcaUuid: true,
          zatcaHash: true,
          zatcaQrCode: true,
          zatcaXml: true,
          zatcaStatus: true,
          zatcaClearedAt: true,
          zatcaResponse: true,
          zatcaInvoiceCounter: true,
          zatcaPih: true,
        },
      });
      if (!inv) throw new Error('Invoice not found');
      return inv;
    }),

  // ── إرسال فاتورة للهيئة (محاكاة) ─────────────────────────────────────────
  submitInvoice: protectedProcedure
    .input(z.object({
      invoiceId:   z.number(),
      invoiceType: z.enum(['standard', 'simplified']).default('simplified'),
      forceResend: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const inv = await db.query.salesInvoices.findFirst({
        where: and(
          eq(salesInvoices.id, input.invoiceId),
          eq(salesInvoices.orgId, ctx.orgId),
        ),
      });
      if (!inv) throw new Error('Invoice not found');

      if (inv.zatcaStatus === 'cleared' && !input.forceResend) {
        return { ok: false, message: 'الفاتورة مُخلَّصة بالفعل لدى هيئة الزكاة' };
      }

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.orgId),
        columns: { zatcaConfig: true },
      });
      const cfg = (org?.zatcaConfig ?? {}) as any;

      if (!cfg?.enabled) {
        return { ok: false, message: 'منظومة ZATCA غير مُفعَّلة — يرجى إعداد التكامل أولاً' };
      }

      // توليد UUID للفاتورة إن لم يكن موجوداً
      const uuid = inv.zatcaUuid ?? crypto.randomUUID();

      // في بيئة الإنتاج الحقيقية هنا يتم إرسال الفاتورة لـ API الهيئة
      // حالياً نحاكي الاستجابة
      const environment = cfg.environment ?? 'sandbox';
      const mockSuccess  = environment === 'sandbox';
      const mockStatus   = mockSuccess ? 'cleared' : 'pending';
      const mockResponse = {
        status:              mockSuccess ? 'CLEARED' : 'SUBMITTED',
        clearanceStatus:     mockSuccess ? 'CLEARED' : 'NOT_CLEARED',
        reportingStatus:     mockSuccess ? 'REPORTED' : 'NOT_REPORTED',
        invoiceHash:         uuid,
        timestamp:           new Date().toISOString(),
        warnings:            [],
        errors:              [],
      };

      await db.update(salesInvoices).set({
        zatcaUuid:      uuid,
        zatcaStatus:    mockStatus,
        zatcaClearedAt: mockSuccess ? new Date() : null,
        zatcaResponse:  mockResponse as any,
        updatedAt:      new Date(),
      }).where(eq(salesInvoices.id, input.invoiceId));

      await db.insert(zatcaLogs).values({
        orgId:         ctx.orgId,
        invoiceId:     input.invoiceId,
        invoiceNumber: inv.invoiceNumber,
        eventType:     input.forceResend ? 'resend' : 'submit',
        status:        mockStatus,
        environment,
        requestBody:   JSON.stringify({ invoiceId: input.invoiceId, invoiceType: input.invoiceType }),
        responseBody:  JSON.stringify(mockResponse),
      });

      return {
        ok:          true,
        status:      mockStatus,
        uuid,
        environment,
        response:    mockResponse,
        message:     mockSuccess
          ? 'تم التخليص بنجاح لدى هيئة الزكاة (بيئة الاختبار)'
          : 'جارٍ المعالجة — تحقق من الحالة لاحقاً',
      };
    }),

  // ── تحديث حالة الفاتورة يدوياً ───────────────────────────────────────────
  updateInvoiceStatus: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
      status:    z.enum(['not_submitted', 'pending', 'cleared', 'reported', 'rejected', 'error']),
      notes:     z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.update(salesInvoices).set({
        zatcaStatus: input.status,
        updatedAt:   new Date(),
        ...(input.status === 'cleared' ? { zatcaClearedAt: new Date() } : {}),
      }).where(and(
        eq(salesInvoices.id, input.invoiceId),
        eq(salesInvoices.orgId, ctx.orgId),
      ));

      await db.insert(zatcaLogs).values({
        orgId:       ctx.orgId,
        invoiceId:   input.invoiceId,
        eventType:   'manual_status_update',
        status:      input.status,
        requestBody: JSON.stringify({ notes: input.notes }),
      });

      return { ok: true };
    }),

  // ── سجل العمليات ──────────────────────────────────────────────────────────
  getLogs: protectedProcedure
    .input(z.object({
      page:       z.number().default(1),
      limit:      z.number().default(50),
      invoiceId:  z.number().optional(),
      status:     z.string().optional(),
      eventType:  z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;

      const conditions = [eq(zatcaLogs.orgId, ctx.orgId)];
      if (input.invoiceId) conditions.push(eq(zatcaLogs.invoiceId, input.invoiceId));
      if (input.status)    conditions.push(eq(zatcaLogs.status, input.status));
      if (input.eventType) conditions.push(eq(zatcaLogs.eventType, input.eventType));

      const [rows, totalRows] = await Promise.all([
        db.select().from(zatcaLogs)
          .where(and(...conditions))
          .orderBy(desc(zatcaLogs.createdAt))
          .limit(input.limit)
          .offset(offset),
        db.select({ cnt: count() }).from(zatcaLogs)
          .where(and(...conditions)),
      ]);

      return {
        logs:  rows,
        total: totalRows[0]?.cnt ?? 0,
        page:  input.page,
        pages: Math.ceil((totalRows[0]?.cnt ?? 0) / input.limit),
      };
    }),

  // ── إحصائيات لوحة المتابعة ────────────────────────────────────────────────
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [total, cleared, pending, rejected, notSubmitted] = await Promise.all([
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.orgId), eq(salesInvoices.invoiceType, 'sale'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.orgId), eq(salesInvoices.zatcaStatus, 'cleared'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.orgId), eq(salesInvoices.zatcaStatus, 'pending'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.orgId), eq(salesInvoices.zatcaStatus, 'rejected'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(
          eq(salesInvoices.orgId, ctx.orgId),
          sql`${salesInvoices.zatcaStatus} IS NULL OR ${salesInvoices.zatcaStatus} = 'not_submitted'`,
        )),
    ]);

    return {
      totalInvoices:    total[0]?.cnt ?? 0,
      cleared:          cleared[0]?.cnt ?? 0,
      pending:          pending[0]?.cnt ?? 0,
      rejected:         rejected[0]?.cnt ?? 0,
      notSubmitted:     notSubmitted[0]?.cnt ?? 0,
    };
  }),

  // ── قائمة الفواتير مع حالة الهيئة ────────────────────────────────────────
  getInvoicesList: protectedProcedure
    .input(z.object({
      page:   z.number().default(1),
      limit:  z.number().default(30),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;

      const conditions = [
        eq(salesInvoices.orgId, ctx.orgId),
        eq(salesInvoices.invoiceType, 'sale'),
      ];
      if (input.status) {
        conditions.push(eq(salesInvoices.zatcaStatus, input.status));
      }

      const rows = await db.select({
        id:            salesInvoices.id,
        invoiceNumber: salesInvoices.invoiceNumber,
        invoiceDate:   salesInvoices.invoiceDate,
        customerName:  salesInvoices.customerName,
        total:         salesInvoices.total,
        zatcaStatus:   salesInvoices.zatcaStatus,
        zatcaUuid:     salesInvoices.zatcaUuid,
        zatcaClearedAt: salesInvoices.zatcaClearedAt,
        isPosted:      salesInvoices.isPosted,
      }).from(salesInvoices)
        .where(and(...conditions))
        .orderBy(desc(salesInvoices.invoiceDate))
        .limit(input.limit)
        .offset(offset);

      const totalRows = await db.select({ cnt: count() }).from(salesInvoices)
        .where(and(...conditions));

      return {
        invoices: rows,
        total:    totalRows[0]?.cnt ?? 0,
        page:     input.page,
        pages:    Math.ceil((totalRows[0]?.cnt ?? 0) / input.limit),
      };
    }),
});
