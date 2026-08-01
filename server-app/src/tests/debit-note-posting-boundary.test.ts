import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('sales debit note posting boundary', () => {
  it('posts debit notes through the sales journal and never through purchase issuance', () => {
    const posting = readFileSync(resolve(process.cwd(), 'src/routers/posting.ts'), 'utf8');
    const engine = readFileSync(resolve(process.cwd(), 'src/services/PostingEngine.ts'), 'utf8');
    const purchases = readFileSync(resolve(process.cwd(), 'src/routers/purchases.ts'), 'utf8');

    expect(posting).toContain("invoice.invoiceType === 'debit_note'");
    expect(posting).toContain("sourceDocType:   invoice.invoiceType === 'debit_note'");
    expect(purchases).toContain('إشعار المدين مستند مبيعات صادر');
    expect(engine).toContain("sourceDocType:   isDebitNote");
    expect(engine).toContain("paymentMethod: 'credit'");
    expect(engine).not.toContain("sourceDocType: isDebitNote ? 'debit_note'");
  });
});