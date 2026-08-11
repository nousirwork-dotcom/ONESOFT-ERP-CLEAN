-- Persist the ZATCA invoice classification used by the original sales invoice.
-- Adjustment documents inherit this value and cannot change it independently.
ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS zatca_invoice_type varchar(20) NOT NULL DEFAULT 'simplified';

UPDATE sales_invoices
SET zatca_invoice_type = 'simplified'
WHERE zatca_invoice_type IS NULL
   OR zatca_invoice_type NOT IN ('standard', 'simplified');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'sales_invoices'::regclass
      AND conname = 'sales_invoices_zatca_invoice_type_chk'
  ) THEN
    ALTER TABLE sales_invoices
      ADD CONSTRAINT sales_invoices_zatca_invoice_type_chk
      CHECK (zatca_invoice_type IN ('standard', 'simplified'));
  END IF;
END $$;