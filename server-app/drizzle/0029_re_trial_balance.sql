-- Migration 0029: Simplified Trial Balance for Real Estate Developer
-- Tables: re_trial_balances, re_tb_accounts, re_tb_entries, re_tb_tax_returns,
--         re_tb_purchase_links, re_tb_audit_log, re_tb_settlements

CREATE TABLE IF NOT EXISTS "re_trial_balances" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "period_label" varchar(100),
  "from_date" timestamp,
  "to_date" timestamp,
  "project_id" integer REFERENCES "re_projects"("id") ON DELETE SET NULL,
  "scope" varchar(20) NOT NULL DEFAULT 'org',
  "settlement_account_id" integer,
  "notes" text,
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "re_tb_accounts" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "trial_balance_id" integer NOT NULL REFERENCES "re_trial_balances"("id") ON DELETE CASCADE,
  "parent_id" integer REFERENCES "re_tb_accounts"("id") ON DELETE CASCADE,
  "code" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "category" varchar(50) NOT NULL,
  "nature" varchar(10) NOT NULL DEFAULT 'debit',
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_system" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "review_status" varchar(20) NOT NULL DEFAULT 'not_reviewed',
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

-- Fix self-reference FK after both tables exist
ALTER TABLE "re_trial_balances"
  ADD CONSTRAINT IF NOT EXISTS "re_trial_balances_settlement_account_id_fkey"
  FOREIGN KEY ("settlement_account_id") REFERENCES "re_tb_accounts"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "re_tb_entries" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "trial_balance_id" integer NOT NULL REFERENCES "re_trial_balances"("id") ON DELETE CASCADE,
  "account_id" integer NOT NULL REFERENCES "re_tb_accounts"("id") ON DELETE CASCADE,
  "opening_debit" decimal(18,2) NOT NULL DEFAULT '0',
  "opening_credit" decimal(18,2) NOT NULL DEFAULT '0',
  "movement_debit" decimal(18,2) NOT NULL DEFAULT '0',
  "movement_credit" decimal(18,2) NOT NULL DEFAULT '0',
  "ending_debit" decimal(18,2) NOT NULL DEFAULT '0',
  "ending_credit" decimal(18,2) NOT NULL DEFAULT '0',
  "notes" text,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "re_tb_tax_returns" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "trial_balance_id" integer NOT NULL REFERENCES "re_trial_balances"("id") ON DELETE CASCADE,
  "period_label" varchar(100),
  "purchases_pre_tax" decimal(18,2) NOT NULL DEFAULT '0',
  "purchase_returns" decimal(18,2) NOT NULL DEFAULT '0',
  "net_purchases" decimal(18,2) NOT NULL DEFAULT '0',
  "deductible_tax" decimal(18,2) NOT NULL DEFAULT '0',
  "opening_tax_balance" decimal(18,2) NOT NULL DEFAULT '0',
  "actual_refund" decimal(18,2) NOT NULL DEFAULT '0',
  "actual_offset" decimal(18,2) NOT NULL DEFAULT '0',
  "refund_status" varchar(30) NOT NULL DEFAULT 'not_submitted',
  "notes" text,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "re_tb_purchase_links" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "trial_balance_id" integer NOT NULL REFERENCES "re_trial_balances"("id") ON DELETE CASCADE,
  "account_id" integer NOT NULL REFERENCES "re_tb_accounts"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "re_tb_audit_log" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "trial_balance_id" integer NOT NULL REFERENCES "re_trial_balances"("id") ON DELETE CASCADE,
  "account_id" integer REFERENCES "re_tb_accounts"("id") ON DELETE SET NULL,
  "action" varchar(50) NOT NULL,
  "field_name" varchar(50),
  "old_value" text,
  "new_value" text,
  "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "user_name" varchar(255),
  "created_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "re_tb_settlements" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "trial_balance_id" integer NOT NULL REFERENCES "re_trial_balances"("id") ON DELETE CASCADE,
  "account_id" integer NOT NULL REFERENCES "re_tb_accounts"("id") ON DELETE CASCADE,
  "difference" decimal(18,2) NOT NULL,
  "direction" varchar(10) NOT NULL,
  "prev_balance_debit" decimal(18,2) NOT NULL DEFAULT '0',
  "prev_balance_credit" decimal(18,2) NOT NULL DEFAULT '0',
  "new_balance_debit" decimal(18,2) NOT NULL DEFAULT '0',
  "new_balance_credit" decimal(18,2) NOT NULL DEFAULT '0',
  "user_confirmed" boolean NOT NULL DEFAULT false,
  "confirmed_at" timestamp,
  "notes" text,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "re_tb_accounts_tbid_idx" ON "re_tb_accounts"("trial_balance_id");
CREATE INDEX IF NOT EXISTS "re_tb_accounts_org_idx" ON "re_tb_accounts"("org_id");
CREATE INDEX IF NOT EXISTS "re_tb_entries_tbid_idx" ON "re_tb_entries"("trial_balance_id");
CREATE INDEX IF NOT EXISTS "re_tb_entries_acct_idx" ON "re_tb_entries"("account_id");
CREATE INDEX IF NOT EXISTS "re_tb_tax_tbid_idx" ON "re_tb_tax_returns"("trial_balance_id");
CREATE INDEX IF NOT EXISTS "re_tb_purch_links_tbid_idx" ON "re_tb_purchase_links"("trial_balance_id");
CREATE INDEX IF NOT EXISTS "re_tb_audit_tbid_idx" ON "re_tb_audit_log"("trial_balance_id");
CREATE INDEX IF NOT EXISTS "re_tb_settle_tbid_idx" ON "re_tb_settlements"("trial_balance_id");
CREATE INDEX IF NOT EXISTS "re_trial_bal_org_idx" ON "re_trial_balances"("org_id");