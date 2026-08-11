/**
 * OneSoft ERP — Auto-Updater Module  (v3)
 *
 * الميزات:
 *   - HTTPS فقط — يرفض أي رابط http://
 *   - التحقق من SHA512 بعد اكتمال التحميل قبل تشغيل المثبّت
 *   - إعداد "التحقق التلقائي من التحديثات" لكل جهاز (autoUpdateEnabled — افتراضي: مفعّل)
 *     عند إيقافه: فحص صامت يُظهر التحديث الإجباري فقط — لا إزعاج بالتحديثات الاختيارية
 *   - "لاحقاً" يغلق النافذة فقط (تظهر مجدداً عند التشغيل القادم)
 *   - "لا تذكرني بهذا الإصدار" تخطي دائم لإصدار محدد (skippedVersion)
 *   - فحص يدوي من شاشة الإعدادات (update:check-now) — يعمل دائماً ويتجاهل التخطي
 *   - قناة التحديث لكل جهاز (updateChannel: stable | staging — افتراضي: stable)
 *     stable → update-manifest.json | staging → update-manifest.staging.json
 *     تُغيَّر من شاشة الإعدادات (للمسؤول فقط) — لا حاجة لأي Environment Variable
 *   - logging منظَّم لكل الأحداث
 *
 * متغيرات البيئة (اختيارية — للتجاوز اليدوي فقط):
 *   ONESOFT_UPDATE_URL  — تجاوز كامل لرابط manifest (أولوية أعلى من القناة)
 *
 * منطق التحديث:
 *   currentVersion < minSupportedVersion  → إجباري  (يُمنع الدخول للنظام)
 *   manifest.mandatory === true           → إجباري
 *   currentVersion < latestVersion       → اختياري  (قابل للتأجيل 24 ساعة)
 *   currentVersion === latestVersion      → لا يوجد تحديث
 */

import { ipcMain, app }   from 'electron';
import * as https          from 'https';
import * as fs             from 'fs';
import * as path           from 'path';
import * as crypto         from 'crypto';
import { spawn, spawnSync } from 'child_process';
import type { BrowserWindow } from 'electron';
import { ConfigManager } from '../core/config/ConfigManager.js';
import { MigrationCredentialStore } from '../core/security/MigrationCredentialStore.js';
import { chooseUpgradeLaunchMode } from '../core/upgrade/UpgradeLaunchPolicy.js';

// ─── روابط Manifest حسب قناة التحديث ─────────────────────────────────────────
// GitHub raw content — يعمل مباشرة بدون خادم خارجي
// قناة Stable  → update-manifest.json          (الإنتاج — جميع العملاء)
// قناة Staging → update-manifest.staging.json  (الاختبار — أجهزة التجربة فقط)
const RAW_BASE = 'https://raw.githubusercontent.com/nousirwork-dotcom/ONESOFT-ERP-CLEAN/main';

export type UpdateChannel = 'stable' | 'staging';

const CHANNEL_MANIFEST_URLS: Record<UpdateChannel, string> = {
  stable:  `${RAW_BASE}/update-manifest.json`,
  staging: `${RAW_BASE}/update-manifest.staging.json`,
};

/**
 * يُحدَّد رابط الـ manifest عند كل فحص (وليس مرة واحدة عند التشغيل)
 * حتى يسري تغيير القناة فوراً بدون إعادة تشغيل.
 * الأولوية: ONESOFT_UPDATE_URL (تجاوز يدوي اختياري) ← قناة الجهاز المحفوظة ← stable
 */
function resolveManifestUrl(): string {
  const override = process.env['ONESOFT_UPDATE_URL'];
  if (override) return override;
  return CHANNEL_MANIFEST_URLS[getUpdateChannel()];
}

// ملاحظة: زر "لاحقاً" لم يعد يحفظ أي تأجيل — الرسالة تظهر مجدداً عند التشغيل القادم.
// "لا تذكرني بهذا الإصدار" يحفظ skippedVersion بشكل دائم (حتى صدور إصدار أحدث).

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

// ─── تفضيلات التحديث (لكل جهاز — تُحفظ في userData) ─────────────────────────
interface UpdatePrefs {
  /** التحقق التلقائي من التحديثات عند بدء التشغيل (افتراضي: مفعّل) */
  autoUpdateEnabled?: boolean;
  /** إصدار اختار المستخدم عدم التذكير به مجدداً (دائم حتى صدور أحدث) */
  skippedVersion?: string;
  skippedAt?:      number;
  /** آخر وقت تم فيه فحص التحديثات (ناجح أو فاشل) */
  lastCheckAt?:    number;
  /** قناة التحديث (افتراضي: stable — جميع العملاء) */
  updateChannel?:  UpdateChannel;
}

