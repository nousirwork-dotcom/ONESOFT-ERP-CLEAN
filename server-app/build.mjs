/**
 * OneSoft ERP — Server Build Script
 *
 * يُنتج dist/index.mjs ملفاً مستقلاً (standalone) يحتوي جميع الاعتماديات
 * بدون الحاجة لمجلد node_modules عند التشغيل.
 *
 * تشغيل: node build.mjs
 */

import * as esbuild from 'esbuild';
import { statSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

// ── Build metadata — computed ONCE at build time ──────────────────────────────
const BUILD_DATE = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function getCommitSha() {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8', timeout: 5000 }).trim(); }
  catch { return 'unknown'; }
}
const BUILD_COMMIT     = getCommitSha();
const BUILD_DATE_ID    = BUILD_DATE.replace(/-/g, '');              // YYYYMMDD
const BUILD_CACHE_NAME = `onesoft-erp-${BUILD_DATE_ID}-${BUILD_COMMIT}`;

const DEV          = process.argv.includes('--dev');
const CLIENT_BUILD = process.env.CLIENT_BUILD === 'true';
const OUTFILE      = 'dist/index.mjs';

console.log(`\n🔨 بناء OneSoft Server (${DEV ? 'development' : 'production'}${CLIENT_BUILD ? ' | CLIENT_BUILD=true' : ''})...`);

// ── Plugin: stub licenseCenter when CLIENT_BUILD=true ─────────────────────
// يمنع وصول أي API حساسة (renewLicense, issueNewLicense, ...)
// إلى bundle العميل حتى مع وجود static import في routers/index.ts
const licenseCenterStubPlugin = {
  name: 'license-center-stub',
  setup(build) {
    build.onLoad({ filter: /routers[/\\]licenseCenter\.ts$/ }, () => ({
      contents: '// CLIENT_BUILD stub\nexport const licenseCenterRouter = null;\n',
      loader: 'ts',
    }));
  },
};

let result;
try {
  result = await esbuild.build({
    entryPoints: ['src/index.ts'],
    plugins: CLIENT_BUILD ? [licenseCenterStubPlugin] : [],

    // ── تهيئة Node.js ───────────────────────────────────────────────────────
    platform: 'node',          // يُفعِّل تحسينات Node.js الداخلية
    target:   'node20',        // نسخة Node المستهدفة في الإنتاج
    format:   'esm',           // ESM — تتوافق مع "type":"module" في package.json

    // ── التجميع ─────────────────────────────────────────────────────────────
    bundle:   true,            // ضم جميع الاعتماديات داخل الملف

    // ── الحزم الخارجية — فقط native bindings لا يمكن تجميعها ───────────────
    external: [
      'pg-native',   // addon اختياري لـ pg — يعمل بدونه بـ pure JS
      'fsevents',    // macOS only — غير مطلوب على Windows
    ],

    // ── الحل الجذري لـ "Dynamic require is not supported" ───────────────────
    // بعض حزم CJS (كـ pg وتوابعها) تستخدم require() داخلياً.
    // في الناتج ESM لا يوجد require() — نضيفه عبر banner.
    banner: {
      js: [
        "import{createRequire}from'module';",
        "const require=createRequire(import.meta.url);",
      ].join(''),
    },

    // ── الإخراج ─────────────────────────────────────────────────────────────
    outfile:   OUTFILE,
    sourcemap: DEV ? 'inline' : false,
    minify:    false,         // لا minify — يُسهّل قراءة stack traces
    logLevel:  'warning',

    // ── توافق متعدد الحزم ────────────────────────────────────────────────────
    // السبب: pg@8.20.0 يحتوي نسختين ESM+CJS — "Dual Package Hazard"
    // إذا سمحنا بـ 'import' أو 'module'، يحمّل esbuild pg/esm/index.mjs
    // ثم يحوّل Pool إلى Object عبر __toCommonJS فيفشل: class extends #<Object>
    // الحل: إجبار esbuild على استخدام نسخة CJS فقط (pg/lib/index.js)
    mainFields: ['main'],                        // لا 'module' — تجنب ESM entry
    conditions: ['require', 'node', 'default'],  // لا 'import' — تجنب pg/esm/

    // ── ملف بيانات البناء ─────────────────────────────────────────────────────
    metafile: true,
  });
} catch (e) {
  console.error('\n❌ فشل البناء:\n', e.message ?? e);
  process.exit(1);
}

// ── كتابة build-info.json ─────────────────────────────────────────────────────
// يُحفظ في dist/ بجانب index.mjs — يُقرأ من setup.ts بدلاً من git runtime
const buildInfo = {
  buildDate:      BUILD_DATE,
  buildCommit:    BUILD_COMMIT,
  buildDateId:    BUILD_DATE_ID,
  buildCacheName: BUILD_CACHE_NAME,
};
mkdirSync('dist', { recursive: true });
writeFileSync('dist/build-info.json', JSON.stringify(buildInfo, null, 2), 'utf-8');
console.log(`\n🏷️  Build Info: ${BUILD_DATE} · ${BUILD_COMMIT} · ${BUILD_CACHE_NAME}`);

// ── تقرير الحجم ─────────────────────────────────────────────────────────────
const bytes = statSync(OUTFILE).size;
const mb    = (bytes / 1024 / 1024).toFixed(2);

console.log(`\n📦 ${OUTFILE} = ${mb} MB`);

// التحقق: إذا كان الملف صغيراً جداً فالحزم لم تُضمَّن
if (bytes < 500_000) {
  console.error(`\n❌ الملف صغير جداً (${mb} MB) — يبدو أن الاعتماديات لم تُضمَّن!`);
  console.error('   تأكد من عدم استخدام --packages=external في الإعداد.');
  process.exit(1);
}

// تقرير أكبر 10 modules في الـ bundle
const modules = Object.entries(result.metafile.inputs)
  .map(([k, v]) => ({ name: k, bytes: v.bytes }))
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 10);

console.log('\n📊 أكبر 10 وحدات في الـ bundle:');
for (const m of modules) {
  const kb = (m.bytes / 1024).toFixed(0);
  console.log(`   ${kb.padStart(6)} KB  ${m.name}`);
}

console.log('\n✅ اكتمل البناء بنجاح\n');
