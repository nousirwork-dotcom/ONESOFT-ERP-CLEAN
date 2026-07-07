# SECURITY — OneSoft ERP

## نظام استعادة كلمة المرور (Multi-Channel OTP)

### قنوات الاستعادة المتاحة

| القناة | الحالة | الشرط |
|--------|--------|-------|
| 📧 Email OTP | مشروط | Dev=دائماً. Production=يتطلب SMTP_HOST + SMTP_USER + SMTP_PASSWORD + FROM_EMAIL + EMAIL_ENABLED=true |
| 📱 SMS OTP | مشروط | يتطلب SMS_PROVIDER + SMS_API_URL + SMS_API_KEY + SMS_SENDER_NAME + SMS_ENABLED=true |
| 🛟 Support Recovery | دائماً متاح (Phase 1) | Request Code من backend → Device ID من ملف الجهاز |
| 🔑 Backup Codes | قيد التطوير | لا تحتاج إنترنت |
| 🔐 Authenticator App | قيد التطوير | Google/Microsoft Authenticator |

### كيف يعمل OTP؟

النظام هو الذي يولد OTP ويحفظ Hash له.
مزود SMS/SMTP يوصل الرسالة فقط — لا يعلم بالكود نفسه.

```
generateOtp()  →  hashPassword(otp)  →  DB (hash only)
                                      ↓
                              mockSend/realSend(otp) → User
```

---

## قواعد availability للقنوات (getChannelConfig)

### Email
```
emailEnabled = true  إذا: IS_DEV
             OR (SMTP_HOST && SMTP_USER && SMTP_PASSWORD && FROM_EMAIL && EMAIL_ENABLED=true)
```

### SMS
```
smsEnabled = true  إذا: SMS_PROVIDER && SMS_API_URL && SMS_API_KEY && SMS_SENDER_NAME && SMS_ENABLED=true
```

إذا أي شرط ناقص → القناة لا تظهر في الواجهة نهائياً.

---

## Development vs Production

| الجانب | Development (`NODE_ENV ≠ production`) | Production (`NODE_ENV=production`) |
|--------|--------------------------------------|-----------------------------------|
| `devOtp` في response | ✅ يُعاد للتجربة | ❌ **ممنوع تماماً — empty object** |
| طباعة OTP في console | ✅ `[OTP-MOCK]` | ❌ **ممنوع تماماً — silent return** |
| Email availability | ✅ دائماً (mock) | ✅ فقط إذا SMTP مضبوط كاملاً |
| SMS availability | ✅ إذا SMS_PROVIDER موجود | ✅ فقط إذا جميع 5 متغيرات موجودة |
| مزود الإرسال | Mock (console.log) | SMS/SMTP Provider حقيقي |

### ضبط production — متغيرات البيئة المطلوبة:
```bash
NODE_ENV=production

# Email OTP
EMAIL_ENABLED=true
SMTP_HOST=mail.company.com
SMTP_PORT=587
SMTP_USER=no-reply@company.com
SMTP_PASSWORD=<secret>      # Server env only — لا تُدمَج في installer
FROM_EMAIL=no-reply@company.com

# SMS OTP (اختياري — لا يُفعَّل إلا إذا ضبطت الكل)
SMS_ENABLED=true
SMS_PROVIDER=twilio          # أو unifonic / msegat
SMS_API_URL=https://api.twilio.com/...
SMS_API_KEY=<secret>         # Server env only — لا تُدمَج في installer
SMS_SENDER_NAME=OneSoft
```

### SECURITY: لا credentials في CLIENT_BUILD
- **ممنوع** تضمين SMTP_PASSWORD أو SMS_API_KEY في installer/resources.
- جميع credentials تُضبَط على السيرفر فقط، لا في الـ bundle.

---

## قواعد OTP الأمنية

| القاعدة | القيمة |
|---------|--------|
| التخزين | bcrypt hash فقط — لا plaintext في DB |
| مدة الصلاحية | 10 دقائق (`OTP_EXPIRY_MS`) |
| الاستخدام | مرة واحدة فقط (`usedAt` يُصفَّر فور النجاح) |
| حد المحاولات | 5 محاولات كحد أقصى (`MAX_OTP_ATTEMPTS`) |
| Rate Limiting (إرسال) | 3 إرسالات كحد / 15 دقيقة (`MAX_OTP_SENDS_PER_15MIN`) |

---

## عدم كشف معلومات الحساب

`requestPasswordReset` تُعيد دائماً نفس الرسالة:
> "إذا كانت البيانات صحيحة، سيتم إرسال كود الاستعادة."

في **جميع** الحالات:
- المستخدم غير موجود
- المستخدم موقوف (`isActive = false`)
- الجوال غير محقق / البريد غير محقق
- الاستعادة غير مفعّلة للقناة المطلوبة
- Rate limit مُتجاوز

---

## تصفير التحقق عند تغيير بيانات التواصل

