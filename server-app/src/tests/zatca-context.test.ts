import { describe, expect, it } from 'vitest';
import {
  resolveZatcaContextFromRecords,
  type ZatcaContextRecords,
} from '../services/zatcaContext.js';

const user = { id: 10, orgId: 1, role: 'admin', userGroupId: null };
const baseJournal = {
  id: 100,
  orgId: 1,
  docType: 'sales_invoice',
  warehouseId: 7,
  zatcaPosUnitId: 1,
  isActive: true,
  allowedUserId: null,
  allowedUserGroup: null,
};

function records(overrides: Partial<ZatcaContextRecords> = {}): ZatcaContextRecords {
  return {
    journal: baseJournal,
    posUnit: {
      id: 1,
      orgId: 1,
      warehouseId: 7,
      unitCode: 'EGS-01',
      unitName: 'نقطة البيع 1',
      isActive: true,
      isDeleted: false,
    },
    egs: [{
      id: 20,
      orgId: 1,
      posUnitId: 1,
      deviceName: 'EGS-01',
      deviceUuid: 'egs-01',
      environmentId: 30,
      currentCsidId: 40,
      registrationStatus: 'active',
      isActive: true,
      isDeleted: false,
    }],
    environment: { id: 30, orgId: 1, name: 'Simulation', isActive: true, isDeleted: false },
    csid: {
      id: 40,
      orgId: 1,
      deviceId: 20,
      certificateId: 50,
      complianceCsid: 'compliance-scid',
      productionCsid: null,
      status: 'active',
      isActive: true,
      isDeleted: false,
    },
    certificate: {
      id: 50,
      orgId: 1,
      deviceId: 20,
      expiryDate: new Date('2099-01-01T00:00:00Z'),
      status: 'active',
      isActive: true,
      isDeleted: false,
    },
    user,
    now: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('resolveZatcaContext', () => {
  it('resolves one document journal to one ZATCA linking unit', () => {
    const result = resolveZatcaContextFromRecords(records(), 'simulation');
    expect(result.warehouseId).toBe(7);
    expect(result.posUnit.code).toBe('EGS-01');
    expect(result.egs.id).toBe(20);
    expect(result.csid.type).toBe('compliance');
    expect(result).not.toHaveProperty('userId');
  });

  it('selects EGS-01 and EGS-02 for two journal groups in one warehouse', () => {
    const first = resolveZatcaContextFromRecords(records(), 'simulation');
    const second = resolveZatcaContextFromRecords(records({
      journal: { ...baseJournal, id: 101, warehouseId: 7, zatcaPosUnitId: 2 },
      posUnit: { ...records().posUnit!, id: 2, warehouseId: 7, unitCode: 'EGS-02' },
      egs: [{ ...records().egs[0]!, id: 21, posUnitId: 2, deviceName: 'EGS-02', currentCsidId: 41 }],
      csid: { ...records().csid!, id: 41, deviceId: 21, certificateId: 51 },
      certificate: { ...records().certificate!, id: 51, deviceId: 21 },
    }), 'simulation');
    expect(first.egs.deviceName).toBe('EGS-01');
    expect(second.egs.deviceName).toBe('EGS-02');
    expect(second.warehouseId).toBe(7);
  });

  it('uses one EGS for sales, return, credit and debit journals of one unit', () => {
    for (const docType of ['sales_invoice', 'sales_return', 'credit_note', 'debit_note']) {
      const result = resolveZatcaContextFromRecords(records({
        journal: { ...baseJournal, docType },
      }), 'simulation');
      expect(result.egs.id).toBe(20);
    }
  });

  it('allows an admin to resolve journals for both units', () => {
    const result = resolveZatcaContextFromRecords(records({
      user: { id: 99, orgId: 1, role: 'admin', userGroupId: null },
      journal: { ...baseJournal, allowedUserId: 123 },
    }), 'simulation');
    expect(result.posUnit.code).toBe('EGS-01');
  });

  it('rejects a user without journal permission', () => {
    expect(() => resolveZatcaContextFromRecords(records({
      user: { id: 99, orgId: 1, role: 'cashier', userGroupId: null },
      journal: { ...baseJournal, allowedUserId: 123 },
    }), 'simulation')).toThrow('المستخدم غير مصرح');
  });

  it('rejects an unlinked journal', () => {
    expect(() => resolveZatcaContextFromRecords(records({
      journal: { ...baseJournal, zatcaPosUnitId: null },
      posUnit: null,
      egs: [],
    }), 'simulation')).toThrow('غير مرتبط');
  });

  it('rejects multiple active links for one journal', () => {
    expect(() => resolveZatcaContextFromRecords(records({
      activeJournalLinks: [{ posUnitId: 1 }, { posUnitId: 2 }],
    }), 'simulation')).toThrow('أكثر من ربط');
  });

  it('rejects a unit with no EGS', () => {
    expect(() => resolveZatcaContextFromRecords(records({ egs: [] }), 'simulation'))
      .toThrow('غير مرتبطة بوحدة EGS');
  });

  it('rejects a unit with no EGS active for the requested environment', () => {
    expect(() => resolveZatcaContextFromRecords(records({
      egs: [{ ...records().egs[0]!, environmentId: 99 }],
    }), 'simulation')).toThrow('لا توجد وحدة EGS نشطة');
  });

  it('selects the EGS linked to the journal group for the requested environment', () => {
    const base = records();
    const productionEgs = {
      ...base.egs[0]!,
      id: 21,
      deviceName: 'EGS-01-PROD',
      environmentId: 31,
      currentCsidId: 41,
    };
    const result = resolveZatcaContextFromRecords(records({
      egs: [base.egs[0]!, productionEgs],
    }), 'simulation');
    expect(result.egs.deviceName).toBe('EGS-01');
  });

  it('rejects production when only compliance CSID exists', () => {
    expect(() => resolveZatcaContextFromRecords(records({
      environment: { id: 31, orgId: 1, name: 'Production', isActive: true, isDeleted: false },
      egs: [{ ...records().egs[0]!, environmentId: 31 }],
    }), 'production'))
      .toThrow('لا يوجد CSID صالح');
  });

  it('prefers the operational CSID for Simulation when it exists', () => {
    const result = resolveZatcaContextFromRecords(records({
      csid: {
        ...records().csid!,
        complianceCsid: 'compliance-csid',
        productionCsid: 'operational-csid',
      },
    }), 'simulation');
    expect(result.csid.hasSecret).toBe(true);
    expect(result.csid.type).toBe('operational');
  });

  it('rejects an expired certificate', () => {
    expect(() => resolveZatcaContextFromRecords(records({
      certificate: { ...records().certificate!, expiryDate: new Date('2025-01-01T00:00:00Z') },
    }), 'simulation')).toThrow('منتهية');
  });

  it('rejects a unit from another organization', () => {
    expect(() => resolveZatcaContextFromRecords(records({
      posUnit: { ...records().posUnit!, orgId: 2 },
    }), 'simulation')).toThrow('غير موجودة');
  });

  it('rejects a unit from a different warehouse', () => {
    expect(() => resolveZatcaContextFromRecords(records({
      posUnit: { ...records().posUnit!, warehouseId: 8 },
    }), 'simulation')).toThrow('لا تنتمي إلى مخزن');
  });

  it('rejects a journal group containing a journal from a different warehouse', () => {
    expect(() => resolveZatcaContextFromRecords(records({
      groupJournals: [
        { id: 100, orgId: 1, warehouseId: 7, zatcaPosUnitId: 1, isActive: true },
        { id: 101, orgId: 1, warehouseId: 8, zatcaPosUnitId: 1, isActive: true },
      ],
    }), 'simulation')).toThrow('مخزنًا مختلفًا');
  });

  it('rejects an inactive certificate without exposing certificate contents', () => {
    expect(() => resolveZatcaContextFromRecords(records({
      certificate: { ...records().certificate!, isActive: false },
    }), 'simulation')).toThrow('شهادة وحدة EGS');
    const resultKeys = Object.keys(resolveZatcaContextFromRecords(records(), 'simulation'));
    expect(resultKeys).not.toContain('privateKey');
    expect(resultKeys).not.toContain('secretKey');
  });
});