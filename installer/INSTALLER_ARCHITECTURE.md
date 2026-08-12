# OneSoft ERP — Installer Architecture
# الوثيقة المعمارية النهائية لنظام التثبيت

**الإصدار:** 1.0  
**التاريخ:** 2026-07-01  
**الحالة:** معتمدة — مرجع نهائي لجميع مراحل التطوير

---

## المبدأ التوجيهي

> منطق التثبيت مستقل تماماً عن واجهته.
> Electron (أو أي تقنية أخرى) هي مجرد shell لعرض Installer Core.
> يمكن استبدال الواجهة في أي وقت دون لمس منطق التثبيت.

---

## دورة حياة النظام الكاملة

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ONESOFT SYSTEM LIFECYCLE                          │
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────────┤
│ INSTALL  │  CONFIG  │  RUN     │ UPGRADE  │ BACKUP   │  UNINSTALL  │
│          │          │          │          │          │             │
│ Wizard   │ Config   │ Services │ Upgrade  │ Backup   │ Clean       │
│ Steps    │ Manager  │ Running  │ Wizard   │ Manager  │ Uninstall   │
│ 1→9      │ Unified  │          │ + Roll-  │ + Re-    │             │
│          │ Config   │ Health   │ back     │ store    │             │
│          │          │ Monitor  │          │          │             │
└──────────┴──────────┴──────────┴──────────┴──────────┴─────────────┘
            ▲                              ▲
            │      OneSoft Deployment      │
            └──────────  Manager  ──────────┘
                   (مركز الإدارة الدائم)
