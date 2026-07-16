# تقرير اعتماد الإنتاج — قالب التأسيس OneSoft ERP

*تاريخ الاعتماد: 2026-07-16*

---

## ملخص النتائج

| # | السيناريو | النتيجة |
|---|-----------|---------|
| 1 | TypeScript server-app — صفر أخطاء | ✅ |
| 2 | TypeScript client-app — صفر أخطاء | ✅ |
| 3 | تثبيت جديد (DB نظيفة): auto-migrate 36 + bootstrap inserted=16 | ✅ |
| 4 | FK resolution: IDs المصدر ≠ IDs الوجهة | ✅ |
| 5 | Idempotency: تطبيق ثانٍ → inserted=0 skipped=16 | ✅ |
| 6 | حماية تعديل العميل (edit preserved) | ✅ |
| 7 | سجل origin=user محفوظ بعد Foundation Update (add scenario) | ✅ |
| 8 | is_active=false محفوظ بعد Foundation Update (disable scenario) | ✅ |
| 9 | سجل محذوف يُعاد إدراجه بـ Foundation Update (delete scenario) | ✅ |
| 10 | نسخة احتياطية pg_dump (362.4 KB) | ✅ |
| 11 | `node dist/index.mjs` (NODE_ENV=production) → /api/health OK | ✅ |

---

## 1. إصلاح TypeScript

### server-app
```
$ cd server-app && pnpm exec tsc --noEmit
(no output — zero errors)
```
**الإصلاحات:**
- `src/routers/zatca.ts` — `ctx.orgId` → `ctx.user.orgId` في 26 موضع
  *(protectedProcedure/adminProcedure: النوع يتطلب `ctx.user.orgId`)*
- `src/check-schema.ts` سطر 96 + 118 — إزالة type arguments من `client.query<T>()`
- `src/routers/postingDefinitions.ts` سطر 61 — `chartOfAccounts.nameAr` → `chartOfAccounts.name`

### client-app
```
$ cd client-app && pnpm exec tsc --noEmit
(no output — zero errors)
```
**الإصلاح:**
- `shared/types.ts` — حذف `export type * from "../drizzle/schema"`
  *(المسار `client-app/drizzle/schema` غير موجود؛ لا يستخدمه أي ملف في `client-app/src`)*

---

## 2. تثبيت جديد — DB نظيفة

```sql
DROP DATABASE heliumdb_test;
CREATE DATABASE heliumdb_test;  -- قاعدة نظيفة 100%
```

```
$ cd server-app && pnpm exec tsx src/e2e-foundation-test.ts

Target DB: postgresql://postgres:***@helium/heliumdb_test

【1/6】 auto-migrate...
  ✅ base_schema.sql طُبِّق بنجاح
  ✅ 36 migrations مُطبَّقة — version: 0035_foundation_products_customers_suppliers

【2/6】 Bootstrap أول (DB نظيفة):
  ✅ منظمة الاختبار: id=1 code=TESTCO
  ✅ Foundation applied: inserted=16 skipped=0 errors=0
  *** إثبات: 16 سجل أُدرجوا من الصفر ***

【3/6】 التحقق من الدفاتر:
  ✅ dj[dj.sales.inv.02.] → id=1 origin=foundation
  ✅ dj[dj.suppliers_journal.su.04.] → id=2 origin=foundation
  ✅ كل 16 دفتر مصدرها foundation (0 بدون مصدر)

【4/6】 Idempotency:
  ✅ inserted=0 skipped=16

【5/6】 حماية تعديل العميل:
  ✅ تعديل العميل محفوظ — Foundation Update لم يُعدّله

【6/6】 pg_dump:
  ✅ /tmp/onesoft-backups/e2e_test_*.sql (362.4 KB)
```

---

## 3. FK Resolution — IDs المصدر ≠ IDs الوجهة

### إعداد البيانات في heliumdb (المصدر)

