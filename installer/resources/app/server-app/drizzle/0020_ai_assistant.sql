-- Migration 0020: AI Assistant (المساعد الذكي) — phase 1
-- Self-sufficient: runs on a fresh DB (IF NOT EXISTS everywhere).

CREATE TABLE IF NOT EXISTS "ai_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "enabled" boolean DEFAULT false NOT NULL,
  "provider" varchar(50) DEFAULT 'openai' NOT NULL,
  "base_url" varchar(500) DEFAULT 'https://api.openai.com/v1' NOT NULL,
  "model" varchar(100) DEFAULT 'gpt-4o-mini' NOT NULL,
  "api_key_enc" text,
  "max_tokens" integer DEFAULT 1024 NOT NULL,
  "temperature" numeric(3,2) DEFAULT '0.30' NOT NULL,
  "allow_org_data" boolean DEFAULT true NOT NULL,
  "keep_history" boolean DEFAULT true NOT NULL,
  "retention_days" integer DEFAULT 90 NOT NULL,
  "last_error" text,
  "last_ok_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_settings_org_uidx" ON "ai_settings" ("org_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "title" varchar(255) DEFAULT 'محادثة جديدة' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conversations_org_user_idx" ON "ai_conversations" ("org_id", "user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "conversation_id" integer NOT NULL REFERENCES "ai_conversations"("id") ON DELETE cascade,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "role" varchar(20) NOT NULL,
  "content" text NOT NULL,
  "sources" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_messages_conversation_idx" ON "ai_messages" ("conversation_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_action_proposals" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "conversation_id" integer REFERENCES "ai_conversations"("id") ON DELETE set null,
  "action_type" varchar(50) NOT NULL,
  "payload" jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "result_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_audit_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "conversation_id" integer,
  "question" text,
  "operation_type" varchar(50) NOT NULL,
  "sections" jsonb,
  "records_used" jsonb,
  "answer_summary" text,
  "proposed" boolean DEFAULT false NOT NULL,
  "confirmed" boolean DEFAULT false NOT NULL,
  "result" varchar(20) DEFAULT 'ok' NOT NULL,
  "error_message" text,
  "provider" varchar(50),
  "model" varchar(100),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_audit_logs_org_idx" ON "ai_audit_logs" ("org_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hs_tasks" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "created_by_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "assignee_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "title" varchar(300) NOT NULL,
  "details" text,
  "due_date" varchar(10),
  "due_time" varchar(5),
  "priority" varchar(10) DEFAULT 'normal' NOT NULL,
  "status" varchar(20) DEFAULT 'open' NOT NULL,
  "source" varchar(20) DEFAULT 'manual' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hs_tasks_org_idx" ON "hs_tasks" ("org_id", "status");
