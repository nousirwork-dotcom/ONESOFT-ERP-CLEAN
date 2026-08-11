-- Migration 0018: Trial / First-Run support
-- Adds password_status to users table so the system can differentiate
-- between "no password set" (trial auto-login) and "password set" (normal login).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_status VARCHAR(20) NOT NULL DEFAULT 'set';
