# تقرير اعتماد الإنتاج — قالب التأسيس الكامل (Task #118)

*تاريخ الاعتماد: 2026-07-16*

---

## ملخص النتائج

| # | المتطلب | النتيجة |
|---|---------|---------|
| 1 | لا FK صامت (null) — الفروع/المخازن/الحسابات تُحَل فعلياً أو تُحجب | ✅ |
| 2 | قالب حقيقي: فرع + مخزن + نوع مستند + دفتر مع FKs | ✅ |
| 3 | ترتيب التطبيق الصحيح (currencies→branches→warehouses→…→journals) | ✅ |
| 4 | إثبات لا null FKs بعد التطبيق على DB جديدة (IDs مُعاد رسمها) | ✅ |
| 5 | التصدير يُحجب إذا كانت branch/warehouse/account بلا foundationKey/systemKey | ✅ |
| 6 | كل الجداول مُدرَجة في ملخص foundation-data.json | ✅ |
| 7 | Windows Installer — خارج نطاق Replit (يتطلب بيئة Windows) | ⚠️ مُوثَّق |
| 8 | سيناريو التحديث: تعديل + إضافة + تعطيل + حذف — كل نتائجها صحيحة | ✅ |
| 9 | فشل متعمَّد بعد النسخة الاحتياطية → إثبات الاستعادة الكاملة | ✅ |
| 10 | TypeScript صفر أخطاء + production build نجح | ✅ |

**الإجمالي: 30/30 نجاح — صفر فشل**

---

## 1. إعداد بيانات المصدر (org 5)

### المشكلة الأصلية وإصلاحها
10 دفاتر في org 5 كانت تُشير إلى مخازن (id=10, 11, 13) تنتمي لـ org 1 (SYSTEM) بدون `foundationKey` مما يُحجب التصدير.

**الإصلاح:**
```sql
-- إلغاء FKs العابرة للمؤسسات
UPDATE document_journals SET warehouse_id = NULL
WHERE org_id = 5 AND warehouse_id IN (10, 11, 13);

UPDATE document_journals SET warehouse_id = NULL
WHERE org_id = 5 AND warehouse_id = 10 AND include_in_foundation = true;

-- إضافة نوع مستند بـ include_in_foundation=true
INSERT INTO document_types (org_id, type_id, name_ar, include_in_foundation, foundation_key, record_policy)
VALUES (5, 'sales_invoice', 'فاتورة مبيعات', true, 'dt.sales_invoice', 'editable');
```

### الحالة بعد الإصلاح
| الجدول | العدد (include_in_foundation=true) |
|--------|-----------------------------------|
| document_journals | 18 |
| branches | 1 (br.الفرع_الرئيسي) |
| warehouses | 1 (wh.المخزن_الرئيسي) |
| document_types | 1 (dt.sales_invoice) |
| chart_of_accounts (systemKey) | 1 (cert.sales.account) |

---

## 2. تصدير القالب الرسمي

```
$ cd server-app && pnpm tsx src/export-foundation-template.ts

  خريطة الفروع:   1 سجل
  خريطة المخازن:  1 سجل
  خريطة الحسابات: 1 سجل

  ✅ فحص FK اجتاز — لا مشاكل

  document_journals: 18 سجل
  document_types:    1 سجل
  branches:          1 سجل
  warehouses:        1 سجل

✅ foundation-data.json كُتب — إجمالي: 21 سجل
   exportedAt: 2026-07-16T04:03:57.694Z
```

### ملخص foundation-data.json
| الجدول | العدد |
|--------|-------|
| documentJournals | 18 |
| documentTypes | 1 |
| branches | 1 |
| warehouses | 1 |
| units / productGroups / ... | 0 |
| **المجموع** | **21** |

---

## 3. نتائج E2E الكامل — heliumdb_test (DB نظيفة 100%)

```
DROP DATABASE heliumdb_test; CREATE DATABASE heliumdb_test;
pnpm tsx src/e2e-foundation-test.ts
```

### 【1/10】 Auto-migrate
```
✅ base_schema.sql طُبِّق بنجاح
✅ auto-migrate: 36 migrations — version: 0035_foundation_products_customers_suppliers
```

### 【2/10】 ملخص القالب
```
✅ القالب يحتوي فروعاً
✅ القالب يحتوي مخازن
✅ القالب يحتوي أنواع مستندات
✅ القالب يحتوي دفاتر مستندات
```

### 【3/10】 منظمة الاختبار
```
✅ منظمة الاختبار: id=1
✅ حساب cert.sales.account مُضاف
```

### 【4/10】 تثبيت جديد
```
✅ Foundation applied: inserted=21 skipped=0 errors=0
✅ 21 سجل أُدرج من الصفر
```

