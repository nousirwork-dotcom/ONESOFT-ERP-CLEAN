-- Migration: 0013_add_missing_tables
-- Adds 6 tables missing from schema but not yet in any migration file:
--   qr_settings, posting_definitions, posting_definition_lines,
--   field_dictionary, payment_methods, sales_invoice_payments

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qr_settings" (
  "id"                      serial PRIMARY KEY,
  "org_id"                  integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "is_enabled"              boolean NOT NULL DEFAULT true,
  "country_system"          varchar(20) NOT NULL DEFAULT 'zatca',
  "custom_format"           text,
  "seller_name"             varchar(255),
  "tax_number"              varchar(50),
  "show_on_sales_invoice"   boolean NOT NULL DEFAULT true,
  "show_on_purchase_invoice" boolean NOT NULL DEFAULT false,
  "show_on_receipt_voucher" boolean NOT NULL DEFAULT false,
  "qr_size"                 integer NOT NULL DEFAULT 100,
  "qr_position"             varchar(30) NOT NULL DEFAULT 'top-right',
  "notes"                   text,
  "created_at"              timestamp NOT NULL DEFAULT now(),
  "updated_at"              timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posting_definitions" (
  "id"         serial PRIMARY KEY,
  "org_id"     integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "doc_type"   varchar(30) NOT NULL,
  "variant"    varchar(20) NOT NULL DEFAULT '',
  "name"       varchar(200) NOT NULL,
  "is_active"  boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posting_definition_lines" (
  "id"            serial PRIMARY KEY,
  "org_id"        integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "definition_id" integer NOT NULL REFERENCES "posting_definitions"("id") ON DELETE CASCADE,
  "description"   varchar(200),
  "account_id"    integer REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL,
  "direction"     varchar(10) NOT NULL DEFAULT 'debit',
  "amount_source" varchar(50) NOT NULL DEFAULT 'total',
  "sort_order"    integer NOT NULL DEFAULT 0
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "field_dictionary" (
  "id"          serial PRIMARY KEY,
  "org_id"      integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "code"        varchar(50) NOT NULL,
  "name_ar"     varchar(150) NOT NULL,
  "name_en"     varchar(150) NOT NULL,
  "field_type"  varchar(50) NOT NULL DEFAULT 'Text',
  "category"    varchar(80) NOT NULL DEFAULT 'Custom Fields',
  "description" text,
  "is_system"   boolean NOT NULL DEFAULT false,
  "is_active"   boolean NOT NULL DEFAULT true,
  "sort_order"  integer NOT NULL DEFAULT 0,
  "created_at"  timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_methods" (
  "id"         serial PRIMARY KEY,
  "org_id"     integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "code"       varchar(50) NOT NULL,
  "name_ar"    varchar(150) NOT NULL,
  "name_en"    varchar(150),
  "icon"       varchar(50),
  "color"      varchar(20) DEFAULT '#406B93',
  "bg_color"   varchar(20) DEFAULT '#EFF6FF',
  "account_id" integer REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL,
  "is_active"  boolean NOT NULL DEFAULT true,
  "is_visible" boolean NOT NULL DEFAULT true,
  "is_built_in" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_invoice_payments" (
  "id"                  serial PRIMARY KEY,
  "org_id"              integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "invoice_id"          integer NOT NULL REFERENCES "sales_invoices"("id") ON DELETE CASCADE,
  "payment_method_code" varchar(50) NOT NULL,
  "payment_method_name" varchar(150),
  "amount"              numeric(18,4) NOT NULL DEFAULT 0,
  "reference_no"        varchar(100),
  "notes"               text,
  "created_at"          timestamp NOT NULL DEFAULT now()
);