```

---

## القرارات المعمارية الأساسية

| القرار | الاختيار | السبب |
|--------|----------|-------|
| UI Shell | Electron | نفس تقنية المشروع، حزمة واحدة |
| Core Language | TypeScript (Node.js) | مشترك مع المشروع |
| DB | PostgreSQL 16 | المعتمد في المشروع |
| Windows Services | NSSM | مجاني، موثوق، CLI كامل |
| Config Format | JSON + .env | قابل للقراءة والتعديل |
| IPC | Electron contextBridge | أمان كامل |
| State Management | Zustand | خفيف، TypeScript-first |
| Installer Package | electron-builder | `.exe` واحد غير موقّع |

---

## البنية الكاملة للمجلدات

```
installer/
│
├── core/                              ★ INSTALLER CORE (مستقل عن الواجهة)
│   ├── index.ts                       # Public API للـ Core
│   ├── types.ts                       # جميع الأنواع المشتركة
│   │
│   ├── requirements/
│   │   ├── RequirementChecker.ts      # منسق فحص المتطلبات
│   │   ├── checks/
│   │   │   ├── WindowsVersionCheck.ts
│   │   │   ├── AdminPrivilegeCheck.ts
│   │   │   ├── DiskSpaceCheck.ts
│   │   │   ├── MemoryCheck.ts
│   │   │   ├── NodeJsCheck.ts
│   │   │   ├── PostgreSQLCheck.ts
│   │   │   ├── PortsCheck.ts
│   │   │   └── PreviousVersionCheck.ts
│   │   └── fixers/
│   │       ├── NodeJsFixer.ts         # تثبيت Node.js تلقائياً
│   │       └── PostgreSQLFixer.ts     # تثبيت PostgreSQL تلقائياً
│   │
│   ├── database/
│   │   ├── DatabaseInstaller.ts       # تثبيت + إنشاء DB
│   │   ├── MigrationRunner.ts         # تشغيل Migrations
│   │   ├── ConnectionTester.ts        # اختبار الاتصال
│   │   └── DatabaseMover.ts           # نقل قاعدة البيانات
│   │
│   ├── setup/
│   │   ├── OrganizationCreator.ts     # إنشاء المؤسسة الأولى
│   │   ├── UserCreator.ts             # إنشاء المستخدم الأول
│   │   └── AccountSeeder.ts           # تثبيت شجرة الحسابات
│   │
│   ├── services/
│   │   ├── ServiceManager.ts          # إدارة Windows Services (NSSM)
│   │   ├── definitions/
│   │   │   ├── ServerService.ts       # OneSoft-Server
│   │   │   ├── ClientService.ts       # OneSoft-Client
│   │   │   ├── UpdaterService.ts      # OneSoft-Updater
│   │   │   └── BackupService.ts       # OneSoft-Backup
│   │   └── ServiceHealthChecker.ts
│   │
│   ├── filesystem/
│   │   ├── DirectoryCreator.ts        # إنشاء مجلدات النظام
│   │   ├── ShortcutCreator.ts         # اختصارات سطح المكتب
│   │   └── FilePermissions.ts         # صلاحيات الملفات
│   │
│   ├── config/
│   │   ├── ConfigManager.ts           ★ مدير الإعدادات الموحد
│   │   ├── ConfigValidator.ts
│   │   ├── ConfigMigrator.ts          # ترقية الإعدادات بين الإصدارات
│   │   └── schemas/
│   │       ├── DatabaseConfig.ts
│   │       ├── ServerConfig.ts
│   │       ├── CloudConfig.ts
│   │       ├── BackupConfig.ts
│   │       ├── UpdateConfig.ts
│   │       ├── PrintingConfig.ts
│   │       └── LicenseConfig.ts
│   │
│   ├── health/
│   │   ├── HealthChecker.ts           ★ فاحص الصحة الشامل
│   │   └── checks/
│   │       ├── PostgreSQLHealthCheck.ts
│   │       ├── BackendHealthCheck.ts
│   │       ├── FrontendHealthCheck.ts
│   │       ├── DatabaseConnectionCheck.ts
│   │       ├── PortsHealthCheck.ts
│   │       ├── PrintingHealthCheck.ts
│   │       └── UpdateServiceCheck.ts
│   │
│   ├── upgrade/
│   │   ├── UpgradeManager.ts          ★ مدير الترقية الكامل
│   │   ├── VersionDetector.ts         # اكتشاف النسخة الحالية
│   │   ├── BackupBeforeUpgrade.ts     # نسخ احتياطي قبل التحديث
│   │   ├── UpgradeMigrator.ts         # تشغيل Migrations التحديث
│   │   └── RollbackManager.ts         # التراجع عند الفشل
│   │
│   ├── backup/
│   │   ├── BackupManager.ts           # مدير النسخ الاحتياطية
│   │   ├── RestoreManager.ts          # الاستعادة من نسخة احتياطية
│   │   └── BackupScheduler.ts         # جدولة النسخ التلقائية
│   │
│   └── uninstall/
│       ├── UninstallManager.ts        # إزالة كاملة ونظيفة
│       ├── ServiceRemover.ts
│       ├── DataCleaner.ts
│       └── RegistryClean.ts
│
├── electron/                          # Electron Shell (واجهة فقط)
│   ├── main.ts                        # نقطة دخول Electron
│   ├── preload.ts                     # contextBridge آمن
│   ├── window.ts                      # إعدادات نافذة التثبيت
│   └── ipc/                           # جسر بين UI و Core
│       ├── requirements.ipc.ts
│       ├── database.ipc.ts
│       ├── services.ipc.ts
│       ├── health.ipc.ts
│       ├── upgrade.ipc.ts
│       └── config.ipc.ts
│
├── ui/                                # React Wizard UI
│   ├── App.tsx
│   ├── store/
│   │   └── installer.store.ts         # Zustand state
│   ├── components/
│   │   ├── WizardShell.tsx            # الهيكل العام للمعالج
│   │   ├── StepIndicator.tsx
│   │   ├── RequirementRow.tsx
│   │   ├── ProgressLog.tsx
│   │   └── HealthCheckRow.tsx
│   └── steps/
│       ├── 01-Welcome.tsx
│       ├── 02-License.tsx
│       ├── 03-Requirements.tsx
│       ├── 04-InstallType.tsx
│       ├── 05-Database.tsx
│       ├── 06-Organization.tsx
│       ├── 07-FirstUser.tsx
│       ├── 08-Services.tsx
│       ├── 09-HealthCheck.tsx
│       └── 10-Complete.tsx
│
├── deployment-manager/                ★ OneSoft Deployment Manager
│   ├── electron/
│   │   ├── main.ts
│   │   └── preload.ts
│   └── ui/
│       ├── App.tsx
│       └── panels/
│           ├── ServicesPanel.tsx      # إدارة الخدمات
│           ├── RunModePanel.tsx       # Desktop/Web/Hybrid
│           ├── CloudPanel.tsx         # ربط/فصل السحابة
│           ├── DatabasePanel.tsx      # نقل قاعدة البيانات
│           ├── BackupPanel.tsx        # النسخ الاحتياطية
│           ├── HealthPanel.tsx        # مراقبة الصحة
│           ├── UpgradePanel.tsx       # ترقية النظام
│           └── LicensePanel.tsx       # إدارة الترخيص
│
├── scripts/                           # PowerShell Scripts
│   ├── install-postgresql.ps1
│   ├── install-nssm.ps1
│   ├── create-service.ps1
│   ├── remove-service.ps1
│   ├── check-ports.ps1
│   └── check-admin.ps1
│
├── resources/
│   ├── bin/
│   │   └── nssm.exe                   # مُضمَّن في الحزمة
│   ├── icons/
│   │   ├── onesoft.ico
│   │   └── onesoft-512.png
│   └── LICENSE.txt
│
├── package.json
├── vite.config.ts
└── electron-builder.config.ts
```

---

## أوضاع التثبيت الخمسة

```
┌──────────────────┬──────────────────────────────────────────────────────┐
│ وضع التثبيت     │ الوصف                                                │
├──────────────────┼──────────────────────────────────────────────────────┤
│ Single User      │ جهاز واحد، PostgreSQL محلي، Backend + Frontend محلي  │
│                  │ مثالي للمكاتب الصغيرة                               │
├──────────────────┼──────────────────────────────────────────────────────┤
│ Multi User (LAN) │ سيرفر مركزي في الشبكة، العملاء يتصلون عبر LAN       │
│                  │ Backend + DB على السيرفر، UI على كل جهاز أو Browser  │
├──────────────────┼──────────────────────────────────────────────────────┤
│ Branch Server    │ سيرفر رئيسي + سيرفرات فروع، مزامنة دورية            │
│                  │ كل فرع يعمل باستقلالية ويتزامن مع المركز             │
├──────────────────┼──────────────────────────────────────────────────────┤
│ Hybrid Cloud     │ DB ومنطق الأعمال محلي، نسخ احتياطي وتقارير في السحابة│
│                  │ يعمل بدون إنترنت ويتزامن عند الاتصال                │
├──────────────────┼──────────────────────────────────────────────────────┤
│ Cloud Only       │ كل شيء في السحابة، يُستخدم البراوزر فقط             │
│                  │ SaaS mode كامل                                        │
└──────────────────┴──────────────────────────────────────────────────────┘
```

---

## أوضاع التشغيل الثلاثة

```
┌──────────────────┬──────────────────────────────────────────────────────┐
│ وضع التشغيل     │ التفاصيل                                             │
├──────────────────┼──────────────────────────────────────────────────────┤
│ Desktop          │ Electron app محلي، يعمل بدون براوزر                  │
│                  │ OneSoft-Client service يخدم Electron window           │
├──────────────────┼──────────────────────────────────────────────────────┤
│ Web              │ الوصول عبر البراوزر فقط، OneSoft-Client service       │
│                  │ يخدم على منفذ محدد قابل للضبط                        │
├──────────────────┼──────────────────────────────────────────────────────┤
│ Desktop + Web    │ كلاهما معاً، Electron app + Web access               │
│ (Hybrid)         │ يمكن التحويل بينهما من Deployment Manager            │
└──────────────────┴──────────────────────────────────────────────────────┘
```

---

## Configuration Manager الموحد

ملف الإعدادات: `C:\ProgramData\OneSoft\config\onesoft.config.json`

```jsonc
{
  "version": "1.0",
  "installType": "single-user",
  "runMode": "desktop+web",

  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "onesoft_erp",
    "user": "onesoft_app",
    "poolMin": 2,
    "poolMax": 10
  },

  "server": {
    "backendPort": 3000,
    "frontendPort": 5000,
    "host": "0.0.0.0",
    "allowedOrigins": ["localhost", "192.168.1.*"]
  },

  "cloud": {
    "enabled": false,
    "provider": null,
    "syncInterval": 3600,
    "endpoint": null
  },

  "backup": {
    "enabled": true,
    "schedule": "0 2 * * *",
    "retentionDays": 30,
    "path": "C:\\ProgramData\\OneSoft\\Backups",
    "compress": true,
    "includeAttachments": true
  },

  "update": {
    "autoCheck": true,
    "channel": "stable",
    "updateServerUrl": "https://updates.onesoft.app",
    "checkInterval": 86400
  },

  "printing": {
    "defaultPrinter": null,
    "pdfOutputPath": "C:\\ProgramData\\OneSoft\\Exports"
  },

  "license": {
    "key": null,
    "type": "trial",
    "expiresAt": null,
    "maxUsers": 1,
    "activatedAt": null
  },

  "paths": {
    "data":        "C:\\ProgramData\\OneSoft\\Data",
    "backups":     "C:\\ProgramData\\OneSoft\\Backups",
    "logs":        "C:\\ProgramData\\OneSoft\\Logs",
    "temp":        "C:\\ProgramData\\OneSoft\\Temp",
    "updates":     "C:\\ProgramData\\OneSoft\\Updates",
    "attachments": "C:\\ProgramData\\OneSoft\\Attachments",
    "exports":     "C:\\ProgramData\\OneSoft\\Exports"
  }
}
```

---

## مراحل التثبيت التفصيلية (Setup Wizard)

### المرحلة 1 — Welcome
- شعار OneSoft + نسخة المثبت
- زر: **بدء التثبيت** / **الترقية** (حسب اكتشاف نسخة سابقة)
- رابط: سياسة الخصوصية

### المرحلة 2 — License Agreement
- عرض نص الرخصة
- Checkbox: أوافق على الشروط
- لا يمكن المتابعة بدون الموافقة

### المرحلة 3 — Requirements Check
```
يُشغّل تلقائياً ويعرض جدول النتائج:

