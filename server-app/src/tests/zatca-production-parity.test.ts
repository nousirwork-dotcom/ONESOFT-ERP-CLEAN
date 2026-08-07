import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertFatooraUrl,
  extractComplianceRequestId,
  getFatooraUrl,
} from '../services/zatcaFatooraSimulation.js';
import { getZatcaInvoiceTypeCode } from '../services/zatcaInvoiceSubmission.js';

describe('ZATCA Simulation / Production parity guardrails', () => {
  it('keeps official environment URLs separate without making a request', () => {
    expect(getFatooraUrl('simulation', '/compliance')).toBe(
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance',
    );
    expect(getFatooraUrl('production', '/compliance')).toBe(
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance',
    );
    expect(assertFatooraUrl(
      getFatooraUrl('production', '/invoices/reporting/single'),
      'production',
    ).pathname).toBe('/e-invoicing/core/invoices/reporting/single');
  });

  it('uses only body.requestID for Compliance references in either environment', () => {
    const valid = {
      body: { requestID: 12345, requestId: 'wrong-body-id' },
      requestId: 'wrong-transport-id',
    };
    expect(extractComplianceRequestId(valid)).toBe('12345');
    expect(extractComplianceRequestId({
      body: { requestId: 'wrong-body-id' },
      requestId: 'wrong-transport-id',
    })).toBeNull();
  });

  it('keeps Reporting and Clearance type routing shared', () => {
    expect(getZatcaInvoiceTypeCode('sale')).toBe('388');
    expect(getZatcaInvoiceTypeCode('return')).toBe('381');
    expect(getZatcaInvoiceTypeCode('credit_note')).toBe('381');
    expect(getZatcaInvoiceTypeCode('debit_note')).toBe('383');
  });

  it('does not silently route Production invoice submission through Sandbox', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/routers/zatca.ts'), 'utf8');
    expect(source).toContain('const requestedEnvironment = cfg.environment as ZatcaEnvironment;');
    expect(source).toContain('environment: requestedEnvironment');
    expect(source).toContain('اتصال Production مغلق في هذه المرحلة');
    expect(source).not.toContain(
      "environment: cfg.environment === 'simulation' ? 'simulation' : 'sandbox'",
    );
  });

  it('keeps Production activation procedures absent while external access is blocked', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/routers/zatca.ts'), 'utf8');
    expect(source).toContain('بيئة Production محجوبة في هذه المرحلة');
    expect(source).toContain('اتصال Production مغلق في هذه المرحلة');
    expect(source).not.toMatch(/requestProductionComplianceCsid/);
    expect(source).not.toMatch(/requestProductionOperationalCsid/);
  });

  it('creates new EGS identity from organization CR, not VAT or UUID', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/routers/zatca.ts'), 'utf8');
    expect(source).toContain('columns: { commercialReg: true }');
    expect(source).toContain('buildPosUnitIdentity(unitCode, commercialReg)');
    expect(source).not.toContain('buildPosUnitIdentity(unitCode)');
  });

  it('does not reuse a CSR after an incomplete Compliance/OTP attempt', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/routers/zatca.ts'), 'utf8');
    const complianceSection = source.slice(
      source.indexOf('requestSimulationComplianceCsid:'),
      source.indexOf('requestSimulationOperationalCsid:'),
    );
    expect(complianceSection).toContain("eq(zatcaCsrRequests.status, 'pending_otp')");
    expect(complianceSection).not.toContain("eq(zatcaCsrRequests.status, 'compliance_incomplete')");
    expect(source).toContain("eq(zatcaCsrRequests.status, 'compliance_received')");
  });
});