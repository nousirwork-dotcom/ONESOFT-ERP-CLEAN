ALTER TABLE "document_journals" DROP CONSTRAINT "document_journals_warehouse_id_warehouses_id_fk";
--> statement-breakpoint
ALTER TABLE "sales_invoice_items" DROP CONSTRAINT "sales_invoice_items_warehouse_id_warehouses_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_vouchers" DROP CONSTRAINT "stock_vouchers_warehouse_id_warehouses_id_fk";
--> statement-breakpoint
ALTER TABLE "document_journals" ADD CONSTRAINT "document_journals_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_vouchers" ADD CONSTRAINT "stock_vouchers_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;