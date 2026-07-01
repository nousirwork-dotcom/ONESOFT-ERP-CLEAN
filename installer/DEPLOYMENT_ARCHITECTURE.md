# OneSoft ERP — Deployment Architecture v4.0
# معمارية النشر — تسعة أبعاد مستقلة

---

## المبدأ الجوهري: كل بُعد مستقل تماماً

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. DEPLOYMENT TYPE        ما يُثبَّت على الجهاز (Radio — واحد)             │
│     server | client | server+client | branch | cloud                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  2. ACCESS MODES           كيف يصل المستخدمون (Checkboxes — متعدد)          │
│     desktop | web | offline                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  3. DATABASE MODE          مصدر قاعدة البيانات (Radio — واحد)               │
│     local-install | local-existing | remote | cloud                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  4. MACHINE ROLE           دور الجهاز في الشبكة (Radio — واحد)              │
│     main-server | branch-server | client-workstation | mobile               │
├─────────────────────────────────────────────────────────────────────────────┤
│  5. CONNECTIVITY MODE      سلوك الاتصال بالشبكة (Radio — واحد)              │
│     always-online | offline-first | lan-only | internet+lan                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  6. LICENSING MODE         نوع الترخيص (Radio — واحد)                       │
│     trial | standard | professional | enterprise | cloud-subscription       │
├─────────────────────────────────────────────────────────────────────────────┤
│  7. UPDATE CHANNEL         قناة التحديث (Radio — واحد)                      │
│     stable | beta | internal-testing                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  8. BACKUP POLICY          سياسة النسخ الاحتياطي (Composite)                │
│     frequency: disabled|daily|weekly|monthly                                │
│     locations: local | network | cloud  (متعددة)                            │
│     retainDays: number                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  9. TELEMETRY              إعدادات التشخيص (Toggles — كلها Opt-In)          │
│     crashReports | diagnosticLogs | usageStatistics                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**لماذا 9 أبعاد؟ كل بُعد يُجيب عن سؤال مستقل تماماً:**

| # | البُعد | السؤال الذي يُجيب عنه |
|---|--------|------------------------|
| 1 | Deployment Type | ما البنية التحتية المثبَّتة على هذا الجهاز؟ |
| 2 | Access Modes | كيف يفتح المستخدمون التطبيق؟ |
| 3 | Database Mode | من أين تأتي قاعدة البيانات؟ |
| 4 | Machine Role | ما دور هذا الجهاز في الشبكة؟ |
| 5 | Connectivity | كيف يتصل هذا الجهاز بالشبكة؟ |
| 6 | Licensing Mode | ما مستوى الترخيص الممنوح لهذا العميل؟ |
| 7 | Update Channel | من أي قناة تأتي التحديثات؟ |
| 8 | Backup Policy | ما جدول ومكان النسخ الاحتياطي؟ |
| 9 | Telemetry | ما البيانات الذي يوافق العميل على مشاركتها؟ |

---

## Config Schema v4 (النسخة الكاملة)

```json
{
  "version": "1.0.0",
  "configVersion": 4,

  "deploymentType":   "server+client",
  "accessModes":      ["desktop", "web"],

  "databaseMode":     "local-install",
  "machineRole":      "main-server",
  "connectivityMode": "always-online",

  "licensingMode":    "trial",
  "updateChannel":    "stable",

  "backupPolicy": {
    "frequency":  "daily",
    "locations":  ["local"],
    "retainDays": 30,
    "path":       null
  },

  "telemetry": {
    "crashReports":    false,
    "diagnosticLogs":  false,
    "usageStatistics": false
  },

  "installMode": "server+client",
  "runMode": "desktop+web",

  "components": {
    "database": true,
    "backend":  true,
    "frontend": true,
    "updater":  true,
    "backup":   true
  },

  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "onesoft_erp",
    "user": "onesoft_app",
    "password": "...",
    "poolMin": 2,
    "poolMax": 10
  }
}
```

