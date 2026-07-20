-- Migration 0042: source_document_id على sales_invoices + is_shared_journal على document_journals
-- source_document_id: FK للفاتورة المصدر (أمر بيع / عرض سعر) يُتحقق منه لأمان الفرع
ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS source_document_id integer REFERENCES sales_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_invoices_source_doc ON sales_invoices(source_document_id);

-- is_shared_journal: دفتر عام يعمل مع أي فرع دون قيد (يجب تفعيله صراحةً)
ALTER TABLE document_journals
  ADD COLUMN IF NOT EXISTS is_shared_journal boolean NOT NULL DEFAULT false;