✅ Windows 10/11 (64-bit)
✅ Administrator Privileges
✅ Disk Space: 3.2GB متاح من أصل 2GB مطلوب
✅ RAM: 8GB من أصل 4GB مطلوب
❌ Node.js — غير موجود    [تثبيت تلقائي]
❌ PostgreSQL 16 — غير موجود  [تثبيت تلقائي]
✅ Port 3000 — متاح
✅ Port 5000 — متاح
✅ لا يوجد إصدار سابق

[تثبيت المتطلبات الناقصة] ← زر واحد يثبّت الكل
```

### المرحلة 4 — Installation Type
```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Single User  ★  │  │   Multi User     │  │  Branch Server   │
│  (موصى به)       │  │     (LAN)        │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
┌──────────────────┐  ┌──────────────────┐
│  Hybrid Cloud    │  │   Cloud Only     │
└──────────────────┘  └──────────────────┘

ثم: اختيار وضع التشغيل
○ Desktop فقط
○ Web فقط
● Desktop + Web (موصى به)
```

### المرحلة 5 — Database Setup
```
○ تثبيت PostgreSQL جديد (موصى به)
● استخدام PostgreSQL موجود
  - Host: [localhost]
  - Port: [5432]
  - Admin User: [postgres]
  - Password: [●●●●●●●]
  [اختبار الاتصال] → ✅ ناجح

