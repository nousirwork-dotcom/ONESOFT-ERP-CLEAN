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
    'resources/**/*',
    'package.json',
  ],

  extraResources: [
    {
      from: 'resources/bin',
      to: 'bin',
      filter: ['**/*'],
    },
  ],

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'resources/icons/onesoft.ico',
    requestedExecutionLevel: 'requireAdministrator',
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: false,
    createStartMenuShortcut: false,
    installerIcon: 'resources/icons/onesoft.ico',
    uninstallerIcon: 'resources/icons/onesoft.ico',
    installerHeaderIcon: 'resources/icons/onesoft.ico',
    shortcutName: 'OneSoft ERP Setup',
    license: 'resources/LICENSE.txt',
    language: '1025',
  },

  publish: null,
};

export default config;
