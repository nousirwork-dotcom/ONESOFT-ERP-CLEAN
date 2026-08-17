-- Central polymorphic document lineage and audit-only Unpost history.
-- Generated accounting/stock documents remain deletable; this audit stores
-- immutable snapshots of what was removed.

CREATE TABLE IF NOT EXISTS "document_relations" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "source_document_type" varchar(50) NOT NULL,
  "source_document_id" integer NOT NULL,
  "generated_document_type" varchar(50) NOT NULL,
  "generated_document_id" integer NOT NULL,
  "relation_type" varchar(30) NOT NULL,
  "posting_batch_id" varchar(80),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "document_relations_unique_link_uidx"
  ON "document_relations" (
    "org_id",
    "source_document_type",
    "source_document_id",
    "generated_document_type",
    "generated_document_id",
    "relation_type"
  );
CREATE INDEX IF NOT EXISTS "document_relations_source_idx"
  ON "document_relations" ("org_id", "source_document_type", "source_document_id");
CREATE INDEX IF NOT EXISTS "document_relations_generated_idx"
  ON "document_relations" ("org_id", "generated_document_type", "generated_document_id");

CREATE TABLE IF NOT EXISTS "unpost_audit" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "posting_batch_id" varchar(80) NOT NULL,
  "source_document_type" varchar(50) NOT NULL,
  "source_document_id" integer NOT NULL,
  "source_document_number" varchar(100) NOT NULL,
  "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "unposted_at" timestamp NOT NULL DEFAULT now(),
  "reason" text,
  "deleted_documents" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "unpost_audit_source_idx"
  ON "unpost_audit" ("org_id", "source_document_type", "source_document_id");
CREATE INDEX IF NOT EXISTS "unpost_audit_batch_idx"
  ON "unpost_audit" ("org_id", "posting_batch_id");