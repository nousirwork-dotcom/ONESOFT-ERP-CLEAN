'use strict';

/**
 * main.js — Electron Main Process
 * OneSoft ERP Desktop Launcher
 *
 * المهام:
 *  - قفل التطبيق (instance واحد فقط)
 *  - تشغيل خادم Express في الخلفية
 *  - عرض splash screen أثناء التشغيل
 *  - فتح المتصفح عند الجاهزية
 *  - أيقونة System Tray مع قوائم التحكم
 */

const {
  app, BrowserWindow, Tray, Menu, shell,
  ipcMain, dialog, nativeImage,
} = require('electron');
const { autoUpdater } = require('electron-updater');
const path  = require('path');
const fs    = require('fs');
const http  = require('http');
const { spawn, execSync } = require('child_process');

// ── مسارات ────────────────────────────────────────────────────────────────────
const IS_DEV      = !app.isPackaged;
const APP_ROOT    = IS_DEV
  ? path.join(__dirname, '..')
  : path.join(process.resourcesPath);

const SERVER_DIST = IS_DEV
  ? path.join(APP_ROOT, 'server-app', 'dist', 'index.mjs')
  : path.join(APP_ROOT, 'server', 'dist', 'index.mjs');

const CONFIG_PATH = path.join(
  app.getPath('appData'), 'OneSoftERP', 'config.json'
);
const LOG_DIR = path.join(app.getPath('appData'), 'OneSoftERP', 'logs');
const DATA_DIR = path.join(app.getPath('appData'), 'OneSoftERP');

// ── إعداد المجلدات ────────────────────────────────────────────────────────────
[DATA_DIR, LOG_DIR].forEach(d => { try { fs.mkdirSync(d, { recursive: true }); } catch {} });

// ── قراءة الإعدادات ───────────────────────────────────────────────────────────
function loadConfig() {
  const defaults = {
    port:       3000,
    dbUrl:      'postgresql://postgres:postgres@localhost:5432/onesoft_erp',
    dbType:     'postgresql',
    jwtSecret:  '',
    backupDir:  path.join(DATA_DIR, 'backups'),
    logDir:     LOG_DIR,
    nodeEnv:    'production',
    openBrowserOnStart: true,
    language:   'ar',
  };
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return { ...defaults, ...JSON.parse(raw) };
    }
  } catch (e) {
    writeLog('WARN', `config parse error: ${e.message}`);
  }
  // إنشاء ملف إعدادات افتراضي
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaults, null, 2), 'utf-8'); } catch {}
  return defaults;
}

// ── سجلات التطبيق ─────────────────────────────────────────────────────────────
function writeLog(level, msg) {
  const ts   = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}\n`;
  process.stdout.write(line);
  try {
    const today = ts.slice(0, 10);
    fs.appendFileSync(path.join(LOG_DIR, `electron-${today}.log`), line);
  } catch {}
}

// ── حالة عامة ─────────────────────────────────────────────────────────────────
let splashWin   = null;
let tray        = null;
let serverProc  = null;
let serverReady = false;
let cfg         = loadConfig();
const SERVER_URL = `http://localhost:${cfg.port}`;

// ── قفل النسخة الواحدة ────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // نسخة أخرى تعمل بالفعل — افتح المتصفح وأغلق هذه النسخة
  shell.openExternal(SERVER_URL).catch(() => {});
  app.quit();
} else {
  app.on('second-instance', () => {
    shell.openExternal(SERVER_URL).catch(() => {});
    if (splashWin) splashWin.focus();
  });
}

// ── تشغيل خادم Backend ────────────────────────────────────────────────────────
function startServer() {
  if (serverProc) return;
  writeLog('INFO', `starting server: ${SERVER_DIST}`);

  const env = {
    ...process.env,
    PORT:         String(cfg.port),
    DATABASE_URL: cfg.dbUrl,
    DB_TYPE:      cfg.dbType,
    JWT_SECRET:   cfg.jwtSecret || undefined,
    NODE_ENV:     cfg.nodeEnv,
    LOG_DIR:      cfg.logDir,
    BACKUP_DIR:   cfg.backupDir,
    ELECTRON_MODE: '1',
  };
  // حذف المفاتيح الفارغة
  Object.keys(env).forEach(k => { if (!env[k]) delete env[k]; });

  serverProc = spawn(process.execPath, [SERVER_DIST], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  serverProc.stdout.on('data', d => writeLog('SERVER', d.toString().trim()));
  serverProc.stderr.on('data', d => writeLog('SERVER_ERR', d.toString().trim()));
  serverProc.on('exit', (code, sig) => {
    writeLog('WARN', `server exited code=${code} sig=${sig}`);
    serverProc  = null;
    serverReady = false;
    if (tray) updateTrayMenu();
  });
}

function stopServer() {
  if (!serverProc) return;
  writeLog('INFO', 'stopping server');
  try { serverProc.kill('SIGTERM'); } catch {}
  serverProc  = null;
  serverReady = false;
}

// ── انتظار جاهزية الخادم ─────────────────────────────────────────────────────
function waitForServer(maxMs = 30000, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const steps = [
      { pct: 10, msg: 'جارٍ تشغيل الخادم...' },
      { pct: 30, msg: 'جارٍ الاتصال بقاعدة البيانات...' },
      { pct: 60, msg: 'جارٍ تحميل الإعدادات...' },
      { pct: 80, msg: 'جارٍ تهيئة النظام...' },
      { pct: 95, msg: 'لحظات وسيكون البرنامج جاهزاً...' },
    ];
    let stepIdx = 0;

    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(95, Math.round((elapsed / maxMs) * 95));

      // إرسال تقدم للـ splash
      if (splashWin && !splashWin.isDestroyed()) {
        const stepMsg = steps[Math.min(stepIdx, steps.length - 1)];
        if (pct > (steps[stepIdx]?.pct ?? 0)) stepIdx++;
        splashWin.webContents.send('splash:progress', { pct, msg: stepMsg.msg });
      }

      http.get(`${SERVER_URL}/api/health`, res => {
        if (res.statusCode === 200) {
          if (splashWin && !splashWin.isDestroyed()) {
            splashWin.webContents.send('splash:progress', { pct: 100, msg: 'البرنامج جاهز ✓' });
          }
          setTimeout(resolve, 500);
        } else {
          if (elapsed >= maxMs) reject(new Error('server timeout'));
          else setTimeout(tick, intervalMs);
        }
      }).on('error', () => {
        if (elapsed >= maxMs) reject(new Error('server timeout'));
        else setTimeout(tick, intervalMs);
      });
    };
    tick();
  });
}

