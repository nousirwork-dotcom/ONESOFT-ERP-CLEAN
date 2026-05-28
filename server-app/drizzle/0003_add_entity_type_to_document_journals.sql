CREATE TABLE "cost_centers" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(255) NOT NULL,
	"name2" varchar(255),
	"center_type" varchar(20) DEFAULT 'branch' NOT NULL,
	"parent_id" integer,
	"level" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_journals" ADD COLUMN "purchase_account_id" integer;--> statement-breakpoint
ALTER TABLE "document_journals" ADD COLUMN "supplier_account_id" integer;--> statement-breakpoint
ALTER TABLE "document_journals" ADD COLUMN "inventory_account_id" integer;--> statement-breakpoint
ALTER TABLE "document_journals" ADD COLUMN "cogs_account_id" integer;--> statement-breakpoint
ALTER TABLE "document_journals" ADD COLUMN "entity_type" varchar(20) DEFAULT 'both';--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN "acct_inventory" varchar(50);--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN "acct_cogs" varchar(50);--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN "sales_account_id" integer;--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN "cash_account_id" integer;--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN "credit_account_id" integer;--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN "tax_account_id" integer;--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN "discount_account_id" integer;--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN "purchase_account_id" integer;--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN "supplier_account_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "doc_type_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "inventory_posted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "cost_posted_journal_entry_id" integer;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "doc_type_id" integer;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "cost_posted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "cost_posted_journal_entry_id" integer;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_purchase_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("purchase_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_supplier_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("supplier_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_inventory_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("inventory_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_cogs_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("cogs_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_sales_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("sales_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_cash_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("cash_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_credit_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_tax_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("tax_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_discount_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("discount_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_purchase_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("purchase_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_supplier_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("supplier_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;