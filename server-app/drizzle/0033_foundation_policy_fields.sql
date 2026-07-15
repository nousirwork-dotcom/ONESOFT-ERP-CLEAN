-- Migration 0033: Foundation Policy + Foundation Template fields
-- Adds record_policy / foundation_key / include_in_foundation
-- to all core master-data tables.
-- chart_of_accounts already has record_type + system_key → only gets include_in_foundation.

-- ── document_journals ────────────────────────────────────────────────────────
ALTER TABLE document_journals
  ADD COLUMN IF NOT EXISTS record_policy       VARCHAR(20)  NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS foundation_key      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS include_in_foundation BOOLEAN    NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS dj_org_fk_uidx
  ON document_journals(org_id, foundation_key)
  WHERE foundation_key IS NOT NULL;

-- ── document_types ───────────────────────────────────────────────────────────
ALTER TABLE document_types
  ADD COLUMN IF NOT EXISTS record_policy       VARCHAR(20)  NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS foundation_key      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS include_in_foundation BOOLEAN    NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS dt_org_fk_uidx
  ON document_types(org_id, foundation_key)
  WHERE foundation_key IS NOT NULL;

-- ── branches ─────────────────────────────────────────────────────────────────
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS record_policy       VARCHAR(20)  NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS foundation_key      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS include_in_foundation BOOLEAN    NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS br_org_fk_uidx
  ON branches(org_id, foundation_key)
  WHERE foundation_key IS NOT NULL;

-- ── warehouses ───────────────────────────────────────────────────────────────
ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS record_policy       VARCHAR(20)  NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS foundation_key      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS include_in_foundation BOOLEAN    NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS wh_org_fk_uidx
  ON warehouses(org_id, foundation_key)
  WHERE foundation_key IS NOT NULL;

-- ── units ────────────────────────────────────────────────────────────────────
ALTER TABLE units
  ADD COLUMN IF NOT EXISTS record_policy       VARCHAR(20)  NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS foundation_key      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS include_in_foundation BOOLEAN    NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS units_org_fk_uidx
  ON units(org_id, foundation_key)
  WHERE foundation_key IS NOT NULL;

-- ── product_groups ───────────────────────────────────────────────────────────
ALTER TABLE product_groups
  ADD COLUMN IF NOT EXISTS record_policy       VARCHAR(20)  NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS foundation_key      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS include_in_foundation BOOLEAN    NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS pg_org_fk_uidx
  ON product_groups(org_id, foundation_key)
  WHERE foundation_key IS NOT NULL;

-- ── payment_methods ──────────────────────────────────────────────────────────
ALTER TABLE payment_methods
  ADD COLUMN IF NOT EXISTS record_policy       VARCHAR(20)  NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS foundation_key      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS include_in_foundation BOOLEAN    NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS pm_org_fk_uidx
  ON payment_methods(org_id, foundation_key)
  WHERE foundation_key IS NOT NULL;

-- ── cost_centers ─────────────────────────────────────────────────────────────
ALTER TABLE cost_centers
  ADD COLUMN IF NOT EXISTS record_policy       VARCHAR(20)  NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS foundation_key      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS include_in_foundation BOOLEAN    NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS cc_org_fk_uidx
  ON cost_centers(org_id, foundation_key)
  WHERE foundation_key IS NOT NULL;

-- ── currencies ───────────────────────────────────────────────────────────────
ALTER TABLE currencies
  ADD COLUMN IF NOT EXISTS record_policy       VARCHAR(20)  NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS foundation_key      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS include_in_foundation BOOLEAN    NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS curr_org_fk_uidx
  ON currencies(org_id, foundation_key)
  WHERE foundation_key IS NOT NULL;

-- ── document_templates ───────────────────────────────────────────────────────
ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS record_policy       VARCHAR(20)  NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS foundation_key      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS include_in_foundation BOOLEAN    NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS tmpl_org_fk_uidx
  ON document_templates(org_id, foundation_key)
  WHERE foundation_key IS NOT NULL;

-- ── posting_definitions ──────────────────────────────────────────────────────
ALTER TABLE posting_definitions
  ADD COLUMN IF NOT EXISTS record_policy       VARCHAR(20)  NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS foundation_key      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS include_in_foundation BOOLEAN    NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS pd_org_fk_uidx
  ON posting_definitions(org_id, foundation_key)
  WHERE foundation_key IS NOT NULL;

-- ── chart_of_accounts (only include_in_foundation) ───────────────────────────
ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS include_in_foundation BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chart_of_accounts' AND column_name = 'system_key'
  ) THEN
    UPDATE chart_of_accounts SET include_in_foundation = true WHERE system_key IS NOT NULL;
  END IF;
END $$;
