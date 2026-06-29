# الوثيقة التقنية الشاملة — OneSoft ERP

> **مرجع رسمي للفريق التقني | يُحدَّث مع كل إصدار رئيسي**

---

## أولاً: معلومات عامة

| الحقل | القيمة |
|-------|--------|
| **اسم المشروع** | OneSoft ERP |
| **الإصدار الحالي** | 1.0.0 |
| **تاريخ البناء** | 2026-06-29 |
| **Build Number** | 888aa8f |
| **Schema Version** | 0012_zatca_database_architecture |
| **بيئة التشغيل** | Development (Replit) / Production (Windows Server) |
| **اللغة الأساسية** | العربية (RTL) مع دعم ثنائي اللغة |
| **الجمهور المستهدف** | شركات صغيرة ومتوسطة في المملكة العربية السعودية |

---

## ثانياً: Tech Stack — التقنيات المستخدمة

### Frontend

| التقنية | الإصدار | الغرض |
|---------|---------|-------|
| **React** | 19.2.1 | واجهة المستخدم |
| **TypeScript** | 5.9.3 | الكتابة الصارمة |
| **Vite** | 7.1.7 | بناء وتطوير Frontend |
| **Tailwind CSS** | 4.1.14 | تنسيق واجهة المستخدم |
| **Radix UI** | 1.x–2.x | مكونات Headless |
| **shadcn/ui** | — | مكونات UI مبنية على Radix |
| **tRPC Client** | 11.6.0 | استدعاء API بأمان كامل (Type-safe) |
| **TanStack Query** | 5.90.2 | إدارة حالة الخادم والـ Cache |
| **Wouter** | 3.3.5 | التوجيه (Routing) |
| **React Hook Form** | 7.64.0 | إدارة النماذج |
| **Zod** | 4.1.12 | التحقق من البيانات |
| **Framer Motion** | 12.23.22 | الحركات والانتقالات |
| **Recharts** | 2.15.2 | الرسوم البيانية |
| **date-fns** | 4.1.0 | معالجة التواريخ |
| **Sonner** | 2.0.7 | إشعارات Toast |
| **jspdf + autotable** | 4.2.1 / 5.0.8 | تصدير PDF |
| **xlsx** | 0.18.5 | تصدير Excel |
| **docx** | 9.7.1 | تصدير Word |
| **qrcode** | 1.5.4 | توليد QR Code |
| **lucide-react** | 0.453.0 | أيقونات |

### Backend

| التقنية | الإصدار | الغرض |
|---------|---------|-------|
| **Node.js** | 20.20.0 | بيئة تشغيل JavaScript |
| **Express** | 4.21.2 | خادم HTTP |
| **TypeScript** | 5.0.0 | الكتابة الصارمة |
| **tRPC Server** | 11.6.0 | API Layer (Type-safe) |
| **Drizzle ORM** | 0.44.5 | التعامل مع قاعدة البيانات |
| **Drizzle Kit** | 0.31.4 | إدارة Migrations |
| **PostgreSQL (pg)** | 8.11.0 | درايفر قاعدة البيانات |
| **bcryptjs** | 2.4.3 | تشفير كلمات المرور |
| **jose** | 6.1.0 | JWT (إنشاء / تحقق) |
| **Zod** | 4.1.12 | التحقق من مدخلات API |
| **superjson** | 1.13.3 | تسلسل البيانات (تاريخ، BigInt…) |
| **dotenv** | 16.0.0 | تحميل متغيرات البيئة |
| **nanoid** | 5.1.5 | توليد معرّفات فريدة |
| **esbuild** | 0.25.0 | بناء Backend للإنتاج |
| **tsx** | 4.19.1 | تشغيل TypeScript مباشرة (dev) |

### Database

| الحقل | القيمة |
|-------|--------|
| **نوع قاعدة البيانات** | PostgreSQL |
| **ORM** | Drizzle ORM |
| **عدد الجداول** | 61 جدول |
| **عدد العلاقات (FK)** | 181 علاقة |
| **عدد ملفات Migration** | 14 ملف |
| **أسلوب Migrations** | Drizzle Kit → `drizzle-kit push` / `drizzle-kit generate` |

