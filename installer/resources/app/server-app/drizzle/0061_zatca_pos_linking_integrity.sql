-- Migration: 0061_zatca_pos_linking_integrity
-- Strengthens organization, warehouse, journal-role, and EGS integrity.
-- This migration is additive only: no DROP, DELETE, or data rewrite.
--
-- NOT VALID keeps legacy rows non-destructive while enforcing every new
-- INSERT/UPDATE. Existing rows can be validated separately after review.

-- Composite targets make organization ownership part of every new relationship.
CREATE UNIQUE INDEX IF NOT EXISTS zatca_pos_units_org_id_uidx
  ON zatca_pos_units(org_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS zatca_pos_units_org_id_id_warehouse_uidx
  ON zatca_pos_units(org_id, id, warehouse_id);

CREATE UNIQUE INDEX IF NOT EXISTS warehouses_org_id_id_uidx
  ON warehouses(org_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS document_journals_org_id_id_uidx
  ON document_journals(org_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS zatca_devices_org_id_id_uidx
  ON zatca_devices(org_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS zatca_environments_org_id_id_uidx
  ON zatca_environments(org_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS zatca_csid_org_id_id_uidx
  ON zatca_csid(org_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS zatca_certificates_org_id_id_uidx
  ON zatca_certificates(org_id, id);

ALTER TABLE zatca_pos_units
  ADD CONSTRAINT zatca_pos_units_warehouse_org_fk
  FOREIGN KEY (org_id, warehouse_id)
  REFERENCES warehouses(org_id, id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE document_journals
  ADD CONSTRAINT document_journals_warehouse_org_fk
  FOREIGN KEY (org_id, warehouse_id)
  REFERENCES warehouses(org_id, id)
  ON DELETE RESTRICT
  NOT VALID;

-- A journal's organization and linked unit's organization must match.
ALTER TABLE document_journals
  ADD CONSTRAINT document_journals_zatca_unit_org_fk
  FOREIGN KEY (org_id, zatca_pos_unit_id)
  REFERENCES zatca_pos_units(org_id, id)
  ON DELETE RESTRICT
  NOT VALID;

-- A linked journal must use the same warehouse as its electronic unit.
ALTER TABLE document_journals
  ADD CONSTRAINT document_journals_zatca_unit_warehouse_fk
  FOREIGN KEY (org_id, zatca_pos_unit_id, warehouse_id)
  REFERENCES zatca_pos_units(org_id, id, warehouse_id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE document_journals
  ADD CONSTRAINT document_journals_zatca_unit_requires_warehouse_ck
  CHECK (zatca_pos_unit_id IS NULL OR warehouse_id IS NOT NULL)
  NOT VALID;

ALTER TABLE document_journals
  ADD CONSTRAINT document_journals_zatca_doc_type_ck
  CHECK (
    zatca_pos_unit_id IS NULL
    OR doc_type IN ('sales_invoice', 'sales_return', 'credit_note', 'debit_note')
  )
  NOT VALID;

-- A unit has one unambiguous active EGS. Its environment and organization
-- must resolve through composite ownership keys.
ALTER TABLE zatca_devices
  ADD CONSTRAINT zatca_devices_pos_unit_org_fk
  FOREIGN KEY (org_id, pos_unit_id)
  REFERENCES zatca_pos_units(org_id, id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE zatca_devices
  ADD CONSTRAINT zatca_devices_environment_org_fk
  FOREIGN KEY (org_id, environment_id)
  REFERENCES zatca_environments(org_id, id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE zatca_devices
  ADD CONSTRAINT zatca_devices_pos_unit_requires_environment_ck
  CHECK (pos_unit_id IS NULL OR environment_id IS NOT NULL)
  NOT VALID;

ALTER TABLE zatca_devices
  ADD CONSTRAINT zatca_devices_current_csid_org_fk
  FOREIGN KEY (org_id, current_csid_id)
  REFERENCES zatca_csid(org_id, id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE zatca_csid
  ADD CONSTRAINT zatca_csid_device_org_fk
  FOREIGN KEY (org_id, device_id)
  REFERENCES zatca_devices(org_id, id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE zatca_csid
  ADD CONSTRAINT zatca_csid_certificate_org_fk
  FOREIGN KEY (org_id, certificate_id)
  REFERENCES zatca_certificates(org_id, id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE zatca_certificates
  ADD CONSTRAINT zatca_certificates_device_org_fk
  FOREIGN KEY (org_id, device_id)
  REFERENCES zatca_devices(org_id, id)
  ON DELETE RESTRICT
  NOT VALID;