-- Migration 0035: Foundation Policy fields for products, customers, suppliers
-- These three tables were missed in migration 0033/0034.

-- ── products ─────────────────────────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS record_policy              VARCHAR(20)  NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS foundation_key             VARCHAR(100),
  ADD COLUMN IF NOT EXISTS include_in_foundation      BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS record_origin              VARCHAR(20)  NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS foundation_template_version VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS prod_org_fk_uidx
  ON products(org_id, foundation_key)
  WHERE foundation_key IS NOT NULL;

-- ── customers ─────────────────────────────────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS record_policy              VARCHAR(20)  NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS foundation_key             VARCHAR(100),
  ADD COLUMN IF NOT EXISTS include_in_foundation      BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS record_origin              VARCHAR(20)  NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS foundation_template_version VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS cust_org_fk_uidx
  ON customers(org_id, foundation_key)
  WHERE foundation_key IS NOT NULL;

-- ── suppliers ─────────────────────────────────────────────────────────────────
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS record_policy              VARCHAR(20)  NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS foundation_key             VARCHAR(100),
  ADD COLUMN IF NOT EXISTS include_in_foundation      BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS record_origin              VARCHAR(20)  NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS foundation_template_version VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS supp_org_fk_uidx
  ON suppliers(org_id, foundation_key)
  WHERE foundation_key IS NOT NULL;
