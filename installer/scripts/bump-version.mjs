/**
 * bump-version.mjs — رفع رقم الإصدار + commit + tag + push
 *
 * الاستخدام:
 *   node scripts/bump-version.mjs patch   ← 1.0.0 → 1.0.1
 *   node scripts/bump-version.mjs minor   ← 1.0.0 → 1.1.0
 *   node scripts/bump-version.mjs major   ← 1.0.0 → 2.0.0
 */

import { execSync }      from 'child_process';
import * as fs           from 'fs';
import * as path         from 'path';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const INSTALLER   = path.resolve(__dirname, '..');
const ROOT        = path.resolve(INSTALLER, '..');
const PKG_PATH    = path.join(INSTALLER, 'package.json');
const YML_PATH    = path.join(INSTALLER, 'electron-builder.yml');

const bumpType = process.argv[2] ?? 'patch';
if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error(`❌ نوع غير صحيح: "${bumpType}". استخدم: patch | minor | major`);
  process.exit(1);
}

// ── قراءة الإصدار الحالي ──────────────────────────────────────────
const pkg     = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const current = pkg.version;
const parts   = current.split('.').map(Number);

if (bumpType === 'patch') parts[2]++;
if (bumpType === 'minor') { parts[1]++; parts[2] = 0; }
if (bumpType === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }

const next = parts.join('.');
console.log(`\n  📦 رفع الإصدار: ${current} → ${next}  (${bumpType})\n`);

// ── تحديث package.json ────────────────────────────────────────────
pkg.version = next;
fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`  ✅ installer/package.json → ${next}`);

// ── تحديث electron-builder.yml ───────────────────────────────────
let yml = fs.readFileSync(YML_PATH, 'utf8');
yml = yml.replace(/^(extraMetadata:\s*\n\s*version:\s*")[^"]+(")/m, `$1${next}$2`);
fs.writeFileSync(YML_PATH, yml, 'utf8');
console.log(`  ✅ installer/electron-builder.yml → ${next}`);

// ── git commit + tag + push ───────────────────────────────────────
function run(cmd) {
  console.log(`\n  → ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

run(`git add installer/package.json installer/electron-builder.yml`);
run(`git commit -m "Bump version to ${next}"`);
run(`git tag v${next}`);
run(`git push origin main`);
run(`git push origin v${next}`);

console.log(`\n  🚀 تم! GitHub Actions سيبدأ البناء تلقائياً للإصدار v${next}`);
console.log(`  🔗 https://github.com/nousirwork-dotcom/ONESOFT-ERP-CLEAN/actions\n`);
