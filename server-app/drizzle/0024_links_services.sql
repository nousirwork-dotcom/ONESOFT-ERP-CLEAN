-- ─── 0024_links_services — أقسام وروابط الخدمات ──────────────────────────────

-- أقسام الروابط
CREATE TABLE hs_link_sections (
  id           SERIAL PRIMARY KEY,
  org_id       INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         VARCHAR(200) NOT NULL,
  icon         VARCHAR(50),
  color        VARCHAR(20),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- الروابط والخدمات
CREATE TABLE hs_links (
  id           SERIAL PRIMARY KEY,
  org_id       INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  section_id   INTEGER REFERENCES hs_link_sections(id) ON DELETE SET NULL,
  name         VARCHAR(200) NOT NULL,
  url          TEXT NOT NULL,
  description  TEXT,
  icon         VARCHAR(50),
  card_color   VARCHAR(20),
  open_mode    VARCHAR(20)  NOT NULL DEFAULT 'external',
  browser_type VARCHAR(20)  NOT NULL DEFAULT 'default',
  browser_path TEXT,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  is_favorite  BOOLEAN      NOT NULL DEFAULT FALSE,
  is_pinned    BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);