### Desktop Application

| التقنية | الإصدار | الغرض |
|---------|---------|-------|
| **Electron** | 30.0.0 | تطبيق سطح المكتب |
| **electron-builder** | 24.9.1 | بناء Windows Installer |
| **electron-updater** | 6.1.7 | التحديثات التلقائية (مستقبلاً) |

---

## ثالثاً: هيكل المشروع

```
OneSoft ERP/
│
├── client-app/                  # Frontend (React + Vite)
│   ├── src/
│   │   ├── App.tsx              # التوجيه الرئيسي + PAGE_MAP (180+ مسار)
│   │   ├── main.tsx             # نقطة الدخول
│   │   ├── index.css            # CSS عالمي (Tailwind)
│   │   ├── pages/               # صفحات التطبيق (40+ ملف)
│   │   ├── components/          # مكونات مشتركة (UI، طباعة، نماذج)
│   │   │   └── ui/              # shadcn/ui components
│   │   ├── contexts/            # React Contexts (Theme، Language، TabManager، Workspace)
│   │   ├── hooks/               # Custom Hooks
│   │   ├── lib/                 # tRPC client، أدوات مساعدة
│   │   ├── utils/               # تنسيق تواريخ، أرقام، عملات
│   │   └── const.ts             # ثوابت عامة
│   ├── public/                  # ملفات ثابتة (أيقونات، manifest)
│   ├── vite.config.ts           # إعداد Vite
│   └── package.json
│
├── server-app/                  # Backend (Node.js + Express + tRPC)
│   ├── src/
│   │   ├── index.ts             # نقطة دخول Express
│   │   ├── env.ts               # تحميل الإعدادات (env + config.json)
│   │   ├── logger.ts            # سجلات يومية
│   │   ├── db.ts                # اتصال PostgreSQL + Drizzle instance
│   │   ├── schema.ts            # تعريف 61 جدول (1238 سطر)
│   │   ├── schema-version.ts    # إصدار الـ Schema المطلوب
│   │   ├── trpc.ts              # إعداد tRPC (context، middleware، procedures)
│   │   ├── auth.ts              # JWT، تشفير كلمات المرور، handlers
│   │   ├── check-schema.ts      # التحقق من إصدار قاعدة البيانات عند البدء
│   │   ├── routers/             # 32 tRPC Router (وحدة لكل نطاق)
│   │   └── services/            # خدمات الأعمال (5 خدمات)
│   │       ├── PostingEngine.ts      # محرك الترحيل المحاسبي
│   │       ├── PaymentEngine.ts      # محرك معالجة المدفوعات
│   │       ├── FieldDictionaryService.ts  # قاموس الحقول
│   │       ├── DocumentComponentService.ts # مكونات المستندات
│   │       └── TemplateEngine.ts     # محرك نماذج الطباعة
│   ├── drizzle/                 # ملفات Migration (14 ملف .sql)
│   ├── dist/                    # Backend مبني للإنتاج (index.mjs)
│   ├── drizzle.config.ts        # إعداد Drizzle Kit
│   └── package.json
│
├── electron/                    # تطبيق سطح المكتب (Windows)
│   ├── main.js                  # Main Process (spawn backend، tray، splash)
│   ├── splash.html              # شاشة تحميل عربية
│   ├── preload.js               # contextBridge API
│   ├── package.json             # electron-builder config
│   └── assets/
│       └── LICENSE.txt          # EULA عربي/إنجليزي
│
├── deploy-windows/              # ملفات النشر على Windows
│   ├── config.json              # قالب ملف الإعدادات الخارجي
│   ├── تثبيت_أول_مرة.bat       # سكريبت التثبيت
│   ├── تشغيل_البرنامج.bat      # سكريبت التشغيل
│   ├── build-installer.bat      # بناء Setup.exe
│   └── دليل_التثبيت.md         # دليل التثبيت والإزالة
│
├── docs/                        # الوثائق التقنية
│   └── TECHNICAL_DOCUMENTATION.md  # هذه الوثيقة
│
├── scripts/                     # سكريبتات مساعدة (إعادة تعيين Admin، بيانات أولية)
├── logs/                        # سجلات التشغيل (مُستثنى من git)
└── backups/                     # النسخ الاحتياطية (مُستثنى من git)
```

