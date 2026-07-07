/**
 * OneSoft ERP — Auto-Updater Module  (v2)
 *
 * الميزات:
 *   - HTTPS فقط — يرفض أي رابط http://
 *   - التحقق من SHA512 بعد اكتمال التحميل قبل تشغيل المثبّت
 *   - سياسة تأجيل 24 ساعة للتحديث الاختياري
 *   - روابط manifest مختلفة حسب البيئة (dev / staging / production)
 *   - logging منظّم لكل الأحداث بمستوى واضح
 *
 * متغيرات البيئة (اختيارية):
 *   ONESOFT_UPDATE_URL  — تجاوز كامل لرابط manifest
 *   ONESOFT_UPDATE_ENV  — 'development' | 'staging' | 'production'  (افتراضي: production)
 *
 * منطق التحديث:
 *   currentVersion < minSupportedVersion  → إجباري  (يُمنع الدخول للنظام)
 *   manifest.mandatory === true           → إجباري
 *   currentVersion < latestVersion       → اختياري (يمكن التأجيل 24 ساعة)
 *   currentVersion === latestVersion      → لا يوجد تحديث
 */

import { ipcMain, app }   from 'electron';
import * as https          from 'https';
import * as fs             from 'fs';
import * as path           from 'path';
import * as crypto         from 'crypto';
import { spawn }           from 'child_process';
import type { BrowserWindow } from 'electron';

// ─── روابط Manifest حسب البيئة ────────────────────────────────────────────────
const ENV_MANIFEST_URLS: Record<string, string> = {
  development: 'https://updates-dev.onesoft.app/update-manifest.json',
  staging:     'https://updates-staging.onesoft.app/update-manifest.json',
  production:  'https://updates.onesoft.app/update-manifest.json',
};

const MANIFEST_URL: string = (() => {
  const override = process.env['ONESOFT_UPDATE_URL'];
  if (override) return override;
  const env = process.env['ONESOFT_UPDATE_ENV'] ?? 'production';
  return ENV_MANIFEST_URLS[env] ?? ENV_MANIFEST_URLS['production']!;
})();

// مدة تأجيل التحديث الاختياري — 24 ساعة
const SKIP_COOLDOWN_MS = 24 * 60 * 60 * 1_000;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UpdateManifest {
  latestVersion:       string;
  minSupportedVersion: string;
  mandatory:           boolean;
  messageAr:           string;
  messageEn:           string;
  releaseNotes:        string[];
  downloadUrl:         string;
  fileSizeBytes?:      number;
  sha512?:             string;   // hex (128 حرف) أو base64
  publishedAt?:        string;   // ISO 8601
}

export type UpdateStatusEvent =
  | { type: 'checking' }
  | { type: 'no-update';   currentVersion: string }
  | { type: 'optional';    manifest: UpdateManifest; currentVersion: string }
  | { type: 'mandatory';   manifest: UpdateManifest; currentVersion: string }
  | { type: 'error';       message: string };

export type UpdateProgressEvent = {
  percent:        number;
  transferred:    number;
  total:          number;
  bytesPerSecond: number;
};

// ─── Logger ───────────────────────────────────────────────────────────────────
type LogFn = (level: string, msg: string, detail?: unknown) => void;
let log: LogFn = () => {};
export function setUpdaterLogger(fn: LogFn): void { log = fn; }

// ─── تفضيلات التحديث (تأجيل / skip) ─────────────────────────────────────────
interface UpdatePrefs {
  skippedVersion?: string;
  skippedAt?:      number;
}

function prefsPath(): string {
  return path.join(app.getPath('userData'), 'onesoft-update-prefs.json');
}

function readPrefs(): UpdatePrefs {
  try { return JSON.parse(fs.readFileSync(prefsPath(), 'utf8')) as UpdatePrefs; }
  catch { return {}; }
}

function writePrefs(prefs: UpdatePrefs): void {
  try { fs.writeFileSync(prefsPath(), JSON.stringify(prefs, null, 2), 'utf8'); }
  catch (e) { log('WARN', `writePrefs failed: ${e}`); }
}

