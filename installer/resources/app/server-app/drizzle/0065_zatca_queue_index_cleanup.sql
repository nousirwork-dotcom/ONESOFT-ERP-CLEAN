-- Migration: 0065_zatca_queue_index_cleanup
-- Removes the superseded partial queue index after 0064 introduced the
-- transaction-wide uniqueness guarantee.

DROP INDEX IF EXISTS zatca_submission_queue_transaction_active_uidx;