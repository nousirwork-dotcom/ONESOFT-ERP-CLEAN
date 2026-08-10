import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { zatcaPosUnits } from '../schema.js';

export type PosUnitIdentity = {
  posCode: string;
  commonName: string;
  egsSerialNumber: string;
};

const POS_CODE_PATTERN = /^POS-(\d{3})$/;

/**
 * ZATCA's EGS serial format is three pipe-separated fields:
 * 1-solution/provider | 2-model/version | 3-manufacturer serial.
 *
 * OneSoft uses "ERP" for the model/version field. ZATCA specifies the field
 * and its format, not this literal value; "ERP" is the stable product-model
 * label chosen for this implementation and is not a credential or identity
 * supplied by the user.
 *
 * New units use the organization's commercial registration/unified number
 * together with the immutable POS code. The value is generated once at unit
 * creation and then persisted; it is not rebuilt for CSR retries or either
 * environment.
 */
export function buildPosUnitIdentity(
  posCode: string,
  unifiedCrNumber: string,
): PosUnitIdentity {
  const normalizedCode = posCode.trim();
  if (!POS_CODE_PATTERN.test(normalizedCode)) {
    throw new Error('POS code must use the POS-### format');
  }
  const normalizedCr = unifiedCrNumber.trim();
  if (!/^\d{10}$/.test(normalizedCr)) {
    throw new Error('A valid 10-digit commercial registration/unified number is required');
  }
  return {
    posCode: normalizedCode,
    commonName: normalizedCode,
    egsSerialNumber: `1-OneSoft|2-ERP|3-${normalizedCr}-${normalizedCode}`,
  };
}

export function isManagedPosCode(value: string): boolean {
  return POS_CODE_PATTERN.test(value.trim());
}

export function nextManagedPosCode(
  existingCodes: readonly string[],
): string {
  let max = 0;
  for (const code of existingCodes) {
    const match = POS_CODE_PATTERN.exec(code.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `POS-${String(max + 1).padStart(3, '0')}`;
}

export function getCsrIdentityForUnit(
  unit: Pick<typeof zatcaPosUnits.$inferSelect, 'unitCode' | 'commonName' | 'egsSerialNumber'>,
  legacySerialNumber?: string | null,
): PosUnitIdentity {
  if (unit.commonName && unit.egsSerialNumber) {
    return {
      posCode: unit.unitCode,
      commonName: unit.commonName,
      egsSerialNumber: unit.egsSerialNumber,
    };
  }

  // Preserve the historical CSR identity for units created before the policy.
  // This fallback is read-only and never writes identity columns.
  return {
    posCode: unit.unitCode,
    commonName: unit.unitCode,
    egsSerialNumber: legacySerialNumber?.trim() || unit.unitCode,
  };
}

/**
 * Returns the persisted identity shared by Simulation and Production.
 *
 * Legacy units deliberately return null rather than being silently backfilled:
 * changing their stored identity could invalidate a historical CSR or CSID.
 */
export async function getPosUnitIdentity(
  posUnitId: number,
  orgId: number,
): Promise<PosUnitIdentity | null> {
  const [unit] = await db.select({
    posCode: zatcaPosUnits.unitCode,
    commonName: zatcaPosUnits.commonName,
    egsSerialNumber: zatcaPosUnits.egsSerialNumber,
  }).from(zatcaPosUnits).where(and(
    eq(zatcaPosUnits.id, posUnitId),
    eq(zatcaPosUnits.orgId, orgId),
  )).limit(1);

  if (!unit?.commonName || !unit.egsSerialNumber) return null;
  return {
    posCode: unit.posCode,
    commonName: unit.commonName,
    egsSerialNumber: unit.egsSerialNumber,
  };
}

/**
 * Transaction-safe identity lookup used by future environment flows.
 * New units already receive identity at INSERT time; this function only
 * returns persisted values and never mutates a legacy unit.
 */
export async function getOrCreatePosIdentity(
  posUnitId: number,
  orgId: number,
): Promise<PosUnitIdentity> {
  const identity = await getPosUnitIdentity(posUnitId, orgId);
  if (!identity) {
    throw new Error('This legacy POS unit has no managed technical identity; its historical CSR identity must be preserved');
  }
  return identity;
}

/**
 * Locks numbering for one organization and returns the next POS-### code.
 * The lock is transaction-scoped and must be called with a transaction client.
 */
export async function lockAndGetNextPosCode(
  tx: any,
  orgId: number,
): Promise<string> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`zatca-pos-unit:${orgId}`}))`);
  const rows = await tx.select({
    unitCode: zatcaPosUnits.unitCode,
    commonName: zatcaPosUnits.commonName,
    egsSerialNumber: zatcaPosUnits.egsSerialNumber,
  }).from(zatcaPosUnits).where(and(
    eq(zatcaPosUnits.orgId, orgId),
    eq(zatcaPosUnits.isDeleted, false),
  ));

  return nextManagedPosCode(
    rows
      .filter((row: { commonName: string | null; egsSerialNumber: string | null }) =>
        row.commonName != null && row.egsSerialNumber != null)
      .map((row: { unitCode: string }) => row.unitCode),
  );
}