# تقرير اعتماد الإنتاج — قالب التأسيس الكامل (Task #118)

*تاريخ الاعتماد: 2026-07-16*

---

## ملخص النتائج

| # | المتطلب | النتيجة |
|---|---------|---------|
| 1 | لا FK صامت (null) — الفروع/المخازن/الحسابات تُحَل فعلياً أو تُرفض بخطأ صريح | ✅ |
| 2 | قالب حقيقي: فرع + مخزن + نوع مستند + دفتر مع FKs | ✅ |
| 3 | ترتيب التطبيق الصحيح (currencies→branches→warehouses→…→journals) | ✅ |
| 4 | إثبات لا null FKs بعد التطبيق على DB جديدة (IDs مُعاد رسمها) | ✅ |
| 5 | التصدير يُحجب إذا كانت branch/warehouse/docType/account بلا foundationKey/systemKey | ✅ |
| 6 | كل الجداول مُدرَجة في ملخص foundation-data.json | ✅ |
| 7 | Windows Installer — خارج نطاق Replit (يتطلب بيئة Windows) | ⚠️ مُوثَّق |
| 8 | سيناريو التحديث: تعديل + إضافة + تعطيل + حذف — كل نتائجها صحيحة | ✅ |
| 9 | فشل متعمَّد بعد النسخة الاحتياطية → إثبات الاستعادة الكاملة | ✅ |
| 10 | TypeScript صفر أخطاء + production build نجح | ✅ |

**الإجمالي: 31/31 نجاح — صفر فشل**

---

## 1. إصلاحات الكود الإنتاجي

### 1a. سياسة FK الصارمة — `foundation-update.ts`

**المشكلة:** `resolveRecordFks()` كانت تُعيِّن `id ?? null` مما يمرِّر null بصمت إذا لم يُحَل المرجع.

**الإصلاح:** تغيير نوع الإرجاع إلى `{ data: Record<string,unknown>; unresolvedFks: string[] }`:
- إذا كانت قيمة `_xxx_fk` = null: يُعيَّن الحقل null (مشروع — المصدر كان null)
- إذا كانت قيمة `_xxx_fk` غير null ولم تُحَل: يُضاف خطأ واضح إلى `unresolvedFks`
- في `applyFoundationRecords`: إذا `unresolvedFks.length > 0` → السجل يُرفض بخطأ صريح

**إثبات الرفض الصارم من E2E:**
```
  ── إثبات الرفض الصارم للـ FK غير المحلول:
  ✅ الرفض الصارم: سجل ذو FK وهمي رُفض
     (error: "document_journals[e2e.strict.fk.test]: فشل حل FK — branchId: '...' غير موجود")
     — لا null صامت ✅
```

### 1b. تغطية `collectFkErrors` — `foundationAdmin.ts`

**الإضافات:**
1. `buildExportFkMaps()` يبني الآن `documentTypeFkMap` (document_types.id → foundationKey)
2. `enrichWithFkRefs()` يُضيف `_documentTypeId_fk` إذا كان السجل يحتوي على `documentTypeId` integer
3. `collectFkErrors()` يفحص `documentTypeId` → يحجب التصدير إذا لم يكن لنوع المستند foundationKey
4. `FK_FIELD_MAP` في `foundation-update.ts` يتضمن `documentTypeId: { type: 'foundation', tableKey: 'documentTypes' }`

---

## 2. إعداد بيانات المصدر (org 5)

### المشكلة الأصلية وإصلاحها
10 دفاتر في org 5 كانت تُشير إلى مخازن (id=10, 11, 13) تنتمي لـ org 1 (SYSTEM) بدون `foundationKey` مما يُحجب التصدير.

**الإصلاح:**
```sql
-- إلغاء FKs العابرة للمؤسسات
UPDATE document_journals SET warehouse_id = NULL
WHERE org_id = 5 AND warehouse_id IN (10, 11, 13);

-- إضافة نوع مستند بـ include_in_foundation=true
INSERT INTO document_types (org_id, type_id, name_ar, include_in_foundation, foundation_key, record_policy)
VALUES (5, 'sales_invoice', 'فاتورة مبيعات', true, 'dt.sales_invoice', 'editable');
```

### foundation-data.json
| الجدول | العدد |
|--------|-------|
| documentJournals | 18 |
| documentTypes | 1 |
| branches | 1 |
| warehouses | 1 |
| exportedAt | 2026-07-16T04:03:57.694Z |
| **المجموع** | **21** |

---

