/**
 * config-crypto.ts — تشفير واسترجاع الإعدادات الحساسة
 *
 * يستخدم AES-256-GCM لتشفير القيم الحساسة مثل:
 * dbUrl، jwtSecret، مفاتيح API، مفاتيح ZATCA
 *
 * مفتاح التشفير: متغير بيئة ENCRYPTION_KEY أو مشتق من MACHINE_ID
 */
import crypto from 'crypto';
import fs   from 'fs';
import path from 'path';
import os   from 'os';

const ALG     = 'aes-256-gcm';
const ENC_TAG = 'ENC:';

// ── اشتقاق مفتاح التشفير ─────────────────────────────────────────────────────
function deriveKey(): Buffer {
  // 1. متغير بيئة صريح (الأفضل)
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32) {
    return crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest();
  }
  // 2. معرّف الجهاز + اسم المستخدم (مقبول للنشر الفردي)
  const machineId = [
    os.hostname(),
    os.userInfo().username,
    os.platform(),
    os.arch(),
  ].join('|');
  return crypto.createHash('sha256').update('OneSoftERP_' + machineId).digest();
}

// ── تشفير قيمة ───────────────────────────────────────────────────────────────
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = deriveKey();
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const enc  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag  = cipher.getAuthTag();
  // التنسيق: ENC:<iv_hex>.<tag_hex>.<data_hex>
  return ENC_TAG + [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join('.');
}

// ── فكّ تشفير قيمة ──────────────────────────────────────────────────────────
export function decrypt(value: string): string {
  if (!value || !value.startsWith(ENC_TAG)) return value;
  try {
    const [ivHex, tagHex, dataHex] = value.slice(ENC_TAG.length).split('.');
    const key = deriveKey();
    const iv  = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const enc = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc).toString('utf8') + decipher.final('utf8');
  } catch {
    return '';
  }
}

// ── فحص ما إذا كانت القيمة مشفّرة ────────────────────────────────────────────
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(ENC_TAG);
}

// ── تشفير / فكّ تشفير كائن config تلقائياً ──────────────────────────────────
const SENSITIVE_KEYS = ['dbUrl', 'jwtSecret', 'apiKey', 'accessToken', 'password', 'secret', 'privateKey'];

export function encryptConfig(config: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === 'string' && SENSITIVE_KEYS.some(sk => k.toLowerCase().includes(sk.toLowerCase()))) {
      result[k] = encrypt(v);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = encryptConfig(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

export function decryptConfig(config: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === 'string' && isEncrypted(v)) {
      result[k] = decrypt(v);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = decryptConfig(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ── قراءة config.json مع فكّ التشفير ────────────────────────────────────────
export function loadEncryptedConfig(configPath: string): Record<string, any> {
  if (!fs.existsSync(configPath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return decryptConfig(raw);
  } catch { return {}; }
}

// ── حفظ config.json مع التشفير ──────────────────────────────────────────────
export function saveEncryptedConfig(configPath: string, config: Record<string, any>): void {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const encrypted = encryptConfig(config);
  fs.writeFileSync(configPath, JSON.stringify(encrypted, null, 2), 'utf-8');
}