function prefsPath(): string {
  return path.join(app.getPath('userData'), 'onesoft-update-prefs.json');
}
function readPrefs(): UpdatePrefs {
  try { return JSON.parse(fs.readFileSync(prefsPath(), 'utf8')) as UpdatePrefs; }
  catch { return {}; }
}
function writePrefs(patch: Partial<UpdatePrefs>): void {
  try {
    const merged = { ...readPrefs(), ...patch };
    fs.writeFileSync(prefsPath(), JSON.stringify(merged, null, 2), 'utf8');
  } catch (e) { log('WARN', `writePrefs failed: ${e}`); }
}
function isAutoUpdateEnabled(): boolean {
  return readPrefs().autoUpdateEnabled !== false; // الافتراضي: مفعّل
}
/** قناة التحديث المحفوظة للجهاز — أي قيمة غير معروفة تُعامل كـ stable */
function getUpdateChannel(): UpdateChannel {
  return readPrefs().updateChannel === 'staging' ? 'staging' : 'stable';
}
/** تخطي دائم لإصدار محدد — للفحص التلقائي فقط، الفحص اليدوي يعرضه دائماً */
function shouldSkipOptional(version: string): boolean {
  return readPrefs().skippedVersion === version;
}

// ─── HTTPS enforcement ────────────────────────────────────────────────────────
function enforceHttps(url: string, label: string): void {
  if (!url.startsWith('https://')) {
    throw new Error(
      `[updater] ${label} يجب أن يبدأ بـ https:// — تم رفض الرابط: ${url.split('?')[0].slice(0, 80)}`,
    );
  }
}

// ─── semver ───────────────────────────────────────────────────────────────────
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

