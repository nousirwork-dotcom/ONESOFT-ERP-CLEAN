-- Migration: 0012_zatca_database_architecture
-- ZATCA Database Architecture — 14 جدولاً لوحدة التكامل مع هيئة الزكاة والضريبة والجمارك
-- جميع الجداول: created_at, updated_at, created_by, updated_by, is_active, is_deleted

-- ─── 1. ZATCA_Environments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zatca_environments (
  id               SERIAL PRIMARY KEY,
  org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             VARCHAR(50)  NOT NULL,          -- Sandbox | Simulation | Production
  base_api_url     TEXT         NOT NULL,
  compliance_url   TEXT,
  reporting_url    TEXT,
  clearance_url    TEXT,
  oauth_url        TEXT,
  portal_url       TEXT,
  is_default       BOOLEAN NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(org_id, name)
);

-- ─── 2. ZATCA_Devices ────────────────────────────────────────────────────────
-- current_csid_id FK أُضيفت بعد إنشاء جدول zatca_csid (الخطوة 4)
CREATE TABLE IF NOT EXISTS zatca_devices (
  id                     SERIAL PRIMARY KEY,
  org_id                 INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_name            VARCHAR(255) NOT NULL,
  device_uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
  serial_number          VARCHAR(100),
  branch_id              INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  environment_id         INTEGER REFERENCES zatca_environments(id) ON DELETE SET NULL,
  user_id                INTEGER REFERENCES users(id) ON DELETE SET NULL,
  registration_status    VARCHAR(30) NOT NULL DEFAULT 'pending',
  last_registration_date TIMESTAMP,
  last_connection_date   TIMESTAMP,
  current_csid_id        INTEGER,                  -- FK مؤجَّل: يُضاف بعد جدول zatca_csid
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(org_id, serial_number)
);