اسم قاعدة البيانات: [onesoft_erp]
مستخدم النظام:      [onesoft_app] (يُنشأ تلقائياً)
```

### المرحلة 6 — Organization Setup
```
اسم المؤسسة (عربي):  [                    ]
اسم المؤسسة (إنجليزي): [                 ]
الدولة:    [المملكة العربية السعودية ▼]
العملة:    [SAR — ريال سعودي ▼]
اللغة:     [عربي ▼]
المنطقة الزمنية: [Asia/Riyadh ▼]
الرقم الضريبي (اختياري): [                ]
```

### المرحلة 7 — First User
```
الاسم الكامل:   [                    ]
اسم الدخول:     [admin               ]
كلمة المرور:    [●●●●●●●●●●●●        ]
تأكيد كلمة المرور: [●●●●●●●●●●●●    ]

الصلاحية: Super Admin (ثابت للمستخدم الأول)
```

### المرحلة 8 — Services Installation
```
جارٍ تثبيت الخدمات...

✅ إنشاء مجلدات النظام
✅ نسخ ملفات التطبيق
✅ تشغيل Database Migrations (v0001 → v0012)
✅ إنشاء المؤسسة الأولى
✅ إنشاء المستخدم الإداري
✅ تثبيت شجرة الحسابات الافتراضية
✅ تسجيل OneSoft-Server Service
✅ تسجيل OneSoft-Client Service
✅ تسجيل OneSoft-Updater Service
✅ إنشاء اختصار سطح المكتب
✅ إنشاء اختصار قائمة Start
⏳ تشغيل الخدمات...
```

### المرحلة 9 — Health Check
```
التحقق من صحة النظام بعد التثبيت...

