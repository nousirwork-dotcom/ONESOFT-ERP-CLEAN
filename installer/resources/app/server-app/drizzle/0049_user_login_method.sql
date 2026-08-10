-- طريقة تسجيل الدخول الخاصة بكل مستخدم
-- القيمة الافتراضية 'username' للتوافق مع المستخدمين الحاليين
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_method VARCHAR(30) NOT NULL DEFAULT 'username';

-- المستخدمون الذين كان allowEmailLogin=true يحصلون على 'username_or_email'
UPDATE users SET login_method = 'username_or_email' WHERE allow_email_login = true AND login_method = 'username';