| التغيير | التأثير |
|---------|---------|
| تغيير رقم الجوال | `phone_verified_at = NULL` + `recovery_enabled_phone = false` |
| تغيير البريد | `email_verified_at = NULL` + `recovery_enabled_email = false` |

يجب إعادة التحقق قبل تفعيل الاستعادة من جديد.

---

## شروط تفعيل الاستعادة

لا يمكن تفعيل Recovery Channel إلا بعد:
1. إدخال رقم الجوال / البريد
2. التحقق منه (`phone_verified_at / email_verified_at IS NOT NULL`)
3. تفعيل الخيار يدوياً من المسؤول (`recovery_enabled_phone/email = true`)

---

## أحداث الأمان المسجّلة (security_events)

| الحدث | `eventType` | `result` |
|-------|-------------|---------|
| إرسال كود تحقق جوال | `verify_phone_sent` | success |
| نجاح تحقق الجوال | `verify_phone_success` | success |
| فشل كود تحقق الجوال | `verify_phone_failed` | failed |
| تجاوز محاولات تحقق الجوال | `verify_phone_max_attempts` | failed |
| إرسال كود تحقق بريد | `verify_email_sent` | success |
| نجاح تحقق البريد | `verify_email_success` | success |
| فشل كود تحقق البريد | `verify_email_failed` | failed |
| تجاوز محاولات تحقق البريد | `verify_email_max_attempts` | failed |
| طلب استعادة (مرسَل) | `password_reset_otp_sent` | success |
| طلب استعادة (مستخدم موقوف) | `password_reset_suspended_user` | failed |
| طلب استعادة (لم يُرسَل) | `password_reset_request` | failed |
| Rate limit استعادة | `password_reset_rate_limited` | failed |
| كود استعادة خطأ | `password_reset_verify` | failed |
| تجاوز محاولات استعادة | `password_reset_max_attempts` | failed |
| نجاح تغيير كلمة المرور | `password_reset_success` | success |

---

## Support Recovery — المرحلة الأولى (Phase 1)

**⚠ المرحلة الأولى: Request Code للمرجعية فقط. Phase 2 سيضيف التحقق الكامل عبر License Center.**

### ما يعرضه النظام:
| الحقل | المصدر | الوصف |
|-------|--------|-------|
| Device ID | `C:\ProgramData\OneSoft\device_id` | UUID ثابت مولَّد مرة واحدة عند التثبيت |
| Device ID (مختصر) | آخر 12 حرف من UUID | للعرض السريع |
| Hardware Fingerprint | hostname + platform + arch + MAC addresses | SHA-256 أول 16 حرف |
| Request Code | backend (nonce + timestamp36 + devShort + org + checksum) | صالح ساعة واحدة |

### Request Code — بنية الكود:
```
{ORG}-{DEVID8}-{TS_MINUTE_BASE36}-{NONCE_HEX4}-{CHECKSUM2}

مثال: MYCO-A1B2C3D4-KP7X2-3F9A-72
```
- `ORG` = كود المؤسسة (max 6 حروف)
- `DEVID8` = أول 8 أحرف من Device UUID (بدون dashes)
- `TS_MINUTE_BASE36` = Unix timestamp/60 بـ base36
- `NONCE_HEX4` = 4 bytes عشوائية من `crypto.randomBytes()`
- `CHECKSUM2` = مجموع ASCII لجميع الأحرف mod 97

### تسجيل في security_events:
كل طلب لـ Request Code يُسجَّل بـ `eventType = support_recovery_request_code_generated`.

### المرحلة الثانية (مستقبلاً):
- License Center يستقبل Request Code
- الأدمن يصدر Support Reset Code أو ملف `support-recovery.ons`
- العميل يستورد الملف
- يتم التحقق من التوقيع (Ed25519)
- يُسمح بإعادة تعيين كلمة مرور admin أو إنشاء support-temp مؤقت
- **لا يوجد Master Password أو Backdoor بأي شكل**

---

## ضمانات لا تقبل الاستثناء

- **لا يوجد Master Password** — بأي شكل.
- **لا يوجد Backdoor** — لا باب خلفي.
- **OTP مُشفَّر بـ bcrypt** — حتى مع اختراق DB لا يُعاد استخدامه.
- **reset_token** = UUID عشوائي — يجب إرساله مع OTP معاً.
- **المستخدم الموقوف** لا يستطيع تسجيل الدخول أو استعادة كلمة المرور.
- **SMS credentials** لا تُدمَج في client installer أبداً.

---

## SMS / Email Provider — الإعداد في Production

الكود الموجود في `mockSend()`:
```typescript
// server-app/src/routers/recovery.ts → function mockSend()
if (!IS_DEV) {
  // أضف هنا: await twilioClient.messages.create({ to: target, body: `كود: ${otp}` });
  return;
}
```

مزودون مقترحون:
- **SMS**: Twilio, Unifonic, Msegat, Taqnyat
- **Email**: Nodemailer + SMTP, SendGrid, AWS SES
