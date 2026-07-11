-- =================================================================
-- base_schema.sql — OneSoft ERP initial database schema
-- Generated from drizzle/meta/0000_snapshot.json
-- Uses CREATE TABLE IF NOT EXISTS so it is safe to run multiple times.
-- =================================================================

-- ── Enum types ─────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE "inventory_count_status" AS ENUM ('draft', 'confirmed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "invoice_status" AS ENUM ('draft', 'confirmed', 'cancelled', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "invoice_type" AS ENUM ('sale', 'return', 'quote');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "journal_status" AS ENUM ('draft', 'posted', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "org_status" AS ENUM ('active', 'suspended', 'trial', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "payment_method" AS ENUM ('cash', 'bank', 'credit', 'check', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "stock_voucher_type" AS ENUM ('receipt', 'issue', 'transfer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "user_role" AS ENUM ('superadmin', 'admin', 'cashier', 'accountant', 'warehouse_manager', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "voucher_type" AS ENUM ('receipt', 'payment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tables ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" SERIAL PRIMARY KEY,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "logo" TEXT,
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "address" TEXT,
    "tax_number" VARCHAR(50),
    "commercial_reg" VARCHAR(50),
    "currency" VARCHAR(10) NOT NULL DEFAULT 'SAR',
    "status" "org_status" NOT NULL DEFAULT 'trial',
    "subscription_expiry" TIMESTAMP,
    "max_users" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE ("code")
);

CREATE TABLE IF NOT EXISTS "branches" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "phone" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "warehouses" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "code" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "name2" VARCHAR(255),
    "full_name1" VARCHAR(255),
    "full_name2" VARCHAR(255),
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "inv_account_id" INTEGER,
    "cogs_account1_id" INTEGER,
    "cogs_account2_id" INTEGER,
    "cash_account_id" INTEGER,
    "bank_account_id" INTEGER,
    "sales_account1_id" INTEGER,
    "allowed_user_id" INTEGER,
    "allowed_user_group" VARCHAR(255),
    "copy_from_warehouse_id" INTEGER,
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_categories" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "auto_numbering" BOOLEAN NOT NULL DEFAULT true,
    "first_number" INTEGER NOT NULL DEFAULT 1,
    "last_number" INTEGER NOT NULL DEFAULT 99999,
    "increment" INTEGER NOT NULL DEFAULT 1,
    "code_digits" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_groups" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "units" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "symbol" VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS "product_groups" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "group_code" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "name2" VARCHAR(255),
    "description" TEXT,
    "parent_id" INTEGER,
    "group_type" VARCHAR(20) DEFAULT 'root',
    "level" INTEGER DEFAULT 1,
    "auto_numbering" BOOLEAN DEFAULT true,
    "first_number" INTEGER DEFAULT 1,
    "last_number" INTEGER DEFAULT 99999,
    "increment" INTEGER DEFAULT 1,
    "code_digits" INTEGER DEFAULT 5,
    "color" VARCHAR(30),
    "is_active" BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS "chart_of_accounts" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "name_en" VARCHAR(500),
    "parent_id" INTEGER,
    "level" INTEGER NOT NULL DEFAULT 1,
    "account_type" VARCHAR(50) NOT NULL,
    "nature" VARCHAR(10) DEFAULT 'debit',
    "is_parent" BOOLEAN DEFAULT false,
    "allow_posting" BOOLEAN DEFAULT true,
    "cost_center_type" VARCHAR(20) DEFAULT 'not_allowed',
    "opening_balance" NUMERIC(18, 4) DEFAULT '0',
    "opening_balance_type" VARCHAR(10) DEFAULT 'debit',
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "balance" NUMERIC(18, 4) DEFAULT '0',
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "customers" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(500) NOT NULL,
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "address" TEXT,
    "tax_number" VARCHAR(50),
    "credit_limit" NUMERIC(18, 4) DEFAULT '0',
    "balance" NUMERIC(18, 4) DEFAULT '0',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "document_journals" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "doc_type" VARCHAR(30) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name2" VARCHAR(255),
    "description" TEXT,
    "number_prefix" VARCHAR(20) NOT NULL DEFAULT 'INV',
    "first_number" INTEGER NOT NULL DEFAULT 1,
    "last_number" INTEGER NOT NULL DEFAULT 999999,
    "increment" INTEGER NOT NULL DEFAULT 1,
    "num_digits" INTEGER NOT NULL DEFAULT 6,
    "include_year" BOOLEAN NOT NULL DEFAULT true,
    "current_seq" INTEGER NOT NULL DEFAULT 0,
    "warehouse_id" INTEGER,
    "branch_id" INTEGER,
    "sales_account_id" INTEGER,
    "cash_account_id" INTEGER,
    "credit_account_id" INTEGER,
    "tax_account_id" INTEGER,
    "discount_account_id" INTEGER,
    "default_currency" VARCHAR(10) DEFAULT 'SAR',
    "default_pay_method" VARCHAR(20) DEFAULT 'cash',
    "allowed_user_group" VARCHAR(255),
    "allowed_user_id" INTEGER,
    "print_template" VARCHAR(100),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "free_products" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "product_code" VARCHAR(100),
    "product_name" VARCHAR(500) NOT NULL,
    "unit" VARCHAR(100),
    "base_qty" NUMERIC(18, 4) NOT NULL DEFAULT '1',
    "free_qty" NUMERIC(18, 4) NOT NULL DEFAULT '1',
    "offer_start" TIMESTAMP,
    "offer_end" TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "inventory" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "quantity" NUMERIC(18, 4) NOT NULL DEFAULT '0',
    "avg_cost" NUMERIC(18, 4) DEFAULT '0',
    "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "inventory_count_items" (
    "id" SERIAL PRIMARY KEY,
    "count_id" INTEGER NOT NULL,
    "org_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "product_name" VARCHAR(500) NOT NULL,
    "system_quantity" NUMERIC(18, 4) DEFAULT '0',
    "actual_quantity" NUMERIC(18, 4) DEFAULT '0',
    "difference" NUMERIC(18, 4) DEFAULT '0',
    "sort_order" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "inventory_counts" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "count_number" VARCHAR(50) NOT NULL,
    "warehouse_id" INTEGER,
    "branch_id" INTEGER,
    "status" "inventory_count_status" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "confirmed_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "journal_entries" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "entry_number" VARCHAR(50) NOT NULL,
    "entry_date" TIMESTAMP NOT NULL DEFAULT now(),
    "description" TEXT,
    "reference" VARCHAR(100),
    "total_debit" NUMERIC(18, 4) DEFAULT '0',
    "total_credit" NUMERIC(18, 4) DEFAULT '0',
    "status" "journal_status" NOT NULL DEFAULT 'draft',
    "user_id" INTEGER,
    "source_doc_type" VARCHAR(50),
    "source_doc_id" INTEGER,
    "source_doc_number" VARCHAR(100),
    "entry_type" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "journal_entry_lines" (
    "id" SERIAL PRIMARY KEY,
    "entry_id" INTEGER NOT NULL,
    "org_id" INTEGER NOT NULL,
    "account_id" INTEGER,
    "account_code" VARCHAR(50),
    "account_name" VARCHAR(500),
    "description" TEXT,
    "debit" NUMERIC(18, 4) DEFAULT '0',
    "credit" NUMERIC(18, 4) DEFAULT '0',
    "cost_center" VARCHAR(100),
    "sort_order" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "messages" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "receiver_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "payment_vouchers" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "voucher_number" VARCHAR(50) NOT NULL,
    "voucher_date" TIMESTAMP NOT NULL DEFAULT now(),
    "paid_to" VARCHAR(500),
    "amount" NUMERIC(18, 4) NOT NULL,
    "payment_method" "payment_method" DEFAULT 'cash',
    "bank_account" VARCHAR(100),
    "check_number" VARCHAR(100),
    "description" TEXT,
    "account_id" INTEGER,
    "contra_account_id" INTEGER,
    "notes" TEXT,
    "journal_entry_id" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'posted',
    "user_id" INTEGER,
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "products" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "code" VARCHAR(100),
    "barcode" VARCHAR(100),
    "name" VARCHAR(500) NOT NULL,
    "name_en" VARCHAR(500),
    "group_id" INTEGER,
    "unit_id" INTEGER,
    "unit" VARCHAR(100),
    "sale_price" NUMERIC(18, 4) DEFAULT '0',
    "purchase_price" NUMERIC(18, 4) DEFAULT '0',
    "tax_rate" NUMERIC(5, 2) DEFAULT '0',
    "min_stock" NUMERIC(18, 4) DEFAULT '0',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "purchase_invoices" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "supplier_invoice_number" VARCHAR(100),
    "invoice_date" TIMESTAMP NOT NULL DEFAULT now(),
    "supplier_id" INTEGER,
    "supplier_name" VARCHAR(500),
    "warehouse_id" INTEGER,
    "subtotal" NUMERIC(18, 4) DEFAULT '0',
    "discount_amount" NUMERIC(18, 4) DEFAULT '0',
    "tax_amount" NUMERIC(18, 4) DEFAULT '0',
    "total" NUMERIC(18, 4) DEFAULT '0',
    "paid_amount" NUMERIC(18, 4) DEFAULT '0',
    "status" "invoice_status" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "receipt_vouchers" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "voucher_number" VARCHAR(50) NOT NULL,
    "voucher_date" TIMESTAMP NOT NULL DEFAULT now(),
    "received_from" VARCHAR(500),
    "amount" NUMERIC(18, 4) NOT NULL,
    "payment_method" "payment_method" DEFAULT 'cash',
    "bank_account" VARCHAR(100),
    "check_number" VARCHAR(100),
    "description" TEXT,
    "account_id" INTEGER,
    "contra_account_id" INTEGER,
    "cost_center_id" INTEGER,
    "notes" TEXT,
    "journal_entry_id" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'posted',
    "user_id" INTEGER,
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sales_invoice_items" (
    "id" SERIAL PRIMARY KEY,
    "invoice_id" INTEGER NOT NULL,
    "org_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "product_code" VARCHAR(100),
    "product_name" VARCHAR(500) NOT NULL,
    "unit" VARCHAR(100),
    "quantity" NUMERIC(18, 4) NOT NULL,
    "unit_price" NUMERIC(18, 4) NOT NULL,
    "discount_percent" NUMERIC(5, 2) DEFAULT '0',
    "discount_amount" NUMERIC(18, 4) DEFAULT '0',
    "tax_percent" NUMERIC(5, 2) DEFAULT '0',
    "tax_amount" NUMERIC(18, 4) DEFAULT '0',
    "total" NUMERIC(18, 4) NOT NULL,
    "warehouse_id" INTEGER,
    "notes" TEXT,
    "sort_order" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "sales_invoices" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "invoice_type" "invoice_type" NOT NULL DEFAULT 'sale',
    "invoice_date" TIMESTAMP NOT NULL DEFAULT now(),
    "due_date" TIMESTAMP,
    "customer_id" INTEGER,
    "customer_name" VARCHAR(500),
    "warehouse_id" INTEGER,
    "branch_id" INTEGER,
    "user_id" INTEGER,
    "currency" VARCHAR(10) DEFAULT 'SAR',
    "exchange_rate" NUMERIC(10, 4) DEFAULT '1',
    "subtotal" NUMERIC(18, 4) DEFAULT '0',
    "discount_percent" NUMERIC(5, 2) DEFAULT '0',
    "discount_amount" NUMERIC(18, 4) DEFAULT '0',
    "tax_amount" NUMERIC(18, 4) DEFAULT '0',
    "total" NUMERIC(18, 4) DEFAULT '0',
    "paid_amount" NUMERIC(18, 4) DEFAULT '0',
    "remaining_amount" NUMERIC(18, 4) DEFAULT '0',
    "payment_method" "payment_method" DEFAULT 'cash',
    "status" "invoice_status" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "ref_invoice_id" INTEGER,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "stock_voucher_items" (
    "id" SERIAL PRIMARY KEY,
    "voucher_id" INTEGER NOT NULL,
    "org_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "product_name" VARCHAR(500) NOT NULL,
    "quantity" NUMERIC(18, 4) NOT NULL,
    "unit_cost" NUMERIC(18, 4) DEFAULT '0',
    "total_cost" NUMERIC(18, 4) DEFAULT '0',
    "sort_order" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "stock_vouchers" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "voucher_number" VARCHAR(50) NOT NULL,
    "type" "stock_voucher_type" NOT NULL,
    "voucher_date" TIMESTAMP NOT NULL DEFAULT now(),
    "warehouse_id" INTEGER,
    "branch_id" INTEGER,
    "supplier_id" INTEGER,
    "reason" VARCHAR(500),
    "notes" TEXT,
    "total_cost" NUMERIC(18, 4) DEFAULT '0',
    "status" VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    "user_id" INTEGER,
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "suppliers" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(500) NOT NULL,
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "address" TEXT,
    "tax_number" VARCHAR(50),
    "balance" NUMERIC(18, 4) DEFAULT '0',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_group_members" (
    "id" SERIAL PRIMARY KEY,
    "group_id" INTEGER NOT NULL,
    "org_id" INTEGER NOT NULL,
    "member_type" VARCHAR(10) NOT NULL,
    "member_code" VARCHAR(50),
    "member_name" VARCHAR(255),
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "code" VARCHAR(50),
    "username" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "role" "user_role" NOT NULL DEFAULT 'cashier',
    "extra_permissions" jsonb DEFAULT '{}'::jsonb,
    "category_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "password_status" VARCHAR(20) NOT NULL DEFAULT 'set',
    "last_login_at" TIMESTAMP,
    "phone_verified_at" TIMESTAMP,
    "email_verified_at" TIMESTAMP,
    "password_changed_at" TIMESTAMP,
    "force_password_change" BOOLEAN NOT NULL DEFAULT FALSE,
    "recovery_enabled_phone" BOOLEAN NOT NULL DEFAULT FALSE,
    "recovery_enabled_email" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "vouchers" (
    "id" SERIAL PRIMARY KEY,
    "org_id" INTEGER NOT NULL,
    "voucher_number" VARCHAR(50) NOT NULL,
    "voucher_type" "voucher_type" NOT NULL,
    "voucher_date" TIMESTAMP NOT NULL DEFAULT now(),
    "amount" NUMERIC(18, 4) NOT NULL,
    "payment_method" "payment_method" DEFAULT 'cash',
    "account_id" INTEGER,
    "account_code" VARCHAR(50),
    "account_name" VARCHAR(500),
    "party_type" VARCHAR(20),
    "party_id" INTEGER,
    "party_name" VARCHAR(500),
    "description" TEXT,
    "reference" VARCHAR(100),
    "status" "journal_status" NOT NULL DEFAULT 'draft',
    "user_id" INTEGER,
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "warehouse_account_links" (
    "id" SERIAL PRIMARY KEY,
    "warehouse_id" INTEGER NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "account_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0
);

-- ── Foreign keys ───────────────────────────────────────────────────────
DO $$ BEGIN
    ALTER TABLE "branches" ADD CONSTRAINT "branches_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_branch_id_branches_id_fk"
        FOREIGN KEY ("branch_id") REFERENCES "branches" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_inv_account_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("inv_account_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_cogs_account1_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("cogs_account1_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_cogs_account2_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("cogs_account2_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_cash_account_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("cash_account_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_bank_account_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("bank_account_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_sales_account1_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("sales_account1_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_allowed_user_id_users_id_fk"
        FOREIGN KEY ("allowed_user_id") REFERENCES "users" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "units" ADD CONSTRAINT "units_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "product_groups" ADD CONSTRAINT "product_groups_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "customers" ADD CONSTRAINT "customers_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_warehouse_id_warehouses_id_fk"
        FOREIGN KEY ("warehouse_id") REFERENCES "warehouses" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_branch_id_branches_id_fk"
        FOREIGN KEY ("branch_id") REFERENCES "branches" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_sales_account_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("sales_account_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_cash_account_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("cash_account_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_credit_account_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("credit_account_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_tax_account_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("tax_account_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_discount_account_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("discount_account_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_allowed_user_id_users_id_fk"
        FOREIGN KEY ("allowed_user_id") REFERENCES "users" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "free_products" ADD CONSTRAINT "free_products_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "free_products" ADD CONSTRAINT "free_products_product_id_products_id_fk"
        FOREIGN KEY ("product_id") REFERENCES "products" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "inventory" ADD CONSTRAINT "inventory_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_products_id_fk"
        FOREIGN KEY ("product_id") REFERENCES "products" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "inventory" ADD CONSTRAINT "inventory_warehouse_id_warehouses_id_fk"
        FOREIGN KEY ("warehouse_id") REFERENCES "warehouses" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_count_id_inventory_counts_id_fk"
        FOREIGN KEY ("count_id") REFERENCES "inventory_counts" ("id")
        ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_product_id_products_id_fk"
        FOREIGN KEY ("product_id") REFERENCES "products" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_warehouse_id_warehouses_id_fk"
        FOREIGN KEY ("warehouse_id") REFERENCES "warehouses" ("id")
        ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_branch_id_branches_id_fk"
        FOREIGN KEY ("branch_id") REFERENCES "branches" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "users" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "users" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_entry_id_journal_entries_id_fk"
        FOREIGN KEY ("entry_id") REFERENCES "journal_entries" ("id")
        ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk"
        FOREIGN KEY ("sender_id") REFERENCES "users" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_users_id_fk"
        FOREIGN KEY ("receiver_id") REFERENCES "users" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_account_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_contra_account_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("contra_account_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "users" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "products" ADD CONSTRAINT "products_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "products" ADD CONSTRAINT "products_group_id_product_groups_id_fk"
        FOREIGN KEY ("group_id") REFERENCES "product_groups" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "products" ADD CONSTRAINT "products_unit_id_units_id_fk"
        FOREIGN KEY ("unit_id") REFERENCES "units" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplier_id_suppliers_id_fk"
        FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_warehouse_id_warehouses_id_fk"
        FOREIGN KEY ("warehouse_id") REFERENCES "warehouses" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_account_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_contra_account_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("contra_account_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "users" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_invoice_id_sales_invoices_id_fk"
        FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices" ("id")
        ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_product_id_products_id_fk"
        FOREIGN KEY ("product_id") REFERENCES "products" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_warehouse_id_warehouses_id_fk"
        FOREIGN KEY ("warehouse_id") REFERENCES "warehouses" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_customers_id_fk"
        FOREIGN KEY ("customer_id") REFERENCES "customers" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_warehouse_id_warehouses_id_fk"
        FOREIGN KEY ("warehouse_id") REFERENCES "warehouses" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_branch_id_branches_id_fk"
        FOREIGN KEY ("branch_id") REFERENCES "branches" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "users" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "stock_voucher_items" ADD CONSTRAINT "stock_voucher_items_voucher_id_stock_vouchers_id_fk"
        FOREIGN KEY ("voucher_id") REFERENCES "stock_vouchers" ("id")
        ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "stock_voucher_items" ADD CONSTRAINT "stock_voucher_items_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "stock_voucher_items" ADD CONSTRAINT "stock_voucher_items_product_id_products_id_fk"
        FOREIGN KEY ("product_id") REFERENCES "products" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_warehouse_id_warehouses_id_fk"
        FOREIGN KEY ("warehouse_id") REFERENCES "warehouses" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_branch_id_branches_id_fk"
        FOREIGN KEY ("branch_id") REFERENCES "branches" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_supplier_id_suppliers_id_fk"
        FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "users" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_group_id_user_groups_id_fk"
        FOREIGN KEY ("group_id") REFERENCES "user_groups" ("id")
        ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_org_id_organizations_id_fk"
        FOREIGN KEY ("org_id") REFERENCES "organizations" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_account_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "users" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "warehouse_account_links" ADD CONSTRAINT "warehouse_account_links_warehouse_id_warehouses_id_fk"
        FOREIGN KEY ("warehouse_id") REFERENCES "warehouses" ("id")
        ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "warehouse_account_links" ADD CONSTRAINT "warehouse_account_links_account_id_chart_of_accounts_id_fk"
        FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts" ("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── send_settings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "send_settings" (
  "id"                        serial PRIMARY KEY,
  "org_id"                    integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "whatsapp_enabled"          boolean NOT NULL DEFAULT true,
  "telegram_enabled"          boolean NOT NULL DEFAULT false,
  "email_enabled"             boolean NOT NULL DEFAULT false,
  "telegram_bot_token"        text,
  "email_provider"            varchar(20) DEFAULT 'resend',
  "email_api_key"             text,
  "email_from_name"           varchar(255),
  "email_from_email"          varchar(255),
  "whatsapp_message_template" text,
  "telegram_message_template" text,
  "email_subject_template"    varchar(500),
  "email_body_template"       text,
  "waba_enabled"              boolean NOT NULL DEFAULT false,
  "waba_api_url"              text,
  "waba_access_token"         text,
  "waba_phone_number_id"      varchar(100),
  "waba_sender_name"          varchar(255),
  "waba_business_account_id"  varchar(100),
  "waba_verify_token"         varchar(255),
  "waba_webhook_url"          varchar(500),
  "created_at"                timestamp NOT NULL DEFAULT now(),
  "updated_at"                timestamp NOT NULL DEFAULT now()
);

-- ── document_send_logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "document_send_logs" (
  "id"                serial PRIMARY KEY,
  "org_id"            integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "doc_type"          varchar(50) NOT NULL,
  "doc_id"            integer,
  "doc_number"        varchar(100),
  "method"            varchar(20) NOT NULL,
  "status"            varchar(20) NOT NULL DEFAULT 'pending',
  "recipient_name"    varchar(255),
  "recipient_contact" varchar(500),
  "message_sent"      text,
  "error_message"     text,
  "meta_message_id"   varchar(100),
  "sent_by_user_id"   integer REFERENCES "users"("id") ON DELETE SET NULL,
  "sent_at"           timestamp NOT NULL DEFAULT now()
);

-- ── base_schema.sql complete ───────────────────────────────────────────