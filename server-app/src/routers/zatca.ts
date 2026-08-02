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
  branches,
  zatcaInvoiceTransactions,
  zatcaSubmissionAttempts,
  zatcaSubmissionQueue,
  zatcaRequestLog,
  zatcaResponseLog,
  zatcaErrorLog,
  zatcaEnvironments,
  zatcaCertificates,
  zatcaCsid,
  zatcaKeys,
  zatcaCsrRequests,
  zatcaReadinessSettings,
  stockVouchers,
} from '../schema.js';
import { eq, and, desc, count, sql, gte, lte, like, or, asc, notInArray, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { resolveZatcaContext, type ZatcaEnvironment } from '../services/zatcaContext.js';
import {
  ZATCA_LIFECYCLE_STATES,
  type ZatcaLifecycleState,
  type ZatcaOperation,
  type ZatcaMockOutcome,
  buildMockAuthorityResponse,
  canTransitionZatcaState,
  isFinalZatcaState,
  isUncertainZatcaState,
  nextRetryState,
  redactZatcaPayload,
  stateForMockOutcome,
} from '../services/zatcaLifecycle.js';
import { enqueueZatcaSubmission } from '../services/zatcaQueue.js';
import {
  generateSimulationCsr,
  postFatooraSimulation,
  getSimulationUrl,
} from '../services/zatcaFatooraSimulation.js';
import { buildAndSignSimulationInvoice } from '../services/zatcaInvoiceSubmission.js';
import { decrypt, encrypt } from '../config-crypto.js';

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const ZatcaConfigSchema = z.object({
  enabled:             z.boolean().default(false),
  environment:         z.enum(['sandbox', 'simulation', 'production']).default('sandbox'),
  vatNumber:           z.string().default(''),
  legalName:           z.string().default(''),
  englishName:         z.string().default(''),
  commercialReg:       z.string().default(''),
  activity:            z.string().default(''),
  country:             z.string().default(''),
  buildingNumber:      z.string().default(''),
  street:              z.string().default(''),
  district:            z.string().default(''),
  city:                z.string().default(''),
  postalCode:          z.string().default(''),
  additionalNumber:    z.string().default(''),
  phone:               z.string().default(''),
  email:               z.string().default(''),
  countryCode:         z.string().default(''),
  sellerType:          z.enum(['B2B', 'B2C', 'both']).default('both'),
  autoSubmit:          z.boolean().default(false),
  submitOnPost:        z.boolean().default(true),
  // حقول حساسة — تعبّأ فقط بواسطة مسؤول الربط
  csid:                z.string().default(''),
  secretKey:           z.string().default(''),
  apiBaseUrl:          z.string().default('https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation'),
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

type ZatcaConfig = z.infer<typeof ZatcaConfigSchema>;

function canonicalizeZatcaConfig(
  value: unknown,
  organization?: { name?: string | null; nameEn?: string | null; taxNumber?: string | null },
): ZatcaConfig {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return ZatcaConfigSchema.parse({
    ...raw,
    legalName: organization?.name ?? raw.legalName ?? raw.businessName ?? '',
    englishName: organization?.nameEn ?? raw.englishName ?? raw.businessNameEn ?? '',
    vatNumber: organization?.taxNumber ?? raw.vatNumber ?? '',
    commercialReg: raw.commercialReg ?? raw.crNumber ?? '',
    activity: raw.activity ?? raw.businessCategory ?? '',
    country: raw.country ?? raw.countryName ?? '',
    street: raw.street ?? raw.streetName ?? '',
    phone: raw.phone ?? '',
    email: raw.email ?? '',
  });
}

const REDACTED_CREDENTIAL = '••••••••••••••••';

const POS_LINK_JOURNAL_TYPES = ['sales_invoice', 'sales_return', 'credit_note', 'debit_note'] as const;
const PosLinkJournalTypeSchema = z.enum(POS_LINK_JOURNAL_TYPES);
const READINESS_INVOICE_TYPES = ['simplified', 'standard', 'both'] as const;
const JOURNAL_TYPE_LABELS: Record<string, string> = {
  sales_invoice: 'فاتورة مبيعات',
  sales_return: 'مردود مبيعات / إشعار دائن',
  credit_note: 'إشعار دائن مبيعات',
  debit_note: 'إشعار مدين مبيعات',
};

/**
 * These are deliberately declared server-side rather than inferred from menu
 * labels. A route marked "قريباً" is not an operational document screen and
 * cannot be treated as XML-capable.
 */
const ZATCA_SCREEN_CAPABILITIES = {
  sales_invoice: {
    path: '/sales/invoice',
    label: 'فاتورة المبيعات',
    screenExists: true,
    xmlReady: true,
    detail: 'الشاشة التشغيلية موجودة وتدعم إنشاء XML موقّع',
  },
  sales_return: {
    path: '/sales/return',
    label: 'مردود المبيعات / Credit Note',
    screenExists: true,
    xmlReady: true,
    detail: 'الشاشة التشغيلية موجودة وتدعم XML للمردود مع فاتورة أصلية مرجعية',
  },
  credit_note: {
    path: '/sales/credit-note',
    label: 'إشعار دائن',
    screenExists: true,
    xmlReady: true,
    detail: 'الشاشة التشغيلية موجودة وتدعم XML بإشارة الفاتورة الأصلية وسبب الإصدار',
  },
  debit_note: {
    path: '/sales/debit-note',
    label: 'إشعار مدين مبيعات',
    screenExists: true,
    xmlReady: true,
    detail: 'الشاشة التشغيلية موجودة وتدعم XML بإشارة الفاتورة الأصلية وسبب الإصدار',
  },
} as const;
const ZatcaOperationSchema = z.enum(['clearance', 'reporting']);
const ZatcaMockOutcomeSchema = z.enum([
  'accepted',
  'accepted_with_warnings',
  'rejected',
  'delayed',
  'uncertain',
  'connection_issue',
  'connection_loss',
]);

function lifecycleMessage(state: ZatcaLifecycleState): string {
  const messages: Record<ZatcaLifecycleState, string> = {
    ready_to_submit: 'الفاتورة جاهزة للإرسال',
    submitting: 'جاري إرسال الطلب',
    submitted_pending: 'تم إرسال الطلب ولم تصل نتيجة نهائية بعد',
    cleared: 'نتيجة Mock: محاكاة تخليص — ليست نتيجة رسمية من الهيئة',
    reported: 'نتيجة Mock: محاكاة إبلاغ — ليست نتيجة رسمية من الهيئة',
    accepted_with_warnings: 'نتيجة Mock: قبول تجريبي مع تحذيرات',
    rejected: 'نتيجة Mock: رفض تجريبي — ليست نتيجة رسمية من الهيئة',
    connection_issue: 'حدثت مشكلة اتصال قبل تأكيد النتيجة',
    retry_pending: 'الفاتورة بانتظار إعادة المحاولة',
    uncertain: 'الحالة غير مؤكدة وتحتاج مطابقة',
  };
  return messages[state];
}

function simulationEnvironmentValues() {
  return {
    name: 'Simulation',
    baseApiUrl: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
    complianceUrl: getSimulationUrl('/compliance'),
    reportingUrl: getSimulationUrl('/invoices/reporting/single'),
    clearanceUrl: getSimulationUrl('/invoices/clearance/single'),
    oauthUrl: null,
    portalUrl: 'https://fatoora.zatca.gov.sa/',
  };
}

function requireSimulationEncryptionKey() {
  if (
    process.env.NODE_ENV === 'production'
    && (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32)
  ) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'لا يمكن حفظ اعتماد Simulation قبل تهيئة ENCRYPTION_KEY الآمن للخادم',
    });
  }
}

function safeRemoteResponse(response: { body: unknown; httpStatus: number | null; requestId: string | null }) {
  return redactZatcaPayload({
    httpStatus: response.httpStatus,
    requestId: response.requestId,
    body: response.body,
  });
}

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

type ReadinessWarehouseId = number | undefined;