// ─── Fetch JSON (HTTPS فقط) ───────────────────────────────────────────────────
function fetchJson(url: string): Promise<unknown> {
  enforceHttps(url, 'Manifest URL');
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 12_000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJson(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} — تعذر جلب manifest من: ${url}`));
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

// ─── Download file with progress (cancelable) ─────────────────────────────────
let downloadedFilePath: string | null = null;
let _activeRequest:     import('http').ClientRequest | null = null;
let _downloadAborted    = false;

function hasLegacyAdminCredential(): boolean {
  if (!ConfigManager.exists()) return false;
  try {
    const database = ConfigManager.load().database;
    const configuredAdminUser = database.adminUser?.trim();
    const configuredAdminPassword = database.adminPassword?.trim();
    if (configuredAdminUser && configuredAdminPassword) return true;

    // Older installations stored the PostgreSQL administrator as the active
    // database user. Treat that pair as a valid bootstrap capability only
    // while the runtime role has not yet been provisioned.
    return database.user !== 'onesoft_app' && Boolean(database.user?.trim() && database.password);
  } catch {
    return false;
  }
}

export function getUpgradeLaunchMode(): 'silent' | 'interactive' {
  return chooseUpgradeLaunchMode({
    migrationCredentialValid: MigrationCredentialStore.load() !== null,
    legacyAdminCredentialValid: hasLegacyAdminCredential(),
  });
}

/** إلغاء التحميل الجاري — يُطلق من update:cancel-download */
function abortActiveDownload(): void {
  _downloadAborted = true;
  if (_activeRequest) {
    _activeRequest.destroy(new Error('download-cancelled'));
    _activeRequest = null;
  }
}

function downloadFile(
  url:        string,
  destPath:   string,
  onProgress: (e: UpdateProgressEvent) => void,
): Promise<void> {
  enforceHttps(url, 'Download URL');
  _downloadAborted = false;
  return new Promise((resolve, reject) => {
    const file      = fs.createWriteStream(destPath);
    const startTime = Date.now();

    const doGet = (u: string) => {
      if (_downloadAborted) {
        file.close(); fs.unlink(destPath, () => {});
        reject(new Error('download-cancelled'));
        return;
      }
      enforceHttps(u, 'Redirect URL');
      const req = https.get(u, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doGet(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          file.close(); fs.unlink(destPath, () => {});
          reject(new Error(`فشل التحميل: HTTP ${res.statusCode}`));
          return;
        }
        const total     = parseInt(res.headers['content-length'] ?? '0', 10);
        let transferred = 0;
        res.on('data', (chunk: Buffer) => {
          transferred += chunk.length;
          const elapsed        = (Date.now() - startTime) / 1_000;
          const bytesPerSecond = elapsed > 0 ? transferred / elapsed : 0;
          const percent        = total > 0 ? (transferred / total) * 100 : 0;
          onProgress({ percent, transferred, total, bytesPerSecond });
        });
        res.pipe(file);
        res.on('end', () => { _activeRequest = null; file.close(); resolve(); });
        res.on('error', (e) => {
          _activeRequest = null;
          file.close(); fs.unlink(destPath, () => {}); reject(e);
        });
      });
      _activeRequest = req;
      req.on('error', (e) => {
        _activeRequest = null;
        file.close();
        fs.unlink(destPath, () => {});
        const isCancelled = _downloadAborted || e.message === 'download-cancelled';
        reject(isCancelled ? new Error('download-cancelled') : e);
      });
    };

    doGet(url);
  });
}

// ─── SHA512 verification ──────────────────────────────────────────────────────
function verifySha512(filePath: string, expected: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const hash   = crypto.createHash('sha512');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => {
      const actual      = hash.digest('hex');
      const expectedHex = expected.length === 128
        ? expected.toLowerCase()
        : Buffer.from(expected, 'base64').toString('hex');
      if (actual !== expectedHex) {
        reject(new Error(
          `SHA512 مختلف — expected: ${expectedHex.slice(0, 16)}… got: ${actual.slice(0, 16)}…\n` +
          'الملف قد يكون تالفًا أو تم التلاعب به.',
        ));
      } else {
        resolve();
      }
    });
    stream.on('error', reject);
  });
}

// ─── Main: setupUpdater ───────────────────────────────────────────────────────
export function setupUpdater(mainWindow: BrowserWindow): void {
  const currentVersion = app.getVersion();

  // pendingManifest مُعلَن هنا ليكون متاحًا لجميع الـ handlers
  let pendingManifest: UpdateManifest | null = null;

  function send(channel: string, data: unknown): void {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
  }

  // ─── منطق الفحص (مُعاد الاستخدام) ─────────────────────────────────────────
  /**
   * silentUnlessMandatory: يُستخدم عندما يكون التحديث التلقائي متوقفاً —
   * نفحص بصمت (بدون أي أحداث للواجهة) ونُظهر النافذة فقط إذا كان التحديث إجبارياً.
   */
  async function doCheck(opts: { source: 'auto' | 'manual'; silentUnlessMandatory?: boolean } = { source: 'auto' }): Promise<void> {
    const { source, silentUnlessMandatory = false } = opts;
    const manifestUrl = resolveManifestUrl();
    const channel     = getUpdateChannel();
    log('INFO', `checking-for-update  url=${manifestUrl}  channel=${channel}  version=${currentVersion}  source=${source}  silent=${silentUnlessMandatory}`);
    if (!silentUnlessMandatory) {
      send('update:status', { type: 'checking' } satisfies UpdateStatusEvent);
    }
    send('update:log', { event: 'checking-for-update', currentVersion, url: manifestUrl, channel, source });
    writePrefs({ lastCheckAt: Date.now() });

    const raw      = await fetchJson(manifestUrl);
    const manifest = raw as UpdateManifest;

    if (!manifest?.latestVersion) throw new Error('Invalid manifest: missing latestVersion');
    if (!manifest?.downloadUrl)   throw new Error('Invalid manifest: missing downloadUrl');
    if (!manifest.downloadUrl.startsWith('https://')) {
      throw new Error('downloadUrl في manifest يجب أن يبدأ بـ https://');
    }

    log('INFO', `manifest  latest=${manifest.latestVersion}  minSupported=${manifest.minSupportedVersion}  mandatory=${manifest.mandatory}  sha512=${manifest.sha512 ? '✓' : '✗'}  publishedAt=${manifest.publishedAt ?? '—'}`);

    // ── تشخيص صريح: القيم الفعلية قبل المقارنة ──────────────────────────────
    const isNewer = semverLt(currentVersion, manifest.latestVersion);
    log('INFO', `semver-comparison  current="${currentVersion}"  latest="${manifest.latestVersion}"  isNewer=${isNewer}  downloadUrl=${manifest.downloadUrl}`);
    send('update:log', {
      event:          'semver-comparison',
      currentVersion,
      latestVersion:  manifest.latestVersion,
      isNewer,
      downloadUrl:    manifest.downloadUrl,
      source,
    });

    // لا يوجد تحديث
    if (!isNewer) {
      log('INFO', 'update-not-available');
      if (!silentUnlessMandatory) {
        send('update:status', { type: 'no-update', currentVersion } satisfies UpdateStatusEvent);
      }
      send('update:log', { event: 'update-not-available', currentVersion, latestVersion: manifest.latestVersion });
      return;
    }

    pendingManifest = manifest;

    // هل التحديث إجباري؟
    const isMandatory =
      manifest.mandatory ||
      (!!manifest.minSupportedVersion && semverLt(currentVersion, manifest.minSupportedVersion));

    if (isMandatory) {
      log('INFO', `mandatory-update-blocked-login  current=${currentVersion}  minSupported=${manifest.minSupportedVersion}`);
      send('update:status', { type: 'mandatory', manifest, currentVersion } satisfies UpdateStatusEvent);
      send('update:log',    { event: 'mandatory-update-blocked-login', currentVersion, required: manifest.minSupportedVersion });
      return;
    }

    // التحديث التلقائي متوقف — تحديث اختياري → صمت تام (لا نافذة ولا حالة)
    if (silentUnlessMandatory) {
      log('INFO', `optional-update-suppressed (auto-update disabled)  version=${manifest.latestVersion}`);
      send('update:log', { event: 'optional-update-suppressed', reason: 'auto-update-disabled', version: manifest.latestVersion });
      return;
    }

    // تحديث اختياري — "لا تذكرني بهذا الإصدار" (للفحص التلقائي فقط، دائم)
    if (source === 'auto' && shouldSkipOptional(manifest.latestVersion)) {
      log('INFO', `update-skipped-version  version=${manifest.latestVersion}`);
      send('update:log',    { event: 'update-skipped-version', version: manifest.latestVersion });
      send('update:status', { type: 'no-update', currentVersion } satisfies UpdateStatusEvent);
      return;
    }

    log('INFO', `update-available  ${currentVersion} → ${manifest.latestVersion}  source=${source}`);
    send('update:status', { type: 'optional', manifest, currentVersion } satisfies UpdateStatusEvent);
    send('update:log',    { event: 'update-available', currentVersion, latestVersion: manifest.latestVersion, source });
  }

  async function downloadPendingUpdate(manifest: UpdateManifest): Promise<{ ok: boolean; error?: string }> {
    const { downloadUrl, latestVersion, sha512 } = manifest;
    try { enforceHttps(downloadUrl, 'downloadUrl'); }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log('ERROR', msg);
      send('update:error', { message: msg });
      send('update:log', { event: 'update-error', error: msg });
      return { ok: false, error: msg };
    }

    log('INFO', `update-download-started  url=${downloadUrl}  version=${latestVersion}`);
    send('update:log', { event: 'update-download-started', version: latestVersion });
    const tmpPath = path.join(app.getPath('temp'), `OneSoftSetup-${latestVersion}.exe`);
    downloadedFilePath = tmpPath;

    try {
      await downloadFile(downloadUrl, tmpPath, (progress) => {
        log('INFO', `download-progress  ${Math.round(progress.percent)}%  speed=${Math.round(progress.bytesPerSecond / 1024)}KB/s`);
        send('update:progress', progress);
        send('update:log', { event: 'download-progress', ...progress });
      });
      if (sha512) {
        log('INFO', `verifying SHA512 for ${tmpPath}`);
        send('update:log', { event: 'update-verifying-checksum', version: latestVersion });
        await verifySha512(tmpPath, sha512);
        log('INFO', 'SHA512 verified ✓');
        send('update:log', { event: 'update-checksum-ok', version: latestVersion });
      } else {
        log('WARN', 'sha512 غير موجود في manifest — تخطي التحقق');
        send('update:log', { event: 'update-checksum-skipped', reason: 'no sha512 in manifest' });
      }
      log('INFO', `update-downloaded  path=${tmpPath}`);
      send('update:downloaded', { version: latestVersion, path: tmpPath });
      send('update:log', { event: 'update-downloaded', version: latestVersion });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log('ERROR', `download failed — ${msg}`);
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
      downloadedFilePath = null;
      send('update:log', { event: 'update-error', error: msg });
      send('update:error', { message: msg });
      return { ok: false, error: msg };
    }
  }

  function installDownloadedUpdate(): { ok: boolean; error?: string } {
    if (!downloadedFilePath || !fs.existsSync(downloadedFilePath)) {
      log('WARN', 'update:install-now — file not found');
      return { ok: false, error: 'الملف غير موجود — حاول التحميل مجدداً' };
    }
    // Decide whether the downloaded NSIS installer may run silently before
    // stopping the current application/services. A first Legacy bootstrap
    // needs the interactive wizard; otherwise the old app would stop and
    // leave the customer with a silent, non-actionable failure.
    const launchMode = getUpgradeLaunchMode();
    const installerArgs = launchMode === 'silent' ? ['/S'] : [];
    log('INFO', `update-installer-launch-mode  mode=${launchMode}`);
    send('update:log', {
      event: 'update-installer-launch-mode',
      mode: launchMode,
      reason: launchMode === 'interactive'
        ? 'migration-credential-and-legacy-admin-credential-unavailable'
        : 'protected-migration-capability-available',
    });
    log('INFO', `update-installing  path=${downloadedFilePath}`);
    send('update:log', { event: 'update-installing', path: downloadedFilePath });
    if (process.platform === 'win32') {
      // NSIS may invoke the previous uninstaller during an update. That
      // uninstaller belongs to the old installation, so stopping services
      // here is the only version-independent way to release Node handles
      // before replacement. The target installer runs the shared Upgrade Core
      // after its files are copied and starts services only after that gate.
      for (const service of ['OneSoft-Client', 'OneSoft-Updater', 'OneSoft-Server']) {
        try {
          spawnSync('sc.exe', ['stop', service], {
            windowsHide: true,
            stdio: 'ignore',
            timeout: 30_000,
          });
        } catch {}
      }
    }
    const child = spawn(downloadedFilePath, installerArgs, { detached: true, stdio: 'ignore', shell: false });
    child.unref();
    setTimeout(() => app.quit(), 500);
    return { ok: true };
  }

  // ─── IPC: بدء التحميل ─────────────────────────────────────────────────────
  ipcMain.handle('update:start-download', async () => {
    if (!pendingManifest) return { ok: false, error: 'No pending manifest — شغّل فحص التحديثات أولاً' };
    return downloadPendingUpdate(pendingManifest);
  });

  // ─── IPC: تثبيت التحديث ───────────────────────────────────────────────────
  ipcMain.handle('update:install-now', () => {
    return installDownloadedUpdate();
  });

  // ─── IPC: إلغاء التحميل الجاري ──────────────────────────────────────────────
  ipcMain.handle('update:cancel-download', () => {
    log('INFO', 'user-cancelled-download');
    send('update:log', { event: 'user-cancelled-download' });
    abortActiveDownload();
    // حذف الملف الجزئي إن وجد
    if (downloadedFilePath) {
      try { if (fs.existsSync(downloadedFilePath)) fs.unlinkSync(downloadedFilePath); } catch {}
      downloadedFilePath = null;
    }
    send('update:cancelled', {});
    return { ok: true };
  });

  // ─── IPC: "لاحقاً" — يغلق النافذة فقط، تظهر مجدداً عند التشغيل القادم ────
  ipcMain.handle('update:skip', () => {
    const version = pendingManifest?.latestVersion ?? 'unknown';
    log('INFO', `user-postponed-optional-update  version=${version}`);
    send('update:log', { event: 'user-postponed-optional-update', version });
    // لا يُحفظ أي شيء — الرسالة تظهر مرة أخرى عند التشغيل القادم
  });

  // ─── IPC: "لا تذكرني بهذا الإصدار مرة أخرى" — تخطي دائم لهذا الإصدار ─────
  ipcMain.handle('update:skip-version', () => {
    const version = pendingManifest?.latestVersion;
    if (!version) return { ok: false, error: 'No pending update' };
    log('INFO', `user-skipped-version-permanently  version=${version}`);
    send('update:log', { event: 'user-skipped-version-permanently', version });
    writePrefs({ skippedVersion: version, skippedAt: Date.now() });
    return { ok: true };
  });

  // ─── IPC: قراءة تفضيلات التحديث ──────────────────────────────────────────
  ipcMain.handle('update:get-prefs', () => {
    const prefs = readPrefs();
    return {
      autoUpdateEnabled: prefs.autoUpdateEnabled !== false,
      skippedVersion:    prefs.skippedVersion ?? null,
      lastCheckAt:       prefs.lastCheckAt ?? null,
      updateChannel:     getUpdateChannel(),
      currentVersion,
    };
  });

  // ─── IPC: تغيير قناة التحديث (stable / staging) — إعداد خاص بالجهاز ────────
  ipcMain.handle('update:set-channel', (_event, channel: unknown) => {
    if (channel !== 'stable' && channel !== 'staging') {
      return { ok: false, error: 'قناة غير معروفة — القيم المسموحة: stable أو staging' };
    }
    log('INFO', `update-channel-changed  channel=${channel}  url=${CHANNEL_MANIFEST_URLS[channel]}`);
    send('update:log', { event: 'update-channel-changed', channel });
    writePrefs({ updateChannel: channel });
    return { ok: true, updateChannel: channel };
  });

  // ─── IPC: تشغيل/إيقاف التحقق التلقائي (إعداد خاص بالجهاز) ────────────────
  ipcMain.handle('update:set-auto-update', (_event, enabled: unknown) => {
    const value = enabled === true;
    log('INFO', `auto-update-setting-changed  enabled=${value}`);
    send('update:log', { event: 'auto-update-setting-changed', enabled: value });
    writePrefs({ autoUpdateEnabled: value });
    return { ok: true, autoUpdateEnabled: value };
  });

  // ─── IPC: فحص يدوي من شاشة الإعدادات (يعمل دائماً — يتجاهل الإيقاف والتخطي) ──
  ipcMain.handle('update:check-now', async () => {
    try {
      await doCheck({ source: 'manual' });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log('WARN', `update:check-now failed — ${msg}`);
      send('update:status', { type: 'error', message: msg } satisfies UpdateStatusEvent);
      send('update:log',    { event: 'update-error', error: msg });
      return { ok: false, error: msg };
    }
  });

  // ─── فحص تلقائي بعد 5 ثوان من بدء التشغيل ────────────────────────────────
  // - إذا كان التحقق التلقائي مفعّلاً: فحص عادي (نافذة عند وجود تحديث)
  // - إذا كان متوقفاً: فحص صامت — يُظهر النافذة فقط للتحديث الإجباري
  //   (خيار الإيقاف لا يتجاوز التحديث الإجباري أبداً)
  // - أي فشل (انقطاع إنترنت مثلاً): يُسجَّل في اللوج فقط — بدون رسائل مزعجة
  setTimeout(async () => {
    const autoEnabled = isAutoUpdateEnabled();
    try {
      if (autoEnabled) {
        await doCheck({ source: 'auto' });
      } else {
        log('INFO', 'auto-update disabled — silent check for mandatory updates only');
        send('update:log', { event: 'auto-update-disabled-silent-check' });
        await doCheck({ source: 'auto', silentUnlessMandatory: true });
      }

      // CI-only acceptance hook. It deliberately reuses the public updater
      // path (manifest check, HTTPS download, SHA512 verification, then the
      // NSIS installer) so Windows acceptance never bypasses updater behavior.
      // It is impossible to activate outside CI.
      if (
        process.env['CI'] === 'true' &&
        process.env['ONESOFT_ACCEPTANCE_AUTO_UPDATE'] === '1' &&
        pendingManifest &&
        semverLt(currentVersion, pendingManifest.latestVersion)
      ) {
        log('INFO', 'acceptance-auto-update-start');
        send('update:log', { event: 'acceptance-auto-update-start', version: pendingManifest.latestVersion });
        const download = await downloadPendingUpdate(pendingManifest);
        if (!download.ok) throw new Error(download.error ?? 'acceptance update download failed');
        const install = installDownloadedUpdate();
        if (!install.ok) throw new Error(install.error ?? 'acceptance update install failed');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const acceptanceMode =
        process.env['CI'] === 'true' &&
        process.env['ONESOFT_ACCEPTANCE_AUTO_UPDATE'] === '1';
      if (acceptanceMode) {
        // Acceptance is a hard gate. A failed manifest/download/checksum or
        // installer launch must never be converted into a false-positive run.
        log('ERROR', `acceptance-auto-update-failed — ${msg}`);
        send('update:log', { event: 'acceptance-auto-update-failed', error: msg });
        app.exit(1);
        return;
      }
      // فشل الفحص عند بدء التشغيل (غالباً انقطاع إنترنت) — لوج فقط، لا شاشة خطأ
      log('WARN', `auto check failed (non-critical, silent) — ${msg}`);
      send('update:log', { event: 'update-check-failed-silent', error: msg });
    }
  }, 5_000);
}