// ── Splash Screen ─────────────────────────────────────────────────────────────
function createSplash() {
  splashWin = new BrowserWindow({
    width:  420,
    height: 340,
    frame:  false,
    transparent: false,
    resizable:   false,
    alwaysOnTop: true,
    center:      true,
    skipTaskbar: true,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });
  splashWin.loadFile(path.join(__dirname, 'splash.html'));
  splashWin.webContents.once('did-finish-load', () => {
    splashWin.webContents.send('splash:version', app.getVersion());
  });
}

// ── System Tray ───────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon-tray.png');
  const img = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(img);
  tray.setToolTip('OneSoft ERP');
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;
  const running = !!serverProc;
  const menu = Menu.buildFromTemplate([
    { label: 'OneSoft ERP', enabled: false },
    { type: 'separator' },
    {
      label:   running ? '🟢 الخادم يعمل' : '🔴 الخادم متوقف',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'فتح البرنامج في المتصفح',
      click: () => shell.openExternal(SERVER_URL),
      enabled: running,
    },
    {
      label: running ? 'إيقاف الخادم' : 'تشغيل الخادم',
      click: () => {
        if (running) { stopServer(); }
        else         { startServer(); waitForServer(20000).catch(() => {}); }
        setTimeout(updateTrayMenu, 1000);
      },
    },
    { type: 'separator' },
    {
      label: 'إعدادات البرنامج',
      click: () => shell.openPath(CONFIG_PATH),
    },
    {
      label: 'مجلد السجلات',
      click: () => shell.openPath(LOG_DIR),
    },
    { type: 'separator' },
    {
      label: 'إنهاء البرنامج',
      click: () => {
        stopServer();
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('get-config',       ()  => cfg);
ipcMain.handle('open-browser',     ()  => shell.openExternal(SERVER_URL));
ipcMain.handle('get-server-status',()  => ({ running: !!serverProc, ready: serverReady, url: SERVER_URL }));
ipcMain.handle('restart-server',   ()  => {
  stopServer();
  setTimeout(() => { startServer(); waitForServer(20000).catch(() => {}); }, 1000);
  return { ok: true };
});
ipcMain.handle('get-logs', (_e, n = 100) => {
  try {
    const today   = new Date().toISOString().slice(0, 10);
    const logFile = path.join(LOG_DIR, `electron-${today}.log`);
    if (!fs.existsSync(logFile)) return [];
    return fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean).slice(-n);
  } catch { return []; }
});

// ── دورة حياة التطبيق ─────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  writeLog('INFO', `OneSoft ERP v${app.getVersion()} starting`);
  writeLog('INFO', `config: ${CONFIG_PATH}`);
  writeLog('INFO', `server: ${SERVER_DIST}`);

  // 1. إنشاء Splash
  createSplash();

  // 2. تشغيل الخادم
  startServer();

  // 3. انتظار الجاهزية
  try {
    await waitForServer(45000);
    serverReady = true;
    writeLog('INFO', 'server is ready');

    // 4. إغلاق Splash وفتح المتصفح
    if (splashWin && !splashWin.isDestroyed()) {
      setTimeout(() => {
        try { splashWin.close(); } catch {}
        splashWin = null;
      }, 800);
    }

    if (cfg.openBrowserOnStart) {
      shell.openExternal(SERVER_URL).catch(e => writeLog('WARN', `open browser: ${e.message}`));
    }

  } catch (err) {
    writeLog('ERROR', `server failed to start: ${err.message}`);
    if (splashWin && !splashWin.isDestroyed()) {
      splashWin.webContents.send('splash:progress', { pct: 0, msg: '❌ فشل تشغيل الخادم. تحقق من السجلات.' });
    }
    dialog.showErrorBox(
      'فشل تشغيل OneSoft ERP',
      `لم يستطع الخادم البدء خلال المهلة المحددة.\n\nتحقق من:\n• قاعدة البيانات تعمل\n• المنفذ ${cfg.port} غير مستخدم\n\nالسجلات: ${LOG_DIR}`
    );
  }

  // 5. إنشاء Tray
  createTray();

  // 6. فحص التحديثات (مستقبلاً)
  // autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', () => {
  // نبقى في الـ Tray بعد إغلاق النوافذ
});

app.on('before-quit', () => {
  writeLog('INFO', 'app quitting');
  stopServer();
});

app.on('will-quit', () => {
  stopServer();
});
