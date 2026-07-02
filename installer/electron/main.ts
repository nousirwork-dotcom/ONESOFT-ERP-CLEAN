import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Force esbuild to bundle obuf (used by postgres-bytea@3 via pg-protocol)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('obuf');

// ─── Disable GPU (must be before app.whenReady / BrowserWindow) ─────────────
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');

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

writeLog('INFO', `=== OneSoft Installer starting ===`);
writeLog('INFO', `Electron ${process.versions.electron}  Node ${process.versions.node}  platform=${process.platform}`);
writeLog('INFO', `Log file: ${LOG_PATH}`);
writeLog('INFO', `__dirname: ${__dirname}`);
writeLog('INFO', `process.resourcesPath: ${(process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ?? 'N/A'}`);

// ─── Early process-level error handlers ──────────────────────────────────────
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

// ─── App-level lifecycle events ───────────────────────────────────────────────
app.on('child-process-gone', (_, details) => {
  writeLog('ERROR', 'child-process-gone', details);
});

app.on('window-all-closed', () => {
  writeLog('INFO', `window-all-closed  platform=${process.platform}\n${stackTrace()}`);
  if (process.platform !== 'darwin') {
    writeLog('INFO', 'calling app.quit() from window-all-closed');
    app.quit();
  }
});

app.on('quit', (_, exitCode) => {
  writeLog('INFO', `app.quit event  exitCode=${exitCode}\n${stackTrace()}`);
});

// ─── createWindow ─────────────────────────────────────────────────────────────
function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  const indexPath   = path.join(__dirname, '..', '..', 'dist-ui', 'index.html');
  const isDev       = process.env['NODE_ENV'] === 'development';
  const isDebug     = process.env['ONESOFT_DEBUG'] === '1';

  // ── verify paths before using them ──────────────────────────────────────
  writeLog('INFO', `--- createWindow ---`);
  writeLog('INFO', `preload path : ${preloadPath}  exists=${fs.existsSync(preloadPath)}`);
  writeLog('INFO', `index.html   : ${indexPath}  exists=${fs.existsSync(indexPath)}`);
  writeLog('INFO', `isDev=${isDev}  isDebug=${isDebug}`);

  writeLog('INFO', 'new BrowserWindow() — start');

  mainWindow = new BrowserWindow({
    width: 860,
    height: 640,
    minWidth: 760,
    minHeight: 560,
    resizable: true,
    center: true,
    frame: false,
    titleBarStyle: 'hidden',
    show: false,   // wait for ready-to-show to avoid white flash / premature close
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

  // ── WebContents loading events ──────────────────────────────────────────
  wc.on('did-start-loading', () => {
    writeLog('INFO', 'webContents: did-start-loading');
  });

  wc.on('did-finish-load', () => {
    writeLog('INFO', 'webContents: did-finish-load');
  });

  wc.on('did-fail-load', (_, errorCode, errorDesc, validatedUrl, isMainFrame) => {
    writeLog('ERROR', `webContents: did-fail-load  code=${errorCode}  desc=${errorDesc}  url=${validatedUrl}  mainFrame=${isMainFrame}`);
  });

  wc.on('did-fail-provisional-load', (_, errorCode, errorDesc, validatedUrl) => {
    writeLog('ERROR', `webContents: did-fail-provisional-load  code=${errorCode}  desc=${errorDesc}  url=${validatedUrl}`);
  });

  wc.on('render-process-gone', (_, details) => {
    writeLog('ERROR', 'webContents: render-process-gone', details);
  });

  wc.on('unresponsive', () => {
    writeLog('WARN', 'webContents: unresponsive');
  });

  wc.on('console-message', (_, level, message, line, source) => {
    // 0=verbose 1=info 2=warning 3=error
    if (level >= 2) {
      writeLog('RENDERER', `[L${level}] [${source}:${line}] ${message}`);
    }
  });

  // ── Window events ────────────────────────────────────────────────────────
  mainWindow.once('ready-to-show', () => {
    writeLog('INFO', 'window: ready-to-show — calling show()');
    mainWindow?.show();
    writeLog('INFO', 'window: show() called');

    // Open DevTools when running in dev mode or when ONESOFT_DEBUG=1
    if (isDev || isDebug) {
      writeLog('INFO', 'opening DevTools (detach mode)');
      wc.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('show', () => {
    writeLog('INFO', 'window: show event fired');
  });

  mainWindow.on('close', () => {
    writeLog('INFO', `window: close event\n${stackTrace()}`);
  });

  mainWindow.on('closed', () => {
    writeLog('INFO', 'window: closed event — mainWindow set to null');
    mainWindow = null;
  });

  // ── Load the UI ──────────────────────────────────────────────────────────
  if (isDev) {
    const devUrl = 'http://localhost:5173';
    writeLog('INFO', `loadURL ${devUrl} — start`);
    mainWindow.loadURL(devUrl)
      .then(() => writeLog('INFO', `loadURL ${devUrl} — resolved`))
      .catch((e: unknown) => writeLog('ERROR', `loadURL rejected`, e));
  } else {
    writeLog('INFO', `loadFile ${indexPath} — start`);
    mainWindow.loadFile(indexPath)
      .then(() => writeLog('INFO', `loadFile — resolved`))
      .catch((e: unknown) => writeLog('ERROR', `loadFile rejected`, e));
  }
}

// ─── app.whenReady ────────────────────────────────────────────────────────────
app.whenReady()
  .then(() => {
    writeLog('INFO', 'app.whenReady() resolved — creating window');
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

    // Window controls — log when called
    ipcMain.handle('window:minimize', () => {
      writeLog('INFO', 'IPC window:minimize');
      mainWindow?.minimize();
    });
    ipcMain.handle('window:close', () => {
      writeLog('INFO', `IPC window:close — calling app.quit()\n${stackTrace()}`);
      app.quit();
    });
    ipcMain.handle('window:openUrl', (_, url: string) => {
      writeLog('INFO', `IPC window:openUrl  url=${url}`);
      return shell.openExternal(url);
    });

    writeLog('INFO', 'IPC handlers registered — startup complete');
  })
  .catch((err) => {
    writeLog('FATAL', 'app.whenReady() rejected', err);
  });
