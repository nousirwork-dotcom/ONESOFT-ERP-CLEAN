import { app, BrowserWindow, ipcMain, shell, session, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';

// Force esbuild to bundle obuf (used by postgres-bytea@3 via pg-protocol)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('obuf');

// ─── GPU switches — must be set BEFORE app.whenReady / BrowserWindow ─────────
//
// Problem: in virtualized / GPU-less Windows environments Electron launches
// a GPU subprocess that fails with error_code=18. After that it falls back
// to software rasterizer — but "--disable-software-rasterizer" blocks that
// fallback → "GPU process isn't usable. Goodbye." → entire process killed.
//
// Fix: use SwiftShader (Chromium's built-in software OpenGL). This runs
// entirely in-process, never spawns a GPU subprocess, never crashes.
//
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('use-gl', 'swiftshader');     // software OpenGL — no GPU process
app.commandLine.appendSwitch('disable-gpu-sandbox');       // avoids GPU sandbox errors in VMs
app.commandLine.appendSwitch('no-sandbox');                // belt-and-suspenders for VMs
// NOTE: --disable-software-rasterizer is intentionally REMOVED.
//       It was preventing the SwiftShader fallback and causing the fatal crash.

// ─── Icon Cache Refresh (Windows) ────────────────────────────────────────────
// يُستدعى مرة واحدة بعد كل تحديث لضمان ظهور الأيقونة الجديدة فوراً في:
//   سطح المكتب · Start Menu · Taskbar · نافذة البرنامج
function refreshWindowsIconCache(): void {
  if (process.platform !== 'win32') return;

  const versionFile = path.join(
    process.env['PROGRAMDATA'] ?? 'C:\\ProgramData',
    'OneSoft', 'last-run-version.txt',
  );
  const currentVersion = app.getVersion();

  let lastVersion = '';
  try { lastVersion = fs.readFileSync(versionFile, 'utf8').trim(); } catch { /* first run */ }

  if (lastVersion === currentVersion) return; // لا تحديث — لا داعي لتحديث الـ cache

  writeLog('INFO', `Icon cache refresh triggered (${lastVersion || 'first-run'} → ${currentVersion})`);

  // PowerShell: يُخطر Windows بتغيير الأيقونات (SHChangeNotify)
  // SHCNE_ASSOCCHANGED = 0x8000000 → يُعيد رسم جميع الأيقونات
  const ps = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class ShellNotify {
  [DllImport("shell32.dll")]
  public static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
}
"@
[ShellNotify]::SHChangeNotify(0x8000000, 0x1000, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Host "Icon cache refreshed"
`.trim();

  try {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      timeout: 8000,
      encoding: 'utf8',
    });
    if (result.status === 0) {
      writeLog('INFO', 'Icon cache refresh: OK');
    } else {
      writeLog('WARN', 'Icon cache refresh: non-zero exit', result.stderr);
    }
  } catch (e) {
    writeLog('WARN', 'Icon cache refresh: failed (non-critical)', e);
  }

  // احفظ الإصدار الحالي لتجنب إعادة التشغيل في المرة القادمة
  try {
    fs.mkdirSync(path.dirname(versionFile), { recursive: true });
    fs.writeFileSync(versionFile, currentVersion, 'utf8');
  } catch { /* non-critical */ }
}

// ─── Logger ──────────────────────────────────────────────────────────────────
const LOG_PATH = path.join(app.getPath('userData'), 'onesoft-installer.log');

function writeLog(level: string, message: string, detail?: unknown): void {
  const ts = new Date().toISOString();
  const extra = detail
    ? '\n' + (detail instanceof Error
        ? (detail.stack ?? String(detail))
        : (() => { try { return JSON.stringify(detail, null, 2); } catch { return String(detail); } })())
    : '';
  const line = `[${ts}] [${level}] ${message}${extra}\n`;
  console.log(line.trimEnd());
  try { fs.appendFileSync(LOG_PATH, line); } catch { /* ignore */ }
}

function stackTrace(): string {
  return new Error('callers').stack?.split('\n').slice(2, 6).join('\n') ?? '';
}

writeLog('INFO', '=== OneSoft Installer starting ===');
writeLog('INFO', `Electron ${process.versions.electron}  Node ${process.versions.node}  platform=${process.platform}`);
writeLog('INFO', `Log file: ${LOG_PATH}`);
writeLog('INFO', `__dirname: ${__dirname}`);
writeLog('INFO', `resourcesPath: ${(process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ?? 'N/A'}`);
writeLog('INFO', `GPU switches: disable-gpu + use-gl=swiftshader (software rendering, no GPU subprocess)`);

// ─── Early process-level handlers ────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  writeLog('FATAL', 'uncaughtException', err);
});

process.on('unhandledRejection', (reason) => {
  writeLog('ERROR', 'unhandledRejection', reason instanceof Error ? reason : { reason });
});

process.on('exit', (code) => {
  writeLog('INFO', `process.exit  code=${code}\n${stackTrace()}`);
});

process.on('beforeExit', (code) => {
  writeLog('INFO', `process.beforeExit  code=${code}`);
});

// ─── App-level lifecycle events ───────────────────────────────────────────────
app.on('child-process-gone', (_, details) => {
  writeLog('ERROR', 'child-process-gone', details);
});

// gpu-process-crashed exists in Electron 13 and older (replaced by child-process-gone)
// Keep for compatibility; cast needed since typings may omit it on newer versions
(app as NodeJS.EventEmitter).on('gpu-process-crashed', (event: unknown, killed: unknown) => {
  writeLog('ERROR', `gpu-process-crashed  killed=${killed}`, event);
});

app.on('window-all-closed', () => {
  writeLog('INFO', `window-all-closed\n${stackTrace()}`);
  if (process.platform !== 'darwin') {
    writeLog('INFO', 'calling app.quit() from window-all-closed');
    app.quit();
  }
});

app.on('quit', (_, exitCode) => {
  writeLog('INFO', `app.quit event  exitCode=${exitCode}\n${stackTrace()}`);
});

// ─── Installation state helpers ──────────────────────────────────────────────
// يقرأ version.json من ProgramData\OneSoft لمعرفة هل البرنامج مثبّت مسبقاً
function isAlreadyInstalled(): boolean {
  try {
    const versionFile = path.join(
      process.env['ProgramData'] || 'C:\\ProgramData',
      'OneSoft', 'version.json',
    );
    return fs.existsSync(versionFile);
  } catch {
    return false;
  }
}

// يقرأ بورت الخادم من config.json — الافتراضي 3000
function readServerPort(): number {
  try {
    const configFile = path.join(
      process.env['ProgramData'] || 'C:\\ProgramData',
      'OneSoft', 'config', 'onesoft.config.json',
    );
    const cfg = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    // المفتاح الصحيح هو backendPort (وليس port) كما يحفظه ConfigManager
    const port = (cfg?.server?.backendPort as number)
              ?? (cfg?.server?.port      as number)   // توافق مع نسخ قديمة
              ?? 3000;
    writeLog('INFO', `readServerPort → ${port} (from ${configFile})`);
    return port;
  } catch (e) {
    writeLog('WARN', `readServerPort fallback to 3000: ${e}`);
    return 3000;
  }
}

// ─── IPC imports ─────────────────────────────────────────────────────────────
import { registerRequirementsIpc } from './ipc/requirements.ipc.js';
import { registerDatabaseIpc }     from './ipc/database.ipc.js';
import { registerSetupIpc }        from './ipc/setup.ipc.js';
import { registerServicesIpc }     from './ipc/services.ipc.js';
import { registerHealthIpc }       from './ipc/health.ipc.js';
import { registerConfigIpc }       from './ipc/config.ipc.js';
import { registerUpgradeIpc }      from './ipc/upgrade.ipc.js';
import { registerFilesystemIpc }   from './ipc/filesystem.ipc.js';
import { registerUninstallIpc }    from './ipc/uninstall.ipc.js';
import { registerDeploymentIpc }   from './ipc/deployment.ipc.js';

let mainWindow: BrowserWindow | null = null;

// ─── createWindow ─────────────────────────────────────────────────────────────
function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  const indexPath   = path.join(__dirname, '..', '..', 'dist-ui', 'index.html');
  const isDebug     = process.env['ONESOFT_DEBUG'] === '1';
  const testMode    = process.env['ONESOFT_TEST_URL'] === '1';  // loads data:text/html instead

  writeLog('INFO', '--- createWindow ---');
  writeLog('INFO', `preload  : ${preloadPath}  exists=${fs.existsSync(preloadPath)}`);
  writeLog('INFO', `index    : ${indexPath}  exists=${fs.existsSync(indexPath)}`);
  writeLog('INFO', `isDebug=${isDebug}  testMode=${testMode}`);

  // Register session-level network error listener (fires for any failed request)
  session.defaultSession.webRequest.onErrorOccurred((details) => {
    writeLog('WARN', `session.webRequest.onErrorOccurred  error=${details.error}  url=${details.url}`);
  });

  writeLog('INFO', 'new BrowserWindow() — creating');

  mainWindow = new BrowserWindow({
    width: 860,
    height: 640,
    minWidth: 760,
    minHeight: 560,
    resizable: true,
    maximizable: true,
    minimizable: true,
    center: true,
    frame: false,
    titleBarStyle: 'hidden',
    show: false,   // show only on ready-to-show
    icon: path.join(__dirname, '..', '..', 'resources', 'icon.ico'),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  writeLog('INFO', 'new BrowserWindow() — done');

  const wc = mainWindow.webContents;

  // ── WebContents event handlers ────────────────────────────────────────────
  wc.on('did-start-loading', () => {
    writeLog('INFO', 'wc: did-start-loading');
  });

  wc.on('dom-ready', () => {
    writeLog('INFO', 'wc: dom-ready');
  });

  wc.on('did-finish-load', () => {
    writeLog('INFO', 'wc: did-finish-load');
  });

  wc.on('did-fail-load', (_, code, desc, url, isMainFrame) => {
    writeLog('ERROR', `wc: did-fail-load  code=${code}  desc=${desc}  url=${url}  mainFrame=${isMainFrame}`);
  });

  wc.on('did-fail-provisional-load', (_, code, desc, url) => {
    writeLog('ERROR', `wc: did-fail-provisional-load  code=${code}  desc=${desc}  url=${url}`);
  });

  wc.on('render-process-gone', (_, details) => {
    writeLog('ERROR', 'wc: render-process-gone', details);
  });

  wc.on('unresponsive', () => {
    writeLog('WARN', 'wc: unresponsive');
  });

  wc.on('responsive', () => {
    writeLog('INFO', 'wc: responsive');
  });

  wc.on('console-message', (_, level, message, line, source) => {
    // 0=verbose 1=info 2=warning 3=error
    writeLog('RENDERER', `[L${level}] [${source}:${line}] ${message}`);
  });

  // ── Window event handlers ─────────────────────────────────────────────────
  mainWindow.once('ready-to-show', () => {
    writeLog('INFO', 'window: ready-to-show — calling maximize() then show()');
    mainWindow?.maximize();
    mainWindow?.show();
    writeLog('INFO', 'window: maximize() + show() called');
    if (isDebug) {
      writeLog('INFO', 'ONESOFT_DEBUG=1 — opening DevTools (detach mode)');
      wc.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('show', () => {
    writeLog('INFO', 'window: show event');
  });

  mainWindow.on('close', () => {
    writeLog('INFO', `window: close event\n${stackTrace()}`);
  });

  mainWindow.on('closed', () => {
    writeLog('INFO', 'window: closed — mainWindow=null');
    mainWindow = null;
  });

  // ── Load URL / File ───────────────────────────────────────────────────────
  if (testMode) {
    // Minimal test: if this works, the problem is in React/preload/index.html
    const testUrl = 'data:text/html,<h1 style="font-family:sans-serif;padding:2em">Electron OK</h1>';
    writeLog('INFO', `TEST MODE: loadURL data:text/html — start`);
    wc.loadURL(testUrl)
      .then(() => writeLog('INFO', 'TEST MODE: loadURL — resolved'))
      .catch((e: unknown) => writeLog('ERROR', 'TEST MODE: loadURL — rejected', e));
  } else if (isAlreadyInstalled()) {
    // البرنامج مثبَّت مسبقاً — حمِّل تطبيق العمل مباشرةً (يعمل كـ Windows service)
    const port      = readServerPort();
    const serverUrl = `http://localhost:${port}`;
    writeLog('INFO', `already installed — loadURL ${serverUrl} — start`);
    mainWindow.loadURL(serverUrl)
      .then(() => writeLog('INFO', `loadURL ${serverUrl} — resolved`))
      .catch((e: unknown) => writeLog('ERROR', `loadURL ${serverUrl} — rejected`, e));
  } else {
    // أول تشغيل فعلي — اعرض معالج التثبيت
    writeLog('INFO', `first run — loadFile ${indexPath} — start`);
    mainWindow.loadFile(indexPath)
      .then(() => writeLog('INFO', 'loadFile — resolved'))
      .catch((e: unknown) => writeLog('ERROR', 'loadFile — rejected', e));
  }

  writeLog('INFO', 'createWindow() — end (all listeners attached, load initiated)');
}

// ─── Auto-Updater — يعمل فقط بعد اكتمال التثبيت ──────────────────────────────
function setupAutoUpdater(): void {
  if (!isAlreadyInstalled()) return;   // لا نُشغّل المحدِّث خلال معالج التثبيت

  autoUpdater.autoDownload    = false; // نسأل المستخدم قبل التنزيل
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    writeLog('INFO', 'autoUpdater: checking-for-update');
  });

  autoUpdater.on('update-available', (info) => {
    writeLog('INFO', `autoUpdater: update-available  version=${info.version}`);
    dialog.showMessageBox(mainWindow!, {
      type:    'info',
      title:   'تحديث جديد متاح',
      message: `الإصدار ${info.version} متاح للتنزيل`,
      detail:  'هل تريد تنزيل التحديث الآن؟ سيتم التثبيت عند إغلاق البرنامج.',
      buttons: ['تنزيل التحديث', 'لاحقاً'],
      defaultId: 0,
      cancelId:  1,
      noLink: true,
    }).then(({ response }) => {
      if (response === 0) {
        writeLog('INFO', 'autoUpdater: user accepted download');
        autoUpdater.downloadUpdate();
      } else {
        writeLog('INFO', 'autoUpdater: user deferred download');
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    writeLog('INFO', 'autoUpdater: update-not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    writeLog('INFO', `autoUpdater: download-progress  ${Math.round(progress.percent)}%`);
    mainWindow?.setProgressBar(progress.percent / 100);
  });

  autoUpdater.on('update-downloaded', (info) => {
    writeLog('INFO', `autoUpdater: update-downloaded  version=${info.version}`);
    mainWindow?.setProgressBar(-1);
    dialog.showMessageBox(mainWindow!, {
      type:    'info',
      title:   'التحديث جاهز',
      message: `الإصدار ${info.version} تم تنزيله`,
      detail:  'اضغط "تثبيت الآن" لإعادة تشغيل البرنامج وتطبيق التحديث.',
      buttons: ['تثبيت الآن', 'عند الإغلاق'],
      defaultId: 0,
      cancelId:  1,
      noLink: true,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on('error', (err) => {
    writeLog('ERROR', 'autoUpdater: error', err);
  });

  // فحص التحديثات بعد 5 ثوان من فتح البرنامج
  setTimeout(() => {
    writeLog('INFO', 'autoUpdater: starting checkForUpdates');
    autoUpdater.checkForUpdates().catch((e) => {
      writeLog('WARN', 'autoUpdater: checkForUpdates failed', e);
    });
  }, 5_000);
}

// ─── app.whenReady ────────────────────────────────────────────────────────────
app.whenReady()
  .then(() => {
    writeLog('INFO', 'app.whenReady() — resolved');

    // ─── UPLOADS_DIR ──────────────────────────────────────────────────────────
    // يُحدَّد هنا ويُمرَّر لأي عملية مشتقة عبر process.env
    // السبب: ProgramData\OneSoft\uploads لا يُمسح أبداً بالتحديثات (عكس Program Files)
    //         AppData قد يتغير بين المستخدمين، بينما ProgramData مشترك لكل المستخدمين
    //         يتطابق مع مسار config.json المستخدم بالفعل في الخادم
    process.env.UPLOADS_DIR = process.platform === 'win32'
      ? path.join(process.env['PROGRAMDATA'] || 'C:\\ProgramData', 'OneSoft', 'uploads')
      : path.join(app.getPath('userData'), 'uploads');
    writeLog('INFO', `UPLOADS_DIR = ${process.env.UPLOADS_DIR}`);

    refreshWindowsIconCache();          // تحديث icon cache عند أول فتح بعد تحديث
    writeLog('INFO', 'calling createWindow()');
    createWindow();
    writeLog('INFO', 'createWindow() returned — registering IPC handlers');

    registerRequirementsIpc(ipcMain, mainWindow);
    registerDatabaseIpc(ipcMain, mainWindow);
    registerSetupIpc(ipcMain, mainWindow);
    registerServicesIpc(ipcMain, mainWindow);
    registerHealthIpc(ipcMain, mainWindow);
    registerConfigIpc(ipcMain, mainWindow);
    registerUpgradeIpc(ipcMain, mainWindow);
    registerFilesystemIpc(ipcMain, mainWindow);
    registerUninstallIpc(ipcMain, mainWindow);
    registerDeploymentIpc(ipcMain, mainWindow);

    ipcMain.handle('window:minimize', () => {
      writeLog('INFO', 'IPC window:minimize');
      mainWindow?.minimize();
    });
    ipcMain.handle('window:maximize', () => {
      writeLog('INFO', 'IPC window:maximize');
      if (mainWindow?.isMaximized()) {
        mainWindow.restore();
      } else {
        mainWindow?.maximize();
      }
    });
    ipcMain.handle('window:is-maximized', () => {
      return mainWindow?.isMaximized() ?? false;
    });
    ipcMain.handle('window:close', () => {
      writeLog('INFO', `IPC window:close\n${stackTrace()}`);
      app.quit();
    });
    ipcMain.handle('window:openUrl', (_, url: string) => {
      writeLog('INFO', `IPC window:openUrl  url=${url}`);
      return shell.openExternal(url);
    });

    // تفعيل التحديث التلقائي (فقط بعد اكتمال التثبيت)
    setupAutoUpdater();

    writeLog('INFO', 'startup complete — waiting for window events');
  })
  .catch((err) => {
    writeLog('FATAL', 'app.whenReady() rejected', err);
  });
