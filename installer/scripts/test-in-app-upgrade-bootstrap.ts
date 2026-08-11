import * as fs from 'node:fs';
import * as path from 'node:path';
import { chooseUpgradeLaunchMode } from '../core/upgrade/UpgradeLaunchPolicy.js';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

const updater = read('electron/updater.ts');
const nsis = read('resources/installer.nsh');
const headless = read('core/upgrade/HeadlessUpgrade.ts');
const upgrade = read('core/upgrade/UpgradeManager.ts');
const wizard = read('ui/steps/UpgradeWizard.tsx');
const server = read('../server-app/src/index.ts');

// This is the exact customer state from the requested acceptance scenario:
// installed 1.0.26, no DPAPI file, no Legacy admin fields.
assert(
  chooseUpgradeLaunchMode({
    migrationCredentialValid: false,
    legacyAdminCredentialValid: false,
  }) === 'interactive',
  '1.0.26 without DPAPI or Legacy admin credentials selects interactive In-App upgrade',
);
assert(
  chooseUpgradeLaunchMode({
    migrationCredentialValid: true,
    legacyAdminCredentialValid: false,
  }) === 'silent' &&
    chooseUpgradeLaunchMode({
      migrationCredentialValid: false,
      legacyAdminCredentialValid: true,
    }) === 'silent',
  'valid DPAPI or Legacy admin capability selects silent In-App upgrade',
);

const preflight = updater.indexOf('const launchMode = getUpgradeLaunchMode()');
const stopServices = updater.indexOf("spawnSync('sc.exe', ['stop'");
const launchInstaller = updater.indexOf('spawn(downloadedFilePath, installerArgs');
assert(
  preflight >= 0 && stopServices > preflight && launchInstaller > stopServices,
  'In-App preflight runs before service stop and the same downloaded NSIS installer',
);
assert(
  updater.includes("launchMode === 'silent' ? ['/S'] : []") &&
    nsis.includes('IfSilent silent_upgrade manual_upgrade') &&
    nsis.includes('--run-upgrade-wizard'),
  'interactive In-App mode reaches the existing Upgrade Wizard instead of silent failure',
);
assert(
  wizard.includes('adminDbOpts') &&
    wizard.includes('forceRoleProvision: needsAdminCredential') &&
    !wizard.includes('setAdminPassword(legacyPassword)'),
  'Wizard collects the one-time admin credential without loading or persisting Legacy password',
);
assert(
  headless.includes('new UpgradeManager().upgrade') &&
    !headless.includes('new MigrationRunner'),
  'interactive In-App upgrade and manual upgrade share the same Upgrade Core',
);

const bootstrapGate = upgrade.indexOf('new DatabaseRoleManager()');
const migrationGate = upgrade.indexOf("onStatus?.('running-migrations')");
const foundationGate = upgrade.indexOf('runFoundationOnly(');
const verifyGate = upgrade.indexOf('verifyPostUpgradeDatabase(');
const serviceGate = upgrade.indexOf("onStatus?.('starting-services')");
assert(
  bootstrapGate >= 0 &&
    migrationGate > bootstrapGate &&
    foundationGate > migrationGate &&
    verifyGate > foundationGate &&
    serviceGate > verifyGate,
  'successful bootstrap orders roles/DPAPI, migrations to journal head, Foundation, verification, then service start',
);
assert(
  upgrade.includes('DatabaseRoleManager.saveCredential') &&
    upgrade.includes('persistRuntimeConfig(dbOpts)') &&
    upgrade.includes('RUNTIME_ROLE') &&
    server.includes('FOUNDATION_OK') &&
    server.indexOf('FOUNDATION_OK') < server.indexOf('const server = app.listen'),
  'successful bootstrap persists Runtime-only state and verifies ready Foundation before HTTP/service use',
);

console.log('IN-APP LEGACY BOOTSTRAP ACCEPTANCE: PASS');