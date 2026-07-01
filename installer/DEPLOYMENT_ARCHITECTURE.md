# OneSoft ERP — Deployment Architecture v3.0
# معمارية النشر — خمسة أبعاد مستقلة

---

## المبدأ الجوهري: كل بُعد مستقل تماماً

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. DEPLOYMENT TYPE        ما يُثبَّت على الجهاز (Radio — واحد)         │
│     server | client | server+client | branch | cloud                    │
├─────────────────────────────────────────────────────────────────────────┤
│  2. ACCESS MODES           كيف يصل المستخدمون (Checkboxes — متعدد)      │
│     desktop | web | offline                                              │
├─────────────────────────────────────────────────────────────────────────┤
│  3. DATABASE MODE          مصدر قاعدة البيانات (Radio — واحد)           │
│     local-install | local-existing | remote | cloud                     │
├─────────────────────────────────────────────────────────────────────────┤
│  4. MACHINE ROLE           دور الجهاز في الشبكة (Radio — واحد)          │
│     main-server | branch-server | client-workstation | mobile           │
├─────────────────────────────────────────────────────────────────────────┤
│  5. CONNECTIVITY MODE      سلوك الاتصال بالشبكة (Radio — واحد)          │
│     always-online | offline-first | lan-only | internet+lan             │
└─────────────────────────────────────────────────────────────────────────┘
```

**لماذا 5 أبعاد؟**
كل بُعد يُجيب عن سؤال مختلف تماماً:
| البُعد | السؤال |
|--------|--------|
| Deployment Type | ما البنية التحتية المثبَّتة على هذا الجهاز؟ |
| Access Modes | كيف يفتح المستخدمون التطبيق؟ |
| Database Mode | من أين تأتي قاعدة البيانات؟ |
| Machine Role | ما دور هذا الجهاز داخل الشبكة؟ |
| Connectivity | كيف يتصل هذا الجهاز بالشبكة؟ |

---

## أولاً: Deployment Type × مصفوفة المكونات

| المكوّن | server | client | server+client | branch | cloud |
|---------|:------:|:------:|:-------------:|:------:|:-----:|
| PostgreSQL (DB) | ✅ | ❌ | ✅ | ✅ | ❌ |
| OneSoft-Server (Backend) | ✅ | ❌ | ✅ | ✅ | ❌ |
| OneSoft-Client (Frontend) | إذا web | ❌ | ✅ | ✅ | ❌ |
| OneSoft-Updater | ✅ | ✅ | ✅ | ✅ | ❌ |
| OneSoft-Backup | ✅ | ❌ | ✅ | ✅ | ❌ |
| DB Migrations | ✅ | ❌ | ✅ | ✅ | ❌ |
| Seed Accounts | ✅ | ❌ | ✅ | ❌† | ❌ |
| Remote Server Required | ❌ | ✅ | ❌ | ✅ | ✅ |

> † `branch` يرث شجرة الحسابات من السيرفر الرئيسي

---

## ثانياً: Database Mode × ما يحدث عند التثبيت

| الوضع | ما يفعله المثبِّت | متى تختاره |
|-------|------------------|------------|
| `local-install` | ينزّل PostgreSQL 16 ويثبّته ويُعدّه | لا يوجد PostgreSQL على الجهاز |
| `local-existing` | يتصل بـ PostgreSQL الموجود ويُنشئ قاعدة جديدة | PostgreSQL مثبَّت مسبقاً |
| `remote` | يتصل بـ PostgreSQL على جهاز آخر عبر الشبكة | سيرفر DB مشترك أو مخصص |
| `cloud` | محجوز — Supabase / RDS / Azure | مستقبلاً |

---

## ثالثاً: Machine Role × أثره على المزامنة

| الدور | وضعه في الشبكة | المزامنة |
|-------|---------------|----------|
| `main-server` | مصدر البيانات الرئيسي | لا يزامن — هو الأصل |
| `branch-server` | فرع مستقل | يزامن مع main-server |
| `client-workstation` | عميل خفيف | بدون DB محلية |
| `mobile-workstation` | محمول — مستقبلاً | offline + مزامنة |

---

## رابعاً: Connectivity Mode × سلوك النظام

| الوضع | يعمل بدون إنترنت | تحديثات تلقائية | مزامنة |
|-------|:----------------:|:---------------:|:-------:|
| `always-online` | ❌ | ✅ | فورية |
| `offline-first` | ✅ | ✅ عند الاتصال | تلقائية |
| `lan-only` | ✅ (شبكة داخلية) | ❌ | شبكة داخلية |
| `internet+lan` | ❌ | ✅ | فورية + داخلية |

---

## خامساً: السيناريوهات الكاملة

### 🏢 شركة صغيرة — جهاز واحد
```
DeploymentType:   server+client
AccessModes:      [desktop]
DatabaseMode:     local-install
MachineRole:      main-server
ConnectivityMode: always-online
─────────────────────────────────────────────────────
يُثبَّت:   PostgreSQL (جديد) + Backend + Frontend + Updater + Backup
يفتح من: اختصار سطح المكتب
```

### 🏪 شركة متعددة — السيرفر الرئيسي
```
DeploymentType:   server
AccessModes:      [web]
DatabaseMode:     local-install
MachineRole:      main-server
ConnectivityMode: lan-only
─────────────────────────────────────────────────────
يُثبَّت:   PostgreSQL + Backend + Frontend (لأن web✓) + Updater + Backup
الموظفون يفتحون من: المتصفح عبر الشبكة المحلية
```

### 🌿 فرع بعيد
```
DeploymentType:   branch
AccessModes:      [desktop, offline]
DatabaseMode:     local-install
MachineRole:      branch-server
ConnectivityMode: offline-first
─────────────────────────────────────────────────────
يُثبَّت:   PostgreSQL + Backend + Updater + Backup + OfflineSync
يعمل بدون إنترنت + يزامن مع main-server عند الاتصال
```

### 💻 محطة عمل (موظف)
```
DeploymentType:   client
AccessModes:      [desktop]
DatabaseMode:     remote
MachineRole:      client-workstation
ConnectivityMode: lan-only
─────────────────────────────────────────────────────
يُثبَّت:   Updater فقط
يتصل بـ:  السيرفر الرئيسي عبر الشبكة الداخلية
```

### 🖥️ سيرفر DB مخصص (PostgreSQL على جهاز منفصل)
```
DeploymentType:   server
AccessModes:      [web]
DatabaseMode:     remote
MachineRole:      main-server
ConnectivityMode: internet+lan
─────────────────────────────────────────────────────
يُثبَّت:   Backend + Frontend فقط (بدون PostgreSQL محلي)
DB على:   جهاز منفصل في الشبكة
```

---

## سادساً: Config Schema v3

```json
{
  "version": "1.0.0",
  "configVersion": 3,

  "deploymentType":   "server+client",
  "accessModes":      ["desktop", "web"],
  "databaseMode":     "local-install",
  "machineRole":      "main-server",
  "connectivityMode": "always-online",

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
  },

  "remoteServer": {
    "enabled": false,
    "apiUrl":  null,
    "apiKey":  null,
    "syncMode": "realtime"
  }
}
```

**مسار الترحيل التلقائي:**
```
v1 → v2: installMode/runMode → deploymentType/accessModes
v2 → v3: أضف databaseMode + machineRole + connectivityMode بقيم مستنتجة
```

---

## سابعاً: معمارية الكود

```
installer/
├── core/types.ts                          ← 5 أنواع رئيسية + OneSoftConfig v3
│   ├── DeploymentType (5 قيم)
│   ├── AccessMode[]  (3 قيم)
│   ├── DatabaseMode  (4 قيم)
│   ├── MachineRole   (4 قيم)
│   └── ConnectivityMode (4 قيم)
│
├── core/config/ConfigManager.ts
│   ├── buildDefaultConfig({..., databaseMode, machineRole, connectivityMode})
│   ├── _migrate()  → v1→v2→v3 تلقائياً
│   └── configVersion: 3
│
├── core/deployment/DeploymentOrchestrator.ts
│   └── getPlan(deploymentType, accessModes) → DeploymentPlan
│
└── ui/
    ├── store/installer.store.ts  ← جميع الحقول الجديدة + setters
    │
    └── steps/                   ← 13 خطوة
        ├── 01-Welcome.tsx
        ├── 02-License.tsx
        ├── 03-Requirements.tsx
        ├── 04-InstallType.tsx    ← Deployment Type (Radio)
        ├── 05-AccessModes.tsx    ← Access Modes (Checkboxes)
        ├── 05-Database.tsx       ← Database Mode + Fields (Rich)
        ├── 06-MachineRole.tsx    ← Machine Role (Radio cards)
        ├── 07-Connectivity.tsx   ← Connectivity Mode (Radio cards + Summary)
        ├── 06-Organization.tsx
        ├── 07-FirstUser.tsx
        ├── 08-Services.tsx       ← يحفظ configVersion:3 مع الحقول الخمسة
        ├── 09-HealthCheck.tsx
        └── 10-Complete.tsx
