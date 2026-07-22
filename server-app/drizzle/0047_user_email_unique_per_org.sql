-- البريد الإلكتروني فريد داخل نفس المؤسسة (غير حساس للأحرف)
-- يتجاهل القيم الفارغة (NULL أو مسافات) لأن البريد اختياري
CREATE UNIQUE INDEX IF NOT EXISTS users_org_email_unique_lower
  ON users (org_id, lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';
