ALTER TABLE pending_account_movements
  ADD COLUMN IF NOT EXISTS linked_journal_entry_id integer REFERENCES journal_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_stock_voucher_id integer REFERENCES stock_vouchers(id) ON DELETE SET NULL;

ALTER TABLE pending_stock_movements
  ADD COLUMN IF NOT EXISTS linked_journal_entry_id integer REFERENCES journal_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_stock_voucher_id integer REFERENCES stock_vouchers(id) ON DELETE SET NULL;