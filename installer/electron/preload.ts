import { contextBridge, ipcRenderer } from 'electron';
import type { IPC } from '../core/types.js';

contextBridge.exposeInMainWorld('installer', {
  // Window controls
  minimize:    () => ipcRenderer.invoke('window:minimize'),
  maximize:    () => ipcRenderer.invoke('window:maximize'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  close:       () => ipcRenderer.invoke('window:close'),
  openUrl:     (url: string) => ipcRenderer.invoke('window:openUrl', url),
  getVersion:  () => ipcRenderer.invoke('app:get-version'),

  // Requirements
  checkRequirements: () => ipcRenderer.invoke('requirements:check'),
  fixRequirement: (id: string, pgPassword?: string) => ipcRenderer.invoke('requirements:fix', id, pgPassword),

  // Database
  testConnection:  (opts: unknown) => ipcRenderer.invoke('database:test-connection', opts),
  detectExistingDb:(opts: unknown) => ipcRenderer.invoke('database:detect-existing', opts),
  installPostgres: (password: string) => ipcRenderer.invoke('database:install-postgres', password),
  createDatabase:  (opts: unknown) => ipcRenderer.invoke('database:create', opts),
  runMigrations:   (url: string)   => ipcRenderer.invoke('database:migrate', url),

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
  diagnoseServices: ()              => ipcRenderer.invoke('services:diagnose'),

  // Filesystem
  createDirectories: (paths: unknown) => ipcRenderer.invoke('fs:create-dirs', paths),
  createShortcuts:   (opts: unknown)  => ipcRenderer.invoke('fs:create-shortcuts', opts),
  writeRegistry:     (opts: unknown)  => ipcRenderer.invoke('fs:write-registry', opts),

  // Health
  runHealthCheck: (opts: unknown) => ipcRenderer.invoke('health:run', opts),

  // Config
  getConfig:     ()            => ipcRenderer.invoke('config:get'),
  saveConfig:    (cfg: unknown) => ipcRenderer.invoke('config:save', cfg),
  verifyConfig:  ()            => ipcRenderer.invoke('backend:verify-config'),
  clearConfig:   ()            => ipcRenderer.invoke('backend:clear-config'),

  // Upgrade
  detectVersion: () => ipcRenderer.invoke('upgrade:detect'),
  runUpgrade:    (opts: unknown) => ipcRenderer.invoke('upgrade:run', opts),
  rollback:      (opts: unknown) => ipcRenderer.invoke('upgrade:rollback', opts),

  // Uninstall
  uninstall: (opts: unknown) => ipcRenderer.invoke('uninstall:run', opts),

  // Mark installed
  markInstalled: (opts: unknown) => ipcRenderer.invoke('setup:mark-installed', opts),

  // Deployment
  getDeploymentPlan:   (opts: unknown) => ipcRenderer.invoke('deploy:get-plan', opts),
  listDeploymentTypes: ()              => ipcRenderer.invoke('deploy:list-types'),
  changeDeployment:    (req: unknown)  => ipcRenderer.invoke('deploy:change', req),
  changeAccessModes:   (opts: unknown) => ipcRenderer.invoke('deploy:change-access', opts),
  changeEndpoint:      (cfg: unknown)  => ipcRenderer.invoke('deploy:change-endpoint', cfg),
  repair:              (req: unknown)  => ipcRenderer.invoke('deploy:repair', req),
  migrateDatabase:     (req: unknown)  => ipcRenderer.invoke('database:migrate-to-host', req),

  // Backward compat
  changeMode: (req: unknown) => ipcRenderer.invoke('deploy:change', req),
  listModes:  ()             => ipcRenderer.invoke('deploy:list-types'),

  // Progress stream
  onProgress: (cb: (e: unknown) => void) => {
    ipcRenderer.on('installer:progress', (_, event) => cb(event));
    return () => ipcRenderer.removeAllListeners('installer:progress');
  },

  // ─── Auto-Update API ───────────────────────────────────────────────────────
  updater: {
    // Main → Renderer events
    onUpdateStatus: (cb: (e: unknown, data: unknown) => void) => {
      ipcRenderer.on('update:status', cb);
      return () => ipcRenderer.removeListener('update:status', cb);
    },
    onUpdateProgress: (cb: (e: unknown, data: unknown) => void) => {
      ipcRenderer.on('update:progress', cb);
      return () => ipcRenderer.removeListener('update:progress', cb);
    },
    onUpdateDownloaded: (cb: (e: unknown, data: unknown) => void) => {
      ipcRenderer.on('update:downloaded', cb);
      return () => ipcRenderer.removeListener('update:downloaded', cb);
    },
    onUpdateError: (cb: (e: unknown, data: unknown) => void) => {
      ipcRenderer.on('update:error', cb);
      return () => ipcRenderer.removeListener('update:error', cb);
    },
    onUpdateLog: (cb: (e: unknown, data: unknown) => void) => {
      ipcRenderer.on('update:log', cb);
      return () => ipcRenderer.removeListener('update:log', cb);
    },
    // Renderer → Main commands
    startDownload: () => ipcRenderer.invoke('update:start-download'),
    installNow:    () => ipcRenderer.invoke('update:install-now'),
    /** "لاحقاً" — يغلق النافذة فقط، تظهر مجدداً عند التشغيل القادم */
    skipUpdate:    () => ipcRenderer.invoke('update:skip'),
    /** "لا تذكرني بهذا الإصدار مرة أخرى" — تخطي دائم لهذا الإصدار */
    skipVersion:   () => ipcRenderer.invoke('update:skip-version'),
    /** فحص يدوي من داخل شاشة الإعدادات — يعمل حتى لو كان التحقق التلقائي متوقفاً */
    checkNow:      () => ipcRenderer.invoke('update:check-now'),
    /** قراءة تفضيلات التحديث المحلية (autoUpdateEnabled, skippedVersion, lastCheckAt) */
    getPrefs:      () => ipcRenderer.invoke('update:get-prefs'),
    /** تشغيل/إيقاف التحقق التلقائي — إعداد خاص بالجهاز */
    setAutoUpdate: (enabled: boolean) => ipcRenderer.invoke('update:set-auto-update', enabled),
    /** تغيير قناة التحديث (stable / staging) — إعداد خاص بالجهاز */
    setChannel:    (channel: 'stable' | 'staging') => ipcRenderer.invoke('update:set-channel', channel),
    /** إلغاء التحميل الجاري وحذف الملف الجزئي */
    cancelDownload: () => ipcRenderer.invoke('update:cancel-download'),
    /** الاستماع لحدث اكتمال الإلغاء */
    onUpdateCancelled: (cb: (e: unknown) => void) => {
      ipcRenderer.on('update:cancelled', cb);
      return () => ipcRenderer.removeListener('update:cancelled', cb);
    },
  },
});
