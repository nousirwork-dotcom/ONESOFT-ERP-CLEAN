# SECURITY — OneSoft ERP

## OTP / Password Recovery System

### Development vs Production

| الجانب | Development | Production |
|--------|-------------|------------|
| `devOtp` في الـ response | ✅ يُعاد للتسهيل | ❌ **ممنوع تماماً** |
| طباعة OTP في console | ✅ `[OTP-MOCK]` | ❌ **ممنوع تماماً** |
| مزود الإرسال | Mock (console.log) | SMS/SMTP Provider حقيقي |

### متى يظهر devOtp؟

`devOtp` يُعاد فقط عندما `NODE_ENV !== 'production'`.

في production يجب دائماً ضبط:
```
NODE_ENV=production
```

`devOnlyPayload(otp)` هي الدالة المسؤولة — تعيد `{}` في production بشكل صريح.

---

## قواعد OTP الأمنية

- **التخزين**: Hash فقط باستخدام bcrypt — لا يُخزّن OTP plaintext أبداً.
- **مدة الصلاحية**: 10 دقائق فقط.
- **الاستخدام**: مرة واحدة فقط — يُصفَّر `usedAt` فور النجاح.
- **المحاولات**: 5 محاولات كحد أقصى قبل قفل الكود.
- **Rate Limiting**: 3 إرسالات كحد أقصى كل 15 دقيقة لكل قناة.

---

## عدم كشف معلومات الحساب

شاشة "نسيت كلمة المرور" تُعيد دائماً نفس الرسالة العامة:
> "إذا كانت البيانات صحيحة، سيتم إرسال كود الاستعادة."

في جميع الحالات:
- المستخدم غير موجود
- المستخدم موقوف (`isActive = false`)
- الجوال غير محقق
- البريد غير محقق
- الاستعادة غير مفعّلة للقناة المطلوبة
- Rate limit مُتجاوز

---

## تصفير التحقق عند تغيير بيانات التواصل

- تغيير رقم الجوال → `phone_verified_at = NULL` + `recovery_enabled_phone = false`
- تغيير البريد → `email_verified_at = NULL` + `recovery_enabled_email = false`

يجب إعادة التحقق قبل تفعيل الاستعادة من جديد.

---

## شروط تفعيل الاستعادة

| الشرط | الجوال | البريد |
|-------|--------|--------|
| القناة مُدخَلة | `phone IS NOT NULL` | `email IS NOT NULL` |
| محقق | `phone_verified_at IS NOT NULL` | `email_verified_at IS NOT NULL` |
| مُفعَّل يدوياً بالمسؤول | `recovery_enabled_phone = true` | `recovery_enabled_email = true` |

---

## أحداث الأمان المسجّلة (security_events)

| الحدث | eventType |
|-------|-----------|
| إرسال كود تحقق جوال | `verify_phone_sent` |
| نجاح تحقق الجوال | `verify_phone_success` |
| فشل كود تحقق الجوال | `verify_phone_failed` |
| تجاوز محاولات تحقق الجوال | `verify_phone_max_attempts` |
| إرسال كود تحقق بريد | `verify_email_sent` |
| نجاح تحقق البريد | `verify_email_success` |
| فشل كود تحقق البريد | `verify_email_failed` |
| تجاوز محاولات تحقق البريد | `verify_email_max_attempts` |
| طلب استعادة (ناجح) | `password_reset_otp_sent` |
| طلب استعادة (مستخدم موقوف) | `password_reset_suspended_user` |
| طلب استعادة (مستخدم غير موجود/قناة غير متاحة) | `password_reset_request` (failed) |
| Rate limit استعادة | `password_reset_rate_limited` |
| كود استعادة خطأ | `password_reset_verify` (failed) |
| تجاوز محاولات استعادة | `password_reset_max_attempts` |
| نجاح تغيير كلمة المرور | `password_reset_success` |

---

## SMS / Email Provider — الإعداد في Production

حالياً النظام يستخدم Mock في بيئة التطوير.

لتفعيل الإرسال الحقيقي في production، عدّل دالة `mockSend` في:
```
server-app/src/routers/recovery.ts
```

يجب تخزين API keys/passwords في:
- متغيرات البيئة (`.env` أو Replit Secrets)
- لا يجوز تخزينها في الكود أو config.json

مزودون مقترحون:
- **SMS**: Twilio, Unifonic, Taqnyat, Msegat
- **Email**: SendGrid, Nodemailer + SMTP, AWS SES

---

## ضمانات أمانية إضافية

- **لا يوجد Master Password** — لا توجد كلمة مرور رئيسية بأي شكل.
- **لا يوجد Backdoor** — لا توجد أي وسيلة دخول خفية.
- **لا يمكن للمستخدم الموقوف** تسجيل الدخول أو استعادة كلمة المرور.
- **OTP مُشفَّر بـ bcrypt** — حتى لو اخترق أحد قاعدة البيانات لا يستطيع استخدام OTP.
- **reset_token** هو UUID عشوائي — يجب إرساله مع OTP معاً لإتمام العملية.
