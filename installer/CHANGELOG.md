# OneSoft ERP — سجل التغييرات

## v1.0.0 (2026-07-01) — الإصدار الأول

### ✨ ميزات جديدة

#### نظام التثبيت الاحترافي (Windows Installer)
- **5 أوضاع تثبيت**: Single User, Multi-User, Branch Server, Hybrid Cloud, Cloud Only
- **3 أوضاع تشغيل**: Desktop, Web, Desktop+Web
- **معالج تثبيت من 10 خطوات**: ترحيب → ترخيص → متطلبات → نوع التثبيت → قاعدة البيانات → المؤسسة → المستخدم الأول → تثبيت الخدمات → فحص الصحة → اكتمال
- تثبيت PostgreSQL تلقائياً إذا لم تكن مثبتة
- إنشاء قاعدة البيانات وتشغيل Migrations تلقائياً
- تثبيت خدمات Windows عبر NSSM مع AutoStart
- إنشاء اختصارات سطح المكتب وقائمة Start تلقائياً
- كتابة سجل Registry لـ "Add/Remove Programs"
- نظام تتبع Migrations مستقل (`__drizzle_migrations`) بدون drizzle-kit
- بذر شجرة الحسابات الافتراضية مباشرةً عبر pg

#### معالج الترقية (Upgrade Wizard)
- كشف النسخة الحالية تلقائياً
- نسخة احتياطية تلقائية لقاعدة البيانات والإعدادات قبل الترقية
- تطبيق Migrations الجديدة
- إمكانية التراجع (Rollback) عند الفشل

#### معالج الإزالة (Uninstall Wizard)
- إيقاف وإزالة خدمات Windows
- حذف الملفات والاختصارات وسجل Registry
- خيار الاحتفاظ بقاعدة البيانات أو حذفها
- حماية من SQL Injection في عمليات الحذف

#### نظام فحص الصحة (Health Check)
- 6 فحوصات: PostgreSQL، Backend، Frontend، المنافذ، الخدمات، الاتصال
- مؤشرات حالة في الوقت الفعلي

#### أمان
- لا توجد كلمات مرور مُرمَّزة في الكود
- التحقق من مدخلات shell (validateIdentifier, validateHost, validatePort)
- Parameterized queries لعمليات قاعدة البيانات
- كلمة مرور PostgreSQL إلزامية بحد أدنى 8 أحرف

### 🔧 الإصلاحات

- إصلاح مسار الموارد في electron-builder من `../server-app` إلى `app/server-app`
- إصلاح entrypoint من `index.js` إلى `index.mjs` (esbuild ESM format)
- إصلاح معالجة فشل استعلام `isFirstRun` في صفحة الدخول
- إصلاح typing `process.resourcesPath` في Core (آمن مع TS strict mode)

### 📦 التقنيات المستخدمة

| المكون | التقنية |
|--------|---------|
| Frontend | React 19 + Vite 7 + Tailwind CSS v4 |
| Backend  | Node.js 22 + tRPC v11 + Drizzle ORM |
| Database | PostgreSQL 16 |
| Installer | Electron 33 + electron-builder |
| Services | NSSM 2.24 (Windows Service Manager) |
| Language | TypeScript 5.x (Strict Mode) |

### 🖥️ متطلبات النظام

- **نظام التشغيل**: Windows 10 (1903) أو أحدث، 64-bit
- **المعالج**: Intel/AMD x64
- **الذاكرة**: 4 GB RAM (8 GB مُوصى به)
- **التخزين**: 5 GB مساحة حرة
- **الشبكة**: مطلوبة للتثبيت الأول (تنزيل PostgreSQL إذا لزم)

---

## نظام الإصدارات

`MAJOR.MINOR.PATCH`

- **MAJOR**: تغييرات جذرية غير متوافقة
- **MINOR**: ميزات جديدة متوافقة
- **PATCH**: إصلاحات أخطاء
