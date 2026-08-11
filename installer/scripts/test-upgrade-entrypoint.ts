import * as fs from 'node:fs';
import * as path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const nsis = read('resources/installer.nsh');
const main = read('electron/main.ts');
const updater = read('electron/updater.ts');
const upgrade = read('core/upgrade/UpgradeManager.ts');
const headless = read('core/upgrade/HeadlessUpgrade.ts');
const server = read('../server-app/src/index.ts');
const env = read('../server-app/src/env.ts');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

const customInstallStart = nsis.indexOf('!macro customInstall');
const customInstallEnd = nsis.indexOf('!macroend', customInstallStart);
if (customInstallStart < 0 || customInstallEnd < 0) {
  throw new Error('FAIL: customInstall macro was not found');
}
const customInstall = nsis.slice(customInstallStart, customInstallEnd);

assert(
  customInstall.includes('--run-upgrade-core --silent'),
  'NSIS customInstall invokes the shared headless Upgrade Core',
);
assert(
  customInstall.includes('ExecWait ') &&
    customInstall.includes('$R0'),
  'NSIS gates continuation on the Upgrade Core exit code',
);
assert(
  customInstall.includes('IfSilent silent_upgrade manual_upgrade') &&
    customInstall.includes('--run-upgrade-wizard'),
  'manual NSIS installs open the interactive upgrade wizard while silent updates stay headless',
);
assert(
  !customInstall.includes('sc start OneSoft-Server'),
  'NSIS customInstall has no direct Backend start before the gate',
);
assert(
  customInstall.includes('FileExists') &&
    customInstall.includes('onesoft.config.json'),
  'NSIS runs Upgrade Core only for an existing installation',
);
assert(
  customInstall.includes('FileExists} "$R6\\OneSoft\\config\\onesoft.config.json"') &&
    !customInstall.includes('AndIf} ${FileExists} "$R6\\OneSoft\\version.json"'),
  'NSIS does not let a missing version marker bypass upgrades',
);

const readyStart = main.indexOf('app.whenReady()');
const headlessBranch = main.indexOf("process.argv.includes('--run-upgrade-core')");
const normalWindowStart = main.indexOf('    createWindow();', readyStart);
assert(
  readyStart >= 0 && headlessBranch > readyStart && headlessBranch < normalWindowStart,
  'Electron headless mode is selected before normal window startup',
);
assert(
  main.includes('runHeadlessUpgrade()') && main.includes('app.exit(exitCode)'),
  'Electron exits with the Upgrade Core result',
);
assert(
  main.includes('upgradeWizardExitCode') &&
    main.includes('app.exit(upgradeWizardExitCode)') &&
    main.includes('registerUpgradeIpc('),
  'interactive upgrade wizard cannot continue NSIS after cancel or failure',
);
assert(
  headless.includes('new UpgradeManager().upgrade') &&
    !headless.includes('new MigrationRunner'),
  'headless entrypoint delegates to UpgradeManager without a second migration implementation',
);
const wizard = read('ui/steps/UpgradeWizard.tsx');
const upgradeIpc = read('electron/ipc/upgrade.ipc.ts');
const updaterSource = read('electron/updater.ts');
const launchPolicy = read('core/upgrade/UpgradeLaunchPolicy.ts');
assert(
  wizard.includes('hasMigrationCredential') &&
    wizard.includes('adminUser') &&
    wizard.includes('adminPassword') &&
    wizard.includes('adminDbOpts') &&
    !wizard.includes('setAdminPassword(legacyPassword)'),
  'interactive upgrade wizard collects one-time administrative credentials',
);
assert(
  upgradeIpc.includes('MigrationCredentialStore.load() !== null'),
  'credential probe rejects missing or unreadable DPAPI credentials',
);
assert(
  launchPolicy.includes('migrationCredentialValid') &&
    launchPolicy.includes('legacyAdminCredentialValid') &&
    launchPolicy.includes("return preflight.migrationCredentialValid || preflight.legacyAdminCredentialValid"),
  'upgrade launch policy allows silent mode only with a bootstrap capability',
);
assert(
  updaterSource.includes('getUpgradeLaunchMode') &&
    updaterSource.includes('const installerArgs = launchMode === \'silent\' ? [\'/S\'] : []') &&
    updaterSource.includes("MigrationCredentialStore.load() !== null") &&
    updaterSource.includes('database.adminUser') &&
    updaterSource.includes('database.adminPassword'),
  'In-App updater preflights credentials before choosing silent or interactive NSIS',
);
assert(
  updaterSource.indexOf('getUpgradeLaunchMode()') <
    updaterSource.indexOf("spawn(downloadedFilePath, installerArgs") &&
    updaterSource.indexOf('getUpgradeLaunchMode()') <
      updaterSource.indexOf("spawnSync('sc.exe', ['stop'"),
  'In-App credential preflight runs before launching the downloaded installer',
);

