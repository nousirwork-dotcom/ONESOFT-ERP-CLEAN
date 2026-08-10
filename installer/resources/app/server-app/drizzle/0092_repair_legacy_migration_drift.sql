-- Repair drift left by installations that already stamped 0002.
-- This migration is additive: it never drops data or rewrites existing rows.

ALTER TYPE "public"."invoice_type" ADD VALUE IF NOT EXISTS 'order';--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "document_templates" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" integer NOT NULL,
  "code" varchar(30) NOT NULL,
  "name_ar" varchar(255) NOT NULL,
  "name_en" varchar(255),
  "doc_type" varchar(30) NOT NULL,
  "paper_size" varchar(20) DEFAULT 'A4',
  "orientation" varchar(20) DEFAULT 'portrait',
  "is_default" boolean DEFAULT false NOT NULL,
  "layout_json" text,
  "notes" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "document_types" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" integer NOT NULL,
  "type_id" varchar(30) NOT NULL,
  "name_ar" varchar(255) NOT NULL,
  "name_en" varchar(255),
  "code_en" varchar(30),
  "code_ar" varchar(30),
  "doc_type" varchar(30),
  "user_group" varchar(50),
  "user_" varchar(50),
  "warehouse" varchar(50),
  "journal" varchar(50),
  "system_only" boolean DEFAULT false NOT NULL,
  "entry_type" varchar(30),
  "entry_journal" varchar(50),
  "stock_doc_type" varchar(30),
  "stock_journal" varchar(50),
  "print_template" varchar(100),
  "print_template_2" varchar(100),
  "track_qty" boolean DEFAULT false NOT NULL,
  "no_tax" boolean DEFAULT false NOT NULL,
  "seller_stats" boolean DEFAULT false NOT NULL,
  "item_stats" boolean DEFAULT false NOT NULL,
  "customer_stats" boolean DEFAULT false NOT NULL,
  "no_stock_dispatch" boolean DEFAULT false NOT NULL,
  "require_note" boolean DEFAULT false NOT NULL,
  "prevent_edit_if_linked" boolean DEFAULT false NOT NULL,
  "require_customer_code" boolean DEFAULT false NOT NULL,
  "require_employee_code" boolean DEFAULT false NOT NULL,
  "acct_debit" varchar(50),
  "acct_credit" varchar(50),
  "acct_discount" varchar(50),
  "acct_cash" varchar(50),
  "acct_tax" varchar(50),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "purchase_invoice_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "invoice_id" integer NOT NULL,
  "org_id" integer NOT NULL,
  "product_id" integer,
  "product_code" varchar(100),
  "product_name" varchar(500) NOT NULL,
  "unit" varchar(100),
  "quantity" numeric(18, 4) NOT NULL,
  "unit_price" numeric(18, 4) NOT NULL,
  "discount_percent" numeric(5, 2) DEFAULT '0',
  "discount_amount" numeric(18, 4) DEFAULT '0',
  "tax_percent" numeric(5, 2) DEFAULT '0',
  "tax_amount" numeric(18, 4) DEFAULT '0',
  "total" numeric(18, 4) NOT NULL,
  "sort_order" integer DEFAULT 0
);--> statement-breakpoint

