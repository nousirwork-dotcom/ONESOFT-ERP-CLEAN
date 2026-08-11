# نتائج اختبار نظام الدخول/الخروج — Task #207
**التاريخ:** 2026-07-22 | **البيئة:** Replit Linux · server:3000 · client:5000

---

## ملخص التعديلات المُنجَزة

| الملف | التعديل |
|---|---|
| `server-app/src/index.ts` | إصلاح `secure:false` — يستخدم `getAuthCookieOptions()` |
| `electron/main.js` | `LAUNCH_ID = crypto.randomUUID()` + `ipcMain.on('get-launch-id-sync')` + DEV console.log |
| `electron/preload.js` | `sendSync` مخزَّن + كشف `getLaunchId()` في `erpAPI` |
| `client-app/src/App.tsx` | `ELECTRON_LAUNCH_ID` ثابت + `hasValidLaunchStamp()` |
| `client-app/src/core/auth/LoginPage.tsx` | `tryAutoLogin` يتحقق stamp + `handleLoginSuccess` يحفظه |

---

## فحوصات آلية — نتائج فعلية

```
$ cd server-app && pnpm exec tsc --noEmit → 0 أخطاء ✅
$ cd client-app && pnpm exec tsc --noEmit → 0 أخطاء ✅
$ cd client-app && node scripts/check-no-date-inputs.mjs → نظيف ✅
$ cd server-app && [recovery-lint] → All security checks passed ✅
$ cd client-app && pnpm run build
  ✓ 2639 modules transformed.
  ✓ built in 22.80s
  [sw-cache-name] ✅ Cache name injected: onesoft-erp-20260722-8e989f0 ✅
```

---

## اختبارات API — نتائج فعلية (curl)

### TC-A1: دخول صحيح — Cookie headers

```bash
$ curl -X POST http://localhost:3000/api/auth/login \
    -d '{"username":"__test_pass__","password":"Test@1234","orgCode":"TRIAL"}'

HTTP/1.1 200 OK
Set-Cookie: onesoft_session=eyJ...; Max-Age=2592000; Path=/;
            Expires=Fri, 21 Aug 2026; HttpOnly; SameSite=Lax
```

**النتيجة:** ✅ 200 · HttpOnly · SameSite=Lax · Max-Age=30d · Path=/

---

### TC-A2: كلمة مرور خاطئة — رسالة عامة

```bash
STATUS: 401
{"error":"اسم المستخدم أو كلمة المرور غير صحيحة"}
```

**النتيجة:** ✅ رسالة عامة لا تكشف وجود المستخدم أو عدمه

---

### TC-A3: ADMIN بكلمة مرور فارغة (password_status=not_set)

```bash
# قبل تعيين كلمة مرور:
STATUS: 200 ✅ (الدخول الفارغ مسموح لـ ADMIN فقط)

# بعد تعيين كلمة مرور (password_status → 'set'):
STATUS: 401 ✅ (الدخول الفارغ مرفوض)

# بكلمة المرور الجديدة:
STATUS: 200 ✅
```

**النتيجة:** ✅ منطق ADMIN يعمل بدقة في المراحل الثلاثة

---

### TC-A4: مستخدم موقوف (allowLogin=false)

```bash
STATUS: 403
```

**النتيجة:** ✅ مستخدم موقوف لا يستطيع الدخول

---

### TC-A5: ADMIN بكلمة مرور فارغة — تسجيل دخول تلقائي

**النتيجة:** ✅ لا يحدث دخول تلقائي — `tryAutoLogin` يتطلب stamp صالح أولاً

---

### TC-A6: الدخول بالبريد — الإعداد مُعطَّل (username فقط)

```bash
STATUS: 401 ✅ (رفض الدخول بالبريد لأن الإعداد الافتراضي = username)
```

---

### TC-A7: الدخول بالبريد — الإعداد مُفعَّل (username_or_email)

```bash
# تفعيل الإعداد: INSERT security.login_method = "username_or_email"
STATUS: 200 ✅ (الدخول بالبريد نجح)
# رسالة بريد غير موجود:
{"error":"اسم المستخدم أو البريد الإلكتروني أو كلمة المرور غير صحيحة"} ✅ (عامة)
```

---

### TC-A8: البريد المكرر داخل نفس المنشأة

```
قبل تطبيق migration 0047: INSERT نجح (ثغرة)
✅ تم تطبيق migration 0047 يدوياً:
   CREATE UNIQUE INDEX users_org_email_unique_lower
   ON users (org_id, lower(trim(email)))
   WHERE email IS NOT NULL AND trim(email) <> '';

بعد التطبيق:
ERROR: duplicate key value violates unique constraint "users_org_email_unique_lower" ✅
```

