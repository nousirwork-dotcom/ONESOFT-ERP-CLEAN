/**
 * OneSoft ERP — Auto-Updater Module
 *
 * يفحص التحديثات عبر ملف JSON خارجي (update-manifest.json) مستضاف على CDN أو GitHub Releases.
 * لا يحتوي على أي GitHub Token أو بيانات حساسة.
 *
 * منطق التحديث:
 *   currentVersion < minSupportedVersion  → تحديث إجباري  (لا يُسمح بالدخول)
 *   currentVersion < latestVersion        → تحديث اختياري (يمكن التأجيل)
 *   currentVersion === latestVersion      → لا يوجد تحديث
 *
 * MANIFEST_URL: عيّن متغير البيئة ONESOFT_UPDATE_URL أو غيّر القيمة الافتراضية أدناه
 * إلى عنوان URL عام يستضيف update-manifest.json.
 *
 * مثال GitHub Releases (ريبو عام):
 *   https://github.com/{owner}/{repo}/releases/download/latest/update-manifest.json
 */

import { ipcMain, app }  from 'electron';
import * as https        from 'https';
import * as http         from 'http';
import * as fs           from 'fs';
import * as path         from 'path';
import { spawn }         from 'child_process';
import type { BrowserWindow } from 'electron';

// ─── الثابت: عنوان manifest ───────────────────────────────────────────────────
// يمكن تجاوزه بـ: ONESOFT_UPDATE_URL env var
const MANIFEST_URL =
  process.env['ONESOFT_UPDATE_URL'] ??
  'https://updates.onesoft.app/update-manifest.json';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UpdateManifest {
  latestVersion:      string;
  minSupportedVersion: string;
  mandatory:          boolean;
  messageAr:          string;
  messageEn:          string;
  releaseNotes:       string[];
  downloadUrl:        string;
  fileSizeBytes?:     number;
}

export type UpdateStatusEvent =
  | { type: 'checking' }
  | { type: 'no-update';   currentVersion: string }
  | { type: 'optional';    manifest: UpdateManifest; currentVersion: string }
  | { type: 'mandatory';   manifest: UpdateManifest; currentVersion: string }
  | { type: 'error';       message: string };

export type UpdateProgressEvent = {
  percent:       number;
  transferred:   number;
  total:         number;
  bytesPerSecond: number;
};

// ─── Logger (مُحقوق من main.ts عبر callback) ─────────────────────────────────
type LogFn = (level: string, msg: string, detail?: unknown) => void;
let log: LogFn = () => {};
export function setUpdaterLogger(fn: LogFn): void { log = fn; }

// ─── semver compare ───────────────────────────────────────────────────────────
function semverParse(v: string): [number, number, number] {
  const parts = v.replace(/^v/, '').split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}
function semverLt(a: string, b: string): boolean {
  const [aM, am, ap] = semverParse(a);
  const [bM, bm, bp] = semverParse(b);
  if (aM !== bM) return aM < bM;
  if (am !== bm) return am < bm;
  return ap < bp;
}

