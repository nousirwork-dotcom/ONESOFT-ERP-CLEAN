-- Migration: 0014_add_theme_settings
-- Adds theme_settings JSONB column to organizations table.
-- Stores the full branding/theme config as JSON so future fields
-- can be added without additional migrations.

--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "theme_settings" jsonb;
