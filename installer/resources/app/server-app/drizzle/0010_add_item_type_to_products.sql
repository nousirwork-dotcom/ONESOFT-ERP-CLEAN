ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "item_type" varchar(20) NOT NULL DEFAULT 'stock';