-- ─── 3. ZATCA_Certificates ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zatca_certificates (
  id                    SERIAL PRIMARY KEY,
  org_id                INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_id             INTEGER REFERENCES zatca_devices(id) ON DELETE SET NULL,
  csr                   TEXT,
  public_certificate    TEXT,
  private_key_encrypted TEXT,                      -- مشفَّر AES-256-GCM
  secret_key_encrypted  TEXT,                      -- مشفَّر AES-256-GCM
  certificate_version   VARCHAR(20),
  start_date            TIMESTAMP,
  expiry_date           TIMESTAMP,
  status                VARCHAR(30) NOT NULL DEFAULT 'pending',
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by            INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- ─── 4. ZATCA_CSID ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zatca_csid (
  id                  SERIAL PRIMARY KEY,
  org_id              INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_id           INTEGER REFERENCES zatca_devices(id) ON DELETE SET NULL,
  certificate_id      INTEGER REFERENCES zatca_certificates(id) ON DELETE SET NULL,
  compliance_csid     TEXT,
  production_csid     TEXT,
  issue_date          TIMESTAMP,
  expiry_date         TIMESTAMP,
  status              VARCHAR(30) NOT NULL DEFAULT 'active',
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by          INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- ربط المفتاح الخارجي الدوري: zatca_devices.current_csid_id → zatca_csid
ALTER TABLE zatca_devices
  ADD CONSTRAINT fk_zatca_devices_current_csid
  FOREIGN KEY (current_csid_id) REFERENCES zatca_csid(id) ON DELETE SET NULL;

-- ─── 5. ZATCA_Keys ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zatca_keys (
  id                    SERIAL PRIMARY KEY,
  org_id                INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_id             INTEGER REFERENCES zatca_devices(id) ON DELETE SET NULL,
  algorithm             VARCHAR(20) NOT NULL DEFAULT 'EC',
  curve                 VARCHAR(20) DEFAULT 'secp256k1',
  public_key            TEXT,
  private_key_encrypted TEXT,                      -- مشفَّر AES-256-GCM
  fingerprint           VARCHAR(128),
  status                VARCHAR(30) NOT NULL DEFAULT 'active',
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by            INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- ─── 6. ZATCA_CSR_Requests ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zatca_csr_requests (
  id           SERIAL PRIMARY KEY,
  org_id       INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_id    INTEGER REFERENCES zatca_devices(id) ON DELETE SET NULL,
  csr_text     TEXT,
  pem          TEXT,
  request_date TIMESTAMP NOT NULL DEFAULT NOW(),
  status       VARCHAR(30) NOT NULL DEFAULT 'pending',
  response     TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by   INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- ─── 7. ZATCA_Invoice_Transactions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zatca_invoice_transactions (
  id               SERIAL PRIMARY KEY,
  org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id       INTEGER REFERENCES sales_invoices(id) ON DELETE SET NULL,
  invoice_number   VARCHAR(100),
  invoice_uuid     UUID,
  invoice_hash     VARCHAR(256),
  qr_hash          TEXT,
  device_id        INTEGER REFERENCES zatca_devices(id) ON DELETE SET NULL,
  environment_id   INTEGER REFERENCES zatca_environments(id) ON DELETE SET NULL,
  submission_type  VARCHAR(30) NOT NULL DEFAULT 'clearance',
  submission_date  TIMESTAMP NOT NULL DEFAULT NOW(),
  invoice_status   VARCHAR(30) NOT NULL DEFAULT 'pending',
  http_status      INTEGER,
  response_code    VARCHAR(50),
  response_message TEXT,
  execution_time_ms INTEGER,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by       INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- ─── 8. ZATCA_Request_Log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zatca_request_log (
  id             SERIAL PRIMARY KEY,
  org_id         INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id INTEGER REFERENCES zatca_invoice_transactions(id) ON DELETE SET NULL,
  url            TEXT,
  http_method    VARCHAR(10) NOT NULL DEFAULT 'POST',
  headers        JSONB,
  request_body   TEXT,
  request_time   TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by     INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- ─── 9. ZATCA_Response_Log ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zatca_response_log (
  id             SERIAL PRIMARY KEY,
  org_id         INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id INTEGER REFERENCES zatca_invoice_transactions(id) ON DELETE SET NULL,
  http_status    INTEGER,
  headers        JSONB,
  response_body  TEXT,
  response_time  TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by     INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- ─── 10. ZATCA_Error_Log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zatca_error_log (
  id             SERIAL PRIMARY KEY,
  org_id         INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id INTEGER REFERENCES zatca_invoice_transactions(id) ON DELETE SET NULL,
  error_code     VARCHAR(100),
  error_type     VARCHAR(100),
  error_message  TEXT,
  stack_trace    TEXT,
  resolution     TEXT,
  retry_count    INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by     INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- ─── 11. ZATCA_XML_Documents ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zatca_xml_documents (
  id                  SERIAL PRIMARY KEY,
  org_id              INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id          INTEGER REFERENCES sales_invoices(id) ON DELETE SET NULL,
  xml_before_signing  TEXT,
  xml_after_signing   TEXT,
  xml_version         VARCHAR(20) DEFAULT '2.1',
  validation_result   JSONB,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by          INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- ─── 12. ZATCA_QR_Codes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zatca_qr_codes (
  id              SERIAL PRIMARY KEY,
  org_id          INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id      INTEGER REFERENCES sales_invoices(id) ON DELETE SET NULL,
  tlv_data        TEXT,
  base64          TEXT,
  generation_date TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- ─── 13. ZATCA_Settings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zatca_settings (
  id                      SERIAL PRIMARY KEY,
  org_id                  INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  default_environment_id  INTEGER REFERENCES zatca_environments(id) ON DELETE SET NULL,
  enable_zatca            BOOLEAN NOT NULL DEFAULT FALSE,
  auto_retry              BOOLEAN NOT NULL DEFAULT TRUE,
  retry_count             INTEGER NOT NULL DEFAULT 3,
  timeout_seconds         INTEGER NOT NULL DEFAULT 30,
  proxy_settings          JSONB,
  log_level               VARCHAR(20) NOT NULL DEFAULT 'info',
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by              INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by              INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(org_id)
);

-- ─── 14. ZATCA_API_History ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zatca_api_history (
  id          SERIAL PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  api_name    VARCHAR(100),
  url         TEXT,
  method      VARCHAR(10) NOT NULL DEFAULT 'POST',
  start_time  TIMESTAMP NOT NULL DEFAULT NOW(),
  end_time    TIMESTAMP,
  duration_ms INTEGER,
  result      VARCHAR(30),
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name   VARCHAR(200),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- zatca_environments
CREATE INDEX IF NOT EXISTS idx_zatca_env_org_id     ON zatca_environments(org_id);
CREATE INDEX IF NOT EXISTS idx_zatca_env_is_default ON zatca_environments(org_id, is_default);

-- zatca_devices
CREATE INDEX IF NOT EXISTS idx_zatca_dev_org_id  ON zatca_devices(org_id);
CREATE INDEX IF NOT EXISTS idx_zatca_dev_uuid    ON zatca_devices(device_uuid);
CREATE INDEX IF NOT EXISTS idx_zatca_dev_env     ON zatca_devices(environment_id);
CREATE INDEX IF NOT EXISTS idx_zatca_dev_status  ON zatca_devices(registration_status);
CREATE INDEX IF NOT EXISTS idx_zatca_dev_branch  ON zatca_devices(branch_id);

-- zatca_certificates
CREATE INDEX IF NOT EXISTS idx_zatca_cert_org_id    ON zatca_certificates(org_id);
CREATE INDEX IF NOT EXISTS idx_zatca_cert_device_id ON zatca_certificates(device_id);
CREATE INDEX IF NOT EXISTS idx_zatca_cert_status    ON zatca_certificates(status);
CREATE INDEX IF NOT EXISTS idx_zatca_cert_expiry    ON zatca_certificates(expiry_date);

-- zatca_csid
CREATE INDEX IF NOT EXISTS idx_zatca_csid_org_id    ON zatca_csid(org_id);
CREATE INDEX IF NOT EXISTS idx_zatca_csid_device_id ON zatca_csid(device_id);
CREATE INDEX IF NOT EXISTS idx_zatca_csid_status    ON zatca_csid(status);
CREATE INDEX IF NOT EXISTS idx_zatca_csid_expiry    ON zatca_csid(expiry_date);

-- zatca_keys
CREATE INDEX IF NOT EXISTS idx_zatca_keys_org_id      ON zatca_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_zatca_keys_device_id   ON zatca_keys(device_id);
CREATE INDEX IF NOT EXISTS idx_zatca_keys_fingerprint ON zatca_keys(fingerprint);

-- zatca_csr_requests
CREATE INDEX IF NOT EXISTS idx_zatca_csr_org_id    ON zatca_csr_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_zatca_csr_device_id ON zatca_csr_requests(device_id);
CREATE INDEX IF NOT EXISTS idx_zatca_csr_status    ON zatca_csr_requests(status);

-- zatca_invoice_transactions
CREATE INDEX IF NOT EXISTS idx_zatca_trx_org_id         ON zatca_invoice_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_zatca_trx_invoice_id     ON zatca_invoice_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_zatca_trx_invoice_number ON zatca_invoice_transactions(invoice_number);
CREATE INDEX IF NOT EXISTS idx_zatca_trx_uuid           ON zatca_invoice_transactions(invoice_uuid);
CREATE INDEX IF NOT EXISTS idx_zatca_trx_device_id      ON zatca_invoice_transactions(device_id);
CREATE INDEX IF NOT EXISTS idx_zatca_trx_status         ON zatca_invoice_transactions(invoice_status);
CREATE INDEX IF NOT EXISTS idx_zatca_trx_sub_date       ON zatca_invoice_transactions(submission_date DESC);
CREATE INDEX IF NOT EXISTS idx_zatca_trx_env            ON zatca_invoice_transactions(environment_id);

-- zatca_request_log
CREATE INDEX IF NOT EXISTS idx_zatca_req_org_id     ON zatca_request_log(org_id);
CREATE INDEX IF NOT EXISTS idx_zatca_req_trx_id     ON zatca_request_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_zatca_req_time       ON zatca_request_log(request_time DESC);

-- zatca_response_log
CREATE INDEX IF NOT EXISTS idx_zatca_res_org_id     ON zatca_response_log(org_id);
CREATE INDEX IF NOT EXISTS idx_zatca_res_trx_id     ON zatca_response_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_zatca_res_time       ON zatca_response_log(response_time DESC);

-- zatca_error_log
CREATE INDEX IF NOT EXISTS idx_zatca_err_org_id     ON zatca_error_log(org_id);
CREATE INDEX IF NOT EXISTS idx_zatca_err_trx_id     ON zatca_error_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_zatca_err_created_at ON zatca_error_log(created_at DESC);

-- zatca_xml_documents
CREATE INDEX IF NOT EXISTS idx_zatca_xml_org_id     ON zatca_xml_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_zatca_xml_invoice_id ON zatca_xml_documents(invoice_id);

-- zatca_qr_codes
CREATE INDEX IF NOT EXISTS idx_zatca_qr_org_id      ON zatca_qr_codes(org_id);
CREATE INDEX IF NOT EXISTS idx_zatca_qr_invoice_id  ON zatca_qr_codes(invoice_id);

-- zatca_api_history
CREATE INDEX IF NOT EXISTS idx_zatca_api_org_id     ON zatca_api_history(org_id);
CREATE INDEX IF NOT EXISTS idx_zatca_api_start_time ON zatca_api_history(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_zatca_api_result     ON zatca_api_history(result);
