import * as fs   from 'fs';
import * as path from 'path';
import * as os   from 'os';
import * as crypto from 'crypto';

/**
 * Returns the license directory path.
 * Priority: ONESOFT_LICENSE_DIR env var (set by Electron) → platform default.
 * The directory is created if it doesn't exist.
 */
export function getLicenseDir(): string {
  if (process.env.ONESOFT_LICENSE_DIR) {
    return process.env.ONESOFT_LICENSE_DIR;
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'OneSoftERP', 'license');
  }
  return path.join(os.homedir(), '.onesoft', 'license');
}

export function getLicenseDatPath(): string {
  return path.join(getLicenseDir(), 'license.dat');
}

export function getSessionFilePath(): string {
  return path.join(getLicenseDir(), '.session');
}

export function getDeviceIdPath(): string {
  return path.join(getLicenseDir(), 'device_id');
}

/**
 * Returns a stable device UUID.
 * Created once on first activation and stored in the license directory.
 * Persists across updates — never deleted by the installer.
 *
 * Hardware fingerprint is computed as supplementary info only;
 * the primary identifier is the stable device_id UUID.
 */
export function getOrCreateDeviceId(): string {
  try {
    const dir    = getLicenseDir();
    const idPath = getDeviceIdPath();

    fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(idPath)) {
      const id = fs.readFileSync(idPath, 'utf-8').trim();
      if (id && id.length >= 32) return id;
    }

    const id = crypto.randomUUID();
    fs.writeFileSync(idPath, id, { encoding: 'utf-8', mode: 0o600 });
    return id;
  } catch {
    // Fallback: deterministic but not stable — only used if filesystem is unavailable
    return crypto
      .createHash('sha256')
      .update(os.hostname() + process.platform + os.arch())
      .digest('hex')
      .slice(0, 36)
      .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  }
}

/**
 * Supplementary hardware fingerprint (informational, not used for binding in Phase 1).
 * Used in Request Code so the owner can see the hardware info.
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

/**
 * Updates last_seen_at in the session file (tamper-detection aid).
 * Called periodically while the server is running.
 */
export function updateLastSeen(): void {
  try {
    const dir     = getLicenseDir();
    const session = getSessionFilePath();
    fs.mkdirSync(dir, { recursive: true });
    const data = JSON.stringify({ last_seen_at: new Date().toISOString() });
    fs.writeFileSync(session, data, { encoding: 'utf-8', mode: 0o600 });
  } catch { /* silent — never crash the server */ }
}

/**
 * Reads last_seen_at from session file.
 * Returns null if not found.
 */
export function readLastSeen(): Date | null {
  try {
    const raw  = fs.readFileSync(getSessionFilePath(), 'utf-8');
    const data = JSON.parse(raw) as { last_seen_at: string };
    return new Date(data.last_seen_at);
  } catch {
    return null;
  }
}
