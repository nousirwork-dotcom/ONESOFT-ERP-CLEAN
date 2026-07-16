-- Migration 0036: add customers_journal + suppliers_journal to document_types
-- These columns exist in production but were never captured in a migration file.
ALTER TABLE document_types
  ADD COLUMN IF NOT EXISTS "customers_journal" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "suppliers_journal" VARCHAR(50);
