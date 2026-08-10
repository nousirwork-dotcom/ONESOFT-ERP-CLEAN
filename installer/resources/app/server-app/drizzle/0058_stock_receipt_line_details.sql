ALTER TABLE stock_voucher_items
  ADD COLUMN IF NOT EXISTS product_code varchar(100),
  ADD COLUMN IF NOT EXISTS unit varchar(100),
  ADD COLUMN IF NOT EXISTS batch_number varchar(100),
  ADD COLUMN IF NOT EXISTS expiry_date varchar(10);