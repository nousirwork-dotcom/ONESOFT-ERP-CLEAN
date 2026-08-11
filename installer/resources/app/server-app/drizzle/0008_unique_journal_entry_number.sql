-- قيد فريد على (org_id, entry_number) في جدول journal_entries
-- يمنع تكرار رقم القيد لنفس المنظمة
--
-- ملاحظة: إذا كانت هناك سجلات مكررة فعلاً في قاعدة البيانات فسيفشل هذا الأمر.
-- في هذه الحالة يجب على مسؤول النظام مراجعة السجلات المكررة يدوياً قبل إعادة التطبيق.
-- للكشف عن المكررات: SELECT org_id, entry_number, COUNT(*) FROM journal_entries GROUP BY org_id, entry_number HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_org_entry_number_uidx
  ON journal_entries(org_id, entry_number);
