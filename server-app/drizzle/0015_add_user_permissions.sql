-- Migration 0015: Add extra_permissions to users table
-- Enables fine-grained permissions independent of role (e.g. manage_branding)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "extra_permissions" jsonb DEFAULT '{}'::jsonb;
