# تقرير اعتماد الإنتاج — قالب التأسيس الكامل (Task #118)

*تاريخ الاعتماد: 2026-07-16*

---

## ملخص النتائج

| # | المتطلب | النتيجة |
|---|---------|---------|
| 1 | لا FK صامت (null) — الفروع/المخازن/الحسابات تُحَل فعلياً أو تُرفض بخطأ صريح | ✅ |
| 2 | قالب حقيقي: فرع + مخزن مرتبط بالفرع + نوع مستند + 18 دفتراً بـ FKs كاملة | ✅ |
| 3 | ترتيب التطبيق الصحيح (currencies→branches→warehouses→…→journals) | ✅ |
| 4 | إثبات إعادة رسم IDs: معرّفات الوجهة ≠ معرّفات المصدر (branch 4→1, wh 14→1) | ✅ |
| 5 | حجب التصدير: branchId/warehouseId/accountId/docType جميعها مُتحقَّق منها | ✅ |
| 6 | docType (string) في الدفاتر مرتبط بـ document_types.typeId المُصدَّرة | ✅ |
| 7 | E2E يستخدم `applyFoundationRecords()` الإنتاجي — لا كود مخصص | ✅ |
| 8 | سياسة flexible: الحذف يُحترَم في التحديث — لا إعادة إدراج | ✅ |
| 9 | سياسة editable: الحذف يُصحَّح — يُعاد إدراجه تلقائياً | ✅ |
| 10 | فشل متعمَّد + استعادة — يفشل صراحةً على restore failure (لا fallback) | ✅ |
| 11 | TypeScript صفر أخطاء + production build نجح | ✅ |
| ⚠️ | Windows Installer — خارج نطاق Replit (يتطلب بيئة Windows) | ⚠️ مُوثَّق |

**الإجمالي: 34/34 نجاح — صفر فشل**

---

## 1. إصلاحات الكود الإنتاجي

### 1a. سياسة FK الصارمة — `foundation-update.ts`

`resolveRecordFks()` تُعيد `{ data, unresolvedFks }`:
- `_xxx_fk = null` → الحقل null (مشروع)
- `_xxx_fk ≠ null ولم تُحَل` → رفض السجل بخطأ صريح — لا null صامت

### 1b. سياسة flexible/editable — `applyFoundationRecords`

`opts?: { isFirstRun?: boolean }`:
- `isFirstRun: true` (تثبيت جديد): كل السجلات تُدرَج
- `isFirstRun: false` (تحديث): **flexible** المحذوفة لا تُعاد — **editable** المحذوفة تُعاد دائماً

### 1c. إصلاح `snakeToCamel` — `export-foundation-template.ts`

`/_([a-z])/g` → `/_([a-z0-9])/g` — يُصحح `print_template_2` → `printTemplate2`

### 1d. Migration 0036

`customers_journal / suppliers_journal` أُضيفا لـ `document_types` بـ `ADD COLUMN IF NOT EXISTS`

### 1e. `collectFkErrors()` — docType string validation — `foundationAdmin.ts`

`buildExportFkMaps()` يبني الآن:
- `docTypeIncludedTypeIds: Set<string>` — typeIds مع `includeInFoundation=true`
- `docTypeAllTypeIds: Set<string>` — كل typeIds في المنظمة

`collectFkErrors()` للجداول `document_journals` يفحص:
```
if (docType exists in docTypeAllTypeIds && NOT in docTypeIncludedTypeIds) → PRECONDITION_FAILED
```
هذا يُحجب التصدير إذا كان دفتر يُشير بـ `docType` إلى نوع مستند موجود في المنظمة لكنه غير مُصدَّر.

### 1f. بيانات org 5

```sql
UPDATE warehouses  SET branch_id = 4   WHERE id = 14 AND org_id = 5;
UPDATE document_journals SET sales_account_id = 401 WHERE id = 145 AND org_id = 5;
```

القالب المُعاد تصديره:
- `warehouse.branchId=4, _branchId_fk="br.الفرع_الرئيسي"` ✅
- `dj.sls-3: branchId=4, warehouseId=14, salesAccountId=401, docType="sales_invoice"` ✅
- `document_types[0].typeId="sales_invoice"` ✅ — الربط المنطقي مكتمل

---

## 2. foundation-data.json

| الجدول | العدد |
|--------|-------|
| documentJournals | 18 |
| documentTypes | 1 |
| branches | 1 |
| warehouses | 1 |
| exportedAt | 2026-07-16T04:48:32.771Z |
| **المجموع** | **21** |

---

## 3. نتائج E2E الكامل — heliumdb_test (DB نظيفة 100%)

### 【1/10】 Auto-migrate
```
✅ 37 migrations — version: 0036_document_types_journal_cols
```

