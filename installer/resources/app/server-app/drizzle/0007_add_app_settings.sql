-- جدول إعدادات التطبيق العامة (key-value store)
CREATE TABLE IF NOT EXISTS app_settings (
  id         serial PRIMARY KEY,
  org_id     integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key        varchar(100) NOT NULL,
  value      text,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_settings_org_key_uidx ON app_settings(org_id, key);