✅ PostgreSQL — يعمل (v16.2) — استجابة: 12ms
✅ Backend Server — يعمل على :3000 — استجابة: 45ms
✅ Frontend Server — يعمل على :5000 — استجابة: 38ms
✅ Database Connection — ناجح — onesoft_erp
✅ Port 3000 — مفتوح
✅ Port 5000 — مفتوح
✅ OneSoft-Server Service — Running
✅ OneSoft-Client Service — Running
✅ OneSoft-Updater Service — Running
⚠️ Printing Service — لم يُضبط بعد (اختياري)

النتيجة: 8/9 فحص ناجح ✅
```

### المرحلة 10 — Complete
```
✅ تم تثبيت OneSoft ERP بنجاح!

معلومات الدخول:
  العنوان: http://localhost:5000
  المستخدم: admin
  كلمة المرور: (التي اخترتها)

[تشغيل OneSoft الآن]  [فتح Deployment Manager]  [إغلاق]
```

---

## Upgrade Wizard (ترقية احترافية)

```
[1] اكتشاف النسخة الحالية
    VersionDetector.ts يقرأ: C:\ProgramData\OneSoft\version.json
    المثال: { "version": "1.0.0", "installedAt": "2026-07-01" }

[2] مقارنة مع النسخة الجديدة
    إذا كانت النسخة الجديدة أحدث → إكمال الترقية
    إذا كانت أقدم → منع الرجوع للخلف (Downgrade محظور)

[3] نسخة احتياطية إلزامية قبل الترقية
    BackupBeforeUpgrade.ts:
    - dump قاعدة البيانات الكاملة
    - ضغط ملفات الإعدادات
    - حفظ في: C:\ProgramData\OneSoft\Backups\pre-upgrade-{version}-{date}.zip

[4] إيقاف الخدمات
    ServiceManager.stop(['OneSoft-Server', 'OneSoft-Client'])

