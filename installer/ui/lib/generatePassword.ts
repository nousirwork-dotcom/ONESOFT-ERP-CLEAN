/**
 * generatePassword.ts
 *
 * يولّد كلمة مرور عشوائية قوية لقاعدة بيانات PostgreSQL محلية (local-install).
 * الهدف: العميل غير التقني لا يجب أن يخترع أو يتذكر كلمة مرور —
 * كل جهاز يحصل على كلمة مرور مختلفة وقوية تلقائياً، ويتم حفظها في
 * onesoft.config.json (مسار محمي)، لا في كود المُثبِّت.
 *
 * يستخدم Web Crypto API (متاح دائماً في renderer الخاص بـ Electron)
 * بدلاً من وحدة crypto في Node، لتجنّب أي تعقيد مع contextIsolation.
 */

// حروف واضحة بصرياً فقط — تم استبعاد الأحرف المتشابهة (0/O, 1/l/I)
// حتى لو احتاج الدعم الفني قراءتها يدوياً من شاشة العميل مستقبلاً.
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%^&*+-=';

export function generateSecurePassword(length = 24): string {
  const bytes = new Uint32Array(length);
  window.crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CHARS[bytes[i]! % CHARS.length];
  }
  return out;
}
