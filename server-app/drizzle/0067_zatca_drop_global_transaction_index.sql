-- Migration: 0067_zatca_drop_global_transaction_index
-- 0062 already provides the correct organization-scoped active-invoice index.

DROP INDEX IF EXISTS zatca_invoice_transactions_active_invoice_uidx;