/**
 * هل يجب تخطي هذا الإصدار الاختياري؟
 * نعم إذا كان المستخدم أجّله خلال الـ 24 ساعة الماضية
 */
function shouldSkipOptional(version: string): boolean {
  const prefs = readPrefs();
  if (prefs.skippedVersion !== version) return false;
  if (!prefs.skippedAt) return false;
  const elapsed = Date.now() - prefs.skippedAt;
  return elapsed < SKIP_COOLDOWN_MS;
}

// ─── HTTPS enforcement ────────────────────────────────────────────────────────
function enforceHttps(url: string, label: string): void {
  if (!url.startsWith('https://')) {
    throw new Error(
      `[updater] ${label} يجب أن يبدأ بـ https:// — تم رفض الرابط: ${url.split('?')[0].slice(0, 80)}`,
    );
  }
}

// ─── semver compare ───────────────────────────────────────────────────────────
function semverParse(v: string): [number, number, number] {
  const p = v.replace(/^v/, '').split('.').map(Number);
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
}
function semverLt(a: string, b: string): boolean {
  const [aM, am, ap] = semverParse(a);
  const [bM, bm, bp] = semverParse(b);
  if (aM !== bM) return aM < bM;
  if (am !== bm) return am < bm;
  return ap < bp;
}

// ─── Fetch JSON (HTTPS فقط) ────────────────────────────────────────────────
function fetchJson(url: string): Promise<unknown> {
  enforceHttps(url, 'Manifest URL');
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 12_000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJson(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        return;
      }
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${e}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout (12s)')); });
  });
}

// ─── Download file with progress (HTTPS فقط) ─────────────────────────────────
let downloadedFilePath: string | null = null;

function downloadFile(
  url:        string,
  destPath:   string,
  onProgress: (e: UpdateProgressEvent) => void,
): Promise<void> {
  enforceHttps(url, 'Download URL');
  return new Promise((resolve, reject) => {
    const file      = fs.createWriteStream(destPath);
    const startTime = Date.now();

    const doGet = (u: string) => {
      enforceHttps(u, 'Redirect URL');
      https.get(u, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doGet(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const total       = parseInt(res.headers['content-length'] ?? '0', 10);
        let transferred   = 0;

        res.on('data', (chunk: Buffer) => {
          transferred += chunk.length;
          const elapsed       = (Date.now() - startTime) / 1_000;
          const bytesPerSecond = elapsed > 0 ? transferred / elapsed : 0;
          const percent        = total > 0 ? (transferred / total) * 100 : 0;
          onProgress({ percent, transferred, total, bytesPerSecond });
        });

        res.pipe(file);
        res.on('end', () => { file.close(); resolve(); });
        res.on('error', (e) => { file.close(); fs.unlink(destPath, () => {}); reject(e); });
      }).on('error', (e) => { file.close(); fs.unlink(destPath, () => {}); reject(e); });
    };

    doGet(url);
  });
}

// ─── SHA512 verification ──────────────────────────────────────────────────────
/**
 * يتحقق من hash الملف بعد التحميل.
 * expected يمكن أن يكون hex (128 حرف) أو base64.
 * يرمي Error إذا كان الـ hash غير متطابق.
 */
function verifySha512(filePath: string, expected: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const hash   = crypto.createHash('sha512');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => {
      const actual = hash.digest('hex');
      // التحويل: base64 → hex للمقارنة
      const expectedHex =
        expected.length === 128
          ? expected.toLowerCase()
          : Buffer.from(expected, 'base64').toString('hex');

      if (actual !== expectedHex) {
        reject(new Error(
          `SHA512 mismatch — expected: ${expectedHex.slice(0, 16)}… got: ${actual.slice(0, 16)}…\n` +
          'الملف قد يكون تالفًا أو تم التلاعب به. تم حذفه تلقائيًا.',
        ));
      } else {
        resolve();
      }
    });
    stream.on('error', reject);
  });
}

