-- Restore the lifecycle columns required by the canonical zatca_pos_units
-- schema. This is intentionally additive and does not touch existing unit,
-- journal, device, certificate, CSID, fixture, test, or queue data.
ALTER TABLE "zatca_pos_units"
  ADD COLUMN IF NOT EXISTS "onesoft_status" varchar(30) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "lifecycle_updated_at" timestamp,
  ADD COLUMN IF NOT EXISTS "lifecycle_updated_by" integer,
  ADD COLUMN IF NOT EXISTS "lifecycle_reason" text;