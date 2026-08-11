CREATE TABLE IF NOT EXISTS "zatca_compliance_fixtures" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "pos_unit_id" integer NOT NULL REFERENCES "zatca_pos_units"("id") ON DELETE CASCADE,
  "source_fixture_id" integer,
  "invoice_type" varchar(20) NOT NULL,
  "document_type" varchar(30) NOT NULL,
  "invoice_number" varchar(100) NOT NULL,
  "invoice_date" timestamp NOT NULL,
  "customer_name" varchar(500),
  "customer_tax_number" varchar(100),
  "subtotal" numeric(18,4) NOT NULL DEFAULT 100,
  "discount_amount" numeric(18,4) NOT NULL DEFAULT 0,
  "tax_amount" numeric(18,4) NOT NULL DEFAULT 15,
  "total" numeric(18,4) NOT NULL DEFAULT 115,
  "notes" text,
  "zatca_uuid" varchar(100) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "is_deleted" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "zatca_compliance_fixtures_active_key_uidx"
  ON "zatca_compliance_fixtures" ("org_id", "pos_unit_id", "invoice_type", "document_type")
  WHERE "is_active" = true AND "is_deleted" = false;

CREATE TABLE IF NOT EXISTS "zatca_compliance_fixture_items" (
  "id" serial PRIMARY KEY,
  "fixture_id" integer NOT NULL REFERENCES "zatca_compliance_fixtures"("id") ON DELETE CASCADE,
  "product_name" varchar(500) NOT NULL,
  "quantity" numeric(18,4) NOT NULL DEFAULT 1,
  "unit" varchar(100) NOT NULL DEFAULT 'C62',
  "unit_price" numeric(18,4) NOT NULL DEFAULT 100,
  "total" numeric(18,4) NOT NULL DEFAULT 115,
  "tax_amount" numeric(18,4) NOT NULL DEFAULT 15,
  "tax_percent" numeric(5,2) NOT NULL DEFAULT 15,
  "discount_amount" numeric(18,4) NOT NULL DEFAULT 0,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "zatca_compliance_tests"
  ADD COLUMN IF NOT EXISTS "fixture_id" integer REFERENCES "zatca_compliance_fixtures"("id") ON DELETE SET NULL;