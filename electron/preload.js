'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// ── Splash screen API ──────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('splashAPI', {
  onProgress: (cb) => ipcRenderer.on('splash:progress', (_e, data) => cb(data)),
  onVersion:  (cb) => ipcRenderer.on('splash:version',  (_e, v)    => cb(v)),
});

// ── App control API ────────────────────────────────────────────────────────────
// Launch ID: يُقرأ بشكل متزامن مرة واحدة عند تحميل preload
// ثم يُعاد كقيمة ثابتة — بدون round-trip لكل استدعاء.
const _LAUNCH_ID_CACHED = ipcRenderer.sendSync('get-launch-id-sync');

contextBridge.exposeInMainWorld('erpAPI', {
  // يُعيد Launch ID الحالي للتطبيق (ثابت لنفس الجلسة، يتغير مع كل تشغيل)
  getLaunchId:    ()    => _LAUNCH_ID_CACHED,

  getConfig:      ()    => ipcRenderer.invoke('get-config'),
  openBrowser:    ()    => ipcRenderer.invoke('open-browser'),
  restartServer:  ()    => ipcRenderer.invoke('restart-server'),
  getServerStatus:()    => ipcRenderer.invoke('get-server-status'),
  getLogs:        (n)   => ipcRenderer.invoke('get-logs', n),
  minimize:       ()    => ipcRenderer.invoke('window:minimize'),
  maximize:       ()    => ipcRenderer.invoke('window:maximize'),
  isMaximized:    ()    => ipcRenderer.invoke('window:is-maximized'),
  close:          ()    => ipcRenderer.invoke('window:close'),
  getVersion:     ()    => ipcRenderer.invoke('app:get-version'),
  onServerStatus: (cb)  => ipcRenderer.on('server-status', (_e, s) => cb(s)),
  setFullScreen:       (v)  => ipcRenderer.invoke('pos:setFullScreen', v),
  onExitRequest:       (cb) => {
    const listener = () => cb();
    ipcRenderer.on('app:exit-request', listener);
    return () => ipcRenderer.removeListener('app:exit-request', listener);
  },
  respondToExitRequest: (response) => ipcRenderer.send('app:exit-response', response),
  onFullScreenChange:  (cb) => {
    const listener = (_e, v) => cb(v);
    ipcRenderer.on('pos:fullscreenChanged', listener);
    return () => ipcRenderer.removeListener('pos:fullscreenChanged', listener);
  },
});
