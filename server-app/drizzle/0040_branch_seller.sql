-- Migration 0040: Add canBeSalesperson to users + sellerUserId to sales_invoices
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_be_salesperson boolean NOT NULL DEFAULT false;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS seller_user_id integer REFERENCES users(id) ON DELETE SET NULL;
