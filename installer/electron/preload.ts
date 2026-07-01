import { contextBridge, ipcRenderer } from 'electron';
import type { IPC } from '../core/types.js';

// ─── API آمن معرّض للـ UI عبر window.installer ────────────────────────────────
contextBridge.exposeInMainWorld('installer', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close:    () => ipcRenderer.invoke('window:close'),
  openUrl:  (url: string) => ipcRenderer.invoke('window:openUrl', url),

  // Requirements
  checkRequirements: () => ipcRenderer.invoke('requirements:check'),
  fixRequirement:    (id: string) => ipcRenderer.invoke('requirements:fix', id),

  // Database
  testConnection:  (opts: unknown) => ipcRenderer.invoke('database:test-connection', opts),
  installPostgres: (password: string) => ipcRenderer.invoke('database:install-postgres', password),
  createDatabase:  (opts: unknown) => ipcRenderer.invoke('database:create', opts),
  runMigrations:   (url: string) => ipcRenderer.invoke('database:migrate', url),

  // Setup
  createOrganization: (opts: unknown) => ipcRenderer.invoke('setup:create-org', opts),
  createUser:         (opts: unknown) => ipcRenderer.invoke('setup:create-user', opts),
  seedAccounts:       (url: string)   => ipcRenderer.invoke('setup:seed-accounts', url),

  // Services
  installServices:  (opts: unknown) => ipcRenderer.invoke('services:install', opts),
  getServiceStatus: (name: string)  => ipcRenderer.invoke('services:status', name),
  startService:     (name: string)  => ipcRenderer.invoke('services:start', name),
  stopService:      (name: string)  => ipcRenderer.invoke('services:stop', name),
  restartService:   (name: string)  => ipcRenderer.invoke('services:restart', name),

  // Filesystem
  createDirectories: (paths: unknown) => ipcRenderer.invoke('fs:create-dirs', paths),
  createShortcuts:   (opts: unknown)  => ipcRenderer.invoke('fs:create-shortcuts', opts),

  // Health
  runHealthCheck: (opts: unknown) => ipcRenderer.invoke('health:run', opts),

  // Config
  getConfig:  () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg: unknown) => ipcRenderer.invoke('config:save', cfg),

  // Upgrade
  detectVersion: () => ipcRenderer.invoke('upgrade:detect'),
  runUpgrade:    (opts: unknown) => ipcRenderer.invoke('upgrade:run', opts),
  rollback:      (opts: unknown) => ipcRenderer.invoke('upgrade:rollback', opts),

  // Progress stream listener
  onProgress: (cb: (e: unknown) => void) => {
    ipcRenderer.on('installer:progress', (_, event) => cb(event));
    return () => ipcRenderer.removeAllListeners('installer:progress');
  },
});
