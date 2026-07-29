-- ─── Migration 0022: Custody Tracking (standalone — no accounting linkage) ────
-- هذا الجدول أداة متابعة داخلية مستقلة تمامًا عن النظام المحاسبي

CREATE TABLE IF NOT EXISTS hs_custody_entries (
  id                  SERIAL PRIMARY KEY,
  org_id              INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date          DATE    NOT NULL DEFAULT CURRENT_DATE,
  description         TEXT    NOT NULL DEFAULT '',
  reference_number    VARCHAR(100),
  -- الوارد
  income_due          NUMERIC(15,4) NOT NULL DEFAULT 0,
  income_collected    NUMERIC(15,4) NOT NULL DEFAULT 0,
  income_note         TEXT,
  -- المنصرف
  expense_due         NUMERIC(15,4) NOT NULL DEFAULT 0,
  expense_paid        NUMERIC(15,4) NOT NULL DEFAULT 0,
  expense_note        TEXT,
  -- ترتيب العرض
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_custody_entries_org_id    ON hs_custody_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_hs_custody_entries_date       ON hs_custody_entries(entry_date);

UPDATE _schema_version SET version = '0022_custody_tracking', stamped_at = NOW() WHERE id = 1;
