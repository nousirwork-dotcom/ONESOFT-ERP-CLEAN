-- Store the generated stock document links for sales returns.
-- Credit/debit notes remain financial-only and leave these fields NULL.
ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS generated_stock_voucher_id integer,
  ADD COLUMN IF NOT EXISTS generated_stock_journal_entry_id integer;