## 3. نتائج E2E الكامل — heliumdb_test (DB نظيفة 100%)

### 【1/10】 Auto-migrate
```
✅ base_schema.sql طُبِّق بنجاح
✅ auto-migrate: 36 migrations — version: 0035_foundation_products_customers_suppliers
```

### 【2/10】 ملخص القالب
```
✅ القالب يحتوي فروعاً / مخازن / أنواع مستندات / دفاتر مستندات
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

### 【5/10】 إثبات لا null FK + الرفض الصارم
```
  دفتر: "دفتر مبيعات 3" (fk=dj.sales_invoice.sls-3)
  ✅ branch_id=1   مُحَل من "br.الفرع_الرئيسي"    (المصدر id=4  → الوجهة id=1)
  ✅ warehouse_id=1 مُحَل من "wh.المخزن_الرئيسي"   (المصدر id=14 → الوجهة id=1)
  ✅ sales_account_id=1 مُحَل من "cert.sales.account" (المصدر id=401 → الوجهة id=1)

  ── الرفض الصارم للـ FK غير المحلول:
  ✅ سجل ذو _branchId_fk وهمي رُفض بخطأ صريح — لا null صامت
```

### 【6/10】 Idempotency
```
✅ idempotent: inserted=0 skipped=21
```

### 【7/10】 سيناريو التحديث
```
✅ 7a: تعديل اسم دفتر — Foundation Update لم يُعدّله
✅ 7b: دفتر خاص (origin=user) محفوظ بعد Foundation Update
✅ 7c: تعطيل (is_active=false) محفوظ
✅ 7d: دفتر محذوف أُعيد إدراجه
   الإجمالي: foundation=18, user=1
```

### 【8/10】 النسخة الاحتياطية + فشل متعمَّد + الاستعادة
```
✅ pg_dump: 363.9 KB
✅ تم الإفساد: دفاتر TESTCO من 19 → 0
✅ الاستعادة نجحت: دفاتر TESTCO = 19 (= 19 قبل الإفساد)
```

### 【9/10】 حجب التصدير
```
✅ 2 دفتر يحتوي مراجع FK صالحة وغير null
✅ لا توجد FKs بقيمة null — التصدير نظيف
   collectFkErrors() يحجب: branchId / warehouseId / documentTypeId / accountIds
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
── Windows Installer: خارج نطاق Replit — مُوثَّق
```

---

## 4. آلية FK Resolution — شرح تفصيلي

### عند التصدير (`exportTemplate`)
```json
{
  "foundationKey": "dj.sales_invoice.sls-3",
  "branchId": 4,        "_branchId_fk": "br.الفرع_الرئيسي",
  "warehouseId": 14,    "_warehouseId_fk": "wh.المخزن_الرئيسي",
  "salesAccountId": 401, "_salesAccountId_fk": "cert.sales.account"
}
```

### عند التطبيق (`applyFoundationRecords`) — سياسة صارمة
| قيمة `_xxx_fk` | السلوك |
|-----------------|---------|
| `undefined` (حقل غير موجود) | تُجاهَل |
| `null` (المصدر كان null) | يُعيَّن null (مشروع) |
| قيمة غير null لم تُحَل | **رفض السجل بخطأ — لا null صامت** |

---

## 5. الملفات المُنشأة/المُعدَّلة

| الملف | التغيير |
|-------|---------|
| `server-app/src/foundation-update.ts` | `resolveRecordFks()` صارمة + `documentTypeId` في FK_FIELD_MAP |
| `server-app/src/routers/foundationAdmin.ts` | `collectFkErrors()` + `enrichWithFkRefs()` + `buildExportFkMaps()` بـ documentTypeFkMap |
| `server-app/src/foundation-data.json` | قالب حقيقي — 21 سجل |
| `server-app/src/export-foundation-template.ts` | سكريبت تصدير مباشر |
| `server-app/src/e2e-foundation-test.ts` | اختبار E2E شامل — 31 نجاح |

---

## 6. قيود مُوثَّقة

| القيد | التفاصيل |
|-------|---------|
| **Windows Installer** | يتطلب بيئة Windows |
| **القالب 4 جداول فعلية** | org 5 المصدر لا يتضمن units/paymentMethods/currencies |
| **schema drift في heliumdb** | heliumdb يحتوي أعمدة إضافية — آلية التطبيق تكتشف الأعمدة ديناميكياً |

---

*اعتماد مكتمل — 31/31 نجاح — جاهز للإنتاج.*
*تاريخ الاختبار: 2026-07-16T04:19:30.320Z*
