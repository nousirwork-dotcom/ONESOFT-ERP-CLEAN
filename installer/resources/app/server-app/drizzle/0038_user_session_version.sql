-- Migration 0038: add session_version to users for real JWT invalidation
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;
