-- قيد فريد على (org_id, entry_number) في جدول journal_entries
-- يمنع تكرار رقم القيد لنفس المنظمة

-- حذف القيود المكررة أولاً إن وُجدت (تنظيف من خطأ JE-${Date.now()})
DELETE FROM journal_entries
WHERE id NOT IN (
  SELECT MIN(id)
  FROM journal_entries
  GROUP BY org_id, entry_number
);

-- إضافة القيد الفريد
CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_org_entry_number_uidx
  ON journal_entries(org_id, entry_number);
