import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
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
// يقرأ version.json من ProgramData\OneSoft لمعرفة هل البرنامج مثبّت مسبقاً.
// شرط إضافي: يجب أن يوجد config.json أيضاً — إلغاء التثبيت يحذف config لكن
// النسخ القديمة لم تكن تحذف version.json، فكان المُثبِّت يظن أن البرنامج
// مثبَّت ويحمِّل localhost بدل المعالج → صفحة بيضاء. التثبيت السليم يملك
// الملفين معاً دائماً.
function isAlreadyInstalled(): boolean {
  try {
    const oneSoftDir = path.join(
      process.env['ProgramData'] || 'C:\\ProgramData', 'OneSoft',
    );
    const versionFile = path.join(oneSoftDir, 'version.json');
    const configFile  = path.join(oneSoftDir, 'config', 'onesoft.config.json');
    const installed = fs.existsSync(versionFile) && fs.existsSync(configFile);
    if (fs.existsSync(versionFile) && !fs.existsSync(configFile)) {
      writeLog('WARN',
        'version.json موجود لكن config.json مفقود — حالة ما بعد إلغاء تثبيت قديم؛ سيُعرض معالج التثبيت');
    }
    return installed;
  } catch {
    return false;
  }
}

// يقرأ بورت الخادم من config.json — الافتراضي 3000
function readServerPort(): number {
  try {
    const configFile = path.join(
      process.env['ProgramData'] || process.env['PROGRAMDATA'] || 'C:\\ProgramData',
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

// يسكان البورتات الشائعة ليجد السيرفر الفعلي (fallback عند فشل config)
// يُستخدَم فقط عند التجديد لا عند أول تحميل
function scanForLivePort(primaryPort: number): Promise<number> {
  const candidates = [primaryPort, 3000, 3001, 3002, 3003].filter(
    (p, i, arr) => arr.indexOf(p) === i,
  );
  return new Promise((resolve) => {
    let checked = 0;
    let found   = false;
    for (const port of candidates) {
      const req = require('http').get(
        { hostname: 'localhost', port, path: '/api/trpc', timeout: 1500 },
        (res: { statusCode?: number }) => {
          if (!found && res.statusCode !== undefined) {
            found = true;
            writeLog('INFO', `scanForLivePort → found server at :${port}`);
            resolve(port);
          }
        },
      );
      req.on('error', () => {
        checked++;
        if (checked === candidates.length && !found) {
          writeLog('WARN', `scanForLivePort → no server found, using primary :${primaryPort}`);
          resolve(primaryPort);
        }
      });
      req.end();
    }
  });
}

// ─── Updater import ──────────────────────────────────────────────────────────
import { setupUpdater, setUpdaterLogger } from './updater.js';

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

// عدد محاولات إعادة الاتصال بالسيرفر بعد التثبيت
let serverLoadRetries = 0;
const MAX_SERVER_RETRIES = 15;  // 15 × 4s = 60 ثانية — وقت كافٍ لبدء Windows Service

// صفحة "جارٍ الاتصال..." تُعرض أثناء انتظار بدء الـ Windows Service
function connectingPageHtml(attempt: number, max: number): string {
  const dots = '.'.repeat((attempt % 3) + 1);
  return `data:text/html;charset=utf-8,<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8">
<style>
  body { margin:0; display:flex; align-items:center; justify-content:center;
         min-height:100vh; background:#F8FAFC; font-family:system-ui,sans-serif; direction:rtl; }
  .box { text-align:center; color:#1E344F; }
  .logo { font-size:48px; margin-bottom:16px; }
  h2 { font-size:20px; margin:0 0 8px; }
  p  { font-size:14px; color:#6B7280; margin:0 0 4px; }
  .dots { font-size:24px; color:#3B82F6; letter-spacing:4px; margin-top:16px; }
</style></head>
<body><div class="box">
  <div class="logo">⚙️</div>
  <h2>OneSoft ERP</h2>
  <p>جارٍ تشغيل الخادم${dots}</p>
  <p style="font-size:12px;color:#9CA3AF">المحاولة ${attempt} من ${max}</p>
  <div class="dots">●●●</div>
</div></body></html>`;
}

// ─── createWindow ─────────────────────────────────────────────────────────────
function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  // app.getAppPath() → المسار الصحيح داخل ASAR (يعمل مع fs.existsSync)
  // بعكس path.join(__dirname, '..', '..') الذي يخرج من ASAR ويُعيد false
  const indexPath   = path.join(app.getAppPath(), 'dist-ui', 'index.html');
  const isDebug     = process.env['ONESOFT_DEBUG'] === '1';
  const testMode    = process.env['ONESOFT_TEST_URL'] === '1';  // loads data:text/html instead

  writeLog('INFO', '--- createWindow ---');
  writeLog('INFO', `appPath  : ${app.getAppPath()}`);
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

    // ── Server retry logic ────────────────────────────────────────────────
    // فشل تحميل http://localhost:PORT:
    //   الـ Windows Service تحتاج حتى 60 ثانية لتبدأ بعد التثبيت/إعادة التشغيل
    //   → أعد المحاولة حتى MAX_SERVER_RETRIES مرة (كل 4 ثوانٍ = 60 ث إجمالاً)
    //   → لا نحذف version.json أبداً — إذا انتهت المحاولات نعرض صفحة خطأ بزر retry
    //
    if (isMainFrame && url && !url.startsWith('file://') && !url.startsWith('data:')) {
      if (serverLoadRetries < MAX_SERVER_RETRIES) {
        serverLoadRetries++;
        const delay = 4000;
        writeLog('WARN',
          `Server not ready — retry ${serverLoadRetries}/${MAX_SERVER_RETRIES} in ${delay}ms (url=${url}, code=${code})`);
        // عرض صفحة "جارٍ الاتصال..." بدلاً من الصفحة البيضاء
        mainWindow?.loadURL(connectingPageHtml(serverLoadRetries, MAX_SERVER_RETRIES))
          .catch(() => { /* ignore */ });
        setTimeout(() => {
          const primaryPort = readServerPort();
          const retryNum = serverLoadRetries;
          // من المحاولة الثالثة: سكان البورتات 3000-3003 لإيجاد السيرفر الفعلي
          const portPromise = retryNum >= 3
            ? scanForLivePort(primaryPort)
            : Promise.resolve(primaryPort);
          portPromise.then((port) => {
            const retryUrl = `http://localhost:${port}`;
            writeLog('INFO', `retry ${retryNum}: loadURL ${retryUrl}`);
            mainWindow?.loadURL(retryUrl)
              .catch((e: unknown) => writeLog('ERROR', `retry ${retryNum}: loadURL rejected`, e));
          }).catch(() => {
            const retryUrl = `http://localhost:${primaryPort}`;
            mainWindow?.loadURL(retryUrl).catch(() => { /* ignore */ });
          });
        }, delay);
      } else {
        serverLoadRetries = 0;
        writeLog('ERROR',
          `Server URL failed after all retries (code=${code}, url=${url}) — showing error page`);
        // لا نحذف version.json ولا نعرض المعالج — البرنامج مثبَّت لكن الخادم لا يستجيب
        // نعرض صفحة خطأ واضحة مع زر "إعادة المحاولة"
        const port = readServerPort();
        const errPage = `data:text/html;charset=utf-8,<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8">
<style>
body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;
background:#F8FAFC;font-family:system-ui,sans-serif;direction:rtl;}
.box{text-align:center;max-width:480px;padding:32px;}
h2{font-size:20px;color:#1E344F;margin:0 0 8px;}
p{font-size:13px;color:#6B7280;margin:4px 0;}
button{margin-top:24px;padding:10px 28px;background:#3B82F6;color:#fff;
border:none;border-radius:8px;font-size:15px;cursor:pointer;}
button:hover{background:#2563EB;}
</style></head>
<body><div class="box">
<div style="font-size:52px">⚙️</div>
<h2>الخادم لا يستجيب</h2>
<p>جارٍ تشغيل خدمة OneSoft Server...</p>
<p style="font-size:12px;margin-top:8px">إذا استمرت المشكلة، افتح services.msc وتحقق من خدمة <b>OneSoftServer</b></p>
<button onclick="window.location.href='http://localhost:${port}'">إعادة المحاولة</button>
</div></body></html>`;
        mainWindow?.loadURL(errPage).catch(() => { /* ignore */ });
      }
    } else if (isMainFrame && url && url.startsWith('file://') && code !== 0) {
      // فشل تحميل ملف file:// (مثل index.html) — اعرض صفحة تشخيص بدلاً من الصفحة البيضاء
      writeLog('ERROR', `file:// load failed  code=${code}  url=${url}`);
      const errPage = `data:text/html;charset=utf-8,<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8">
<style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;
background:#FEF2F2;font-family:system-ui,sans-serif;direction:rtl;}
.box{text-align:center;color:#991B1B;max-width:500px;padding:32px;}
h2{margin:0 0 12px;font-size:20px;}p{font-size:13px;color:#6B7280;margin:4px 0;word-break:break-all;}</style>
</head><body><div class="box">
<div style="font-size:48px">⚠️</div>
<h2>تعذّر تحميل واجهة التثبيت</h2>
<p>المسار: ${indexPath.replace(/</g, '&lt;')}</p>
<p>رمز الخطأ: ${code}</p>
<p style="margin-top:16px;font-size:12px">أغلق التطبيق وأعد تشغيله. إذا تكررت المشكلة راجع الدعم الفني.</p>
</div></body></html>`;
      mainWindow?.loadURL(errPage).catch(() => { /* ignore */ });
    }
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

  // ── DevTools — في الإنتاج تُمنع تماماً (Ctrl+Shift+I و F12 معطّلان) ──────────
  // تعمل فقط عند التشغيل بوضع التصحيح ONESOFT_DEBUG=1
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const isDevToolsCombo =
      (input.control && input.shift && (input.key === 'I' || input.key === 'J' || input.key === 'C')) ||
      input.key === 'F12';
    if (!isDevToolsCombo) return;
    if (isDebug) {
      if (wc.isDevToolsOpened()) {
        wc.closeDevTools();
      } else {
        wc.openDevTools({ mode: 'detach' });
      }
    } else {
      event.preventDefault();
    }
  });

  // ── Window event handlers ─────────────────────────────────────────────────
  const IS_STAGING = false; // production — DevTools تُفتح بـ Ctrl+Shift+I فقط
  mainWindow.once('ready-to-show', () => {
    writeLog('INFO', 'window: ready-to-show — calling maximize() then show()');
    mainWindow?.maximize();
    mainWindow?.show();
    writeLog('INFO', 'window: maximize() + show() called');
    if (isDebug || IS_STAGING) {
      writeLog('INFO', 'opening DevTools (detach mode) — debug/staging');
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
  if (!mainWindow) return;

  setUpdaterLogger(writeLog);
  setupUpdater(mainWindow);
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
    ipcMain.handle('app:get-version', () => app.getVersion());

    // تفعيل التحديث التلقائي (فقط بعد اكتمال التثبيت)
    setupAutoUpdater();

    writeLog('INFO', 'startup complete — waiting for window events');
  })
  .catch((err) => {
    writeLog('FATAL', 'app.whenReady() rejected', err);
  });
