import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'server-app');
const CLIENT = path.join(ROOT, 'client-app');
const INSTALLER = path.join(ROOT, 'installer');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

function hashDirectory(dir) {
  const files = [];
  function visit(current, relative = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      const rel = path.join(relative, entry.name).replaceAll(path.sep, '/');
      if (entry.isDirectory()) visit(full, rel);
      else if (rel !== 'build-manifest.json') files.push([rel, fs.readFileSync(full)]);
    }
  }
  visit(dir);
  const hash = crypto.createHash('sha256');
  for (const [name, contents] of files) {
    hash.update(name);
    hash.update('\0');
    hash.update(contents);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

const installerPackage = readJson(path.join(INSTALLER, 'package.json'));
const serverPackage = readJson(path.join(SERVER, 'package.json'));
const clientPackage = readJson(path.join(CLIENT, 'package.json'));
const rootVersion = readJson(path.join(ROOT, 'version.json'));
const builderText = fs.readFileSync(path.join(INSTALLER, 'electron-builder.yml'), 'utf8');
const builderVersion = builderText.match(/^\s*version:\s*"([^"]+)"/m)?.[1];
const releaseVersion = rootVersion.version;
const versions = {
  installer: installerPackage.version,
  server: serverPackage.version,
  client: clientPackage.version,
  root: rootVersion.version,
  builder: builderVersion,
};
const inconsistent = Object.entries(versions).filter(([, version]) => version !== rootVersion.version);
if (inconsistent.length) {
  throw new Error(`release version sources disagree: ${JSON.stringify(versions)}`);
}

const schemaText = fs.readFileSync(path.join(SERVER, 'src', 'schema-version.ts'), 'utf8');
const schemaVersion = schemaText.match(/REQUIRED_SCHEMA_VERSION\s*=\s*'([^']+)'/)?.[1];
if (!schemaVersion) throw new Error('REQUIRED_SCHEMA_VERSION is missing');

const foundationPath = path.join(SERVER, 'src', 'foundation-data.json');
const backendPath = path.join(SERVER, 'dist', 'index.mjs');
const clientDist = path.join(CLIENT, 'dist');
if (!fs.existsSync(backendPath)) throw new Error(`backend bundle missing: ${backendPath}`);
if (!fs.existsSync(clientDist)) throw new Error(`frontend output missing: ${clientDist}`);

const manifest = {
  releaseVersion,
  gitCommit: gitCommit(),
  buildTimestamp: new Date().toISOString(),
  frontendHash: hashDirectory(clientDist),
  backendHash: sha256File(backendPath),
  schemaVersion,
  foundationSnapshotHash: sha256File(foundationPath),
};

const outputs = [
  path.join(SERVER, 'dist', 'build-manifest.json'),
  path.join(CLIENT, 'dist', 'build-manifest.json'),
  path.join(INSTALLER, 'resources', 'app', 'server-app', 'dist', 'build-manifest.json'),
  path.join(INSTALLER, 'dist-ui', 'build-manifest.json'),
];
for (const output of outputs) atomicWriteJson(output, manifest);

console.log(`[manifest] ${manifest.releaseVersion} ${manifest.schemaVersion}`);
console.log(`[manifest] backend=${manifest.backendHash.slice(0, 16)} frontend=${manifest.frontendHash.slice(0, 16)}`);
console.log(`[manifest] foundation=${manifest.foundationSnapshotHash.slice(0, 16)}`);
console.log(`[manifest] copied=${outputs.length}`);