-- Preserve the legal seller identity used when a sales invoice is issued.
-- Existing rows remain NULL. They must not silently use the current
-- organization identity for historical QR/XML/signing; the application
-- blocks those operations until historical identity is recovered explicitly.
ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS seller_legal_name varchar(255),
  ADD COLUMN IF NOT EXISTS seller_tax_number varchar(50);