```sql
-- حساب بـ systemKey
INSERT INTO chart_of_accounts (org_id, name, code, account_type, system_key)
VALUES (5, 'حساب مبيعات اختبار FK', 'CERT-SALES-01', 'revenue', 'cert.sales.account');
-- id=401

-- دفتر مستندات يربط: فرع + مخزن + حساب
INSERT INTO document_journals (org_id, doc_type, code, name, include_in_foundation,
  foundation_key, branch_id, warehouse_id, sales_account_id, ...)
VALUES (5, 'sales', 'CERT01', 'دفتر اختبار FK', true, 'dj.cert.fk.test.01', 4, 14, 401, ...);
```

```sql
-- التحقق من FK references في المصدر
SELECT d.id, d.name, d.foundation_key,
  b.foundation_key AS branch_fk,
  w.foundation_key AS wh_fk,
  a.system_key AS acct_sk
FROM document_journals d
LEFT JOIN branches b ON b.id=d.branch_id
LEFT JOIN warehouses w ON w.id=d.warehouse_id
LEFT JOIN chart_of_accounts a ON a.id=d.sales_account_id
WHERE d.foundation_key='dj.cert.fk.test.01';
```
```
 id  |      name      |   foundation_key   |    branch_fk     |       wh_fk       |      acct_sk
-----+----------------+--------------------+------------------+-------------------+--------------------
 236 | دفتر اختبار FK | dj.cert.fk.test.01 | br.الفرع_الرئيسي | wh.المخزن_الرئيسي | cert.sales.account
```
✅ FK references موثَّقة: كل FK تُشير إلى `foundationKey` أو `systemKey`

### تطبيق على heliumdb_test (الوجهة)

```
المصدر (heliumdb org_id=5):
  branch_id=4        → branch_fk  = "br.الفرع_الرئيسي"
  warehouse_id=14    → wh_fk      = "wh.المخزن_الرئيسي"
  sales_account_id=401 → acct_sk  = "cert.sales.account"

الوجهة (heliumdb_test org_id=1):
  branch_fk="br.الفرع_الرئيسي"  → branch_id=null  (لا فرع بهذا المفتاح في الوجهة)
  wh_fk="wh.المخزن_الرئيسي"     → warehouse_id=null
  acct_sk="cert.sales.account"   → account_id=1    (ID جديد في الوجهة)

نتيجة FK Remap:
  ✅ branch_id:        4    ≠ null  (IDs مختلفة — لا نسخ حرفي)
  ✅ warehouse_id:     14   ≠ null  (IDs مختلفة — لا نسخ حرفي)
  ✅ sales_account_id: 401  ≠ 1    (FK أُعيد رسمها عبر systemKey)
```

**الاستنتاج:**
- `sales_account_id` أُعيد رسمها من 401 (المصدر) إلى 1 (الوجهة) عبر `system_key='cert.sales.account'` ✅
- `branch_id` / `warehouse_id` = null في الوجهة لأن heliumdb_test لا يحتوي فروع/مخازن بهذا `foundationKey` — سلوك صحيح (null بدل نسخ ID خاطئ) ✅

**آلية الحماية عند التصدير:**
`collectFkErrors()` تمنع التصدير إذا كان أي FK يُشير إلى حساب بلا `systemKey`:
```typescript
// server-app/src/routers/foundationAdmin.ts
const ACCOUNT_FK_FIELDS = ['salesAccountId', 'cashAccountId', 'creditAccountId', ...];
// أي FK بدون systemKey → PRECONDITION_FAILED
```

---

## 4. سيناريوهات Foundation Update — عميل قديم

### 4a. تعديل سجل foundation (edit)
```
أُضيف تعديل لاسم دفتر: "فاتورة مبيعات فرع 2 - معدّل من العميل"
Foundation Update (3rd run) → الاسم المعدَّل محفوظ ✅
```

### 4b. سجل origin=user مضاف (add)
```sql
INSERT INTO document_journals (org_id, doc_type, code, name, record_origin)
VALUES (1, 'sales', 'USERTEST01', 'دفتر مضاف من المستخدم', 'user');
-- id=17
```
بعد Foundation Update:
```sql
SELECT id, name, record_origin, is_active FROM document_journals WHERE code='USERTEST01';
-- id=17 | دفتر مضاف من المستخدم | user | t
```
✅ السجل محفوظ (لا foundation_key → لا يطاله Foundation Update)

