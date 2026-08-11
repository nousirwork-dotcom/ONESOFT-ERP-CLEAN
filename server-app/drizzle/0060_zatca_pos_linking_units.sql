-- Migration: 0060_zatca_pos_linking_units
-- Non-destructive electronic POS-to-ZATCA linking model.
-- The existing warehouse remains the only branch source of truth.

CREATE TABLE IF NOT EXISTS zatca_pos_units (
  id          SERIAL PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  unit_code   VARCHAR(50) NOT NULL,
  unit_name   VARCHAR(255) NOT NULL,
  status      VARCHAR(30) NOT NULL DEFAULT 'unlinked',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS zatca_pos_units_org_code_active_uidx
  ON zatca_pos_units(org_id, unit_code)
  WHERE is_active = TRUE AND is_deleted = FALSE;

ALTER TABLE document_journals
  ADD COLUMN IF NOT EXISTS zatca_pos_unit_id INTEGER
  REFERENCES zatca_pos_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS document_journals_zatca_pos_unit_idx
  ON document_journals(org_id, zatca_pos_unit_id)
  WHERE zatca_pos_unit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS document_journals_zatca_unit_doc_type_uidx
  ON document_journals(org_id, zatca_pos_unit_id, doc_type)
  WHERE zatca_pos_unit_id IS NOT NULL AND is_active = TRUE;

ALTER TABLE zatca_devices
  ADD COLUMN IF NOT EXISTS pos_unit_id INTEGER
  REFERENCES zatca_pos_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS zatca_devices_pos_unit_idx
  ON zatca_devices(org_id, pos_unit_id)
  WHERE pos_unit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS zatca_devices_active_pos_unit_uidx
  ON zatca_devices(org_id, pos_unit_id)
  WHERE pos_unit_id IS NOT NULL AND is_active = TRUE AND is_deleted = FALSE;