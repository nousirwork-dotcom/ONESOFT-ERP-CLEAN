-- Persistent organization-scoped readiness settings.
-- This table stores only setup metadata; it never stores OTPs, CSIDs,
-- credentials, certificates, or private keys.
CREATE TABLE IF NOT EXISTS zatca_readiness_settings (
  id               SERIAL PRIMARY KEY,
  org_id           INTEGER NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  warehouse_id     INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
  invoice_type     VARCHAR(20) NOT NULL DEFAULT 'both',
  zatca_pos_unit_id INTEGER REFERENCES zatca_pos_units(id) ON DELETE SET NULL,
  updated_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);