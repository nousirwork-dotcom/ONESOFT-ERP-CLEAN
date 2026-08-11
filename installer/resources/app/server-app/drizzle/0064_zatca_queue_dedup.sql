-- Migration: 0064_zatca_queue_dedup
-- Enforces one durable queue item and one active ZATCA transaction per invoice.
-- This migration is intentionally fail-closed if pre-existing duplicates exist.

DROP INDEX IF EXISTS zatca_submission_queue_transaction_active_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS zatca_submission_queue_transaction_uidx
  ON zatca_submission_queue(transaction_id);

CREATE UNIQUE INDEX IF NOT EXISTS zatca_invoice_transactions_active_invoice_uidx
  ON zatca_invoice_transactions(invoice_id)
  WHERE invoice_id IS NOT NULL AND is_active = true AND is_deleted = false;