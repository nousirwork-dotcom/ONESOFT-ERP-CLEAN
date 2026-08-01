-- Keep the Compliance CSID secret available for official compliance checks
-- after the operational CSID secret is issued.
ALTER TABLE zatca_certificates
  ADD COLUMN IF NOT EXISTS compliance_secret_encrypted TEXT;