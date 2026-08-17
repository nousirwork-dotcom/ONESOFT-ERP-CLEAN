import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('sales save/post boundary', () => {
  it('does not auto-post during save and keeps the pending-effect path wired', () => {
    const sales = readFileSync(resolve(process.cwd(), 'src/routers/sales.ts'), 'utf8');
    const posting = readFileSync(resolve(process.cwd(), 'src/routers/posting.ts'), 'utf8');
    const salesPosting = posting.slice(0, posting.indexOf('postPurchaseInvoice:'));

    expect(sales).not.toContain('autoPostSalesInvoice(');
    expect(sales).toContain('syncUnpostedSalesEffects');
    expect(sales).toContain('removeUnpostedSalesEffects');
    expect(salesPosting).toContain('postSalesStockMovement');
    expect(salesPosting).toContain('deleteSalesStockMovement');
    expect(salesPosting).toContain('unpostAudit');
    expect(salesPosting).not.toContain("status: 'cancelled'");
    expect(salesPosting).toContain('db.transaction(async (tx)');
  });
});