# OneSoft ERP — Deployment Architecture v2.0
# معمارية النشر — الفصل بين نوع التثبيت وطرق الاستخدام

---

## المبدأ الجوهري: طبقتان مستقلتان

```
┌──────────────────────────────────────────────────────────────────────┐
│                     LAYER 1: DEPLOYMENT TYPE                         │
│              ما يُثبَّت على الجهاز — اختيار واحد (Radio)             │
│                                                                      │
│    server  │  client  │  server+client  │  branch  │  cloud          │
│   ─────────────────────────────────────────────────────────          │
│   يحدد: DB + Backend + Frontend + Services المحلية                   │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                        مستقلان تماماً
                               │
┌──────────────────────────────▼───────────────────────────────────────┐
│                     LAYER 2: ACCESS MODES                            │
│          كيف يصل المستخدمون — اختيار متعدد (Checkboxes)             │
│                                                                      │
│    ☑ desktop      ☑ web      ☑ offline                               │
│   ─────────────────────────────────────────────────────────          │
│   يحدد: Shortcuts + Browser Access + OfflineSync                     │
└──────────────────────────────────────────────────────────────────────┘
```

**لماذا هذا الفصل مهم:**
- شركة تختار `server+client` يمكنها تشغيل Desktop فقط، أو Web فقط، أو كليهما معاً
- تغيير طريقة الوصول (مثلاً إضافة Web) لا يتطلب تغيير نوع التثبيت
- كل بُعد مستقل تماماً — لا تشابك في الكود أو في Config

---

## أولاً: مصفوفة المكونات (Deployment Type → Infrastructure)

| المكوّن | server | client | server+client | branch | cloud |
|---------|:------:|:------:|:-------------:|:------:|:-----:|
| PostgreSQL (DB) | ✅ | ❌ | ✅ | ✅ | ❌ |
| OneSoft-Server (Backend API) | ✅ | ❌ | ✅ | ✅ | ❌ |
| OneSoft-Client (Frontend Web) | إذا web✓ | ❌ | ✅ | ✅ | ❌ |
| OneSoft-Updater | ✅ | ✅ | ✅ | ✅ | ❌ |
| OneSoft-Backup | ✅ | ❌ | ✅ | ✅ | ❌ |
| DB Migrations | ✅ | ❌ | ✅ | ✅ | ❌ |
| Seed Accounts | ✅ | ❌ | ✅ | ❌† | ❌ |
| Remote Server Required | ❌ | ✅ | ❌ | ✅ | ✅ |

> † `branch` يرث شجرة الحسابات من السيرفر الرئيسي

---

## ثانياً: أثر Access Modes على التثبيت

| الطريقة | يُفعِّل |
|---------|--------|
| `desktop` | اختصار سطح المكتب، تسجيل في Windows Programs |
| `web` | OneSoft-Client service على port 5000 (إذا `server` وإلا مُفعَّل أصلاً) |
| `offline` | OfflineSync service + Local DB Cache (v1.1) |

---

## ثالثاً: السيناريوهات الكاملة

### 🏢 شركة صغيرة
```
Deployment:  server+client
Access:      [desktop, offline]
─────────────────────────────────────────────────────
يُثبَّت:    DB, Backend, Frontend*, Updater, Backup, OfflineSync
Shortcuts:  ✅ نعم
Web:        ❌ لا (desktop فقط)
Offline:    ✅ نعم

* Frontend يُثبَّت لأن server+client يتضمنه دائماً
```

### 🌐 شركة متعددة الفروع — السيرفر الرئيسي
```
Deployment:  server
Access:      [web]
─────────────────────────────────────────────────────
يُثبَّت:    DB, Backend, Frontend (لأن web✓), Updater, Backup
Shortcuts:  ❌ لا
Web:        ✅ نعم — port 5000، المستخدمون يتصلون من الشبكة
```

### 🌿 شركة متعددة الفروع — الفرع
```
Deployment:  branch
Access:      [desktop, web, offline]
─────────────────────────────────────────────────────
يُثبَّت:    DB, Backend, Frontend, Updater, Backup, OfflineSync
Shortcuts:  ✅ نعم
Web:        ✅ نعم
Offline:    ✅ نعم
يتصل بـ:   السيرفر الرئيسي للمزامنة
```

### 👔 مدير الشركة — من أي مكان
```
Deployment:  client
Access:      [web]
─────────────────────────────────────────────────────
يُثبَّت:    Updater فقط
لا يُثبَّت: DB, Backend, Frontend service
يتصل بـ:   السيرفر الرئيسي عبر الإنترنت
Shortcuts:  ❌ لا (Browser فقط)
```

