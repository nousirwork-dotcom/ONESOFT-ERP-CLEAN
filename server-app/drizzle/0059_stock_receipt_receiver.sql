ALTER TABLE stock_vouchers
  ADD COLUMN IF NOT EXISTS receiver_user_id integer REFERENCES users(id) ON DELETE SET NULL;