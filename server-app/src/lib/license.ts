import * as crypto from 'crypto';
import * as fs     from 'fs';
import { canonicalize }     from './canonicalize.js';
import {
  getLicenseDatPath,
  getLicenseDir,
  readLastSeen,
} from './deviceId.js';

// ─── Public Key ───────────────────────────────────────────────────────────────
// This is the DEV test key — replace with production key before release.
// The private key is NEVER in this file or in the client build.
// To rotate: run `node scripts/keygen.js` and update this constant.
const PUBLIC_KEY_PEM =
`-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA2aV1sjA19sVUDDUB0oFg3gpM61Ykv7jLsP+ZoISRN1M=\n-----END PUBLIC KEY-----\n`;

// Supported key IDs — add new kid when rotating keys
const KNOWN_KIDS = new Set(['onesoft-key-v1']);

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LicensePayload {
  v:               number;
  org_id:          string;
  customer_name:   string;
  max_users:       number;
  max_pos:         number;
  max_branches:    number;
  max_devices:     number;
  enabled_modules: string[];
  start_date:      string;
  expiry_date:     string;
  device_id?:      string;
  license_id:      string;
  activation_id:   string;
  issued_at:       string;
  issued_by:       string;
}

export interface SignedLicense {
  alg:     string;
  kid:     string;
  payload: LicensePayload;
  sig:     string;
}

export type LicenseError =
  | 'license_not_found'
  | 'invalid_json'
  | 'unknown_algorithm'
  | 'unknown_kid'
  | 'invalid_signature'
  | 'expired'
  | 'not_yet_valid'
  | 'date_manipulation_suspected'
  | 'read_error';

export interface LicenseStatus {
  valid:   boolean;
  payload?: LicensePayload;
  error?:  LicenseError;
}

// ─── Cache ────────────────────────────────────────────────────────────────────
let _cache: LicenseStatus | null = null;

export function invalidateLicenseCache(): void {
  _cache = null;
}

// ─── Core Verifier ────────────────────────────────────────────────────────────
export function verifySignedLicense(signed: SignedLicense): LicenseStatus {
  // 1. Check algorithm
  if (signed.alg !== 'Ed25519') {
    return { valid: false, error: 'unknown_algorithm' };
  }

  // 2. Check key ID
  if (!KNOWN_KIDS.has(signed.kid)) {
    return { valid: false, error: 'unknown_kid' };
  }

  // 3. Verify Ed25519 signature
  //    Ed25519 signs canonical_payload_bytes directly (no extra hash)
  try {
    const payloadBytes = Buffer.from(canonicalize(signed.payload), 'utf-8');
    const sigBuffer    = Buffer.from(signed.sig, 'base64');
    const pubKey       = crypto.createPublicKey(PUBLIC_KEY_PEM);
    const ok           = crypto.verify(null, payloadBytes, pubKey, sigBuffer);
    if (!ok) return { valid: false, error: 'invalid_signature' };
  } catch {
    return { valid: false, error: 'invalid_signature' };
  }

  const p   = signed.payload;
  const now = new Date();

  // 4. Check start_date
  if (now < new Date(p.start_date)) {
    return { valid: false, error: 'not_yet_valid' };
  }

  // 5. Check expiry
  if (now > new Date(p.expiry_date + 'T23:59:59Z')) {
    return { valid: false, payload: p, error: 'expired' };
  }

  // 6. Check date manipulation (tamper detection aid)
  const lastSeen = readLastSeen();
  if (lastSeen) {
    const diffMs = lastSeen.getTime() - now.getTime();
    if (diffMs > 7 * 24 * 3600 * 1000) {           // clock went back > 7 days
      return { valid: false, payload: p, error: 'date_manipulation_suspected' };
    }
  }

  return { valid: true, payload: p };
}

// ─── Load from Disk ───────────────────────────────────────────────────────────
export function loadLicense(): LicenseStatus {
  const datPath = getLicenseDatPath();

  if (!fs.existsSync(datPath)) {
    return { valid: false, error: 'license_not_found' };
  }

  try {
    const raw    = fs.readFileSync(datPath, 'utf-8');
    const signed = JSON.parse(raw) as SignedLicense;
    return verifySignedLicense(signed);
  } catch {
    return { valid: false, error: 'invalid_json' };
  }
}

// ─── Save to Disk ─────────────────────────────────────────────────────────────
export function saveLicense(signed: SignedLicense): void {
  const dir     = getLicenseDir();
  const datPath = getLicenseDatPath();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(datPath, JSON.stringify(signed, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Returns cached license status. Loads from disk on first call.
 */
export function getLicense(): LicenseStatus {
  if (_cache) return _cache;
  _cache = loadLicense();
  return _cache;
}

/**
 * Checks whether a module is enabled in the current license.
 * If no license is installed (dev mode), all modules are allowed.
 */
export function isModuleAllowed(moduleId: string): boolean {
  const lic = getLicense();
  if (lic.error === 'license_not_found') return true; // dev mode: unrestricted
  if (!lic.valid || !lic.payload) return false;
  return lic.payload.enabled_modules.includes(moduleId);
}

/**
 * Checks a numeric limit (users, branches, pos).
 * If no license is installed, returns null (no limit enforced).
 * If expired/invalid, returns 0 (nothing allowed).
 */
export function getLimit(key: 'max_users' | 'max_branches' | 'max_pos' | 'max_devices'): number | null {
  const lic = getLicense();
  if (lic.error === 'license_not_found') return null; // dev mode
  if (!lic.valid || !lic.payload) return 0;
  return lic.payload[key];
}
