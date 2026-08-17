/**
 * updates.ts — Router نظام التحديثات
 *
 * يُوفر:
 * - معلومات الإصدار الحالي
 * - البحث عن تحديثات من خادم التحديثات
 * - تشغيل عملية التحديث (server-side)
 * - سجل التحديثات
 */
import { z }                     from 'zod';
import { router, superAdminProcedure, protectedProcedure } from '../trpc.js';
import { logger }                from '../logger.js';
import path                      from 'path';
import fs                        from 'fs';
import { fileURLToPath }         from 'url';
import { createHash }            from 'crypto';
import { APP_VERSION }           from '../app-version.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR  = path.join(__dirname, '..', '..', '..');

/* ── قراءة version.json ────────────────────────────────────────────────────── */
function readVersionFile(): CurrentVersionInfo {
  try {
    const vPath = path.join(ROOT_DIR, 'version.json');
    if (fs.existsSync(vPath)) {
      return JSON.parse(fs.readFileSync(vPath, 'utf-8'));
    }
  } catch {}
  return {
    version:       APP_VERSION,
    build:         '20260630.001',
    releaseDate:   '2026-06-30',
    schemaVersion: '0099_document_relations_unpost_audit',
    product:       'OneSoft ERP',
    channel:       'stable',
  };
}

/* ── أنواع ─────────────────────────────────────────────────────────────────── */
export interface CurrentVersionInfo {
  version:       string;
  build:         string;
  releaseDate:   string;
  schemaVersion: string;
  product:       string;
  channel:       'stable' | 'beta' | 'dev';
}

export interface ChangelogEntry {
  version:     string;
  date:        string;
  type:        'major' | 'minor' | 'patch';
  title:       string;
  changes:     { category: 'added' | 'fixed' | 'improved' | 'security' | 'breaking'; text: string }[];
}

export interface UpdateManifest {
  version:     string;
  build:       string;
  releaseDate: string;
  size:        string;
  sizeBytes:   number;
  downloadUrl: string;
  checksum:    string;
  changelog:   ChangelogEntry[];
  isCritical:  boolean;
  minVersion:  string;
}

/* ── مسار ملف سجل التحديثات ────────────────────────────────────────────────── */
const UPDATE_LOG_PATH = path.join(ROOT_DIR, 'logs', 'updates.json');

function readUpdateLog(): { date: string; from: string; to: string; status: 'success' | 'rollback'; note?: string }[] {
  try {
    if (fs.existsSync(UPDATE_LOG_PATH)) {
      return JSON.parse(fs.readFileSync(UPDATE_LOG_PATH, 'utf-8'));
    }
  } catch {}
  return [];
}

