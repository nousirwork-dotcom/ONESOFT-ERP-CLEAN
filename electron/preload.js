'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// ── Splash screen API ──────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('splashAPI', {
  onProgress: (cb) => ipcRenderer.on('splash:progress', (_e, data) => cb(data)),
  onVersion:  (cb) => ipcRenderer.on('splash:version',  (_e, v)    => cb(v)),
});

// ── App control API ────────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('erpAPI', {
  getConfig:      ()    => ipcRenderer.invoke('get-config'),
  openBrowser:    ()    => ipcRenderer.invoke('open-browser'),
  restartServer:  ()    => ipcRenderer.invoke('restart-server'),
  getServerStatus:()    => ipcRenderer.invoke('get-server-status'),
  getLogs:        (n)   => ipcRenderer.invoke('get-logs', n),
  onServerStatus: (cb)  => ipcRenderer.on('server-status', (_e, s) => cb(s)),
  setFullScreen:       (v)  => ipcRenderer.invoke('pos:setFullScreen', v),
  onFullScreenChange:  (cb) => {
    const listener = (_e, v) => cb(v);
    ipcRenderer.on('pos:fullscreenChanged', listener);
    return () => ipcRenderer.removeListener('pos:fullscreenChanged', listener);
  },
});
