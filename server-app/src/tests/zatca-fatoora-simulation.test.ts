import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertSimulationUrl,
  assertFatooraUrl,
  generatePosUnitCsr,
  getFatooraUrl,
  getSimulationUrl,
} from '../services/zatcaFatooraSimulation.js';
import { getZatcaInvoiceTypeCode } from '../services/zatcaInvoiceSubmission.js';
import { generateCreditNoteXml } from '@talha7k/zatca';
import { getCsrIdentityForUnit } from '../services/zatcaPosUnitIdentity.js';

describe('Fatoora Simulation transport', () => {
  it('generates a secp256k1 CSR with the Simulation template', () => {
    const generated = generatePosUnitCsr({
      environment: 'simulation',
      identity: {
        posCode: 'POS-001',
        commonName: 'POS-001',
        egsSerialNumber: '1-OneSoft|2-ERP|3-fixed-serial-001',
      },
      organizationName: 'OneSoft',
      organizationUnitName: 'Riyadh',
      vatNumber: '399999999900003',
      branchLocation: 'Riyadh',
      businessCategory: 'Retail',
      branchName: 'Riyadh',
    });

    expect(generated.privateKeyPem).toContain('PRIVATE KEY');
    expect(generated.publicKeyPem).toContain('PUBLIC KEY');
    expect(generated.csrPem).toContain('CERTIFICATE REQUEST');
    expect(generated.csrBase64).not.toContain('BEGIN CERTIFICATE REQUEST');
    expect(generated.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('uses a persisted EGS serial as-is without nesting the ZATCA segments', () => {
    const generated = generatePosUnitCsr({
      environment: 'simulation',
      identity: {
        posCode: 'POS-001',
        commonName: 'POS-001',
        egsSerialNumber: '1-OneSoft|2-ERP|3-fixed-serial-001',
      },
      organizationName: 'OneSoft',
      organizationUnitName: 'Riyadh',
      vatNumber: '399999999900003',
      branchLocation: 'Riyadh',
      businessCategory: 'Retail',
      branchName: 'Riyadh',
    });

    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onesoft-zatca-test-'));
    const csrPath = path.join(workDir, 'request.csr');
    try {
      fs.writeFileSync(csrPath, generated.csrPem, 'utf8');
      const details = execFileSync(
        'openssl',
        ['req', '-in', csrPath, '-noout', '-text'],
        { encoding: 'utf8' },
      );
      expect(details).toContain('1-OneSoft|2-ERP|3-fixed-serial-001');
      expect(details).not.toContain('1-OneSoft|2-ERP|3-1-OneSoft');
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('shares one persisted POS identity across Simulation and Production CSR plans', () => {
    const identity = getCsrIdentityForUnit({
      unitCode: 'POS-001',
      commonName: 'POS-001',
      egsSerialNumber: '1-OneSoft|2-ERP|3-fixed-serial-001',
    });
    const details = {
      identity,
      organizationName: 'OneSoft',
      organizationUnitName: 'Riyadh',
      vatNumber: '399999999900003',
      branchLocation: 'Riyadh',
      businessCategory: 'Retail',
      branchName: 'Riyadh',
    };
    const simulationCredentials = { scope: 'simulation', token: 'simulation-mock' };
    const productionCredentials = { scope: 'production', token: 'production-mock' };
    const simulation = {
      ...generatePosUnitCsr({ ...details, environment: 'simulation' }),
      credentials: simulationCredentials,
    };
    const production = {
      ...generatePosUnitCsr({ ...details, environment: 'production' }),
      credentials: productionCredentials,
    };

    expect(simulation.environment).toBe('simulation');
    expect(production.environment).toBe('production');
    expect(simulation.credentials).not.toEqual(production.credentials);
    expect(simulation.commonName).toBe('POS-001');
    expect(production.commonName).toBe('POS-001');
    expect(simulation.egsSerialNumber).toBe('1-OneSoft|2-ERP|3-fixed-serial-001');
    expect(production.egsSerialNumber).toBe(simulation.egsSerialNumber);
    expect(simulation.csrPem).not.toBe(production.csrPem);

    const extractCsrText = (csrPem: string) => {
      const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onesoft-zatca-shared-identity-'));
      const csrPath = path.join(workDir, 'request.csr');
      try {
        fs.writeFileSync(csrPath, csrPem, 'utf8');
        return execFileSync('openssl', ['req', '-in', csrPath, '-noout', '-text'], { encoding: 'utf8' });
      } finally {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    };
    const simulationText = extractCsrText(simulation.csrPem);
    const productionText = extractCsrText(production.csrPem);
    expect(simulationText).toContain('Subject: C = SA, O = OneSoft, OU = Riyadh, CN = POS-001');
    expect(productionText).toContain('Subject: C = SA, O = OneSoft, OU = Riyadh, CN = POS-001');
    expect(simulationText).toContain('1-OneSoft|2-ERP|3-fixed-serial-001');
    expect(productionText).toContain('1-OneSoft|2-ERP|3-fixed-serial-001');
  });

  it('allows Simulation endpoints including operational CSID', () => {
    expect(getSimulationUrl('/compliance')).toBe(
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance',
    );
    expect(assertSimulationUrl(getSimulationUrl('/production/csids')).pathname)
      .toBe('/e-invoicing/simulation/production/csids');
  });

  it('maps every shared endpoint to the official Simulation and Production bases', () => {
    const paths = [
      '/compliance',
      '/compliance/invoices',
      '/production/csids',
      '/invoices/reporting/single',
      '/invoices/clearance/single',
    ] as const;

    for (const path of paths) {
      expect(getFatooraUrl('simulation', path)).toBe(
        `https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation${path}`,
      );
      expect(getFatooraUrl('production', path)).toBe(
        `https://gw-fatoora.zatca.gov.sa/e-invoicing/core${path}`,
      );
      expect(assertFatooraUrl(getFatooraUrl('simulation', path), 'simulation').pathname)
        .toBe(`/e-invoicing/simulation${path}`);
      expect(assertFatooraUrl(getFatooraUrl('production', path), 'production').pathname)
        .toBe(`/e-invoicing/core${path}`);
    }
  });

  it('rejects cross-environment, non-Fatoora, and non-allowlisted endpoints', () => {
    expect(() => assertSimulationUrl(
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance',
    )).toThrow();
    expect(() => assertFatooraUrl(
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance',
      'production',
    )).toThrow();
    expect(() => assertFatooraUrl(
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance',
      'simulation',
    )).toThrow();
    expect(() => assertFatooraUrl(
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/unknown',
      'production',
    )).toThrow();
    expect(() => assertSimulationUrl(
      'https://example.invalid/e-invoicing/simulation/compliance',
    )).toThrow();
    expect(() => assertSimulationUrl(
      'http://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance',
    )).toThrow();
  });

  it('maps invoice documents to the required ZATCA type codes', () => {
    expect(getZatcaInvoiceTypeCode('sale')).toBe('388');
    expect(getZatcaInvoiceTypeCode('return')).toBe('381');
    expect(getZatcaInvoiceTypeCode('credit_note')).toBe('381');
    expect(getZatcaInvoiceTypeCode('debit_note')).toBe('383');
  });

  it('builds a debit-note XML with the sales original reference and reason', () => {
    const xml = generateCreditNoteXml({
      invoiceNumber: 'SDN-0001',
      uuid: 'debit-uuid',
      issueDate: '2026-08-01',
      issueTime: '12:00:00',
      invoiceTypeCode: '383',
      invoiceTypeCodeName: '0200000',
      profileId: 'reporting:1.0',
      currencyCode: 'SAR',
      supplier: {
        nameAr: 'ون سوفت',
        nameEn: 'OneSoft',
        vatNumber: '399999999900003',
        address: {
          street: 'King Road',
          building: '1',
          district: 'Central',
          city: 'Riyadh',
          postalCode: '12345',
          countryCode: 'SA',
        },
      },
      originalInvoiceNumber: 'INV-0042',
      originalInvoiceUuid: 'original-uuid',
      originalInvoiceDate: '2026-07-31',
      reason: 'تعديل قيمة الخدمة',
      lineExtensionAmount: 100,
      taxExclusiveAmount: 100,
      taxInclusiveAmount: 115,
      payableAmount: 115,
      taxAmount: 15,
      taxSubtotals: [{ taxableAmount: 100, taxAmount: 15, percent: 15, taxCategoryId: 'S' }],
      invoiceLines: [{
        id: 1,
        quantity: 1,
        unitCode: 'C62',
        lineExtensionAmount: 100,
        taxAmount: 15,
        itemName: 'خدمة',
        taxCategoryId: 'S',
        taxPercent: 15,
        priceAmount: 100,
      }],
    });

    expect(xml).toContain('<cbc:InvoiceTypeCode name="0200000">383</cbc:InvoiceTypeCode>');
    expect(xml).toContain('<cbc:ID>INV-0042</cbc:ID>');
    expect(xml).toContain('<cbc:UUID>original-uuid</cbc:UUID>');
    expect(xml).toContain('<cbc:Note>تعديل قيمة الخدمة</cbc:Note>');
    expect(xml).toContain('<cbc:InstructionNote>تعديل قيمة الخدمة</cbc:InstructionNote>');
  });
});