**مسار الترحيل التلقائي:**
```
v1 → v2: installMode/runMode  →  deploymentType/accessModes
v2 → v3: + databaseMode + machineRole + connectivityMode (مستنتجة من deploymentType/accessModes)
v3 → v4: + licensingMode='trial' + updateChannel='stable' + backupPolicy + telemetry (قيم آمنة)
```

---

## معمارية الـ Wizard — 18 خطوة

```
01 Welcome           ← ترحيب
02 License           ← قبول الترخيص (EULA)
03 Requirements      ← فحص المتطلبات (RAM/Disk/OS/Net)
─────────────────────────────────────────────────────────
04 Deployment Type   ← البُعد 1: ما يُثبَّت
05 Access Modes      ← البُعد 2: كيف يصل المستخدمون
06 Database Mode     ← البُعد 3: مصدر قاعدة البيانات
07 Machine Role      ← البُعد 4: دور الجهاز
08 Connectivity      ← البُعد 5: طريقة الاتصال (+ ملخص الـ 5)
09 Licensing Mode    ← البُعد 6: نوع الترخيص
10 Update Channel    ← البُعد 7: قناة التحديث
11 Backup Policy     ← البُعد 8: سياسة النسخ الاحتياطي
12 Telemetry         ← البُعد 9: الخصوصية والتشخيص
─────────────────────────────────────────────────────────
13 Organization      ← بيانات المؤسسة
14 First User        ← المستخدم الأول (admin)
─────────────────────────────────────────────────────────
15 Deployment Summary ← ملخص كامل لكل الخيارات التسعة
                        + زر "🚀 بدء التثبيت"
─────────────────────────────────────────────────────────
16 Services          ← التثبيت الفعلي (configVersion:4 يُحفظ هنا)
17 Health Check      ← فحص ما بعد التثبيت
18 Complete          ← الانتهاء + اختصارات + تشغيل
```

**المنطق الجوهري لترتيب الخطوات:**
- **1-3**: تحضير وفحص (قبل أي اختيار)
- **4-12**: الأبعاد التسعة (بناء الصورة الكاملة أولاً)
- **13-14**: بيانات المحتوى (المؤسسة + المستخدم)
- **15**: مراجعة إلزامية — **لا تثبيت بدون موافقة المستخدم**
- **16-18**: تنفيذ + فحص + انتهاء

---

## الأبعاد بالتفصيل

### 1. Deployment Type × مصفوفة المكونات

| المكوّن | server | client | server+client | branch | cloud |
|---------|:------:|:------:|:-------------:|:------:|:-----:|
| PostgreSQL (DB) | ✅ | ❌ | ✅ | ✅ | ❌ |
| Backend API | ✅ | ❌ | ✅ | ✅ | ❌ |
| Frontend | إذا web | ❌ | ✅ | ✅ | ❌ |
| Updater | ✅ | ✅ | ✅ | ✅ | ❌ |
| Backup | ✅ | ❌ | ✅ | ✅ | ❌ |

### 2. Database Mode × ما يحدث عند التثبيت

| الوضع | ما يفعله المثبِّت |
|-------|------------------|
| `local-install` | ينزّل PostgreSQL 16 ويثبّته ويُعدّه تلقائياً |
| `local-existing` | يتصل بـ PostgreSQL الموجود ويُنشئ قاعدة جديدة |
| `remote` | يتصل بـ PostgreSQL على جهاز آخر — لا تثبيت محلي |
| `cloud` | محجوز — Supabase / RDS / Azure |

### 3. Machine Role × أثره على المزامنة

| الدور | المزامنة |
|-------|----------|
| `main-server` | مصدر البيانات — لا يزامن مع أحد |
| `branch-server` | يزامن مع main-server |
| `client-workstation` | بدون DB محلية |
| `mobile-workstation` | offline + مزامنة — محجوز |

### 4. Licensing Mode × حالة النظام

