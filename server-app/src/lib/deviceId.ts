import * as fs     from 'fs';
import * as path   from 'path';
import * as os     from 'os';
import * as crypto from 'crypto';

// ─── Directory Structure (نهائي — Production) ────────────────────────────────
//
//  Windows:
//    C:\ProgramData\OneSoft\                   ← getOnesoftDataDir()
//    C:\ProgramData\OneSoft\device_id          ← getDeviceIdPath()     (machine-level)
//    C:\ProgramData\OneSoft\license\           ← getLicenseDir()
//    C:\ProgramData\OneSoft\license\license.dat ← getLicenseDatPath()
//    C:\ProgramData\OneSoft\license\.session   ← getSessionFilePath()
//
//  Linux / macOS (dev):
//    ~/.onesoft/                               ← getOnesoftDataDir()
//    ~/.onesoft/device_id
//    ~/.onesoft/license/
//    ~/.onesoft/license/license.dat
//    ~/.onesoft/license/.session
//
//  IMPORTANT:
//    - device_id is at base level (machine-level, survives license reset)
//    - ProgramData is machine-wide (all Windows users) — correct for a background service
//    - Electron passes ONESOFT_DATA_DIR env var; server-app uses it as-is
//    - Never use %APPDATA% / Roaming in production (user-scoped, wrong for a service)

/**
 * Returns the OneSoft base data directory.
 * Priority: ONESOFT_DATA_DIR env var (set by Electron) → platform default.
 */
export function getOnesoftDataDir(): string {
  if (process.env.ONESOFT_DATA_DIR) {
    return process.env.ONESOFT_DATA_DIR;
  }
  if (process.platform === 'win32') {
    const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
    return path.join(programData, 'OneSoft');
  }
  // Linux / macOS (dev environment)
  return path.join(os.homedir(), '.onesoft');
}

/** C:\ProgramData\OneSoft\license\ */
export function getLicenseDir(): string {
  return path.join(getOnesoftDataDir(), 'license');
}

/** C:\ProgramData\OneSoft\license\license.dat */
export function getLicenseDatPath(): string {
  return path.join(getLicenseDir(), 'license.dat');
}

/** C:\ProgramData\OneSoft\license\.session */
export function getSessionFilePath(): string {
  return path.join(getLicenseDir(), '.session');
}

/**
 * C:\ProgramData\OneSoft\device_id
 * Machine-level — NOT inside license\ so it survives license reset/replacement.
 */
export function getDeviceIdPath(): string {
  return path.join(getOnesoftDataDir(), 'device_id');
}

// ─── AppData Migration (one-time, optional) ───────────────────────────────────
// Runs silently if a dev left files in the old %APPDATA% path.
let _migrationDone = false;

function migrateFromAppDataIfNeeded(): void {
  if (_migrationDone) return;
  _migrationDone = true;
  if (process.platform !== 'win32') return;
  try {
    const appData = process.env.APPDATA || '';
    if (!appData) return;

    const oldLicDir  = path.join(appData, 'OneSoftERP', 'license');
    const oldDatPath = path.join(oldLicDir, 'license.dat');
    const oldDevPath = path.join(oldLicDir, 'device_id');
    const newDatPath = getLicenseDatPath();
    const newDevPath = getDeviceIdPath();

    // Migrate license.dat (only if new location is empty)
    if (fs.existsSync(oldDatPath) && !fs.existsSync(newDatPath)) {
      fs.mkdirSync(getLicenseDir(), { recursive: true });
      fs.copyFileSync(oldDatPath, newDatPath);
      // Mark old file so we know it was migrated (don't delete — manual cleanup)
      fs.writeFileSync(oldDatPath + '.migrated-to-programdata', '', 'utf-8');
    }

    // Migrate device_id (only if new location is empty)
    if (fs.existsSync(oldDevPath) && !fs.existsSync(newDevPath)) {
      fs.mkdirSync(getOnesoftDataDir(), { recursive: true });
      fs.copyFileSync(oldDevPath, newDevPath);
    }
  } catch { /* silent — never crash the server */ }
}

// ─── Device ID ────────────────────────────────────────────────────────────────
/**
 * Returns a stable machine UUID.
 * Created once, stored at C:\ProgramData\OneSoft\device_id.
 * Persists across:
 *   - Program restarts
 *   - Software updates (installer must NOT delete ProgramData\OneSoft)
 *   - Windows reboots
 *   - Different Windows user sessions (machine-wide)
 */
export function getOrCreateDeviceId(): string {
  migrateFromAppDataIfNeeded();
  try {
    const baseDir = getOnesoftDataDir();
    const idPath  = getDeviceIdPath();
    fs.mkdirSync(baseDir, { recursive: true });

    if (fs.existsSync(idPath)) {
      const id = fs.readFileSync(idPath, 'utf-8').trim();
      if (id && id.length >= 32) return id;
    }

    const id = crypto.randomUUID();
    fs.writeFileSync(idPath, id, { encoding: 'utf-8', mode: 0o600 });
    return id;
  } catch {
    // Fallback: deterministic from hostname (not stable but never throws)
    return crypto
      .createHash('sha256')
      .update(os.hostname() + process.platform + os.arch())
      .digest('hex')
      .slice(0, 36)
      .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  }
}

// ─── Hardware Fingerprint ─────────────────────────────────────────────────────
/**
 * Supplementary hardware fingerprint (informational only — not used for binding in Phase 1).
 * Included in Request Code so the license issuer can see the hardware.
 */
export function getHardwareFingerprint(): string {
  try {
    const interfaces = os.networkInterfaces();
    const macs = Object.values(interfaces)
      .flat()
      .filter(i => i && !i.internal && i.mac !== '00:00:00:00:00:00')
      .map(i => i!.mac)
      .slice(0, 3);
    const data = [os.hostname(), os.platform(), os.arch(), ...macs].join('|');
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
  } catch {
    return 'unknown';
  }
}

// ─── Session Tracking ─────────────────────────────────────────────────────────
/**
 * Updates last_seen_at in the session file.
 * Used as a tamper-detection aid (detect system clock rollback > 7 days).
 * Called periodically while the server is running.
 */
export function updateLastSeen(): void {
  try {
    fs.mkdirSync(getLicenseDir(), { recursive: true });
    const data = JSON.stringify({ last_seen_at: new Date().toISOString() });
    fs.writeFileSync(getSessionFilePath(), data, { encoding: 'utf-8', mode: 0o600 });
  } catch { /* silent — never crash the server */ }
}

/** Reads last_seen_at from session file. Returns null if not found. */
export function readLastSeen(): Date | null {
  try {
    const raw  = fs.readFileSync(getSessionFilePath(), 'utf-8');
    const data = JSON.parse(raw) as { last_seen_at: string };
    return new Date(data.last_seen_at);
  } catch {
    return null;
  }
}
