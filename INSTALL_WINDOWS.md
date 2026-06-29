# OneSoft ERP — دليل التثبيت على Windows
# OneSoft ERP — Windows Installation Guide

> نظام ERP محاسبي عربي | Arabic Accounting ERP System  
> يدعم: Windows 10 / 11 (64-bit)

---

## جدول المحتويات | Table of Contents

1. [المتطلبات | Requirements](#1-المتطلبات)
2. [تثبيت Node.js](#2-تثبيت-nodejs)
3. [تثبيت PostgreSQL](#3-تثبيت-postgresql)
4. [تثبيت pnpm](#4-تثبيت-pnpm)
5. [تثبيت OneSoft ERP](#5-تثبيت-onesoft-erp)
6. [إنشاء قاعدة البيانات](#6-إنشاء-قاعدة-البيانات)
7. [تشغيل البرنامج لأول مرة](#7-تشغيل-البرنامج-لأول-مرة)
8. [معالج الإعداد الأول](#8-معالج-الإعداد-الأول)
9. [تسجيل الدخول](#9-تسجيل-الدخول)
10. [إيقاف وتشغيل البرنامج](#10-إيقاف-وتشغيل-البرنامج)
11. [استكشاف الأخطاء](#11-استكشاف-الأخطاء)

---

## 1. المتطلبات

### مواصفات الجهاز الدنيا

| المتطلب | الحد الأدنى | الموصى به |
|---------|------------|----------|
| نظام التشغيل | Windows 10 (64-bit) | Windows 11 (64-bit) |
| المعالج | Intel/AMD 64-bit | Core i5 أو أحدث |
| الذاكرة RAM | 4 GB | 8 GB أو أكثر |
| مساحة القرص | 3 GB | 10 GB أو أكثر |
| الشاشة | 1280×768 | 1920×1080 |
| الاتصال بالإنترنت | مطلوب للتثبيت فقط | غير مطلوب بعد التثبيت |

### البرامج المطلوبة

| البرنامج | الإصدار | رابط التحميل |
|---------|---------|--------------|
| **Node.js** | 18.x أو أحدث (LTS) | https://nodejs.org/en/download |
| **PostgreSQL** | 14.x أو أحدث | https://www.postgresql.org/download/windows |
| **pnpm** | 8.x أو أحدث | يُثبَّت تلقائياً عبر npm |

---

## 2. تثبيت Node.js

### الخطوات:

1. افتح المتصفح واذهب إلى: **https://nodejs.org/en/download**

2. اختر **"LTS"** (النسخة المستقرة) — اضغط على **"Windows Installer (.msi) 64-bit"**

3. شغّل ملف `.msi` الذي تم تحميله

4. في معالج التثبيت:
   - اضغط **Next** في كل خطوة
   - ✅ تأكد من تحديد **"Add to PATH"** (مُحددة افتراضياً)
   - اضغط **Install**
   - اضغط **Finish**

5. تحقق من التثبيت — افتح **Command Prompt** واكتب:
   ```
   node --version
   ```
   يجب أن تظهر: `v20.x.x` أو أحدث

   ```
   npm --version
   ```
   يجب أن تظهر: `10.x.x` أو أحدث

> ⚠️ إذا لم تعمل الأوامر، أغلق Command Prompt وافتحه من جديد

---

## 3. تثبيت PostgreSQL

### الخطوات:

1. افتح المتصفح واذهب إلى: **https://www.postgresql.org/download/windows**

2. اضغط على **"Download the installer"** (زر EnterpriseDB)

3. اختر أحدث إصدار من PostgreSQL 16 أو 17 — عمود **Windows x86-64**

4. شغّل ملف `.exe` الذي تم تحميله

5. في معالج التثبيت:
   - اضغط **Next**
   - مجلد التثبيت: اتركه كما هو `C:\Program Files\PostgreSQL\16\`
   - المكوّنات: اتركها كما هي (PostgreSQL Server + pgAdmin + Command Line Tools)
   - مجلد البيانات: اتركه كما هو
   - **⚠️ كلمة مرور المستخدم postgres:** اختر كلمة مرور واحفظها — ستحتاجها لاحقاً
     - مثال: `OneSoft2024!`
   - المنفذ: اتركه `5432` (الافتراضي)
   - اللغة: اتركها `Default`
   - اضغط **Next** ثم **Install**
   - اضغط **Finish** (لا تُشغّل Stack Builder)

6. تحقق من التثبيت — افتح **Command Prompt** واكتب:
   ```
   psql --version
   ```
   يجب أن تظهر: `psql (PostgreSQL) 16.x`

> ✅ PostgreSQL يعمل تلقائياً كـ Windows Service في الخلفية

---

## 4. تثبيت pnpm

افتح **Command Prompt** (بصلاحيات Administrator) واكتب:

```cmd
npm install -g pnpm
```

تحقق من التثبيت:
```cmd
pnpm --version
```
يجب أن تظهر: `8.x.x` أو أحدث

---

## 5. تثبيت OneSoft ERP

### طريقة أ: باستخدام install.bat (الأسهل)

1. انقر بزر الماوس الأيمن على ملف **`deploy-windows\install.bat`**
2. اختر **"Run as administrator"** (تشغيل كمسؤول)
3. اتبع التعليمات على الشاشة
4. انتظر حتى ينتهي التثبيت (5-10 دقائق)

### طريقة ب: يدوياً عبر Command Prompt

1. افتح **Command Prompt كمسؤول** (ابحث عن cmd → Click Right → Run as Administrator)

2. انتقل إلى مجلد البرنامج:
   ```cmd
   cd C:\OneSoftERP
   ```

3. ثبّت الحزم:
   ```cmd
   pnpm install
   ```

4. ابنِ Backend:
   ```cmd
   cd server-app
   pnpm run build
   cd ..
   ```

5. ابنِ Frontend:
   ```cmd
   cd client-app
   pnpm run build
   cd ..
   ```

---

## 6. إنشاء قاعدة البيانات

### الخطوة 6-أ: إنشاء قاعدة البيانات

افتح **Command Prompt** واكتب:

```cmd
psql -U postgres -c "CREATE DATABASE onesoft_erp;"
psql -U postgres -c "CREATE USER onesoft_user WITH PASSWORD 'OneSoft2024!';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE onesoft_erp TO onesoft_user;"
psql -U postgres -c "ALTER DATABASE onesoft_erp OWNER TO onesoft_user;"
```

> عند طلب كلمة المرور، أدخل كلمة مرور المستخدم `postgres` التي اخترتها أثناء التثبيت

### الخطوة 6-ب: إنشاء ملف الإعدادات

إذا كنت تستخدم `install.bat` فسيتم هذا تلقائياً.

للإعداد اليدوي، أنشئ مجلد `%APPDATA%\OneSoftERP\` ثم ملف `config.json` بالمحتوى التالي:

```json
{
  "port": 3000,
  "clientPort": 5000,
  "dbUrl": "postgresql://onesoft_user:OneSoft2024!@localhost:5432/onesoft_erp",
  "jwtSecret": "change-this-to-random-secret-32-chars",
  "nodeEnv": "production"
}
```

> ⚠️ استبدل `OneSoft2024!` بكلمة المرور التي اخترتها

### الخطوة 6-ج: تشغيل Migrations (إنشاء الجداول)

```cmd
cd C:\OneSoftERP\server-app
set DATABASE_URL=postgresql://onesoft_user:OneSoft2024!@localhost:5432/onesoft_erp
pnpm run db:push
```

---

## 7. تشغيل البرنامج لأول مرة

### الطريقة السهلة: انقر نقراً مزدوجاً على

```
deploy-windows\start.bat
```

أو اختصار سطح المكتب إذا أنشأه `install.bat`

### يدوياً:

افتح نافذتي Command Prompt:

**النافذة الأولى — Backend:**
```cmd
cd C:\OneSoftERP\server-app
node dist/index.mjs
```
انتظر حتى تظهر:
```
[INFO] OneSoft ERP started on http://localhost:3000
```

**النافذة الثانية — Frontend:**
```cmd
cd C:\OneSoftERP\client-app
pnpm run preview --port 5000
```

ثم افتح المتصفح على: **http://localhost:5000**

---

## 8. معالج الإعداد الأول

عند أول تشغيل (قاعدة البيانات فارغة) سيظهر **معالج الإعداد الأول** تلقائياً:

### الخطوة 1: مرحباً
- اضغط **"ابدأ الإعداد"**

### الخطوة 2: معلومات الشركة
- اسم الشركة بالعربي
- اسم الشركة بالإنجليزي
- الرقم الضريبي (15 رقم للسعودية)
- رقم السجل التجاري
- العنوان
- الدولة والعملة

### الخطوة 3: حساب المدير
- الاسم الكامل
- البريد الإلكتروني
- كلمة مرور قوية (8 أحرف على الأقل)

### الخطوة 4: إعدادات النظام
- بداية السنة المالية
- اللغة الافتراضية
- تفعيل ZATCA (اختياري)

### الخطوة 5: اكتمل ✅
- اضغط **"ابدأ الاستخدام"**

---

## 9. تسجيل الدخول

بعد اكتمال الإعداد الأول:

1. افتح المتصفح على: **http://localhost:5000**
2. أدخل البريد الإلكتروني الذي أنشأته في الخطوة 3 أعلاه
3. أدخل كلمة المرور
4. اضغط **"تسجيل الدخول"**

---

## 10. إيقاف وتشغيل البرنامج

### تشغيل البرنامج:
انقر نقراً مزدوجاً على:
- اختصار سطح المكتب **"OneSoft ERP"**  
  أو
- `deploy-windows\start.bat`

### إيقاف البرنامج:
في نافذة Command Prompt التي تعرض البرنامج:
- اضغط **Ctrl + C** مرتين

أو أغلق نافذة Command Prompt مباشرةً.

### تشغيل البرنامج تلقائياً مع Windows:
شغّل `install.bat` واختر خيار **"تسجيل كـ Windows Service"** (إذا كان متاحاً)

---

## 11. استكشاف الأخطاء

### المشكلة: `node` غير معروف كأمر
**الحل:** أعد تشغيل الكمبيوتر بعد تثبيت Node.js، أو تحقق من إضافة Node.js إلى PATH.

### المشكلة: `psql` غير معروف كأمر
**الحل:** أضف PostgreSQL إلى PATH يدوياً:
```
C:\Program Files\PostgreSQL\16\bin
```
اذهب إلى: System Properties → Environment Variables → Path → Edit → New

### المشكلة: خطأ في الاتصال بقاعدة البيانات
**الحل:** تحقق من:
1. PostgreSQL Service يعمل: ابحث عن "Services" في Windows → PostgreSQL → Started
2. كلمة المرور في `config.json` صحيحة
3. قاعدة البيانات `onesoft_erp` موجودة: `psql -U postgres -l`

### المشكلة: المنفذ 3000 أو 5000 مشغول
**الحل:** في Command Prompt كمسؤول:
```cmd
netstat -ano | findstr :3000
taskkill /PID <الرقم_الذي_ظهر> /F
```

### المشكلة: البرنامج لا يفتح في المتصفح
**الحل:** انتظر 30 ثانية وأعد المحاولة. تأكد من أن نافذة Backend تعرض رسالة "started".

---

## الدعم الفني

إذا واجهت أي مشكلة غير مذكورة، أرسل محتوى ملف:
```
%APPDATA%\OneSoftERP\logs\
```
للحصول على المساعدة.

---

*OneSoft ERP — نظام محاسبة ومخزون متكامل*  
*الإصدار: 1.0.0 | 2024*
