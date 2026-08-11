-- إضافة حقول WABA المتقدمة إلى send_settings
ALTER TABLE send_settings
  ADD COLUMN IF NOT EXISTS waba_business_account_id varchar(100),
  ADD COLUMN IF NOT EXISTS waba_verify_token         varchar(255),
  ADD COLUMN IF NOT EXISTS waba_webhook_url          varchar(500);

-- إضافة meta_message_id لسجل الإرسال
ALTER TABLE document_send_logs
  ADD COLUMN IF NOT EXISTS meta_message_id varchar(100);

-- جدول قوالب رسائل WhatsApp
CREATE TABLE IF NOT EXISTS waba_message_templates (
  id         serial PRIMARY KEY,
  org_id     integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key        varchar(100) NOT NULL,
  label      varchar(255) NOT NULL,
  doc_type   varchar(50),
  channel    varchar(20) NOT NULL DEFAULT 'whatsapp',
  content    text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
