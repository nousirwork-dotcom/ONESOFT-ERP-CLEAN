ALTER TABLE "document_journals" ADD COLUMN IF NOT EXISTS "draft_auto_serial" boolean DEFAULT false NOT NULL;
ALTER TABLE "document_journals" ADD COLUMN IF NOT EXISTS "draft_number_prefix" varchar(20) DEFAULT 'DRAFT' NOT NULL;
ALTER TABLE "document_journals" ADD COLUMN IF NOT EXISTS "draft_first_number" integer DEFAULT 1 NOT NULL;
ALTER TABLE "document_journals" ADD COLUMN IF NOT EXISTS "draft_last_number" integer DEFAULT 999999 NOT NULL;
ALTER TABLE "document_journals" ADD COLUMN IF NOT EXISTS "draft_num_digits" integer DEFAULT 6 NOT NULL;
ALTER TABLE "document_journals" ADD COLUMN IF NOT EXISTS "draft_current_seq" integer DEFAULT 0 NOT NULL;
