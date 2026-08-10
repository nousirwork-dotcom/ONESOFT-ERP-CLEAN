-- Foundation runtime provenance for upgrade reconciliation.
-- Additive and safe for existing installations.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS foundation_snapshot_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS foundation_applied_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS foundation_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS foundation_last_error TEXT;