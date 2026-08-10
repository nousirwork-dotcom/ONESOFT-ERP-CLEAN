-- Migration 0034: Foundation origin tracking + template versioning
-- Adds record_origin ('user'|'foundation'|'system') and foundation_template_version
-- to all 12 foundation-managed tables.

ALTER TABLE document_journals
  ADD COLUMN IF NOT EXISTS record_origin              VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS foundation_template_version VARCHAR(20);

ALTER TABLE document_types
  ADD COLUMN IF NOT EXISTS record_origin              VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS foundation_template_version VARCHAR(20);

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS record_origin              VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS foundation_template_version VARCHAR(20);

ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS record_origin              VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS foundation_template_version VARCHAR(20);

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS record_origin              VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS foundation_template_version VARCHAR(20);

ALTER TABLE product_groups
  ADD COLUMN IF NOT EXISTS record_origin              VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS foundation_template_version VARCHAR(20);

ALTER TABLE payment_methods
  ADD COLUMN IF NOT EXISTS record_origin              VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS foundation_template_version VARCHAR(20);

ALTER TABLE cost_centers
  ADD COLUMN IF NOT EXISTS record_origin              VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS foundation_template_version VARCHAR(20);

ALTER TABLE currencies
  ADD COLUMN IF NOT EXISTS record_origin              VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS foundation_template_version VARCHAR(20);

ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS record_origin              VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS foundation_template_version VARCHAR(20);

ALTER TABLE posting_definitions
  ADD COLUMN IF NOT EXISTS record_origin              VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS foundation_template_version VARCHAR(20);

ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS record_origin              VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS foundation_template_version VARCHAR(20);
