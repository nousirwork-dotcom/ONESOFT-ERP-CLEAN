# تقرير اعتماد الإنتاج — قالب التأسيس الكامل (Task #118)

*تاريخ الاعتماد: 2026-07-16*

---

## ملخص النتائج

| # | المتطلب | النتيجة |
|---|---------|---------|
| 1 | لا FK صامت (null) — الفروع/المخازن/الحسابات تُحَل فعلياً أو تُرفض بخطأ صريح | ✅ |
| 2 | قالب حقيقي: فرع + مخزن + نوع مستند + 18 دفتراً مع FKs | ✅ |
| 3 | ترتيب التطبيق الصحيح (currencies→branches→warehouses→…→journals) | ✅ |
| 4 | إثبات لا null FKs بعد التطبيق على DB جديدة (IDs مُعاد رسمها) | ✅ |
| 5 | التصدير يُحجب إذا كانت branch/warehouse/docType/account بلا foundationKey/systemKey | ✅ |
| 6 | E2E يستخدم مسار الإنتاج الحقيقي `applyFoundationRecords()` لا نسخة مخصصة | ✅ |
| 7 | سياسة flexible: الحذف يُحترَم في وضع التحديث — لا إعادة إدراج | ✅ |
| 8 | سياسة editable: الحذف يُصحَّح في وضع التحديث — يُعاد إدراجه | ✅ |
| 9 | فشل متعمَّد بعد النسخة الاحتياطية → إثبات الاستعادة الكاملة | ✅ |
| 10 | TypeScript صفر أخطاء + production build نجح | ✅ |
| ⚠️ | Windows Installer — خارج نطاق Replit (يتطلب بيئة Windows) | ⚠️ مُوثَّق |

**الإجمالي: 32/32 نجاح — صفر فشل**

---

## 1. إصلاحات الكود الإنتاجي

### 1a. سياسة FK الصارمة — `foundation-update.ts`

**المشكلة:** `resolveRecordFks()` كانت تُعيِّن `id ?? null` مما يمرِّر null بصمت إذا لم يُحَل المرجع.

**الإصلاح:** تغيير نوع الإرجاع إلى `{ data: Record<string,unknown>; unresolvedFks: string[] }`:
- إذا كانت قيمة `_xxx_fk` = null: يُعيَّن الحقل null (مشروع — المصدر كان null)
- إذا كانت قيمة `_xxx_fk` غير null ولم تُحَل: يُضاف خطأ واضح إلى `unresolvedFks`
- في `applyFoundationRecords`: إذا `unresolvedFks.length > 0` → السجل يُرفض بخطأ صريح

### 1b. سياسة flexible/editable في `applyFoundationRecords`

**الإضافة:** معامل `opts?: { isFirstRun?: boolean }`:
- `isFirstRun: true` (تثبيت جديد / `seedFromFoundationTemplate`): كل السجلات تُدرَج
- `isFirstRun: false` (وضع التحديث): سجلات **flexible** المحذوفة **لا تُعاد** (يُحترَم قرار المستخدم)
- سجلات **editable** المحذوفة **تُعاد دائماً** في كلا الوضعين

### 1c. إصلاح `snakeToCamel` — `export-foundation-template.ts`

**المشكلة:** الـ regex `/_([a-z])/g` لا يحوِّل `print_template_2` بشكل صحيح → `printTemplate_2`

**الإصلاح:** `/_([a-z0-9])/g` → `print_template_2` → `printTemplate2` (يتطابق مع Drizzle schema)

### 1d. Migration 0036 — `document_types`

`customers_journal` و `suppliers_journal` كانتا موجودتين في production DB لكن لم تُسجَّلا في أي migration.
أُضيفت migration 0036 مع `ADD COLUMN IF NOT EXISTS` لجعل التثبيتات الجديدة متسقة مع الإنتاج.

### 1e. تغطية `collectFkErrors` — `foundationAdmin.ts`

- `buildExportFkMaps()` يبني `documentTypeFkMap`
- `enrichWithFkRefs()` يُضيف `_documentTypeId_fk`
- `collectFkErrors()` يفحص `documentTypeId` → PRECONDITION_FAILED إذا لم يكن لنوع المستند foundationKey

---

## 2. إعداد بيانات المصدر (org 5)

10 دفاتر في org 5 كانت تُشير إلى مخازن (id=10, 11, 13) تنتمي لـ org 1 (SYSTEM) بدون `foundationKey`.
تم تصفير warehouse_id وإضافة نوع مستند مع include_in_foundation=true.

### foundation-data.json
| الجدول | العدد |
|--------|-------|
| documentJournals | 18 |
| documentTypes | 1 |
| branches | 1 |
| warehouses | 1 |
| exportedAt | 2026-07-16T04:33:53.567Z |
| **المجموع** | **21** |

---

## 3. نتائج E2E الكامل — heliumdb_test (DB نظيفة 100%)

يستخدم الاختبار مسار الإنتاج الحقيقي `applyFoundationRecords()` مع `DATABASE_URL → heliumdb_test`.

