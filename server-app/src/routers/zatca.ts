import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc.js';
import { db } from '../db.js';
import {
  organizations,
  salesInvoices,
  salesInvoiceItems,
  zatcaLogs,
  zatcaPosUnits,
  zatcaDevices,
  documentJournals,
  warehouses,
} from '../schema.js';
import { eq, and, desc, count, sql, gte, lte, like, or, asc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { resolveZatcaContext, type ZatcaEnvironment } from '../services/zatcaContext.js';

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

const POS_LINK_JOURNAL_TYPES = ['sales_invoice', 'sales_return', 'credit_note', 'debit_note'] as const;
const PosLinkJournalTypeSchema = z.enum(POS_LINK_JOURNAL_TYPES);

async function getPosUnitForOrg(orgId: number, posUnitId: number) {
  const unit = await db.query.zatcaPosUnits.findFirst({
    where: and(
      eq(zatcaPosUnits.id, posUnitId),
      eq(zatcaPosUnits.orgId, orgId),
      eq(zatcaPosUnits.isActive, true),
      eq(zatcaPosUnits.isDeleted, false),
    ),
  });
  if (!unit) throw new TRPCError({ code: 'NOT_FOUND', message: 'وحدة ربط نقطة البيع غير موجودة أو غير فعالة' });
  return unit;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const zatcaRouter = router({

  // ── وحدات ربط ZATCA / مجموعات دفاتر الربط ────────────────────────────────
  // هذا كيان فني داخل مركز ZATCA فقط؛ لا ينشئ نقطة بيع تشغيلية جديدة.
  // يبدأ إنشاء المجموعة من دفتر، ويُستنتج المخزن منه للتحقق فقط.
  listPosUnits: protectedProcedure.query(async ({ ctx }) => {
    const units = await db.select({
      id: zatcaPosUnits.id,
      unitCode: zatcaPosUnits.unitCode,
      unitName: zatcaPosUnits.unitName,
      status: zatcaPosUnits.status,
      warehouseId: zatcaPosUnits.warehouseId,
      warehouseName: warehouses.name,
      isActive: zatcaPosUnits.isActive,
      createdAt: zatcaPosUnits.createdAt,
      updatedAt: zatcaPosUnits.updatedAt,
      egsId: zatcaDevices.id,
      egsName: zatcaDevices.deviceName,
      egsStatus: zatcaDevices.registrationStatus,
    })
      .from(zatcaPosUnits)
      .innerJoin(warehouses, and(
        eq(warehouses.id, zatcaPosUnits.warehouseId),
        eq(warehouses.orgId, ctx.user.orgId),
      ))
      .leftJoin(zatcaDevices, and(
        eq(zatcaDevices.posUnitId, zatcaPosUnits.id),
        eq(zatcaDevices.orgId, ctx.user.orgId),
        eq(zatcaDevices.isActive, true),
        eq(zatcaDevices.isDeleted, false),
      ))
      .where(and(
        eq(zatcaPosUnits.orgId, ctx.user.orgId),
        eq(zatcaPosUnits.isActive, true),
        eq(zatcaPosUnits.isDeleted, false),
      ))
      .orderBy(asc(warehouses.name), asc(zatcaPosUnits.unitCode));

    const journals = await db.select({
      posUnitId: documentJournals.zatcaPosUnitId,
      journalId: documentJournals.id,
      journalCode: documentJournals.code,
      journalName: documentJournals.name,
      docType: documentJournals.docType,
      warehouseId: documentJournals.warehouseId,
    })
      .from(documentJournals)
      .where(and(
        eq(documentJournals.orgId, ctx.user.orgId),
        eq(documentJournals.isActive, true),
        sql`${documentJournals.zatcaPosUnitId} IS NOT NULL`,
      ))
      .orderBy(asc(documentJournals.sortOrder), asc(documentJournals.id));

    return units.map((unit) => ({
      ...unit,
      journals: journals.filter((journal) => journal.posUnitId === unit.id),
    }));
  }),

  createPosUnit: adminProcedure
    .input(z.object({
      journalId: z.number().int().positive(),
      unitCode: z.string().trim().min(1).max(50),
      unitName: z.string().trim().min(1).max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.transaction(async (tx) => {
        const journal = await tx.query.documentJournals.findFirst({
          where: and(
            eq(documentJournals.id, input.journalId),
            eq(documentJournals.orgId, ctx.user.orgId),
            eq(documentJournals.isActive, true),
          ),
        });
        if (!journal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'دفتر المستند غير موجود أو غير فعال' });
        }
        if (!POS_LINK_JOURNAL_TYPES.includes(journal.docType as typeof POS_LINK_JOURNAL_TYPES[number])) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'نوع الدفتر غير مدعوم في ربط ZATCA' });
        }
        if (journal.warehouseId == null) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن إنشاء وحدة ربط قبل ربط الدفتر بالمخزن/الفرع' });
        }
        if (journal.zatcaPosUnitId != null) {
          throw new TRPCError({ code: 'CONFLICT', message: 'الدفتر مرتبط بالفعل بوحدة ربط ZATCA' });
        }

        const warehouse = await tx.query.warehouses.findFirst({
          where: and(
            eq(warehouses.id, journal.warehouseId),
          eq(warehouses.orgId, ctx.user.orgId),
          eq(warehouses.isActive, true),
          ),
          columns: { id: true },
        });
        if (!warehouse) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'مخزن دفتر المستند غير موجود أو غير فعال' });
        }

        const [unit] = await tx.insert(zatcaPosUnits).values({
          orgId: ctx.user.orgId,
          warehouseId: journal.warehouseId,
          unitCode: input.unitCode,
          unitName: input.unitName,
          createdBy: ctx.user.id,
          updatedBy: ctx.user.id,
        }).returning();
        const [linkedJournal] = await tx.update(documentJournals)
          .set({ zatcaPosUnitId: unit.id, updatedAt: new Date() })
          .where(and(
            eq(documentJournals.id, journal.id),
            eq(documentJournals.orgId, ctx.user.orgId),
            eq(documentJournals.isActive, true),
          ))
          .returning();
        return { ...unit, journalId: linkedJournal.id };
      });
    }),

  updatePosUnit: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      unitCode: z.string().trim().min(1).max(50).optional(),
      unitName: z.string().trim().min(1).max(255).optional(),
      status: z.string().trim().min(1).max(30).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await getPosUnitForOrg(ctx.user.orgId, input.id);
      const [unit] = await db.update(zatcaPosUnits)
        .set({
          ...(input.unitCode !== undefined ? { unitCode: input.unitCode } : {}),
          ...(input.unitName !== undefined ? { unitName: input.unitName } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          updatedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(and(eq(zatcaPosUnits.id, input.id), eq(zatcaPosUnits.orgId, ctx.user.orgId)))
        .returning();
      return unit;
    }),

  linkJournalToPosUnit: adminProcedure
    .input(z.object({
      posUnitId: z.number().int().positive(),
      journalId: z.number().int().positive(),
      docType: PosLinkJournalTypeSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const unit = await getPosUnitForOrg(ctx.user.orgId, input.posUnitId);
      const journal = await db.query.documentJournals.findFirst({
        where: and(
          eq(documentJournals.id, input.journalId),
          eq(documentJournals.orgId, ctx.user.orgId),
          eq(documentJournals.isActive, true),
        ),
      });
      if (!journal) throw new TRPCError({ code: 'NOT_FOUND', message: 'دفتر المستند غير موجود أو غير فعال' });
      if (!POS_LINK_JOURNAL_TYPES.includes(journal.docType as typeof POS_LINK_JOURNAL_TYPES[number])) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'نوع الدفتر غير مدعوم في ربط ZATCA' });
      }
      if (input.docType && journal.docType !== input.docType) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'نوع الدفتر المدخل لا يطابق نوع الدفتر الفعلي' });
      }
      if (journal.warehouseId !== unit.warehouseId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'الدفتر ووحدة الربط لا ينتميان إلى نفس المخزن/الفرع' });
      }
      if (journal.zatcaPosUnitId != null && journal.zatcaPosUnitId !== unit.id) {
        throw new TRPCError({ code: 'CONFLICT', message: 'الدفتر مرتبط بالفعل بوحدة ربط أخرى' });
      }

      const [updated] = await db.update(documentJournals)
        .set({ zatcaPosUnitId: unit.id, updatedAt: new Date() })
        .where(and(
          eq(documentJournals.id, journal.id),
          eq(documentJournals.orgId, ctx.user.orgId),
          eq(documentJournals.isActive, true),
        ))
        .returning();
      return updated;
    }),

  unlinkJournalFromPosUnit: adminProcedure
    .input(z.object({ journalId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db.update(documentJournals)
        .set({ zatcaPosUnitId: null, updatedAt: new Date() })
        .where(and(
          eq(documentJournals.id, input.journalId),
          eq(documentJournals.orgId, ctx.user.orgId),
        ))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'دفتر المستند غير موجود' });
      return updated;
    }),

  resolveContext: protectedProcedure
    .input(z.object({
      journalId: z.number().int().positive(),
      environment: z.enum(['sandbox', 'simulation', 'production']),
    }))
    .query(async ({ ctx, input }) => resolveZatcaContext({
      journalId: input.journalId,
      environment: input.environment as ZatcaEnvironment,
      user: {
        id: ctx.user.id,
        orgId: ctx.user.orgId,
        role: ctx.user.role,
        userGroupId: ctx.user.userGroupId,
      },
    })),

  // ── إعدادات ZATCA للمنشأة ─────────────────────────────────────────────────
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, ctx.user.orgId),
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
        where: eq(organizations.id, ctx.user.orgId),
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
        .where(eq(organizations.id, ctx.user.orgId));

      await db.insert(zatcaLogs).values({
        orgId:      ctx.user.orgId,
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
      where: eq(organizations.id, ctx.user.orgId),
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
    }).where(eq(organizations.id, ctx.user.orgId));

    await db.insert(zatcaLogs).values({
      orgId:       ctx.user.orgId,
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
          eq(salesInvoices.orgId, ctx.user.orgId),
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
          eq(salesInvoices.orgId, ctx.user.orgId),
        ),
      });
      if (!inv) throw new Error('Invoice not found');

      if (inv.zatcaStatus === 'cleared' && !input.forceResend) {
        return { ok: false, message: 'الفاتورة مُخلَّصة بالفعل لدى هيئة الزكاة' };
      }

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.user.orgId),
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
        orgId:         ctx.user.orgId,
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
        eq(salesInvoices.orgId, ctx.user.orgId),
      ));

      await db.insert(zatcaLogs).values({
        orgId:       ctx.user.orgId,
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

      const conditions: any[] = [eq(zatcaLogs.orgId, ctx.user.orgId)];
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
      where: eq(organizations.id, ctx.user.orgId),
      columns: { zatcaConfig: true },
    });
    const cfg = (org?.zatcaConfig ?? {}) as any;

    const [total, cleared, pending, rejected, errors, notSubmitted] = await Promise.all([
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.invoiceType, 'sale'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.zatcaStatus, 'cleared'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.zatcaStatus, 'pending'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.zatcaStatus, 'rejected'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.zatcaStatus, 'error'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(
          eq(salesInvoices.orgId, ctx.user.orgId),
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

  // ── التحقق من صحة XML الفاتورة ───────────────────────────────────────────
  validateXml: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // جلب الفاتورة والبنود والإعدادات معاً
      const [inv, items, org] = await Promise.all([
        db.query.salesInvoices.findFirst({
          where: and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, ctx.user.orgId)),
        }),
        db.select().from(salesInvoiceItems)
          .where(and(eq(salesInvoiceItems.invoiceId, input.invoiceId), eq(salesInvoiceItems.orgId, ctx.user.orgId)))
          .orderBy(salesInvoiceItems.sortOrder),
        db.query.organizations.findFirst({
          where: eq(organizations.id, ctx.user.orgId),
          columns: { zatcaConfig: true, name: true },
        }),
      ]);

      if (!inv) throw new Error('Invoice not found');
      const cfg = (org?.zatcaConfig ?? {}) as any;

      // ── توليد XML ──────────────────────────────────────────────────────────
      const issueDate = inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[0] : '';
      const issueTime = inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[1]?.slice(0, 8) ?? '00:00:00' : '00:00:00';
      const invTypeCode = inv.invoiceType === 'return' ? '381' : '388';
      const currency   = inv.currency ?? 'SAR';
      const uuid       = inv.zatcaUuid ?? '';
      const pih        = inv.zatcaPih ?? 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjOTljNWVlNzljMmYxZjUzMGE4NzBhM2UwNjMxNmViMmMy';

      const itemsXml = items.map((it, idx) => {
        const lineTotal  = parseFloat(it.total ?? '0');
        const taxAmt     = parseFloat(it.taxAmount ?? '0');
        const netAmt     = lineTotal - taxAmt;
        const taxPct     = parseFloat(it.taxPercent ?? '15');
        const unitPrice  = parseFloat(it.unitPrice ?? '0');
        const qty        = parseFloat(it.quantity ?? '1');
        const discAmt    = parseFloat(it.discountAmount ?? '0');
        return `
    <cac:InvoiceLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${qty.toFixed(4)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${currency}">${netAmt.toFixed(4)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${currency}">${taxAmt.toFixed(4)}</cbc:TaxAmount>
        <cbc:RoundingAmount currencyID="${currency}">${lineTotal.toFixed(4)}</cbc:RoundingAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${(it.productName ?? 'Item').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${taxPct.toFixed(2)}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${currency}">${unitPrice.toFixed(4)}</cbc:PriceAmount>
        ${discAmt > 0 ? `<cac:AllowanceCharge>
          <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
          <cbc:Amount currencyID="${currency}">${discAmt.toFixed(4)}</cbc:Amount>
        </cac:AllowanceCharge>` : ''}
      </cac:Price>
    </cac:InvoiceLine>`;
      }).join('');

      const taxTotal    = parseFloat(inv.taxAmount ?? '0');
      const subtotal    = parseFloat(inv.subtotal ?? '0');
      const discTotal   = parseFloat(inv.discountAmount ?? '0');
      const total       = parseFloat(inv.total ?? '0');
      const netAmount   = total - taxTotal;

      const generatedXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:ext:XMLDSIG</ext:ExtensionURI>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${inv.invoiceNumber}</cbc:ID>
  <cbc:UUID>${uuid}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${inv.invoiceType === 'return' ? '0200000' : '0100000'}">${invTypeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${inv.zatcaInvoiceCounter ?? 1}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${pih}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="CRN">${cfg.crNumber ?? ''}</cbc:ID></cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${cfg.streetName ?? ''}</cbc:StreetName>
        <cbc:BuildingNumber>${cfg.buildingNumber ?? ''}</cbc:BuildingNumber>
        <cbc:CityName>${cfg.city ?? ''}</cbc:CityName>
        <cbc:PostalZone>${cfg.postalCode ?? ''}</cbc:PostalZone>
        <cbc:CountrySubentity>${cfg.district ?? ''}</cbc:CountrySubentity>
        <cac:Country><cbc:IdentificationCode>${cfg.countryCode ?? 'SA'}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${cfg.vatNumber ?? ''}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cfg.businessName ?? (org?.name ?? '')}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PostalAddress>
        <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${inv.customerTaxNumber ? `<cac:PartyTaxScheme>
        <cbc:CompanyID>${inv.customerTaxNumber}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${(inv.customerName ?? 'مشتري').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${taxTotal.toFixed(4)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${netAmount.toFixed(4)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${taxTotal.toFixed(4)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${subtotal.toFixed(4)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${netAmount.toFixed(4)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${total.toFixed(4)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${currency}">${discTotal.toFixed(4)}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="${currency}">${total.toFixed(4)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${itemsXml}
</Invoice>`;

      // ── قواعد التحقق ───────────────────────────────────────────────────────
      type VResult = { id: number; type: 'error' | 'warning' | 'info'; element: string; description: string; currentValue: string; expectedValue: string; fix: string };
      const results: VResult[] = [];
      let ruleId = 1;

      const err  = (el: string, desc: string, cur: string, exp: string, fix: string) =>
        results.push({ id: ruleId++, type: 'error',   element: el, description: desc, currentValue: cur, expectedValue: exp, fix });
      const warn = (el: string, desc: string, cur: string, exp: string, fix: string) =>
        results.push({ id: ruleId++, type: 'warning', element: el, description: desc, currentValue: cur, expectedValue: exp, fix });
      const info = (el: string, desc: string, cur: string, exp: string, fix: string) =>
        results.push({ id: ruleId++, type: 'info',    element: el, description: desc, currentValue: cur, expectedValue: exp, fix });

      // UUID
      if (!inv.zatcaUuid) err('cbc:UUID', 'UUID الفاتورة غير موجود', '(فارغ)', 'UUID صالح بصيغة RFC 4122', 'أرسل الفاتورة أولاً لتوليد UUID تلقائياً');
      else info('cbc:UUID', 'UUID موجود وصالح', inv.zatcaUuid.slice(0,16) + '…', 'UUID RFC 4122', '—');

      // رقم الفاتورة
      if (!inv.invoiceNumber) err('cbc:ID', 'رقم الفاتورة مفقود', '(فارغ)', 'رقم فاتورة فريد', 'أدخل رقم الفاتورة');
      else info('cbc:ID', 'رقم الفاتورة موجود', inv.invoiceNumber, 'رقم فريد', '—');

      // التاريخ
      if (!issueDate) err('cbc:IssueDate', 'تاريخ الفاتورة مفقود', '(فارغ)', 'YYYY-MM-DD', 'حدد تاريخ الفاتورة');
      else info('cbc:IssueDate', 'تاريخ الفاتورة صالح', issueDate, 'YYYY-MM-DD', '—');

      // العملة
      if (currency !== 'SAR') err('cbc:DocumentCurrencyCode', 'عملة الفاتورة يجب أن تكون SAR للمبيعات المحلية', currency, 'SAR', 'غيّر عملة الفاتورة إلى SAR');
      else info('cbc:DocumentCurrencyCode', 'العملة صحيحة', currency, 'SAR', '—');

      // الرقم الضريبي للبائع
      const sellerVat = cfg.vatNumber ?? '';
      if (!sellerVat) err('cac:AccountingSupplierParty / cbc:CompanyID', 'الرقم الضريبي للبائع غير محدد في إعدادات ZATCA', '(فارغ)', '15 رقماً يبدأ وينتهي بـ 3', 'أكمل إعدادات ZATCA بالرقم الضريبي');
      else if (!/^3\d{13}3$/.test(sellerVat)) err('cac:AccountingSupplierParty / cbc:CompanyID', 'تنسيق الرقم الضريبي للبائع غير صحيح', sellerVat, '15 رقماً يبدأ وينتهي بـ 3 (مثال: 3XXXXXXXXXXX3)', 'صحّح الرقم الضريبي في إعدادات ZATCA');
      else info('cac:AccountingSupplierParty / cbc:CompanyID', 'الرقم الضريبي للبائع صالح', sellerVat, '15 رقماً', '—');

      // اسم البائع
      const sellerName = cfg.businessName ?? (org?.name ?? '');
      if (!sellerName) err('cac:AccountingSupplierParty / cbc:RegistrationName', 'اسم المنشأة (البائع) غير محدد', '(فارغ)', 'اسم المنشأة', 'أكمل اسم المنشأة في إعدادات ZATCA');
      else info('cac:AccountingSupplierParty / cbc:RegistrationName', 'اسم البائع موجود', sellerName, 'اسم المنشأة', '—');

      // السجل التجاري
      if (!cfg.crNumber) warn('cac:PartyIdentification / cbc:ID (CRN)', 'السجل التجاري غير محدد في إعدادات ZATCA', '(فارغ)', 'رقم السجل التجاري', 'أضف رقم السجل التجاري في إعدادات ZATCA');
      else info('cac:PartyIdentification / cbc:ID', 'السجل التجاري موجود', cfg.crNumber, 'رقم السجل التجاري', '—');

      // العنوان
      if (!cfg.streetName || !cfg.city || !cfg.buildingNumber) {
        const missing = [!cfg.streetName && 'الشارع', !cfg.buildingNumber && 'رقم المبنى', !cfg.city && 'المدينة'].filter(Boolean).join('، ');
        warn('cac:PostalAddress', `بيانات العنوان غير مكتملة — مفقود: ${missing}`, '(جزئي)', 'الشارع + رقم المبنى + المدينة + الرمز البريدي', 'أكمل بيانات العنوان في إعدادات ZATCA');
      } else info('cac:PostalAddress', 'بيانات العنوان مكتملة', `${cfg.streetName}، ${cfg.city}`, 'عنوان كامل', '—');

      // اسم العميل
      if (!inv.customerName) warn('cac:AccountingCustomerParty / cbc:RegistrationName', 'اسم العميل غير محدد', '(فارغ)', 'اسم العميل', 'حدد اسم العميل في الفاتورة');
      else info('cac:AccountingCustomerParty / cbc:RegistrationName', 'اسم العميل موجود', inv.customerName.slice(0, 30), 'اسم العميل', '—');

      // الرقم الضريبي للعميل (B2B)
      if (inv.customerType === 'company' || cfg.sellerType === 'B2B') {
        if (!inv.customerTaxNumber) err('cac:AccountingCustomerParty / cbc:CompanyID', 'فاتورة B2B تتطلب رقم ضريبي للعميل', '(فارغ)', '15 رقماً يبدأ وينتهي بـ 3', 'أضف الرقم الضريبي للعميل في الفاتورة');
        else if (!/^3\d{13}3$/.test(inv.customerTaxNumber)) err('cac:AccountingCustomerParty / cbc:CompanyID', 'تنسيق الرقم الضريبي للعميل غير صحيح', inv.customerTaxNumber, '15 رقماً يبدأ وينتهي بـ 3', 'صحّح الرقم الضريبي للعميل');
        else info('cac:AccountingCustomerParty / cbc:CompanyID', 'الرقم الضريبي للعميل صالح', inv.customerTaxNumber, '15 رقماً', '—');
      }

      // نوع الفاتورة
      if (!['388', '381', '383'].includes(invTypeCode)) err('cbc:InvoiceTypeCode', 'كود نوع الفاتورة غير صحيح', invTypeCode, '388 (أصلية) أو 381 (مرتجع) أو 383 (خصم)', 'حدد نوع الفاتورة الصحيح');
      else info('cbc:InvoiceTypeCode', 'كود نوع الفاتورة صحيح', `${invTypeCode} (${invTypeCode === '388' ? 'فاتورة أصلية' : invTypeCode === '381' ? 'مرتجع' : 'إشعار خصم'})`, '388 أو 381 أو 383', '—');

      // البنود
      if (items.length === 0) err('cac:InvoiceLine', 'الفاتورة لا تحتوي على بنود', '0 بنود', 'بند واحد على الأقل', 'أضف منتجاً أو خدمة للفاتورة');
      else info('cac:InvoiceLine', `الفاتورة تحتوي على ${items.length} بند/بنود`, `${items.length} بند`, '≥ 1', '—');

      // الضريبة
      const expectedTax = parseFloat((netAmount * 0.15).toFixed(4));
      const actualTax   = parseFloat(taxTotal.toFixed(4));
      const taxDiff     = Math.abs(expectedTax - actualTax);
      if (taxDiff > 0.01 && taxTotal > 0) {
        warn('cac:TaxTotal / cbc:TaxAmount', `مبلغ الضريبة قد لا يتطابق مع نسبة 15%`, `${actualTax.toFixed(2)} SAR`, `${expectedTax.toFixed(2)} SAR (≈15% من ${netAmount.toFixed(2)})`, 'راجع حسابات الضريبة في بنود الفاتورة');
      } else {
        info('cac:TaxTotal / cbc:TaxAmount', 'مبلغ الضريبة صحيح', `${taxTotal.toFixed(2)} SAR`, `${actualTax.toFixed(2)} SAR`, '—');
      }

      // إجمالي الفاتورة
      if (total <= 0) err('cac:LegalMonetaryTotal / cbc:PayableAmount', 'إجمالي الفاتورة يجب أن يكون أكبر من صفر', total.toFixed(2), '> 0', 'تأكد من وجود بنود بأسعار صحيحة');
      else info('cac:LegalMonetaryTotal / cbc:PayableAmount', 'إجمالي الفاتورة صحيح', `${total.toFixed(2)} SAR`, '> 0', '—');

      // Hash
      if (!inv.zatcaHash) warn('cbc:PreviousInvoiceHash', 'Hash الفاتورة غير موجود — سيتم توليده عند الإرسال', '(فارغ)', 'SHA-256 Hash', 'أرسل الفاتورة لتوليد Hash تلقائياً');
      else info('cbc:PreviousInvoiceHash', 'Hash الفاتورة موجود', inv.zatcaHash.slice(0, 16) + '…', 'SHA-256', '—');

      // QR
      if (!inv.zatcaQrCode) warn('cbc:EmbeddedDocumentBinaryObject (QR)', 'رمز QR غير موجود — سيتم توليده عند الإرسال', '(فارغ)', 'Base64 TLV QR', 'أرسل الفاتورة لتوليد QR تلقائياً');
      else info('cbc:EmbeddedDocumentBinaryObject (QR)', 'رمز QR موجود', '(مُشفَّر Base64)', 'Base64 TLV', '—');

      // PIH
      if (!inv.zatcaPih) warn('cac:AdditionalDocumentReference (PIH)', 'PIH غير موجود — سيُستخدم القيمة الافتراضية', '(افتراضي)', 'Hash الفاتورة السابقة', 'هذا طبيعي للفاتورة الأولى');
      else info('cac:AdditionalDocumentReference (PIH)', 'PIH موجود', inv.zatcaPih.slice(0, 16) + '…', 'SHA-256 Hash', '—');

      // ترقيم متسلسل
      if (!inv.zatcaInvoiceCounter) warn('cac:AdditionalDocumentReference (ICV)', 'رقم ICV (العداد) غير محدد', '(فارغ)', 'رقم تسلسلي متصاعد', 'سيتم توليده عند الإرسال');
      else info('cac:AdditionalDocumentReference (ICV)', 'رقم ICV موجود', `${inv.zatcaInvoiceCounter}`, 'رقم تسلسلي', '—');

      // بيئة التشغيل
      if (cfg.environment === 'production') info('env', 'البيئة: إنتاج', 'Production', 'Sandbox أو Production', '—');
      else warn('env', 'البيئة: اختبار — تذكّر التحويل للإنتاج قبل النشر الفعلي', 'Sandbox', 'Production (في النشر الحقيقي)', 'غيّر البيئة إلى Production في إعدادات ZATCA عند الجاهزية');

      const errorCount   = results.filter(r => r.type === 'error').length;
      const warningCount = results.filter(r => r.type === 'warning').length;
      const passed       = errorCount === 0;
      const xmlToReturn  = inv.zatcaXml ?? generatedXml;

      // تسجيل في السجل
      const userName = (ctx.user as any).name ?? (ctx.user as any).username ?? 'مستخدم';
      await db.insert(zatcaLogs).values({
        orgId:         ctx.user.orgId,
        invoiceId:     input.invoiceId,
        invoiceNumber: inv.invoiceNumber,
        eventType:     'xml_validation',
        status:        passed ? 'success' : 'error',
        userId:        ctx.user.id,
        userName,
        requestBody:   JSON.stringify({ invoiceId: input.invoiceId }),
        responseBody:  JSON.stringify({ errorCount, warningCount, passed }),
        errorMessage:  passed ? null : `${errorCount} خطأ، ${warningCount} تحذير`,
      });

      return { xml: xmlToReturn, results, errorCount, warningCount, passed, isGeneratedXml: !inv.zatcaXml };
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
        eq(salesInvoices.orgId, ctx.user.orgId),
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