---

## رابعاً: البنية المعمارية (Architecture)

### النمط المستخدم: **Monorepo + Layered Architecture + Service Pattern**

```
┌─────────────────────────────────────────────────────┐
│                   BROWSER / ELECTRON                │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │          React 19 (client-app)               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │  Pages   │  │Components│  │ Contexts │  │   │
│  │  └────┬─────┘  └──────────┘  └──────────┘  │   │
│  │       │ TanStack Query + tRPC Client         │   │
│  └───────┼─────────────────────────────────────┘   │
└──────────┼──────────────────────────────────────────┘
           │  HTTPS / tRPC (Type-safe RPC)
           ▼
┌─────────────────────────────────────────────────────┐
│                  NODE.JS SERVER (server-app)         │
│                                                     │
│  ┌─────────────┐   ┌──────────────────────────┐    │
│  │  Express    │   │   tRPC Router Layer       │    │
│  │  Middleware │   │   (32 Routers)            │    │
│  └──────┬──────┘   └──────────┬───────────────┘    │
│         │                     │                     │
│  ┌──────▼─────────────────────▼───────────────┐    │
│  │              Service Layer                   │    │
│  │  PostingEngine | PaymentEngine | Template…  │    │
│  └──────────────────┬──────────────────────────┘    │
│                     │                               │
│  ┌──────────────────▼──────────────────────────┐    │
│  │         Drizzle ORM (Data Access)            │    │
│  └──────────────────┬──────────────────────────┘    │
└─────────────────────┼───────────────────────────────┘
                      │
           ┌──────────▼──────────┐
           │    PostgreSQL DB     │
           │    (61 جدول)        │
           └─────────────────────┘
```

### تدفق البيانات
```
User Action → React Component → tRPC Hook (useQuery/useMutation)
→ TanStack Query Cache → tRPC Client → Express Middleware
→ tRPC Router → Service Layer → Drizzle ORM → PostgreSQL
→ Response → superjson deserialization → React State Update → UI
```

### Electron (وضع سطح المكتب)
```
Windows Launch → electron/main.js
  ├── app.requestSingleInstanceLock()       # منع النسخ المتعددة
  ├── createSplash()                        # شاشة التحميل
  ├── spawn('node', server-app/dist)        # تشغيل Backend
  ├── waitForServer('/api/health')          # انتظار الجاهزية
  ├── shell.openExternal(localhost:PORT)    # فتح المتصفح
  └── createTray()                          # أيقونة System Tray
```

---

## خامساً: الوحدات (Modules)

