-- Migration: 0011_add_zatca_integration
-- Add ZATCA (هيئة الزكاة والضريبة والجمارك) integration fields

-- 1. Add ZATCA config column to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS zatca_config JSONB;

-- 2. Add ZATCA fields to sales_invoices
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS zatca_uuid VARCHAR(100);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS zatca_hash VARCHAR(256);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS zatca_qr_code TEXT;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS zatca_xml TEXT;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS zatca_status VARCHAR(30) DEFAULT 'not_submitted';
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS zatca_cleared_at TIMESTAMP;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS zatca_response JSONB;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS zatca_invoice_counter INTEGER;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS zatca_pih VARCHAR(256);

-- 3. Create zatca_logs table
CREATE TABLE IF NOT EXISTS zatca_logs (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES sales_invoices(id) ON DELETE SET NULL,
  invoice_number VARCHAR(100),
  event_type VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL,
  environment VARCHAR(20) DEFAULT 'sandbox',
  request_body TEXT,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. Index for fast log retrieval
CREATE INDEX IF NOT EXISTS idx_zatca_logs_org_id ON zatca_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_zatca_logs_invoice_id ON zatca_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_zatca_logs_created_at ON zatca_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_zatca_status ON sales_invoices(zatca_status);