ALTER TABLE "purchase_invoice_items"
  ADD COLUMN IF NOT EXISTS "tax_id" integer,
  ADD COLUMN IF NOT EXISTS "batch_number" varchar(100),
  ADD COLUMN IF NOT EXISTS "expiry_date" varchar(20);--> statement-breakpoint

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('document_templates', 'document_templates_org_id_organizations_id_fk', 'org_id', 'organizations', 'id', 'no action'),
      ('document_types', 'document_types_org_id_organizations_id_fk', 'org_id', 'organizations', 'id', 'no action'),
      ('purchase_invoice_items', 'purchase_invoice_items_invoice_id_purchase_invoices_id_fk', 'invoice_id', 'purchase_invoices', 'id', 'cascade'),
      ('purchase_invoice_items', 'purchase_invoice_items_org_id_organizations_id_fk', 'org_id', 'organizations', 'id', 'no action'),
      ('purchase_invoice_items', 'purchase_invoice_items_product_id_products_id_fk', 'product_id', 'products', 'id', 'set null'),
      ('document_journals', 'document_journals_branch_id_branches_id_fk', 'branch_id', 'branches', 'id', 'set null'),
      ('document_journals', 'document_journals_sales_account_id_chart_of_accounts_id_fk', 'sales_account_id', 'chart_of_accounts', 'id', 'set null'),
      ('document_journals', 'document_journals_cash_account_id_chart_of_accounts_id_fk', 'cash_account_id', 'chart_of_accounts', 'id', 'set null'),
      ('document_journals', 'document_journals_credit_account_id_chart_of_accounts_id_fk', 'credit_account_id', 'chart_of_accounts', 'id', 'set null'),
      ('document_journals', 'document_journals_tax_account_id_chart_of_accounts_id_fk', 'tax_account_id', 'chart_of_accounts', 'id', 'set null'),
      ('document_journals', 'document_journals_discount_account_id_chart_of_accounts_id_fk', 'discount_account_id', 'chart_of_accounts', 'id', 'set null'),
      ('document_journals', 'document_journals_allowed_user_id_users_id_fk', 'allowed_user_id', 'users', 'id', 'set null'),
      ('free_products', 'free_products_product_id_products_id_fk', 'product_id', 'products', 'id', 'set null'),
      ('inventory', 'inventory_warehouse_id_warehouses_id_fk', 'warehouse_id', 'warehouses', 'id', 'set null'),
      ('inventory_count_items', 'inventory_count_items_product_id_products_id_fk', 'product_id', 'products', 'id', 'set null'),
      ('inventory_counts', 'inventory_counts_branch_id_branches_id_fk', 'branch_id', 'branches', 'id', 'set null'),
      ('inventory_counts', 'inventory_counts_user_id_users_id_fk', 'user_id', 'users', 'id', 'set null'),
      ('journal_entries', 'journal_entries_user_id_users_id_fk', 'user_id', 'users', 'id', 'set null'),
      ('journal_entry_lines', 'journal_entry_lines_account_id_chart_of_accounts_id_fk', 'account_id', 'chart_of_accounts', 'id', 'set null'),
      ('payment_vouchers', 'payment_vouchers_account_id_chart_of_accounts_id_fk', 'account_id', 'chart_of_accounts', 'id', 'set null'),
      ('payment_vouchers', 'payment_vouchers_contra_account_id_chart_of_accounts_id_fk', 'contra_account_id', 'chart_of_accounts', 'id', 'set null'),
      ('payment_vouchers', 'payment_vouchers_user_id_users_id_fk', 'user_id', 'users', 'id', 'set null'),
      ('products', 'products_group_id_product_groups_id_fk', 'group_id', 'product_groups', 'id', 'set null'),
      ('products', 'products_unit_id_units_id_fk', 'unit_id', 'units', 'id', 'set null'),
      ('purchase_invoices', 'purchase_invoices_user_id_users_id_fk', 'user_id', 'users', 'id', 'set null'),
      ('purchase_invoices', 'purchase_invoices_supplier_id_suppliers_id_fk', 'supplier_id', 'suppliers', 'id', 'set null'),
      ('purchase_invoices', 'purchase_invoices_warehouse_id_warehouses_id_fk', 'warehouse_id', 'warehouses', 'id', 'set null'),
      ('receipt_vouchers', 'receipt_vouchers_account_id_chart_of_accounts_id_fk', 'account_id', 'chart_of_accounts', 'id', 'set null'),
      ('receipt_vouchers', 'receipt_vouchers_contra_account_id_chart_of_accounts_id_fk', 'contra_account_id', 'chart_of_accounts', 'id', 'set null'),
      ('receipt_vouchers', 'receipt_vouchers_user_id_users_id_fk', 'user_id', 'users', 'id', 'set null'),
      ('sales_invoice_items', 'sales_invoice_items_product_id_products_id_fk', 'product_id', 'products', 'id', 'set null'),
      ('sales_invoices', 'sales_invoices_customer_id_customers_id_fk', 'customer_id', 'customers', 'id', 'set null'),
      ('sales_invoices', 'sales_invoices_warehouse_id_warehouses_id_fk', 'warehouse_id', 'warehouses', 'id', 'set null'),
      ('sales_invoices', 'sales_invoices_branch_id_branches_id_fk', 'branch_id', 'branches', 'id', 'set null'),
      ('sales_invoices', 'sales_invoices_user_id_users_id_fk', 'user_id', 'users', 'id', 'set null'),
      ('stock_voucher_items', 'stock_voucher_items_product_id_products_id_fk', 'product_id', 'products', 'id', 'set null'),
      ('stock_vouchers', 'stock_vouchers_branch_id_branches_id_fk', 'branch_id', 'branches', 'id', 'set null'),
      ('stock_vouchers', 'stock_vouchers_supplier_id_suppliers_id_fk', 'supplier_id', 'suppliers', 'id', 'set null'),
      ('stock_vouchers', 'stock_vouchers_user_id_users_id_fk', 'user_id', 'users', 'id', 'set null'),
      ('vouchers', 'vouchers_account_id_chart_of_accounts_id_fk', 'account_id', 'chart_of_accounts', 'id', 'set null'),
      ('vouchers', 'vouchers_user_id_users_id_fk', 'user_id', 'users', 'id', 'set null'),
      ('warehouse_account_links', 'warehouse_account_links_account_id_chart_of_accounts_id_fk', 'account_id', 'chart_of_accounts', 'id', 'set null'),
      ('warehouses', 'warehouses_branch_id_branches_id_fk', 'branch_id', 'branches', 'id', 'set null'),
      ('warehouses', 'warehouses_inv_account_id_chart_of_accounts_id_fk', 'inv_account_id', 'chart_of_accounts', 'id', 'set null'),
      ('warehouses', 'warehouses_cogs_account1_id_chart_of_accounts_id_fk', 'cogs_account1_id', 'chart_of_accounts', 'id', 'set null'),
      ('warehouses', 'warehouses_cogs_account2_id_chart_of_accounts_id_fk', 'cogs_account2_id', 'chart_of_accounts', 'id', 'set null'),
      ('warehouses', 'warehouses_cash_account_id_chart_of_accounts_id_fk', 'cash_account_id', 'chart_of_accounts', 'id', 'set null'),
      ('warehouses', 'warehouses_bank_account_id_chart_of_accounts_id_fk', 'bank_account_id', 'chart_of_accounts', 'id', 'set null'),
      ('warehouses', 'warehouses_sales_account1_id_chart_of_accounts_id_fk', 'sales_account1_id', 'chart_of_accounts', 'id', 'set null'),
      ('warehouses', 'warehouses_allowed_user_id_users_id_fk', 'allowed_user_id', 'users', 'id', 'set null')
    ) AS x(table_name, constraint_name, column_name, ref_table, ref_column, on_delete)
  LOOP
    IF to_regclass(format('public.%I', r.table_name)) IS NOT NULL
       AND to_regclass(format('public.%I', r.ref_table)) IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = r.table_name
           AND column_name = r.column_name
       )
       AND EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = r.ref_table
           AND column_name = r.ref_column
       )
       AND NOT EXISTS (
         SELECT 1
         FROM pg_constraint c
         WHERE c.conname = r.constraint_name
           AND c.conrelid = format('public.%I', r.table_name)::regclass
       )
    THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(%I) ON DELETE %s ON UPDATE NO ACTION',
        r.table_name, r.constraint_name, r.column_name,
        r.ref_table, r.ref_column, r.on_delete
      );
    END IF;
  END LOOP;
END $$;