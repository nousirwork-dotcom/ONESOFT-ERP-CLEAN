-- Repair the complete schema drift observed between a clean current bootstrap
-- and Legacy installations that reached 0092 from the historical base schema.
-- This migration is additive/metadata-only: it preserves all existing rows.

ALTER TABLE "document_journals"
  ADD COLUMN IF NOT EXISTS "customers_journal" varchar(50),
  ADD COLUMN IF NOT EXISTS "suppliers_journal" varchar(50),
  ADD COLUMN IF NOT EXISTS "payment_types_config" jsonb,
  ADD COLUMN IF NOT EXISTS "issuance_config" jsonb,
  ADD COLUMN IF NOT EXISTS "options_config" jsonb;

-- The current bootstrap contains this compatibility column even though older
-- purchase-invoice code did not declare it. Keep an upgraded Legacy database
-- compatible with the actual Fresh bootstrap shape.
ALTER TABLE "purchase_invoices"
  ADD COLUMN IF NOT EXISTS "zatca_invoice_type" varchar(20);

UPDATE "purchase_invoices"
SET "zatca_invoice_type" = 'simplified'
WHERE "zatca_invoice_type" IS NULL
   OR "zatca_invoice_type" NOT IN ('standard', 'simplified');

ALTER TABLE "purchase_invoices"
  ALTER COLUMN "zatca_invoice_type" SET DEFAULT 'simplified',
  ALTER COLUMN "zatca_invoice_type" SET NOT NULL;

ALTER TABLE "tax_definitions"
  ALTER COLUMN "value" SET DEFAULT '0'::numeric;

DO $$
DECLARE
  stock_constraint_oid oid;
  stock_constraint_definition text;
BEGIN
  -- Normalize historical FK names to the names emitted by the current
  -- bootstrap. If an old-name FK is absent, create the canonical one.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_tax_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_tax_id_tax_definitions_id_fk'
  ) THEN
    ALTER TABLE "products"
      RENAME CONSTRAINT "products_tax_id_fkey"
      TO "products_tax_id_tax_definitions_id_fk";
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_tax_id_tax_definitions_id_fk'
  ) THEN
    ALTER TABLE "products"
      ADD CONSTRAINT "products_tax_id_tax_definitions_id_fk"
      FOREIGN KEY ("tax_id") REFERENCES "tax_definitions"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sales_invoice_items'::regclass
      AND conname = 'sales_invoice_items_tax_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sales_invoice_items'::regclass
      AND conname = 'sales_invoice_items_tax_id_tax_definitions_id_fk'
  ) THEN
    ALTER TABLE "sales_invoice_items"
      RENAME CONSTRAINT "sales_invoice_items_tax_id_fkey"
      TO "sales_invoice_items_tax_id_tax_definitions_id_fk";
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sales_invoice_items'::regclass
      AND conname = 'sales_invoice_items_tax_id_tax_definitions_id_fk'
  ) THEN
    ALTER TABLE "sales_invoice_items"
      ADD CONSTRAINT "sales_invoice_items_tax_id_tax_definitions_id_fk"
      FOREIGN KEY ("tax_id") REFERENCES "tax_definitions"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;

  -- The historical name also carried ON DELETE SET NULL, while the Fresh
  -- bootstrap intentionally uses ON DELETE NO ACTION. Recreate it rather
  -- than merely renaming it so the action semantics match as well.
  SELECT c.oid, pg_get_constraintdef(c.oid, true)
  INTO stock_constraint_oid, stock_constraint_definition
  FROM pg_constraint AS c
  WHERE c.conrelid = 'public.stock_vouchers'::regclass
    AND c.conname = 'stock_vouchers_receiver_user_id_users_id_fk';

  IF stock_constraint_oid IS NOT NULL
     AND stock_constraint_definition <> 'FOREIGN KEY (receiver_user_id) REFERENCES users(id)' THEN
    ALTER TABLE "stock_vouchers"
      DROP CONSTRAINT "stock_vouchers_receiver_user_id_users_id_fk";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.stock_vouchers'::regclass
      AND conname = 'stock_vouchers_receiver_user_id_fkey'
  ) THEN
    ALTER TABLE "stock_vouchers"
      DROP CONSTRAINT "stock_vouchers_receiver_user_id_fkey";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.stock_vouchers'::regclass
      AND conname = 'stock_vouchers_receiver_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "stock_vouchers"
      ADD CONSTRAINT "stock_vouchers_receiver_user_id_users_id_fk"
      FOREIGN KEY ("receiver_user_id") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tax_definitions'::regclass
      AND conname = 'tax_definitions_org_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tax_definitions'::regclass
      AND conname = 'tax_definitions_org_id_organizations_id_fk'
  ) THEN
    ALTER TABLE "tax_definitions"
      RENAME CONSTRAINT "tax_definitions_org_id_fkey"
      TO "tax_definitions_org_id_organizations_id_fk";
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tax_definitions'::regclass
      AND conname = 'tax_definitions_org_id_organizations_id_fk'
  ) THEN
    ALTER TABLE "tax_definitions"
      ADD CONSTRAINT "tax_definitions_org_id_organizations_id_fk"
      FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;