[5] نسخ ملفات التطبيق الجديدة

[6] تشغيل Migrations الجديدة
    UpgradeMigrator.ts يشغّل فقط الـ migrations الجديدة

[7] ترقية الإعدادات
    ConfigMigrator.ts يحدّث onesoft.config.json للصيغة الجديدة

[8] تشغيل الخدمات

[9] Health Check — التحقق من نجاح الترقية

[ROLLBACK — إذا فشل أي خطوة]
    RollbackManager.ts:
    - إيقاف الخدمات
    - استعادة ملفات النسخة السابقة
    - استعادة قاعدة البيانات من النسخة الاحتياطية
    - تشغيل الخدمات
    - إشعار المستخدم بفشل الترقية وسبب الفشل
```

---

## OneSoft Deployment Manager

تطبيق مستقل يُثبَّت مع النظام ويمكن تشغيله في أي وقت من قائمة Start.

```
┌─────────────────────────────────────────────────────────────────┐
│  🔧 OneSoft Deployment Manager                    v1.0.0  ✅   │
├─────────────┬───────────────────────────────────────────────────┤
│             │                                                     │
│ ● Services  │  ┌─ Services Status ───────────────────────────┐  │
│ ○ Run Mode  │  │  OneSoft-Server  ● Running  [Stop] [Restart]│  │
│ ○ Cloud     │  │  OneSoft-Client  ● Running  [Stop] [Restart]│  │
│ ○ Database  │  │  OneSoft-Updater ● Running  [Stop] [Restart]│  │
│ ○ Backup    │  │  OneSoft-Backup  ○ Stopped  [Start]         │  │
│ ○ Health    │  └─────────────────────────────────────────────┘  │
│ ○ Upgrade   │                                                     │
│ ○ License   │  ┌─ Quick Actions ─────────────────────────────┐  │
│             │  │  [إعادة تشغيل الكل]  [فتح التطبيق]          │  │
│             │  │  [فتح Logs]          [Health Check]          │  │
│             │  └─────────────────────────────────────────────┘  │
└─────────────┴───────────────────────────────────────────────────┘
```

### لوحات Deployment Manager

| اللوحة | الوظيفة |
|--------|---------|
| Services | تشغيل/إيقاف/إعادة تشغيل الخدمات، عرض الحالة |
| Run Mode | تغيير بين Desktop / Web / Hybrid بدون كود |
| Cloud | ربط/فصل السحابة، ضبط Sync، حالة الاتصال |
| Database | نقل DB، تغيير إعدادات الاتصال، اختبار الاتصال |
| Backup | نسخ فوري، جدول النسخ، استعادة من نسخة |
| Health | فحص شامل للنظام عند الطلب أو تلقائياً |
| Upgrade | البحث عن تحديثات، تشغيل Upgrade Wizard |
| License | إدخال مفتاح الترخيص، عرض معلومات الاشتراك |

---

## Backup & Restore

```
أنواع النسخ الاحتياطية:
┌────────────────┬─────────────────────────────────────────────┐
│ النوع          │ ما يتضمنه                                    │
├────────────────┼─────────────────────────────────────────────┤
│ Full Backup    │ DB كاملة + الإعدادات + المرفقات             │
│ DB Only        │ dump قاعدة البيانات فقط                      │
│ Config Only    │ ملفات الإعدادات فقط                          │
│ Pre-Upgrade    │ تلقائي قبل أي ترقية (لا يُحذف تلقائياً)     │
└────────────────┴─────────────────────────────────────────────┘

تنسيق ملف النسخ: onesoft-backup-{type}-{version}-{YYYYMMDD-HHmm}.zip

مسار النسخ: C:\ProgramData\OneSoft\Backups\

