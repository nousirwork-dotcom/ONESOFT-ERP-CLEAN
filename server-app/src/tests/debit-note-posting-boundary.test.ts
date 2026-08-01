import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('purchase debit note posting boundary', () => {
  it('keeps debit-note posting financial-only before stock issuance code', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/routers/posting.ts'), 'utf8');
    const debitBranch = source.indexOf("if (invoice.invoiceType === 'debit_note')");
    const stockIssuance = source.indexOf('const issuance = parseIssuanceConfig', debitBranch);
    const stockVoucherInsert = source.indexOf('tx.insert(stockVouchers)', debitBranch);

    expect(debitBranch).toBeGreaterThan(-1);
    expect(stockIssuance).toBeGreaterThan(debitBranch);
    expect(stockVoucherInsert).toBeGreaterThan(debitBranch);
    expect(source.slice(debitBranch, stockIssuance)).toContain("sourceDocType: 'debit_note'");
    expect(source.slice(debitBranch, stockIssuance)).toContain('generatedStockVoucherId: null');
    expect(source.slice(debitBranch, stockIssuance)).toContain('stockVoucherId: null');
  });
});