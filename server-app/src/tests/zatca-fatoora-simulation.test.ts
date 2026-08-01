import { describe, expect, it } from 'vitest';
import {
  assertSimulationUrl,
  generateSimulationCsr,
  getSimulationUrl,
} from '../services/zatcaFatooraSimulation.js';
import { getSimulationInvoiceTypeCode } from '../services/zatcaInvoiceSubmission.js';

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
});