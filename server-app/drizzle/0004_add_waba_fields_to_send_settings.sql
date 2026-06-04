-- إضافة حقول WhatsApp Business API إلى جدول send_settings
ALTER TABLE send_settings
  ADD COLUMN IF NOT EXISTS waba_enabled       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waba_api_url       text,
  ADD COLUMN IF NOT EXISTS waba_access_token  text,
  ADD COLUMN IF NOT EXISTS waba_phone_number_id varchar(100),
  ADD COLUMN IF NOT EXISTS waba_sender_name   varchar(255);
