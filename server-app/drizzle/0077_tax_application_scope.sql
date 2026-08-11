-- Make the tax definition's intended automatic application explicit.
ALTER TABLE tax_definitions
  ADD COLUMN IF NOT EXISTS application_scope VARCHAR(40) NOT NULL DEFAULT 'products_sales';

UPDATE tax_definitions
SET application_scope = CASE
  WHEN category = 'tax' THEN 'products_sales'
  ELSE 'other'
END
WHERE application_scope = 'products_sales';