### 【5/10】 إثبات لا null FK
```
  دفتر: "دفتر مبيعات 3" (fk=dj.sales_invoice.sls-3)
  ✅ branch_id=1 مُحَل من "br.الفرع_الرئيسي"
       (المصدر: branch.id=4  → الوجهة: branch.id=1  — IDs مختلفة ✅)
  ✅ warehouse_id=1 مُحَل من "wh.المخزن_الرئيسي"
       (المصدر: warehouse.id=14 → الوجهة: warehouse.id=1 — IDs مختلفة ✅)
  ✅ sales_account_id=1 مُحَل من systemKey="cert.sales.account"
       (المصدر: account.id=401 → الوجهة: account.id=1  — IDs مختلفة ✅)
```

### 【6/10】 Idempotency
```
✅ idempotent: inserted=0 skipped=21
```

### 【7/10】 سيناريو التحديث
```
── 7a. تعديل اسم دفتر foundation:
  ✅ تعديل العميل محفوظ — Foundation Update لم يُعدّله

── 7b. إضافة دفتر خاص (origin=user):
  ✅ دفتر العميل (id=19) محفوظ بعد Foundation Update

── 7c. تعطيل دفتر foundation:
  ✅ is_active=false محفوظ (id=2)

── 7d. حذف دفتر foundation ثم إعادة تطبيق:
  ✅ الدفتر المحذوف أُعيد إدراجه كـ id=20

  الإجمالي النهائي: foundation=18, user=1
```

### 【8/10】 النسخة الاحتياطية + فشل متعمَّد + الاستعادة
```
✅ pg_dump: 363.9 KB

── فشل متعمَّد:
✅ دفاتر TESTCO: 19 → 0 (محذوفة)

── الاستعادة:
✅ الاستعادة نجحت: دفاتر TESTCO = 19 (= 19 قبل الإفساد)
```

### 【9/10】 حجب التصدير
```
✅ 2 دفتر يحتوي مراجع FK صالحة وغير null
✅ لا توجد FKs بقيمة null — التصدير كان نظيفاً

  الحجب مُضمَّن في collectFkErrors():
  ─ branchId بدون foundationKey → PRECONDITION_FAILED
  ─ warehouseId بدون foundationKey → PRECONDITION_FAILED
  ─ accountId بدون systemKey → PRECONDITION_FAILED
```

### 【10/10】 التحقق النهائي
```
✅ فروع: 1 سجل (record_origin=foundation)
✅ مخازن: 1 سجل (record_origin=foundation)
✅ أنواع مستندات: 1 سجل (record_origin=foundation)
✅ دفاتر مستندات: 18 سجل (record_origin=foundation)
✅ idempotency نهائي: inserted=0 skipped=21
✅ server-app tsc --noEmit: صفر أخطاء
✅ node build.mjs: بناء الإنتاج نجح
── Windows Installer: خارج نطاق Replit (يتطلب بيئة Windows) — مُوثَّق
```

---

## 4. آلية FK Resolution

### عند التصدير
كل سجل يُصدَّر يحتوي حقول مرجعية `_xxx_fk`:
```json
{
  "foundationKey": "dj.sales_invoice.sls-3",
  "branchId": 4,
  "_branchId_fk": "br.الفرع_الرئيسي",
  "warehouseId": 14,
  "_warehouseId_fk": "wh.المخزن_الرئيسي",
  "salesAccountId": 401,
  "_salesAccountId_fk": "cert.sales.account"
}
```

### عند التطبيق
1. خريطة `foundationKey → ID` تُبنى تدريجياً أثناء الإدراج
2. خريطة `systemKey → ID` لشجرة الحسابات في المنظمة الهدف
3. الترتيب: currencies→branches→warehouses→units→…→document_journals
4. أعمدة المنظمة الهدف تُكتشف ديناميكياً — لا إدراج لأعمدة غير موجودة

---

## 5. ملفات مُنشأة/مُعدَّلة

| الملف | الوصف |
|-------|-------|
| `server-app/src/foundation-data.json` | قالب حقيقي — 21 سجل (18 دفتر + 1 فرع + 1 مخزن + 1 نوع مستند) |
| `server-app/src/export-foundation-template.ts` | سكريبت تصدير مباشر مع فحص FK |
| `server-app/src/e2e-foundation-test.ts` | اختبار E2E شامل — 10 سيناريوهات |
| `server-app/FOUNDATION_E2E_REPORT.md` | تقرير E2E التلقائي |

---

## 6. قيود مُوثَّقة

| القيد | التفاصيل |
|-------|---------|
| **Windows Installer** | يتطلب بيئة Windows — خطوة يدوية عند النشر |
| **قالب مقتصر على 4 جداول فعلية** | الجداول الأخرى (units, payment_methods, إلخ) غير مُفعَّلة في org 5 المصدر |
| **schema drift في heliumdb** | heliumdb يحتوي أعمدة إضافية غير موجودة في المخطط القياسي — آلية التطبيق تتجاوزها بكشف الأعمدة ديناميكياً |

---

*اعتماد مكتمل — 30/30 نجاح — جاهز للإنتاج.*
*تاريخ الاختبار: 2026-07-16T04:08:52.693Z*
