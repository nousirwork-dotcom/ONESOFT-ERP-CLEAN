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
 * ملاحظة: كلمات المرور لا تُحفظ هنا نهائياً.
 *          فقط كود المؤسسة واسمها (من الترخيص).
 */
import * as crypto from 'crypto';
import * as fs     from 'fs';
import * as path   from 'path';
import { getOnesoftDataDir, getOrCreateDeviceId } from './deviceId.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.CLIENT_BUILD === 'true';
const PREFS_FILE_DEV  = 'device.prefs.json';
const PREFS_FILE_PROD = 'device.prefs.enc';
const SALT = 'onesoft-device-prefs-v1';

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

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DevicePrefs {
  savedOrgCode?: string;  // كود المؤسسة (من ملف الترخيص) — للعرض وتسجيل الدخول
  savedOrgName?: string;  // اسم المؤسسة (للعرض فقط)
  // ملاحظة: كلمات المرور لا تُحفظ هنا نهائياً
}

// ─── Load ─────────────────────────────────────────────────────────────────────
export function loadDevicePrefs(): DevicePrefs {
  try {
    const p = getPrefsPath();
    if (!fs.existsSync(p)) return tryLegacyLoad();
    const raw = fs.readFileSync(p);

    if (IS_PRODUCTION) {
      // Encrypted binary
      const json = decrypt(raw);
      return JSON.parse(json) as DevicePrefs;
    } else {
      // Plain JSON (dev)
      const text = raw.toString('utf-8').trim();
      return text ? (JSON.parse(text) as DevicePrefs) : {};
    }
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
    return raw ? (JSON.parse(raw) as DevicePrefs) : {};
  } catch {
    return {};
  }
}

// ─── Save ─────────────────────────────────────────────────────────────────────
export function saveDevicePrefs(patch: Partial<DevicePrefs>): void {
  try {
    const dir     = getOnesoftDataDir();
    fs.mkdirSync(dir, { recursive: true });
    const current = loadDevicePrefs();
    const merged  = { ...current, ...patch };
    const p       = getPrefsPath();

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
    const dir = getOnesoftDataDir();
    fs.mkdirSync(dir, { recursive: true });
    const p = getPrefsPath();

    if (IS_PRODUCTION) {
      const enc = encrypt(JSON.stringify(prefs));
      fs.writeFileSync(p, enc, { mode: 0o600 });
    } else {
      fs.writeFileSync(p, JSON.stringify(prefs, null, 2), { encoding: 'utf-8', mode: 0o600 });
    }
  } catch { /* صامت */ }
}
