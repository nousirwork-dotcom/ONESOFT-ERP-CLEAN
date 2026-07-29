ALTER TYPE "public"."invoice_type" ADD VALUE IF NOT EXISTS 'order';--> statement-breakpoint
CREATE TABLE "document_templates" (
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
);
--> statement-breakpoint
CREATE TABLE "document_types" (
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
);
--> statement-breakpoint
CREATE TABLE "purchase_invoice_items" (
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
);
--> statement-breakpoint
ALTER TABLE "document_journals" DROP CONSTRAINT "document_journals_branch_id_branches_id_fk";
--> statement-breakpoint
ALTER TABLE "document_journals" DROP CONSTRAINT "document_journals_sales_account_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "document_journals" DROP CONSTRAINT "document_journals_cash_account_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "document_journals" DROP CONSTRAINT "document_journals_credit_account_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "document_journals" DROP CONSTRAINT "document_journals_tax_account_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "document_journals" DROP CONSTRAINT "document_journals_discount_account_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "document_journals" DROP CONSTRAINT "document_journals_allowed_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "free_products" DROP CONSTRAINT "free_products_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory" DROP CONSTRAINT "inventory_warehouse_id_warehouses_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory_count_items" DROP CONSTRAINT "inventory_count_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory_counts" DROP CONSTRAINT "inventory_counts_branch_id_branches_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory_counts" DROP CONSTRAINT "inventory_counts_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "journal_entry_lines" DROP CONSTRAINT "journal_entry_lines_account_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_vouchers" DROP CONSTRAINT "payment_vouchers_account_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_vouchers" DROP CONSTRAINT "payment_vouchers_contra_account_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_vouchers" DROP CONSTRAINT "payment_vouchers_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_group_id_product_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_unit_id_units_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_invoices" DROP CONSTRAINT "purchase_invoices_supplier_id_suppliers_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_invoices" DROP CONSTRAINT "purchase_invoices_warehouse_id_warehouses_id_fk";
--> statement-breakpoint
ALTER TABLE "receipt_vouchers" DROP CONSTRAINT "receipt_vouchers_account_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "receipt_vouchers" DROP CONSTRAINT "receipt_vouchers_contra_account_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "receipt_vouchers" DROP CONSTRAINT "receipt_vouchers_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "sales_invoice_items" DROP CONSTRAINT "sales_invoice_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "sales_invoices" DROP CONSTRAINT "sales_invoices_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "sales_invoices" DROP CONSTRAINT "sales_invoices_warehouse_id_warehouses_id_fk";
--> statement-breakpoint
ALTER TABLE "sales_invoices" DROP CONSTRAINT "sales_invoices_branch_id_branches_id_fk";
--> statement-breakpoint
ALTER TABLE "sales_invoices" DROP CONSTRAINT "sales_invoices_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_voucher_items" DROP CONSTRAINT "stock_voucher_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_vouchers" DROP CONSTRAINT "stock_vouchers_branch_id_branches_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_vouchers" DROP CONSTRAINT "stock_vouchers_supplier_id_suppliers_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_vouchers" DROP CONSTRAINT "stock_vouchers_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "vouchers" DROP CONSTRAINT "vouchers_account_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "vouchers" DROP CONSTRAINT "vouchers_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "warehouse_account_links" DROP CONSTRAINT "warehouse_account_links_account_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_branch_id_branches_id_fk";
--> statement-breakpoint
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_inv_account_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_cogs_account1_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_cogs_account2_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_cash_account_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_bank_account_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_sales_account1_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_allowed_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "warehouse_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "document_journals" ADD COLUMN IF NOT EXISTS "print_template_2" varchar(100);--> statement-breakpoint
ALTER TABLE "document_journals" ADD COLUMN "reset_frequency" varchar(20) DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "document_journals" ADD COLUMN "auto_serial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "document_journals" ADD COLUMN "print_on_save" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "document_journals" ADD COLUMN "posting_mode" varchar(20) DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "document_journals" ADD COLUMN "allow_unpost" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "document_journals" ADD COLUMN "allow_edit_after_post" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "invoice_type" varchar(20) DEFAULT 'invoice' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "due_date" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "journal_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "currency" varchar(10) DEFAULT 'SAR';--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "exchange_rate" numeric(18, 6) DEFAULT '1';--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "discount_percent" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "remaining_amount" numeric(18, 4) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "payment_method" varchar(20) DEFAULT 'cash';--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "is_posted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "posted_at" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "posted_journal_entry_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "journal_id" integer;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "is_posted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "posted_at" timestamp;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "posted_journal_entry_id" integer;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_invoice_id_purchase_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."purchase_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_sales_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("sales_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_cash_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("cash_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_credit_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_tax_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("tax_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_discount_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("discount_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_allowed_user_id_users_id_fk" FOREIGN KEY ("allowed_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_products" ADD CONSTRAINT "free_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_contra_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("contra_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_group_id_product_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."product_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_contra_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("contra_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_voucher_items" ADD CONSTRAINT "stock_voucher_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_account_links" ADD CONSTRAINT "warehouse_account_links_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_inv_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("inv_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_cogs_account1_id_chart_of_accounts_id_fk" FOREIGN KEY ("cogs_account1_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_cogs_account2_id_chart_of_accounts_id_fk" FOREIGN KEY ("cogs_account2_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_cash_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("cash_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_bank_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_sales_account1_id_chart_of_accounts_id_fk" FOREIGN KEY ("sales_account1_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_allowed_user_id_users_id_fk" FOREIGN KEY ("allowed_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;