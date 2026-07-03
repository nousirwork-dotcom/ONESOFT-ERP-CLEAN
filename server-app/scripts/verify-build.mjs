/**
 * OneSoft ERP — Smoke Test للـ Backend
 *
 * يتحقق أن dist/index.mjs يبدأ ويستجيب قبل بناء المثبت.
 *
 * تشغيل: node scripts/verify-build.mjs
 * يعيد exit code 0 إذا نجح، 1 إذا فشل.
 */

import { spawn }          from 'child_process';
import http               from 'http';
import { fileURLToPath }  from 'url';
import { dirname, join }  from 'path';
import { existsSync }     from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST      = join(__dirname, '..', 'dist', 'index.mjs');
const TEST_PORT = 13737; // منفذ مؤقت لتجنب التعارض مع الخدمة الحقيقية
const TIMEOUT   = 30_000; // 30 ثانية

// ── 1. التحقق من وجود الملف ─────────────────────────────────────────────────
if (!existsSync(DIST)) {
  console.error(`❌ الملف غير موجود: ${DIST}`);
  console.error('   نفّذ أولاً: pnpm build');
  process.exit(1);
}

console.log(`\n🧪 Smoke Test — OneSoft Backend`);
console.log(`   الملف:   ${DIST}`);
console.log(`   المنفذ:  ${TEST_PORT}`);
console.log(`   المهلة:  ${TIMEOUT / 1000}s\n`);

// ── 2. تشغيل الـ Backend على منفذ مؤقت ──────────────────────────────────────
const proc = spawn('node', [DIST], {
  env: {
    ...process.env,
    PORT:         String(TEST_PORT),
    NODE_ENV:     'test',
    // إذا لم يوجد DATABASE_URL، استخدم واحد افتراضياً (للسماح بالبدء)
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/onesoft_erp',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let crashed     = false;
let crashMsg    = '';
let stdoutBuf   = '';
let stderrBuf   = '';

proc.stdout.on('data', d => { stdoutBuf += d.toString(); });
proc.stderr.on('data', d => { stderrBuf += d.toString(); });

proc.on('error', err => {
  crashed  = true;
  crashMsg = err.message;
});

proc.on('exit', (code, signal) => {
  if (!crashed && code !== null && code !== 0) {
    crashed  = true;
    crashMsg = `exit code ${code}`;
  }
});

// ── 3. انتظار استجابة HTTP ───────────────────────────────────────────────────
async function waitForResponse(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (crashed) return { ok: false, reason: `تعطّل البرنامج: ${crashMsg}` };

    const result = await new Promise(resolve => {
      const req = http.get(
        { hostname: '127.0.0.1', port, path: '/api/health', timeout: 2000 },
        res => {
          let body = '';
          res.on('data', d => body += d);
          res.on('end', () => resolve({ ok: true, status: res.statusCode, body }));
        },
      );
      req.on('error',   () => resolve({ ok: false }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
    });

    if (result.ok) return result;

    const elapsed = Math.round((Date.now() - (deadline - timeoutMs)) / 1000);
    process.stdout.write(`\r⏳ انتظار المنفذ ${port} (${elapsed}s / ${timeoutMs / 1000}s)...`);
    await new Promise(r => setTimeout(r, 1500));
  }

  return { ok: false, reason: `انتهت المهلة (${timeoutMs / 1000}s)` };
}

const result = await waitForResponse(TEST_PORT, TIMEOUT);
proc.kill('SIGTERM');

// انتظار قصير للتنظيف
await new Promise(r => setTimeout(r, 500));

// ── 4. تقرير النتيجة ─────────────────────────────────────────────────────────
console.log(''); // newline after the progress indicator

if (result.ok) {
  console.log(`✅ Smoke Test نجح!`);
  console.log(`   HTTP ${result.status} — ${result.body?.slice(0, 100) ?? ''}`);
  if (stdoutBuf) console.log('\n📤 stdout:\n' + stdoutBuf.slice(0, 500));
  process.exit(0);
} else {
  console.error(`\n❌ Smoke Test فشل: ${result.reason ?? 'البرنامج لم يستجب'}`);

  if (stderrBuf) {
    console.error('\n📥 stderr:');
    console.error(stderrBuf.slice(0, 2000));

    // تحليل الخطأ الشائع
    if (stderrBuf.includes('Cannot find module')) {
      const match = stderrBuf.match(/Cannot find module '([^']+)'/);
      if (match) {
        console.error(`\n💡 تلميح: الحزمة '${match[1]}' غير مضمّنة في الـ bundle.`);
        console.error('   تأكد من عدم استخدام --packages=external في esbuild.');
      }
    }
    if (stderrBuf.includes('Dynamic require')) {
      console.error('\n💡 تلميح: خطأ "Dynamic require" — أضف banner:js=createRequire في esbuild config.');
    }
    if (stderrBuf.includes('SyntaxError') || stderrBuf.includes('parse error')) {
      console.error('\n💡 تلميح: خطأ بناء جملة — راجع ملف dist/index.mjs أول 50 سطر.');
    }
  }

  if (stdoutBuf) {
    console.error('\n📤 stdout:');
    console.error(stdoutBuf.slice(0, 1000));
  }

  process.exit(1);
}
