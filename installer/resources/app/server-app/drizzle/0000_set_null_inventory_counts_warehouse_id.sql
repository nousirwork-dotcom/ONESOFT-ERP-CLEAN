ALTER TABLE "inventory_counts" DROP CONSTRAINT IF EXISTS "inventory_counts_warehouse_id_fkey";--> statement-breakpoint
ALTER TABLE "inventory_counts" DROP CONSTRAINT IF EXISTS "inventory_counts_warehouse_id_warehouses_id_fk";--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
