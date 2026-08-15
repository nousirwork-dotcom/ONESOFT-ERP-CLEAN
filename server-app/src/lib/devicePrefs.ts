/**
 * devicePrefs.ts — إعدادات الجهاز المحلية المشفّرة
 *
 * في الإنتاج (NODE_ENV=production أو CLIENT_BUILD=true):
 *   ملف مشفّر AES-256-GCM بمفتاح مشتق من device_id الجهاز.
 *   المسار: ~/.onesoft/device.prefs.enc  (mode 0o600)
 *
 * في التطوير:
 *   ملف JSON عادي للراحة في الـ debug.
 *   المسار: ~/.onesoft/device.prefs.json  (mode 0o600)
 *
 * ─── قائمة الحقول المسموحة (Whitelist) ───────────────────────────────────────
 *   ✅ organizationCode  — كود المؤسسة (من ملف الترخيص)
 *   ✅ organizationId    — معرّف المؤسسة في قاعدة البيانات
 *   ✅ organizationName  — اسم المؤسسة (للعرض فقط)
 *   ✅ licenseId         — معرّف الترخيص
 *   ✅ deviceId          — معرّف الجهاز (نسخة cached)
 *   ✅ savedOrgCode      — alias قديم لـ organizationCode (backward compat)
 *   ✅ savedOrgName      — alias قديم لـ organizationName (backward compat)
 *
 *   ❌ password / passwordHash / token / secret / privateKey — ممنوع نهائياً
 */
import * as crypto from 'crypto';
import * as fs     from 'fs';
import * as path   from 'path';
import { getOnesoftDataDir, getOrCreateDeviceId } from './deviceId.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.CLIENT_BUILD === 'true';
const PREFS_FILE_DEV  = 'device.prefs.json';
const PREFS_FILE_PROD = 'device.prefs.enc';
const SALT = 'onesoft-device-prefs-v1';

// ─── Allowed fields whitelist ─────────────────────────────────────────────────
// أي حقل خارج هذه القائمة يُرفض ولا يُحفظ
const ALLOWED_PREFS_KEYS = [
  'organizationCode',
  'organizationId',
  'organizationName',
  'licenseId',
  'deviceId',
  'trialFirstInstallAt',
  'trialExpiresAt',
  'trialLicenseState',
  // backward-compat aliases
  'savedOrgCode',
  'savedOrgName',
] as const;

// أنماط الحقول المحظورة — إذا طابق أي مفتاح أحد هذه الأنماط يُرفض فوراً
const FORBIDDEN_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /privateKey/i,
  /private_key/i,
  /apiKey/i,
  /api_key/i,
  /auth/i,
  /credential/i,
  /hash/i,
];

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DevicePrefs {
  organizationCode?: string;  // كود المؤسسة (من ملف الترخيص)
  organizationId?:   string;  // معرّف المؤسسة
  organizationName?: string;  // اسم المؤسسة (للعرض فقط)
  licenseId?:        string;  // معرّف الترخيص
  deviceId?:         string;  // معرّف الجهاز (cached)
  trialFirstInstallAt?: string;
  trialExpiresAt?:      string;
  trialLicenseState?:   'trial' | 'expired' | 'licensed';
  // backward-compat aliases
  savedOrgCode?: string;
  savedOrgName?: string;
}

// ─── Sanitizer — whitelist enforcement ────────────────────────────────────────
function sanitizePrefs(raw: Record<string, unknown>): DevicePrefs {
  const result: DevicePrefs = {};
  for (const key of Object.keys(raw)) {
    // رفض الحقول المحظورة (password, token, secret, ...)
    if (FORBIDDEN_KEY_PATTERNS.some(p => p.test(key))) {
      console.warn(`[devicePrefs] SECURITY: rejected forbidden field "${key}" — passwords/secrets must never be stored`);
      continue;
    }
    // قبول الحقول الموجودة في القائمة البيضاء فقط
    if ((ALLOWED_PREFS_KEYS as readonly string[]).includes(key)) {
      (result as Record<string, unknown>)[key] = raw[key];
    } else {
      console.warn(`[devicePrefs] SECURITY: rejected unknown field "${key}" — not in allowed list`);
    }
  }
  return result;
}

