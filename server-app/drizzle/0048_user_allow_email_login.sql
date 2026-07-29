-- السماح لكل مستخدم بتسجيل الدخول بالبريد الإلكتروني (تحكم إضافي بجانب سياسة المنشأة)
-- القيمة الافتراضية false: البريد غير مسموح به إلا إذا فُعِّل صراحةً
ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_email_login BOOLEAN NOT NULL DEFAULT false;
