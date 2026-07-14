-- Migration 0030: Add missing settlement_account_id column to re_trial_balances
-- (was added to schema after 0029 was already stamped on some DBs)

ALTER TABLE "re_trial_balances"
  ADD COLUMN IF NOT EXISTS "settlement_account_id" integer;

ALTER TABLE "re_trial_balances"
  DROP CONSTRAINT IF EXISTS "re_trial_balances_settlement_account_id_fkey";

ALTER TABLE "re_trial_balances"
  ADD CONSTRAINT "re_trial_balances_settlement_account_id_fkey"
  FOREIGN KEY ("settlement_account_id") REFERENCES "re_tb_accounts"("id") ON DELETE SET NULL;
