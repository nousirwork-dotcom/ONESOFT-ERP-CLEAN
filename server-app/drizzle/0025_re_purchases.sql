-- ─── 0025_re_purchases ─── البيان التفصيلي للمشتريات (المطور العقاري) ─────────────────

CREATE TABLE re_purchases (
  id              SERIAL PRIMARY KEY,
  org_id          INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_name   VARCHAR(255) NOT NULL,
  supplier_tax_id VARCHAR(50),
  invoice_date    TIMESTAMP NOT NULL DEFAULT NOW(),
  invoice_number  VARCHAR(100) NOT NULL,
  pre_tax_value   NUMERIC(18,4) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,2)  NOT NULL DEFAULT 15,
  tax_amount      NUMERIC(18,4) NOT NULL DEFAULT 0,
  total_value     NUMERIC(18,4) NOT NULL DEFAULT 0,
  notes           TEXT,
  attachment_url  TEXT,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for fast duplicate detection (across all orgs)
CREATE INDEX re_purchases_tax_invoice_uidx ON re_purchases (supplier_tax_id, invoice_number);
-- Index for filtering by org
CREATE INDEX re_purchases_org_id_idx ON re_purchases (org_id);
-- Index for date range queries
CREATE INDEX re_purchases_date_idx ON re_purchases (invoice_date);
