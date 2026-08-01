import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  resolveZatcaContextFromRecords,
  type ZatcaContextRecords,
  ZatcaContextError,
} from '../services/zatcaContext.js';

const baseUser = { id: 10, orgId: 1, role: 'admin', userGroupId: null };
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

function fixture(overrides: Partial<ZatcaContextRecords> = {}): ZatcaContextRecords {
  return {
    journal: baseJournal,
    posUnit: {
      id: 1,
      orgId: 1,
      warehouseId: 7,
      unitCode: 'POS-01',
      unitName: 'وحدة 1',
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
      complianceCsid: 'redacted-compliance-csid',
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
    user: baseUser,
    now: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('ZATCA acceptance matrix — linking foundation', () => {
  it('one warehouse and one journal group resolves EGS-01', () => {
    const result = resolveZatcaContextFromRecords(fixture(), 'simulation');
    expect(result.warehouseId).toBe(7);
    expect(result.egs.deviceName).toBe('EGS-01');
  });

  it('one warehouse and two journal groups resolve two distinct EGS devices', () => {
    const first = resolveZatcaContextFromRecords(fixture(), 'simulation');
    const second = resolveZatcaContextFromRecords(fixture({
      journal: { ...baseJournal, id: 101, zatcaPosUnitId: 2 },
      posUnit: { ...fixture().posUnit!, id: 2, unitCode: 'POS-02', unitName: 'وحدة 2' },
      egs: [{ ...fixture().egs[0]!, id: 21, posUnitId: 2, deviceName: 'EGS-02', currentCsidId: 41 }],
      csid: { ...fixture().csid!, id: 41, deviceId: 21, certificateId: 51 },
      certificate: { ...fixture().certificate!, id: 51, deviceId: 21 },
    }), 'simulation');
    expect(first.egs.deviceName).toBe('EGS-01');
    expect(second.egs.deviceName).toBe('EGS-02');
  });

  it('manager with journal permission can resolve both journal groups', () => {
    const manager = { id: 77, orgId: 1, role: 'admin', userGroupId: null };
    const first = resolveZatcaContextFromRecords(fixture({ user: manager }), 'simulation');
    const second = resolveZatcaContextFromRecords(fixture({
      user: manager,
      journal: { ...baseJournal, id: 101, zatcaPosUnitId: 2 },
      posUnit: { ...fixture().posUnit!, id: 2, unitCode: 'POS-02' },
      egs: [{ ...fixture().egs[0]!, id: 21, posUnitId: 2, deviceName: 'EGS-02', currentCsidId: 41 }],
      csid: { ...fixture().csid!, id: 41, deviceId: 21, certificateId: 51 },
      certificate: { ...fixture().certificate!, id: 51, deviceId: 21 },
    }), 'simulation');
    expect([first.egs.deviceName, second.egs.deviceName]).toEqual(['EGS-01', 'EGS-02']);
  });

  it('journalId from group 1 selects EGS-01', () => {
    expect(resolveZatcaContextFromRecords(fixture(), 'simulation').egs.deviceName).toBe('EGS-01');
  });

  it('journalId from group 2 selects EGS-02', () => {
    const result = resolveZatcaContextFromRecords(fixture({
      journal: { ...baseJournal, zatcaPosUnitId: 2 },
      posUnit: { ...fixture().posUnit!, id: 2, unitCode: 'POS-02' },
      egs: [{ ...fixture().egs[0]!, id: 21, posUnitId: 2, deviceName: 'EGS-02', currentCsidId: 41 }],
      csid: { ...fixture().csid!, id: 41, deviceId: 21, certificateId: 51 },
      certificate: { ...fixture().certificate!, id: 51, deviceId: 21 },
    }), 'simulation');
    expect(result.egs.deviceName).toBe('EGS-02');
  });

  it('sales, return, credit, and debit journals in one journal group select one EGS', () => {
    for (const docType of ['sales_invoice', 'sales_return', 'credit_note', 'debit_note']) {
      expect(resolveZatcaContextFromRecords(fixture({
        journal: { ...baseJournal, docType },
      }), 'simulation').egs.id).toBe(20);
    }
  });

  it('journals in another journal group select a different EGS', () => {
    const result = resolveZatcaContextFromRecords(fixture({
      journal: { ...baseJournal, zatcaPosUnitId: 2 },
      posUnit: { ...fixture().posUnit!, id: 2 },
      egs: [{ ...fixture().egs[0]!, id: 21, posUnitId: 2, deviceName: 'EGS-02', currentCsidId: 41 }],
      csid: { ...fixture().csid!, id: 41, deviceId: 21, certificateId: 51 },
      certificate: { ...fixture().certificate!, id: 51, deviceId: 21 },
    }), 'simulation');
    expect(result.egs.id).not.toBe(20);
  });

  it('unauthorized journal access is classified as FORBIDDEN', () => {
    let error: unknown;
    try {
      resolveZatcaContextFromRecords(fixture({
        user: { id: 99, orgId: 1, role: 'cashier', userGroupId: null },
        journal: { ...baseJournal, allowedUserId: 123 },
      }), 'simulation');
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ZatcaContextError);
    expect((error as ZatcaContextError).reason).toBe('JOURNAL_NOT_ALLOWED');
  });

  it('unlinked journal returns an explicit JOURNAL_NOT_LINKED error', () => {
    expect(() => resolveZatcaContextFromRecords(fixture({
      journal: { ...baseJournal, zatcaPosUnitId: null },
      posUnit: null,
      egs: [],
    }), 'simulation')).toThrow('غير مرتبط');
  });

  it('journal with more than one active unit link is rejected', () => {
    expect(() => resolveZatcaContextFromRecords(fixture({
      activeJournalLinks: [{ posUnitId: 1 }, { posUnitId: 2 }],
    }), 'simulation')).toThrow('أكثر من ربط');
  });

  it('journal group with a different warehouse is rejected', () => {
    expect(() => resolveZatcaContextFromRecords(fixture({
      groupJournals: [
        { id: 100, orgId: 1, warehouseId: 7, zatcaPosUnitId: 1, isActive: true },
        { id: 101, orgId: 1, warehouseId: 8, zatcaPosUnitId: 1, isActive: true },
      ],
    }), 'simulation')).toThrow('مخزنًا مختلفًا');
  });

  it('two organizations cannot resolve each other’s unit', () => {
    expect(() => resolveZatcaContextFromRecords(fixture({
      user: { id: 10, orgId: 2, role: 'admin', userGroupId: null },
    }), 'simulation')).toThrow('دفتر المستند');
    expect(() => resolveZatcaContextFromRecords(fixture({
      posUnit: { ...fixture().posUnit!, orgId: 2 },
    }), 'simulation')).toThrow('غير موجودة');
  });

  it('public journal router contains read status only and no link mutation', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/routers/documentJournals.ts'), 'utf8');
    expect(source).toContain('getZatcaLinkStatus');
    expect(source).not.toContain('set({ zatcaPosUnitId');
    expect(source).not.toContain('zatcaPosUnitId: input');
    expect(source).not.toContain('createPosUnit');
    expect(source).not.toContain('linkJournalToPosUnit');
  });
});