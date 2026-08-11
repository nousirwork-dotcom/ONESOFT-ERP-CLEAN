ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS generated_stock_voucher_id integer,
  ADD COLUMN IF NOT EXISTS generated_stock_journal_entry_id integer;

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS journal_id integer REFERENCES document_journals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generated_doc_type varchar(50);

ALTER TABLE stock_vouchers
  ADD COLUMN IF NOT EXISTS source_doc_type varchar(50),
  ADD COLUMN IF NOT EXISTS source_doc_id integer,
  ADD COLUMN IF NOT EXISTS source_doc_number varchar(100),
  ADD COLUMN IF NOT EXISTS source_journal_id integer REFERENCES document_journals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generated_journal_entry_id integer;