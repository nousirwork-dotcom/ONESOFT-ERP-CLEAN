-- Operational credit/debit note support.
-- Sales credit notes reuse the existing sales invoice table and invoice type enum.
-- Purchase debit notes carry their original-document reference without creating
-- an inventory movement.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'invoice_type'::regtype
      AND enumlabel = 'credit_note'
  ) THEN
    ALTER TYPE invoice_type ADD VALUE 'credit_note';
  END IF;
END $$;

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS based_on_type varchar(20),
  ADD COLUMN IF NOT EXISTS based_on_number varchar(50);