| الوحدة | الحالة | Backend | Frontend | ملاحظات |
|--------|--------|---------|---------|---------|
| **المبيعات** | ✅ مكتملة | ✓ | ✓ | فواتير، مرتجعات، عروض أسعار، طلبات |
| **المشتريات** | ✅ مكتملة | ✓ | ✓ | فواتير، مرتجعات، طلبات شراء |
| **المخزون** | ✅ مكتملة | ✓ | ✓ | إيصالات، صرف، تحويل، جرد، تقارير |
| **الحسابات** | ✅ مكتملة | ✓ | ✓ | قيود، سندات، موازين، ميزانية، ترحيل |
| **العملاء** | ✅ مكتملة | ✓ | ✓ | ملف عميل، كشف حساب، أرصدة |
| **الموردون** | ✅ مكتملة | ✓ | ✓ | ملف مورد، كشف حساب |
| **المنتجات** | ✅ مكتملة | ✓ | ✓ | منتجات، فئات، مجموعات، وحدات |
| **المستودعات** | ✅ مكتملة | ✓ | ✓ | تعدد المستودعات، ربط حسابي |
| **نقاط البيع** | ✅ مكتملة | ✓ | ✓ | POS، وردية، طباعة إيصال |
| **هيئة الزكاة (ZATCA)** | ✅ مكتملة | ✓ | ✓ | e-invoice، QR، CSR، بيئة sandbox/prod |
| **الإعدادات** | ✅ مكتملة | ✓ | ✓ | شركة، عملات، ضرائب، نماذج طباعة |
| **المستخدمون والصلاحيات** | ✅ مكتملة | ✓ | ✓ | أدوار، مجموعات، تدقيق |
| **النسخ الاحتياطي والسجلات** | ✅ مكتملة | ✓ | ✓ | pg_dump، استعادة، سجلات يومية |
| **نماذج الطباعة** | ✅ مكتملة | ✓ | ✓ | مصمم نماذج، ثنائي اللغة، PDF |
| **المراسلة (WhatsApp/Email)** | ⚠️ جزئية | ✓ | ✓ | البنية جاهزة، تحتاج تفعيل API |
| **الموارد البشرية (HR)** | 🔧 واجهة | — | ✓ | واجهة UI فقط، Backend لم يُبنَ |
| **التصنيع** | 🔧 واجهة | — | ✓ | واجهة UI فقط، Backend لم يُبنَ |
| **الأصول الثابتة** | 🔧 واجهة | — | ✓ | واجهة UI فقط، Backend لم يُبنَ |
| **التقارير** | ⚠️ جزئية | ✓ | ✓ | تقارير أساسية، تقارير متقدمة قيد التطوير |
| **الدردشة الداخلية** | ✅ مكتملة | ✓ | ✓ | رسائل داخلية بين المستخدمين |
| **الذكاء الاصطناعي (AI Chat)** | ⚠️ جزئية | — | ✓ | مكوّن UI متاح، يحتاج API خارجي |

---

## سادساً: قاعدة البيانات

### إجمالي الجداول: **61 جدول**

#### مجموعة الهيكل التنظيمي
| الجدول | الوصف |
|--------|-------|
| `organizations` | المؤسسات / الشركات |
| `branches` | الفروع |
| `users` | المستخدمون |
| `userGroups` | مجموعات المستخدمين |
| `userGroupMembers` | أعضاء المجموعات |
| `userCategories` | تصنيفات المستخدمين |

#### مجموعة المحاسبة
| الجدول | الوصف |
|--------|-------|
| `chartOfAccounts` | دليل الحسابات |
| `costCenters` | مراكز التكلفة |
| `currencies` | العملات وأسعار الصرف |
| `journalEntries` | رؤوس قيود اليومية |
| `journalEntryLines` | أسطر قيود اليومية |
| `vouchers` | سندات (قبض/صرف) |
| `receiptVouchers` | سندات قبض |
| `paymentVouchers` | سندات صرف |
| `postingDefinitions` | تعريفات الترحيل |
| `postingDefinitionLines` | أسطر تعريفات الترحيل |
| `appSettings` | إعدادات التطبيق العامة |

#### مجموعة المبيعات
| الجدول | الوصف |
|--------|-------|
| `customers` | العملاء |
| `salesInvoices` | فواتير المبيعات |
| `salesInvoiceItems` | أصناف الفواتير |
| `salesInvoicePayments` | مدفوعات الفواتير |

#### مجموعة المشتريات
| الجدول | الوصف |
|--------|-------|
| `suppliers` | الموردون |
| `purchaseInvoices` | فواتير الشراء |
| `purchaseInvoiceItems` | أصناف فواتير الشراء |

#### مجموعة المخزون
| الجدول | الوصف |
|--------|-------|
| `products` | المنتجات / الأصناف |
| `productGroups` | مجموعات المنتجات |
| `units` | وحدات القياس |
| `warehouses` | المستودعات |
| `warehouseAccountLinks` | ربط المستودعات بالحسابات |
| `inventory` | أرصدة المخزون |
| `stockVouchers` | سندات حركة المخزون |
| `stockVoucherItems` | أصناف سندات المخزون |
| `inventoryCounts` | رؤوس جلسات الجرد |
| `inventoryCountItems` | أصناف الجرد |
| `freeProducts` | المنتجات المجانية / الهدايا |

