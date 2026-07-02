import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
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

  if (process.env['NODE_ENV'] === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist-ui', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── تسجيل IPC Handlers ───────────────────────────────────────────────────────
app.whenReady().then(() => {
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
