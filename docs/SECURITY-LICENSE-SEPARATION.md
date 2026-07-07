# OneSoft ERP — فصل License Center عن نسخة العميل
## قرار أمني معتمد — غير قابل للتراجع

> **تاريخ الاعتماد:** 2026-07-07
> **الحالة:** ✅ مُطبَّق ومختبر — 21/21 اختبار ناجح

---

## 1. هيكل التطبيقات

```
OneSoft ERP
├── client-app/          ← تطبيق العميل (ERP فقط)      — port 5000
├── server-app/          ← الخادم المشترك               — port 3000
├── license-center-app/  ← تطبيق المالك (منفصل كلياً)  — port 8080
└── shared/              ← أنواع مشتركة (types فقط)
```

---

## 2. ما يحتويه برنامج العميل (المسموح)

| المكوّن | الوصف |
|---------|-------|
| ✅ ERP كامل | المحاسبة، المبيعات، المخزون، التقارير، ZATCA |
| ✅ `/cfg/license` | شاشة التفعيل وقراءة ملف الترخيص |
| ✅ Public Key | للتحقق من صحة الترخيص فحسب (Ed25519 verify) |
| ✅ Activation Code | **استقبال** كود التفعيل من المالك فقط — لا إصدار |
| ✅ كود المؤسسة | يُقرأ من ملف الترخيص تلقائياً — لا يُدخله المستخدم |

---

## 3. ما لا يحتويه برنامج العميل (الممنوع)

| المكوّن | السبب |
|---------|-------|
| ❌ License Center | تطبيق منفصل في `license-center-app/` — لا يُوزَّع مع العميل |
| ❌ Private Key | يُحفظ على جهاز المالك فقط — لا يدخل أي build للعميل |
| ❌ توليد License Key | حصري لبيئة المالك — `licenseCenter.createClient` |
| ❌ إصدار Activation Code | حصري لبيئة المالك — `licenseCenter.renewLicense` |
| ❌ تصدير `license.ons` | لا يُنتَج ولا يُعدَّل من طرف العميل |
| ❌ تجديد التراخيص | `licenseCenter.renewLicense` — ownerOnlyProcedure |
| ❌ إيقاف التراخيص / استئنافها | حصري للمالك |
| ❌ إدارة الأجهزة المرخَّصة | حصري للمالك |
| ❌ بيانات المالك (lcClients, lcLicenses) | لا تظهر في router العميل نهائياً |
| ❌ `/license-center` route | غير موجود في client-app |
| ❌ `seedDemo` | محظور في `production` بـ `NODE_ENV` guard + `ownerOnlyProcedure` |

---

## 4. آلية الفصل الأمني — طبقات متعددة

### الطبقة الأولى — Router Level
```typescript
// server-app/src/routers/index.ts
const IS_CLIENT_BUILD = process.env.CLIENT_BUILD === 'true';

const baseConfig = { /* ERP routers only */ };
const fullConfig = { ...baseConfig, licenseCenter };   // المالك فقط

// في نسخة العميل: licenseCenter غير موجود في الـ router نهائياً
export const appRouter = IS_CLIENT_BUILD
  ? router(baseConfig)
  : router(fullConfig);
```

### الطبقة الثانية — Procedure Level
```typescript
// server-app/src/trpc.ts
const requireOwner = t.middleware(async ({ ctx, next }) => {
  // CLIENT_BUILD=true → NOT_FOUND (endpoint يبدو غير موجود للعميل)
  if (process.env.CLIENT_BUILD === 'true') {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }
  // غير superadmin → FORBIDDEN
  if (ctx.user?.role !== 'superadmin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});

export const ownerOnlyProcedure = t.procedure.use(requireOwner);
```

> جميع 17 إجراء في `licenseCenter.ts` يستخدمون `ownerOnlyProcedure`

### الطبقة الثالثة — Build Level
```bash
# الخادم يُبنى بـ CLIENT_BUILD=true لنسخة العميل
cross-env CLIENT_BUILD=true pnpm build:server:client
```

---

## 5. مكان وجود Private Key

```
scripts/keys/
├── private_key.pem    ← Ed25519 private key — جهاز المالك فقط
└── public_key.pem     ← يُنسخ إلى server-app/src/lib/ للتحقق
```

### قواعد Private Key

| القاعدة | التطبيق |
|---------|---------|
| لا يُرفع إلى GitHub | ✅ `scripts/keys/` في `.gitignore` — 4 قواعد متداخلة |
| لا يدخل client-app | ✅ مُتحقَّق منه في verify-client-build.sh |
| لا يدخل server dist للعميل | ✅ مُتحقَّق منه في verify-client-build.sh |
| لا يدخل installer | ✅ مُتحقَّق منه في verify-installer.sh |
| يُقرأ من بيئة المالك فقط | ✅ موجود في `scripts/keys/` على جهاز المالك |