### ☁️ شركة سحابية (مستقبلاً)
```
Deployment:  cloud
Access:      [web]
─────────────────────────────────────────────────────
يُثبَّت:    لا شيء محلياً
يتصل بـ:   السيرفر السحابي
```

---

## رابعاً: تصميم الكود (Architecture)

```
installer/
├── core/types.ts                       ← Single Source of Truth
│   ├── DeploymentType (5 values)
│   ├── AccessMode[] (3 values)
│   ├── OneSoftConfig {deploymentType, accessModes, ...}
│   ├── DeploymentPlan (infra + access layers)
│   └── utility funcs: legacy ↔ new conversion
│
├── core/deployment/DeploymentOrchestrator.ts
│   ├── INFRA{} matrix — what each DeploymentType installs
│   ├── getPlan(type, modes) → DeploymentPlan
│   ├── getComponents(type, modes) → InstalledComponents
│   ├── diff(from, to) → {toInstall, toUninstall, unchanged}
│   └── validate(type, modes, remoteUrl) → {valid, errors}
│
├── core/config/ConfigManager.ts
│   ├── load() — يقرأ + يُرحِّل v1 → v2 تلقائياً
│   ├── save() — يكتب deploymentType + يشتق legacy fields
│   └── _migrate() — v1 installMode/runMode → v2 deploymentType/accessModes
│
├── core/services/ServiceManager.ts
│   └── installAll(deploymentType, accessModes) — ينظر للطبقتين
│
├── core/change/ChangeModeManager.ts
│   ├── changeDeployment(req) — تغيير نوع + طريقة
│   ├── changeAccessModes(current, target) — طريقة فقط
│   └── changeEndpoint(remoteServer) — عنوان السيرفر فقط
│
└── ui/
    ├── store/installer.store.ts
    │   ├── deploymentType: DeploymentType
    │   ├── accessModes: AccessMode[]
    │   └── toggleAccessMode(mode) — يمنع إزالة الخيار الأخير
    │
    └── steps/
        ├── 04-InstallType.tsx   ← Radio — نوع التثبيت (واحد)
        ├── 05-AccessModes.tsx   ← Checkboxes — طرق الاستخدام (متعدد)
        └── 08-Services.tsx      ← يستخدم deploymentType + accessModes
```

---

## خامساً: Config Schema v2

```json
{
  "version": "1.0.0",
  "configVersion": 2,

  "deploymentType": "server+client",
  "accessModes": ["desktop", "web"],

  "installMode": "server+client",
  "runMode": "desktop+web",

  "components": {
    "database": true,
    "backend":  true,
    "frontend": true,
    "updater":  true,
    "backup":   true
  },

  "remoteServer": {
    "enabled":  false,
    "apiUrl":   null,
    "apiKey":   null,
    "syncMode": "realtime"
  }
}
```

**ترحيل configs قديمة (v1 → v2) — تلقائي:**
```
installMode: "standalone"  → deploymentType: "server+client"
runMode: "desktop+web"     → accessModes: ["desktop", "web"]
```

---

## سادساً: قابلية التوسع للميزات المستقبلية

| الميزة | ما يُضاف |
|--------|---------|
| Branch Sync | `syncMode` في RemoteServerConfig + SyncService |
| Offline Mode كامل | `enableOfflineSync=true` في DeploymentPlan + OfflineSync service |
| Mobile App | `client` + `web` — يتصل بـ Backend API مباشرةً |
| Web Portal | `client` + `web` — نفس النمط |
| Auto Update | موجود — UpdateConfig + UpgradeManager |
| License Server | موجود — LicenseConfig + تحقق |
| Multi-Tenant | يتطلب schema change في DB — خارج نطاق Installer |
| Remote Management | إضافة `remote-admin` AccessMode مستقبلاً |

---

## سابعاً: القوانين الستة غير القابلة للكسر

```
1. Core لا يستورد من 'electron'                → صفر coupling
2. DeploymentOrchestrator حكم وحيد             → getPlan() فقط يقرر ما يُثبَّت
3. onesoft.config.json مصدر الحقيقة الوحيد    → لا منطق مضمَّن في الكود
4. كل خطوة idempotent                          → يمكن إعادتها بأمان
5. deploymentType + accessModes (لا installMode → لا تستخدم legacy في كود جديد
6. legacy fields للقراءة فقط                   → لا تُضيف منطقاً عليها
```

---

*configVersion: 2 | معمارية ثنائية الطبقة | 2026-07-01*
