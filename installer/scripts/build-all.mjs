/**
 * build-all.mjs — سكريبت البناء الشامل مع تحقق كامل
 *
 * الخطوات:
 *   0. تنظيف المجلدات القديمة (release, resources/app)
 *   1. بناء server-app (TypeScript → dist/index.mjs)
 *   2. نسخ server-app/dist → resources/app/server-app/dist (مع قائمة الملفات)
 *   3. بناء Electron main + preload
 *   4. بناء UI (Vite)
 *   5. حزم installer (electron-builder)
 *   6. تحقق من المثبت (SHA256 + مسارات index.mjs)
 */

import { execSync }   from 'child_process';
import * as fs        from 'fs';
import * as path      from 'path';
import * as crypto    from 'crypto';
import { fileURLToPath } from 'url';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const ROOT         = path.resolve(__dirname, '..', '..');
const INSTALLER    = path.resolve(__dirname, '..');
const SERVER_SRC   = path.join(ROOT, 'server-app');
const SERVER_DIST  = path.join(SERVER_SRC, 'dist');
const RESOURCE_APP = path.join(INSTALLER, 'resources', 'app', 'server-app');
const RELEASE_DIR  = path.join(INSTALLER, 'release');

const sep  = '═'.repeat(65);
const sep2 = '─'.repeat(65);

function header(step, title) { console.log(`\n${sep}\n  ${step}  ${title}\n${sep}`); }
function sub(msg)   { console.log(`  ${msg}`); }
function ok(msg)    { console.log(`  ✅ ${msg}`); }
function warn(msg)  { console.log(`  ⚠️  ${msg}`); }
function info(msg)  { console.log(`  ℹ️  ${msg}`); }
function divider()  { console.log(`  ${sep2}`); }

function run(cmd, cwd, extraEnv = {}) {
  console.log(`\n  → ${cmd}`);
  execSync(cmd, {
    stdio: 'inherit',
    cwd: cwd ?? INSTALLER,
    env: { ...process.env, ...extraEnv },
  });
}

function rmDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    ok(`حُذف: ${path.relative(ROOT, dir)}`);
  } else {
    info(`غير موجود (تخطّي): ${path.relative(ROOT, dir)}`);
  }
}

function sha256File(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch { return 'ERROR'; }
}

function gitCommit() {
  try { return execSync('git rev-parse HEAD', { encoding: 'utf-8', cwd: ROOT, timeout: 3000, stdio: ['pipe','pipe','pipe'] }).trim(); }
  catch { return 'N/A'; }
}

function gitShort() {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf-8', cwd: ROOT, timeout: 3000, stdio: ['pipe','pipe','pipe'] }).trim(); }
  catch { return 'N/A'; }
}

function listFiles(dir, base) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel  = path.join(base ?? '', entry.name);
    if (entry.isDirectory()) { result.push(...listFiles(full, rel)); }
    else { result.push(rel); }
  }
  return result;
}

function findAll(dir, name, results = []) {
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules','.git'].includes(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) findAll(full, name, results);
      else if (e.name === name) results.push(full);
    }
  } catch { /* skip unreadable */ }
  return results;
}

// ════════════════════════════════════════════════════════════════════
console.log(`\n${sep}`);
console.log('  🏗️  OneSoft ERP — بناء المثبت الشامل');
console.log(`  📅 ${new Date().toISOString().replace('T',' ').replace(/\.\d+Z$/,' UTC')}`);
console.log(`  🔖 Git: ${gitCommit()}`);
console.log(sep);

// ── 0. تنظيف المجلدات القديمة ─────────────────────────────────────
header('0/6', 'تنظيف المجلدات القديمة');
sub('حذف release/win-unpacked (cache قديم)...');
rmDir(path.join(RELEASE_DIR, 'win-unpacked'));
sub('حذف resources/app/server-app (نسخة قديمة)...');
rmDir(RESOURCE_APP);
sub('إعادة إنشاء resources/app/server-app...');
fs.mkdirSync(path.join(RESOURCE_APP, 'dist'), { recursive: true });
ok('جاهز للنسخ');

// ── 1. بناء server-app ────────────────────────────────────────────
header('1/6', 'بناء server-app (CLIENT_BUILD=true — licenseCenter excluded)');
// CLIENT_BUILD=true يضمن:
//   • licenseCenter router غير موجود في appRouter
//   • ownerOnlyProcedure تُرجع NOT_FOUND
//   • device.prefs مشفّر بـ AES-256-GCM
run('pnpm run build', SERVER_SRC, { CLIENT_BUILD: 'true' });

// تحقق من وجود index.mjs
const mainFile = path.join(SERVER_DIST, 'index.mjs');
if (!fs.existsSync(mainFile)) {
  console.error('\n  ❌ FATAL: server-app/dist/index.mjs غير موجود بعد البناء!');
  process.exit(1);
}
const sha = sha256File(mainFile);
const builtAt = fs.statSync(mainFile).mtime.toISOString().replace('T',' ').replace(/\.\d+Z$/,' UTC');
ok(`index.mjs موجود`);
sub(`  Size      : ${(fs.statSync(mainFile).size / 1024).toFixed(1)} KB`);
sub(`  Built At  : ${builtAt}`);
sub(`  SHA256    : ${sha.slice(0,32)}...`);
sub(`  Git       : ${gitShort()}`);

