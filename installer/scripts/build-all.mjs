/**
 * build-all.mjs — سكريبت البناء الشامل للـ installer
 *
 * الخطوات:
 *   1. بناء server-app (TypeScript → dist/index.mjs)
 *   2. نسخ server-app/dist إلى installer/resources/app/server-app/dist
 *   3. بناء Electron main + preload
 *   4. بناء UI (Vite)
 *   5. حزم installer (electron-builder)
 */

import { execSync }  from 'child_process';
import * as fs       from 'fs';
import * as path     from 'path';
import { fileURLToPath } from 'url';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const ROOT         = path.resolve(__dirname, '..', '..');
const INSTALLER    = path.resolve(__dirname, '..');
const SERVER_SRC   = path.join(ROOT, 'server-app');
const SERVER_DIST  = path.join(SERVER_SRC, 'dist');
const RESOURCE_APP = path.join(INSTALLER, 'resources', 'app', 'server-app');

const sep = '═'.repeat(60);

function log(msg)  { console.log(`\n${sep}\n  ${msg}\n${sep}`); }
function run(cmd, cwd) {
  console.log(`  → ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: cwd ?? INSTALLER });
}

// ── 1. بناء server-app ────────────────────────────────────────────────────────
log('1/5  بناء server-app');
run('pnpm run build', SERVER_SRC);

// ── 2. نسخ server-app/dist إلى resources/app ─────────────────────────────────
log('2/5  نسخ server-app/dist → resources/app/server-app/dist');
const destDist = path.join(RESOURCE_APP, 'dist');
if (fs.existsSync(destDist)) fs.rmSync(destDist, { recursive: true, force: true });
fs.mkdirSync(destDist, { recursive: true });
fs.cpSync(SERVER_DIST, destDist, { recursive: true });
console.log(`  ✅ تم النسخ: ${Object.keys(fs.readdirSync(destDist)).length + fs.readdirSync(destDist).length} ملف`);

// نسخ package.json من server-app (يحتاجه node للتشغيل)
const pkgSrc = path.join(SERVER_SRC, 'package.json');
const pkgDst = path.join(RESOURCE_APP, 'package.json');
if (fs.existsSync(pkgSrc)) { fs.copyFileSync(pkgSrc, pkgDst); console.log('  ✅ نُسخ package.json'); }

// ── 3. بناء Electron main + preload ──────────────────────────────────────────
log('3/5  بناء Electron main + preload');
const esbuild = path.join(INSTALLER, 'node_modules', '.bin', 'esbuild');
const useEsbuild = fs.existsSync(esbuild) ? esbuild : 'esbuild';

run(`${useEsbuild} electron/main.ts --bundle --platform=node --target=node20 --format=cjs --external:electron --external:pg-native --external:node-windows --external:obuf --tsconfig=tsconfig.electron.json --outfile=dist-electron/electron/main.js --log-level=warning`);
run(`${useEsbuild} electron/preload.ts --bundle --platform=node --target=node20 --format=cjs --external:electron --tsconfig=tsconfig.electron.json --outfile=dist-electron/electron/preload.js --log-level=warning`);

// ── 4. بناء UI ────────────────────────────────────────────────────────────────
log('4/5  بناء واجهة المستخدم (Vite)');
run('vite build');

// ── 5. حزم الـ installer ──────────────────────────────────────────────────────
log('5/5  حزم installer (electron-builder)');
run('electron-builder');

log('✅  اكتمل البناء الكامل');
