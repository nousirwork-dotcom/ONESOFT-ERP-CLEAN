import crypto from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { decrypt } from '../config-crypto.js';
import { db } from '../db.js';
import {
  salesInvoices,
  zatcaCsid,
  zatcaCertificates,
  zatcaDevices,
  zatcaInvoiceTransactions,
  zatcaKeys,
} from '../schema.js';
import {
  commitTrustedIssuance,
  isTrustedClockDocumentType,
  reserveTrustedIssuance,
} from './trustedClock.js';
import {
  buildAndSignZatcaInvoice,
  type InvoiceItemInput,
  type InvoiceInput,
} from './zatcaInvoiceSubmission.js';
import {
  resolveZatcaContext,
  type ResolvedZatcaContext,
  type ZatcaEnvironment,
  type ZatcaContextUser,
} from './zatcaContext.js';

type DbClient = typeof db | any;

type OrganizationInput = {
  name?: string | null;
  nameEn?: string | null;
  taxNumber?: string | null;
  commercialReg?: string | null;
  zatcaConfig?: unknown;
};

type IssueInvoice = InvoiceInput & {
  id: number;
  orgId: number;
  journalId: number | null;
  createdAt: Date;
  sourceDocumentId?: number | null;
  refInvoiceId?: number | null;
  basedOnNumber?: string | null;
  sellerLegalName?: string | null;
  sellerTaxNumber?: string | null;
  zatcaUuid?: string | null;
  zatcaHash?: string | null;
  zatcaQrCode?: string | null;
  zatcaXml?: string | null;
  zatcaIssueTimestamp?: Date | string | null;
  zatcaInvoiceCounter?: number | null;
  zatcaPih?: string | null;
  zatcaInvoiceType?: string | null;
};

export type ZatcaIssuedSnapshot = {
  transactionId: number;
  posUnitId: number;
  deviceId: number;
  environmentId: number;
  operation: 'reporting' | 'clearance';
  uuid: string;
  invoiceCounter: number;
  idempotencyKey: string;
  autoSubmit: boolean;
  submitOnPost: boolean;
  invoiceFields: {
    zatcaUuid: string;
    zatcaInvoiceCounter: number;
    zatcaHash: string;
    zatcaQrCode: string;
    zatcaXml: string;
    zatcaPih: string;
    zatcaIssueTimestamp: Date;
    zatcaStatus: 'reporting_pending' | 'clearance_pending';
    zatcaAttemptCount: number;
    zatcaSubmittedAt: null;
    zatcaRejectionReason: null;
  };
};

function configRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function environmentFromConfig(value: unknown): ZatcaEnvironment {
  const environment = String(configRecord(value).environment ?? '').trim().toLowerCase();
  if (environment === 'production') return 'production';
  if (environment === 'sandbox' || environment === 'test') return 'sandbox';
  return environment === 'simulation' ? 'simulation' : 'sandbox';
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function snapshotIsComplete(invoice: IssueInvoice): boolean {
  return Boolean(
    invoice.zatcaIssueTimestamp
    && invoice.zatcaXml
    && invoice.zatcaHash
    && invoice.zatcaQrCode
    && invoice.zatcaUuid
    && invoice.zatcaInvoiceCounter,
  );
}

/**
 * Creates the immutable local ZATCA issuance snapshot.
 *
 * This function deliberately does not call Fatoora or any other authority.
 * The caller must run it inside the same database transaction that creates or
 * finalizes the commercial document.
 */
export async function issueZatcaDocument(input: {
  tx: DbClient;
  invoice: IssueInvoice;
  items: InvoiceItemInput[];
  organization: OrganizationInput;
  user: ZatcaContextUser;
}): Promise<ZatcaIssuedSnapshot> {
  const { tx, invoice, organization, user } = input;
  if (!isTrustedClockDocumentType(invoice.invoiceType)) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'TrustedClock مخصص فقط لمستندات المبيعات الإلكترونية الأربعة.',
    });
  }
  if (snapshotIsComplete(invoice)) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'الفاتورة تحمل Snapshot إلكترونية؛ لا يجوز إعادة إصدارها.',
    });
  }
  if (
    invoice.zatcaIssueTimestamp
    || invoice.zatcaXml
    || invoice.zatcaHash
    || invoice.zatcaQrCode
    || invoice.zatcaUuid
    || invoice.zatcaInvoiceCounter
  ) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'لقطة ZATCA غير مكتملة؛ لا يمكن إعادة بنائها أو الكتابة فوقها.',
    });
  }
  if (!invoice.journalId) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'المستند الإلكتروني يتطلب دفترًا مرتبطًا بوحدة ZATCA.',
    });
  }

  const cfg = configRecord(organization.zatcaConfig);
  if (cfg.enabled !== true) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'منظومة ZATCA غير مفعَّلة لهذا المستند.',
    });
  }
  const environment = environmentFromConfig(organization.zatcaConfig);
  if (environment === 'production') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'إصدار Production مغلق في هذه المرحلة.',
    });
  }

  const resolvedContext: ResolvedZatcaContext = await resolveZatcaContext({
    journalId: invoice.journalId,
    environment,
    user,
    client: tx,
  });

  const uuid = crypto.randomUUID();
  const operation = invoice.zatcaInvoiceType === 'standard' ? 'clearance' : 'reporting';
  const idempotencyKey = `${invoice.orgId}:${invoice.id}:${uuid}:${operation}`;

  // TrustedClock takes the POS advisory lock inside this transaction. Read the
  // chain only after it has been acquired; reading ICV before the lock allows
  // two concurrent final saves to choose the same counter.
  const trustedIssuance = await reserveTrustedIssuance({
    orgId: invoice.orgId,
    posUnitId: resolvedContext.posUnit.id,
    invoiceId: invoice.id,
    userId: user.id,
    deviceId: resolvedContext.egs.id,
    existingIssueTimestamp: invoice.zatcaIssueTimestamp,
    existingInvoiceCounter: invoice.zatcaInvoiceCounter ?? null,
    invoiceCreatedAt: invoice.createdAt,
    tx,
  });

  const [latest, currentCsid, signingCertificate, signingKey, originalInvoice] = await Promise.all([
    tx.select({
      invoiceCounter: zatcaInvoiceTransactions.invoiceCounter,
      invoiceHash: zatcaInvoiceTransactions.invoiceHash,
    }).from(zatcaInvoiceTransactions).where(and(
      eq(zatcaInvoiceTransactions.orgId, invoice.orgId),
      eq(zatcaInvoiceTransactions.deviceId, resolvedContext.egs.id),
      eq(zatcaInvoiceTransactions.isActive, true),
      eq(zatcaInvoiceTransactions.isDeleted, false),
    )).orderBy(desc(zatcaInvoiceTransactions.invoiceCounter)).limit(1).then(([row]: any[]) => row),
    tx.query.zatcaCsid.findFirst({
      where: and(
        eq(zatcaCsid.id, resolvedContext.csid.id),
        eq(zatcaCsid.orgId, invoice.orgId),
        eq(zatcaCsid.deviceId, resolvedContext.egs.id),
        eq(zatcaCsid.isActive, true),
        eq(zatcaCsid.isDeleted, false),
      ),
    }),
    tx.query.zatcaCertificates.findFirst({
      where: and(
        eq(zatcaCertificates.id, resolvedContext.certificate.id),
        eq(zatcaCertificates.orgId, invoice.orgId),
        eq(zatcaCertificates.deviceId, resolvedContext.egs.id),
        eq(zatcaCertificates.isActive, true),
        eq(zatcaCertificates.isDeleted, false),
        eq(zatcaCertificates.status, 'active'),
      ),
    }),
    tx.query.zatcaKeys.findFirst({
      where: and(
        eq(zatcaKeys.orgId, invoice.orgId),
        eq(zatcaKeys.deviceId, resolvedContext.egs.id),
        eq(zatcaKeys.isActive, true),
        eq(zatcaKeys.isDeleted, false),
        eq(zatcaKeys.status, 'active'),
      ),
      orderBy: desc(zatcaKeys.createdAt),
    }),
    invoice.sourceDocumentId || invoice.refInvoiceId || invoice.basedOnNumber
      ? tx.query.salesInvoices.findFirst({
          where: and(
            eq(salesInvoices.orgId, invoice.orgId),
            eq(salesInvoices.invoiceType, 'sale'),
            invoice.sourceDocumentId
              ? eq(salesInvoices.id, invoice.sourceDocumentId)
              : invoice.refInvoiceId
                ? eq(salesInvoices.id, invoice.refInvoiceId)
                : eq(salesInvoices.invoiceNumber, invoice.basedOnNumber!),
          ),
          columns: { invoiceNumber: true, zatcaUuid: true, invoiceDate: true },
        })
      : Promise.resolve(null),
  ]);

  const invoiceCounter = (latest?.invoiceCounter ?? 0) + 1;
  const previousInvoiceHash = latest?.invoiceHash ?? '';

  if (
    ['return', 'credit_note', 'debit_note'].includes(invoice.invoiceType)
    && (!originalInvoice?.zatcaUuid || !originalInvoice.invoiceNumber)
  ) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'المستند الإلكتروني يتطلب فاتورة أصلية مرتبطة تحمل UUID رسميًا.',
    });
  }

  if (
    !currentCsid?.productionCsid
    || !signingCertificate?.publicCertificate
    || !signingCertificate.secretKeyEncrypted
    || !signingKey?.privateKeyEncrypted
    || resolvedContext.egs.registrationStatus !== 'operational'
  ) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'الإصدار الإلكتروني يتطلب CSID تشغيليًا وشهادة ومفتاحًا صالحين لوحدة EGS.',
    });
  }

  const signed = buildAndSignZatcaInvoice({
    invoice,
    items: input.items,
    seller: {
      nameAr: text(invoice.sellerLegalName ?? organization.name ?? cfg.legalName),
      nameEn: text(cfg.englishName ?? cfg.legalName ?? organization.nameEn ?? organization.name),
      vatNumber: text(invoice.sellerTaxNumber ?? organization.taxNumber ?? cfg.vatNumber),
      crNumber: text(cfg.commercialReg ?? organization.commercialReg) || undefined,
      street: text(cfg.street),
      building: text(cfg.buildingNumber),
      district: text(cfg.district),
      city: text(cfg.city),
      postalCode: text(cfg.postalCode),
      countryCode: text(cfg.countryCode || 'SA'),
    },
    uuid,
    invoiceCounter,
    previousInvoiceHash,
    submissionType: operation,
    issuanceTimestamp: trustedIssuance.timestamp,
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

  const [transaction] = await tx.insert(zatcaInvoiceTransactions).values({
    orgId: invoice.orgId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceUuid: uuid,
    invoiceHash: signed.invoiceHash,
    qrHash: crypto.createHash('sha256').update(signed.qrCode).digest('hex'),
    deviceId: resolvedContext.egs.id,
    environmentId: resolvedContext.environment.id,
    submissionType: operation,
    invoiceStatus: operation === 'reporting' ? 'reporting_pending' : 'clearance_pending',
    invoiceCounter,
    issuanceTimestamp: trustedIssuance.timestamp,
    correlationId: crypto.randomUUID(),
    idempotencyKey,
    attemptCount: 0,
    createdBy: user.id,
    updatedBy: user.id,
  }).returning({ id: zatcaInvoiceTransactions.id });
  if (!transaction?.id) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'تعذر إنشاء معاملة الإصدار المحلي؛ تم إلغاء حفظ المستند.',
    });
  }

  const invoiceFields: ZatcaIssuedSnapshot['invoiceFields'] = {
    zatcaUuid: uuid,
    zatcaInvoiceCounter: invoiceCounter,
    zatcaHash: signed.invoiceHash,
    zatcaQrCode: signed.qrCode,
    zatcaXml: signed.signedXml,
    zatcaPih: previousInvoiceHash,
    zatcaIssueTimestamp: trustedIssuance.timestamp,
    zatcaStatus: operation === 'reporting' ? 'reporting_pending' : 'clearance_pending',
    zatcaAttemptCount: 0,
    zatcaSubmittedAt: null,
    zatcaRejectionReason: null,
  };
  await tx.update(salesInvoices).set({
    ...invoiceFields,
    updatedAt: new Date(),
  }).where(and(
    eq(salesInvoices.id, invoice.id),
    eq(salesInvoices.orgId, invoice.orgId),
  ));

  await commitTrustedIssuance({
    orgId: invoice.orgId,
    posUnitId: resolvedContext.posUnit.id,
    invoiceCounter,
    invoiceHash: signed.invoiceHash,
    invoiceUuid: uuid,
    lastPih: previousInvoiceHash || null,
    tx,
  });

  return {
    transactionId: transaction.id,
    posUnitId: resolvedContext.posUnit.id,
    deviceId: resolvedContext.egs.id,
    environmentId: resolvedContext.environment.id,
    operation,
    uuid,
    invoiceCounter,
    idempotencyKey,
    autoSubmit: cfg.autoSubmit === true,
    submitOnPost: cfg.submitOnPost !== false,
    invoiceFields,
  };
}