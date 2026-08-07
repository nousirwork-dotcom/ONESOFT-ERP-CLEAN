import { describe, expect, it } from 'vitest';
import {
  buildPosUnitIdentity,
  getCsrIdentityForUnit,
  isManagedPosCode,
  nextManagedPosCode,
} from '../services/zatcaPosUnitIdentity.js';

describe('ZATCA POS unit identity policy', () => {
  it('creates a POS code identity with a ZATCA-shaped immutable serial', () => {
    const identity = buildPosUnitIdentity('POS-001', '7001710990');
    const secondIdentity = buildPosUnitIdentity('POS-002', '7001710990');

    expect(identity).toEqual({
      posCode: 'POS-001',
      commonName: 'POS-001',
      egsSerialNumber: '1-OneSoft|2-ERP|3-7001710990-POS-001',
    });
    expect(identity.commonName).toBe(identity.posCode);
    expect(secondIdentity.egsSerialNumber).toBe('1-OneSoft|2-ERP|3-7001710990-POS-002');
  });

  it('rejects non-managed codes and preserves numbering format', () => {
    expect(isManagedPosCode('POS-001')).toBe(true);
    expect(isManagedPosCode('POS-01')).toBe(false);
    expect(isManagedPosCode('EGS-342')).toBe(false);
    expect(() => buildPosUnitIdentity('POS-01', '7001710990')).toThrow();
  });

  it('requires a valid organization CR/unified number and never falls back to VAT or UUID', () => {
    expect(() => buildPosUnitIdentity('POS-001', '')).toThrow(/commercial registration\/unified number/);
    expect(() => buildPosUnitIdentity('POS-001', '399999999900003')).toThrow();
    expect(() => buildPosUnitIdentity('POS-001', 'organization-1')).toThrow();
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
    const stored = buildPosUnitIdentity('POS-002', '7001710990');
    const unit = {
      unitCode: stored.posCode,
      commonName: stored.commonName,
      egsSerialNumber: stored.egsSerialNumber,
    } as const;

    expect(getCsrIdentityForUnit(unit)).toEqual(stored);
    expect(getCsrIdentityForUnit(unit)).toEqual(getCsrIdentityForUnit(unit));
  });

  it('uses a different serial for a different organization number', () => {
    expect(buildPosUnitIdentity('POS-001', '7001710990').egsSerialNumber)
      .toBe('1-OneSoft|2-ERP|3-7001710990-POS-001');
    expect(buildPosUnitIdentity('POS-001', '7001710991').egsSerialNumber)
      .toBe('1-OneSoft|2-ERP|3-7001710991-POS-001');
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