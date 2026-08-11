/**
 * bump-version.mjs — رفع رقم الإصدار + commit + tag + push
 *
 * الاستخدام:
 *   node scripts/bump-version.mjs patch   ← 1.0.0 → 1.0.1
 *   node scripts/bump-version.mjs minor   ← 1.0.0 → 1.1.0
 *   node scripts/bump-version.mjs major   ← 1.0.0 → 2.0.0
 */

import * as fs           from 'fs';
import * as path         from 'path';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const INSTALLER   = path.resolve(__dirname, '..');
const ROOT        = path.resolve(INSTALLER, '..');
const VERSION_PATH = path.join(ROOT, 'version.json');
const PKG_PATH    = path.join(INSTALLER, 'package.json');
const YML_PATH    = path.join(INSTALLER, 'electron-builder.yml');

const bumpType = process.argv[2] ?? 'patch';
if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error(`❌ نوع غير صحيح: "${bumpType}". استخدم: patch | minor | major`);
  process.exit(1);
}

// ── قراءة الإصدار الحالي من المصدر الموحد ─────────────────────────
const versionInfo = JSON.parse(fs.readFileSync(VERSION_PATH, 'utf8'));
const current = versionInfo.version;
const parts   = current.split('.').map(Number);

if (bumpType === 'patch') parts[2]++;
if (bumpType === 'minor') { parts[1]++; parts[2] = 0; }
if (bumpType === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }

const next = parts.join('.');
console.log(`\n  📦 رفع الإصدار: ${current} → ${next}  (${bumpType})\n`);

// ── تحديث المصدر الموحد وحزم المنتج ───────────────────────────────
versionInfo.version = next;
fs.writeFileSync(VERSION_PATH, JSON.stringify(versionInfo, null, 2) + '\n', 'utf8');
for (const packagePath of [
  PKG_PATH,
  path.join(ROOT, 'client-app', 'package.json'),
  path.join(ROOT, 'server-app', 'package.json'),
]) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  pkg.version = next;
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}
console.log(`  ✅ installer/package.json → ${next}`);

// ── تحديث electron-builder.yml ───────────────────────────────────
let yml = fs.readFileSync(YML_PATH, 'utf8');
yml = yml.replace(/^(extraMetadata:\s*\n\s*version:\s*")[^"]+(")/m, `$1${next}$2`);
fs.writeFileSync(YML_PATH, yml, 'utf8');
console.log(`  ✅ installer/electron-builder.yml → ${next}`);

console.log(`\n  ✅ unified version source and product packages → ${next}`);
console.log('  ℹ️ Commit, tag, push, and release are explicit release-gate steps.');
