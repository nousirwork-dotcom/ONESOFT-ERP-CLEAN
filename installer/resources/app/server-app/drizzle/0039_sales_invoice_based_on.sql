-- Migration 0039: add based_on_type and based_on_number to sales_invoices
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS based_on_type varchar(20);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS based_on_number varchar(50);