function getPrefsPath(): string {
  return path.join(getOnesoftDataDir(), IS_PRODUCTION ? PREFS_FILE_PROD : PREFS_FILE_DEV);
}

// ─── Crypto helpers ───────────────────────────────────────────────────────────
function deriveKey(): Buffer {
  const deviceId = getOrCreateDeviceId();
  return crypto.scryptSync(deviceId, SALT, 32) as Buffer;
}

function encrypt(plaintext: string): Buffer {
  const key = deriveKey();
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc  = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag  = cipher.getAuthTag();
  // Layout: [iv 12B][tag 16B][ciphertext ...]
  return Buffer.concat([iv, tag, enc]);
}

function decrypt(data: Buffer): string {
  const key   = deriveKey();
  const iv    = data.slice(0, 12);
  const tag   = data.slice(12, 28);
  const enc   = data.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString('utf-8') + decipher.final('utf-8');
}

// ─── Load ─────────────────────────────────────────────────────────────────────
export function loadDevicePrefs(): DevicePrefs {
  try {
    const p = getPrefsPath();
    if (!fs.existsSync(p)) return tryLegacyLoad();
    const raw = fs.readFileSync(p);

    let parsed: Record<string, unknown>;
    if (IS_PRODUCTION) {
      parsed = JSON.parse(decrypt(raw)) as Record<string, unknown>;
    } else {
      const text = raw.toString('utf-8').trim();
      parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    }
    return sanitizePrefs(parsed);
  } catch {
    return {};
  }
}

/** Fallback: read legacy plain JSON if encrypted not found yet (migration) */
function tryLegacyLoad(): DevicePrefs {
  try {
    const legacyPath = path.join(getOnesoftDataDir(), PREFS_FILE_DEV);
    if (!fs.existsSync(legacyPath)) return {};
    const raw = fs.readFileSync(legacyPath, 'utf-8').trim();
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    return sanitizePrefs(parsed);
  } catch {
    return {};
  }
}

// ─── Save ─────────────────────────────────────────────────────────────────────
export function saveDevicePrefs(patch: Partial<DevicePrefs>): void {
  try {
    const dir = getOnesoftDataDir();
    fs.mkdirSync(dir, { recursive: true });

    // فرض القائمة البيضاء على الـ patch قبل الحفظ
    const safePatch = sanitizePrefs(patch as Record<string, unknown>);
    const current   = loadDevicePrefs();
    const merged    = sanitizePrefs({ ...current, ...safePatch } as Record<string, unknown>);

    const p = getPrefsPath();
    if (IS_PRODUCTION) {
      const enc = encrypt(JSON.stringify(merged));
      fs.writeFileSync(p, enc, { mode: 0o600 });
    } else {
      fs.writeFileSync(p, JSON.stringify(merged, null, 2), { encoding: 'utf-8', mode: 0o600 });
    }
  } catch { /* صامت — لا يوقف الخادم */ }
}

// ─── Clear ────────────────────────────────────────────────────────────────────
export function clearDeviceOrgCode(): void {
  try {
    const prefs = loadDevicePrefs();
    delete prefs.savedOrgCode;
    delete prefs.savedOrgName;
    delete prefs.organizationCode;
    delete prefs.organizationName;

    const dir = getOnesoftDataDir();
    fs.mkdirSync(dir, { recursive: true });
    const p = getPrefsPath();
    const safe = sanitizePrefs(prefs as Record<string, unknown>);

    if (IS_PRODUCTION) {
      const enc = encrypt(JSON.stringify(safe));
      fs.writeFileSync(p, enc, { mode: 0o600 });
    } else {
      fs.writeFileSync(p, JSON.stringify(safe, null, 2), { encoding: 'utf-8', mode: 0o600 });
    }
  } catch { /* صامت */ }
}
