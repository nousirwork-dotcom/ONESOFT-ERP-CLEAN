-- Keep Legacy sales_invoices compatible with the current application insert
-- shape. This is deliberately separate from 0094: seller_user_id already
-- exists on the affected Windows database, while these five columns do not.
ALTER TABLE "sales_invoices"
  ADD COLUMN IF NOT EXISTS "customer_type" varchar(20) DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS "customer_tax_number" varchar(100),
  ADD COLUMN IF NOT EXISTS "zatca_submitted_at" timestamp,
  ADD COLUMN IF NOT EXISTS "zatca_attempt_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "zatca_rejection_reason" text;