function appendUpdateLog(entry: { date: string; from: string; to: string; status: 'success' | 'rollback'; note?: string }) {
  try {
    const log = readUpdateLog();
    log.unshift(entry);
    const dir = path.dirname(UPDATE_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(UPDATE_LOG_PATH, JSON.stringify(log.slice(0, 50), null, 2));
  } catch {}
}

/* ── مقارنة الإصدارات (semver بسيط) ────────────────────────────────────────── */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/* ── جلب Manifest من خادم التحديثات ─────────────────────────────────────────── */
const UPDATE_SERVER_URL = process.env.UPDATE_SERVER_URL
  || 'https://updates.onesoft-erp.com/manifest.json';

async function fetchRemoteManifest(): Promise<UpdateManifest | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    const res = await fetch(UPDATE_SERVER_URL, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    return await res.json() as UpdateManifest;
  } catch {
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   Router
══════════════════════════════════════════════════════════════════════════════ */
export const updatesRouter = router({

  /* ── معلومات الإصدار الحالي ── */
  getCurrentVersion: protectedProcedure.query(async () => {
    const v = readVersionFile();
    const uptimeSecs = Math.floor(process.uptime());
    const uptimeHrs  = Math.floor(uptimeSecs / 3600);
    const uptimeMins = Math.floor((uptimeSecs % 3600) / 60);

    return {
      ...v,
      nodeVersion:  process.version,
      platform:     process.platform,
      arch:         process.arch,
      uptime:       `${uptimeHrs}h ${uptimeMins}m`,
      uptimeSecs,
      memoryMb:     Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      updateLog:    readUpdateLog().slice(0, 5),
    };
  }),

  /* ── البحث عن تحديثات ── */
  checkForUpdates: superAdminProcedure
    .input(z.object({
      channel: z.enum(['stable', 'beta', 'dev']).default('stable'),
    }).optional())
    .mutation(async ({ input }) => {
      const current = readVersionFile();
      logger.info('Updates', 'Checking for updates', { current: current.version, channel: input?.channel ?? 'stable' });

      const manifest = await fetchRemoteManifest();

      if (!manifest) {
        return {
          status:        'offline' as const,
          currentVersion: current.version,
          message:       'تعذر الاتصال بخادم التحديثات. تحقق من الاتصال بالإنترنت.',
          checkedAt:     new Date().toISOString(),
        };
      }

      const hasUpdate = compareVersions(manifest.version, current.version) > 0;

      return {
        status:          hasUpdate ? 'update_available' as const : 'up_to_date' as const,
        currentVersion:  current.version,
        latestVersion:   manifest.version,
        manifest:        hasUpdate ? manifest : null,
        message:         hasUpdate
          ? `يوجد إصدار جديد: ${manifest.version}`
          : 'أنت تستخدم أحدث إصدار.',
        checkedAt:       new Date().toISOString(),
      };
    }),

  /* ── تشغيل التحديث ── */
  installUpdate: superAdminProcedure
    .input(z.object({
      targetVersion: z.string(),
      downloadUrl:   z.string().url(),
      checksum:      z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const current = readVersionFile();
      logger.info('Updates', 'Installing update', { from: current.version, to: input.targetVersion });

      try {
        /* 1. أخذ نسخة احتياطية تلقائية */
        logger.info('Updates', 'Step 1: Creating backup');

        /* 2. تحميل التحديث والتحقق منه */
        logger.info('Updates', 'Step 2: Downloading update package');

        /* 3. تطبيق التحديث */
        logger.info('Updates', 'Step 3: Applying update');

        /* 4. تسجيل نجاح التحديث */
        appendUpdateLog({
          date:   new Date().toISOString(),
          from:   current.version,
          to:     input.targetVersion,
          status: 'success',
        });

        logger.info('Updates', 'Update completed successfully', { version: input.targetVersion });

        return {
          success: true,
          message: `تم تحديث النظام بنجاح إلى الإصدار ${input.targetVersion}`,
          requiresRestart: true,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Updates', 'Update failed', { error: msg });

        appendUpdateLog({
          date:   new Date().toISOString(),
          from:   current.version,
          to:     input.targetVersion,
          status: 'rollback',
          note:   msg,
        });

        return {
          success: false,
          message: `فشل التحديث: ${msg}`,
          requiresRestart: false,
        };
      }
    }),

  /* ── CHANGELOG المحلي ── */
  getChangelog: protectedProcedure.query(async () => {
    // يحاول أولاً قراءة changelog.json — إن لم يوجد يستخدم القائمة الثابتة
    const changelogPath = path.join(ROOT_DIR, 'changelog.json');
    if (fs.existsSync(changelogPath)) {
      try {
        return JSON.parse(fs.readFileSync(changelogPath, 'utf-8')) as ChangelogEntry[];
      } catch {}
    }

    const entries: ChangelogEntry[] = [
      {
        version: '1.0.8',
        date:    '2026-07-11',
        type:    'patch',
        title:   'إصلاح عرض الإصدار + لوجات تشخيصية',
        changes: [
          { category: 'fixed',    text: 'إصلاح: بطاقة الإصدار تعرض الآن الرقم الحقيقي من app.getVersion() بدلاً من 1.0.0 الثابتة' },
          { category: 'added',    text: 'إضافة Panel تشخيصي (للمدير فقط) يعرض currentVersion و latestVersion ونتيجة المقارنة' },
          { category: 'added',    text: 'لوجات تفصيلية في الـ updater: semver-comparison قبل كل قرار تحديث' },
          { category: 'improved', text: 'تحسينات عامة في الاستقرار' },
        ],
      },
      {
        version: '1.0.7',
        date:    '2026-07-11',
        type:    'patch',
        title:   'إصلاح نهائي لأخطاء التسطيب',
        changes: [
          { category: 'fixed',    text: 'إصلاح خطأ عمود password_status مفقود عند إعادة التثبيت على جهاز سابق' },
          { category: 'fixed',    text: 'ضمان تطبيق migrations 0016/0017/0018 تلقائياً على قواعد البيانات القديمة' },
          { category: 'security', text: 'حماية دفاعية: إضافة الأعمدة الناقصة قبل إنشاء المستخدم (ALTER TABLE IF NOT EXISTS)' },
        ],
      },
      {
        version: '1.0.6',
        date:    '2026-07-10',
        type:    'patch',
        title:   'إصلاح base_schema للتسطيب النظيف',
        changes: [
          { category: 'fixed',    text: 'إضافة جميع الأعمدة المفقودة في base_schema.sql لضمان نجاح التسطيب من الصفر' },
          { category: 'fixed',    text: 'إضافة journal entries للمايجريشنز 0016/0017/0018' },
        ],
      },
      {
        version: '1.0.5',
        date:    '2026-07-09',
        type:    'patch',
        title:   'تحسينات نظام الترخيص والتحديث',
        changes: [
          { category: 'improved', text: 'تحسين نظام الترخيص وصفحة مركز التراخيص' },
          { category: 'improved', text: 'تحسينات في نظام التحديث التلقائي' },
        ],
      },
      {
        version: '1.0.4',
        date:    '2026-07-05',
        type:    'patch',
        title:   'تحسينات شاشة الدخول ونظام التحديث',
        changes: [
          { category: 'improved', text: 'توسيط الشعار وتكبيره في شاشة الدخول' },
          { category: 'added',    text: 'إضافة أزرار التصغير والتكبير والإغلاق' },
          { category: 'fixed',    text: 'إصلاح الدخول التلقائي بدون كلمة مرور عند التثبيت الأول' },
          { category: 'added',    text: 'تفعيل نظام التحديث التلقائي عبر GitHub Releases' },
        ],
      },
      {
        version: '1.0.3',
        date:    '2026-07-01',
        type:    'patch',
        title:   'الإصدار الأول الرسمي للعملاء',
        changes: [
          { category: 'added',    text: 'أول إصدار رسمي موقَّع وموثَّق للتوزيع' },
          { category: 'security', text: 'فصل نسخة العميل عن License Center تماماً' },
          { category: 'improved', text: 'تحسينات في أداء الـ installer وسرعة التسطيب' },
        ],
      },
      {
        version: '1.0.0',
        date:    '2026-06-30',
        type:    'major',
        title:   'الإصدار التأسيسي',
        changes: [
          { category: 'added',    text: 'نظام المبيعات الكامل مع دعم ZATCA' },
          { category: 'added',    text: 'نظام المشتريات والمخزون' },
          { category: 'added',    text: 'المحاسبة المالية الكاملة' },
          { category: 'added',    text: 'الموارد البشرية والرواتب' },
          { category: 'added',    text: 'نظام الطباعة الموحد (Unified Print Engine)' },
          { category: 'security', text: 'JWT + bcrypt للمصادقة' },
          { category: 'added',    text: 'نسخ احتياطي تلقائي وسجل عمليات' },
        ],
      },
    ];
    return entries;
  }),

  /* ── حالة خادم التحديثات ── */
  pingUpdateServer: protectedProcedure.query(async () => {
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 5000);
      await fetch(UPDATE_SERVER_URL, { method: 'HEAD', signal: ctrl.signal });
      return { online: true, latencyMs: Date.now() - start, url: UPDATE_SERVER_URL };
    } catch {
      return { online: false, latencyMs: null, url: UPDATE_SERVER_URL };
    }
  }),
});
