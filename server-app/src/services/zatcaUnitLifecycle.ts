import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { db } from '../db.js';
import { documentJournals, zatcaPosUnits } from '../schema.js';

const BLOCKED_ONESOFT_STATUSES = new Set(['paused', 'archived']);
const BLOCKED_ENVIRONMENT_STATUSES = new Set(['paused', 'cancelled_from_fatoora', 'archived']);

export type ZatcaUnitLike = {
  id: number;
  orgId: number;
  oneSoftStatus: string;
};

export function assertUnitCanBeUsed(unit: ZatcaUnitLike | null | undefined) {
  if (!unit) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'وحدة ربط نقطة البيع غير موجودة' });
  }
  if (BLOCKED_ONESOFT_STATUSES.has(unit.oneSoftStatus)) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: unit.oneSoftStatus === 'paused'
        ? 'وحدة الربط متوقفة مؤقتًا داخل OneSoft'
        : 'وحدة الربط مؤرشفة ولا يمكن استخدامها',
    });
  }
}

export function assertEnvironmentCanBeUsed(status: string | null | undefined) {
  if (BLOCKED_ENVIRONMENT_STATUSES.has(status ?? '')) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: status === 'paused'
        ? 'بيئة وحدة الربط متوقفة مؤقتًا'
        : status === 'cancelled_from_fatoora'
          ? 'تم تأكيد إلغاء هذه الوحدة من منصة فاتورة'
          : 'بيئة وحدة الربط مؤرشفة ولا يمكن استخدامها',
    });
  }
}

export async function assertSalesJournalUnitCanBeUsed(orgId: number, journalId: number | null | undefined) {
  if (journalId == null) return;
  const journal = await db.query.documentJournals.findFirst({
    where: and(
      eq(documentJournals.id, journalId),
      eq(documentJournals.orgId, orgId),
    ),
    columns: { zatcaPosUnitId: true },
  });
  if (journal?.zatcaPosUnitId == null) return;
  const unit = await db.query.zatcaPosUnits.findFirst({
    where: and(
      eq(zatcaPosUnits.id, journal.zatcaPosUnitId),
      eq(zatcaPosUnits.orgId, orgId),
      eq(zatcaPosUnits.isActive, true),
      eq(zatcaPosUnits.isDeleted, false),
    ),
    columns: { id: true, orgId: true, oneSoftStatus: true },
  });
  assertUnitCanBeUsed(unit);
}