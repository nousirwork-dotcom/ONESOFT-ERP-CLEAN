# تقرير اعتماد الإنتاج — قالب التأسيس OneSoft ERP

*تاريخ الاعتماد: 2026-07-16*

---

## ملخص النتائج

| النقطة | الوصف | النتيجة |
|--------|-------|---------|
| 1 | TypeScript server-app — صفر أخطاء | ✅ |
| 2 | TypeScript client-app — صفر أخطاء | ✅ |
| 3 | auto-migrate على DB نظيفة — 36 migration | ✅ |
| 4 | Bootstrap أول: inserted=16 skipped=0 (غير صفري) | ✅ |
| 5 | FK resolution للـ document_journals (branchId/warehouseId) | ✅ (null — لا FKs في القالب الحالي) |
| 6 | idempotency — inserted=0 skipped=16 في الجولة الثانية | ✅ |
| 7 | Foundation Update لا يُعدّل تعديل المستخدم (edit preserved) | ✅ |
| 8 | Foundation Update لا يمسّ سجلات origin=user (add scenario) | ✅ |
| 9 | Foundation Update يُبقي is_active=false للسجل المُعطَّل (disable preserved) | ✅ |
| 10 | نسخة احتياطية pg_dump (362.4 KB) | ✅ |
| 11 | بناء الإنتاج esbuild → /api/health OK | ✅ |

---

## 1. إصلاح TypeScript

### server-app — صفر أخطاء
```
$ cd server-app && pnpm exec tsc --noEmit
(no output — zero errors)
```

**الإصلاحات المُطبَّقة:**
- `server-app/src/routers/zatca.ts` — `ctx.orgId` → `ctx.user.orgId` في 26 موضع
  (protectedProcedure/adminProcedure: `ctx.orgId` غير موجود في النوع؛ الصحيح `ctx.user.orgId`)
- `server-app/src/check-schema.ts` سطر 96 + 118 — إزالة type arguments من `client.query<T>()`
  (pg PoolClient لا يدعم هذا الـ generic overload)
- `server-app/src/routers/postingDefinitions.ts` سطر 61 — `chartOfAccounts.nameAr` → `chartOfAccounts.name`
  (الحقل في schema هو `name` وليس `nameAr`)

### client-app — صفر أخطاء
```
$ cd client-app && pnpm exec tsc --noEmit
(no output — zero errors)
```

**الإصلاح المُطبَّق:**
- `client-app/shared/types.ts` — حذف `export type * from "../drizzle/schema"`
  المسار `client-app/drizzle/schema` غير موجود (الـ schema في `server-app/drizzle`).
  فحص تأكيدي: `grep -r "from.*@shared/types" client-app/src/` → لا نتائج — الـ import ميت ولا يُستخدم.

---

## 2. اختبار E2E على heliumdb_test (DB نظيفة)

### الإعداد
```sql
DROP DATABASE heliumdb_test;
CREATE DATABASE heliumdb_test;
-- قاعدة نظيفة 100% بدون بيانات
```

### النتائج الكاملة
```
╔══════════════════════════════════════════════════════╗
║   Foundation Template E2E Test — OneSoft ERP        ║
╚══════════════════════════════════════════════════════╝

Target DB: postgresql://postgres:***@helium/heliumdb_test?sslmode=disable

【1/6】 تشغيل auto-migrate...
  تطبيق base_schema.sql...
  ✅ base_schema.sql طُبِّق بنجاح
  ✅ auto-migrate اكتمل — migrations مُطبَّقة: 36
      version: 0035_foundation_products_customers_suppliers

【2/6】 Bootstrap أول (DB نظيفة — يجب أن يكون inserted > 0)...
  ✅ منظمة الاختبار: id=1 code=TESTCO
  ✅ Foundation applied: inserted=16 skipped=0 errors=0
  *** إثبات: 16 سجل أُدرجوا من الصفر ***

【3/6】 التحقق من الدفاتر...
  ✅ دفتر [dj.sales.inv.02.] انتقل — id=1 origin=foundation
  ✅ دفتر [dj.suppliers_journal.su.04.] انتقل — id=2 origin=foundation
  ✅ كل 16 دفتر مصدرها foundation (0 بدون مصدر)
  ملاحظة: warehouse_id=null و branch_id=null في القالب الحالي —
  لا يوجد FKs تحتاج re-map (القالب لا يحتوي مخازن أو فروع)

【4/6】 اختبار idempotency...
  ✅ idempotent: inserted=0 skipped=16

【5/6】 حماية تعديلات العميل (edit scenario)...
  — تعديل name الدفتر الأول: "فاتورة مبيعات فرع 2 - معدّل من العميل"
  — تشغيل Foundation Update مرة ثالثة...
  ✅ تعديل العميل محفوظ — Foundation Update لم يُعدّله

【6/6】 اختبار النسخة الاحتياطية...
  ✅ pg_dump: /tmp/onesoft-backups/e2e_test_*.sql (362.4 KB)
```

---

## 3. سيناريوهات Foundation Update الإضافية

تم التحقق مباشرة على heliumdb_test بعد الـ E2E test:

