import { TRPCError } from '@trpc/server';
import { and, eq, or } from 'drizzle-orm';
import { db } from '../db.js';
import {
  documentJournals,
  userGroups,
  zatcaCertificates,
  zatcaCsid,
  zatcaDevices,
  zatcaEnvironments,
  zatcaPosUnits,
} from '../schema.js';

export type ZatcaEnvironment = 'sandbox' | 'simulation' | 'production';

export type ZatcaContextUser = {
  id: number;
  orgId: number;
  role: string;
  userGroupId?: number | null;
};

type JournalRecord = {
  id: number;
  orgId: number;
  docType: string;
  warehouseId: number | null;
  zatcaPosUnitId: number | null;
  isActive: boolean;
  allowedUserId: number | null;
  allowedUserGroup: string | null;
};

type PosUnitRecord = {
  id: number;
  orgId: number;
  warehouseId: number;
  unitCode: string;
  unitName: string;
  isActive: boolean;
  isDeleted: boolean;
};

type EgsRecord = {
  id: number;
  orgId: number;
  posUnitId: number | null;
  deviceName: string;
  deviceUuid: string;
  environmentId: number | null;
  currentCsidId: number | null;
  registrationStatus: string;
  isActive: boolean;
  isDeleted: boolean;
};

type EnvironmentRecord = {
  id: number;
  orgId: number;
  name: string;
  isActive: boolean;
  isDeleted: boolean;
};

type CsidRecord = {
  id: number;
  orgId: number;
  deviceId: number | null;
  certificateId: number | null;
  complianceCsid: string | null;
  productionCsid: string | null;
  status: string;
  isActive: boolean;
  isDeleted: boolean;
};

type CertificateRecord = {
  id: number;
  orgId: number;
  deviceId: number | null;
  expiryDate: Date | null;
  status: string;
  isActive: boolean;
  isDeleted: boolean;
};

export type ZatcaContextRecords = {
  journal: JournalRecord | null;
  activeJournalLinks?: Array<{ posUnitId: number }>;
  posUnit: PosUnitRecord | null;
  egs: EgsRecord[];
  environment: EnvironmentRecord | null;
  csid: CsidRecord | null;
  certificate: CertificateRecord | null;
  user: ZatcaContextUser;
  now?: Date;
};

export type ResolvedZatcaContext = {
  warehouseId: number;
  journalId: number;
  documentType: string;
  posUnit: {
    id: number;
    code: string;
    name: string;
    warehouseId: number;
  };
  egs: {
    id: number;
    deviceName: string;
    deviceUuid: string;
    registrationStatus: string;
  };
  environment: {
    id: number;
    name: string;
    key: ZatcaEnvironment;
  };
  csid: {
    id: number;
    type: 'compliance' | 'production';
    certificateId: number;
    hasSecret: boolean;
  };
  certificate: {
    id: number;
    expiryDate: Date | null;
    status: string;
  };
};

export class ZatcaContextError extends Error {
  constructor(
    public readonly reason:
      | 'JOURNAL_NOT_FOUND'
      | 'JOURNAL_NOT_ALLOWED'
      | 'JOURNAL_NOT_LINKED'
      | 'MULTIPLE_JOURNAL_LINKS'
      | 'UNIT_NOT_FOUND'
      | 'UNIT_WAREHOUSE_MISMATCH'
      | 'EGS_NOT_LINKED'
      | 'MULTIPLE_EGS'
      | 'ENVIRONMENT_INVALID'
      | 'EGS_ENVIRONMENT_MISMATCH'
      | 'CSID_INVALID'
      | 'CERTIFICATE_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'ZatcaContextError';
  }
}

const DOC_TYPES = new Set(['sales_invoice', 'sales_return', 'credit_note', 'debit_note']);

function normalizeEnvironment(value: string): ZatcaEnvironment | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'sandbox' || normalized === 'test' || normalized === 'simulation') {
    return normalized === 'simulation' ? 'simulation' : 'sandbox';
  }
  if (normalized === 'production' || normalized === 'prod') return 'production';
  return null;
}

