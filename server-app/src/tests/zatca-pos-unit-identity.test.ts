import { describe, expect, it } from 'vitest';
import {
  buildPosUnitIdentity,
  getCsrIdentityForUnit,
  isManagedPosCode,
  nextManagedPosCode,
} from '../services/zatcaPosUnitIdentity.js';

describe('ZATCA POS unit identity policy', () => {
  it('creates a POS code identity with a ZATCA-shaped immutable serial', () => {
    const identity = buildPosUnitIdentity('POS-001');
    const secondIdentity = buildPosUnitIdentity('POS-002');

    expect(identity).toEqual({
      posCode: 'POS-001',
      commonName: 'POS-001',
      egsSerialNumber: expect.stringMatching(
        /^1-OneSoft\|2-ERP\|3-[0-9a-f-]{36}$/,
      ),
    });
    expect(identity.commonName).toBe(identity.posCode);
    expect(secondIdentity.egsSerialNumber).not.toBe(identity.egsSerialNumber);
  });

  it('rejects non-managed codes and preserves numbering format', () => {
    expect(isManagedPosCode('POS-001')).toBe(true);
    expect(isManagedPosCode('POS-01')).toBe(false);
    expect(isManagedPosCode('EGS-342')).toBe(false);
    expect(() => buildPosUnitIdentity('POS-01')).toThrow();
  });

  it('numbers managed units independently per organization and ignores legacy POS-33', () => {
    expect(nextManagedPosCode([])).toBe('POS-001');
    expect(nextManagedPosCode(['POS-001'])).toBe('POS-002');
    expect(nextManagedPosCode(['POS-001', 'POS-002'])).toBe('POS-003');
    expect(nextManagedPosCode(['POS-33'])).toBe('POS-001');
    expect(nextManagedPosCode(['POS-001', 'POS-33'])).toBe('POS-002');
    expect(nextManagedPosCode(['POS-001', 'POS-001'])).toBe('POS-002');
  });

  it('keeps the persisted identity stable across repeated reads', () => {
    const stored = buildPosUnitIdentity('POS-002');
    const unit = {
      unitCode: stored.posCode,
      commonName: stored.commonName,
      egsSerialNumber: stored.egsSerialNumber,
    } as const;

    expect(getCsrIdentityForUnit(unit)).toEqual(stored);
    expect(getCsrIdentityForUnit(unit)).toEqual(getCsrIdentityForUnit(unit));
  });

  it('preserves legacy EGS-342 and POS-33 CSR identities without backfilling', () => {
    expect(getCsrIdentityForUnit({
      unitCode: 'EGS-342',
      commonName: null,
      egsSerialNumber: null,
    }, 'EGS-342')).toEqual({
      posCode: 'EGS-342',
      commonName: 'EGS-342',
      egsSerialNumber: 'EGS-342',
    });
    expect(getCsrIdentityForUnit({
      unitCode: 'POS-33',
      commonName: null,
      egsSerialNumber: null,
    }, 'POS-33')).toEqual({
      posCode: 'POS-33',
      commonName: 'POS-33',
      egsSerialNumber: 'POS-33',
    });
  });
});