-- Migration: 0062_zatca_invoice_lifecycle
-- Adds auditable lifecycle, idempotency, and redacted request/response metadata.
-- Additive only; no Production connection or data rewrite.

ALTER TABLE zatca_invoice_transactions
  ADD COLUMN IF NOT EXISTS invoice_counter INTEGER,
  ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS authority_status VARCHAR(80),
  ADD COLUMN IF NOT EXISTS warnings JSONB,
  ADD COLUMN IF NOT EXISTS errors JSONB,
  ADD COLUMN IF NOT EXISTS request_payload JSONB,
  ADD COLUMN IF NOT EXISTS response_payload JSONB,
  ADD COLUMN IF NOT EXISTS response_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS uncertain_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(160),
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_zatca_trx_lifecycle_status
  ON zatca_invoice_transactions(org_id, invoice_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_zatca_trx_uncertain
  ON zatca_invoice_transactions(org_id, uncertain_at DESC)
  WHERE uncertain_at IS NOT NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_zatca_trx_correlation
  ON zatca_invoice_transactions(org_id, correlation_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_zatca_trx_invoice_active
  ON zatca_invoice_transactions(org_id, invoice_id)
  WHERE invoice_id IS NOT NULL AND is_active = true AND is_deleted = false;