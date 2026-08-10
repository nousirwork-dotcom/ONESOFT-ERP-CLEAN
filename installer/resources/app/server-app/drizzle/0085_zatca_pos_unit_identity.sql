-- Additive POS identity fields for newly created ZATCA linking units.
-- Existing units are intentionally left untouched; their historical identity
-- remains represented by the existing unit_code/device/CSR records.
ALTER TABLE "zatca_pos_units"
  ADD COLUMN IF NOT EXISTS "common_name" varchar(255),
  ADD COLUMN IF NOT EXISTS "egs_serial_number" varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS "zatca_pos_units_egs_serial_uidx"
  ON "zatca_pos_units" ("egs_serial_number")
  WHERE "egs_serial_number" IS NOT NULL;