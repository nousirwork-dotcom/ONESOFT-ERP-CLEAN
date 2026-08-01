import { describe, expect, it } from 'vitest';
import {
  assertSimulationUrl,
  generateSimulationCsr,
  getSimulationUrl,
} from '../services/zatcaFatooraSimulation.js';
import { getSimulationInvoiceTypeCode } from '../services/zatcaInvoiceSubmission.js';
import { generateCreditNoteXml } from '@talha7k/zatca';

describe('Fatoora Simulation transport', () => {
  it('generates a secp256k1 CSR with the Simulation template', () => {
    const generated = generateSimulationCsr({
      commonName: 'OneSoft-EGS-01',
      organizationName: 'OneSoft',
      organizationUnitName: 'Riyadh',
      serialNumber: 'SN-01',
      vatNumber: '399999999900003',
      branchLocation: 'Riyadh',
      businessCategory: 'Retail',
      solutionName: 'OneSoft',
      model: 'ERP',
      branchName: 'Riyadh',
      taxpayerProvidedId: 'OneSoft-EGS-01',
    });

    expect(generated.privateKeyPem).toContain('PRIVATE KEY');
    expect(generated.publicKeyPem).toContain('PUBLIC KEY');
    expect(generated.csrPem).toContain('CERTIFICATE REQUEST');
    expect(generated.csrBase64).not.toContain('BEGIN CERTIFICATE REQUEST');
    expect(generated.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('allows Simulation endpoints including operational CSID', () => {
    expect(getSimulationUrl('/compliance')).toBe(
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance',
    );
    expect(assertSimulationUrl(getSimulationUrl('/production/csids')).pathname)
      .toBe('/e-invoicing/simulation/production/csids');
  });

  it('rejects core and non-Fatoora endpoints', () => {
    expect(() => assertSimulationUrl(
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance',
    )).toThrow();
    expect(() => assertSimulationUrl(
      'https://example.invalid/e-invoicing/simulation/compliance',
    )).toThrow();
    expect(() => assertSimulationUrl(
      'http://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance',
    )).toThrow();
  });

  it('maps invoice documents to the required ZATCA type codes', () => {
    expect(getSimulationInvoiceTypeCode('sale')).toBe('388');
    expect(getSimulationInvoiceTypeCode('return')).toBe('381');
    expect(getSimulationInvoiceTypeCode('credit_note')).toBe('381');
    expect(getSimulationInvoiceTypeCode('debit_note')).toBe('383');
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