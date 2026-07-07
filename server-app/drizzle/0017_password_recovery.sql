-- Migration 0017: Password Recovery + Mobile Verification

-- ── حقول جديدة في جدول المستخدمين ────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_verified_at      TIMESTAMP,
  ADD COLUMN IF NOT EXISTS email_verified_at      TIMESTAMP,
  ADD COLUMN IF NOT EXISTS password_changed_at    TIMESTAMP,
  ADD COLUMN IF NOT EXISTS force_password_change  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recovery_enabled_phone BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recovery_enabled_email BOOLEAN NOT NULL DEFAULT FALSE;

-- ── رموز التحقق من الجوال / البريد ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verification_tokens (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type    VARCHAR(10)  NOT NULL,
  target_value   VARCHAR(255) NOT NULL,
  otp_hash       VARCHAR(255) NOT NULL,
  expires_at     TIMESTAMP    NOT NULL,
  used_at        TIMESTAMP,
  attempts_count INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── رموز إعادة تعيين كلمة المرور ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel        VARCHAR(10)  NOT NULL,
  otp_hash       VARCHAR(255) NOT NULL,
  reset_token    VARCHAR(100) NOT NULL UNIQUE,
  expires_at     TIMESTAMP    NOT NULL,
  used_at        TIMESTAMP,
  attempts_count INTEGER NOT NULL DEFAULT 0,
  request_ip     VARCHAR(64),
  device_info    TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── سجل الأحداث الأمنية ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_events (
  id          SERIAL PRIMARY KEY,
  event_type  VARCHAR(80) NOT NULL,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username    VARCHAR(100),
  phone       VARCHAR(50),
  email       VARCHAR(255),
  org_id      INTEGER,
  result      VARCHAR(20) NOT NULL DEFAULT 'success',
  reason      TEXT,
  ip          VARCHAR(64),
  device_info TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

UPDATE _schema_version SET version = '0017_password_recovery' WHERE id = 1;
