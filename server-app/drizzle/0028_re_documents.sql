-- Migration 0028: Real Estate Project Documents
-- Tables: re_projects, re_document_types, re_documents, re_document_versions

CREATE TABLE IF NOT EXISTS "re_projects" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "code" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "location" varchar(255),
  "owner_name" varchar(255),
  "plot_number" varchar(50),
  "plan_number" varchar(50),
  "start_date" timestamp,
  "expected_end_date" timestamp,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "notes" text,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "re_document_types" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "icon" varchar(50),
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "re_documents" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" integer NOT NULL REFERENCES "re_projects"("id") ON DELETE CASCADE,
  "document_type_id" integer NOT NULL REFERENCES "re_document_types"("id") ON DELETE RESTRICT,
  "name" varchar(255) NOT NULL,
  "document_number" varchar(100),
  "issuer" varchar(255),
  "issue_date" timestamp,
  "expiry_date" timestamp,
  "needs_renewal" boolean NOT NULL DEFAULT false,
  "alert_days" integer DEFAULT 30,
  "notes" text,
  "file_path" text,
  "original_name" varchar(255),
  "file_size" integer,
  "mime_type" varchar(100),
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "re_document_versions" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "document_id" integer NOT NULL REFERENCES "re_documents"("id") ON DELETE CASCADE,
  "version_number" integer NOT NULL,
  "file_path" text NOT NULL,
  "original_name" varchar(255),
  "file_size" integer,
  "mime_type" varchar(100),
  "notes" text,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "re_projects_org_id_idx" ON "re_projects"("org_id");
CREATE INDEX IF NOT EXISTS "re_doc_types_org_id_idx" ON "re_document_types"("org_id");
CREATE INDEX IF NOT EXISTS "re_documents_org_id_idx" ON "re_documents"("org_id");
CREATE INDEX IF NOT EXISTS "re_documents_project_id_idx" ON "re_documents"("project_id");
CREATE INDEX IF NOT EXISTS "re_documents_type_id_idx" ON "re_documents"("document_type_id");
CREATE INDEX IF NOT EXISTS "re_doc_versions_doc_id_idx" ON "re_document_versions"("document_id");
