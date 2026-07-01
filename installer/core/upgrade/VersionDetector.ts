import * as fs from 'fs';
import * as path from 'path';
import type { VersionInfo } from '../types.js';

const VERSION_FILE_CANDIDATES = [
  path.join(process.env['ProgramData'] || 'C:\\ProgramData', 'OneSoft', 'version.json'),
  path.join(process.env['HOME'] || '/tmp', '.onesoft', 'version.json'),
];

export class VersionDetector {
  detect(): VersionInfo | null {
    for (const filePath of VERSION_FILE_CANDIDATES) {
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          return JSON.parse(raw) as VersionInfo;
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  write(info: VersionInfo, dataDir: string): void {
    const filePath = path.join(dataDir, 'version.json');
    fs.writeFileSync(filePath, JSON.stringify(info, null, 2), 'utf-8');
  }
}