#### مجموعة المستندات
| الجدول | الوصف |
|--------|-------|
| `documentTypes` | أنواع المستندات |
| `documentJournals` | قيود المستندات |
| `documentTemplates` | نماذج الطباعة |
| `fieldDictionary` | قاموس الحقول المحاسبية |
| `paymentMethods` | طرق الدفع |

#### مجموعة الإرسال والتواصل
| الجدول | الوصف |
|--------|-------|
| `sendSettings` | إعدادات الإرسال |
| `documentSendLogs` | سجلات إرسال المستندات |
| `messages` | الرسائل الداخلية |
| `wabaMessageTemplates` | قوالب WhatsApp Business |

#### مجموعة ZATCA
| الجدول | الوصف |
|--------|-------|
| `zatcaEnvironments` | بيئات الربط (sandbox/prod) |
| `zatcaDevices` | الأجهزة المسجلة |
| `zatcaSettings` | إعدادات ZATCA |
| `zatcaKeys` | مفاتيح التشفير |
| `zatcaCsrRequests` | طلبات CSR |
| `zatcaCsid` | شهادات CSID |
| `zatcaCertificates` | الشهادات |
| `zatcaQrCodes` | رموز QR |
| `zatcaXmlDocuments` | مستندات XML |
| `zatcaInvoiceTransactions` | معاملات الفواتير |
| `zatcaApiHistory` | تاريخ مكالمات API |
| `zatcaLogs` | سجلات ZATCA |
| `zatcaRequestLog` | سجل الطلبات |
| `zatcaResponseLog` | سجل الاستجابات |
| `zatcaErrorLog` | سجل الأخطاء |
| `qrSettings` | إعدادات QR |

### العلاقات الرئيسية
```
organizations
  ├── users (orgId → cascade)
  ├── customers (orgId → cascade)
  ├── suppliers (orgId → cascade)
  ├── products (orgId → cascade)
  ├── salesInvoices (orgId → cascade)
  ├── purchaseInvoices (orgId → cascade)
  ├── chartOfAccounts (orgId → cascade)
  ├── journalEntries (orgId → cascade)
  └── warehouses (orgId → cascade)

salesInvoices
  ├── salesInvoiceItems (invoiceId → cascade)
  ├── salesInvoicePayments (invoiceId → cascade)
  ├── customers (customerId → set null)
  ├── warehouses (warehouseId → set null)
  └── branches (branchId → set null)

journalEntries
  └── journalEntryLines (entryId → cascade)
      └── chartOfAccounts (accountId → set null)
```

### Migrations (ترقيات قاعدة البيانات)
```
0000 → set_null_inventory_counts_warehouse_id
0001 → set_null_warehouse_references
0002 → robust_black_bolt (جداول أساسية)
0003 → add_entity_type_to_document_journals
0004 → add_waba_fields_to_send_settings
0005 → add_waba_advanced
0006 → add_currencies
0007 → add_app_settings
0008 → unique_journal_entry_number
0009 → add_payment_breakdown
0010 → add_item_type_to_products
0011 → add_zatca_integration
0012 → zatca_database_architecture     ← الإصدار الحالي
```

---

## سابعاً: API

### الإحصاءات
- **عدد tRPC Routers**: 32 router
- **عدد المسارات في PAGE_MAP**: 180+ مسار في الـ Frontend
- **بروتوكول النقل**: HTTP/HTTPS عبر tRPC (POST requests + batch)
- **تنسيق البيانات**: JSON عبر superjson (يدعم Date، BigInt، Map، Set)

### قائمة Routers
```
auth              users             dashboard         reports
orgs              userGroups        products          accounting
customers         userCategories    categories        sales
suppliers         qrSettings        productGroups     purchases
accounts          branches          stockVouchers     chat
journal           units             inventoryCount    documentJournals
vouchers          warehouses        currencies        documentTemplates
receiptVouchers   inventory         fieldDictionary   documentTypes
paymentVouchers   costCenters       appSettings       postingDefinitions
                  paymentMethods    documentSend      posting
                  zatca             sourceCode        backup
```

