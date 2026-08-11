-- Tax master data used by product cards and future documents.
CREATE TABLE IF NOT EXISTS tax_definitions (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  category VARCHAR(30) NOT NULL DEFAULT 'tax',
  value_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
  value NUMERIC(18,4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  effective_from TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT tax_definitions_org_code_uidx UNIQUE (org_id, code)
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tax_id INTEGER REFERENCES tax_definitions(id) ON DELETE SET NULL;

ALTER TABLE sales_invoice_items
  ADD COLUMN IF NOT EXISTS tax_id INTEGER REFERENCES tax_definitions(id) ON DELETE SET NULL;

ALTER TABLE purchase_invoice_items
  ADD COLUMN IF NOT EXISTS tax_id INTEGER REFERENCES tax_definitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tax_definitions_org_active_idx
  ON tax_definitions(org_id, is_active);
CREATE INDEX IF NOT EXISTS sales_invoice_items_tax_idx
  ON sales_invoice_items(tax_id);
CREATE INDEX IF NOT EXISTS purchase_invoice_items_tax_idx
  ON purchase_invoice_items(tax_id);

-- Seed the definitions shown by the former static screen for every organization.
INSERT INTO tax_definitions (org_id, name, code, category, value_type, value, is_active, is_system)
SELECT o.id, seed.name, seed.code, seed.category, 'percentage', seed.value, seed.is_active, TRUE
FROM organizations o
CROSS JOIN (VALUES
  ('ضريبة القيمة المضافة', 'VAT', 'tax', 15.0000::numeric, TRUE),
  ('ضريبة الاستقطاع', 'WHT', 'withholding', 5.0000::numeric, TRUE),
  ('رسوم جمركية', 'CUS', 'fee', 5.0000::numeric, FALSE)
) AS seed(name, code, category, value, is_active)
ON CONFLICT (org_id, code) DO NOTHING;

-- Existing products keep their historical taxRate. Link an unambiguous
-- percentage match only; this never changes the stored rate.
UPDATE products p
SET tax_id = t.id
FROM tax_definitions t
WHERE p.org_id = t.org_id
  AND p.tax_id IS NULL
  AND t.value_type = 'percentage'
  AND t.value = COALESCE(p.tax_rate, 0);