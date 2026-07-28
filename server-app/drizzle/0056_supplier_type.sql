ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS supplier_type varchar(20) NOT NULL DEFAULT 'individual';