-- Migration 0037: add extended fields to users table
-- user_group_id, default_branch_id, default_warehouse_id, default_language, allow_login

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "user_group_id"       INTEGER REFERENCES user_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "default_branch_id"   INTEGER REFERENCES branches(id)    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "default_warehouse_id" INTEGER REFERENCES warehouses(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "default_language"    VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "allow_login"         BOOLEAN NOT NULL DEFAULT TRUE;
