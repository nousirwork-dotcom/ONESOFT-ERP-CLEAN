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

// ── ProgramData — مستوى الجهاز (الترخيص + device_id) ─────────────────────────
// يُستخدم ProgramData لأن البرنامج يعمل كـ Background Service مشترك بين
// جميع مستخدمي Windows — ليس مرتبطاً بمستخدم واحد مثل AppData\Roaming.
//
//   C:\ProgramData\OneSoft\              ← ONESOFT_DATA_DIR
//   C:\ProgramData\OneSoft\device_id     ← machine-level UUID
//   C:\ProgramData\OneSoft\license\      ← license.dat + .session
const PROGRAMDATA_ROOT = process.env.PROGRAMDATA ||
  (process.platform === 'win32' ? path.join('C:', 'ProgramData') : null);
const ONESOFT_DATA_DIR = PROGRAMDATA_ROOT
  ? path.join(PROGRAMDATA_ROOT, 'OneSoft')
  : DATA_DIR;  // dev fallback (Linux/Mac)

// ── إعداد المجلدات ────────────────────────────────────────────────────────────
[
  DATA_DIR,
  LOG_DIR,
  ONESOFT_DATA_DIR,
  path.join(ONESOFT_DATA_DIR, 'license'),
].forEach(d => { try { fs.mkdirSync(d, { recursive: true }); } catch {} });

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
let splashWin        = null;
let mainWin          = null;
let tray             = null;
let serverProc       = null;
let serverReady      = false;
let isQuitting       = false;
let cfg              = loadConfig();
let brandingSettings = {};  // cached after fetchBrandingSettings() at startup
const SERVER_URL      = `http://localhost:${cfg.port}`;

const WINDOW_STATE_PATH = path.join(DATA_DIR, 'window-state.json');

// ── قفل النسخة الواحدة ────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // نسخة أخرى تعمل بالفعل — أظهر نافذتها بدل فتح متصفح جديد
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.show();
      mainWin.focus();
    } else if (splashWin) {
      splashWin.focus();
    }
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
    ELECTRON_MODE:    '1',
    ONESOFT_DATA_DIR: ONESOFT_DATA_DIR,
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

// ── Window State (remember_window_size) ───────────────────────────────────────
function loadWindowState() {
  try {
    if (fs.existsSync(WINDOW_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(WINDOW_STATE_PATH, 'utf-8'));
    }
  } catch (e) {
    writeLog('WARN', `loadWindowState: ${e.message}`);
  }
  return null;
}

function saveWindowState(win) {
  try {
    if (!win || win.isDestroyed()) return;
    if (win.isFullScreen()) return;         // تجنّب حفظ أبعاد وضع ملء الشاشة
    const bounds      = win.getBounds();
    const isMaximized = win.isMaximized();
    fs.writeFileSync(
      WINDOW_STATE_PATH,
      JSON.stringify({ ...bounds, isMaximized }, null, 2),
      'utf-8'
    );
  } catch (e) {
    writeLog('WARN', `saveWindowState: ${e.message}`);
  }
}

// ── Branding Settings Fetch (for Electron features) ───────────────────────────
function fetchBrandingSettings() {
  return new Promise(resolve => {
    const req = http.get(`${SERVER_URL}/api/public/branding`, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({}); }
      });
    });
    req.on('error', () => resolve({}));
    req.setTimeout(3000, () => { try { req.destroy(); } catch {} resolve({}); });
  });
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

