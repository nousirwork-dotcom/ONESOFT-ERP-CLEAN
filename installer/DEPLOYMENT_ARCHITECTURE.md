# OneSoft ERP — معمارية النشر الشاملة
# Deployment Architecture — 10-Year Scalability Review

---

## 1. المبدأ الأساسي: الفصل الكامل بين الطبقات

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OneSoft Installer Architecture                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   PRESENTATION LAYER (قابلة للاستبدال كلياً)                               │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                  │
│   │  Electron UI  │  │  Web Wizard   │  │  CLI / Batch  │                  │
│   │  (الحالي)     │  │  (مستقبلاً)  │  │  (للـ MSI)    │                  │
│   └───────┬───────┘  └───────┬───────┘  └───────┬───────┘                  │
│           │                  │                  │                           │
│   ─────── IPC Adapter Layer ─────────────────────────────────────           │
│   ┌───────────────────────────────────────────────────────────┐             │
│   │  interface IpcAdapter { emit, invoke, on }               │             │
│   │  ElectronIpcAdapter │ HttpIpcAdapter │ CliIpcAdapter      │             │
│   └───────────────────────────────┬───────────────────────────┘             │
│                                   │                                         │
│   ─────── INSTALLER CORE (ثابت — لا يتغير) ─────────────────────           │
│   ┌─────────────────┐ ┌──────────────────┐ ┌──────────────────┐            │
│   │  Requirements   │ │  Database Engine │ │  Service Engine  │            │
│   │  Engine         │ │  (pg only)       │ │  (NSSM/sc)       │            │
│   └─────────────────┘ └──────────────────┘ └──────────────────┘            │
│   ┌─────────────────┐ ┌──────────────────┐ ┌──────────────────┐            │
│   │  Deployment     │ │  Config Engine   │ │  Health Engine   │            │
│   │  Orchestrator   │ │  (JSON+Schema)   │ │                  │            │
│   └─────────────────┘ └──────────────────┘ └──────────────────┘            │
│                                                                             │
│   ─────── DATA LAYER ────────────────────────────────────────────           │
│   ┌────────────────────────────────────────────────────────────┐            │
│   │  C:\ProgramData\OneSoft\                                   │            │
│   │  ├── config\onesoft.config.json  (الإعدادات الكاملة)      │            │
│   │  ├── version.json                (سجل الإصدار)            │            │
│   │  ├── deployments\               (خطط النشر المحفوظة)       │            │
│   │  ├── backups\                   (النسخ الاحتياطية)         │            │
│   │  ├── logs\                      (سجلات النظام)             │            │
│   │  └── licenses\                  (ملفات الترخيص)           │            │
│   └────────────────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. سيناريوهات النشر الست — خريطة كاملة

```
InstallMode (موسّع)
├── standalone          ← نسخة مستقلة لجهاز واحد (offline)
├── server-only         ← سيرفر رئيسي بدون واجهة محلية
├── client-only         ← عميل يتصل بسيرفر بعيد
├── server+client       ← سيرفر + عميل على نفس الجهاز
├── branch              ← فرع يتصل بسيرفر رئيسي
├── hybrid-cloud        ← محلي مع مزامنة سحابية
└── cloud-only          ← SaaS كامل (بدون تثبيت محلي)

RunMode (موسّع)
├── desktop             ← تطبيق Electron محلي
├── web                 ← متصفح فقط
└── desktop+web         ← الاثنان معاً
```

### ما يُثبَّت في كل وضع:

| المكوّن           | standalone | server-only | client-only | server+client | branch |
|-------------------|:---------:|:-----------:|:-----------:|:-------------:|:------:|
| PostgreSQL        | ✅        | ✅          | ❌          | ✅            | ✅ (optional) |
| Backend Service   | ✅        | ✅          | ❌          | ✅            | ✅     |
| Frontend Service  | ✅        | ❌          | ✅          | ✅            | ✅     |
| Migrations        | ✅        | ✅          | ❌          | ✅            | ✅     |
| Account Seeder    | ✅        | ✅          | ❌          | ✅            | ❌ (يرث من الرئيسي) |
| Desktop Shortcut  | ✅        | ❌          | ✅          | ✅            | ✅     |

---

## 3. المعمارية الحالية — نقاط القوة

### ✅ ما هو ممتاز ولا يحتاج تغيير:

1. **فصل Core عن Electron** — `installer/core/` لا يستورد من Electron أبداً
2. **IPC كجسر** — `installer/electron/ipc/` هو الوحيد الذي يعرف Electron
3. **أنواع مركزية** — `types.ts` مرجع واحد للجميع
4. **MigrationRunner مستقل** — يعمل بـ pg مباشرةً بدون drizzle-kit
5. **AccountSeeder مستقل** — بيانات مُضمّنة، لا اعتماد على dev tools
6. **HealthChecker منفصل** — 6 فحوصات مستقلة
7. **ConfigManager** — JSON + schema validation

---

## 4. الثغرات الحالية والحلول

### ثغرة 1: IPC مُربوط بـ Electron مباشرةً

**المشكلة الحالية:**
```typescript
// كل ipc handler يستورد من Electron مباشرةً
import { ipcMain } from 'electron'; // ← مشكلة
```

**الحل — Abstract IPC Adapter:**
```typescript
// installer/core/ipc/IpcAdapter.ts
export interface IpcAdapter {
  handle(channel: string, fn: (...args: unknown[]) => Promise<unknown>): void;
  emit(window: unknown, channel: string, data: unknown): void;
  on(channel: string, fn: (...args: unknown[]) => void): void;
}
// يُنفَّذ بـ ElectronIpcAdapter أو HttpIpcAdapter أو CliIpcAdapter
```