### المصادقة والتفويض
```
tRPC Procedures:
  publicProcedure      → متاح للجميع (تسجيل الدخول، health check)
  protectedProcedure   → يتطلب تسجيل دخول (admin أو superadmin)
  superadminProcedure  → للمدير العام فقط

الأدوار (Roles):
  superadmin → صلاحيات كاملة (إدارة المؤسسات، مستعرض الكود)
  admin      → مدير المؤسسة (كل عمليات ERP)
  user       → مستخدم عادي (وفق صلاحيات مجموعته)
```

### معالجة الأخطاء
- tRPC يُعيد `TRPCError` بكود HTTP مناسب
- أخطاء 401 للمصادقة، 403 للتفويض، 400 للمدخلات
- Zod يُعيد رسائل خطأ تفصيلية للمدخلات غير الصحيحة

---

## ثامناً: الأمان

| الجانب | التقنية | التفاصيل |
|--------|---------|---------|
| **تشفير كلمات المرور** | bcryptjs | cost factor = 12 |
| **المصادقة** | JWT (jose) | HS256، منتهي الصلاحية بعد 30 يوم |
| **حفظ الجلسة** | httpOnly Cookie | `onesoft_session`، SameSite: lax |
| **حماية API** | tRPC Middleware | requireAuth، requireSuperAdmin |
| **CORS** | express cors | `origin: true, credentials: true` |
| **تحقق المدخلات** | Zod | تحقق شامل على Backend و Frontend |
| **الأسرار** | ملف .env / config.json خارجي | لا توجد أسرار مُضمّنة في الكود |
| **Rate Limiting** | ❌ غير مطبّق | يُنصح بإضافته قبل الإنتاج |
| **Helmet** | ❌ غير مطبّق | يُنصح بإضافته قبل الإنتاج |
| **HTTPS** | ✅ في Replit | مطلوب إعداده على السيرفر المحلي |
| **SQL Injection** | محمي عبر Drizzle ORM | استعلامات parameterized |
| **XSS** | React يحمي بشكل تلقائي | + Zod للمدخلات |

---

## تاسعاً: الأداء

| الجانب | الحالة | التفاصيل |
|--------|--------|---------|
| **Cache** | TanStack Query | Cache تلقائي للاستعلامات، invalidation عند التعديل |
| **Code Splitting** | ✅ Vite | تقسيم تلقائي بالـ route |
| **Lazy Loading** | جزئي | مكونات ثقيلة عبر `React.lazy` |
| **DB Connection Pool** | ✅ pg Pool | مُشتركة بين الطلبات |
| **Index الرئيسية** | ✅ | كل جدول له `serial PRIMARY KEY` |
| **Index الفريدة** | journal_entries_org_entry_number_uidx | تمنع تكرار رقم القيد |
| **Batch API** | ✅ tRPC batch | دمج طلبات متعددة في HTTP request واحد |
| **superjson** | ✅ | تسلسل فعّال للبيانات المعقدة |
| **esbuild** | ✅ Backend | بناء سريع جداً للـ Backend |
| **مراقبة الأداء** | ❌ غير مطبّق | يُنصح بإضافة APM قبل الإنتاج |

---

## عاشراً: تطبيق سطح المكتب (Electron)

### كيفية العمل

```
1. المستخدم يضغط اختصار "OneSoft ERP" على سطح المكتب
   ↓
2. electron/main.js يبدأ التشغيل
   ↓
3. app.requestSingleInstanceLock()
   ├── إذا كانت نسخة أخرى تعمل → فتح المتصفح ← إغلاق
   └── إذا كان هذا أول تشغيل → متابعة
   ↓
4. قراءة %APPDATA%\OneSoftERP\config.json
   ↓
5. عرض splash.html (شاشة التحميل)
   ↓
6. spawn('node', 'server-app/dist/index.mjs') مع env vars من config.json
   ↓
7. waitForServer(): poll GET /api/health كل 500ms حتى 45 ثانية
   ↓
8. إغلاق splash → shell.openExternal(http://localhost:PORT)
   ↓
9. createTray(): أيقونة Tray مع قوائم التحكم
   ↓
10. البرنامج يعمل في الخلفية عبر System Tray
```

