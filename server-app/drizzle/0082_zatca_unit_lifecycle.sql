ALTER TABLE "zatca_devices"
  ADD COLUMN IF NOT EXISTS "lifecycle_status" varchar(40) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "lifecycle_updated_at" timestamp,
  ADD COLUMN IF NOT EXISTS "lifecycle_updated_by" integer,
  ADD COLUMN IF NOT EXISTS "cancellation_confirmed_at" timestamp,
  ADD COLUMN IF NOT EXISTS "cancellation_note" text;

ALTER TABLE "zatca_pos_units"
  ADD COLUMN IF NOT EXISTS "onesoft_status" varchar(30) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "lifecycle_updated_at" timestamp,
  ADD COLUMN IF NOT EXISTS "lifecycle_updated_by" integer,
  ADD COLUMN IF NOT EXISTS "lifecycle_reason" text;

CREATE TABLE IF NOT EXISTS "zatca_unit_lifecycle_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "pos_unit_id" integer NOT NULL REFERENCES "zatca_pos_units"("id") ON DELETE CASCADE,
  "device_id" integer REFERENCES "zatca_devices"("id") ON DELETE SET NULL,
  "environment_id" integer REFERENCES "zatca_environments"("id") ON DELETE SET NULL,
  "action" varchar(50) NOT NULL,
  "previous_status" varchar(50),
  "next_status" varchar(50),
  "reason" text,
  "actor_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "actor_username" varchar(100),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "zatca_unit_lifecycle_events_unit_idx"
  ON "zatca_unit_lifecycle_events" ("org_id", "pos_unit_id", "created_at");