// ─── Main: setup updater IPC + check on startup ───────────────────────────────
export function setupUpdater(mainWindow: BrowserWindow): void {
  const currentVersion = app.getVersion();
  let pendingManifest: UpdateManifest | null = null;

  function send(channel: string, data: unknown): void {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
  }

  // IPC: renderer يطلب بدء التحميل
  ipcMain.handle('update:start-download', async () => {
    if (!pendingManifest) return { ok: false, error: 'No pending manifest' };

    const { downloadUrl, latestVersion, sha512 } = pendingManifest;

    // HTTPS enforcement مرة أخرى (دفاع متعمق)
    try { enforceHttps(downloadUrl, 'downloadUrl في manifest'); }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log('ERROR', msg);
      send('update:error', { message: msg });
      send('update:log',   { event: 'update-error', error: msg });
      return { ok: false, error: msg };
    }

    log('INFO', `update-download-started  url=${downloadUrl}  version=${latestVersion}`);
    send('update:log', { event: 'update-download-started', version: latestVersion });

    const tmpDir  = app.getPath('temp');
    const fname   = `OneSoftSetup-${latestVersion}.exe`;
    const tmpPath = path.join(tmpDir, fname);
    downloadedFilePath = tmpPath;

    try {
      await downloadFile(
        downloadUrl,
        tmpPath,
        (progress) => {
          log('INFO', `download-progress  ${Math.round(progress.percent)}%  ${progress.transferred}/${progress.total}`);
          send('update:progress', progress);
          send('update:log', { event: 'download-progress', ...progress });
        },
      );

      // ─── التحقق من SHA512 ──────────────────────────────────────────────
      if (sha512) {
        log('INFO', `verifying SHA512 for ${tmpPath}`);
        send('update:log', { event: 'update-verifying-checksum', version: latestVersion });
        try {
          await verifySha512(tmpPath, sha512);
          log('INFO', 'SHA512 verified ✓');
          send('update:log', { event: 'update-checksum-ok', version: latestVersion });
        } catch (hashErr) {
          // حذف الملف التالف
          try { fs.unlinkSync(tmpPath); } catch {}
          downloadedFilePath = null;
          const msg = hashErr instanceof Error ? hashErr.message : String(hashErr);
          log('ERROR', `SHA512 verification failed — ${msg}`);
          send('update:log',   { event: 'update-checksum-failed', error: msg });
          send('update:error', { message: `فشل التحقق من سلامة الملف (SHA512):\n${msg}` });
          return { ok: false, error: msg };
        }
      } else {
        log('WARN', 'sha512 غير موجود في manifest — تخطي التحقق');
        send('update:log', { event: 'update-checksum-skipped', reason: 'no sha512 in manifest' });
      }

      log('INFO', `update-downloaded  path=${tmpPath}`);
      send('update:downloaded', { version: latestVersion, path: tmpPath });
      send('update:log',        { event: 'update-downloaded', version: latestVersion });
      return { ok: true };

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log('ERROR', `download failed — ${msg}`);
      send('update:log',   { event: 'update-error', error: msg });
      send('update:error', { message: msg });
      // حذف الملف الجزئي إذا وُجد
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
      downloadedFilePath = null;
      return { ok: false, error: msg };
    }
  });

  // IPC: renderer يطلب التثبيت الآن (quit + install)
  ipcMain.handle('update:install-now', () => {
    if (!downloadedFilePath || !fs.existsSync(downloadedFilePath)) {
      log('WARN', 'update:install-now — file not found');
      return { ok: false, error: 'Downloaded file not found' };
    }
    log('INFO', `update-installing  path=${downloadedFilePath}`);
    send('update:log', { event: 'update-installing', path: downloadedFilePath });

    // تشغيل المثبّت بصمت (/S) والخروج من التطبيق
    const child = spawn(downloadedFilePath, ['/S'], {
      detached: true,
      stdio:    'ignore',
      shell:    false,
    });
    child.unref();

    setTimeout(() => app.quit(), 500);
    return { ok: true };
  });

  // IPC: renderer يؤجّل التحديث الاختياري (24 ساعة)
  ipcMain.handle('update:skip', () => {
    const version = pendingManifest?.latestVersion ?? 'unknown';
    log('INFO', `user-skipped-optional-update  version=${version}`);
    send('update:log', { event: 'user-skipped-optional-update', version });
    writePrefs({ skippedVersion: version, skippedAt: Date.now() });
  });

  // ─── فحص التحديثات بعد 5 ثوان من بدء التشغيل ─────────────────────────────
  setTimeout(async () => {
    log('INFO', `checking-for-update  url=${MANIFEST_URL}  currentVersion=${currentVersion}  env=${process.env['ONESOFT_UPDATE_ENV'] ?? 'production'}`);
    send('update:status', { type: 'checking' } satisfies UpdateStatusEvent);
    send('update:log', { event: 'checking-for-update', currentVersion, url: MANIFEST_URL });

    try {
      const raw      = await fetchJson(MANIFEST_URL);
      const manifest = raw as UpdateManifest;

      // تحقق من صحة الحقول الضرورية
      if (!manifest?.latestVersion) throw new Error('Invalid manifest: missing latestVersion');
      if (!manifest?.downloadUrl)   throw new Error('Invalid manifest: missing downloadUrl');
      if (!manifest.downloadUrl.startsWith('https://')) {
        throw new Error(`Invalid manifest: downloadUrl يجب أن يبدأ بـ https:// — تم رفضه`);
      }

      log('INFO', `manifest  latestVersion=${manifest.latestVersion}  minSupported=${manifest.minSupportedVersion}  mandatory=${manifest.mandatory}  sha512=${manifest.sha512 ? '✓' : '✗'}`);

      // لا يوجد تحديث
      if (!semverLt(currentVersion, manifest.latestVersion)) {
        log('INFO', 'update-not-available');
        send('update:status', { type: 'no-update', currentVersion } satisfies UpdateStatusEvent);
        send('update:log',    { event: 'update-not-available', currentVersion });
        return;
      }

      pendingManifest = manifest;

      // هل التحديث إجباري؟
      const isMandatory =
        manifest.mandatory ||
        (manifest.minSupportedVersion && semverLt(currentVersion, manifest.minSupportedVersion));

      if (isMandatory) {
        log('INFO', `mandatory-update-blocked-login  currentVersion=${currentVersion}  minSupported=${manifest.minSupportedVersion}`);
        send('update:status', { type: 'mandatory', manifest, currentVersion } satisfies UpdateStatusEvent);
        send('update:log',    { event: 'mandatory-update-blocked-login', currentVersion, required: manifest.minSupportedVersion });
        return;
      }

      // تحديث اختياري — تحقق من التأجيل
      if (shouldSkipOptional(manifest.latestVersion)) {
        const prefs = readPrefs();
        const hoursLeft = Math.ceil((SKIP_COOLDOWN_MS - (Date.now() - (prefs.skippedAt ?? 0))) / 3_600_000);
        log('INFO', `update-skipped-cooldown  version=${manifest.latestVersion}  hoursLeft=${hoursLeft}`);
        send('update:log', { event: 'update-skipped-cooldown', version: manifest.latestVersion, hoursLeft });
        send('update:status', { type: 'no-update', currentVersion } satisfies UpdateStatusEvent);
        return;
      }

      log('INFO', `update-available  currentVersion=${currentVersion}  latestVersion=${manifest.latestVersion}`);
      send('update:status', { type: 'optional', manifest, currentVersion } satisfies UpdateStatusEvent);
      send('update:log',    { event: 'update-available', currentVersion, latestVersion: manifest.latestVersion });

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log('WARN', `update-check-failed (non-critical) — ${msg}`);
      send('update:status', { type: 'error', message: msg } satisfies UpdateStatusEvent);
      send('update:log',    { event: 'update-error', error: msg });
    }
  }, 5_000);
}
