/**
 * اختبار على مستوى نظام الملفات لسلوك التنظيف في وضع "الاحتفاظ بقاعدة البيانات".
 *
 * يتحقق من أن `_cleanupTransient` يحذف فقط الملفات العابرة (config/Temp/Updates/
 * Logs/Cache + ملفات الإعداد) بينما يحافظ تماماً على المجلدات المهمة
 * (Backups/Data/Attachments/Exports/uploads).
 *
 * الأجزاء الخاصة بويندوز (إنهاء العمليات، المهام المجدولة، جدار الحماية) تُتخطّى
 * تلقائياً على لينكس عبر حارس process.platform، لذا لا نختبرها هنا.
 *
 * التشغيل:  cd installer && pnpm exec tsx scripts/test-uninstall-cleanup.ts
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { UninstallManager } from '../core/uninstall/UninstallManager.js';
import type { ProgressEvent } from '../core/types.js';

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}`);
  }
}

function touch(dir: string, marker = 'keep.txt'): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, marker), 'x');
}

async function main(): Promise<void> {
  console.log('\n=== اختبار تنظيف إلغاء التثبيت (وضع الاحتفاظ بقاعدة البيانات) ===\n');

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onesoft-uninstall-'));

  // مجلدات عابرة (يجب أن تُحذف)
  const transient = ['config', 'Temp', 'Updates', 'Logs', 'Cache'];
  // مجلدات محمية (يجب أن تبقى)
  const preserved = ['Backups', 'Data', 'Attachments', 'Exports', 'uploads'];

  for (const d of [...transient, ...preserved]) touch(path.join(dataDir, d));
  // ملفات إعداد في الجذر (يجب أن تُحذف)
  fs.writeFileSync(path.join(dataDir, 'onesoft.config.json'), '{}');
  fs.writeFileSync(path.join(dataDir, 'config.json'), '{}');
  fs.writeFileSync(path.join(dataDir, 'version.json'), '{"version":"1.0.13"}');

  const mgr = new UninstallManager();
  const emit = (_e: ProgressEvent) => {};

  // استدعاء الدالة الخاصة عبر وصول ديناميكي (اختبار سلوك التنظيف الحقيقي)
  (mgr as unknown as { _cleanupTransient(d: string, e: typeof emit): void })
    ._cleanupTransient(dataDir, emit);

  console.log('التحقق من حذف الملفات العابرة:');
  for (const d of transient) {
    assert(!fs.existsSync(path.join(dataDir, d)), `حُذف المجلد العابر: ${d}`);
  }
  assert(!fs.existsSync(path.join(dataDir, 'onesoft.config.json')), 'حُذف onesoft.config.json');
  assert(!fs.existsSync(path.join(dataDir, 'config.json')), 'حُذف config.json');
  assert(!fs.existsSync(path.join(dataDir, 'version.json')), 'حُذف version.json (يمنع الصفحة البيضاء بعد إعادة التثبيت)');

  console.log('التحقق من الحفاظ على المجلدات المهمة:');
  for (const d of preserved) {
    const kept = fs.existsSync(path.join(dataDir, d, 'keep.txt'));
    assert(kept, `مُحتفَظ به مع محتواه: ${d}`);
  }

  // تنظيف
  fs.rmSync(dataDir, { recursive: true, force: true });

  console.log(`\n=== النتيجة: ${passed} ناجح، ${failed} فاشل ===\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('فشل الاختبار بخطأ غير متوقع:', e);
  process.exit(1);
});
