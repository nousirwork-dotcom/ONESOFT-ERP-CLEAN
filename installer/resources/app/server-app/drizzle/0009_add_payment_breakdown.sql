ALTER TABLE "sales_invoices" ADD COLUMN IF NOT EXISTS "payment_breakdown" jsonb;