```

---

## ثامناً: قابلية التوسع للمستقبل

| الميزة المستقبلية | البُعد المرتبط | مستوى الجهد |
|------------------|---------------|:-----------:|
| Branch Sync | MachineRole=branch + ConnectivityMode | متوسط |
| Offline Sync | AccessMode=offline + ConnectivityMode=offline-first | متوسط |
| Cloud DB | DatabaseMode=cloud | منخفض (واجهة) + مرتفع (backend) |
| Remote DB Support | DatabaseMode=remote | ✅ جاهز الآن |
| Mobile App | MachineRole=mobile-workstation | محجوز |
| SaaS | DeploymentType=cloud | مرتفع |
| Multi-Tenant | تغيير DB schema | مرتفع |
| Remote Management | ConnectivityMode أي + API | متوسط |

---

## تاسعاً: القوانين غير القابلة للكسر

```
1. كل بُعد من الخمسة مستقل تماماً — لا تشابك في المنطق
2. DeploymentOrchestrator يحسب البنية التحتية فقط (DeploymentType + AccessModes)
3. ConfigManager هو المرجع الوحيد للقراءة والكتابة والترحيل
4. configVersion يرتفع دائماً عند إضافة حقول — لا تراجع
5. الترحيل دائماً لأمام فقط (v1→v2→v3) ويستنتج القيم الافتراضية بذكاء
6. legacy fields محتفظ بها للقراءة فقط — لا منطق جديد عليها
```

---

*configVersion: 3 | معمارية خماسية الأبعاد | 2026-07-01*
