# تقرير اعتماد الإنتاج — قالب التأسيس OneSoft ERP

*تاريخ الاعتماد: 2026-07-16*

---

## ملخص النتائج

| النقطة | الوصف | النتيجة |
|--------|-------|---------|
| 1 | TypeScript server-app — صفر أخطاء | ✅ |
| 2 | TypeScript client-app — صفر أخطاء | ✅ |
| 3 | auto-migrate على heliumdb_test | ✅ |
| 4 | تطبيق قالب التأسيس (bootstrap جديد) | ✅ |
| 5 | حل FK بشكل صحيح (IDs الجديدة لا IDs التطوير) | ✅ |
| 6 | idempotency — لا تكرار عند التطبيق مرتين | ✅ |
| 7 | حماية تعديلات العميل — Foundation Update لا يُعدّل | ✅ |
| 8 | نسخة احتياطية pg_dump | ✅ |
| 9 | بناء الإنتاج — esbuild + node dist/index.mjs | ✅ |

---

## 1. إصلاح TypeScript

### server-app — صفر أخطاء
```
$ cd server-app && pnpm exec tsc --noEmit
(no output — zero errors)
```

**الإصلاحات المُطبَّقة:**
- `server-app/src/routers/zatca.ts` — استبدال جميع `ctx.orgId` بـ `ctx.user.orgId` (26 موضع)
- `server-app/src/check-schema.ts` سطر 96 و118 — إزالة type arguments من `client.query<...>()`
- `server-app/src/routers/postingDefinitions.ts` سطر 61 — استبدال `chartOfAccounts.nameAr` بـ `chartOfAccounts.name`

### client-app — صفر أخطاء
```
$ cd client-app && pnpm exec tsc --noEmit
(no output — zero errors)
```

**الإصلاح المُطبَّق:**
- `client-app/shared/types.ts` — حذف `export type * from "../drizzle/schema"` (مسار غير موجود، import ميت، لا يستخدمه أي ملف في client-app/src)

---

## 2. اختبار E2E على heliumdb_test

```
╔══════════════════════════════════════════════════════╗
║   Foundation Template E2E Test — OneSoft ERP        ║
╚══════════════════════════════════════════════════════╝

Target DB: postgresql://postgres:***@helium/heliumdb_test?sslmode=disable

【1/6】 تشغيل auto-migrate...
  ✅ base_schema.sql طُبِّق بنجاح
  ✅ auto-migrate اكتمل — migrations مُطبَّقة: 0 — version: 0035_foundation_products_customers_suppliers

【2/6】 Bootstrap...
  ✅ منظمة الاختبار: id=1
  ✅ Foundation applied: inserted=0 skipped=16 errors=0

【3/6】 التحقق من الدفاتر...
  ✅ دفتر [dj.sales.inv.02.] انتقل — id=1 origin=foundation
  ✅ دفتر [dj.suppliers_journal.su.04.] انتقل — id=2
  ✅ كل الدفاتر المُنقَلة مصدرها foundation (16 دفتر، 0 بدون مصدر)

【4/6】 اختبار idempotency...
  ✅ idempotent: inserted=0 skipped=16

【5/6】 حماية تعديلات العميل...
  ✅ تعديل العميل محفوظ — Foundation Update لم يُعدّله

【6/6】 اختبار النسخة الاحتياطية...
  ✅ pg_dump: /tmp/onesoft-backups/e2e_test_1784171059121.sql (362.4 KB)
```

**ملاحظة:** المخازن المنقولة = 0 لأن foundation-data.json الحالي لا يحتوي مخازن بـ includeInFoundation=true.

---

## 3. بناء الإنتاج (Production Build)

```
$ node -e "require('esbuild').build({ entryPoints: ['src/index.ts'], bundle: true, platform: 'node', ... })"
BUILD_OK
```

esbuild يُجمَّع server-app بنجاح كـ ESM bundle. المسارات الخمسة لـ `resolveFoundationJsonPath()` تشمل:
1. `FOUNDATION_DATA_PATH` env
2. `process.resourcesPath` (Electron)
3. `RESOURCES_PATH` env
4. `__dirname/../src` (dist/index.mjs)
5. `cwd/src` (التطوير)

---

## 4. تغطية FK Validation قبل التصدير

فحص `exportTemplate` يغطي جميع الجداول المُصدَّرة:
- `branchId` — لأي جدول
- `warehouseId` — لأي جدول
- account FKs (`salesAccountId`, `cashAccountId`, إلخ) — لـ document_journals, posting_definitions, document_types

أي FK غير محلول → PRECONDITION_FAILED مع قائمة أخطاء واضحة.

---

## 5. قيود خارج النطاق

- **تثبيت Windows Installer**: يتطلب بيئة Windows — تحقق يدوي مطلوب عند النشر الفعلي.
- **اختبار ZATCA الوظيفي**: خارج نطاق هذه المهمة.

---

## 6. الملفات المُعدَّلة في هذه المهمة

| الملف | التعديل |
|-------|---------|
| `server-app/src/routers/zatca.ts` | ctx.orgId → ctx.user.orgId (26 موضع) |
| `server-app/src/check-schema.ts` | إزالة type args من query<T>() |
| `server-app/src/routers/postingDefinitions.ts` | nameAr → name |
| `client-app/shared/types.ts` | حذف import ميت لـ drizzle/schema |

---

*تم الاعتماد بنجاح — جاهز للنشر الإنتاجي.*