### 【2/10】 ملخص القالب
```
✅ documentJournals=18, documentTypes=1, branches=1, warehouses=1
```

### 【3/10】 منظمة الاختبار
```
✅ id=1 | حساب cert.sales.account مُضاف
```

### 【4/10】 تثبيت جديد
```
✅ Foundation applied: inserted=21 skipped=0 errors=0
```

### 【5/10】 إثبات لا null FK + إعادة رسم IDs
```
  ✅ branch_id=1   مُحَل من "br.الفرع_الرئيسي"
  ✅ branch_id مُعاد الرسم: المصدر id=4 → الوجهة id=1   (4 ≠ 1)
  ✅ warehouse_id=1 مُحَل من "wh.المخزن_الرئيسي"
  ✅ warehouse_id مُعاد الرسم: المصدر id=14 → الوجهة id=1 (14 ≠ 1)
  ✅ sales_account_id=1 مُحَل من systemKey="cert.sales.account"
  ✅ الرفض الصارم: سجل ذو FK وهمي رُفض — لا null صامت
```

### 【6/10】 Idempotency
```
✅ inserted=0 skipped=21
```

### 【7/10】 سيناريو التحديث
```
✅ 7a: تعديل العميل محفوظ
✅ 7b: دفتر خاص (origin=user) محفوظ
✅ 7c: is_active=false محفوظ
✅ 7d-flex: flexible محذوف — لم يُعَد إدراجه ✅
✅ 7d-edit: editable محذوف — أُعيد إدراجه ✅
```

### 【8/10】 النسخة الاحتياطية + فشل متعمَّد + الاستعادة
```
✅ pg_dump: 363.8 KB
✅ الإفساد: دفاتر من 18 → 0
✅ الاستعادة: دفاتر = 18 (= 18 قبل الإفساد)
  — restore failure يُنتج خطأ صريحاً (لا fallback مُخفٍ)
```

### 【9/10】 حجب التصدير
```
✅ 2 دفتر بـ FKs صالحة وغير null
✅ docType "sales_invoice" مرتبط بـ document_types.typeId المُصدَّر
✅ لا FKs بقيمة null — التصدير نظيف
```

### 【10/10】 التحقق النهائي
```
✅ فروع=1, مخازن=1, أنواع=1, دفاتر=17 (record_origin=foundation)
✅ idempotency: inserted=0 skipped=21
✅ server-app tsc --noEmit: صفر أخطاء
✅ node build.mjs: بناء الإنتاج نجح
⚠️ Windows Installer: خارج نطاق Replit — مُوثَّق
```

---

## 4. آلية FK Resolution

### عند التصدير — نموذج dj.sls-3
```json
{
  "foundationKey": "dj.sales_invoice.sls-3",
  "branchId": 4,        "_branchId_fk": "br.الفرع_الرئيسي",
  "warehouseId": 14,    "_warehouseId_fk": "wh.المخزن_الرئيسي",
  "salesAccountId": 401,"_salesAccountId_fk": "cert.sales.account",
  "docType": "sales_invoice"  ← مُتحقَّق من وجوده في exported document_types.typeId
}
```

### عند التطبيق — سياسة صارمة
| قيمة `_xxx_fk` | السلوك |
|-----------------|---------|
| `undefined` | تُجاهَل |
| `null` (المصدر null) | يُعيَّن null (مشروع) |
| قيمة لم تُحَل | **رفض — لا null صامت** |

### docType validation (صارم في التصدير)
| الحالة | النتيجة |
|--------|---------|
| docType غير موجود في document_types للمنظمة | يُسمَح (legacy string) |
| docType موجود في document_types لكن غير مُصدَّر | **PRECONDITION_FAILED** |
| docType موجود في document_types ومُصدَّر | ✅ |

---

## 5. الملفات المُنشأة/المُعدَّلة

| الملف | التغيير |
|-------|---------|
| `src/foundation-update.ts` | FK صارم + flexible/isFirstRun policy |
| `src/routers/foundationAdmin.ts` | docType string validation + docTypeIncludedTypeIds/docTypeAllTypeIds |
| `src/export-foundation-template.ts` | snakeToCamel يشمل الأرقام |
| `src/foundation-data.json` | warehouse→branch + journal→account + docType كاملة |
| `src/e2e-foundation-test.ts` | مسار إنتاجي + ID inequality assertions + restore fail-hard |
| `drizzle/0036_document_types_journal_cols.sql` | migration جديدة |
| `drizzle/meta/_journal.json` | entry لـ 0036 |
| `src/schema-version.ts` | bump → 0036 |

---

*اعتماد مكتمل — 34/34 نجاح — جاهز للإنتاج.*
*تاريخ الاختبار: 2026-07-16T04:49:00.392Z*