// ── 1.5 تحقق أمني على bundle (verify-client-build) ──────────────
// يُشغَّل بعد بناء server-app مباشرةً — يمنع المتابعة عند أي فشل
header('1.5/6', 'فحص أمني — verify-client-build (21 اختبار)');
const verifyScript = path.join(ROOT, 'scripts', 'verify-client-build.sh');
const clientDist   = path.join(ROOT, 'client-app', 'dist');
if (!fs.existsSync(verifyScript)) {
  warn('scripts/verify-client-build.sh غير موجود — تخطّي الفحص');
} else if (!fs.existsSync(clientDist)) {
  warn('client-app/dist غير موجود — تخطّي فحص bundle (يعمل على source فقط)');
  run(`bash "${verifyScript}"`, ROOT, { CLIENT_BUILD: 'true' });
} else {
  run(`bash "${verifyScript}" "${clientDist}" "${SERVER_DIST}"`, ROOT, { CLIENT_BUILD: 'true' });
  ok('verify-client-build: 21/21 checks passed ✅');
}

// ── 2. نسخ server-app/dist → resources/app ───────────────────────
header('2/6', `نسخ server-app/dist → resources/app/server-app/dist`);
sub(`المصدر  : ${path.relative(ROOT, SERVER_DIST)}`);
sub(`الوجهة  : ${path.relative(ROOT, path.join(RESOURCE_APP, 'dist'))}`);
divider();

const destDist = path.join(RESOURCE_APP, 'dist');
fs.cpSync(SERVER_DIST, destDist, { recursive: true });

const copiedFiles = listFiles(destDist);
sub(`الملفات المنسوخة (${copiedFiles.length}):`);
for (const f of copiedFiles) {
  const full = path.join(destDist, f);
  const size = (fs.statSync(full).size / 1024).toFixed(1).padStart(8);
  console.log(`     ${size} KB  →  ${f}`);
}
divider();

// تحقق من SHA256 بعد النسخ
const destMain    = path.join(destDist, 'index.mjs');
const destSha     = sha256File(destMain);
const shaMatch    = sha === destSha;
if (!shaMatch) {
  console.error('  ❌ FATAL: SHA256 غير متطابق بعد النسخ!');
  console.error(`  المصدر  : ${sha}`);
  console.error(`  الوجهة  : ${destSha}`);
  process.exit(1);
}
ok(`SHA256 متطابق ✓ ${sha.slice(0,16)}...`);

// نسخ package.json
const pkgSrc = path.join(SERVER_SRC, 'package.json');
const pkgDst = path.join(RESOURCE_APP, 'package.json');
if (fs.existsSync(pkgSrc)) { fs.copyFileSync(pkgSrc, pkgDst); ok('نُسخ package.json'); }

// ── 3. بناء Electron main + preload ──────────────────────────────
header('3/6', 'بناء Electron main + preload');
const esbuild = path.join(INSTALLER, 'node_modules', '.bin', 'esbuild');
const useEsbuild = fs.existsSync(esbuild) ? esbuild : 'esbuild';

run(`${useEsbuild} electron/main.ts --bundle --platform=node --target=node20 --format=cjs --external:electron --external:pg-native --external:node-windows --external:obuf --tsconfig=tsconfig.electron.json --outfile=dist-electron/electron/main.js --log-level=warning`);
run(`${useEsbuild} electron/preload.ts --bundle --platform=node --target=node20 --format=cjs --external:electron --tsconfig=tsconfig.electron.json --outfile=dist-electron/electron/preload.js --log-level=warning`);
ok('Electron main.js + preload.js جاهزان');

// ── 4. بناء UI ────────────────────────────────────────────────────
header('4/6', 'بناء واجهة المستخدم (Vite)');
run('vite build');
ok('UI مبنية');

// ── 5. حزم الـ installer ──────────────────────────────────────────
header('5/6', 'حزم installer (electron-builder)');
// إذا لم يكن PUBLISH_RELEASE=true نمرر --publish never صراحةً
// حتى لو كان electron-builder.yml يحتوي على publish.provider=github
const publishFlag = process.env.PUBLISH_RELEASE === 'true' ? ' --publish=always' : ' --publish=never';
if (process.env.PUBLISH_RELEASE === 'true') info('وضع النشر: --publish=always (سيتم رفع الملفات على GitHub Releases)');
else info('وضع البناء المحلي/CI: --publish=never (لا نشر تلقائي)');
run(`electron-builder${publishFlag}`);
ok('installer مُحزَّم');

// ── 6. تحقق نهائي ─────────────────────────────────────────────────
header('6/6', 'تحقق نهائي — جميع ملفات index.mjs في المشروع');

const allMjs = findAll(ROOT, 'index.mjs');
sub(`عدد الملفات الموجودة: ${allMjs.length}`);
divider();

for (const f of allMjs) {
  const rel   = path.relative(ROOT, f);
  const stat  = fs.statSync(f);
  const mtime = stat.mtime.toISOString().replace('T',' ').replace(/\.\d+Z$/,' UTC');
  const fSha  = sha256File(f);
  const match = fSha === sha;

  console.log(`\n  📄 ${rel}`);
  console.log(`     Size   : ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`     Built  : ${mtime}`);
  console.log(`     SHA256 : ${fSha.slice(0,32)}...`);
  console.log(`     Match  : ${match ? '✅ يطابق server-app/dist/index.mjs' : '⚠️  مختلف'}`);
}

divider();
console.log(`\n${sep}`);
console.log('  ✅ اكتمل البناء الكامل بنجاح');
console.log(`  🔖 Git  : ${gitCommit()}`);
console.log(`  📅 Time : ${new Date().toISOString().replace('T',' ').replace(/\.\d+Z$/,' UTC')}`);
console.log(`  🔑 SHA  : ${sha}`);
console.log(sep);
console.log(`
  للتحقق من أن المثبت يستخدم الكود الصحيح:
  node installer/scripts/find-index-mjs.mjs
`);
