# OneSoft ERP — دليل بناء المثبّت الاحترافي

## المتطلبات

| الأداة | الإصدار | الملاحظة |
|--------|---------|----------|
| Windows | 10/11 x64 | مطلوب لبناء .exe |
| Node.js | v20+ | https://nodejs.org |
| pnpm | v8+ | `npm i -g pnpm` |
| nssm.exe | 2.24 | يُنزّله السكريبت تلقائياً |

---

## البناء بضغطة واحدة

افتح **PowerShell كـ Administrator** في مجلد المشروع:

```powershell
cd "F:\البرنامج الجديد\OneSoft-ERP-v1.0\OneSoft-ERP"
.\installer\BUILD-ON-WINDOWS.ps1
```

**الناتج:** `installer\release\OneSoft ERP Setup 1.0.0.exe`

---

## ما يفعله السكريبت تلقائياً

```
┌─────────────────────────────────────────────────────┐
│  STEP 1  فحص المتطلبات (Node, pnpm, nssm)          │
│  STEP 2  تثبيت Dependencies للمشروع كله             │
│  STEP 3  بناء server-app  (TypeScript → dist/)      │
│  STEP 4  بناء client-app  (React → dist/)           │
│  STEP 5  تجميع ملفات التطبيق في resources/app/      │
│  STEP 6  بناء Electron Installer (TypeScript + Vite)│
│  STEP 7  electron-builder → Setup.exe               │
│  STEP 8  فتح مجلد release/ تلقائياً                │
└─────────────────────────────────────────────────────┘
```

---

## خيارات متقدمة

```powershell
# تخطي إعادة تثبيت packages (إذا كانت مثبّتة مسبقاً)
.\installer\BUILD-ON-WINDOWS.ps1 -SkipInstall

# تخطي بناء التطبيق (إذا كان مبنياً مسبقاً)
.\installer\BUILD-ON-WINDOWS.ps1 -SkipAppBuild

# عرض جميع تفاصيل البناء
.\installer\BUILD-ON-WINDOWS.ps1 -Verbose

# مسار مخصص
.\installer\BUILD-ON-WINDOWS.ps1 -ProjectRoot "D:\MyProjects\OneSoft"
```

---

## ما يحتويه Setup.exe

```
OneSoft ERP Setup.exe  (~150-200 MB)
├── Electron Runtime (Chromium + Node.js)
├── installer UI (React 10 خطوات)
├── Core Logic (TypeScript compiled)
├── resources/
│   ├── bin/nssm.exe          ← Windows Service manager
│   ├── serve-client.js       ← Static file server للـ Frontend
│   └── app/
│       ├── server-app/       ← Backend مُجمَّع
│       │   ├── dist/         ← JavaScript مُترجم
│       │   ├── node_modules/ ← Production only
│       │   └── drizzle/      ← Migration files
│       └── client-app/
│           └── dist/         ← HTML/CSS/JS مُجمَّع
└── resources/LICENSE.txt
```

---

## تجربة التثبيت الكاملة

### على جهاز نظيف (بدون أدوات تطوير):

1. نقرتان على `OneSoft ERP Setup.exe`
2. تشغيل كـ Administrator (مطلوب)
3. **الخطوة 1:** مرحباً — معلومات الترحيب
4. **الخطوة 2:** قبول الترخيص
5. **الخطوة 3:** فحص المتطلبات (يُثبّت Node.js وPostgreSQL تلقائياً إذا لزم)
6. **الخطوة 4:** اختيار نوع التثبيت (مستخدم واحد / شبكة / سحابة)
7. **الخطوة 5:** إعداد قاعدة البيانات (اتصال + إنشاء)
8. **الخطوة 6:** بيانات المؤسسة
9. **الخطوة 7:** المستخدم الإداري الأول
10. **الخطوة 8:** التثبيت (DB + Migrations + خدمات + اختصارات + Registry)
11. **الخطوة 9:** فحص صحة النظام
12. **الخطوة 10:** انتهاء → زر "تشغيل البرنامج الآن"

---

## تجربة الترقية

```powershell
# شغّل Setup.exe الجديد — يكتشف النسخة القديمة تلقائياً
# يظهر: "تم اكتشاف إصدار سابق: v1.0.0 — سيتم الترقية"
```

**تسلسل الترقية التلقائي:**
1. اكتشاف النسخة الحالية من `C:\ProgramData\OneSoft\version.json`
2. نسخة احتياطية إلى `C:\ProgramData\OneSoft\Backups\backup-vX.X.X-TIMESTAMP\`
3. إيقاف `OneSoft-Server` و`OneSoft-Client`
4. تشغيل Drizzle Migrations الجديدة
5. إعادة تشغيل الخدمات
6. Health Check تلقائي
7. **عند الفشل:** استعادة تلقائية من النسخة الاحتياطية

---

## إلغاء التثبيت

**الطريقة 1:** من قائمة "إضافة/إزالة البرامج" في Windows
**الطريقة 2:** تشغيل Setup.exe مرة ثانية → يكتشف الوجود → يعرض خيار الإلغاء

**الخيارات:**
- ☐ حذف قاعدة البيانات (بياناتك نهائياً)
- ☐ حذف مجلد البيانات (الملفات والمرفقات)
- ✅ الاحتفاظ بكل شيء (إلغاء ملفات البرنامج فقط)

---

## الأيقونة المخصصة

ضع ملف `onesoft.ico` (256×256 px) في:
```
installer\resources\icons\onesoft.ico
```

لتحويل PNG إلى ICO:
```powershell
# استخدم ImageMagick
magick convert logo.png -resize 256x256 onesoft.ico
```

---

## التوقيع الرقمي (Authenticode)

للتوزيع التجاري، أضف في `electron-builder.config.ts`:

```typescript
win: {
  certificateFile: 'path/to/cert.pfx',
  certificatePassword: process.env.CERT_PASSWORD,
  signingHashAlgorithms: ['sha256'],
}
```

---

## المشاكل الشائعة

| المشكلة | الحل |
|---------|------|
| `electron-builder: command not found` | `pnpm install` داخل `installer/` |
| `nssm.exe not found` | السكريبت يُنزّله تلقائياً من nssm.cc |
| `Permission denied` | تأكد من تشغيل PowerShell كـ Administrator |
| `Cannot find dist\index.js` | شغّل `pnpm run build` داخل `server-app/` |
| `icon not found` | ضع `onesoft.ico` في `installer\resources\icons\` |
