import * as fs from 'node:fs';
import * as path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const foundationSource = fs.readFileSync(
  path.join(root, 'server-app/src/foundation-update.ts'),
  'utf8',
);
const indexSource = fs.readFileSync(path.join(root, 'server-app/src/index.ts'), 'utf8');
const schemaCheckSource = fs.readFileSync(
  path.join(root, 'server-app/src/check-schema.ts'),
  'utf8',
);
const baseSchema = fs.readFileSync(
  path.join(root, 'server-app/drizzle/base_schema.sql'),
  'utf8',
);
const compatibilityMigration = fs.readFileSync(
  path.join(root, 'server-app/drizzle/0095_sales_invoice_schema_compatibility.sql'),
  'utf8',
);

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

assert(
  foundationSource.includes("if (key === 'id') continue"),
  'Foundation never inserts source-database primary-key IDs',
);
assert(
  indexSource.includes("await verifySchemaAndSynchronizeSequences('foundation-only')"),
  'Legacy foundation-only path verifies schema and synchronizes sequences',
);
assert(
  indexSource.includes("await verifySchemaAndSynchronizeSequences('startup')"),
  'Fresh/normal startup path verifies schema and synchronizes sequences',
);
assert(
  indexSource.indexOf("await verifySchemaAndSynchronizeSequences('foundation-only')") <
    indexSource.indexOf("console.log('[foundation-only] FOUNDATION_OK')"),
  'Legacy integrity gate runs before FOUNDATION_OK',
);

const startupBlock = indexSource.slice(indexSource.indexOf('// ── Foundation Update للعملاء الحاليين'));
assert(
  startupBlock.indexOf('FOUNDATION_INCOMPLETE') <
    startupBlock.indexOf("await verifySchemaAndSynchronizeSequences('startup')"),
  'Fresh/normal integrity gate runs after Foundation completion',
);

for (const column of [
  'customer_type',
  'customer_tax_number',
  'zatca_submitted_at',
  'zatca_attempt_count',
  'zatca_rejection_reason',
]) {
  assert(schemaCheckSource.includes(`'${column}'`), `schema verification requires sales_invoices.${column}`);
  assert(baseSchema.includes(`"${column}"`), `Fresh base_schema creates sales_invoices.${column}`);
  assert(compatibilityMigration.includes(`"${column}"`), `Legacy migration repairs sales_invoices.${column}`);
}

console.log('DATABASE INTEGRITY PATHS: PASS');