| الوضع | المدة | القيود |
|-------|-------|--------|
| `trial` | 30 يوماً | مستخدم واحد |
| `standard` | دائم | 5 مستخدمين |
| `professional` | دائم | 25 مستخدماً + API |
| `enterprise` | دائم | غير محدود + فروع + SLA |
| `cloud-subscription` | شهري/سنوي | محجوز |

> **ملاحظة:** نوع الترخيص محفوظ في ملف الإعدادات فقط — التحقق والتفعيل يتم داخل التطبيق مستقبلاً.

### 5. Update Channel × دورة التحديث

| القناة | المستهدف | الاستقرار |
|--------|----------|-----------|
| `stable` | جميع العملاء الإنتاجيين | ✅ مختبر بالكامل |
| `beta` | العملاء الراغبون في التجربة المبكرة | ⚠️ قد يحوي أخطاء |
| `internal-testing` | فريق OneSoft فقط | ❌ غير مستقر |

### 6. Backup Policy × السلوك المستقبلي

| الجدول | النسخ |
|--------|-------|
| `disabled` | لا نسخ |
| `daily` | نسخة يومية |
| `weekly` | نسخة أسبوعية |
| `monthly` | نسخة شهرية |

| الوجهة | التفاصيل |
|--------|----------|
| `local` | مجلد محلي (قابل للتخصيص) |
| `network` | مسار شبكي UNC أو mapped drive |
| `cloud` | OneSoft Cloud — محجوز |

### 7. Telemetry — سياسة الـ Opt-In

| البيانات | محتواها | مُرسَل مع البيانات المالية؟ |
|----------|---------|---------------------------|
| `crashReports` | تفاصيل الأعطال التقنية | ❌ أبداً |
| `diagnosticLogs` | سجلات الأداء | ❌ أبداً |
| `usageStatistics` | إحصاءات مجهولة | ❌ أبداً |

**جميع الحقول معطلة افتراضياً — Opt-In حصراً.**

---

## السيناريوهات الكاملة (Config v4)

### 🏢 شركة صغيرة — جهاز واحد (الأكثر شيوعاً)
```json
{
  "deploymentType":   "server+client",
  "accessModes":      ["desktop"],
  "databaseMode":     "local-install",
  "machineRole":      "main-server",
  "connectivityMode": "always-online",
  "licensingMode":    "standard",
  "updateChannel":    "stable",
  "backupPolicy":     { "frequency": "daily", "locations": ["local"], "retainDays": 30 },
  "telemetry":        { "crashReports": true, "diagnosticLogs": false, "usageStatistics": false }
}
```

### 🌿 فرع بعيد — يعمل أوفلاين
```json
{
  "deploymentType":   "branch",
  "accessModes":      ["desktop", "offline"],
  "databaseMode":     "local-install",
  "machineRole":      "branch-server",
  "connectivityMode": "offline-first",
  "licensingMode":    "professional",
  "updateChannel":    "stable",
  "backupPolicy":     { "frequency": "weekly", "locations": ["local", "network"], "retainDays": 90 },
  "telemetry":        { "crashReports": false, "diagnosticLogs": false, "usageStatistics": false }
}
```

### 💻 محطة عمل — تتصل بسيرفر مشترك
```json
{
  "deploymentType":   "client",
  "accessModes":      ["desktop"],
  "databaseMode":     "remote",
  "machineRole":      "client-workstation",
  "connectivityMode": "lan-only",
  "licensingMode":    "standard",
  "updateChannel":    "stable",
  "backupPolicy":     { "frequency": "disabled", "locations": [], "retainDays": 0 },
  "telemetry":        { "crashReports": false, "diagnosticLogs": false, "usageStatistics": false }
}
```

---

## معمارية الكود

