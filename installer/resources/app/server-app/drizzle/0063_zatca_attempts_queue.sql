-- Migration: 0063_zatca_attempts_queue
-- Adds durable per-attempt audit records and a Mock-only persistent queue.
-- Additive only. No legacy data is rewritten and no external request is made.

CREATE TABLE IF NOT EXISTS zatca_submission_attempts (
  id               SERIAL PRIMARY KEY,
  org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id   INTEGER NOT NULL REFERENCES zatca_invoice_transactions(id) ON DELETE CASCADE,
  attempt_number  INTEGER NOT NULL,
  attempt_id      UUID NOT NULL DEFAULT gen_random_uuid(),
  started_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMP,
  request_id      VARCHAR(120),
  http_status     INTEGER,
  request_payload JSONB,
  response_payload JSONB,
  result          VARCHAR(40) NOT NULL DEFAULT 'started',
  error_message   TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT zatca_submission_attempt_transaction_number_uq UNIQUE (transaction_id, attempt_number),
  CONSTRAINT zatca_submission_attempt_attempt_id_uq UNIQUE (attempt_id)
);

CREATE TABLE IF NOT EXISTS zatca_submission_queue (
  id               SERIAL PRIMARY KEY,
  org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id   INTEGER NOT NULL REFERENCES zatca_invoice_transactions(id) ON DELETE CASCADE,
  pos_unit_id      INTEGER REFERENCES zatca_pos_units(id) ON DELETE SET NULL,
  device_id        INTEGER REFERENCES zatca_devices(id) ON DELETE SET NULL,
  queue_key        VARCHAR(160) NOT NULL,
  operation        VARCHAR(20) NOT NULL,
  uuid             UUID,
  invoice_counter  INTEGER,
  idempotency_key  VARCHAR(160),
  mock_outcome     VARCHAR(40) NOT NULL DEFAULT 'accepted',
  state            VARCHAR(20) NOT NULL DEFAULT 'queued',
  available_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  locked_at        TIMESTAMP,
  locked_by        VARCHAR(120),
  attempt_id       UUID,
  last_error       TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS zatca_submission_queue_due_idx
  ON zatca_submission_queue(state, available_at);
CREATE INDEX IF NOT EXISTS zatca_submission_queue_unit_idx
  ON zatca_submission_queue(queue_key, state);