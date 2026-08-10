-- Trusted Clock state is additive and starts empty.
-- Existing invoices are intentionally not backfilled or rewritten.
ALTER TABLE "sales_invoices"
  ADD COLUMN IF NOT EXISTS "zatca_issue_timestamp" timestamp;

ALTER TABLE "zatca_invoice_transactions"
  ADD COLUMN IF NOT EXISTS "issuance_timestamp" timestamp;

CREATE TABLE IF NOT EXISTS "zatca_clock_states" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "pos_unit_id" integer NOT NULL REFERENCES "zatca_pos_units"("id") ON DELETE CASCADE,
  "last_trusted_time" timestamp,
  "last_trusted_time_source" varchar(30),
  "last_trusted_time_checked_at" timestamp,
  "clock_status" varchar(20) NOT NULL DEFAULT 'stale',
  "last_observed_wall_time" timestamp,
  "last_issued_at" timestamp,
  "last_issue_date" varchar(10),
  "last_issue_time" varchar(8),
  "last_invoice_counter" integer,
  "last_invoice_hash" varchar(256),
  "last_invoice_uuid" varchar(100),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "zatca_clock_states_org_pos_unit_uidx"
  ON "zatca_clock_states" ("org_id", "pos_unit_id");

CREATE TABLE IF NOT EXISTS "zatca_clock_events" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "pos_unit_id" integer NOT NULL REFERENCES "zatca_pos_units"("id") ON DELETE CASCADE,
  "invoice_id" integer REFERENCES "sales_invoices"("id") ON DELETE SET NULL,
  "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "event_type" varchar(40) NOT NULL,
  "clock_status" varchar(20) NOT NULL,
  "detected_system_time" timestamp,
  "trusted_time" timestamp,
  "last_issued_at" timestamp,
  "reason" text,
  "metadata" jsonb,
  "detected_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "zatca_clock_policy" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "activated_at" timestamp NOT NULL DEFAULT now()
);

INSERT INTO "zatca_clock_policy" ("id")
VALUES (1)
ON CONFLICT ("id") DO NOTHING;