### إذا تم تسريب Private Key
```bash
# 1. اعتبره مكشوفاً فوراً
# 2. ولّد مفتاحاً جديداً
node scripts/keygen.js

# 3. أعد إصدار كل التراخيص الحالية بالمفتاح الجديد
# 4. أبلغ العملاء بتحديث ملف الترخيص
# 5. حذف المفتاح القديم من أي مكان
```

---

## 6. device.prefs.enc — ما يُحفظ وما يُمنع

```typescript
// الحقول المسموحة فقط:
const ALLOWED_PREFS_KEYS = [
  'organizationCode', 'organizationId', 'organizationName',
  'licenseId', 'deviceId', 'savedOrgCode', 'savedOrgName'
]

// ممنوع هيكلياً — يُرفض ويُسجَّل تحذير:
const FORBIDDEN = [
  /password/i, /secret/i, /token/i, /privateKey/i,
  /apiKey/i,   /auth/i,   /credential/i, /hash/i
]
```

- التشفير: **AES-256-GCM** في production
- المفتاح: مشتق من `deviceId` عبر `scrypt` — لا كلمة مرور مخزنة
- الملف: `device.prefs.enc` (mode 0o600) في production

---

## 7. License Center — بيئة المالك

### الوصول
```
URL    : http://localhost:8080  (أو IP سيرفر المالك)
الدخول : username + password
الدور  : superadmin فقط
```

### ما يمكن فعله في License Center
- إنشاء عملاء جدد وتسجيل بياناتهم
- إصدار تراخيص `license.ons`
- توليد Activation Codes
- تجديد وإيقاف واستئناف التراخيص
- إدارة الأجهزة المرخَّصة لكل عميل
- عرض لوحة إحصائيات التراخيص

### ما لا يمكن فعله
- لا يصل المحاسب أو أي مستخدم ERP عادي
- `seedDemo` محظور في `production` (NODE_ENV guard)
- غير `superadmin` يحصل على `FORBIDDEN` فوراً

---

## 8. أوامر الفحص الأمني قبل الإصدار

### فحص يدوي في أي وقت
```bash
pnpm verify:client-build
# → 21 اختبار أمني — يجب أن تكون كلها ✅
```

### إصدار رسمي للعميل
```bash
pnpm release:client
# Pipeline:
# 1. verify:client-build    ← يفشل إذا كان أي خلل (exit 1)
# 2. build:client           ← يبني client-app
# 3. CLIENT_BUILD=true      ← يبني server-app بدون licenseCenter
# 4. verify:client-build    ← يُعيد الفحص على bundle المُنتَج
# 5. generate-build-report  ← تقرير موقوت في reports/
```

### فحص Installer بعد electron-builder
```bash
pnpm verify:installer
# أو:
bash scripts/verify-installer.sh electron-app/dist/win-unpacked
# يتحقق من: win-unpacked/resources/ وapp.asar إن وُجد
```

### تقرير أمني مستقل
```bash
pnpm build-report
# → reports/CLIENT_BUILD_REPORT_<timestamp>.txt
```

---

## 9. أي فشل في الفحص يمنع الإصدار

```
❌ licenseCenter في bundle        → release:client يتوقف (exit 1)
❌ private key في أي ملف         → release:client يتوقف (exit 1)
❌ /license-center route           → release:client يتوقف (exit 1)
❌ license issuance API في client  → release:client يتوقف (exit 1)
❌ seedDemo بدون production guard  → release:client يتوقف (exit 1)
❌ devicePrefs بدون whitelist      → release:client يتوقف (exit 1)
❌ أي من 21 اختبار يفشل           → release:client يتوقف (exit 1)
```

**لا يوجد طريقة لتجاوز هذا الفحص — مُدمَج في pipeline وليس خطوة اختيارية.**

---

## 10. ملخص القرار المعتمد

| البيئة | المحتوى | من يصل إليها |
|--------|---------|--------------|
| **Client App** (`port 5000`) | ERP + `/cfg/license` + Public Key فقط | المحاسب، المستخدم العادي |
| **License Center** (`port 8080`) | إدارة التراخيص الكاملة + Private Key | المالك (`superadmin`) فقط |
| **scripts/keys/** | Private Key محلي | جهاز المالك — لا يُرفع لأي مكان |

---

*هذا القرار نهائي ومعتمد. أي تعديل على هذا الفصل يجب أن يمر بمراجعة أمنية.*
*آخر تحديث: 2026-07-07*
