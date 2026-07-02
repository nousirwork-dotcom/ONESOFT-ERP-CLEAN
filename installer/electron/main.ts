import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Force esbuild to bundle these transitive deps that pg uses dynamically.
// postgres-bytea@3 (ESM, used by pg-protocol) imports obuf at runtime.
// Without this explicit require, esbuild misses obuf and the app crashes
// with "Cannot find module 'obuf'" when pg opens the first connection.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('obuf');

// ─── 1. تعطيل GPU Hardware Acceleration ────────────────────────────────────
// يجب استدعاؤها قبل أي استخدام لـ app.whenReady أو إنشاء BrowserWindow.
// بيئات Windows بدون GPU مناسب (أجهزة افتراضية أو بدون driver) تعطي:
//   GPU process launch failed: error_code=18
//   FATAL: GPU process isn't usable. Goodbye.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');

// ─── 2. مسار ملف الـ Log ────────────────────────────────────────────────────
const LOG_PATH = path.join(app.getPath('userData'), 'onesoft-installer.log');

function writeLog(level: string, message: string, detail?: unknown): void {
  const ts   = new Date().toISOString();
  const extra = detail
    ? '\n' + (detail instanceof Error
        ? detail.stack ?? String(detail)
        : JSON.stringify(detail, null, 2))
    : '';
  const line = `[${ts}] [${level}] ${message}${extra}\n`;
  console.log(line.trimEnd());
  try { fs.appendFileSync(LOG_PATH, line); } catch { /* ignore write errors */ }
}

writeLog('INFO', `OneSoft Installer starting — Electron ${process.versions.electron} / Node ${process.versions.node}`);
writeLog('INFO', `Log file: ${LOG_PATH}`);

// ─── 3. Error handlers مبكرة ────────────────────────────────────────────────
// تمسك أي خطأ غير متوقع وتسجله بدلاً من إغلاق التطبيق بصمت.

process.on('uncaughtException', (err) => {
  writeLog('FATAL', 'uncaughtException', err);
});

process.on('unhandledRejection', (reason) => {
  writeLog('ERROR', 'unhandledRejection', reason);
});

// ─── 4. IPC Imports ─────────────────────────────────────────────────────────
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 860,
    height: 640,
    minWidth: 760,
    minHeight: 560,
    resizable: true,
    center: true,
    frame: false,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '..', '..', 'resources', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // ─── Renderer / child-process error handlers ──────────────────────────────
  mainWindow.webContents.on('render-process-gone', (_, details) => {
    writeLog('ERROR', 'render-process-gone', details);
  });

  mainWindow.webContents.on('did-fail-load', (_, code, desc, url) => {
    writeLog('ERROR', `did-fail-load  code=${code}  desc=${desc}  url=${url}`);
  });

  mainWindow.webContents.on('console-message', (_, level, message, line, source) => {
    if (level >= 2) {
      writeLog('RENDERER', `[${source}:${line}] ${message}`);
    }
  });

  if (process.env['NODE_ENV'] === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist-ui', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── App lifecycle ───────────────────────────────────────────────────────────
app.on('child-process-gone', (_, details) => {
  writeLog('ERROR', 'child-process-gone', details);
});

app.whenReady().then(() => {
  writeLog('INFO', 'app ready — creating window');
  createWindow();
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

  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:close',    () => { app.quit(); });
  ipcMain.handle('window:openUrl',  (_, url: string) => shell.openExternal(url));

  writeLog('INFO', 'IPC handlers registered');
}).catch((err) => {
  writeLog('FATAL', 'app.whenReady() rejected', err);
});

app.on('window-all-closed', () => {
  writeLog('INFO', 'window-all-closed');
  if (process.platform !== 'darwin') app.quit();
});
