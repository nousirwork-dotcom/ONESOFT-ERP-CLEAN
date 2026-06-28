import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db.js';
import { organizations, salesInvoices, zatcaLogs, users } from '../schema.js';
import { eq, and, desc, count, sql, gte, lte, like, or } from 'drizzle-orm';

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const ZatcaConfigSchema = z.object({
  enabled:             z.boolean().default(false),
  environment:         z.enum(['sandbox', 'production']).default('sandbox'),
  vatNumber:           z.string().default(''),
  businessName:        z.string().default(''),
  businessNameEn:      z.string().default(''),
  crNumber:            z.string().default(''),
  buildingNumber:      z.string().default(''),
  streetName:          z.string().default(''),
  district:            z.string().default(''),
  city:                z.string().default(''),
  postalCode:          z.string().default(''),
  countryCode:         z.string().default('SA'),
  sellerType:          z.enum(['B2B', 'B2C', 'both']).default('both'),
  autoSubmit:          z.boolean().default(false),
  submitOnPost:        z.boolean().default(true),
  // حقول حساسة — تعبّأ فقط بواسطة مسؤول الربط
  csid:                z.string().default(''),
  secretKey:           z.string().default(''),
  apiBaseUrl:          z.string().default('https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal'),
  apiVersion:          z.string().default('V2'),
  onboardingStep:      z.number().default(0),
  lastOnboardedAt:     z.string().nullable().default(null),
  // حالة الخدمة
  serviceActivatedAt:  z.string().nullable().default(null),
  serviceActivatedBy:  z.string().nullable().default(null),
  lastConfigUpdate:    z.string().nullable().default(null),
  lastConfigUpdateBy:  z.string().nullable().default(null),
  lastConnectionTest:  z.string().nullable().default(null),
  lastConnectionStatus: z.enum(['success', 'failed', 'unknown']).default('unknown'),
  // شهادة CSID
  certExpiryDate:      z.string().nullable().default(null),
  certSerialNumber:    z.string().nullable().default(null),
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
    const parsed = ZatcaConfigSchema.parse(cfg);
    // إخفاء المفاتيح الحساسة للمستخدم غير المسؤول
    const isAdmin = ctx.user.role === 'admin' || ctx.user.role === 'superadmin';
    if (!isAdmin) {
      parsed.secretKey = parsed.secretKey ? '••••••••••••••••' : '';
      parsed.apiBaseUrl = parsed.apiBaseUrl ? '(محجوب)' : '';
      parsed.csid = parsed.csid ? `${parsed.csid.slice(0, 8)}••••` : '';
    }
    return { ...parsed, isAdmin };
  }),

  saveConfig: adminProcedure
    .input(ZatcaConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();
      const userName = (ctx.user as any).name ?? (ctx.user as any).username ?? 'مسؤول';

      const existing = await db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.orgId),
        columns: { zatcaConfig: true },
      });
      const existingCfg = (existing?.zatcaConfig ?? {}) as any;

      const updated = {
        ...input,
        lastConfigUpdate:   now,
        lastConfigUpdateBy: userName,
        // إذا كانت المنظومة تُفعَّل لأول مرة
        serviceActivatedAt:  input.enabled && !existingCfg.enabled
          ? now
          : existingCfg.serviceActivatedAt ?? null,
        serviceActivatedBy: input.enabled && !existingCfg.enabled
          ? userName
          : existingCfg.serviceActivatedBy ?? null,
      };

      await db.update(organizations)
        .set({ zatcaConfig: updated as any, updatedAt: new Date() })
        .where(eq(organizations.id, ctx.orgId));

      await db.insert(zatcaLogs).values({
        orgId:      ctx.orgId,
        eventType:  'config_update',
        status:     'success',
        environment: input.environment,
        userId:     ctx.user.id,
        userName,
        requestBody: JSON.stringify({ action: 'config_update', environment: input.environment }),
      });

      return { ok: true };
    }),

  // ── اختبار الاتصال ────────────────────────────────────────────────────────
  testConnection: adminProcedure.mutation(async ({ ctx }) => {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, ctx.orgId),
      columns: { zatcaConfig: true },
    });
    const cfg = (org?.zatcaConfig ?? {}) as any;

    // محاكاة اختبار الاتصال
    const success = !!cfg.csid && !!cfg.secretKey;
    const now = new Date().toISOString();
    const userName = (ctx.user as any).name ?? (ctx.user as any).username ?? 'مسؤول';

    await db.update(organizations).set({
      zatcaConfig: {
        ...cfg,
        lastConnectionTest:   now,
        lastConnectionStatus: success ? 'success' : 'failed',
      } as any,
      updatedAt: new Date(),
    }).where(eq(organizations.id, ctx.orgId));

    await db.insert(zatcaLogs).values({
      orgId:       ctx.orgId,
      eventType:   'connection_test',
      status:      success ? 'success' : 'error',
      environment: cfg.environment ?? 'sandbox',
      userId:      ctx.user.id,
      userName,
      responseBody: JSON.stringify({ success, testedAt: now }),
      errorMessage: success ? null : 'CSID أو Secret Key غير مكتملين',
    });

    return { ok: success, message: success ? 'الاتصال بالهيئة ناجح' : 'فشل الاتصال — تحقق من بيانات CSID' };
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
          zatcaSubmittedAt: true,
          zatcaAttemptCount: true,
          zatcaRejectionReason: true,
        },
      });
      if (!inv) throw new Error('Invoice not found');
      return inv;
    }),

  // ── إرسال فاتورة للهيئة ───────────────────────────────────────────────────
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

      const uuid = inv.zatcaUuid ?? crypto.randomUUID();
      const environment = cfg.environment ?? 'sandbox';
      const mockSuccess  = environment === 'sandbox';
      const mockStatus   = mockSuccess ? 'cleared' : 'pending';
      const mockResponse = {
        status:          mockSuccess ? 'CLEARED' : 'SUBMITTED',
        clearanceStatus: mockSuccess ? 'CLEARED' : 'NOT_CLEARED',
        reportingStatus: mockSuccess ? 'REPORTED' : 'NOT_REPORTED',
        invoiceHash:     uuid,
        timestamp:       new Date().toISOString(),
        warnings:        [],
        errors:          [],
      };

      const newAttemptCount = (inv.zatcaAttemptCount ?? 0) + 1;
      const userName = (ctx.user as any).name ?? (ctx.user as any).username ?? 'مستخدم';

      await db.update(salesInvoices).set({
        zatcaUuid:            uuid,
        zatcaStatus:          mockStatus,
        zatcaClearedAt:       mockSuccess ? new Date() : null,
        zatcaResponse:        mockResponse as any,
        zatcaSubmittedAt:     inv.zatcaSubmittedAt ?? new Date(),
        zatcaAttemptCount:    newAttemptCount,
        zatcaRejectionReason: mockSuccess ? null : inv.zatcaRejectionReason,
        updatedAt:            new Date(),
      }).where(eq(salesInvoices.id, input.invoiceId));

      await db.insert(zatcaLogs).values({
        orgId:         ctx.orgId,
        invoiceId:     input.invoiceId,
        invoiceNumber: inv.invoiceNumber,
        eventType:     input.forceResend ? 'resend' : 'submit',
        status:        mockStatus,
        environment,
        userId:        ctx.user.id,
        userName,
        requestBody:   JSON.stringify({ invoiceId: input.invoiceId, invoiceType: input.invoiceType, attempt: newAttemptCount }),
        responseBody:  JSON.stringify(mockResponse),
      });

      return {
        ok:       true,
        status:   mockStatus,
        uuid,
        environment,
        response: mockResponse,
        message:  mockSuccess
          ? 'تم التخليص بنجاح لدى هيئة الزكاة (بيئة الاختبار)'
          : 'جارٍ المعالجة — تحقق من الحالة لاحقاً',
      };
    }),

  // ── تحديث حالة الفاتورة يدوياً ───────────────────────────────────────────
  updateInvoiceStatus: adminProcedure
    .input(z.object({
      invoiceId:        z.number(),
      status:           z.enum(['not_submitted', 'pending', 'cleared', 'reported', 'rejected', 'error']),
      rejectionReason:  z.string().optional(),
      notes:            z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userName = (ctx.user as any).name ?? (ctx.user as any).username ?? 'مسؤول';
      await db.update(salesInvoices).set({
        zatcaStatus:          input.status,
        zatcaRejectionReason: input.rejectionReason ?? null,
        updatedAt:            new Date(),
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
        userId:      ctx.user.id,
        userName,
        requestBody: JSON.stringify({ notes: input.notes, rejectionReason: input.rejectionReason }),
      });

      return { ok: true };
    }),

  // ── سجل العمليات ──────────────────────────────────────────────────────────
  getLogs: protectedProcedure
    .input(z.object({
      page:          z.number().default(1),
      limit:         z.number().default(50),
      invoiceNumber: z.string().optional(),
      status:        z.string().optional(),
      eventType:     z.string().optional(),
      dateFrom:      z.string().optional(),
      dateTo:        z.string().optional(),
      errorsOnly:    z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;

      const conditions: any[] = [eq(zatcaLogs.orgId, ctx.orgId)];
      if (input.invoiceNumber) conditions.push(like(zatcaLogs.invoiceNumber, `%${input.invoiceNumber}%`));
      if (input.status)        conditions.push(eq(zatcaLogs.status, input.status));
      if (input.eventType)     conditions.push(eq(zatcaLogs.eventType, input.eventType));
      if (input.dateFrom)      conditions.push(gte(zatcaLogs.createdAt, new Date(input.dateFrom)));
      if (input.dateTo)        conditions.push(lte(zatcaLogs.createdAt, new Date(input.dateTo)));
      if (input.errorsOnly)    conditions.push(
        or(eq(zatcaLogs.status, 'error'), eq(zatcaLogs.status, 'rejected'))!
      );

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
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, ctx.orgId),
      columns: { zatcaConfig: true },
    });
    const cfg = (org?.zatcaConfig ?? {}) as any;

    const [total, cleared, pending, rejected, errors, notSubmitted] = await Promise.all([
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.orgId), eq(salesInvoices.invoiceType, 'sale'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.orgId), eq(salesInvoices.zatcaStatus, 'cleared'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.orgId), eq(salesInvoices.zatcaStatus, 'pending'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.orgId), eq(salesInvoices.zatcaStatus, 'rejected'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.orgId), eq(salesInvoices.zatcaStatus, 'error'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(
          eq(salesInvoices.orgId, ctx.orgId),
          sql`${salesInvoices.zatcaStatus} IS NULL OR ${salesInvoices.zatcaStatus} = 'not_submitted'`,
        )),
    ]);

    // حساب تحذيرات الشهادة
    let certDaysLeft: number | null = null;
    let certWarning: 'critical' | 'warning' | 'ok' | 'unknown' = 'unknown';
    if (cfg.certExpiryDate) {
      const diff = new Date(cfg.certExpiryDate).getTime() - Date.now();
      certDaysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
      certWarning = certDaysLeft <= 7 ? 'critical' : certDaysLeft <= 15 ? 'warning' : certDaysLeft <= 30 ? 'warning' : 'ok';
    }

    return {
      totalInvoices:       total[0]?.cnt ?? 0,
      cleared:             cleared[0]?.cnt ?? 0,
      pending:             pending[0]?.cnt ?? 0,
      rejected:            rejected[0]?.cnt ?? 0,
      errors:              errors[0]?.cnt ?? 0,
      notSubmitted:        notSubmitted[0]?.cnt ?? 0,
      connectionStatus:    cfg.lastConnectionStatus ?? 'unknown',
      lastConnectionTest:  cfg.lastConnectionTest ?? null,
      certExpiryDate:      cfg.certExpiryDate ?? null,
      certDaysLeft,
      certWarning,
      environment:         cfg.environment ?? 'sandbox',
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
        id:                   salesInvoices.id,
        invoiceNumber:        salesInvoices.invoiceNumber,
        invoiceDate:          salesInvoices.invoiceDate,
        customerName:         salesInvoices.customerName,
        total:                salesInvoices.total,
        zatcaStatus:          salesInvoices.zatcaStatus,
        zatcaUuid:            salesInvoices.zatcaUuid,
        zatcaHash:            salesInvoices.zatcaHash,
        zatcaXml:             salesInvoices.zatcaXml,
        zatcaResponse:        salesInvoices.zatcaResponse,
        zatcaClearedAt:       salesInvoices.zatcaClearedAt,
        zatcaSubmittedAt:     salesInvoices.zatcaSubmittedAt,
        zatcaAttemptCount:    salesInvoices.zatcaAttemptCount,
        zatcaRejectionReason: salesInvoices.zatcaRejectionReason,
        isPosted:             salesInvoices.isPosted,
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