الاحتفاظ الافتراضي: 30 يوم (قابل للتغيير)
```

---

## Uninstall (إزالة نظيفة)

```
[1] تأكيد الإزالة + تحذير فقدان البيانات
[2] خيار: حفظ نسخة احتياطية نهائية
[3] إيقاف وإزالة جميع Windows Services
[4] حذف ملفات التطبيق
[5] خيار: حذف قاعدة البيانات (تحذير منفصل)
[6] خيار: الاحتفاظ بالبيانات في C:\ProgramData\OneSoft\
[7] حذف الاختصارات
[8] تنظيف Registry entries
[9] رسالة إتمام الإزالة
```

---

## Windows Services (NSSM)

```
اسم الخدمة       المسار                          التبعية
─────────────     ─────────────────────────────   ──────────────
OneSoft-Server    node server-app\dist\index.js   PostgreSQL
OneSoft-Client    node client-app\dist-serve\...  OneSoft-Server
OneSoft-Updater   node installer\core\\updater.js  -
OneSoft-Backup    node installer\core\backup.js   OneSoft-Server

إعدادات مشتركة:
  StartType: Automatic
  RestartDelay: 5000ms
  LogPath: C:\ProgramData\OneSoft\Logs\{service}.log
```

---

## مجلدات النظام

```
C:\ProgramData\OneSoft\
├── Data\           # بيانات التطبيق الداخلية
├── Backups\        # النسخ الاحتياطية
├── Logs\           # سجلات الخدمات
├── Temp\           # ملفات مؤقتة
├── Updates\        # حزم التحديثات المحملة
├── Attachments\    # مرفقات المستندات
├── Exports\        # ملفات PDF والتقارير
└── config\
    └── onesoft.config.json

C:\Program Files\OneSoft ERP\
├── server-app\     # Backend
├── client-app\     # Frontend
├── installer\      # Core + Deployment Manager
└── bin\
    └── nssm.exe
```

---

## مراحل التنفيذ

```
المرحلة 1 — الأساس (الأولوية الأولى)
──────────────────────────────────────
□ Installer Core skeleton (types + interfaces)
□ RequirementChecker (جميع الفحوصات)
□ NodeJsFixer + PostgreSQLFixer
□ DatabaseInstaller + MigrationRunner
□ OrganizationCreator + UserCreator + AccountSeeder
□ ConfigManager (قراءة/كتابة onesoft.config.json)
□ ServiceManager (NSSM wrapper)
□ DirectoryCreator + ShortcutCreator
□ HealthChecker (جميع الفحوصات)
□ Electron Shell + IPC
□ Wizard UI (10 خطوات)
□ electron-builder (حزمة .exe)

المرحلة 2 — الترقية والإدارة
──────────────────────────────
□ VersionDetector
□ BackupBeforeUpgrade
□ UpgradeMigrator + RollbackManager
□ Deployment Manager UI
□ BackupManager + RestoreManager

المرحلة 3 — المتقدم
────────────────────
□ BackupScheduler (مهمة تلقائية)
□ UpdaterService (فحص تحديثات)
□ CloudManager (Hybrid/Cloud modes)
□ LicenseManager
□ Branch Server sync
□ Silent Install mode (للنشر المؤسسي)
□ UninstallManager
```

---

## ملاحظات التنفيذ المهمة

1. **فصل المخاوف صارم:** كل ما هو في `core/` يعمل بدون Electron — اختباره بـ CLI أولاً
2. **كل عملية طويلة تُرسل تقدمها عبر IPC** حتى لا تتجمد الواجهة
3. **NSSM مُضمَّن** في `resources/bin/nssm.exe` — لا يُثبَّت منفصلاً
4. **Config يُقرأ دائماً من القرص** — لا يُحفظ في الذاكرة دون إعادة قراءة
5. **كل عملية تُكتب في Log** قبل وبعد التنفيذ
6. **Rollback يُختبر** قبل اعتبار الترقية ناجحة

---

*وثيقة معتمدة — أي تغيير في البنية يستلزم تحديث هذا الملف أولاً*