// ── النافذة الرئيسية (React جوّه Electron — بدل المتصفح الخارجي) ──────────────
function createMainWindow() {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.show();
    mainWin.focus();
    return;
  }

  const bs           = brandingSettings || {};
  const rememberSize = bs.remember_window_size !== false;   // default true
  const fullscreen   = bs.fullscreen_on_start === true;
  const winState     = rememberSize ? loadWindowState() : null;

  writeLog('INFO', `createMainWindow: rememberSize=${rememberSize} fullscreen=${fullscreen} savedState=${JSON.stringify(winState)}`);

  // ── حساب أبعاد النافذة الأولية ──
  // الأولوية: fullscreen_on_start يتجاهل الحجم المحفوظ ويبدأ من الحجم الافتراضي ثم يكبّر
  // remember_window_size يُفعَّل فقط إذا كان fullscreen_on_start مُعطَّلاً
  const canRestoreSize = rememberSize && !fullscreen;

  const winOpts = {
    width:           (canRestoreSize && winState?.width)  ? winState.width  : 1400,
    height:          (canRestoreSize && winState?.height) ? winState.height : 900,
    minWidth:        1024,
    minHeight:       640,
    show:            false,   // يظهر فقط بعد ready-to-show
    backgroundColor: '#F7F5F0',
    autoHideMenuBar: true,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          true,
    },
  };

  // استعادة موضع النافذة فقط إذا لم يكن fullscreen مفعّلاً
  if (canRestoreSize && winState?.x !== undefined && winState?.y !== undefined) {
    winOpts.x = winState.x;
    winOpts.y = winState.y;
  }

  mainWin = new BrowserWindow(winOpts);

  mainWin.once('ready-to-show', () => {
    // fullscreen_on_start: تكبير النافذة لملء الشاشة
    if (fullscreen || (rememberSize && winState?.isMaximized)) {
      mainWin.maximize();
    }
    mainWin.show();
  });

  // حفظ حجم النافذة وموضعها عند تغييرها (remember_window_size)
  if (rememberSize) {
    const onBoundsChange = () => saveWindowState(mainWin);
    mainWin.on('resize',     onBoundsChange);
    mainWin.on('move',       onBoundsChange);
    mainWin.on('unmaximize', onBoundsChange);
    mainWin.on('maximize',   () => {
      // نحفظ isMaximized = true عند التكبير
      try {
        if (!mainWin || mainWin.isDestroyed()) return;
        const bounds = mainWin.getBounds();
        fs.writeFileSync(WINDOW_STATE_PATH,
          JSON.stringify({ ...bounds, isMaximized: true }, null, 2), 'utf-8');
      } catch {}
    });
  }

  mainWin.loadURL(SERVER_URL).catch(err => {
    writeLog('ERROR', `main window failed to load ${SERVER_URL}: ${err.message}`);
  });

  // علامة X الرئيسية: رسالة تأكيد قبل إغلاق البرنامج بالكامل
  // (مع خيار التصغير إلى شريط النظام للحفاظ على سلوك الـ Tray)
  mainWin.on('close', (e) => {
    if (isQuitting) return;
    e.preventDefault();
    const choice = dialog.showMessageBoxSync(mainWin, {
      type: 'question',
      title: 'إغلاق OneSoft ERP',
      message: 'هل تريد إغلاق برنامج OneSoft ERP؟',
      detail: 'يمكنك أيضاً تصغير البرنامج إلى شريط النظام ليبقى يعمل في الخلفية.',
      buttons: ['إغلاق البرنامج', 'تصغير إلى شريط النظام', 'إلغاء'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    if (choice === 0) {
      isQuitting = true;
      app.quit();
    } else if (choice === 1) {
      mainWin.hide();
    }
    // choice === 2 → إلغاء: لا شيء
  });

  mainWin.on('closed', () => { mainWin = null; });

  // أي رابط خارجي (target=_blank) يُفتح في متصفح النظام، لا نافذة Electron جديدة
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}


function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon-tray.png');
  const img = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(img);
  tray.setToolTip('OneSoft ERP');
  tray.on('double-click', () => createMainWindow());
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
      label: 'فتح البرنامج',
      click: () => createMainWindow(),
      enabled: running,
    },
    {
      label: 'فتح في المتصفح (بديل)',
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
ipcMain.handle('pos:setFullScreen', (_e, v) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.setFullScreen(Boolean(v));
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

// ── فحص هل الخادم يعمل بالفعل (مثلاً Windows Service) ────────────────────────
function checkServerRunning() {
  return new Promise(resolve => {
    http.get(`${SERVER_URL}/api/health`, res => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

// ── دورة حياة التطبيق ─────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  writeLog('INFO', `OneSoft ERP v${app.getVersion()} starting`);
  writeLog('INFO', `config: ${CONFIG_PATH}`);
  writeLog('INFO', `server: ${SERVER_DIST}`);

  // 1. إنشاء Splash
  createSplash();

  // 2. تشغيل الخادم — فقط إذا لم يكن يعمل بالفعل كـ Windows Service
  const alreadyRunning = await checkServerRunning();
  if (alreadyRunning) {
    writeLog('INFO', 'Windows Service is already running — skipping startServer()');
    serverReady = true;
  } else {
    startServer();
  }

  // 3. انتظار الجاهزية
  try {
    await waitForServer(45000);
    serverReady = true;
    writeLog('INFO', 'server is ready');

    // 4a. جلب إعدادات الهوية لتطبيق fullscreen_on_start و remember_window_size
    try {
      brandingSettings = await fetchBrandingSettings();
      writeLog('INFO', `branding: transition=${brandingSettings.opening_transition} fullscreen=${brandingSettings.fullscreen_on_start} rememberSize=${brandingSettings.remember_window_size}`);
    } catch (e) {
      writeLog('WARN', `fetchBrandingSettings failed: ${e.message}`);
      brandingSettings = {};
    }

    // 4b. إغلاق Splash وفتح نافذة Electron الرئيسية (بدل المتصفح الخارجي)
    if (splashWin && !splashWin.isDestroyed()) {
      setTimeout(() => {
        try { splashWin.close(); } catch {}
        splashWin = null;
      }, 800);
    }

    createMainWindow();

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
  isQuitting = true;
  writeLog('INFO', 'app quitting');
  // حفظ حجم النافذة قبل الإغلاق (remember_window_size)
  if (mainWin && !mainWin.isDestroyed() && brandingSettings?.remember_window_size !== false) {
    saveWindowState(mainWin);
  }
  stopServer();
});

app.on('will-quit', () => {
  stopServer();
});
