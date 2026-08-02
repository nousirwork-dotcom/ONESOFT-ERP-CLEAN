-- Preserve the legal seller identity used when a sales invoice is issued.
-- Existing rows remain NULL and use the current organization data as a
-- compatibility fallback until they are reissued or otherwise migrated.
ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS seller_legal_name varchar(255),
  ADD COLUMN IF NOT EXISTS seller_tax_number varchar(50);