// ─── Fetch JSON از URL ────────────────────────────────────────────────────────
function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 10_000 }, (res) => {
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
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

// ─── Download file with progress ─────────────────────────────────────────────
let downloadedFilePath: string | null = null;

function downloadFile(
  url:          string,
  destPath:     string,
  onProgress:   (e: UpdateProgressEvent) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    const startTime = Date.now();

    const doGet = (u: string) => {
      lib.get(u, (res) => {
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
        const total = parseInt(res.headers['content-length'] ?? '0', 10);
        let transferred = 0;

        res.on('data', (chunk: Buffer) => {
          transferred += chunk.length;
          const elapsed = (Date.now() - startTime) / 1000;
          const bytesPerSecond = elapsed > 0 ? transferred / elapsed : 0;
          const percent = total > 0 ? (transferred / total) * 100 : 0;
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

// ─── Main: setup updater IPC + check on startup ───────────────────────────────
export function setupUpdater(mainWindow: BrowserWindow): void {
  const currentVersion = app.getVersion();

  function send(channel: string, data: unknown): void {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  }

  // IPC: renderer يطلب بدء التحميل
  ipcMain.handle('update:start-download', async () => {
    if (!pendingManifest) return { ok: false, error: 'No pending manifest' };

    log('INFO', `update:start-download — url=${pendingManifest.downloadUrl}`);
    send('update:log', { event: 'update-download-started', version: pendingManifest.latestVersion });

    const tmpDir  = app.getPath('temp');
    const fname   = `OneSoftSetup-${pendingManifest.latestVersion}.exe`;
    const tmpPath = path.join(tmpDir, fname);
    downloadedFilePath = tmpPath;

    try {
      await downloadFile(
        pendingManifest.downloadUrl,
        tmpPath,
        (progress) => {
          log('INFO', `update:progress  ${Math.round(progress.percent)}%  ${progress.transferred}/${progress.total}`);
          send('update:progress', progress);
          send('update:log', { event: 'download-progress', ...progress });
        },
      );

      log('INFO', `update:downloaded  path=${tmpPath}`);
      send('update:downloaded', { version: pendingManifest.latestVersion, path: tmpPath });
      send('update:log', { event: 'update-downloaded', version: pendingManifest.latestVersion });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log('ERROR', 'update:start-download failed', e);
      send('update:log', { event: 'update-error', error: msg });
      send('update:error', { message: msg });
      return { ok: false, error: msg };
    }
  });

  // IPC: renderer يطلب التثبيت الآن (quit + install)
  ipcMain.handle('update:install-now', () => {
    if (!downloadedFilePath || !fs.existsSync(downloadedFilePath)) {
      log('WARN', 'update:install-now — file not found');
      return { ok: false, error: 'Downloaded file not found' };
    }
    log('INFO', `update:install-now — launching ${downloadedFilePath}`);
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

  // IPC: renderer يتخطى التحديث الاختياري
  ipcMain.handle('update:skip', () => {
    log('INFO', 'update:skip — user deferred optional update');
    send('update:log', { event: 'user-skipped-optional-update', version: pendingManifest?.latestVersion });
  });

  // ─── فحص التحديثات بعد 5 ثوان من بدء التشغيل ─────────────────────────
  let pendingManifest: UpdateManifest | null = null;

  setTimeout(async () => {
    log('INFO', `autoUpdater: checking-for-update  url=${MANIFEST_URL}  currentVersion=${currentVersion}`);
    send('update:status', { type: 'checking' } satisfies UpdateStatusEvent);
    send('update:log', { event: 'checking-for-update', currentVersion, url: MANIFEST_URL });

    try {
      const raw = await fetchJson(MANIFEST_URL);
      const manifest = raw as UpdateManifest;

      // تحقق بسيط من صحة البيانات
      if (!manifest?.latestVersion || !manifest?.downloadUrl) {
        throw new Error('Invalid manifest: missing latestVersion or downloadUrl');
      }

      log('INFO', `manifest fetched  latestVersion=${manifest.latestVersion}  minSupported=${manifest.minSupportedVersion}  mandatory=${manifest.mandatory}`);

      if (!semverLt(currentVersion, manifest.latestVersion)) {
        // لا يوجد تحديث
        log('INFO', 'autoUpdater: update-not-available');
        send('update:status', { type: 'no-update', currentVersion } satisfies UpdateStatusEvent);
        send('update:log', { event: 'update-not-available', currentVersion });
        return;
      }

      pendingManifest = manifest;

      // هل التحديث إجباري؟
      const isMandatory =
        manifest.mandatory ||
        (manifest.minSupportedVersion && semverLt(currentVersion, manifest.minSupportedVersion));

      if (isMandatory) {
        log('INFO', `autoUpdater: mandatory-update  ${currentVersion} < minSupported=${manifest.minSupportedVersion}`);
        send('update:status', { type: 'mandatory', manifest, currentVersion } satisfies UpdateStatusEvent);
        send('update:log', { event: 'mandatory-update-blocked-login', currentVersion, required: manifest.minSupportedVersion });
      } else {
        log('INFO', `autoUpdater: optional-update  ${currentVersion} → ${manifest.latestVersion}`);
        send('update:status', { type: 'optional', manifest, currentVersion } satisfies UpdateStatusEvent);
        send('update:log', { event: 'update-available', currentVersion, latestVersion: manifest.latestVersion });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log('WARN', `autoUpdater: check failed (non-critical) — ${msg}`);
      send('update:status', { type: 'error', message: msg } satisfies UpdateStatusEvent);
      send('update:log', { event: 'update-error', error: msg });
    }
  }, 5_000);
}