### ثغرة 2: عدم وجود DeploymentOrchestrator

**الحل:**
```
installer/core/deployment/
├── DeploymentOrchestrator.ts   ← يُنسّق كل خطوات النشر حسب InstallMode
├── DeploymentPlan.ts           ← يُحدّد ما يُثبَّت في كل وضع
└── plans/
    ├── standalone.plan.ts
    ├── server-only.plan.ts
    ├── client-only.plan.ts
    ├── branch.plan.ts
    └── hybrid-cloud.plan.ts
```

### ثغرة 3: لا يوجد ChangeMode (تحويل وضع التثبيت)

يحتاج إضافة:
```
installer/core/change/
├── ChangeModeManager.ts   ← تغيير InstallMode بدون إعادة تثبيت
└── ComponentManager.ts    ← إضافة/إزالة مكونات
```

### ثغرة 4: لا يوجد DatabaseMigrationManager (نقل DB)

يحتاج إضافة:
```
installer/core/database/
└── DatabaseMigrator.ts   ← نقل قاعدة البيانات إلى جهاز آخر
```

### ثغرة 5: لا يوجد شاشة Deployment Settings

يحتاج إضافة:
```
installer/ui/settings/
├── DeploymentSettings.tsx    ← شاشة الإعدادات الرئيسية
├── tabs/
│   ├── ServerSettings.tsx   ← إعدادات السيرفر
│   ├── DatabaseSettings.tsx ← إعدادات قاعدة البيانات
│   ├── BackupSettings.tsx   ← جدول النسخ الاحتياطية
│   ├── UpdateSettings.tsx   ← إعدادات التحديثات
│   └── LicenseSettings.tsx  ← إدارة الترخيص
```

---

## 5. خريطة الطريق — 10 سنوات

### v1.0 (الحالي) — MVP ✅
- [x] التثبيت الكامل (standalone + server+client)
- [x] Upgrade + Rollback
- [x] Uninstall
- [x] Health Check
- [x] Windows Services

### v1.1 (التالي) — Server/Client/Branch
- [ ] إضافة `server-only` و `client-only` و `branch` كـ InstallMode
- [ ] DeploymentOrchestrator
- [ ] تغيير عنوان السيرفر (ChangeEndpoint)

### v1.2 — Change & Repair
- [ ] Repair Installation
- [ ] Change Installation (إضافة/إزالة مكونات)
- [ ] نقل قاعدة البيانات
- [ ] تحويل وضع التثبيت (ChangeMode)

### v1.3 — Deployment Settings UI
- [ ] شاشة إعدادات Deployment كاملة
- [ ] إدارة الترخيص
- [ ] جدولة النسخ الاحتياطية

### v2.0 — Multi-UI Shell
- [ ] IpcAdapter مجرّد
- [ ] Web Wizard (بدون Electron)
- [ ] CLI Mode للتثبيت الصامت

### v3.0 — Cloud & Enterprise
- [ ] Auto-Update Server
- [ ] Centralized License Server
- [ ] Multi-tenant deployment

---

## 6. نموذج Config الموسّع (v2)

```jsonc
{
  "version": "1.0.0",
  "configVersion": 2,
  "installMode": "branch",          // standalone|server-only|client-only|server+client|branch|hybrid-cloud|cloud-only
  "runMode": "desktop+web",         // desktop|web|desktop+web
  "components": {                   // المكونات المثبّتة
    "database":  true,
    "backend":   true,
    "frontend":  true,
    "updater":   true,
    "backup":    true
  },
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "onesoft_erp",
    "user": "postgres",
    "password": "***",
    "poolMin": 2,
    "poolMax": 10
  },
  "remoteServer": {                 // للـ client-only و branch
    "enabled": false,
    "apiUrl": null,
    "apiKey": null,
    "syncMode": "realtime"          // realtime|scheduled|manual
  },
  "server": {
    "backendPort": 3000,
    "frontendPort": 5000,
    "host": "0.0.0.0",
    "allowedOrigins": ["http://localhost:5000"]
  },
  "backup": {
    "enabled": true,
    "schedule": "0 2 * * *",
    "retentionDays": 30,
    "path": "C:\\ProgramData\\OneSoft\\Backups",
    "compress": true,
    "includeAttachments": true,
    "remoteEnabled": false,
    "remoteUrl": null
  },
  "update": {
    "autoCheck": true,
    "autoInstall": false,
    "channel": "stable",
    "updateServerUrl": "https://updates.onesoft.app",
    "checkInterval": 86400
  },
  "license": {
    "key": null,
    "type": "trial",
    "expiresAt": null,
    "maxUsers": 5,
    "activatedAt": null,
    "offlineGrace": 30
  }
}
```

---

## 7. قاعدة التوافق للمستقبل

### قانون 1: Core لا يعرف Electron
لا يجوز أي import من `electron` داخل `installer/core/**`

### قانون 2: Business Logic في Core فقط
كل قرار يتعلق بالتثبيت/الترقية/الإزالة يكون في Core — IPC مجرد ناقل للأحداث

### قانون 3: config.json هو مصدر الحقيقة الوحيد
كل مكون يقرأ حالته من `onesoft.config.json` — لا hardcoded values

### قانون 4: كل خطوة قابلة للإعادة (Idempotent)
تشغيل أي خطوة تثبيت مرتين يُعطي نفس النتيجة — `ON CONFLICT DO NOTHING`

### قانون 5: Emit-based Progress
كل عملية طويلة تُصدر `ProgressEvent` — لا polling من الـ UI