```
installer/
├── core/types.ts                            ← 9 أنواع + OneSoftConfig v4
│   ├── DeploymentType  (5 قيم)
│   ├── AccessMode[]    (3 قيم)
│   ├── DatabaseMode    (4 قيم)
│   ├── MachineRole     (4 قيم)
│   ├── ConnectivityMode (4 قيم)
│   ├── LicensingMode   (5 قيم)
│   ├── UpdateChannel   (3 قيم)
│   ├── BackupFrequency (4 قيم)
│   ├── BackupLocation  (3 قيم)
│   ├── BackupPolicy    (interface)
│   └── TelemetryConfig (interface)
│
├── core/config/ConfigManager.ts
│   ├── buildDefaultConfig({...all 9 dimensions...})
│   ├── _migrate()  → v1→v2→v3→v4 تلقائياً
│   └── configVersion: 4
│
└── ui/
    ├── store/installer.store.ts   ← جميع الحقول التسعة + setters متخصصة
    │
    └── steps/                     ← 18 خطوة
        ├── 01-Welcome.tsx
        ├── 02-License.tsx
        ├── 03-Requirements.tsx
        ├── 04-InstallType.tsx      ← Deployment Type
        ├── 05-AccessModes.tsx      ← Access Modes
        ├── 05-Database.tsx         ← Database Mode (Rich: 4 أوضاع + test)
        ├── 06-MachineRole.tsx      ← Machine Role
        ├── 07-Connectivity.tsx     ← Connectivity + ملخص الـ 5 الأولى
        ├── 08-Licensing.tsx        ← Licensing Mode ← جديد
        ├── 09-UpdateChannel.tsx    ← Update Channel ← جديد
        ├── 10-BackupPolicy.tsx     ← Backup Policy (جدول + وجهات) ← جديد
        ├── 11-Telemetry.tsx        ← Telemetry Opt-In (toggles) ← جديد
        ├── 06-Organization.tsx     ← بيانات المؤسسة (خطوة 13)
        ├── 07-FirstUser.tsx        ← المستخدم الأول (خطوة 14)
        ├── 15-DeploymentSummary.tsx ← ملخص 9 أبعاد + زر بدء التثبيت ← جديد
        ├── 08-Services.tsx         ← يحفظ configVersion:4 الكاملة
        ├── 09-HealthCheck.tsx
        └── 10-Complete.tsx
```

---

## قوانين التوسع — لا تُكسر

```
1. كل بُعد مستقل — لا منطق يربط أبعاداً مع بعضها
2. configVersion ترتفع عند إضافة أي حقل جديد — لا تراجع أبداً
3. الترحيل دائماً لأمام فقط (v1→v2→v3→v4→...) — يستنتج القيم بذكاء
4. Legacy fields محتفظ بها للقراءة فقط — لا منطق جديد عليها
5. ConfigManager هو المرجع الوحيد للقراءة/الكتابة/الترحيل
6. التثبيت لا يبدأ إلا بعد موافقة صريحة (زر "بدء التثبيت" في خطوة 15)
7. Telemetry كلها Opt-In — لا يُرسَل أي شيء بدون موافقة صريحة
8. Licensing يُحفظ في الإعدادات — التحقق والتفعيل داخل التطبيق فقط
9. Backup Policy تُحفظ الآن — الخدمة الفعلية تُنفَّذ في إصدار قادم
```

---

## جدول التوافق مع الإصدارات

| configVersion | التغييرات | الترحيل |
|:---:|-----------|---------|
| 1 | `installMode` + `runMode` | — |
| 2 | + `deploymentType` + `accessModes` | تلقائي من v1 |
| 3 | + `databaseMode` + `machineRole` + `connectivityMode` | تلقائي من v2 |
| 4 | + `licensingMode` + `updateChannel` + `backupPolicy` + `telemetry` | تلقائي من v3 |

**جميع عمليات الترحيل تُنفَّذ تلقائياً عند تحميل الملف — لا تدخل يدوي مطلوب.**

---

*configVersion: 4 | معمارية تُسيع الأبعاد | النسخة النهائية | 2026-07-01*
