#!/usr/bin/env node
/**
 * OneSoft ERP — Ed25519 Key Generator
 *
 * Usage:
 *   node scripts/keygen.js [output-dir] [--password=YOUR_PASS] [--dev]
 *
 * Examples:
 *   node scripts/keygen.js --dev                    # test keys (fixed password)
 *   node scripts/keygen.js license-center/keys      # prompts for password
 *   node scripts/keygen.js scripts/keys --password=abc123
 *
 * NEVER commit private_key.pem to git.
 * public_key.pem is safe to commit (embed in client build).
 */
const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const args     = process.argv.slice(2);
const outDir   = args.find(a => !a.startsWith('--')) || '.';
const passArg  = args.find(a => a.startsWith('--password='));
const isDev    = args.includes('--dev');

const DEV_PASS = 'dev-test-key-do-not-use-in-production';

async function getPassword() {
  if (isDev)    return DEV_PASS;
  if (passArg)  return passArg.split('=')[1];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question('Passphrase for private key (empty = no encryption): ', ans => {
      rl.close(); resolve(ans.trim());
    });
  });
}

async function main() {
  const password = await getPassword();

  const encoding = password
    ? { type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: password }
    : { type: 'pkcs8', format: 'pem' };

  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: encoding,
    publicKeyEncoding:  { type: 'spki', format: 'pem' },
  });

  fs.mkdirSync(outDir, { recursive: true });

  const privPath = path.join(outDir, 'private_key.pem');
  const pubPath  = path.join(outDir, 'public_key.pem');

  fs.writeFileSync(privPath, privateKey, { mode: 0o600 });
  fs.writeFileSync(pubPath,  publicKey);

  console.log('\n✅ Ed25519 keys generated successfully');
  console.log(`   Private: ${privPath}  ← NEVER commit this`);
  console.log(`   Public:  ${pubPath}   ← safe to embed in client`);
  if (isDev) console.log(`   Password: ${DEV_PASS}`);

  console.log('\n📋 Embed this in server-app/src/lib/license.ts:');
  console.log('const PUBLIC_KEY_PEM =');
  console.log(JSON.stringify(publicKey) + ';');
}

main().catch(e => { console.error(e.message); process.exit(1); });
