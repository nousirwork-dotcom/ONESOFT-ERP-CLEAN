-- Migration: 0066_zatca_transaction_index_scope
-- Keep the active-transaction uniqueness scoped to an organization.

DROP INDEX IF EXISTS zatca_invoice_transactions_active_invoice_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS idx_zatca_trx_invoice_active
  ON zatca_invoice_transactions(org_id, invoice_id)
  WHERE invoice_id IS NOT NULL AND is_active = true AND is_deleted = false;