async function getZatcaReadiness(
  orgId: number,
  selectedWarehouseId?: ReadinessWarehouseId,
  selectedInvoiceType: typeof READINESS_INVOICE_TYPES[number] = 'both',
) {
  const [org, locationRows, journalRows, simulationEnvironment, savedSettings, linkingUnits, operationalRows, stockRows] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: {
        id: true,
        name: true,
        nameEn: true,
        taxNumber: true,
        commercialReg: true,
        zatcaConfig: true,
      },
    }),
    db.select({
      id: warehouses.id,
      name: warehouses.name,
      code: warehouses.code,
      branchId: warehouses.branchId,
      branchName: branches.name,
    })
      .from(warehouses)
      .leftJoin(branches, and(
        eq(branches.id, warehouses.branchId),
        eq(branches.orgId, orgId),
      ))
      .where(and(
        eq(warehouses.orgId, orgId),
        eq(warehouses.isActive, true),
      ))
      .orderBy(asc(warehouses.name), asc(warehouses.id)),
    selectedWarehouseId
      ? db.select({
          id: documentJournals.id,
          code: documentJournals.code,
          name: documentJournals.name,
          docType: documentJournals.docType,
          warehouseId: documentJournals.warehouseId,
          zatcaPosUnitId: documentJournals.zatcaPosUnitId,
        })
          .from(documentJournals)
          .where(and(
            eq(documentJournals.orgId, orgId),
            eq(documentJournals.warehouseId, selectedWarehouseId),
            eq(documentJournals.isActive, true),
            inArray(documentJournals.docType, POS_LINK_JOURNAL_TYPES),
          ))
          .orderBy(asc(documentJournals.sortOrder), asc(documentJournals.id))
      : Promise.resolve([]),
    db.query.zatcaEnvironments.findFirst({
      where: and(
        eq(zatcaEnvironments.orgId, orgId),
        eq(zatcaEnvironments.name, 'Simulation'),
        eq(zatcaEnvironments.isActive, true),
        eq(zatcaEnvironments.isDeleted, false),
      ),
      columns: { id: true, name: true, baseApiUrl: true },
    }),
    db.query.zatcaReadinessSettings.findFirst({
      where: eq(zatcaReadinessSettings.orgId, orgId),
      columns: {
        warehouseId: true,
        invoiceType: true,
        zatcaPosUnitId: true,
        updatedBy: true,
        updatedAt: true,
      },
    }),
    db.select({
      id: zatcaPosUnits.id,
      unitCode: zatcaPosUnits.unitCode,
      unitName: zatcaPosUnits.unitName,
      warehouseId: zatcaPosUnits.warehouseId,
      status: zatcaPosUnits.status,
    }).from(zatcaPosUnits).where(and(
      eq(zatcaPosUnits.orgId, orgId),
      eq(zatcaPosUnits.isActive, true),
      eq(zatcaPosUnits.isDeleted, false),
    )).orderBy(asc(zatcaPosUnits.unitName)),
    db.select({
      invoiceId: salesInvoices.id,
      invoiceType: salesInvoices.invoiceType,
      invoiceNumber: salesInvoices.invoiceNumber,
      invoiceWarehouseId: salesInvoices.warehouseId,
      isPosted: salesInvoices.isPosted,
      zatcaXml: salesInvoices.zatcaXml,
      zatcaInvoiceType: salesInvoices.zatcaInvoiceType,
      transactionStatus: zatcaInvoiceTransactions.invoiceStatus,
      checkedAt: zatcaInvoiceTransactions.updatedAt,
    })
      .from(zatcaInvoiceTransactions)
      .innerJoin(salesInvoices, eq(salesInvoices.id, zatcaInvoiceTransactions.invoiceId))
      .where(and(
        eq(zatcaInvoiceTransactions.orgId, orgId),
        eq(salesInvoices.orgId, orgId),
        eq(zatcaInvoiceTransactions.isActive, true),
        eq(zatcaInvoiceTransactions.isDeleted, false),
        inArray(zatcaInvoiceTransactions.invoiceStatus, ['cleared', 'reported', 'accepted_with_warnings']),
        inArray(salesInvoices.invoiceType, ['sale', 'return', 'credit_note', 'debit_note']),
        selectedWarehouseId ? eq(salesInvoices.warehouseId, selectedWarehouseId) : sql`TRUE`,
        selectedInvoiceType === 'both'
          ? sql`TRUE`
          : eq(salesInvoices.zatcaInvoiceType, selectedInvoiceType),
      ))
      .orderBy(desc(zatcaInvoiceTransactions.updatedAt)),
    db.select({
      sourceDocId: stockVouchers.sourceDocId,
      sourceDocType: stockVouchers.sourceDocType,
      status: stockVouchers.status,
    })
      .from(stockVouchers)
      .where(eq(stockVouchers.orgId, orgId)),
  ]);

  if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'المنشأة غير موجودة' });

  const cfg = ZatcaConfigSchema.parse(canonicalizeZatcaConfig(org.zatcaConfig, org));
  const vatNumber = String(cfg.vatNumber || '').trim();
  const businessName = String(cfg.legalName || '').trim();
  const businessNameEn = String(cfg.englishName || '').trim();
  const missingOrganizationFields: string[] = [];
  if (!/^3\d{13}3$/.test(vatNumber)) missingOrganizationFields.push('الرقم الضريبي الصحيح');
  if (!businessName) missingOrganizationFields.push('اسم المنشأة');
  if (!businessNameEn) missingOrganizationFields.push('الاسم الإنجليزي للمنشأة');
  if (!String(cfg.commercialReg || org.commercialReg || '').trim()) missingOrganizationFields.push('السجل التجاري');
  if (!cfg.activity.trim()) missingOrganizationFields.push('النشاط');
  if (!cfg.country.trim()) missingOrganizationFields.push('الدولة');
  if (!cfg.street.trim()) missingOrganizationFields.push('اسم الشارع');
  if (!cfg.buildingNumber.trim()) missingOrganizationFields.push('رقم المبنى');
  if (!cfg.district.trim()) missingOrganizationFields.push('الحي');
  if (!cfg.city.trim()) missingOrganizationFields.push('المدينة');
  if (!cfg.postalCode.trim()) missingOrganizationFields.push('الرمز البريدي');
  if (!cfg.additionalNumber.trim()) missingOrganizationFields.push('الرقم الإضافي');

  const selectedWarehouse = selectedWarehouseId == null
    ? null
    : locationRows.find(row => row.id === selectedWarehouseId) ?? null;
  const journalByType = new Map(journalRows.map(row => [row.docType, row]));
  const journals = POS_LINK_JOURNAL_TYPES.map(docType => {
    const journal = journalByType.get(docType);
    return {
      docType,
      label: JOURNAL_TYPE_LABELS[docType] ?? docType,
      found: Boolean(journal),
      linked: Boolean(journal?.zatcaPosUnitId),
      linkedUnitId: journal?.zatcaPosUnitId ?? null,
      journal: journal ?? null,
    };
  });
  const linkedUnitIds = journals
    .map(item => item.linkedUnitId)
    .filter((id): id is number => id != null);
  const linkingUnitId = linkedUnitIds.length > 0 && new Set(linkedUnitIds).size === 1
    ? linkedUnitIds[0]
    : null;
  const allJournalsPresent = journals.every(item => item.found);
  const allJournalsLinked = journals.every(item => item.linked);
  const allJournalsSameUnit = allJournalsLinked && linkingUnitId != null;
  const screens = POS_LINK_JOURNAL_TYPES.map(docType => ({
    docType,
    ...ZATCA_SCREEN_CAPABILITIES[docType],
  }));
  const allScreensReady = screens.every(screen => screen.screenExists && screen.xmlReady);
  const latestOperationalByType = new Map<string, (typeof operationalRows)[number]>();
  for (const row of operationalRows) {
    if (!latestOperationalByType.has(row.invoiceType)) latestOperationalByType.set(row.invoiceType, row);
  }
  const operationalTests = POS_LINK_JOURNAL_TYPES.map((docType) => {
    const invoiceType = docType === 'sales_invoice' ? 'sale' : docType === 'sales_return' ? 'return' : docType;
    const candidate = latestOperationalByType.get(invoiceType);
    const linkedStock = candidate
      ? stockRows.filter((stock) => stock.sourceDocId === candidate.invoiceId && stock.status !== 'cancelled')
      : [];
    const saved = Boolean(candidate);
    const posted = Boolean(candidate?.isPosted);
    const xml = Boolean(candidate?.zatcaXml?.trim());
    const zatca = Boolean(candidate?.transactionStatus);
    const stockRule = invoiceType === 'credit_note' || invoiceType === 'debit_note'
      ? linkedStock.length === 0
      : invoiceType === 'return'
        ? linkedStock.length > 0
        : true;
    return {
      docType,
      label: JOURNAL_TYPE_LABELS[docType] ?? docType,
      completed: saved && posted && xml && zatca && stockRule,
      invoiceId: candidate?.invoiceId ?? null,
      invoiceNumber: candidate?.invoiceNumber ?? null,
      checkedAt: candidate?.checkedAt ?? null,
      checks: { saved, posted, xml, zatca, stockRule },
    };
  });
  const operationalTestCompleted = operationalTests.every((test) => test.completed);
  const simulationConfigured = cfg.environment === 'simulation'
    && cfg.apiBaseUrl === simulationEnvironmentValues().baseApiUrl
    && Boolean(simulationEnvironment);
  const reasons: string[] = [];
  if (missingOrganizationFields.length) reasons.push(`أكمل بيانات المنشأة: ${missingOrganizationFields.join('، ')}`);
  if (!selectedWarehouse) reasons.push('اختر المخزن/الفرع من القائمة');
  if (selectedWarehouse && !allJournalsPresent) reasons.push('يجب إنشاء الدفاتر الأربعة للمخزن/الفرع المحدد');
  if (selectedWarehouse && allJournalsPresent && !allJournalsLinked) reasons.push('اربط الدفاتر الأربعة بوحدة ربط ZATCA');
  if (selectedWarehouse && allJournalsSameUnit === false && allJournalsLinked) reasons.push('يجب أن ترتبط الدفاتر الأربعة بوحدة ربط واحدة');
  if (!allScreensReady) reasons.push('شاشتا الإشعار الدائن والمدين غير مكتملتين أو غير قادرتين على إنشاء XML');
  if (!simulationConfigured) reasons.push('فعّل بيئة Fatoora Simulation من إعدادات البيئة');
  if (!operationalTestCompleted) reasons.push('الاختبار التشغيلي الفعلي لم يكتمل لكل مسارات الفواتير والإشعارات');

  return {
    availableOrganizations: [{
      id: org.id,
      name: org.name,
      nameEn: org.nameEn,
      selected: true,
      dataComplete: missingOrganizationFields.length === 0,
    }],
    organization: {
      id: org.id,
      name: org.name,
      nameEn: org.nameEn,
      commercialReg: org.commercialReg,
      activity: cfg.activity,
      country: cfg.country,
      city: cfg.city,
      district: cfg.district,
      street: cfg.street,
      buildingNumber: cfg.buildingNumber,
      postalCode: cfg.postalCode,
      additionalNumber: cfg.additionalNumber,
      vatNumber: vatNumber || null,
      dataComplete: missingOrganizationFields.length === 0,
      missingFields: missingOrganizationFields,
    },
    locations: locationRows.map(row => ({
      ...row,
      label: row.branchName ? `${row.branchName} — ${row.name}` : row.name,
      selected: row.id === selectedWarehouseId,
    })),
    selectedWarehouseId: selectedWarehouse?.id ?? null,
    selectedLocation: selectedWarehouse
      ? {
          id: selectedWarehouse.id,
          label: selectedWarehouse.branchName
            ? `${selectedWarehouse.branchName} — ${selectedWarehouse.name}`
            : selectedWarehouse.name,
          branchId: selectedWarehouse.branchId,
          branchName: selectedWarehouse.branchName,
        }
      : null,
    invoiceTypeOptions: [
      { value: 'simplified', label: 'فواتير مبسطة' },
      { value: 'standard', label: 'فواتير عادية' },
      { value: 'both', label: 'كلاهما' },
    ],
    selectedInvoiceType,
    savedSettings: savedSettings
      ? {
          warehouseId: savedSettings.warehouseId,
          invoiceType: savedSettings.invoiceType,
          zatcaPosUnitId: savedSettings.zatcaPosUnitId,
          updatedBy: savedSettings.updatedBy,
          updatedAt: savedSettings.updatedAt,
        }
      : null,
    linkingUnits,
    simulation: {
      configured: simulationConfigured,
      configEnvironment: cfg.environment,
      environmentRecordExists: Boolean(simulationEnvironment),
    },
    journals,
    screens,
    linkingUnitId,
    allJournalsPresent,
    allJournalsLinked,
    allJournalsSameUnit,
    allScreensReady,
    operationalTestCompleted,
    operationalTests,
    readyForCsr: missingOrganizationFields.length === 0
      && Boolean(selectedWarehouse)
      && allJournalsPresent
      && allJournalsSameUnit
      && allScreensReady
      && operationalTestCompleted
      && simulationConfigured,
    reasons,
  };
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
      branchName: branches.name,
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
      .leftJoin(branches, and(
        eq(branches.id, warehouses.branchId),
        eq(branches.orgId, ctx.user.orgId),
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

  listLinkingJournalOptions: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.select({
      id: documentJournals.id,
      code: documentJournals.code,
      name: documentJournals.name,
      docType: documentJournals.docType,
      warehouseId: documentJournals.warehouseId,
      warehouseName: warehouses.name,
      branchId: warehouses.branchId,
      branchName: branches.name,
      zatcaPosUnitId: documentJournals.zatcaPosUnitId,
    })
      .from(documentJournals)
      .leftJoin(warehouses, and(
        eq(warehouses.id, documentJournals.warehouseId),
        eq(warehouses.orgId, ctx.user.orgId),
      ))
      .leftJoin(branches, and(
        eq(branches.id, warehouses.branchId),
        eq(branches.orgId, ctx.user.orgId),
      ))
      .where(and(
        eq(documentJournals.orgId, ctx.user.orgId),
        eq(documentJournals.isActive, true),
        sql`${documentJournals.docType} IN ('sales_invoice', 'sales_return', 'credit_note', 'debit_note')`,
      ))
      .orderBy(asc(documentJournals.sortOrder), asc(documentJournals.id));

    return rows;
  }),

  /**
   * Business-first readiness gate for the Simulation onboarding flow.
   * The query is intentionally read-only: it never creates a journal, unit,
   * EGS record, VAT value, or remote request.
   */
  getReadiness: protectedProcedure
    .input(z.object({
      warehouseId: z.number().int().positive().optional(),
      invoiceType: z.enum(READINESS_INVOICE_TYPES).default('both'),
    }).optional())
    .query(async ({ ctx, input }) => getZatcaReadiness(
      ctx.user.orgId,
      input?.warehouseId,
      input?.invoiceType ?? 'both',
    )),

  saveReadinessSettings: protectedProcedure
    .input(z.object({
      warehouseId: z.number().int().positive(),
      invoiceType: z.enum(READINESS_INVOICE_TYPES),
      zatcaPosUnitId: z.number().int().positive().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const warehouse = await db.query.warehouses.findFirst({
        where: and(
          eq(warehouses.id, input.warehouseId),
          eq(warehouses.orgId, ctx.user.orgId),
          eq(warehouses.isActive, true),
        ),
        columns: { id: true },
      });
      if (!warehouse) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'المخزن/الفرع غير صالح للمنظمة الحالية' });
      }

      let unitId = input.zatcaPosUnitId ?? null;
      if (unitId != null) {
        const unit = await db.query.zatcaPosUnits.findFirst({
          where: and(
            eq(zatcaPosUnits.id, unitId),
            eq(zatcaPosUnits.orgId, ctx.user.orgId),
            eq(zatcaPosUnits.warehouseId, input.warehouseId),
            eq(zatcaPosUnits.isActive, true),
            eq(zatcaPosUnits.isDeleted, false),
          ),
          columns: { id: true },
        });
        if (!unit) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'وحدة الربط لا تنتمي إلى المخزن المختار' });
        }
      }

      const now = new Date();
      const [saved] = await db.insert(zatcaReadinessSettings).values({
        orgId: ctx.user.orgId,
        warehouseId: input.warehouseId,
        invoiceType: input.invoiceType,
        zatcaPosUnitId: unitId,
        updatedBy: ctx.user.id,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: zatcaReadinessSettings.orgId,
        set: {
          warehouseId: input.warehouseId,
          invoiceType: input.invoiceType,
          zatcaPosUnitId: unitId,
          updatedBy: ctx.user.id,
          updatedAt: now,
        },
      }).returning();

      return {
        ok: true,
        settings: {
          warehouseId: saved.warehouseId,
          invoiceType: saved.invoiceType,
          zatcaPosUnitId: saved.zatcaPosUnitId,
          updatedBy: saved.updatedBy,
          updatedAt: saved.updatedAt,
        },
      };
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

        const locationJournals = await tx.select({
          docType: documentJournals.docType,
        }).from(documentJournals).where(and(
          eq(documentJournals.orgId, ctx.user.orgId),
          eq(documentJournals.warehouseId, journal.warehouseId),
          eq(documentJournals.isActive, true),
          inArray(documentJournals.docType, POS_LINK_JOURNAL_TYPES),
        ));
        const availableTypes = new Set(locationJournals.map((row) => row.docType));
        const missingTypes = POS_LINK_JOURNAL_TYPES.filter((docType) => !availableTypes.has(docType));
        if (missingTypes.length > 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `لا يمكن إنشاء وحدة الربط قبل ظهور الدفاتر الأربعة في نفس المخزن: ${missingTypes.map((type) => JOURNAL_TYPE_LABELS[type]).join('، ')}`,
          });
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

  // ── تهيئة EGS في Fatoora Simulation ───────────────────────────────────────
  // المفتاح الخاص يُنشأ داخل الخادم ولا يغادره. هذه العملية لا ترسل OTP.
  createSimulationCsr: adminProcedure
    .input(z.object({
      posUnitId: z.number().int().positive(),
      serialNumber: z.string().trim().min(1).max(100),
      solutionName: z.string().trim().min(1).max(100).default('OneSoft'),
      model: z.string().trim().min(1).max(100).default('ERP'),
      branchName: z.string().trim().min(1).max(255),
      branchLocation: z.string().trim().min(1).max(255),
      businessCategory: z.string().trim().min(1).max(255),
      taxpayerProvidedId: z.string().trim().min(1).max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      requireSimulationEncryptionKey();
      const [org, unit] = await Promise.all([
        db.query.organizations.findFirst({
          where: eq(organizations.id, ctx.user.orgId),
          columns: { name: true, nameEn: true, taxNumber: true, zatcaConfig: true },
        }),
        getPosUnitForOrg(ctx.user.orgId, input.posUnitId),
      ]);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'المنشأة غير موجودة' });

      const readiness = await getZatcaReadiness(ctx.user.orgId, unit.warehouseId, 'both');
      if (!readiness.readyForCsr) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `لا يمكن إنشاء CSR قبل اكتمال الجاهزية: ${readiness.reasons.join('؛ ')}`,
        });
      }

      const cfg = canonicalizeZatcaConfig(org.zatcaConfig, org);
      const vatNumber = String(cfg.vatNumber ?? '').trim();
      if (!vatNumber) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'أكمل الرقم الضريبي قبل إنشاء CSR' });
      }
      if (cfg.environment !== 'simulation') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'اختر بيئة Fatoora Simulation واحفظها قبل إنشاء CSR' });
      }

      const csr = generateSimulationCsr({
        commonName: input.taxpayerProvidedId,
        organizationName: String(cfg.englishName ?? cfg.legalName ?? org.name ?? ''),
        organizationUnitName: input.branchName,
        serialNumber: input.serialNumber,
        vatNumber,
        branchLocation: input.branchLocation,
        businessCategory: input.businessCategory,
        solutionName: input.solutionName,
        model: input.model,
        branchName: input.branchName,
        taxpayerProvidedId: input.taxpayerProvidedId,
      });

      return db.transaction(async (tx) => {
        let environment = await tx.query.zatcaEnvironments.findFirst({
          where: and(
            eq(zatcaEnvironments.orgId, ctx.user.orgId),
            eq(zatcaEnvironments.name, 'Simulation'),
            eq(zatcaEnvironments.isActive, true),
            eq(zatcaEnvironments.isDeleted, false),
          ),
        });
        if (!environment) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'بيئة Fatoora Simulation غير مهيأة؛ احفظ إعداد البيئة أولاً',
          });
        }

        let device = await tx.query.zatcaDevices.findFirst({
          where: and(
            eq(zatcaDevices.orgId, ctx.user.orgId),
            eq(zatcaDevices.posUnitId, unit.id),
            eq(zatcaDevices.environmentId, environment.id),
            eq(zatcaDevices.isActive, true),
            eq(zatcaDevices.isDeleted, false),
          ),
        });
        if (!device) {
          const [createdDevice] = await tx.insert(zatcaDevices).values({
            orgId: ctx.user.orgId,
            posUnitId: unit.id,
            deviceName: unit.unitName,
            serialNumber: input.serialNumber,
            environmentId: environment.id,
            registrationStatus: 'csr_ready',
            createdBy: ctx.user.id,
            updatedBy: ctx.user.id,
          }).returning();
          device = createdDevice;
        }

        await tx.update(zatcaKeys).set({
          status: 'rotated',
          isActive: false,
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
        }).where(and(
          eq(zatcaKeys.orgId, ctx.user.orgId),
          eq(zatcaKeys.deviceId, device.id),
          eq(zatcaKeys.isActive, true),
          eq(zatcaKeys.isDeleted, false),
        ));

        const [key] = await tx.insert(zatcaKeys).values({
          orgId: ctx.user.orgId,
          deviceId: device.id,
          algorithm: 'EC',
          curve: 'secp256k1',
          publicKey: csr.publicKeyPem,
          privateKeyEncrypted: encrypt(csr.privateKeyPem),
          fingerprint: csr.fingerprint,
          status: 'active',
          createdBy: ctx.user.id,
          updatedBy: ctx.user.id,
        }).returning({ id: zatcaKeys.id });

        const [csrRequest] = await tx.insert(zatcaCsrRequests).values({
          orgId: ctx.user.orgId,
          deviceId: device.id,
          csrText: csr.csrBase64,
          pem: csr.csrPem,
          status: 'pending_otp',
          response: JSON.stringify({
            environment: 'Simulation',
            template: 'PREZATCA-Code-Signing',
            keyId: key.id,
            fingerprint: csr.fingerprint,
          }),
          createdBy: ctx.user.id,
          updatedBy: ctx.user.id,
        }).returning({ id: zatcaCsrRequests.id, requestDate: zatcaCsrRequests.requestDate });

        await tx.update(zatcaDevices).set({
          registrationStatus: 'csr_ready',
          lastRegistrationDate: new Date(),
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
        }).where(eq(zatcaDevices.id, device.id));

        await tx.insert(zatcaLogs).values({
          orgId: ctx.user.orgId,
          eventType: 'simulation_csr_created',
          status: 'success',
          environment: 'simulation',
          userId: ctx.user.id,
          userName: (ctx.user as any).name ?? 'مسؤول',
          requestBody: JSON.stringify({
            posUnitId: unit.id,
            deviceId: device.id,
            csrRequestId: csrRequest.id,
            fingerprint: csr.fingerprint,
          }),
          responseBody: JSON.stringify({ template: 'PREZATCA-Code-Signing' }),
        });

        return {
          ok: true,
          posUnitId: unit.id,
          deviceId: device.id,
          csrRequestId: csrRequest.id,
          requestDate: csrRequest.requestDate,
          fingerprint: csr.fingerprint,
          environment: 'Simulation',
          template: 'PREZATCA-Code-Signing',
          privateKeyReturned: false,
          csrReturned: false,
        };
      });
    }),

  requestSimulationComplianceCsid: adminProcedure
    .input(z.object({
      posUnitId: z.number().int().positive(),
      csrRequestId: z.number().int().positive().optional(),
      otp: z.string().trim().min(1).max(32),
    }))
    .mutation(async ({ ctx, input }) => {
      requireSimulationEncryptionKey();
      const unit = await getPosUnitForOrg(ctx.user.orgId, input.posUnitId);
      const environment = await db.query.zatcaEnvironments.findFirst({
        where: and(
          eq(zatcaEnvironments.orgId, ctx.user.orgId),
          eq(zatcaEnvironments.name, 'Simulation'),
          eq(zatcaEnvironments.isActive, true),
          eq(zatcaEnvironments.isDeleted, false),
        ),
      });
      if (!environment) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'أنشئ CSR لوحدة الربط أولاً' });
      }
      const device = await db.query.zatcaDevices.findFirst({
        where: and(
          eq(zatcaDevices.orgId, ctx.user.orgId),
          eq(zatcaDevices.posUnitId, unit.id),
          eq(zatcaDevices.environmentId, environment.id),
          eq(zatcaDevices.isActive, true),
          eq(zatcaDevices.isDeleted, false),
        ),
      });
      if (!device) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'لا توجد وحدة EGS جاهزة لهذا الربط' });

      const csrRequest = await db.query.zatcaCsrRequests.findFirst({
        where: and(
          eq(zatcaCsrRequests.orgId, ctx.user.orgId),
          eq(zatcaCsrRequests.deviceId, device.id),
          ...(input.csrRequestId ? [eq(zatcaCsrRequests.id, input.csrRequestId)] : []),
          eq(zatcaCsrRequests.isActive, true),
          eq(zatcaCsrRequests.isDeleted, false),
        ),
        orderBy: desc(zatcaCsrRequests.createdAt),
      });
      if (!csrRequest?.csrText) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'لا يوجد CSR صالح لإرسال طلب Compliance CSID' });
      }

      // OTP يُستخدم في الذاكرة لهذا الطلب فقط ولا يدخل قاعدة البيانات أو السجل.
      const response = await postFatooraSimulation({
        apiPath: '/compliance',
        body: { csr: csrRequest.csrText },
        otp: input.otp,
      });
      const safeResponse = safeRemoteResponse(response);
      const rawBody = response.body && typeof response.body === 'object'
        ? response.body as Record<string, unknown>
        : {};
      const requestId = String(rawBody.requestID ?? rawBody.requestId ?? response.requestId ?? '') || null;
      const binarySecurityToken = String(rawBody.binarySecurityToken ?? '');
      const secret = String(rawBody.secret ?? '');
      const certificateValue = String(rawBody.certificate ?? rawBody.certificateContent ?? '');
      const successful = response.httpStatus != null
        && response.httpStatus >= 200
        && response.httpStatus < 300
        && Boolean(binarySecurityToken && secret);

      await db.update(zatcaCsrRequests).set({
        status: successful ? 'compliance_received' : 'compliance_failed',
        response: JSON.stringify(safeResponse),
        updatedAt: new Date(),
        updatedBy: ctx.user.id,
      }).where(eq(zatcaCsrRequests.id, csrRequest.id));

      await db.insert(zatcaRequestLog).values({
        orgId: ctx.user.orgId,
        url: response.url,
        httpMethod: 'POST',
        headers: { 'Accept-Version': 'V2', 'OTP': '[REDACTED]' },
        requestBody: JSON.stringify({ csr: '[REDACTED]' }),
        requestTime: new Date(),
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      });
      await db.insert(zatcaResponseLog).values({
        orgId: ctx.user.orgId,
        httpStatus: response.httpStatus,
        responseBody: JSON.stringify(safeResponse),
        responseTime: new Date(),
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      });

      if (!successful) {
        await db.insert(zatcaLogs).values({
          orgId: ctx.user.orgId,
          eventType: 'simulation_compliance_csid',
          status: 'error',
          environment: 'simulation',
          userId: ctx.user.id,
          userName: (ctx.user as any).name ?? 'مسؤول',
          requestBody: JSON.stringify({ csrRequestId: csrRequest.id }),
          responseBody: JSON.stringify(safeResponse),
          errorMessage: 'لم تُقبل استجابة Compliance CSID أو لم تصل نتيجة صالحة',
        });
        return {
          ok: false,
          requestId,
          httpStatus: response.httpStatus,
          result: safeResponse,
          message: 'لم يتم إنشاء Compliance CSID؛ راجع رد Fatoora Simulation',
        };
      }

      const key = await db.query.zatcaKeys.findFirst({
        where: and(
          eq(zatcaKeys.orgId, ctx.user.orgId),
          eq(zatcaKeys.deviceId, device.id),
          eq(zatcaKeys.isActive, true),
          eq(zatcaKeys.isDeleted, false),
        ),
        orderBy: desc(zatcaKeys.createdAt),
      });
      const [certificate] = await db.insert(zatcaCertificates).values({
        orgId: ctx.user.orgId,
        deviceId: device.id,
        csr: csrRequest.csrText,
        publicCertificate: certificateValue || null,
        privateKeyEncrypted: key?.privateKeyEncrypted ?? null,
        secretKeyEncrypted: encrypt(secret),
        complianceSecretEncrypted: encrypt(secret),
        certificateVersion: 'Simulation',
        status: 'active',
        isActive: true,
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      }).returning({ id: zatcaCertificates.id });
      const [csid] = await db.insert(zatcaCsid).values({
        orgId: ctx.user.orgId,
        deviceId: device.id,
        certificateId: certificate.id,
        complianceCsid: encrypt(binarySecurityToken),
        productionCsid: null,
        issueDate: new Date(),
        status: 'active',
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      }).returning({ id: zatcaCsid.id });
      await db.update(zatcaDevices).set({
        currentCsidId: csid.id,
        registrationStatus: 'active',
        lastRegistrationDate: new Date(),
        lastConnectionDate: new Date(),
        updatedAt: new Date(),
        updatedBy: ctx.user.id,
      }).where(eq(zatcaDevices.id, device.id));

      await db.insert(zatcaLogs).values({
        orgId: ctx.user.orgId,
        eventType: 'simulation_compliance_csid',
        status: 'success',
        environment: 'simulation',
        userId: ctx.user.id,
        userName: (ctx.user as any).name ?? 'مسؤول',
        requestBody: JSON.stringify({ csrRequestId: csrRequest.id }),
        responseBody: JSON.stringify(safeResponse),
      });
      return {
        ok: true,
        requestId,
        httpStatus: response.httpStatus,
        result: safeResponse,
        message: 'تم استلام Compliance CSID من منصة محاكاة فاتورة الرسمية وحفظه مشفّراً',
        secretsReturned: false,
      };
    }),

  requestSimulationOperationalCsid: adminProcedure
    .input(z.object({
      posUnitId: z.number().int().positive(),
      csrRequestId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireSimulationEncryptionKey();
      const unit = await getPosUnitForOrg(ctx.user.orgId, input.posUnitId);
      const environment = await db.query.zatcaEnvironments.findFirst({
        where: and(
          eq(zatcaEnvironments.orgId, ctx.user.orgId),
          eq(zatcaEnvironments.name, 'Simulation'),
          eq(zatcaEnvironments.isActive, true),
          eq(zatcaEnvironments.isDeleted, false),
        ),
      });
      if (!environment) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'لم تُهيّأ بيئة Simulation بعد' });
      }

      const device = await db.query.zatcaDevices.findFirst({
        where: and(
          eq(zatcaDevices.orgId, ctx.user.orgId),
          eq(zatcaDevices.posUnitId, unit.id),
          eq(zatcaDevices.environmentId, environment.id),
          eq(zatcaDevices.isActive, true),
          eq(zatcaDevices.isDeleted, false),
        ),
      });
      if (!device?.currentCsidId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'اطلب Compliance CSID أولاً' });
      }

      const csid = await db.query.zatcaCsid.findFirst({
        where: and(
          eq(zatcaCsid.id, device.currentCsidId),
          eq(zatcaCsid.orgId, ctx.user.orgId),
          eq(zatcaCsid.deviceId, device.id),
          eq(zatcaCsid.status, 'active'),
          eq(zatcaCsid.isActive, true),
          eq(zatcaCsid.isDeleted, false),
        ),
      });
      if (!csid?.complianceCsid || !csid.certificateId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Compliance CSID غير مكتمل لهذه الوحدة' });
      }

      const certificate = await db.query.zatcaCertificates.findFirst({
        where: and(
          eq(zatcaCertificates.id, csid.certificateId),
          eq(zatcaCertificates.orgId, ctx.user.orgId),
          eq(zatcaCertificates.deviceId, device.id),
          eq(zatcaCertificates.status, 'active'),
          eq(zatcaCertificates.isActive, true),
          eq(zatcaCertificates.isDeleted, false),
        ),
      });
      if (!certificate?.complianceSecretEncrypted && !certificate?.secretKeyEncrypted) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'سر Compliance CSID غير متوفر داخليًا' });
      }

      const csrRequest = await db.query.zatcaCsrRequests.findFirst({
        where: and(
          eq(zatcaCsrRequests.orgId, ctx.user.orgId),
          eq(zatcaCsrRequests.deviceId, device.id),
          ...(input.csrRequestId ? [eq(zatcaCsrRequests.id, input.csrRequestId)] : []),
          eq(zatcaCsrRequests.isActive, true),
          eq(zatcaCsrRequests.isDeleted, false),
        ),
        orderBy: desc(zatcaCsrRequests.createdAt),
      });
      const priorResponse = csrRequest?.response ? JSON.parse(csrRequest.response) as Record<string, unknown> : {};
      const complianceRequestId = String(
        priorResponse.requestId
        ?? priorResponse.requestID
        ?? '',
      );
      if (!complianceRequestId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'لم يُحفظ Request ID الخاص بـCompliance CSID' });
      }

      const response = await postFatooraSimulation({
        apiPath: '/production/csids',
        body: { compliance_request_id: complianceRequestId },
        binarySecurityToken: decrypt(csid.complianceCsid),
        secret: decrypt(certificate.complianceSecretEncrypted ?? certificate.secretKeyEncrypted ?? ''),
      });
      const safeResponse = safeRemoteResponse(response);
      const rawBody = response.body && typeof response.body === 'object'
        ? response.body as Record<string, unknown>
        : {};
      const requestId = String(rawBody.requestID ?? rawBody.requestId ?? response.requestId ?? '') || null;
      const operationalToken = String(rawBody.binarySecurityToken ?? '');
      const operationalSecret = String(rawBody.secret ?? '');
      const successful = response.httpStatus != null
        && response.httpStatus >= 200
        && response.httpStatus < 300
        && Boolean(operationalToken && operationalSecret);

      await db.insert(zatcaRequestLog).values({
        orgId: ctx.user.orgId,
        url: response.url,
        httpMethod: 'POST',
        headers: { 'Accept-Version': 'V2', Authorization: '[REDACTED]' },
        requestBody: JSON.stringify({ compliance_request_id: complianceRequestId }),
        requestTime: new Date(),
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      });
      await db.insert(zatcaResponseLog).values({
        orgId: ctx.user.orgId,
        httpStatus: response.httpStatus,
        responseBody: JSON.stringify(safeResponse),
        responseTime: new Date(),
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      });

      if (!successful) {
        await db.insert(zatcaLogs).values({
          orgId: ctx.user.orgId,
          eventType: 'simulation_operational_csid',
          status: 'error',
          environment: 'simulation',
          userId: ctx.user.id,
          userName: (ctx.user as any).name ?? 'مسؤول',
          requestBody: JSON.stringify({ posUnitId: unit.id, complianceRequestId }),
          responseBody: JSON.stringify(safeResponse),
          errorMessage: 'لم تُقبل استجابة CSID التشغيلي أو لم تصل نتيجة مكتملة',
        });
        return {
          ok: false,
          requestId,
          httpStatus: response.httpStatus,
          result: safeResponse,
          message: 'لم يتم إنشاء CSID التشغيلي؛ راجع رد Fatoora Simulation',
        };
      }

      await db.transaction(async (tx) => {
        await tx.update(zatcaCsid).set({
          productionCsid: encrypt(operationalToken),
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
        }).where(and(eq(zatcaCsid.id, csid.id), eq(zatcaCsid.orgId, ctx.user.orgId)));
        await tx.update(zatcaCertificates).set({
          secretKeyEncrypted: encrypt(operationalSecret),
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
        }).where(and(eq(zatcaCertificates.id, certificate.id), eq(zatcaCertificates.orgId, ctx.user.orgId)));
        await tx.update(zatcaDevices).set({
          registrationStatus: 'operational',
          lastConnectionDate: new Date(),
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
        }).where(and(eq(zatcaDevices.id, device.id), eq(zatcaDevices.orgId, ctx.user.orgId)));
        await tx.insert(zatcaLogs).values({
          orgId: ctx.user.orgId,
          eventType: 'simulation_operational_csid',
          status: 'success',
          environment: 'simulation',
          userId: ctx.user.id,
          userName: (ctx.user as any).name ?? 'مسؤول',
          requestBody: JSON.stringify({ posUnitId: unit.id, complianceRequestId }),
          responseBody: JSON.stringify(safeResponse),
        });
      });

      return {
        ok: true,
        requestId,
        httpStatus: response.httpStatus,
        result: safeResponse,
        message: 'تم استلام CSID التشغيلي من Fatoora Simulation وحفظه مشفّراً',
        secretsReturned: false,
      };
    }),

  getSimulationOnboardingStatus: protectedProcedure
    .input(z.object({ posUnitId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const unit = await getPosUnitForOrg(ctx.user.orgId, input.posUnitId);
      const environment = await db.query.zatcaEnvironments.findFirst({
        where: and(
          eq(zatcaEnvironments.orgId, ctx.user.orgId),
          eq(zatcaEnvironments.name, 'Simulation'),
          eq(zatcaEnvironments.isActive, true),
          eq(zatcaEnvironments.isDeleted, false),
        ),
      });
      if (!environment) return { environment: 'Simulation', device: null, csr: null, csid: null };
      const device = await db.query.zatcaDevices.findFirst({
        where: and(
          eq(zatcaDevices.orgId, ctx.user.orgId),
          eq(zatcaDevices.posUnitId, unit.id),
          eq(zatcaDevices.environmentId, environment.id),
          eq(zatcaDevices.isActive, true),
          eq(zatcaDevices.isDeleted, false),
        ),
        columns: {
          id: true,
          deviceName: true,
          serialNumber: true,
          registrationStatus: true,
          currentCsidId: true,
          lastRegistrationDate: true,
          lastConnectionDate: true,
        },
      });
      if (!device) return { environment: 'Simulation', device: null, csr: null, csid: null };
      const [csr, csid] = await Promise.all([
        db.query.zatcaCsrRequests.findFirst({
          where: and(
            eq(zatcaCsrRequests.orgId, ctx.user.orgId),
            eq(zatcaCsrRequests.deviceId, device.id),
            eq(zatcaCsrRequests.isActive, true),
            eq(zatcaCsrRequests.isDeleted, false),
          ),
          columns: { id: true, status: true, requestDate: true, updatedAt: true },
          orderBy: desc(zatcaCsrRequests.createdAt),
        }),
        device.currentCsidId == null ? null : db.query.zatcaCsid.findFirst({
          where: and(
            eq(zatcaCsid.id, device.currentCsidId),
            eq(zatcaCsid.orgId, ctx.user.orgId),
            eq(zatcaCsid.isActive, true),
            eq(zatcaCsid.isDeleted, false),
          ),
          columns: { id: true, status: true, issueDate: true, expiryDate: true },
        }),
      ]);
      return {
        environment: 'Simulation',
        device,
        csr,
        csid,
        operationalReady: device.registrationStatus === 'operational',
        endpoint: getSimulationUrl('/compliance'),
        secretsReturned: false,
      };
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
      columns: { name: true, nameEn: true, taxNumber: true, zatcaConfig: true },
    });
    const cfg = (org?.zatcaConfig ?? {}) as Record<string, unknown>;
    const parsed = ZatcaConfigSchema.parse(canonicalizeZatcaConfig(cfg, org));
    // لا تُعاد القيم الحساسة لأي دور؛ تُعاد حالة وجودها فقط.
    return {
      ...parsed,
      csid: parsed.csid ? REDACTED_CREDENTIAL : '',
      secretKey: parsed.secretKey ? REDACTED_CREDENTIAL : '',
      isAdmin: ctx.user.role === 'admin' || ctx.user.role === 'superadmin',
    };
  }),

  saveConfig: adminProcedure
    .input(ZatcaConfigSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.environment === 'production') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'بيئة Production محجوبة في هذه المرحلة؛ لا تحفظ إعدادات اتصال فعلية قبل تأمين بيئة النشر واعتماد Secrets',
        });
      }
      if (
        (input.csid.trim() && input.csid.trim() !== REDACTED_CREDENTIAL)
        || (input.secretKey.trim() && input.secretKey.trim() !== REDACTED_CREDENTIAL)
      ) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'لا يُسمح بحفظ CSID أو Secret Key في هذه المرحلة؛ استخدم محاكاة OTP فقط',
        });
      }
      const now = new Date().toISOString();
      const userName = (ctx.user as any).name ?? (ctx.user as any).username ?? 'مسؤول';

      const existing = await db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.user.orgId),
        columns: { name: true, nameEn: true, taxNumber: true, zatcaConfig: true },
      });
      const existingCfg = (existing?.zatcaConfig ?? {}) as any;

      const updated = {
        ...input,
        // هوية المنشأة لا تُحفظ من مركز ZATCA؛ مصدرها الوحيد معلومات المؤسسة.
        legalName: existing?.name ?? '',
        englishName: existing?.nameEn ?? '',
        vatNumber: existing?.taxNumber ?? '',
        // الاعتمادات القديمة تبقى داخل الخادم ولا تُعاد إلى العميل ولا تُستبدل
        // من مسار الإعداد العام؛ إدخال اعتماد جديد محجوب حتى اعتماد Secrets.
        csid: existingCfg.csid ?? '',
        secretKey: existingCfg.secretKey ?? '',
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

      // The Simulation environment record is created only after the admin
      // explicitly selects and saves Simulation; readiness/CSR never creates
      // it as a hidden side effect.
      if (input.environment === 'simulation') {
        const existingEnvironment = await db.query.zatcaEnvironments.findFirst({
          where: and(
            eq(zatcaEnvironments.orgId, ctx.user.orgId),
            eq(zatcaEnvironments.name, 'Simulation'),
            eq(zatcaEnvironments.isActive, true),
            eq(zatcaEnvironments.isDeleted, false),
          ),
          columns: { id: true },
        });
        if (!existingEnvironment) {
          await db.insert(zatcaEnvironments).values({
            orgId: ctx.user.orgId,
            ...simulationEnvironmentValues(),
            createdBy: ctx.user.id,
            updatedBy: ctx.user.id,
          });
        }
      }

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
      columns: { name: true, nameEn: true, taxNumber: true, zatcaConfig: true },
    });
    const cfg = canonicalizeZatcaConfig(org?.zatcaConfig, org);

    const now = new Date().toISOString();
    const userName = (ctx.user as any).name ?? (ctx.user as any).username ?? 'مسؤول';

    await db.update(organizations).set({
      zatcaConfig: {
        ...cfg,
        lastConnectionTest:   now,
        lastConnectionStatus: 'unknown',
      } as any,
      updatedAt: new Date(),
    }).where(eq(organizations.id, ctx.user.orgId));

    await db.insert(zatcaLogs).values({
      orgId:       ctx.user.orgId,
      eventType:   'connection_test',
      status:      'error',
      environment: cfg.environment ?? 'sandbox',
      userId:      ctx.user.id,
      userName,
      responseBody: JSON.stringify({ simulated: false, testedAt: now, reason: 'production_connector_not_implemented' }),
      errorMessage: 'اختبار الاتصال الفعلي غير منفذ؛ هذه المرحلة تسمح بمحاكاة OTP فقط',
    });

    return { ok: false, message: 'الاتصال الفعلي غير منفذ — استخدم OTP محاكاة فقط حتى اعتماد SDK وFatoora Simulation' };
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

  // ── إرسال ومتابعة فاتورة للهيئة ───────────────────────────────────────────
  submitInvoice: protectedProcedure
    .input(z.object({
      invoiceId:   z.number(),
      // Deprecated compatibility input. The server always uses the immutable
      // snapshot stored on sales_invoices instead of trusting the client.
      invoiceType: z.enum(['standard', 'simplified']).default('simplified'),
      mockOutcome: ZatcaMockOutcomeSchema.default('delayed'),
      forceResend: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const inv = await db.query.salesInvoices.findFirst({
        where: and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, ctx.user.orgId)),
      });
      if (!inv) throw new TRPCError({ code: 'NOT_FOUND', message: 'الفاتورة غير موجودة' });
      if (!inv.sellerLegalName?.trim() || !inv.sellerTaxNumber?.trim()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'لا يمكن إعادة إصدار QR/XML أو توقيع فاتورة قديمة: لقطة اسم المنشأة والرقم الضريبي غير محفوظة لهذه الفاتورة.',
        });
      }

      const persistedInvoiceType = inv.zatcaInvoiceType === 'standard' ? 'standard' : 'simplified';
      const operation: ZatcaOperation = persistedInvoiceType === 'standard' ? 'clearance' : 'reporting';
      const currentState = (inv.zatcaStatus ?? 'ready_to_submit') as ZatcaLifecycleState;
      if (isFinalZatcaState(currentState)) {
        return { ok: false, status: currentState, uuid: inv.zatcaUuid, message: 'الفاتورة تحمل نتيجة نهائية؛ لا يمكن إعادة إرسالها تلقائياً' };
      }

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.user.orgId),
        columns: { zatcaConfig: true, name: true, nameEn: true, taxNumber: true },
      });
      const cfg = canonicalizeZatcaConfig(org?.zatcaConfig, org);
      if (!cfg.enabled) {
        return { ok: false, status: currentState, message: 'منظومة ZATCA غير مفعَّلة' };
      }
      if (cfg.environment === 'production') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'اتصال Production مغلق في هذه المرحلة' });
      }

      let existing = await db.query.zatcaInvoiceTransactions.findFirst({
        where: and(
          eq(zatcaInvoiceTransactions.orgId, ctx.user.orgId),
          eq(zatcaInvoiceTransactions.invoiceId, input.invoiceId),
          eq(zatcaInvoiceTransactions.isActive, true),
          eq(zatcaInvoiceTransactions.isDeleted, false),
        ),
        orderBy: desc(zatcaInvoiceTransactions.createdAt),
      });
      if (existing && !input.forceResend && !isFinalZatcaState(existing.invoiceStatus)) {
        return {
          ok: true,
          status: existing.invoiceStatus,
          uuid: existing.invoiceUuid,
          correlationId: existing.correlationId,
          message: lifecycleMessage(existing.invoiceStatus as ZatcaLifecycleState),
          idempotent: true,
        };
      }

      const resolvedContext = await resolveZatcaContext({
        journalId: inv.journalId ?? -1,
        environment: cfg.environment === 'simulation' ? 'simulation' : 'sandbox',
        user: {
          id: ctx.user.id,
          orgId: ctx.user.orgId,
          role: ctx.user.role,
          userGroupId: ctx.user.userGroupId,
        },
      });

      const now = new Date();
      let uuid = inv.zatcaUuid ?? existing?.invoiceUuid?.toString() ?? crypto.randomUUID();
      let icv = inv.zatcaInvoiceCounter ?? existing?.invoiceCounter ?? input.invoiceId;
      let correlationId = existing?.correlationId ?? crypto.randomUUID();
      let idempotencyKey = `${ctx.user.orgId}:${input.invoiceId}:${uuid}:${operation}`;
      let attemptCount = (existing?.attemptCount ?? inv.zatcaAttemptCount ?? 0) + 1;
      let requestPayload = redactZatcaPayload({
        invoiceId: input.invoiceId,
        invoiceNumber: inv.invoiceNumber,
        uuid,
        icv,
        operation,
        idempotencyKey,
        submittedAt: now.toISOString(),
      }) as Record<string, unknown>;

      let transactionId = existing?.id;
      if (transactionId == null) {
        const [created] = await db.insert(zatcaInvoiceTransactions).values({
          orgId: ctx.user.orgId,
          invoiceId: input.invoiceId,
          invoiceNumber: inv.invoiceNumber,
          invoiceUuid: uuid,
          invoiceCounter: icv,
          submissionType: operation,
          invoiceStatus: 'ready_to_submit',
          correlationId,
          idempotencyKey,
          attemptCount: 0,
          deviceId: null,
          environmentId: null,
          createdBy: ctx.user.id,
          updatedBy: ctx.user.id,
        }).onConflictDoNothing().returning({ id: zatcaInvoiceTransactions.id });
        transactionId = created?.id;
        if (transactionId == null) {
          existing = await db.query.zatcaInvoiceTransactions.findFirst({
            where: and(
              eq(zatcaInvoiceTransactions.orgId, ctx.user.orgId),
              eq(zatcaInvoiceTransactions.invoiceId, input.invoiceId),
              eq(zatcaInvoiceTransactions.isActive, true),
              eq(zatcaInvoiceTransactions.isDeleted, false),
            ),
            orderBy: desc(zatcaInvoiceTransactions.createdAt),
          });
          if (!existing) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'تعذر تثبيت معاملة ZATCA الوحيدة للفواتير المتزامنة',
            });
          }
          transactionId = existing.id;
          uuid = existing.invoiceUuid?.toString() ?? uuid;
          icv = existing.invoiceCounter ?? icv;
          correlationId = existing.correlationId ?? correlationId;
          idempotencyKey = existing.idempotencyKey ?? `${ctx.user.orgId}:${input.invoiceId}:${uuid}:${operation}`;
          attemptCount = (existing.attemptCount ?? 0) + 1;
          requestPayload = redactZatcaPayload({
            invoiceId: input.invoiceId,
            invoiceNumber: inv.invoiceNumber,
            uuid,
            icv,
            operation,
            idempotencyKey,
            submittedAt: now.toISOString(),
          }) as Record<string, unknown>;
        }
      }

      await db.update(zatcaInvoiceTransactions).set({
        invoiceUuid: uuid,
        invoiceCounter: icv,
        submissionType: operation,
        invoiceStatus: 'submitting',
        correlationId,
        idempotencyKey,
        deviceId: resolvedContext.egs.id,
        environmentId: resolvedContext.environment.id,
        requestPayload: requestPayload as any,
        lastAttemptAt: now,
        attemptCount,
        updatedAt: now,
        updatedBy: ctx.user.id,
      }).where(eq(zatcaInvoiceTransactions.id, transactionId));

      await db.update(salesInvoices).set({
        zatcaUuid: uuid,
        zatcaInvoiceCounter: icv,
        zatcaStatus: 'submitting',
        zatcaSubmittedAt: inv.zatcaSubmittedAt ?? now,
        zatcaAttemptCount: attemptCount,
        zatcaResponse: null,
        zatcaRejectionReason: null,
        updatedAt: now,
      }).where(and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, ctx.user.orgId)));

      await db.insert(zatcaRequestLog).values({
        orgId: ctx.user.orgId,
        transactionId,
        url: 'mock://zatca/submit',
        httpMethod: 'POST',
        headers: { 'x-correlation-id': correlationId, 'idempotency-key': idempotencyKey },
        requestBody: JSON.stringify(requestPayload),
        requestTime: now,
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      });

      const [attempt] = await db.insert(zatcaSubmissionAttempts).values({
        orgId: ctx.user.orgId,
        transactionId,
        attemptNumber: attemptCount,
        startedAt: now,
        requestId: correlationId,
        requestPayload: requestPayload as any,
        result: 'started',
      }).onConflictDoNothing().returning({
        id: zatcaSubmissionAttempts.id,
        attemptId: zatcaSubmissionAttempts.attemptId,
      });
      if (!attempt) {
        const concurrent = await db.query.zatcaInvoiceTransactions.findFirst({
          where: and(
            eq(zatcaInvoiceTransactions.id, transactionId),
            eq(zatcaInvoiceTransactions.orgId, ctx.user.orgId),
          ),
        });
        return {
          ok: true,
          status: concurrent?.invoiceStatus ?? 'submitting',
          uuid: concurrent?.invoiceUuid ?? uuid,
          correlationId: concurrent?.correlationId ?? correlationId,
          message: lifecycleMessage((concurrent?.invoiceStatus ?? 'submitting') as ZatcaLifecycleState),
          idempotent: true,
        };
      }

      if (cfg.environment === 'simulation') {
        const [currentCsid, signingCertificate, signingKey, originalInvoice] = await Promise.all([
          db.query.zatcaCsid.findFirst({
            where: and(
              eq(zatcaCsid.id, resolvedContext.csid.id),
              eq(zatcaCsid.orgId, ctx.user.orgId),
              eq(zatcaCsid.deviceId, resolvedContext.egs.id),
              eq(zatcaCsid.isActive, true),
              eq(zatcaCsid.isDeleted, false),
            ),
          }),
          db.query.zatcaCertificates.findFirst({
            where: and(
              eq(zatcaCertificates.id, resolvedContext.certificate.id),
              eq(zatcaCertificates.orgId, ctx.user.orgId),
              eq(zatcaCertificates.deviceId, resolvedContext.egs.id),
              eq(zatcaCertificates.isActive, true),
              eq(zatcaCertificates.isDeleted, false),
              eq(zatcaCertificates.status, 'active'),
            ),
          }),
          db.query.zatcaKeys.findFirst({
            where: and(
              eq(zatcaKeys.orgId, ctx.user.orgId),
              eq(zatcaKeys.deviceId, resolvedContext.egs.id),
              eq(zatcaKeys.isActive, true),
              eq(zatcaKeys.isDeleted, false),
              eq(zatcaKeys.status, 'active'),
            ),
            orderBy: desc(zatcaKeys.createdAt),
          }),
          (inv.sourceDocumentId || inv.refInvoiceId || inv.basedOnNumber)
            ? db.query.salesInvoices.findFirst({
                where: and(
                  eq(salesInvoices.orgId, ctx.user.orgId),
                  eq(salesInvoices.invoiceType, 'sale'),
                  inv.sourceDocumentId
                    ? eq(salesInvoices.id, inv.sourceDocumentId)
                    : inv.refInvoiceId
                      ? eq(salesInvoices.id, inv.refInvoiceId)
                      : eq(salesInvoices.invoiceNumber, inv.basedOnNumber!),
                ),
                columns: {
                  invoiceNumber: true,
                  zatcaUuid: true,
                  invoiceDate: true,
                },
              })
            : Promise.resolve(null),
        ]);

        if (
          !currentCsid?.productionCsid
          || !signingCertificate?.publicCertificate
          || !signingCertificate.secretKeyEncrypted
          || !signingKey?.privateKeyEncrypted
          || resolvedContext.egs.registrationStatus !== 'operational'
        ) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'الإرسال الرسمي يتطلب CSID تشغيلياً وشهادة ومفتاحاً صالحين لوحدة EGS',
          });
        }
        if (['return', 'credit_note', 'debit_note'].includes(inv.invoiceType)
          && (!originalInvoice?.zatcaUuid || !originalInvoice.invoiceNumber)) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'المستند الإلكتروني يتطلب فاتورة أصلية مرتبطة تحمل UUID رسميًا',
          });
        }

        let signed: ReturnType<typeof buildAndSignSimulationInvoice>;
        try {
          signed = buildAndSignSimulationInvoice({
            invoice: inv,
            items: await db.select({
              id: salesInvoiceItems.id,
              productName: salesInvoiceItems.productName,
              quantity: salesInvoiceItems.quantity,
              unit: salesInvoiceItems.unit,
              unitPrice: salesInvoiceItems.unitPrice,
              total: salesInvoiceItems.total,
              taxAmount: salesInvoiceItems.taxAmount,
              taxPercent: salesInvoiceItems.taxPercent,
              discountAmount: salesInvoiceItems.discountAmount,
            }).from(salesInvoiceItems).where(and(
              eq(salesInvoiceItems.invoiceId, input.invoiceId),
              eq(salesInvoiceItems.orgId, ctx.user.orgId),
            )).orderBy(asc(salesInvoiceItems.sortOrder)),
            seller: {
              nameAr: String(inv.sellerLegalName ?? cfg.legalName ?? org?.name ?? ''),
              nameEn: String(cfg.englishName ?? cfg.legalName ?? org?.name ?? ''),
              vatNumber: String(inv.sellerTaxNumber ?? cfg.vatNumber ?? ''),
              crNumber: cfg.commercialReg ? String(cfg.commercialReg) : undefined,
              street: String(cfg.street ?? ''),
              building: String(cfg.buildingNumber ?? ''),
              district: String(cfg.district ?? ''),
              city: String(cfg.city ?? ''),
              postalCode: String(cfg.postalCode ?? ''),
              countryCode: String(cfg.countryCode ?? 'SA'),
            },
            uuid,
            invoiceCounter: icv,
            previousInvoiceHash: inv.zatcaPih ?? '',
            submissionType: operation,
            privateKeyPem: decrypt(signingKey.privateKeyEncrypted),
            certificatePem: signingCertificate.publicCertificate,
            originalInvoice: originalInvoice?.zatcaUuid && originalInvoice.invoiceNumber
              ? {
                  invoiceNumber: originalInvoice.invoiceNumber,
                  uuid: originalInvoice.zatcaUuid,
                  invoiceDate: originalInvoice.invoiceDate,
                }
              : undefined,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'تعذر توقيع XML الفاتورة';
          await db.update(zatcaSubmissionAttempts).set({
            finishedAt: new Date(),
            result: 'rejected',
            errorMessage: message,
          }).where(eq(zatcaSubmissionAttempts.id, attempt.id));
          await db.update(zatcaInvoiceTransactions).set({
            invoiceStatus: 'rejected',
            lastError: message,
            responseDate: new Date(),
            updatedAt: new Date(),
            updatedBy: ctx.user.id,
          }).where(eq(zatcaInvoiceTransactions.id, transactionId));
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message });
        }

        await db.update(zatcaInvoiceTransactions).set({
          invoiceHash: signed.invoiceHash,
          requestPayload: redactZatcaPayload({
            ...requestPayload,
            invoiceHash: signed.invoiceHash,
            invoice: '[BASE64_SIGNED_XML]',
          }) as any,
          updatedAt: new Date(),
          updatedBy: ctx.user.id,
        }).where(eq(zatcaInvoiceTransactions.id, transactionId));

        const authorityResponse = await postFatooraSimulation({
          apiPath: operation === 'clearance'
            ? '/invoices/clearance/single'
            : '/invoices/reporting/single',
          body: {
            invoiceHash: signed.invoiceHash,
            uuid,
            invoice: signed.invoiceBase64,
          },
          binarySecurityToken: decrypt(currentCsid.productionCsid),
          secret: decrypt(signingCertificate.secretKeyEncrypted),
          clearance: operation === 'clearance',
          clearanceStatus: operation === 'clearance' ? '1' : '0',
          correlationId,
          idempotencyKey,
        });
        const safeAuthorityResponse = safeRemoteResponse(authorityResponse) as Record<string, unknown>;
        const authorityBody = authorityResponse.body && typeof authorityResponse.body === 'object'
          ? authorityResponse.body as Record<string, any>
          : {};
        const accepted = authorityResponse.httpStatus != null
          && authorityResponse.httpStatus >= 200
          && authorityResponse.httpStatus < 300
          && (
            Array.isArray(authorityBody.acceptedInvoices) && authorityBody.acceptedInvoices.length > 0
            || String(authorityBody.reportingStatus ?? '').toUpperCase() === 'REPORTED'
            || String(authorityBody.clearanceStatus ?? '').toUpperCase() === 'CLEARED'
          );
        const nextState: ZatcaLifecycleState = accepted
          ? (operation === 'clearance' ? 'cleared' : 'reported')
          : authorityResponse.httpStatus == null
            ? 'uncertain'
            : 'rejected';
        const responseTime = new Date();
        const responseError = accepted ? null : `Fatoora Simulation لم تقبل الطلب (${authorityResponse.httpStatus ?? 'بدون رد'})`;
        const responsePayload = redactZatcaPayload({
          ...safeAuthorityResponse,
          uuid,
          invoiceHash: signed.invoiceHash,
          correlationId,
        }) as Record<string, unknown>;

        await db.update(zatcaSubmissionAttempts).set({
          finishedAt: responseTime,
          httpStatus: authorityResponse.httpStatus,
          responsePayload: responsePayload as any,
          result: nextState,
          errorMessage: responseError,
        }).where(eq(zatcaSubmissionAttempts.id, attempt.id));
        await db.update(zatcaInvoiceTransactions).set({
          invoiceStatus: nextState,
          invoiceHash: signed.invoiceHash,
          httpStatus: authorityResponse.httpStatus,
          authorityStatus: accepted ? (operation === 'clearance' ? 'CLEARED' : 'REPORTED') : 'REJECTED',
          responsePayload: responsePayload as any,
          responseDate: authorityResponse.httpStatus == null ? null : responseTime,
          uncertainAt: nextState === 'uncertain' ? responseTime : null,
          lastError: responseError,
          updatedAt: responseTime,
          updatedBy: ctx.user.id,
        }).where(eq(zatcaInvoiceTransactions.id, transactionId));
        await db.update(salesInvoices).set({
          zatcaUuid: uuid,
          zatcaHash: signed.invoiceHash,
          zatcaXml: signed.signedXml,
          zatcaStatus: nextState,
          zatcaResponse: responsePayload,
          zatcaAttemptCount: attemptCount,
          zatcaSubmittedAt: inv.zatcaSubmittedAt ?? now,
          zatcaRejectionReason: responseError,
          ...(nextState === 'cleared' || nextState === 'reported' ? { zatcaClearedAt: responseTime } : {}),
          updatedAt: responseTime,
        }).where(and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, ctx.user.orgId)));
        await db.insert(zatcaRequestLog).values({
          orgId: ctx.user.orgId,
          transactionId,
          url: authorityResponse.url,
          httpMethod: 'POST',
          headers: { 'x-correlation-id': correlationId, 'idempotency-key': idempotencyKey },
          requestBody: JSON.stringify({ invoiceHash: signed.invoiceHash, uuid, invoice: '[BASE64_SIGNED_XML]' }),
          requestTime: now,
          createdBy: ctx.user.id,
          updatedBy: ctx.user.id,
        });
        await db.insert(zatcaResponseLog).values({
          orgId: ctx.user.orgId,
          transactionId,
          httpStatus: authorityResponse.httpStatus,
          responseBody: JSON.stringify(responsePayload),
          responseTime,
          createdBy: ctx.user.id,
          updatedBy: ctx.user.id,
        });
        await db.insert(zatcaLogs).values({
          orgId: ctx.user.orgId,
          invoiceId: input.invoiceId,
          invoiceNumber: inv.invoiceNumber,
          eventType: 'simulation_submit',
          status: nextState,
          environment: 'simulation',
          userId: ctx.user.id,
          userName: (ctx.user as any).name ?? (ctx.user as any).username ?? 'مستخدم',
          requestBody: JSON.stringify({ invoiceId: input.invoiceId, invoiceHash: signed.invoiceHash, uuid, operation }),
          responseBody: JSON.stringify(responsePayload),
          errorMessage: responseError,
        });

        return {
          ok: accepted,
          status: nextState,
          uuid,
          icv,
          correlationId,
          operation,
          invoiceHash: signed.invoiceHash,
          response: responsePayload,
          message: accepted
            ? operation === 'clearance' ? 'تم التخليص من Fatoora Simulation' : 'تم الإبلاغ إلى Fatoora Simulation'
            : nextState === 'uncertain'
              ? 'أُرسل الطلب ولم تصل نتيجة نهائية؛ أعد المحاولة بنفس المعرفات'
              : 'رفضت Fatoora Simulation الفاتورة',
          idempotent: false,
        };
      }

      const response = buildMockAuthorityResponse({
        operation,
        outcome: input.mockOutcome,
        uuid,
        icv,
        correlationId,
        now: now.toISOString(),
      });
      const nextState = stateForMockOutcome(operation, input.mockOutcome);
      if (
        !canTransitionZatcaState(currentState, 'submitting')
        || !canTransitionZatcaState('submitting', nextState)
      ) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `انتقال حالة ZATCA غير مسموح: ${currentState} → submitting → ${nextState}`,
        });
      }
      const responseDate = response.receivedAt ? new Date(response.receivedAt) : null;
      const errorText = response.errors.length ? response.errors.map((item) => item.message).join('، ') : null;
      const safeResponse = redactZatcaPayload(response) as Record<string, unknown>;
      await db.update(zatcaSubmissionAttempts).set({
        finishedAt: new Date(),
        httpStatus: response.httpStatus,
        responsePayload: safeResponse as any,
        result: nextState,
        errorMessage: errorText,
      }).where(eq(zatcaSubmissionAttempts.id, attempt.id));

      if (!isFinalZatcaState(nextState)) {
        await enqueueZatcaSubmission({
          orgId: ctx.user.orgId,
          transactionId,
          posUnitId: resolvedContext.posUnit.id,
          deviceId: resolvedContext.egs.id,
          operation,
          uuid,
          invoiceCounter: icv,
          idempotencyKey,
          mockOutcome: input.mockOutcome,
          initialState: input.mockOutcome === 'connection_issue' ? 'retry_pending' : 'uncertain',
          availableAt: new Date(now.getTime() + 5 * 60 * 1000),
        });
      }

      await db.update(zatcaInvoiceTransactions).set({
        invoiceStatus: nextState,
        httpStatus: response.httpStatus,
        authorityStatus: response.authorityStatus,
        warnings: response.warnings as any,
        errors: response.errors as any,
        responsePayload: safeResponse as any,
        responseDate,
        uncertainAt: isUncertainZatcaState(nextState) ? now : null,
        lastError: errorText,
        nextRetryAt: nextState === 'connection_issue' || isUncertainZatcaState(nextState)
          ? new Date(now.getTime() + 5 * 60 * 1000)
          : null,
        updatedAt: new Date(),
        updatedBy: ctx.user.id,
      }).where(eq(zatcaInvoiceTransactions.id, transactionId));
      if (response.receivedAt) {
        await db.insert(zatcaResponseLog).values({
          orgId: ctx.user.orgId,
          transactionId,
          httpStatus: response.httpStatus,
          responseBody: JSON.stringify(safeResponse),
          responseTime: responseDate ?? now,
          createdBy: ctx.user.id,
          updatedBy: ctx.user.id,
        });
      }
      if (
        errorText
        || input.mockOutcome === 'connection_issue'
        || input.mockOutcome === 'connection_loss'
      ) {
        await db.insert(zatcaErrorLog).values({
          orgId: ctx.user.orgId,
          transactionId,
          errorCode: input.mockOutcome === 'connection_loss'
            ? 'RESPONSE_LOST'
            : input.mockOutcome === 'connection_issue'
              ? 'CONNECTION_ERROR'
              : 'AUTHORITY_REJECTED',
          errorType: input.mockOutcome === 'connection_issue' || input.mockOutcome === 'connection_loss'
            ? 'connection'
            : 'authority',
          errorMessage: errorText ?? (
            input.mockOutcome === 'connection_loss'
              ? 'انقطع الاتصال بعد إرسال الطلب وقبل وصول النتيجة النهائية'
              : 'تعذر الاتصال بناقل ZATCA'
          ),
          retryCount: attemptCount,
          createdBy: ctx.user.id,
          updatedBy: ctx.user.id,
        });
      }

      const invoiceUpdate: Record<string, unknown> = {
        zatcaStatus: nextState,
        zatcaResponse: safeResponse,
        zatcaAttemptCount: attemptCount,
        zatcaSubmittedAt: inv.zatcaSubmittedAt ?? now,
        zatcaRejectionReason: errorText,
        updatedAt: new Date(),
      };
      if (nextState === 'cleared' || nextState === 'reported') invoiceUpdate.zatcaClearedAt = responseDate;
      await db.update(salesInvoices).set(invoiceUpdate as any)
        .where(and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, ctx.user.orgId)));

      const userName = (ctx.user as any).name ?? (ctx.user as any).username ?? 'مستخدم';
      await db.insert(zatcaLogs).values({
        orgId: ctx.user.orgId,
        invoiceId: input.invoiceId,
        invoiceNumber: inv.invoiceNumber,
        eventType: input.forceResend ? 'retry' : 'submit',
        status: nextState,
        environment: String(cfg.environment ?? 'sandbox'),
        userId: ctx.user.id,
        userName,
        requestBody: JSON.stringify(requestPayload),
        responseBody: JSON.stringify(safeResponse),
        errorMessage: errorText,
      });

      return {
        ok: true,
        status: nextState,
        uuid,
        icv,
        correlationId,
        operation,
        response: safeResponse,
        message: lifecycleMessage(nextState),
        idempotent: false,
      };
    }),

  retryInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [invoice, transaction] = await Promise.all([
        db.query.salesInvoices.findFirst({
          where: and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, ctx.user.orgId)),
          columns: { id: true, zatcaStatus: true },
        }),
        db.query.zatcaInvoiceTransactions.findFirst({
          where: and(
            eq(zatcaInvoiceTransactions.invoiceId, input.invoiceId),
            eq(zatcaInvoiceTransactions.orgId, ctx.user.orgId),
            eq(zatcaInvoiceTransactions.isActive, true),
            eq(zatcaInvoiceTransactions.isDeleted, false),
          ),
          orderBy: desc(zatcaInvoiceTransactions.createdAt),
        }),
      ]);
      if (!invoice || !transaction) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'لا توجد معاملة ZATCA قابلة لإعادة المحاولة' });
      }
      if (isFinalZatcaState(transaction.invoiceStatus)) {
        throw new TRPCError({ code: 'CONFLICT', message: 'الفاتورة تحمل نتيجة نهائية ولا تحتاج إعادة محاولة' });
      }
      if (!canTransitionZatcaState(transaction.invoiceStatus, 'retry_pending')) {
        throw new TRPCError({ code: 'CONFLICT', message: 'لا يمكن وضع هذه المعاملة في قائمة إعادة المحاولة' });
      }

      const now = new Date();
      await db.update(zatcaInvoiceTransactions).set({
        invoiceStatus: 'retry_pending',
        nextRetryAt: now,
        updatedAt: now,
        updatedBy: ctx.user.id,
      }).where(eq(zatcaInvoiceTransactions.id, transaction.id));
      await db.update(salesInvoices).set({
        zatcaStatus: 'retry_pending',
        updatedAt: now,
      }).where(and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, ctx.user.orgId)));
      await db.update(zatcaSubmissionQueue).set({
        state: 'queued',
        availableAt: now,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        updatedAt: now,
      }).where(and(
        eq(zatcaSubmissionQueue.transactionId, transaction.id),
        eq(zatcaSubmissionQueue.orgId, ctx.user.orgId),
        sql`${zatcaSubmissionQueue.state} IN ('retry_pending', 'processing', 'uncertain')`,
      ));
      await db.insert(zatcaLogs).values({
        orgId: ctx.user.orgId,
        invoiceId: input.invoiceId,
        eventType: 'retry_scheduled',
        status: 'retry_pending',
        userId: ctx.user.id,
        userName: (ctx.user as any).name ?? 'مستخدم',
        requestBody: JSON.stringify({
          transactionId: transaction.id,
          uuid: transaction.invoiceUuid,
          icv: transaction.invoiceCounter,
          correlationId: transaction.correlationId,
        }),
      });
      return {
        ok: true,
        status: 'retry_pending' as const,
        transactionId: transaction.id,
        uuid: transaction.invoiceUuid,
        icv: transaction.invoiceCounter,
        correlationId: transaction.correlationId,
        message: lifecycleMessage('retry_pending'),
      };
    }),

  // ── حالة هيئة ZATCA لا تُعدّل يدوياً ─────────────────────────────────────
  updateInvoiceStatus: adminProcedure
    .input(z.object({
      invoiceId: z.number(),
      status: z.enum(['ready_to_submit', 'retry_pending']),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db.update(salesInvoices).set({
        zatcaStatus: input.status,
        updatedAt: new Date(),
      }).where(and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, ctx.user.orgId))).returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'الفاتورة غير موجودة' });
      await db.insert(zatcaLogs).values({
        orgId: ctx.user.orgId,
        invoiceId: input.invoiceId,
        eventType: 'manual_review',
        status: input.status,
        userId: ctx.user.id,
        userName: (ctx.user as any).name ?? 'مسؤول',
        requestBody: JSON.stringify({ notes: input.notes }),
      });
      return { ok: true, status: input.status };
    }),

  // ── سجل العمليات ──────────────────────────────────────────────────────────
  getLifecycle: protectedProcedure
    .input(z.object({ invoiceId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const [invoice, transaction] = await Promise.all([
        db.query.salesInvoices.findFirst({
          where: and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, ctx.user.orgId)),
          columns: {
            id: true,
            invoiceNumber: true,
            zatcaUuid: true,
            zatcaInvoiceCounter: true,
            zatcaStatus: true,
            zatcaResponse: true,
            zatcaSubmittedAt: true,
            zatcaAttemptCount: true,
            zatcaRejectionReason: true,
          },
        }),
        db.query.zatcaInvoiceTransactions.findFirst({
          where: and(
            eq(zatcaInvoiceTransactions.invoiceId, input.invoiceId),
            eq(zatcaInvoiceTransactions.orgId, ctx.user.orgId),
            eq(zatcaInvoiceTransactions.isActive, true),
            eq(zatcaInvoiceTransactions.isDeleted, false),
          ),
          orderBy: desc(zatcaInvoiceTransactions.createdAt),
        }),
      ]);
      if (!invoice) throw new TRPCError({ code: 'NOT_FOUND', message: 'الفاتورة غير موجودة' });
      if (!transaction) return { invoice, transaction: null, requests: [], responses: [], errors: [] };

      const [requests, responses, errors, attempts, queue] = await Promise.all([
        db.query.zatcaRequestLog.findMany({
          where: and(eq(zatcaRequestLog.transactionId, transaction.id), eq(zatcaRequestLog.orgId, ctx.user.orgId)),
          orderBy: desc(zatcaRequestLog.requestTime),
        }),
        db.query.zatcaResponseLog.findMany({
          where: and(eq(zatcaResponseLog.transactionId, transaction.id), eq(zatcaResponseLog.orgId, ctx.user.orgId)),
          orderBy: desc(zatcaResponseLog.responseTime),
        }),
        db.query.zatcaErrorLog.findMany({
          where: and(eq(zatcaErrorLog.transactionId, transaction.id), eq(zatcaErrorLog.orgId, ctx.user.orgId)),
          orderBy: desc(zatcaErrorLog.createdAt),
        }),
        db.query.zatcaSubmissionAttempts.findMany({
          where: and(
            eq(zatcaSubmissionAttempts.transactionId, transaction.id),
            eq(zatcaSubmissionAttempts.orgId, ctx.user.orgId),
          ),
          orderBy: desc(zatcaSubmissionAttempts.startedAt),
        }),
        db.query.zatcaSubmissionQueue.findMany({
          where: and(
            eq(zatcaSubmissionQueue.transactionId, transaction.id),
            eq(zatcaSubmissionQueue.orgId, ctx.user.orgId),
          ),
          orderBy: desc(zatcaSubmissionQueue.createdAt),
        }),
      ]);
      return { invoice, transaction, requests, responses, errors, attempts, queue };
    }),

  getUncertainInvoices: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const uncertainStates = ['submitted_pending', 'connection_issue', 'retry_pending', 'uncertain'];
      return db.select({
        invoiceId: salesInvoices.id,
        invoiceNumber: salesInvoices.invoiceNumber,
        invoiceDate: salesInvoices.invoiceDate,
        total: salesInvoices.total,
        zatcaUuid: salesInvoices.zatcaUuid,
        zatcaInvoiceCounter: salesInvoices.zatcaInvoiceCounter,
        zatcaStatus: salesInvoices.zatcaStatus,
        transactionId: zatcaInvoiceTransactions.id,
        operation: zatcaInvoiceTransactions.submissionType,
        correlationId: zatcaInvoiceTransactions.correlationId,
        lastAttemptAt: zatcaInvoiceTransactions.lastAttemptAt,
        nextRetryAt: zatcaInvoiceTransactions.nextRetryAt,
        attemptCount: zatcaInvoiceTransactions.attemptCount,
        lastError: zatcaInvoiceTransactions.lastError,
        authorityStatus: zatcaInvoiceTransactions.authorityStatus,
      })
        .from(zatcaInvoiceTransactions)
        .innerJoin(salesInvoices, eq(salesInvoices.id, zatcaInvoiceTransactions.invoiceId))
        .where(and(
          eq(zatcaInvoiceTransactions.orgId, ctx.user.orgId),
          eq(salesInvoices.orgId, ctx.user.orgId),
          eq(zatcaInvoiceTransactions.isActive, true),
          eq(zatcaInvoiceTransactions.isDeleted, false),
          sql`${zatcaInvoiceTransactions.invoiceStatus} IN (${sql.join(uncertainStates.map((state) => sql`${state}`), sql`, `)})`,
        ))
        .orderBy(desc(zatcaInvoiceTransactions.updatedAt))
        .limit(input.limit);
    }),

  matchAuthorityResponse: adminProcedure
    .input(z.object({
      invoiceId: z.number().int().positive(),
      correlationId: z.string().trim().min(1).optional(),
      outcome: z.enum(['accepted', 'accepted_with_warnings', 'rejected', 'pending', 'unknown']),
      authorityStatus: z.string().trim().min(1).max(100),
      httpStatus: z.number().int().min(100).max(599).nullable().optional(),
      warnings: z.array(z.object({ code: z.string(), message: z.string() })).default([]),
      errors: z.array(z.object({ code: z.string(), message: z.string() })).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const transaction = await db.query.zatcaInvoiceTransactions.findFirst({
        where: and(
          eq(zatcaInvoiceTransactions.invoiceId, input.invoiceId),
          eq(zatcaInvoiceTransactions.orgId, ctx.user.orgId),
          eq(zatcaInvoiceTransactions.isActive, true),
          eq(zatcaInvoiceTransactions.isDeleted, false),
        ),
        orderBy: desc(zatcaInvoiceTransactions.createdAt),
      });
      if (!transaction) throw new TRPCError({ code: 'NOT_FOUND', message: 'لا توجد معاملة ZATCA لمطابقة الرد' });
      if (input.correlationId && transaction.correlationId !== input.correlationId) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Correlation ID لا يطابق معاملة الفاتورة' });
      }
      const operation = transaction.submissionType === 'reporting' ? 'reporting' : 'clearance';
      const nextState: ZatcaLifecycleState =
        input.outcome === 'accepted' ? (operation === 'clearance' ? 'cleared' : 'reported')
          : input.outcome === 'accepted_with_warnings' ? 'accepted_with_warnings'
          : input.outcome === 'rejected' ? 'rejected'
          : input.outcome === 'pending' ? 'submitted_pending'
          : 'uncertain';
      const now = new Date();
      const responsePayload = redactZatcaPayload({
        correlationId: transaction.correlationId,
        uuid: transaction.invoiceUuid,
        icv: transaction.invoiceCounter,
        authorityStatus: input.authorityStatus,
        warnings: input.warnings,
        errors: input.errors,
        matchedAt: now.toISOString(),
      }) as any;
      await db.update(zatcaInvoiceTransactions).set({
        invoiceStatus: nextState,
        authorityStatus: input.authorityStatus,
        httpStatus: input.httpStatus ?? null,
        warnings: input.warnings as any,
        errors: input.errors as any,
        responsePayload,
        responseDate: now,
        uncertainAt: isUncertainZatcaState(nextState) ? now : null,
        nextRetryAt: isUncertainZatcaState(nextState) ? new Date(now.getTime() + 5 * 60 * 1000) : null,
        lastError: input.errors.map((error) => error.message).join('، ') || null,
        updatedAt: now,
        updatedBy: ctx.user.id,
      }).where(eq(zatcaInvoiceTransactions.id, transaction.id));
      await db.update(salesInvoices).set({
        zatcaStatus: nextState,
        zatcaResponse: responsePayload,
        zatcaRejectionReason: input.errors.map((error) => error.message).join('، ') || null,
        zatcaClearedAt: nextState === 'cleared' || nextState === 'reported' ? now : null,
        updatedAt: now,
      }).where(and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, ctx.user.orgId)));
      await db.insert(zatcaResponseLog).values({
        orgId: ctx.user.orgId,
        transactionId: transaction.id,
        httpStatus: input.httpStatus ?? null,
        responseBody: JSON.stringify(responsePayload),
        responseTime: now,
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      });
      await db.insert(zatcaLogs).values({
        orgId: ctx.user.orgId,
        invoiceId: input.invoiceId,
        eventType: 'authority_reconciliation',
        status: nextState,
        userId: ctx.user.id,
        userName: (ctx.user as any).name ?? 'مسؤول',
        responseBody: JSON.stringify(responsePayload),
        errorMessage: input.errors.map((error) => error.message).join('، ') || null,
      });
      return { ok: true, status: nextState, message: lifecycleMessage(nextState) };
    }),

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
      columns: { zatcaConfig: true, name: true, nameEn: true, taxNumber: true },
    });
    const cfg = canonicalizeZatcaConfig(org?.zatcaConfig, org);

    const [total, readyToSubmit, cleared, reported, pending, submittedPending, submitting, acceptedWithWarnings, rejected, connectionIssue, retryPending, uncertain, errors, notSubmitted, today, simplifiedDueSoon, simplifiedOverdue] = await Promise.all([
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.invoiceType, 'sale'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(
          eq(salesInvoices.orgId, ctx.user.orgId),
          eq(salesInvoices.invoiceType, 'sale'),
          sql`${salesInvoices.zatcaStatus} IS NULL OR ${salesInvoices.zatcaStatus} IN ('not_submitted', 'ready_to_submit')`,
        )),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.zatcaStatus, 'cleared'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.zatcaStatus, 'reported'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.zatcaStatus, 'pending'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.zatcaStatus, 'submitted_pending'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.zatcaStatus, 'submitting'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.zatcaStatus, 'accepted_with_warnings'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.zatcaStatus, 'rejected'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.zatcaStatus, 'connection_issue'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.zatcaStatus, 'retry_pending'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.zatcaStatus, 'uncertain'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, ctx.user.orgId), eq(salesInvoices.zatcaStatus, 'error'))),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(
          eq(salesInvoices.orgId, ctx.user.orgId),
          sql`${salesInvoices.zatcaStatus} IS NULL OR ${salesInvoices.zatcaStatus} IN ('not_submitted', 'ready_to_submit')`,
        )),
      db.select({ cnt: count() }).from(salesInvoices)
        .where(and(
          eq(salesInvoices.orgId, ctx.user.orgId),
          eq(salesInvoices.invoiceType, 'sale'),
          gte(salesInvoices.invoiceDate, new Date(new Date().setHours(0, 0, 0, 0))),
        )),
      db.select({ cnt: count() }).from(salesInvoices)
        .innerJoin(zatcaInvoiceTransactions, eq(zatcaInvoiceTransactions.invoiceId, salesInvoices.id))
        .where(and(
          eq(salesInvoices.orgId, ctx.user.orgId),
          eq(zatcaInvoiceTransactions.orgId, ctx.user.orgId),
          eq(zatcaInvoiceTransactions.submissionType, 'reporting'),
          sql`${salesInvoices.invoiceDate} >= now() - interval '24 hours'`,
          sql`${salesInvoices.invoiceDate} < now() - interval '20 hours'`,
          notInArray(salesInvoices.zatcaStatus, ['cleared', 'reported', 'accepted_with_warnings', 'rejected']),
        )),
      db.select({ cnt: count() }).from(salesInvoices)
        .innerJoin(zatcaInvoiceTransactions, eq(zatcaInvoiceTransactions.invoiceId, salesInvoices.id))
        .where(and(
          eq(salesInvoices.orgId, ctx.user.orgId),
          eq(zatcaInvoiceTransactions.orgId, ctx.user.orgId),
          eq(zatcaInvoiceTransactions.submissionType, 'reporting'),
          sql`${salesInvoices.invoiceDate} < now() - interval '24 hours'`,
          notInArray(salesInvoices.zatcaStatus, ['cleared', 'reported', 'accepted_with_warnings', 'rejected']),
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
      readyToSubmit:       readyToSubmit[0]?.cnt ?? 0,
      cleared:             cleared[0]?.cnt ?? 0,
      reported:            reported[0]?.cnt ?? 0,
      pending:             pending[0]?.cnt ?? 0,
      submittedPending:    submittedPending[0]?.cnt ?? 0,
      submitting:          submitting[0]?.cnt ?? 0,
      acceptedWithWarnings: acceptedWithWarnings[0]?.cnt ?? 0,
      rejected:            rejected[0]?.cnt ?? 0,
      connectionIssue:     connectionIssue[0]?.cnt ?? 0,
      retryPending:        retryPending[0]?.cnt ?? 0,
      uncertain:           uncertain[0]?.cnt ?? 0,
      errors:              errors[0]?.cnt ?? 0,
      notSubmitted:        notSubmitted[0]?.cnt ?? 0,
      todayCount:          today[0]?.cnt ?? 0,
      simplifiedReportingDueSoon: simplifiedDueSoon[0]?.cnt ?? 0,
      simplifiedReportingOverdue: simplifiedOverdue[0]?.cnt ?? 0,
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
      const [inv, items, org, originalInvoice] = await Promise.all([
        db.query.salesInvoices.findFirst({
          where: and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.orgId, ctx.user.orgId)),
        }),
        db.select().from(salesInvoiceItems)
          .where(and(eq(salesInvoiceItems.invoiceId, input.invoiceId), eq(salesInvoiceItems.orgId, ctx.user.orgId)))
          .orderBy(salesInvoiceItems.sortOrder),
        db.query.organizations.findFirst({
          where: eq(organizations.id, ctx.user.orgId),
          columns: { zatcaConfig: true, name: true, nameEn: true, taxNumber: true },
        }),
        db.query.salesInvoices.findFirst({
          where: and(
            eq(salesInvoices.orgId, ctx.user.orgId),
            eq(salesInvoices.invoiceType, 'sale'),
            sql`${salesInvoices.id} = COALESCE(
              (SELECT source_document_id FROM sales_invoices WHERE id = ${input.invoiceId}),
              (SELECT ref_invoice_id FROM sales_invoices WHERE id = ${input.invoiceId}),
              (SELECT original.id
               FROM sales_invoices original
               WHERE original.org_id = ${ctx.user.orgId}
                 AND original.invoice_type = 'sale'
                 AND original.invoice_number = (
                   SELECT based_on_number
                   FROM sales_invoices
                   WHERE id = ${input.invoiceId}
                 ))
            )`,
          ),
          columns: {
            invoiceNumber: true,
            zatcaUuid: true,
            invoiceDate: true,
          },
        }),
      ]);

      if (!inv) throw new Error('Invoice not found');
      if (!inv.sellerLegalName?.trim() || !inv.sellerTaxNumber?.trim()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'لا يمكن توليد أو إعادة معالجة XML: لقطة اسم المنشأة والرقم الضريبي غير محفوظة لهذه الفاتورة القديمة.',
        });
      }
      const cfg = canonicalizeZatcaConfig(org?.zatcaConfig, org);

      // ── توليد XML ──────────────────────────────────────────────────────────
      const issueDate = inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[0] : '';
      const issueTime = inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[1]?.slice(0, 8) ?? '00:00:00' : '00:00:00';
      const isDebitNote = inv.invoiceType === 'debit_note';
      const isAdjustment = inv.invoiceType === 'return' || inv.invoiceType === 'credit_note' || isDebitNote;
      const invTypeCode = isDebitNote ? '383' : isAdjustment ? '381' : '388';
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
  <cbc:InvoiceTypeCode name="${isAdjustment ? '0200000' : '0100000'}">${invTypeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${inv.zatcaInvoiceCounter ?? 1}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  ${isAdjustment && (inv.basedOnNumber || originalInvoice?.invoiceNumber || inv.sourceDocumentId || inv.refInvoiceId)
    ? `<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${String(originalInvoice?.invoiceNumber ?? inv.basedOnNumber ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}<\/cbc:ID>${originalInvoice?.zatcaUuid ? `<cbc:UUID>${String(originalInvoice.zatcaUuid).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</cbc:UUID>` : ''}</cac:InvoiceDocumentReference></cac:BillingReference>`
    : ''}
  ${isAdjustment && inv.notes
    ? `<cbc:Note>${String(inv.notes).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</cbc:Note>`
    : ''}
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${pih}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="CRN">${cfg.commercialReg ?? ''}</cbc:ID></cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${cfg.street ?? ''}</cbc:StreetName>
        <cbc:BuildingNumber>${cfg.buildingNumber ?? ''}</cbc:BuildingNumber>
        <cbc:CityName>${cfg.city ?? ''}</cbc:CityName>
        <cbc:PostalZone>${cfg.postalCode ?? ''}</cbc:PostalZone>
        <cbc:CountrySubentity>${cfg.district ?? ''}</cbc:CountrySubentity>
        <cac:Country><cbc:IdentificationCode>${cfg.countryCode ?? 'SA'}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${inv.sellerTaxNumber ?? cfg.vatNumber ?? ''}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${inv.sellerLegalName ?? cfg.legalName ?? (org?.name ?? '')}</cbc:RegistrationName>
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
      const sellerVat = inv.sellerTaxNumber ?? cfg.vatNumber ?? '';
      if (!sellerVat) err('cac:AccountingSupplierParty / cbc:CompanyID', 'الرقم الضريبي للبائع غير محدد في إعدادات ZATCA', '(فارغ)', '15 رقماً يبدأ وينتهي بـ 3', 'أكمل إعدادات ZATCA بالرقم الضريبي');
      else if (!/^3\d{13}3$/.test(sellerVat)) err('cac:AccountingSupplierParty / cbc:CompanyID', 'تنسيق الرقم الضريبي للبائع غير صحيح', sellerVat, '15 رقماً يبدأ وينتهي بـ 3 (مثال: 3XXXXXXXXXXX3)', 'صحّح الرقم الضريبي في إعدادات ZATCA');
      else info('cac:AccountingSupplierParty / cbc:CompanyID', 'الرقم الضريبي للبائع صالح', sellerVat, '15 رقماً', '—');

      // اسم البائع
      const sellerName = inv.sellerLegalName ?? cfg.legalName ?? (org?.name ?? '');
      if (!sellerName) err('cac:AccountingSupplierParty / cbc:RegistrationName', 'اسم المنشأة (البائع) غير محدد', '(فارغ)', 'اسم المنشأة', 'أكمل اسم المنشأة في إعدادات ZATCA');
      else info('cac:AccountingSupplierParty / cbc:RegistrationName', 'اسم البائع موجود', sellerName, 'اسم المنشأة', '—');

      // السجل التجاري
      if (!cfg.commercialReg) warn('cac:PartyIdentification / cbc:ID (CRN)', 'السجل التجاري غير محدد في إعدادات ZATCA', '(فارغ)', 'رقم السجل التجاري', 'أضف رقم السجل التجاري في إعدادات ZATCA');
      else info('cac:PartyIdentification / cbc:ID', 'السجل التجاري موجود', cfg.commercialReg, 'رقم السجل التجاري', '—');

      // العنوان
      if (!cfg.street || !cfg.city || !cfg.buildingNumber) {
        const missing = [!cfg.street && 'الشارع', !cfg.buildingNumber && 'رقم المبنى', !cfg.city && 'المدينة'].filter(Boolean).join('، ');
        warn('cac:PostalAddress', `بيانات العنوان غير مكتملة — مفقود: ${missing}`, '(جزئي)', 'الشارع + رقم المبنى + المدينة + الرمز البريدي', 'أكمل بيانات العنوان في إعدادات ZATCA');
      } else info('cac:PostalAddress', 'بيانات العنوان مكتملة', `${cfg.street}، ${cfg.city}`, 'عنوان كامل', '—');

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
      else info(
        'cbc:InvoiceTypeCode',
        'كود نوع الفاتورة صحيح',
        `${invTypeCode} (${invTypeCode === '388' ? 'فاتورة أصلية' : invTypeCode === '381' ? 'مرتجع / إشعار دائن' : 'إشعار مدين'})`,
        '388 أو 381 أو 383',
        '—',
      );

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