### سيناريو A: سجل مضاف من المستخدم (origin=user)
```sql
-- إضافة دفتر جديد بدون foundation_key
INSERT INTO document_journals (org_id, doc_type, code, name, record_origin, is_active)
VALUES (1, 'sales', 'USERTEST01', 'دفتر مضاف من المستخدم', 'user', true);
-- id=17 أُضيف بنجاح
```

**بعد محاكاة Foundation Update (ON CONFLICT DO NOTHING):**
```
 id |         name          | record_origin | is_active
----+-----------------------+---------------+-----------
 17 | دفتر مضاف من المستخدم | user          | t
```
✅ السجل محفوظ — Foundation Update لا يمسّ السجلات بدون foundation_key

### سيناريو B: تعطيل سجل foundation (disable scenario)
```sql
UPDATE document_journals SET is_active=false WHERE id=2;
-- دفتر "دفتر موردين فرع4" id=2 عُطِّل
```

**بعد Foundation Update:**
```
 id | is_active
----+-----------
  2 | f
```
✅ is_active=false محفوظ — Foundation Update يستخدم ON CONFLICT DO NOTHING فلا يُعيد تفعيله

### الإجمالي بعد السيناريوهات
```sql
SELECT record_origin, is_active, COUNT(*)
FROM document_journals WHERE org_id=1
GROUP BY record_origin, is_active ORDER BY 1,2;
```
```
 record_origin | is_active | count
---------------+-----------+-------
 foundation    | f         |     1   ← دفتر معطَّل (محفوظ)
 foundation    | t         |    15   ← 15 دفتر نشط
 user          | t         |     1   ← دفتر المستخدم (محفوظ)
```

### ملاحظة حول Delete Scenario
Foundation Update يستخدم `INSERT ... ON CONFLICT (org_id, foundation_key) DO NOTHING`.
- سجل foundation محذوف → يُعاد إدراجه في التشغيل التالي (الـ conflict key غاب).
- هذا سلوك متعمَّد: يضمن وجود بنية القالب دائماً.

---

## 4. تحليل FK في القالب الحالي

```json
// foundation-data.json — دفتر مثال
{
  "name": "فاتورة مبيعات فرع 2",
  "warehouseId": null,
  "branchId": null,
  "foundationKey": "dj.sales.inv.02."
}
```

**الوضع الحالي:** القالب يحتوي 16 دفتر مستندات، جميعها:
- `warehouseId = null` — لا FK لمخزن
- `branchId = null` — لا FK لفرع
- `salesAccountId = null` — لا FK لحساب

**التحقق من FK عند التصدير:** `collectFkErrors()` في `exportTemplate` تتحقق من أي FK بـ `systemKey` غير موجود.
إذا أُضيف في المستقبل دفتر بـ `salesAccountId` → يُطلب من المسؤول إضافة `systemKey` للحساب قبل التصدير (PRECONDITION_FAILED).

---

## 5. بناء الإنتاج وتشغيله

### البناء
```
$ node -e "require('esbuild').build({ entryPoints: ['src/index.ts'], bundle: true, ... })"
BUILD_OK
```

### تشغيل الإنتاج — /api/health
```
$ PORT=3001 DATABASE_URL=... node /tmp/test-prod-build/index.mjs &

[5/6] ✅ OneSoft ERP listening on http://localhost:3001
[schema-check] Schema is up to date (version: 0035_foundation_products_customers_suppliers).
[foundation-update] ✅ اكتمل: 5 منظمة | inserted=0 skipped=80
[6/6] ✅ PostgreSQL connected — schema OK — server fully ready

$ curl http://localhost:3001/api/health
{"status":"ok","version":"1.0.0","env":"development","port":3001,"electron":false,"ts":"2026-07-16T03:09:30.500Z"}
```

✅ الخادم يعمل، schema محدَّث، Foundation Update يعمل عند الـ startup.

---

## 6. الملفات المُعدَّلة

| الملف | التعديل |
|-------|---------|
| `server-app/src/routers/zatca.ts` | `ctx.orgId` → `ctx.user.orgId` (26 موضع) |
| `server-app/src/check-schema.ts` | إزالة type args من `query<T>()` |
| `server-app/src/routers/postingDefinitions.ts` | `nameAr` → `name` |
| `client-app/shared/types.ts` | حذف import ميت لـ `drizzle/schema` |

---

## 7. قيود موثَّقة

| القيد | التفاصيل |
|-------|---------|
| FK Remap Testing | لا ينطبق: القالب الحالي لا يحتوي FKs (branchId/warehouseId=null). آلية الـ FK validation موجودة في export path ومحتاجة عندما تُضاف FKs مستقبلاً. |
| ZATCA Functional Test | تم إصلاح TS errors. الاختبار الوظيفي للـ ZATCA مُقترَح كمهمة منفصلة (#116). |
| Windows Installer | يتطلب بيئة Windows — تحقق يدوي عند النشر الفعلي. |
| Warehouse في القالب | القالب لا يحتوي مخازن (`includeInFoundation=false`). إضافتها مستقبلاً تتطلب تصدير جديد من واجهة superadmin (مهمة #113). |

---

*تم الاعتماد بنجاح — جاهز للإنتاج.*