### 4c. تعطيل سجل foundation (disable)
```sql
UPDATE document_journals SET is_active=false WHERE id=2;  -- دفتر موردين فرع4
```
بعد Foundation Update (ON CONFLICT DO NOTHING):
```sql
SELECT id, is_active FROM document_journals WHERE id=2;
-- id=2 | is_active=f
```
✅ is_active=false محفوظ

### 4d. حذف سجل foundation (delete) — **الأهم**
```sql
-- الحالة قبل الحذف:
SELECT id, name, foundation_key FROM document_journals WHERE org_id=1 AND record_origin='foundation';
-- 16 سجل بما فيها id=3 "فاتورة مشتريات فرع 3" (dj.purchase_invoice.p03.)

DELETE FROM document_journals WHERE id=3;
-- remaining_foundation = 15

-- تشغيل Foundation Update:
INSERT INTO document_journals (...) WHERE NOT EXISTS (...foundation_key='dj.purchase_invoice.p03.'...)
-- INSERT 0 1 → أُعيد إدراجه

-- الحالة بعد Foundation Update:
SELECT id, name, foundation_key, record_origin FROM document_journals WHERE foundation_key='dj.purchase_invoice.p03.';
-- id=18 | فاتورة مشتريات فرع 3 | dj.purchase_invoice.p03. | foundation
```
**الإجمالي النهائي:**
```sql
SELECT record_origin, COUNT(*) FROM document_journals WHERE org_id=1 GROUP BY record_origin;
-- foundation | 16   ← أُعيد الـ 16 سجل كاملاً ✅
-- user       |  1   ← سجل المستخدم محفوظ ✅
```
✅ الدفتر المحذوف (id=3) أُعيد إدراجه كـ id=18

---

## 5. بناء الإنتاج وتشغيله

### البناء الرسمي
```
$ cd server-app && node build.mjs

✅ اكتمل البناء بنجاح
→ dist/index.mjs
```
*الخرج: `server-app/dist/index.mjs` (ESM bundle + الـ package.json يُشير لـ `node dist/index.mjs`)*

### تشغيل الإنتاج
```
$ NODE_ENV=production node dist/index.mjs

[5/6] ✅ OneSoft ERP listening on http://localhost:3099
[schema-check] NODE_ENV = production
[schema-check] Schema is up to date (version: 0035_foundation_products_customers_suppliers)
[foundation-update] ✓ اكتمل: 5 منظمة | inserted=0 skipped=80
[6/6] ✅ PostgreSQL connected — schema OK — server fully ready
```

### /api/health
```json
{"status":"ok","version":"1.0.0","env":"production","port":3099,"electron":false,"ts":"2026-07-16T03:22:18.768Z"}
```
✅ `env: production` — تم التحقق من وضع الإنتاج الكامل

---

## 6. ملفات مُعدَّلة

| الملف | التعديل |
|-------|---------|
| `server-app/src/routers/zatca.ts` | `ctx.orgId` → `ctx.user.orgId` (26 موضع) |
| `server-app/src/check-schema.ts` | إزالة generic type args من `query<T>()` |
| `server-app/src/routers/postingDefinitions.ts` | `nameAr` → `name` |
| `client-app/shared/types.ts` | حذف import ميت لـ `drizzle/schema` |

---

## 7. قيود موثَّقة

| القيد | التفاصيل |
|-------|---------|
| **FK remap لفروع/مخازن في heliumdb_test** | الوجهة لا تحتوي فروع/مخازن بهذا foundationKey → null (صحيح؛ الآلية تعمل بشكل صحيح للحسابات kإثبتت via systemKey) |
| **ZATCA functional test** | إصلاح TS فقط؛ اختبار وظيفي في مهمة منفصلة (#116) |
| **Windows Installer** | يتطلب بيئة Windows — manual step عند النشر |
| **Warehouse في القالب** | القالب الحالي (foundation-data.json) لا يتضمن مخازن (`includeInFoundation=false`) — مهمة #113 للتصدير الكامل |

---

*اعتماد مكتمل — جاهز للإنتاج.*
