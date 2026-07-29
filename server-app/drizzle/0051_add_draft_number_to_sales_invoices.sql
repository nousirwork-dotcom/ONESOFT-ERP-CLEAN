-- إضافة حقل رقم المسودة إلى فواتير المبيعات
-- لحفظ الرقم الأصلي للمسودة بعد تحويلها إلى فاتورة نهائية
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS draft_number varchar(50);

-- إنشاء فهرس للبحث السريع برقم المسودة
CREATE INDEX IF NOT EXISTS idx_sales_invoices_draft_number ON sales_invoices(org_id, draft_number);
