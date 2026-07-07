#!/usr/bin/env node
/**
 * OneSoft ERP — Test License Signer
 * Signs a development license using the dev private key.
 *
 * Usage:
 *   node scripts/sign-test-license.js [private_key.pem]
 *
 * Outputs:
 *   test-license.ons      — JSON license file (import into activation screen)
 *   activation-code.txt   — base64url activation code (paste into activation screen)
 *
 * Prerequisites: run `node scripts/keygen.js scripts/keys --dev` first.
 */
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ── Canonical JSON — must match server-app/src/lib/canonicalize.ts ────────────
function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  const sorted = Object.keys(obj).sort();
  return '{' + sorted.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

// ── Load Private Key ──────────────────────────────────────────────────────────
const keyPath = process.argv[2] || path.join(__dirname, 'keys', 'private_key.pem');
if (!fs.existsSync(keyPath)) {
  console.error(`❌ Private key not found: ${keyPath}`);
  console.error('   Run first: node scripts/keygen.js scripts/keys --dev');
  process.exit(1);
}

const privateKeyPem = fs.readFileSync(keyPath, 'utf-8');
const keyObj = crypto.createPrivateKey({
  key:        privateKeyPem,
  passphrase: 'dev-test-key-do-not-use-in-production',
  format:     'pem',
});

// ── Build Test Payload ────────────────────────────────────────────────────────
const today  = new Date();
const expiry = new Date(today.getTime() + 365 * 24 * 3600 * 1000);
const fmt    = d => d.toISOString().split('T')[0];

const payload = {
  v:                1,
  org_id:           'ORG-DEV-0001',
  customer_name:    'شركة الاختبار للتطوير',
  max_users:        50,
  max_pos:          10,
  max_branches:     5,
  max_devices:      10,
  enabled_modules:  ['sales', 'inventory', 'accounting', 'pos', 'purchases', 'hr', 'assets'],
  start_date:       fmt(today),
  expiry_date:      fmt(expiry),
  license_id:       'LIC-DEV-' + Date.now(),
  activation_id:    'ACT-DEV-' + Date.now(),
  issued_at:        today.toISOString(),
  issued_by:        'OneSoft License Center (DEV)',
};

// ── Sign ──────────────────────────────────────────────────────────────────────
// Ed25519: sign canonical payload bytes directly (no extra SHA-256)
const payloadBytes = Buffer.from(canonicalize(payload), 'utf-8');
const signature    = crypto.sign(null, payloadBytes, keyObj);

const signedLicense = {
  alg:     'Ed25519',
  kid:     'onesoft-key-v1',
  payload,
  sig:     signature.toString('base64'),
};

// ── Write Outputs ─────────────────────────────────────────────────────────────
const onsContent  = JSON.stringify(signedLicense, null, 2);
const activCode   = Buffer.from(JSON.stringify(signedLicense)).toString('base64url');

fs.writeFileSync('test-license.ons',    onsContent,  'utf-8');
fs.writeFileSync('activation-code.txt', activCode,   'utf-8');

console.log('✅ test-license.ons created');
console.log(`✅ activation-code.txt created  (${activCode.length} chars)`);
console.log('\n📋 Test data:');
console.log(`   org_id:        ${payload.org_id}`);
console.log(`   customer:      ${payload.customer_name}`);
console.log(`   max_users:     ${payload.max_users}`);
console.log(`   expiry:        ${payload.expiry_date}`);
console.log('\n👉 Import test-license.ons in the activation screen to test.');
