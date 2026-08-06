CREATE TABLE IF NOT EXISTS "zatca_compliance_tests" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "pos_unit_id" integer NOT NULL REFERENCES "zatca_pos_units"("id") ON DELETE CASCADE,
  "device_id" integer REFERENCES "zatca_devices"("id") ON DELETE SET NULL,
  "invoice_id" integer REFERENCES "sales_invoices"("id") ON DELETE SET NULL,
  "test_key" varchar(60) NOT NULL,
  "invoice_type" varchar(20) NOT NULL,
  "document_type" varchar(30) NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'not_started',
  "http_status" integer,
  "request_id" varchar(160),
  "invoice_uuid" varchar(100),
  "invoice_hash" varchar(256),
  "xml_before_signing" text,
  "xml_after_signing" text,
  "response_payload" jsonb,
  "warnings" jsonb,
  "errors" jsonb,
  "attempted_at" timestamp,
  "completed_at" timestamp,
  "is_active" boolean NOT NULL DEFAULT true,
  "is_deleted" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "zatca_compliance_tests_active_key_uidx"
  ON "zatca_compliance_tests" ("org_id", "pos_unit_id", "test_key")
  WHERE "is_active" = true AND "is_deleted" = false;