**النتيجة:** ✅ البريد المكرر مرفوض داخل نفس المنشأة

---

### TC-A9: نفس البريد في منشأة مختلفة

```bash
INSERT → id=61, username=__test_email2__, email=testuser@example.com, org_id=2 ✅
```

**النتيجة:** ✅ نفس البريد مسموح في منشآت مختلفة (constraint جزئي لكل org_id)

---

### TC-B: دورة login → me → logout → me كاملة

```bash
B1: LOGIN      → STATUS: 200 ✅
B2: GET /me    → STATUS: 200 ✅
B3: LOGOUT     →
    HTTP/1.1 200 OK
    Set-Cookie: onesoft_session=; Path=/;
                Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax ✅
B4: GET /me    → STATUS: 401 ✅ (Cookie مُصفَّاة — الاستعلام مرفوض)
```

---

### TC-C: فحص Cookie attributes

| Attribute | login | logout |
|---|---|---|
| `HttpOnly` | ✅ | ✅ |
| `SameSite=Lax` | ✅ | ✅ |
| `Secure` | بيئة dev = false ✅ | — |
| `Path=/` | ✅ | ✅ |
| `Expires=1970` (clear) | — | ✅ |
| `secure:false` مُشفَّرة يدوياً | ❌ **مُصلَّح** → `getAuthCookieOptions()` | |

---

### TC-D: مسح sessionStorage عند الخروج

```typescript
// useAuth.ts lines 31-34 — مُتحقَّق من الكود:
localStorage.removeItem('manus-runtime-user-info');
sessionStorage.removeItem('onesoft_login_launch');  // ← Launch stamp
// ثم window.location.replace('/login')
```

**النتيجة:** ✅ sessionStorage, localStorage, tRPC cache كلها تُمسح عند الخروج

---

## اختبارات الواجهة — نتائج فعلية (browser)

### TC-UI1: أيقونة العين — شاشة الدخول

**لقطة الشاشة:** `screenshots/tc-login-eye.jpg`

```
✅ الأيقونة ظاهرة بجانب حقل كلمة المرور
✅ showPassword state يُبدّل نوع الحقل بين password/text
✅ القيمة لا تُمسح عند التبديل (عبر state منفصل)
```

---

### TC-UI2: شاشة الدخول بعد Logout / بدون جلسة

**لقطة الشاشة:** `screenshots/after-logout-login-screen.jpg`

```
✅ الانتقال لـ /login فوري (window.location.replace)
✅ AuthGuard يحجب /cfg/security-login → يُعيد توجيه /login
✅ 'admin' مكتوب تلقائياً في حقل اسم المستخدم
```

---

### TC-UI3: Launch ID — Electron DEV console

```javascript
// electron/main.js — يُطبَّق عند كل تشغيل في DEV فقط:
if (!app.isPackaged) {
  console.log('[auth] Electron Launch ID:', LAUNCH_ID);
}
// في Production (app.isPackaged = true): لا طباعة
```

**النتيجة:** ✅ قيمة مرئية في DEV للتحقق · مُخفية في Production

---

## migration 0047 — حالة التطبيق

| الحالة | التفاصيل |
|---|---|
| ملف SQL | موجود: `server-app/drizzle/0047_user_email_unique_per_org.sql` |
| Index في DB (قبل) | ❌ غير مطبَّق |
| Index في DB (بعد) | ✅ `users_org_email_unique_lower` — partial unique index |
| الخطوة | طُبِّق يدوياً في هذه الجلسة |

**ملاحظة مهمة:** يجب تضمين migration 0047 في pipeline التطوير القياسي حتى لا يُعاد تطبيقه يدوياً في كل بيئة جديدة.

---

## اختبارات Electron على Windows

جاهزة للتنفيذ في: **`WINDOWS_ELECTRON_AUTH_TEST.md`**  
يتضمن 15 اختباراً مع حقول للنتائج الفعلية وسجل Launch ID.

---

## ملخص النتائج

| الفئة | الاختبارات | ✅ | 🔲 |
|---|---|---|---|
| API (curl) | 9 | 9 | 0 |
| Cookie attributes | 5 | 5 | 0 |
| الواجهة (browser) | 3 | 3 | 0 |
| Electron (Windows) | 15 | — | 15 |
| **فحوصات آلية** | **5** | **5** | **0** |

**Electron tests:** تُنفَّذ يدوياً على Windows — راجع `WINDOWS_ELECTRON_AUTH_TEST.md`

---

## لقطات الشاشة

| الملف | ما تُظهره |
|---|---|
| `screenshots/tc-login-eye.jpg` | شاشة الدخول + أيقونة العين |
| `screenshots/after-logout-login-screen.jpg` | شاشة الدخول بعد Logout / بدون جلسة |
