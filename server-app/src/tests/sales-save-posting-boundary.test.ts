import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('sales save/post boundary', () => {
  it('does not auto-post during save and keeps the pending-effect path wired', () => {
    const sales = readFileSync(resolve(process.cwd(), 'src/routers/sales.ts'), 'utf8');
    const posting = readFileSync(resolve(process.cwd(), 'src/routers/posting.ts'), 'utf8');

    expect(sales).not.toContain('autoPostSalesInvoice(');
    expect(sales).toContain('syncUnpostedSalesEffects');
    expect(sales).toContain('removeUnpostedSalesEffects');
    expect(posting).toContain('postSalesStockMovement');
    expect(posting).toContain('cancelSalesStockMovement');
    expect(posting).toContain('db.transaction(async (tx)');
  });
});