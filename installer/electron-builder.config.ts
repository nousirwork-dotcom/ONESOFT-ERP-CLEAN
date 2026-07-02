import type { Configuration } from 'electron-builder';

const config: Configuration = {
  appId: 'com.onesoft.erp',
  productName: 'OneSoft ERP',
  artifactName: 'OneSoftSetup-${version}.${ext}',
  copyright: 'Copyright © 2026 OneSoft',

  // ── Windows metadata (shows in Settings → Apps & Programs and Features) ──
  extraMetadata: {
    version: '1.0.0',
  },

  directories: {
    output: 'release',
    buildResources: 'resources',
  },

  files: [
    'dist-electron/**/*',
    'dist-ui/**/*',
    'package.json',
  ],

  extraResources: [
    {
      from: 'resources/bin',
      to: 'bin',
      filter: ['**/*'],
    },
    {
      from: 'resources/serve-client.js',
      to: 'serve-client.js',
    },
    {
      from: 'resources/app',
      to: 'app',
      filter: ['**/*'],
    },
    // Make icon available at runtime for shortcuts and notifications
    {
      from: 'resources/icon.ico',
      to: 'icon.ico',
    },
    {
      from: 'resources/icon.png',
      to: 'icon.png',
    },
  ],

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    // ── Single canonical icon path ──
    icon: 'resources/icon.ico',
    requestedExecutionLevel: 'requireAdministrator',
    // Windows version-info strings (visible in EXE properties)
    verifyUpdateCodeSignature: false,
    // Authenticode signing — enable when you have a certificate
    // certificateFile: 'cert.pfx',
    // certificatePassword: process.env.CERT_PASSWORD,
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: false,   // handled by Installer UI
    createStartMenuShortcut: false, // handled by Installer UI
    shortcutName: 'OneSoft ERP',
    menuCategory: 'OneSoft',
    language: '1025',               // Arabic

    // ── Branding icons (all point to the same canonical ICO) ──
    installerIcon:       'resources/icon.ico',
    uninstallerIcon:     'resources/icon.ico',
    installerHeaderIcon: 'resources/icon.ico',

    // ── NSIS wizard images (replace these BMPs with your final artwork) ──
    // installerHeader:  'resources/installer-header.bmp',  // 150×57 px
    // installerSidebar: 'resources/installer-sidebar.bmp', // 164×314 px

    license: 'resources/LICENSE.txt',
    uninstallDisplayName: 'OneSoft ERP',
    deleteAppDataOnUninstall: false,
  },

  // ── Add/Remove Programs metadata ──
  // These values appear in Settings → Installed Apps and Programs & Features
  publish: null,
};

export default config;
