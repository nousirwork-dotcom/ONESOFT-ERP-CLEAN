-- Migration 0026: بيانات المشتريات — مستوى قبل الفواتير

-- إنشاء جدول رؤوس البيانات
CREATE TABLE re_purchase_statements (
  id              SERIAL PRIMARY KEY,
  org_id          INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  project         VARCHAR(255),
  date_from       DATE NOT NULL,
  date_to         DATE NOT NULL,
  notes           TEXT,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX re_purchase_statements_org_id_idx ON re_purchase_statements(org_id);
CREATE INDEX re_purchase_statements_name_idx   ON re_purchase_statements(name);
CREATE INDEX re_purchase_statements_date_idx   ON re_purchase_statements(date_from, date_to);

-- إضافة عمود البيان إلى الفواتير المشتريات
ALTER TABLE re_purchases
  ADD COLUMN statement_id INTEGER REFERENCES re_purchase_statements(id) ON DELETE CASCADE;

CREATE INDEX re_purchases_statement_id_idx ON re_purchases(statement_id);

-- إزالة الفهرس القديم (لم يعد هناك فواتير قبل الترقية)
-- قم بإسقاط المفتاح بعد إضافة العمود

-- إزالة الشرط الأساسية (رؤوس البيانات يمنع التكرار فقط عبر org)
-- المفتاح المتعلق بالبيان القديم يبقى الآن
-- نسخة آمنة: إذا كان هناك بيان قديم بدون statement_id ، يتطلب المستخدم في الواجهة التالية إضافة بيان للفواتير القديمة.
-- في مرحلة التطوير التالية ، سيتم إدارة البيانات من قبل المستخدم.

-- محدثات المحدد ستعمل الآن
CREATE OR REPLACE FUNCTION update_re_purchase_statements_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER re_purchase_statements_updated_at
  BEFORE UPDATE ON re_purchase_statements
  FOR EACH ROW
  EXECUTE FUNCTION update_re_purchase_statements_timestamp();
