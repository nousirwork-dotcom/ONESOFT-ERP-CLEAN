import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('sales debit note posting boundary', () => {
  it('posts debit notes through the sales journal and never through purchase issuance', () => {
    const posting = readFileSync(resolve(process.cwd(), 'src/routers/posting.ts'), 'utf8');
    const engine = readFileSync(resolve(process.cwd(), 'src/services/PostingEngine.ts'), 'utf8');
    const purchases = readFileSync(resolve(process.cwd(), 'src/routers/purchases.ts'), 'utf8');
    const salesPosting = posting.slice(0, posting.indexOf('postPurchaseInvoice:'));

    expect(salesPosting).toContain("invoice.invoiceType === 'debit_note'");
    expect(salesPosting).toContain("sourceDocType:   invoice.invoiceType === 'debit_note'");
    expect(purchases).toContain('إشعار المدين مستند مبيعات صادر');
    expect(engine).toContain("sourceDocType:   isDebitNote");
    expect(engine).toContain("paymentMethod: 'credit'");
    expect(engine).not.toContain("sourceDocType: isDebitNote ? 'debit_note'");
    expect(engine).not.toContain("postSalesReturnStock");
    expect(engine).not.toContain("postSalesInvoiceStock");
    expect(engine).not.toContain("reverseSalesStockMovement");
    expect(salesPosting).not.toContain("postSalesReturnStock");
    expect(salesPosting).toContain("generatedStockVoucherId");
  });
});