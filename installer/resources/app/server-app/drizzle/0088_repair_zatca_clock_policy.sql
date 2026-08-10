-- Repair the TrustedClock policy table when migration history says 0086 ran
-- but the physical table was absent or incomplete.
CREATE TABLE IF NOT EXISTS "zatca_clock_policy" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "activated_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "zatca_clock_policy"
  ADD COLUMN IF NOT EXISTS "activated_at" timestamp;

ALTER TABLE "zatca_clock_policy"
  ALTER COLUMN "activated_at" SET DEFAULT now();

UPDATE "zatca_clock_policy"
SET "activated_at" = now()
WHERE "activated_at" IS NULL;

ALTER TABLE "zatca_clock_policy"
  ALTER COLUMN "activated_at" SET NOT NULL;

INSERT INTO "zatca_clock_policy" ("id")
VALUES (1)
ON CONFLICT ("id") DO NOTHING;