ALTER TABLE "sales_invoices" DROP CONSTRAINT IF EXISTS "sales_invoices_warehouse_id_warehouses_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_invoices" DROP CONSTRAINT IF EXISTS "purchase_invoices_warehouse_id_warehouses_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory" DROP CONSTRAINT IF EXISTS "inventory_warehouse_id_warehouses_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "warehouse_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