assert(
  updaterSource.includes('spawn(downloadedFilePath, installerArgs') &&
    updaterSource.includes("const installerArgs = launchMode === 'silent' ? ['/S'] : []"),
  'updater launches the same NSIS installer path in the selected mode',
);
assert(
  !updaterSource.includes('taskkill.exe') &&
    !updaterSource.includes('OneSoft ERP.exe", {'),
  'In-App updater does not kill its own Electron process before launching NSIS',
);
assert(
  !updater.includes("sc.exe', ['start', 'OneSoft-Server']"),
  'updater does not start Backend directly',
);

const migrationsGate = upgrade.indexOf("onStatus?.('running-migrations')");
const foundationGate = upgrade.indexOf('runFoundationOnly(');
const foundationVerificationGate = upgrade.indexOf('verifyPostUpgradeDatabase(');
const servicesGate = upgrade.indexOf("onStatus?.('starting-services')");
const verificationGate = upgrade.indexOf('verifyPostUpgrade(');
assert(
  migrationsGate >= 0 &&
    foundationGate > migrationsGate &&
    foundationVerificationGate > foundationGate &&
    servicesGate > foundationVerificationGate &&
    verificationGate > servicesGate,
  'Upgrade Core orders migrations, Foundation, verification, then services',
);
assert(
  server.includes('ONESOFT_FOUNDATION_ONLY') &&
    server.includes('FOUNDATION_OK') &&
    server.indexOf('ONESOFT_FOUNDATION_ONLY') < server.indexOf('const server = app.listen'),
  'Foundation-only mode runs without opening the HTTP listener',
);
assert(
  env.includes('ONESOFT_UPGRADE_DATABASE_URL') &&
    env.includes("process.env['ONESOFT_FOUNDATION_ONLY'] === '1'"),
  'Foundation-only mode uses an explicit one-shot database URL override',
);

const backupGate = upgrade.indexOf('this.backupManager.backup(');
const credentialGate = upgrade.indexOf('MigrationCredentialStore.load()');
const noCredentialGuard = upgrade.indexOf('!storedMigrationCredential && !opts.adminDbOpts');
assert(
  credentialGate >= 0 &&
    noCredentialGuard > credentialGate &&
    backupGate > noCredentialGuard,
  'missing administrative capability fails before backup and service stop',
);
assert(
  upgrade.includes('forceRoleProvision') &&
    upgrade.includes('persistRuntimeConfig(dbOpts)') &&
    upgrade.includes('snapshotConfig()') &&
    upgrade.includes('restoreConfig(originalConfig)') &&
    headless.includes('forceRoleProvision: !isRuntimeRole'),
  'Legacy role bootstrap persists runtime credentials before service startup',
);
assert(
  upgrade.includes('ELECTRON_RUN_AS_NODE') &&
    !upgrade.includes("spawnSync('where', ['node']"),
  'Foundation-only uses the packaged Electron Node runtime, not PATH discovery',
);

console.log('ALL UPGRADE ENTRYPOINT TESTS: PASS');