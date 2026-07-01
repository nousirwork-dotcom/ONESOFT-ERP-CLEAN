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
  // ✅ pgPassword مطلوب عند إصلاح postgresql تلقائياً
  fixRequirement: (id: string, pgPassword?: string) => ipcRenderer.invoke('requirements:fix', id, pgPassword),

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
  writeRegistry:     (opts: unknown)  => ipcRenderer.invoke('fs:write-registry', opts),

  // Health
  runHealthCheck: (opts: unknown) => ipcRenderer.invoke('health:run', opts),

  // Config
  getConfig:  () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg: unknown) => ipcRenderer.invoke('config:save', cfg),

  // Upgrade
  detectVersion: () => ipcRenderer.invoke('upgrade:detect'),
  runUpgrade:    (opts: unknown) => ipcRenderer.invoke('upgrade:run', opts),
  rollback:      (opts: unknown) => ipcRenderer.invoke('upgrade:rollback', opts),

  // Uninstall
  uninstall: (opts: unknown) => ipcRenderer.invoke('uninstall:run', opts),

  // Mark installed (writes version.json)
  markInstalled: (opts: unknown) => ipcRenderer.invoke('setup:mark-installed', opts),

  // Deployment — Change Mode / Repair / DB Migration
  getDeploymentPlan:  (mode: string) => ipcRenderer.invoke('deploy:get-plan', mode),
  listModes:          ()             => ipcRenderer.invoke('deploy:list-modes'),
  changeMode:         (req: unknown) => ipcRenderer.invoke('deploy:change-mode', req),
  changeEndpoint:     (cfg: unknown) => ipcRenderer.invoke('deploy:change-endpoint', cfg),
  repair:             (req: unknown) => ipcRenderer.invoke('deploy:repair', req),
  migrateDatabase:    (req: unknown) => ipcRenderer.invoke('database:migrate-to-host', req),

  // Progress stream listener
  onProgress: (cb: (e: unknown) => void) => {
    ipcRenderer.on('installer:progress', (_, event) => cb(event));
    return () => ipcRenderer.removeAllListeners('installer:progress');
  },
});
