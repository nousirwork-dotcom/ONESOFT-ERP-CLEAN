-- ─── 0031_re_housing_units ─── الوحدات السكنية (مرحلة 1 من المطور العقاري) ───

CREATE TABLE re_housing_units (
  id              SERIAL PRIMARY KEY,
  org_id          INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      INTEGER REFERENCES re_projects(id) ON DELETE SET NULL,
  unit_no         VARCHAR(50) NOT NULL,
  unit_type       VARCHAR(30) NOT NULL DEFAULT 'apartment',
  status          VARCHAR(20) NOT NULL DEFAULT 'available',
  area            NUMERIC(12,2),
  price           NUMERIC(18,4),
  floor           VARCHAR(20),
  block           VARCHAR(30),
  building        VARCHAR(30),
  notes           TEXT,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Unique unit number per project
CREATE UNIQUE INDEX re_housing_units_project_unit_uidx ON re_housing_units (org_id, COALESCE(project_id, 0), unit_no);
-- Index for filtering by org
CREATE INDEX re_housing_units_org_id_idx ON re_housing_units (org_id);
-- Index for filtering by project
CREATE INDEX re_housing_units_project_id_idx ON re_housing_units (project_id);
-- Index for filtering by status
CREATE INDEX re_housing_units_status_idx ON re_housing_units (status);
-- Index for unit number search
CREATE INDEX re_housing_units_unit_no_idx ON re_housing_units (unit_no);