function throwContext(reason: ZatcaContextError['reason'], message: string): never {
  throw new ZatcaContextError(reason, message);
}

function assertJournalPermission(journal: JournalRecord, user: ZatcaContextUser) {
  if (user.role === 'admin' || user.role === 'superadmin') return;

  const userMatches = journal.allowedUserId != null && journal.allowedUserId === user.id;
  const groupRestriction = journal.allowedUserGroup?.trim();
  if (!groupRestriction) {
    // A journal with no explicit restriction is available to authenticated
    // users; an explicit user restriction narrows it to that user.
    if (journal.allowedUserId != null && !userMatches) {
      throwContext('JOURNAL_NOT_ALLOWED', 'المستخدم غير مصرح له باستخدام دفتر المستند');
    }
    return;
  }

  // When both restrictions exist, either explicit user access or group access
  // is sufficient. This preserves the existing journal permission semantics.
  const groupMatches = user.userGroupId != null && (
    groupRestriction === String(user.userGroupId)
  );
  if (!userMatches && !groupMatches) {
    throwContext('JOURNAL_NOT_ALLOWED', 'المستخدم غير مصرح له باستخدام دفتر المستند');
  }
}

function assertContextRecords(records: ZatcaContextRecords, requestedEnvironment: ZatcaEnvironment): ResolvedZatcaContext {
  const { journal, user, now = new Date() } = records;
  if (!journal || !journal.isActive || journal.orgId !== user.orgId) {
    throwContext('JOURNAL_NOT_FOUND', 'دفتر المستند غير موجود أو غير فعال');
  }
  assertJournalPermission(journal, user);

  if (!DOC_TYPES.has(journal.docType)) {
    throwContext('JOURNAL_NOT_LINKED', 'نوع دفتر المستند غير مدعوم في ربط ZATCA');
  }

  const activeLinks = records.activeJournalLinks ?? (
    journal.zatcaPosUnitId == null ? [] : [{ posUnitId: journal.zatcaPosUnitId }]
  );
  if (activeLinks.length === 0) {
    throwContext('JOURNAL_NOT_LINKED', 'دفتر المستند غير مرتبط بوحدة ربط نقطة البيع مع ZATCA');
  }
  if (activeLinks.length > 1) {
    throwContext('MULTIPLE_JOURNAL_LINKS', 'يوجد أكثر من ربط فعال لدفتر المستند — يجب تصحيح الربط قبل المتابعة');
  }
  if (!records.posUnit || !records.posUnit.isActive || records.posUnit.isDeleted || records.posUnit.orgId !== user.orgId) {
    throwContext('UNIT_NOT_FOUND', 'وحدة ربط نقطة البيع مع ZATCA غير موجودة أو غير فعالة');
  }
  if (records.posUnit.id !== activeLinks[0]!.posUnitId) {
    throwContext('UNIT_NOT_FOUND', 'بيانات ربط دفتر المستند لا تطابق وحدة الربط الفعالة');
  }
  if (journal.warehouseId == null || records.posUnit.warehouseId !== journal.warehouseId) {
    throwContext('UNIT_WAREHOUSE_MISMATCH', 'وحدة ربط ZATCA لا تنتمي إلى مخزن/فرع دفتر المستند');
  }

  if (records.egs.length === 0) {
    throwContext('EGS_NOT_LINKED', 'وحدة ربط نقطة البيع غير مرتبطة بوحدة EGS');
  }
  if (records.egs.length > 1) {
    throwContext('MULTIPLE_EGS', 'وحدة ربط نقطة البيع مرتبطة بأكثر من وحدة EGS فعالة');
  }
  const egs = records.egs[0]!;
  if (!egs.isActive || egs.isDeleted || egs.orgId !== user.orgId || egs.posUnitId !== records.posUnit.id) {
    throwContext('EGS_NOT_LINKED', 'وحدة EGS غير موجودة أو غير فعالة لهذه الوحدة');
  }

  if (!records.environment || !records.environment.isActive || records.environment.isDeleted || records.environment.orgId !== user.orgId) {
    throwContext('ENVIRONMENT_INVALID', 'بيئة ZATCA المحددة غير صالحة أو غير فعالة');
  }
  const environmentKey = normalizeEnvironment(records.environment.name);
  if (!environmentKey || environmentKey !== requestedEnvironment) {
    throwContext('EGS_ENVIRONMENT_MISMATCH', 'وحدة EGS غير مرتبطة ببيئة ZATCA المطلوبة');
  }
  if (egs.environmentId !== records.environment.id) {
    throwContext('EGS_ENVIRONMENT_MISMATCH', 'وحدة EGS غير مرتبطة ببيئة ZATCA المطلوبة');
  }

  if (
    !records.csid ||
    !records.csid.isActive ||
    records.csid.isDeleted ||
    records.csid.status !== 'active' ||
    records.csid.orgId !== user.orgId ||
    records.csid.deviceId !== egs.id ||
    records.csid.certificateId == null
  ) {
    throwContext('CSID_INVALID', 'شهادة CSID غير صالحة لوحدة EGS أو للبيئة المحددة');
  }
  const csidValue = requestedEnvironment === 'production'
    ? records.csid.productionCsid
    : records.csid.complianceCsid;
  if (!csidValue) {
    throwContext('CSID_INVALID', 'لا يوجد CSID صالح للبيئة المحددة');
  }

  const certificate = records.certificate;
  if (
    !certificate ||
    !certificate.isActive ||
    certificate.isDeleted ||
    certificate.status !== 'active' ||
    certificate.orgId !== user.orgId ||
    certificate.deviceId !== egs.id ||
    (certificate.expiryDate != null && certificate.expiryDate <= now)
  ) {
    throwContext('CERTIFICATE_INVALID', 'شهادة وحدة EGS منتهية أو غير صالحة');
  }

  return {
    warehouseId: journal.warehouseId,
    journalId: journal.id,
    documentType: journal.docType,
    posUnit: {
      id: records.posUnit.id,
      code: records.posUnit.unitCode,
      name: records.posUnit.unitName,
      warehouseId: records.posUnit.warehouseId,
    },
    egs: {
      id: egs.id,
      deviceName: egs.deviceName,
      deviceUuid: egs.deviceUuid,
      registrationStatus: egs.registrationStatus,
    },
    environment: {
      id: records.environment.id,
      name: records.environment.name,
      key: environmentKey,
    },
    csid: {
      id: records.csid.id,
      type: requestedEnvironment === 'production' ? 'production' : 'compliance',
      certificateId: records.csid.certificateId,
      hasSecret: Boolean(csidValue),
    },
    certificate: {
      id: certificate.id,
      expiryDate: certificate.expiryDate,
      status: certificate.status,
    },
  };
}

