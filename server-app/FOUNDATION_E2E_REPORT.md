# Foundation Template E2E Report

```

╔══════════════════════════════════════════════════════╗
║   Foundation Template E2E Test — OneSoft ERP        ║
╚══════════════════════════════════════════════════════╝

Target DB: postgresql://postgres:***@helium/heliumdb_test?sslmode=disable

【1/6】 تشغيل auto-migrate...
  تطبيق base_schema.sql...
  ✅ base_schema.sql طُبِّق بنجاح
  ✅ auto-migrate اكتمل — migrations مُطبَّقة: 36 — version: 0035_foundation_products_customers_suppliers

【2/6】 Bootstrap...
  ✅ منظمة الاختبار: id=1
  ✅ Foundation applied: inserted=16 skipped=0 errors=0

【3/6】 التحقق من الدفاتر...
  إجمالي الدفاتر: 16
  ✅ دفتر [dj.sales.inv.02.] انتقل — id=1 origin=foundation
  ✅ دفتر [dj.suppliers_journal.su.04.] انتقل — id=2
  ✅ كل الدفاتر المُنقَلة مصدرها foundation (16 دفتر، 0 بدون مصدر)
  مخازن منقولة: 0

【4/6】 اختبار idempotency...
  ✅ idempotent: inserted=0 skipped=16

【5/6】 حماية تعديلات العميل...
  ✅ تعديل العميل محفوظ — Foundation Update لم يُعدّله

【6/6】 اختبار النسخة الاحتياطية...
  ✅ pg_dump: /tmp/onesoft-backups/e2e_test_1784171347724.sql (362.4 KB)
```

## ملخص

| الخطوة | النتيجة |
|--------|--------|
| auto-migrate على heliumdb_test | ✅ |
| تطبيق قالب التأسيس (16 دفتر) | ✅ |
| دفاتر غير مُدرَجة لم تنتقل | ✅ |
| idempotency (لا تكرار) | ✅ |
| حماية تعديلات العميل | ✅ |
| pg_dump نسخة احتياطية | ✅ |

*تاريخ الاختبار: 2026-07-16T03:09:08.023Z*