### ملف الإعدادات الخارجي
```json
// %APPDATA%\OneSoftERP\config.json
{
  "port": 3000,
  "dbType": "postgresql",
  "dbUrl": "postgresql://user:pass@host:5432/db",
  "jwtSecret": "...",
  "backupDir": "...",
  "logDir": "...",
  "nodeEnv": "production",
  "openBrowserOnStart": true,
  "zatca": { "environment": "sandbox" },
  "updates": { "enabled": false }
}
```

### السجلات
```
%APPDATA%\OneSoftERP\logs\
  ├── onesoft-YYYY-MM-DD.log    ← سجلات الخادم (JSON per line)
  └── electron-YYYY-MM-DD.log   ← سجلات Electron
```
تُحذف السجلات تلقائياً بعد 30 يوماً.

---

## الحادي عشر: النشر (Deployment)

### نسخة Production — خطوات البناء

```bat
# الخطوة 1: بناء Backend
cd server-app
pnpm build
# الناتج: server-app/dist/index.mjs

# الخطوة 2: بناء Frontend
cd client-app
pnpm build
# الناتج: client-app/dist/

# الخطوة 3: قاعدة البيانات
cd server-app
npx drizzle-kit push

# الخطوة 4: تشغيل البرنامج
node server-app/dist/index.mjs
# يخدم client-app/dist/ تلقائياً عبر express.static
```

### بناء Setup.exe
```bat
deploy-windows\build-installer.bat
# أو يدوياً:
cd electron
npm install
npm run build:win
# الناتج: dist-installer\OneSoft ERP Setup 1.0.0.exe
```

### الإصدارات المتاحة من electron-builder
| النوع | الملف | الاستخدام |
|-------|-------|---------|
| **NSIS Installer** | `OneSoft ERP Setup 1.0.0.exe` | تثبيت كامل مع اختصار |
| **Portable** | `OneSoft ERP 1.0.0.exe` | تشغيل بدون تثبيت |

### آلية التحديثات (مستقبلاً)
- `electron-updater` مثبّت ومُعدّ
- `autoUpdater.checkForUpdatesAndNotify()` موجود في main.js (معطّل حالياً)
- لتفعيله: إعداد `updates.serverUrl` في config.json وتوفير خادم releases

---

## الثاني عشر: القيود الحالية

| # | القيد | الأثر | الأولوية |
|---|-------|-------|---------|
| 1 | **لا يوجد Rate Limiting** | قد يُسبب هجمات Brute Force | عالية |
| 2 | **لا يوجد Helmet** | بعض HTTP headers الأمنية غائبة | عالية |
| 3 | **CORS مفتوح** (`origin: true`) | مقبول في Replit، خطر في الإنتاج | عالية |
| 4 | **HR/Manufacturing/Assets** | واجهة UI فقط، لا Backend | متوسطة |
| 5 | **Auto-login نشط** | تسجيل دخول تلقائي كـ superadmin في التطوير | يُزال في الإنتاج |
| 6 | **لا يوجد APM** | لا رصد للأداء أو الأخطاء في الإنتاج | متوسطة |
| 7 | **لا يوجد مصادقة ثنائية (2FA)** | يُنصح بها لحسابات الإدارة | متوسطة |
| 8 | **HTTPS محلي** | يحتاج شهادة SSL عند النشر المحلي | عالية |
| 9 | **لا يوجد Connection Pooling Config** | الإعدادات افتراضية لـ pg | منخفضة |
| 10 | **التقارير المتقدمة** | تقارير محدودة، تحتاج توسعة | متوسطة |
| 11 | **icon.ico غير موجودة** | Electron يستخدم أيقونة افتراضية | منخفضة |
| 12 | **مصادقة ZATCA sandbox فقط** | تحتاج اعتماد رسمي للإنتاج | عالية (قبل البيع) |

---

## الثالث عشر: التقييم التقني والتوصيات

### نقاط القوة ✅