export function resolveZatcaContextFromRecords(
  records: ZatcaContextRecords,
  requestedEnvironment: ZatcaEnvironment,
): ResolvedZatcaContext {
  return assertContextRecords(records, requestedEnvironment);
}

/**
 * Resolve the electronic ZATCA context from the existing document journal.
 *
 * The returned object deliberately contains no user id, private key, CSID
 * secret, or certificate contents. The user only selects/uses a journal; the
 * server resolves the EGS and CSID.
 */
export async function resolveZatcaContext(input: {
  journalId: number;
  user: ZatcaContextUser;
  environment: ZatcaEnvironment;
  now?: Date;
}): Promise<ResolvedZatcaContext> {
  const { journalId, user, environment, now } = input;
  const journal = await db.query.documentJournals.findFirst({
    where: and(
      eq(documentJournals.id, journalId),
      eq(documentJournals.orgId, user.orgId),
    ),
    columns: {
      id: true,
      orgId: true,
      docType: true,
      warehouseId: true,
      zatcaPosUnitId: true,
      isActive: true,
      allowedUserId: true,
      allowedUserGroup: true,
    },
  });
  if (!journal) {
    throwContext('JOURNAL_NOT_FOUND', 'دفتر المستند غير موجود أو لا ينتمي إلى المؤسسة');
  }

  if (journal.allowedUserGroup && user.role !== 'admin' && user.role !== 'superadmin') {
    const group = await db.query.userGroups.findFirst({
      where: and(
        eq(userGroups.orgId, user.orgId),
        or(
          eq(userGroups.id, Number(journal.allowedUserGroup)),
          eq(userGroups.code, journal.allowedUserGroup),
          eq(userGroups.name, journal.allowedUserGroup),
        ),
      ),
      columns: { id: true },
    });
    if (group && user.userGroupId !== group.id) {
      // Preserve the existing journal restriction semantics while allowing
      // allowedUserGroup to be stored as a group id, code, or display name.
      if (journal.allowedUserId !== user.id) {
        throwContext('JOURNAL_NOT_ALLOWED', 'المستخدم غير مصرح له باستخدام دفتر المستند');
      }
    } else if (!group && journal.allowedUserId !== user.id) {
      throwContext('JOURNAL_NOT_ALLOWED', 'المستخدم غير مصرح له باستخدام دفتر المستند');
    }
  }

  const [posUnit, egs, environments] = await Promise.all([
    journal.zatcaPosUnitId == null
      ? Promise.resolve(null)
      : db.query.zatcaPosUnits.findFirst({
          where: and(
            eq(zatcaPosUnits.id, journal.zatcaPosUnitId),
            eq(zatcaPosUnits.orgId, user.orgId),
          ),
        }),
    journal.zatcaPosUnitId == null
      ? Promise.resolve([])
      : db.query.zatcaDevices.findMany({
          where: and(
            eq(zatcaDevices.orgId, user.orgId),
            eq(zatcaDevices.posUnitId, journal.zatcaPosUnitId),
            eq(zatcaDevices.isActive, true),
            eq(zatcaDevices.isDeleted, false),
          ),
          columns: {
            id: true,
            orgId: true,
            posUnitId: true,
            deviceName: true,
            deviceUuid: true,
            environmentId: true,
            currentCsidId: true,
            registrationStatus: true,
            isActive: true,
            isDeleted: true,
          },
        }),
    db.select({
      id: zatcaEnvironments.id,
      orgId: zatcaEnvironments.orgId,
      name: zatcaEnvironments.name,
      isActive: zatcaEnvironments.isActive,
      isDeleted: zatcaEnvironments.isDeleted,
    }).from(zatcaEnvironments).where(eq(zatcaEnvironments.orgId, user.orgId)),
  ]);

  const egsRow = egs.length === 1 ? egs[0] : null;
  const environmentRow = environments.find((row) => normalizeEnvironment(row.name) === environment);
  const csid = egsRow?.currentCsidId == null
    ? null
    : await db.query.zatcaCsid.findFirst({
        where: and(
          eq(zatcaCsid.id, egsRow.currentCsidId),
          eq(zatcaCsid.orgId, user.orgId),
        ),
        columns: {
          id: true,
          orgId: true,
          deviceId: true,
          certificateId: true,
          complianceCsid: true,
          productionCsid: true,
          status: true,
          isActive: true,
          isDeleted: true,
        },
      });
  const certificate = csid?.certificateId == null
    ? null
    : await db.query.zatcaCertificates.findFirst({
        where: and(
          eq(zatcaCertificates.id, csid.certificateId),
          eq(zatcaCertificates.orgId, user.orgId),
        ),
        columns: {
          id: true,
          orgId: true,
          deviceId: true,
          expiryDate: true,
          status: true,
          isActive: true,
          isDeleted: true,
        },
      });

  try {
    return assertContextRecords({
      journal,
      posUnit,
      egs: egs as EgsRecord[],
      environment: environmentRow ?? null,
      csid,
      certificate,
      user,
      now,
    }, environment);
  } catch (error) {
    if (error instanceof ZatcaContextError) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
    }
    throw error;
  }
}