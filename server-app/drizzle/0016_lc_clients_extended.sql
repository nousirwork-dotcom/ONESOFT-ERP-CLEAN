-- Migration 0016: Extend lc_clients and lc_licenses for full Customer tab

ALTER TABLE lc_clients
  ADD COLUMN IF NOT EXISTS trade_name          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS country             VARCHAR(80),
  ADD COLUMN IF NOT EXISTS city                VARCHAR(80),
  ADD COLUMN IF NOT EXISTS activity_type       VARCHAR(120),
  ADD COLUMN IF NOT EXISTS contact_name        VARCHAR(120),
  ADD COLUMN IF NOT EXISTS contact_phone       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS contact_email       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS run_type            VARCHAR(20) NOT NULL DEFAULT 'desktop',
  ADD COLUMN IF NOT EXISTS web_setup_token     VARCHAR(120),
  ADD COLUMN IF NOT EXISTS web_setup_token_used BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE lc_licenses
  ADD COLUMN IF NOT EXISTS sync_allowed BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE lc_op_type ADD VALUE IF NOT EXISTS 'update_client';
ALTER TYPE lc_op_type ADD VALUE IF NOT EXISTS 'update_license';
ALTER TYPE lc_op_type ADD VALUE IF NOT EXISTS 'export_license';
ALTER TYPE lc_op_type ADD VALUE IF NOT EXISTS 'generate_web_setup';
