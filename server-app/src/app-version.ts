import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

function readPackageVersion(): string {
  try {
    const packagePath = path.join(here, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { version?: string };
    if (pkg.version) return pkg.version;
  } catch {
    // The build fallback is intentionally non-secret and only used when
    // package.json is unavailable in an isolated test bundle.
  }
  return 'unknown';
}

export const APP_VERSION = readPackageVersion();