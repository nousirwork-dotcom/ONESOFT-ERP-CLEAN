ALTER TABLE purchase_invoice_items
  ADD COLUMN IF NOT EXISTS batch_number varchar(100),
  ADD COLUMN IF NOT EXISTS expiry_date varchar(20);