1. **بنية Type-safe شاملة**: tRPC + TypeScript + Zod + Drizzle — أخطاء المطابقة تُكتشف وقت البناء
2. **مخطط قاعدة بيانات ناضج**: 61 جدول، 181 علاقة، نظام migrations منظم
3. **نظام ترحيل محاسبي متكامل**: PostingEngine يُطبّق أسس المحاسبة المزدوجة
4. **دعم ZATCA**: تكامل متقدم مع هيئة الزكاة (CSR، CSID، QR، e-invoice)
5. **معمارية Monorepo**: كود Frontend وBackend في مكان واحد، سهولة التطوير
6. **تطبيق سطح المكتب جاهز**: Electron مع installer وإعدادات خارجية
7. **نظام طباعة متقدم**: مصمم نماذج، ثنائي اللغة، تصدير PDF
8. **واجهة MDI متكاملة**: تجربة سطح مكتب داخل المتصفح

### نقاط الضعف ⚠️

1. **غياب الاختبارات الآلية**: لا unit tests ولا integration tests
2. **قصور أمني**: غياب rate limiting، helmet، CORS مفيدة ولكن فضفاضة
3. **وحدات غير مكتملة**: HR، التصنيع، الأصول — واجهة بدون Backend
4. **لا يوجد logging للـ API requests**: صعوبة تتبع المشكلات
5. **لا يوجد مراقبة الأداء**: لا APM مثل Sentry أو Datadog

### قابلية التوسع

| الجانب | التقييم |
|--------|---------|
| إضافة وحدات جديدة | ✅ سهل جداً (router + page) |
| إضافة جداول جديدة | ✅ سهل (schema + migration) |
| دعم قاعدة بيانات أخرى | ⚠️ ممكن (Drizzle يدعم SQLite/MySQL) لكن يحتاج جهد |
| إضافة مستخدمين متزامنين | ✅ PostgreSQL يدعم التزامن |
| نشر على السحابة | ✅ جاهز (Node.js + PostgreSQL = standard) |
| بنية Microservices | ⚠️ تحتاج إعادة هيكلة كاملة |
| دعم عدة لغات إضافية | ⚠️ i18n غير مُعدّ رسمياً |

### مدى الجاهزية للإنتاج

```
Core ERP Functions    ████████████████████  90% ✅
Database Layer        ████████████████████  95% ✅
API Layer (tRPC)      ████████████████████  90% ✅
Security Hardening    ██████████░░░░░░░░░░  50% ⚠️
Automated Testing     ░░░░░░░░░░░░░░░░░░░░   0% ❌
Monitoring/APM        ░░░░░░░░░░░░░░░░░░░░   0% ❌
HR Module (Backend)   ░░░░░░░░░░░░░░░░░░░░   0% 🔧
Manufacturing Backend ░░░░░░░░░░░░░░░░░░░░   0% 🔧
ZATCA Production      ████████████░░░░░░░░  60% ⚠️
```

### التوصيات قبل بدء البيع

**فورية (قبل أول عميل):**
1. ✋ إزالة `auto-login` أو تقييده بـ `NODE_ENV=development`
2. 🔒 إضافة `helmet` و`express-rate-limit`
3. 🌐 إعداد HTTPS على جهاز العميل (Let's Encrypt أو شهادة محلية)
4. 🔑 تغيير `jwtSecret` الافتراضي في config.json لكل عميل
5. 🏛️ اعتماد ZATCA الإنتاجي (Production CSID)

**قريبة المدى (خلال شهر):**
6. 🧪 كتابة اختبارات للعمليات الحرجة (ترحيل الفواتير، الأرصدة)
7. 📊 إضافة Sentry أو LogRocket لمراقبة الأخطاء
8. 🔍 تدقيق أمني كامل قبل الطرح التجاري

**متوسطة المدى (خلال ربع سنة):**
9. 🔄 بناء Backend لوحدات HR والتصنيع والأصول
10. 📱 تحسين تجربة الجوال (Responsive)
11. 🔄 تفعيل نظام التحديثات التلقائية عبر electron-updater

---

*هذه الوثيقة مولّدة بشكل شبه آلي من قراءة الكود الفعلي للمشروع.*
*آخر تحديث: 2026-06-29 | Build: 888aa8f*
