-- ─── Migration 0023: Custody Records ─────────────────────────────────────────
-- إضافة جدول سجلات العهد (العناوين) وربط إدخالات العهدة الموجودة بها

CREATE TABLE IF NOT EXISTS hs_custody_records (
  id                  SERIAL PRIMARY KEY,
  org_id              INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_number       INTEGER NOT NULL DEFAULT 1,
  custody_name        TEXT NOT NULL DEFAULT '',
  email               VARCHAR(255),
  auto_send_email     BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hs_custody_records_org_num ON hs_custody_records(org_id, record_number);
CREATE INDEX IF NOT EXISTS idx_hs_custody_records_org_id ON hs_custody_records(org_id);

-- إضافة عمود custody_id إلى جدول الإدخالات الموجود
ALTER TABLE hs_custody_entries ADD COLUMN IF NOT EXISTS custody_id INTEGER REFERENCES hs_custody_records(id) ON DELETE CASCADE;

-- ترحيل البيانات الموجودة: إنشاء سجل افتراضي لكل org لديها إدخالات يتيمة
DO $$
DECLARE
  v_org_id  INTEGER;
  v_user_id INTEGER;
  v_rec_id  INTEGER;
BEGIN
  FOR v_org_id IN SELECT DISTINCT org_id FROM hs_custody_entries WHERE custody_id IS NULL LOOP
    -- أخذ أول مستخدم admin في المنظمة
    SELECT id INTO v_user_id FROM users
      WHERE org_id = v_org_id AND role IN ('admin','superadmin')
      ORDER BY id LIMIT 1;
    -- fallback: أي مستخدم في المنظمة
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM users WHERE org_id = v_org_id ORDER BY id LIMIT 1;
    END IF;
    IF v_user_id IS NOT NULL THEN
      INSERT INTO hs_custody_records (org_id, created_by_user_id, record_number, custody_name)
      VALUES (v_org_id, v_user_id, 1, 'عهدة عامة')
      RETURNING id INTO v_rec_id;
      UPDATE hs_custody_entries
        SET custody_id = v_rec_id
        WHERE org_id = v_org_id AND custody_id IS NULL;
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_hs_custody_entries_custody_id ON hs_custody_entries(custody_id);

UPDATE _schema_version SET version = '0023_custody_records', stamped_at = NOW() WHERE id = 1;
