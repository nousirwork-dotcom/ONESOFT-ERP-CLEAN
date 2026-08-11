import type { Configuration } from 'electron-builder';
import versionInfo from '../version.json';

const config: Configuration = {
  appId: 'com.onesoft.erp',
  productName: 'OneSoft ERP',
  artifactName: 'OneSoftSetup-${version}-${arch}.${ext}',
  copyright: 'Copyright © 2026 OneSoft',

  // ── Windows metadata (shows in Settings → Apps & Programs and Features) ──
  extraMetadata: {
    version: versionInfo.version,
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
      filter: [
        '**/*',
        '!**/node_modules/**',
        '!**/drizzle/**',
        '!**/server-app/src/foundation-data.json',
      ],
    },
    {
      from: '../server-app/drizzle',
      to: 'app/server-app/drizzle',
      filter: ['**/*'],
    },
    {
      from: '../server-app/src/foundation-data.json',
      to: 'app/server-app/src/foundation-data.json',
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
    target: [{ target: 'nsis', arch: ['x64', 'ia32'] }],
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
    include: 'resources/installer.nsh',
    oneClick: false,
    perMachine: true,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
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

  publish: {
    provider: 'github',
    owner: 'nousirwork-dotcom',
    repo: 'ONESOFT-ERP-CLEAN',
    releaseType: 'release',
  },
};

export default config;
