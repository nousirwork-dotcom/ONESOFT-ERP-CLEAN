import type { Configuration } from 'electron-builder';

const config: Configuration = {
  appId: 'app.onesoft.erp.installer',
  productName: 'OneSoft ERP Setup',
  copyright: 'Copyright © 2026 OneSoft',

  directories: {
    output: 'release',
    buildResources: 'resources',
  },

  files: [
    'dist-electron/**/*',
    'dist-ui/**/*',
    'package.json',
  ],

  // نسخ NSSM وملفات التطبيق كـ extra resources داخل الحزمة
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
    // ملفات التطبيق المبنية (server-app, client-app)
    // يُنسخها BUILD-ON-WINDOWS.ps1 إلى resources/app
    {
      from: 'resources/app',
      to: 'app',
      filter: ['**/*'],
    },
  ],

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'resources/icons/onesoft.ico',
    requestedExecutionLevel: 'requireAdministrator',
    // Authenticode signing — فعّل عند امتلاك شهادة
    // certificateFile: 'cert.pfx',
    // certificatePassword: process.env.CERT_PASSWORD,
  },

  nsis: {
    oneClick: false,                          // معالج تثبيت مرحلي
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: false,             // يتولّاه Installer UI
    createStartMenuShortcut: false,           // يتولّاه Installer UI
    installerIcon: 'resources/icons/onesoft.ico',
    uninstallerIcon: 'resources/icons/onesoft.ico',
    installerHeaderIcon: 'resources/icons/onesoft.ico',
    shortcutName: 'OneSoft ERP',
    license: 'resources/LICENSE.txt',
    language: '1025',                         // Arabic
    // إضافة مدخل "إلغاء التثبيت" في قائمة Start
    menuCategory: 'OneSoft ERP',
    // تمرير --uninstall عند تشغيل الإزالة من Windows
    uninstallDisplayName: 'OneSoft ERP — إلغاء التثبيت',
    deleteAppDataOnUninstall: false,           // المستخدم يختار
  },

  publish: null,
};

export default config;