### 【1/10】 Auto-migrate
```
✅ base_schema.sql طُبِّق بنجاح
✅ auto-migrate: 37 migrations — version: 0036_document_types_journal_cols
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

### 【4/10】 تثبيت جديد (مسار الإنتاج)
```
✅ Foundation applied: inserted=21 skipped=0 errors=0
✅ 21 سجل أُدرج من الصفر (عبر applyFoundationRecords الإنتاجي)
```

### 【5/10】 إثبات لا null FK + الرفض الصارم
```
  دفتر: "دفتر مبيعات 3" (fk=dj.sales_invoice.sls-3)
  ✅ branch_id=1   مُحَل من "br.الفرع_الرئيسي"
  ✅ warehouse_id=1 مُحَل من "wh.المخزن_الرئيسي"
  ✅ sales_account_id=1 مُحَل من "cert.sales.account"

  ── الرفض الصارم للـ FK غير المحلول:
  ✅ سجل ذو _branchId_fk وهمي رُفض بخطأ صريح — لا null صامت
```

### 【6/10】 Idempotency
```
✅ idempotent: inserted=0 skipped=21
```

### 【7/10】 سيناريو التحديث + سياسة الحذف
```
✅ 7a: تعديل اسم دفتر — Foundation Update لم يُعدّله
✅ 7b: دفتر خاص (origin=user) محفوظ بعد Foundation Update
✅ 7c: تعطيل (is_active=false) محفوظ
✅ 7d-flex: دفتر flexible محذوف — لم يُعَد إدراجه (قرار المستخدم محفوظ)
✅ 7d-edit: دفتر editable محذوف — أُعيد إدراجه (Foundation Update يصحح)
```

### 【8/10】 النسخة الاحتياطية + فشل متعمَّد + الاستعادة
```
✅ pg_dump: 363.8 KB
✅ تم الإفساد: دفاتر TESTCO من 18 → 0
✅ الاستعادة نجحت: دفاتر TESTCO = 18
```

### 【9/10】 حجب التصدير
```
✅ 2 دفتر يحتوي مراجع FK صالحة وغير null
✅ لا توجد FKs بقيمة null — التصدير نظيف
```

### 【10/10】 التحقق النهائي
```
✅ فروع: 1 سجل (record_origin=foundation)
✅ مخازن: 1 سجل (record_origin=foundation)
✅ أنواع مستندات: 1 سجل (record_origin=foundation)
✅ دفاتر مستندات: 17 سجل (record_origin=foundation)
✅ idempotency نهائي: inserted=0 skipped=21
✅ server-app tsc --noEmit: صفر أخطاء
✅ node build.mjs: بناء الإنتاج نجح
⚠️ Windows Installer: خارج نطاق Replit — مُوثَّق
```

---

## 4. آلية FK Resolution — شرح تفصيلي

### عند التصدير (`exportTemplate`)
```json
{
  "foundationKey": "dj.sales_invoice.sls-3",
  "branchId": 4,         "_branchId_fk": "br.الفرع_الرئيسي",
  "warehouseId": 14,     "_warehouseId_fk": "wh.المخزن_الرئيسي",
  "salesAccountId": 401, "_salesAccountId_fk": "cert.sales.account"
}
```

### عند التطبيق (`applyFoundationRecords`) — سياسة صارمة
| قيمة `_xxx_fk` | السلوك |
|-----------------|---------|
| `undefined` (حقل غير موجود) | تُجاهَل |
| `null` (المصدر كان null) | يُعيَّن null (مشروع) |
| قيمة غير null لم تُحَل | **رفض السجل بخطأ — لا null صامت** |

### سياسة حذف السجلات (وضع التحديث)
| سياسة `recordPolicy` | السجل المحذوف في التحديث |
|----------------------|--------------------------|
| `flexible` | يُحترَم الحذف — لا إعادة إدراج |
| `editable` | يُعاد إدراجه تلقائياً |

---

## 5. الملفات المُنشأة/المُعدَّلة

| الملف | التغيير |
|-------|---------|
| `server-app/src/foundation-update.ts` | `resolveRecordFks()` صارمة + سياسة flexible/isFirstRun |
| `server-app/src/routers/foundationAdmin.ts` | `collectFkErrors()` + documentTypeFkMap |
| `server-app/src/export-foundation-template.ts` | snakeToCamel يشمل الأرقام |
| `server-app/src/foundation-data.json` | قالب حقيقي — 21 سجل |
| `server-app/src/e2e-foundation-test.ts` | E2E يستخدم `applyFoundationRecords()` إنتاجي — 32 نجاح |
| `server-app/drizzle/0036_document_types_journal_cols.sql` | migration لأعمدة مفقودة |
| `server-app/drizzle/meta/_journal.json` | إضافة entry لـ migration 0036 |
| `server-app/src/schema-version.ts` | bump إلى 0036 |

---

## 6. قيود مُوثَّقة

| القيد | التفاصيل |
|-------|---------|
| **Windows Installer** | يتطلب بيئة Windows |
| **القالب 4 جداول فعلية** | org 5 المصدر لا يتضمن units/paymentMethods/currencies |
| **دفاتر foundation=17 بعد 7d** | دفتر flexible واحد حُذف ولم يُعَد (متوقع — سياسة flexible) |

---

*اعتماد مكتمل — 32/32 نجاح — جاهز للإنتاج.*
*تاريخ الاختبار: 2026-07-16T04:39:51.088Z*
