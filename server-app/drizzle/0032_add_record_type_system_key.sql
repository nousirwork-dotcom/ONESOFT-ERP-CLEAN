-- Migration 0032: إضافة record_type و system_key لشجرة الحسابات
ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS record_type VARCHAR(30) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS system_key  VARCHAR(100);

-- فهرس فريد على (org_id, system_key) للسجلات النظامية فقط
CREATE UNIQUE INDEX IF NOT EXISTS chart_of_accounts_org_system_key_uidx
  ON chart_of_accounts(org_id, system_key)
  WHERE system_key IS NOT NULL;
