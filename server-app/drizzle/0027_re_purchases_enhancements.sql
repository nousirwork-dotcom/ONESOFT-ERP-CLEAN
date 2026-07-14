-- Migration 0027: تحسينات البيان التفصيلي للمشتريات

-- 1. إضافة نسبة الضريبة الافتراضية للبيانات
ALTER TABLE re_purchase_statements
  ADD COLUMN default_tax_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00;

-- 2. إضافة مسلسل الفاتورة داخل البيان
ALTER TABLE re_purchases
  ADD COLUMN sequence INTEGER;

CREATE INDEX re_purchases_statement_sequence_idx ON re_purchases(statement_id, sequence);

-- 3. تعبئة المسلسلات للفواتير القديمة (من أول بيان في كل بيان)
DO $$
DECLARE
  stmt RECORD;
  inv RECORD;
  seq INT;
BEGIN
  FOR stmt IN SELECT id FROM re_purchase_statements ORDER BY id
  LOOP
    seq := 1;
    FOR inv IN SELECT id FROM re_purchases WHERE statement_id = stmt.id ORDER BY id
    LOOP
      UPDATE re_purchases SET sequence = seq WHERE id = inv.id;
      seq := seq + 1;
    END LOOP;
  END LOOP;
END $$;

-- 4. تعيين نسبة الضريبة الافتراضية للبيانات القديمة إلى 15%
UPDATE re_purchase_statements SET default_tax_rate = 15.00 WHERE default_tax_rate IS NULL;
