# SECURITY — OneSoft ERP

## نظام استعادة كلمة المرور (Multi-Channel OTP)

### قنوات الاستعادة المتاحة

| القناة | الحالة | الشرط |
|--------|--------|-------|
| 📧 Email OTP | دائماً متاح | Mock في dev، SMTP في production |
| 📱 SMS OTP | اختياري | يظهر فقط إذا `SMS_PROVIDER` مضبوط |
| 🛟 Support Recovery | دائماً متاح | Request Code + Device ID → License Center |
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

## Development vs Production

| الجانب | Development (`NODE_ENV ≠ production`) | Production (`NODE_ENV=production`) |
|--------|--------------------------------------|-----------------------------------|
| `devOtp` في response | ✅ يُعاد للتجربة | ❌ **ممنوع تماماً** |
| طباعة OTP في console | ✅ `[OTP-MOCK]` | ❌ **ممنوع تماماً** |
| مزود الإرسال | Mock (console.log) | SMS/SMTP Provider حقيقي |

### ضبط production:
```bash
NODE_ENV=production
SMS_PROVIDER=twilio          # أو unifonic / msegat / تركه فارغاً لتعطيل SMS
SMTP_HOST=mail.company.com
SMTP_PORT=587
SMTP_USER=no-reply@company.com
SMTP_PASS=<secret>           # من Replit Secrets أو .env — لا يُدمَج في الكود
```

### SECURITY: SMS في CLIENT_BUILD
- **ممنوع** تضمين `SMS_PROVIDER` credentials في installer/resources.
- `SMS_PROVIDER` env var يُضبَط على السيرفر فقط، ليس في الـ bundle.

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

## Support Recovery

عند عدم توفر email أو SMS:
1. يعرض النظام: كود المؤسسة، Device ID، Request Code (مولَّد محلياً)
2. المستخدم يرسل Request Code للدعم الفني
3. الدعم يُصدر Support Reset Code من License Center
4. المستخدم يدخل الكود لتغيير كلمة مرورك

Request Code = `{orgCode}-{timestamp36}-{hwConcurrency}-{checksum}`
Device ID = FNV-1a hash (32-bit) لـ UserAgent + Screen + Language

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
