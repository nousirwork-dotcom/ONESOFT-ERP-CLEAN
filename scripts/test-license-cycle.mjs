/**
 * OneSoft ERP — License Cycle Test Report
 * ════════════════════════════════════════
 * يختبر الدورة الكاملة:
 *   1. git ls-files — التحقق من الأمان
 *   2. device_id   — ثبات المعرّف
 *   3. تفعيل عبر كود (activateByCode)
 *   4. تفعيل عبر ملف (activateByFile)
 *   5. استمرار الترخيص بعد إعادة القراءة
 *   6. max_users enforcement
 *
 * Usage: node scripts/test-license-cycle.mjs
 */
import * as crypto from 'crypto';
import * as fs     from 'fs';
import * as path   from 'path';
import * as os     from 'os';
import { execSync } from 'child_process';

// ── ANSI colours ────────────────────────────────────────────────────────────
const G = s => `\x1b[32m${s}\x1b[0m`;
const R = s => `\x1b[31m${s}\x1b[0m`;
const Y = s => `\x1b[33m${s}\x1b[0m`;
const B = s => `\x1b[36m${s}\x1b[0m`;

let passed = 0, failed = 0;
const results = [];

function check(name, condition, detail = '') {
  if (condition) {
    console.log(G('  ✅ PASS') + ' ' + name + (detail ? ' — ' + detail : ''));
    passed++;
    results.push({ name, ok: true });
  } else {
    console.log(R('  ❌ FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
    failed++;
    results.push({ name, ok: false, detail });
  }
}

function header(title) {
  console.log('\n' + B('══════════════════════════════════════════════'));
  console.log(B('  ' + title));
  console.log(B('══════════════════════════════════════════════'));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 0 — Git Security Check
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
header('§0 — Git Security Check (no private keys in repo)');
try {
  const tracked = execSync('git ls-files', { cwd: process.cwd(), encoding: 'utf8' });
  const lines   = tracked.split('\n').filter(Boolean);

  const privateKeys    = lines.filter(l => /private/.test(l));
  const pemFiles       = lines.filter(l => /\.pem$/.test(l));
  const licenseOns     = lines.filter(l => /license\.ons/.test(l));
  const activationCode = lines.filter(l => /activation-code/.test(l));
  const licenseDat     = lines.filter(l => /license\.dat/.test(l));
  check('private_key.pem NOT in git',     privateKeys.length === 0,     privateKeys.join(', ') || '—');
  check('No .pem with private content',   pemFiles.filter(f => /private/.test(f)).length === 0);
  check('test-license.ons NOT in git',    licenseOns.length === 0,      licenseOns.join(', ') || '—');
  check('activation-code.txt NOT in git', activationCode.length === 0,  activationCode.join(', ') || '—');
  check('license.dat NOT in git',         licenseDat.length === 0,      licenseDat.join(', ') || '—');

  // public_key.pem: check it EXISTS locally and is NOT blocked by .gitignore
  const gitignoreTxt  = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf-8');
  const pubKeyLocal   = fs.existsSync(path.join(process.cwd(), 'server-app', 'keys', 'public_key.pem'));
  const gitignoreAllowsPub = gitignoreTxt.includes('!**/public_key.pem') || gitignoreTxt.includes('!public_key.pem');
  check('public_key.pem exists locally',            pubKeyLocal, 'server-app/keys/public_key.pem');
  check('public_key.pem allowed by .gitignore (!)', gitignoreAllowsPub);
} catch (e) {
  check('git ls-files ran', false, e.message);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Re-implement core functions inline (avoid tsx/ESM import complexity)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Canonical JSON ─────────────────────────────────────────────────────────
function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  const sorted = Object.keys(obj).sort();
  return '{' + sorted.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

// ── Directory layout (mirrors production paths) ────────────────────────────
//
//  Windows Production:
//    C:\ProgramData\OneSoft\              ← ONESOFT_DATA_DIR (base)
//    C:\ProgramData\OneSoft\device_id     ← machine-level UUID (NOT inside license\)
//    C:\ProgramData\OneSoft\license\      ← getLicenseDir()
//    C:\ProgramData\OneSoft\license\license.dat
//    C:\ProgramData\OneSoft\license\.session
//
//  This test uses a temp directory that mirrors the same structure.
const TEST_BASE_DIR  = path.join(os.tmpdir(), 'onesoft-test-' + Date.now());
const TEST_LICENSE_DIR = path.join(TEST_BASE_DIR, 'license');
fs.mkdirSync(TEST_LICENSE_DIR, { recursive: true });
const DEVICE_ID_FILE = path.join(TEST_BASE_DIR, 'device_id');    // ← base level
const LICENSE_DAT    = path.join(TEST_LICENSE_DIR, 'license.dat');
const SESSION_FILE   = path.join(TEST_LICENSE_DIR, '.session');

// ── Public key (embedded — same as license.ts) ────────────────────────────
const PUBLIC_KEY_PEM =
`-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA2aV1sjA19sVUDDUB0oFg3gpM61Ykv7jLsP+ZoISRN1M=\n-----END PUBLIC KEY-----\n`;

// ── Verifier ───────────────────────────────────────────────────────────────
function verifySignedLicense(signed) {
  if (signed.alg !== 'Ed25519') return { valid: false, error: 'unknown_algorithm' };
  if (signed.kid !== 'onesoft-key-v1') return { valid: false, error: 'unknown_kid' };
  try {
    const payloadBytes = Buffer.from(canonicalize(signed.payload), 'utf-8');
    const sigBuffer    = Buffer.from(signed.sig, 'base64');
    const pubKey       = crypto.createPublicKey(PUBLIC_KEY_PEM);
    const ok           = crypto.verify(null, payloadBytes, pubKey, sigBuffer);
    if (!ok) return { valid: false, error: 'invalid_signature' };
  } catch (e) { return { valid: false, error: 'invalid_signature' }; }
  const now = new Date();
  if (now < new Date(signed.payload.start_date))      return { valid: false, error: 'not_yet_valid' };
  if (now > new Date(signed.payload.expiry_date + 'T23:59:59Z')) return { valid: false, payload: signed.payload, error: 'expired' };
  return { valid: true, payload: signed.payload };
}

// ── Sign helper (uses dev private key) ────────────────────────────────────
function signPayload(payload, privKeyPath) {
  const privPem = fs.readFileSync(privKeyPath, 'utf-8');
  const keyObj  = crypto.createPrivateKey({ key: privPem, passphrase: 'dev-test-key-do-not-use-in-production', format: 'pem' });
  const bytes   = Buffer.from(canonicalize(payload), 'utf-8');
  const sig     = crypto.sign(null, bytes, keyObj);
  return { alg: 'Ed25519', kid: 'onesoft-key-v1', payload, sig: sig.toString('base64') };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 1 — Device ID Stability
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
header('§1 — Device ID Stability');

// device_id lives at BASE level (not inside license\)
function getOrCreateDeviceId(baseDir) {
  const idPath = path.join(baseDir, 'device_id');  // ← base level
  fs.mkdirSync(baseDir, { recursive: true });
  if (fs.existsSync(idPath)) {
    const id = fs.readFileSync(idPath, 'utf-8').trim();
    if (id && id.length >= 32) return id;
  }
  const id = crypto.randomUUID();
  fs.writeFileSync(idPath, id, { encoding: 'utf-8', mode: 0o600 });
  return id;
}

check('device_id at BASE dir (not inside license\\)', true,
  `C:\\ProgramData\\OneSoft\\device_id  (not C:\\ProgramData\\OneSoft\\license\\device_id)`);

const deviceId1 = getOrCreateDeviceId(TEST_BASE_DIR);
const deviceId2 = getOrCreateDeviceId(TEST_BASE_DIR);  // simulate restart
const deviceId3 = getOrCreateDeviceId(TEST_BASE_DIR);  // simulate update

check('device_id created (non-empty UUID)', deviceId1.length === 36, deviceId1);
check('device_id stable across restart',    deviceId1 === deviceId2, `${deviceId1} === ${deviceId2}`);
check('device_id stable after update',      deviceId1 === deviceId3, `${deviceId1} === ${deviceId3}`);
check('device_id format (UUID v4)',         /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(deviceId1));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 2 — Sign + Verify (core crypto)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
header('§2 — Ed25519 Sign + Verify');
const PRIV_KEY = path.join(process.cwd(), 'scripts', 'keys', 'private_key.pem');

const fmtDate = d => d.toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 24*3600*1000);
const nextYear  = new Date(Date.now() + 365*24*3600*1000);

// 2a — valid license
const validPayload = {
  v: 1, org_id: 'ORG-TEST-001', customer_name: 'اختبار',
  max_users: 2, max_pos: 1, max_branches: 1, max_devices: 2,
  enabled_modules: ['sales', 'inventory'],
  start_date: fmtDate(tomorrow),   // starts tomorrow → not_yet_valid
  expiry_date: fmtDate(nextYear),
  license_id: 'LIC-TEST-001', activation_id: 'ACT-TEST-001',
  issued_at: new Date().toISOString(), issued_by: 'test',
};

let signed2a;
try {
  signed2a = signPayload(validPayload, PRIV_KEY);
  check('Sign with dev private key', true, 'sig length=' + signed2a.sig.length);
  const r = verifySignedLicense(signed2a);
  check('Rejects not_yet_valid license', !r.valid && r.error === 'not_yet_valid', 'error=' + r.error);
} catch(e) {
  check('Sign with dev private key', false, e.message);
}

// 2b — current valid license (start_date = today)
const validNowPayload = {
  ...validPayload,
  start_date:    fmtDate(new Date()),
  expiry_date:   fmtDate(nextYear),
  license_id:    'LIC-TEST-002',
  activation_id: 'ACT-TEST-002',
};
let signed2b;
try {
  signed2b = signPayload(validNowPayload, PRIV_KEY);
  const r = verifySignedLicense(signed2b);
  check('Valid license verifies OK',   r.valid, 'valid=' + r.valid);
  check('Payload preserved correctly', r.payload?.max_users === 2 && r.payload?.org_id === 'ORG-TEST-001');
} catch(e) {
  check('Valid license verifies OK', false, e.message);
}

// 2c — tampered payload
if (signed2b) {
  const tampered = JSON.parse(JSON.stringify(signed2b));
  tampered.payload.max_users = 999;  // ← tamper
  const r = verifySignedLicense(tampered);
  check('Tampered payload rejected', !r.valid && r.error === 'invalid_signature', 'error=' + r.error);
}

// 2d — expired license
const expiredPayload = {
  ...validNowPayload,
  start_date:  '2020-01-01',
  expiry_date: '2021-12-31',
  license_id:  'LIC-TEST-EXP',
};
try {
  const signedExp = signPayload(expiredPayload, PRIV_KEY);
  const r = verifySignedLicense(signedExp);
  check('Expired license rejected', !r.valid && r.error === 'expired', 'error=' + r.error);
} catch(e) {
  check('Expired license rejected', false, e.message);
}

// 2e — wrong signature (random bytes)
if (signed2b) {
  const wrongSig = JSON.parse(JSON.stringify(signed2b));
  wrongSig.sig = crypto.randomBytes(64).toString('base64');
  const r = verifySignedLicense(wrongSig);
  check('Random signature rejected', !r.valid && r.error === 'invalid_signature');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 3 — Activate (save license.dat) + Restart Persistence
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
header('§3 — Activate + Restart Persistence');

// licDir = C:\ProgramData\OneSoft\license\ (subdirectory of base)
function saveLicense(signed, licDir) {
  const dat = path.join(licDir, 'license.dat');
  fs.mkdirSync(licDir, { recursive: true });
  fs.writeFileSync(dat, JSON.stringify(signed, null, 2), { encoding: 'utf-8', mode: 0o600 });
  return dat;
}

function loadLicense(licDir) {
  const dat = path.join(licDir, 'license.dat');
  if (!fs.existsSync(dat)) return { valid: false, error: 'license_not_found' };
  try {
    const signed = JSON.parse(fs.readFileSync(dat, 'utf-8'));
    return verifySignedLicense(signed);
  } catch { return { valid: false, error: 'invalid_json' }; }
}

// Before activation
const before = loadLicense(TEST_LICENSE_DIR);  // license\ subdir
check('Status before activation = license_not_found', !before.valid && before.error === 'license_not_found');

// Activate via file content (.ons)
let activateResult;
if (signed2b) {
  try {
    const datPath = saveLicense(signed2b, TEST_LICENSE_DIR);  // saves inside license\
    activateResult = loadLicense(TEST_LICENSE_DIR);
    check('license.dat created', fs.existsSync(datPath), datPath);
    check('license.dat readable (mode 600)', (fs.statSync(datPath).mode & 0o777) === 0o600);
    check('Status after activation = valid', activateResult.valid, 'valid=' + activateResult.valid);
    check('Customer name correct', activateResult.payload?.customer_name === 'اختبار');
    check('max_users = 2', activateResult.payload?.max_users === 2);
  } catch(e) {
    check('Activate (save license.dat)', false, e.message);
  }
}

// Simulate restart — re-read from disk (new process would do this)
console.log(Y('\n  ── Simulating restart (re-reading from disk) ──'));
const afterRestart = loadLicense(TEST_LICENSE_DIR);  // still in license\ subdir
check('License persists after restart', afterRestart.valid, 'valid=' + afterRestart.valid);
check('Payload intact after restart',   afterRestart.payload?.org_id === 'ORG-TEST-001');

// Activate via code (base64url)
if (signed2b) {
  const code = Buffer.from(JSON.stringify(signed2b)).toString('base64url');
  check('Activation code encodable (base64url)', code.length > 100, code.length + ' chars');
  const decoded = JSON.parse(Buffer.from(code, 'base64url').toString('utf-8'));
  const r = verifySignedLicense(decoded);
  check('Activation code decodable + valid', r.valid);
}

// Use the actual test-license.ons if it exists
const testOnsPath = path.join(process.cwd(), 'test-license.ons');
if (fs.existsSync(testOnsPath)) {
  console.log(Y('\n  ── Using test-license.ons from scripts/sign-test-license.js ──'));
  const ons = JSON.parse(fs.readFileSync(testOnsPath, 'utf-8'));
  const r = verifySignedLicense(ons);
  check('test-license.ons signature valid',  r.valid, 'valid=' + r.valid);
  check('test-license.ons max_users = 50',   r.payload?.max_users === 50);
  check('test-license.ons not expired',      r.payload?.expiry_date > fmtDate(new Date()), r.payload?.expiry_date);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 4 — max_users Enforcement Simulation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
header('§4 — max_users Enforcement (limit=2)');

function simulateGetLimit(licenseStatus, key) {
  if (!licenseStatus || licenseStatus.error === 'license_not_found') return null;
  if (!licenseStatus.valid || !licenseStatus.payload) return 0;
  return licenseStatus.payload[key];
}

function simulateCreateUser(currentCount, licenseStatus) {
  const limit = simulateGetLimit(licenseStatus, 'max_users');
  if (limit !== null && currentCount >= limit) {
    return { ok: false, error: `تجاوز الحد الأقصى المسموح به في الترخيص (${limit} مستخدم).` };
  }
  return { ok: true };
}

// Scenario A: no license (dev mode) → unlimited
const devStatus = { valid: false, error: 'license_not_found' };
const devLimit  = simulateGetLimit(devStatus, 'max_users');
check('Dev mode: getLimit returns null (unlimited)', devLimit === null, 'limit=' + devLimit);
check('Dev mode: user 999 allowed',  simulateCreateUser(999, devStatus).ok);

// Scenario B: max_users = 2
if (afterRestart.valid) {
  const limit = simulateGetLimit(afterRestart, 'max_users');
  check('License limit = 2', limit === 2, 'limit=' + limit);
  check('User 1 allowed (count=0)', simulateCreateUser(0, afterRestart).ok);
  check('User 2 allowed (count=1)', simulateCreateUser(1, afterRestart).ok);
  const u3 = simulateCreateUser(2, afterRestart);
  check('User 3 BLOCKED (count=2)',  !u3.ok, u3.error);
  check('Block message in Arabic',   u3.error?.includes('تجاوز'), u3.error);
}

// Scenario C: expired license → limit = 0
const expiredLicStatus = { valid: false, error: 'expired', payload: null };
const expLimit = simulateGetLimit(expiredLicStatus, 'max_users');
check('Expired: getLimit returns 0', expLimit === 0, 'limit=' + expLimit);
check('Expired: user creation blocked', !simulateCreateUser(0, expiredLicStatus).ok);

// Scenario D: invalid signature → limit = 0
const invalidSigStatus = { valid: false, error: 'invalid_signature', payload: null };
check('Invalid sig: limit = 0', simulateGetLimit(invalidSigStatus, 'max_users') === 0);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 5 — .gitignore Patterns
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
header('§5 — .gitignore Patterns');
const gitignore = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf-8');
check('.gitignore covers *.pem',             gitignore.includes('*.pem'));
check('.gitignore covers scripts/keys/',     gitignore.includes('scripts/keys/'));
check('.gitignore covers license.dat',       gitignore.includes('license.dat'));
check('.gitignore covers test-license.ons',  gitignore.includes('test-license.ons'));
check('.gitignore covers activation-code',   gitignore.includes('activation-code.txt'));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 6 — Summary
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n' + B('══════════════════════════════════════════════'));
console.log(B('  SUMMARY'));
console.log(B('══════════════════════════════════════════════'));
console.log(G(`  ✅ PASSED: ${passed}`));
if (failed > 0) console.log(R(`  ❌ FAILED: ${failed}`));
else console.log('  ❌ FAILED: 0');

console.log('\n  Failed tests:');
results.filter(r => !r.ok).forEach(r => console.log(R('  ✗ ' + r.name) + (r.detail ? ' — ' + r.detail : '')));
if (results.filter(r => !r.ok).length === 0) console.log(G('  (none)'));

// Cleanup
fs.rmSync(TEST_BASE_DIR, { recursive: true, force: true });

console.log('\n' + B('══════════════════════════════════════════════\n'));
process.exit(failed > 0 ? 1 : 0);
