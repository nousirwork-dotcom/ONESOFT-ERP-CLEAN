-- Architectural correction for Task 276:
-- debit_note is an outbound sales document (ZATCA 383), never a purchase document.
-- The data audit before this migration found zero purchase debit notes, so no
-- records are moved or deleted.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'invoice_type'::regtype
      AND enumlabel = 'debit_note'
  ) THEN
    ALTER TYPE invoice_type ADD VALUE 'debit_note';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM purchase_invoices
    WHERE invoice_type = 'debit_note'
  ) THEN
    RAISE EXCEPTION
      '0070 stopped: purchase_invoices contains debit_note rows; review the migration report before moving any data';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'purchase_invoices'::regclass
      AND conname = 'purchase_invoices_debit_note_forbidden_chk'
  ) THEN
    ALTER TABLE purchase_invoices
      ADD CONSTRAINT purchase_invoices_debit_note_forbidden_chk
      CHECK (invoice_type <> 'debit_note');
  END IF;
END $$;