-- Repair a live-schema drift: 0086 may be stamped while this column is absent.
-- Additive only. Existing invoices and ZATCA transactions are not rewritten.
ALTER TABLE "zatca_invoice_transactions"
  ADD COLUMN IF NOT EXISTS "issuance_timestamp" timestamp;