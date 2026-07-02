import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

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
    writeLog('INFO', 'window: ready-to-show — calling show()');
    mainWindow?.show();
    writeLog('INFO', 'window: show() called');
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
  } else {
    writeLog('INFO', `loadFile ${indexPath} — start`);
    mainWindow.loadFile(indexPath)
      .then(() => writeLog('INFO', 'loadFile — resolved'))
      .catch((e: unknown) => writeLog('ERROR', 'loadFile — rejected', e));
  }

  writeLog('INFO', 'createWindow() — end (all listeners attached, load initiated)');
}

// ─── app.whenReady ────────────────────────────────────────────────────────────
app.whenReady()
  .then(() => {
    writeLog('INFO', 'app.whenReady() — resolved');
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

    writeLog('INFO', 'startup complete — waiting for window events');
  })
  .catch((err) => {
    writeLog('FATAL', 'app.whenReady() rejected', err);
  });
