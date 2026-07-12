-- Migration 0016: License-Center tables (lc_*) + extend lc_clients/lc_licenses
--
-- ملاحظة حرجة: جداول lc_* كانت تُنشأ في بيئة التطوير عبر drizzle-kit push فقط،
-- ولم تكن موجودة في base_schema.sql ولا في أي migration — ما جعل هذا الملف
-- يفشل على أي قاعدة بيانات جديدة (fresh install) لأن lc_clients غير موجود.
-- الحل: هذا الملف الآن مكتفٍ بذاته — ينشئ الأنواع والجداول أولاً (idempotent)
-- ثم يطبّق التوسعات. قواعد البيانات القديمة التي طبّقته مسبقاً تتخطاه تلقائياً،
-- والقواعد التي تحتوي الجداول أصلاً لا تتأثر (IF NOT EXISTS في كل خطوة).

-- ── 1) الأنواع (enums) ──────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE lc_device_status AS ENUM ('active', 'inactive', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lc_license_status AS ENUM ('active', 'suspended', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lc_license_type AS ENUM ('trial', 'subscription', 'lifetime');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lc_op_type AS ENUM (
    'create_client', 'create_license', 'activate', 'suspend', 'resume',
    'renew', 'revoke_device', 'generate_key', 'generate_activation_code'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2) الجداول الأساسية ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lc_clients (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  org_id         VARCHAR(80)  NOT NULL UNIQUE,
  commercial_reg VARCHAR(80),
  tax_number     VARCHAR(80),
  phone          VARCHAR(50),
  email          VARCHAR(255),
  notes          TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lc_licenses (
  id              SERIAL PRIMARY KEY,
  license_id      VARCHAR(120) NOT NULL UNIQUE,
  client_id       INTEGER NOT NULL REFERENCES lc_clients(id) ON DELETE CASCADE,
  package_name    VARCHAR(120),
  license_type    lc_license_type NOT NULL DEFAULT 'subscription',
  status          lc_license_status NOT NULL DEFAULT 'active',
  max_users       INTEGER NOT NULL DEFAULT 5,
  max_branches    INTEGER NOT NULL DEFAULT 1,
  max_pos         INTEGER NOT NULL DEFAULT 1,
  max_devices     INTEGER NOT NULL DEFAULT 3,
  max_web         INTEGER NOT NULL DEFAULT 1,
  enabled_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  web_allowed     BOOLEAN NOT NULL DEFAULT false,
  desktop_allowed BOOLEAN NOT NULL DEFAULT true,
  offline_allowed BOOLEAN NOT NULL DEFAULT false,
  start_date      VARCHAR(20) NOT NULL,
  expiry_date     VARCHAR(20) NOT NULL,
  license_key     TEXT,
  notes           TEXT,
  issued_by       VARCHAR(120) NOT NULL DEFAULT 'OneSoft ERP',
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lc_devices (
  id                SERIAL PRIMARY KEY,
  license_id        INTEGER NOT NULL REFERENCES lc_licenses(id) ON DELETE CASCADE,
  device_name       VARCHAR(120) NOT NULL,
  device_id         VARCHAR(255) NOT NULL,
  hw_fingerprint    VARCHAR(255),
  status            lc_device_status NOT NULL DEFAULT 'active',
  last_activated_at TIMESTAMP,
  created_at        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lc_operations_log (
  id             SERIAL PRIMARY KEY,
  client_id      INTEGER REFERENCES lc_clients(id) ON DELETE SET NULL,
  license_id     INTEGER,
  operation_type lc_op_type NOT NULL,
  description    VARCHAR(500) NOT NULL,
  performed_by   VARCHAR(120),
  metadata       JSONB,
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);

-- ── 3) التوسعات (Customer tab الكامل) ───────────────────────────────────────
ALTER TABLE lc_clients
  ADD COLUMN IF NOT EXISTS trade_name          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS country             VARCHAR(80),
  ADD COLUMN IF NOT EXISTS city                VARCHAR(80),
  ADD COLUMN IF NOT EXISTS activity_type       VARCHAR(120),
  ADD COLUMN IF NOT EXISTS contact_name        VARCHAR(120),
  ADD COLUMN IF NOT EXISTS contact_phone       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS contact_email       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS run_type            VARCHAR(20) NOT NULL DEFAULT 'desktop',
  ADD COLUMN IF NOT EXISTS web_setup_token     VARCHAR(120),
  ADD COLUMN IF NOT EXISTS web_setup_token_used BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE lc_licenses
  ADD COLUMN IF NOT EXISTS sync_allowed BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE lc_op_type ADD VALUE IF NOT EXISTS 'update_client';
ALTER TYPE lc_op_type ADD VALUE IF NOT EXISTS 'update_license';
ALTER TYPE lc_op_type ADD VALUE IF NOT EXISTS 'export_license';
ALTER TYPE lc_op_type ADD VALUE IF NOT EXISTS 'generate_web_setup';
