-- Allow one linking unit to have independent Simulation and Production EGS devices.
-- Existing Simulation rows remain untouched; only the uniqueness boundary changes.

DROP INDEX IF EXISTS zatca_devices_active_pos_unit_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS zatca_devices_active_pos_unit_env_uidx
  ON zatca_devices(org_id, pos_unit_id, environment_id)
  WHERE pos_unit_id IS NOT NULL
    AND environment_id IS NOT NULL
    AND is_active = TRUE
    AND is_deleted = FALSE;