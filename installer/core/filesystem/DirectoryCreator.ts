import * as fs from 'fs';
import * as path from 'path';
import type { PathsConfig, ProgressEvent } from '../types.js';

type Emit = (e: ProgressEvent) => void;

export class DirectoryCreator {
  create(paths: PathsConfig, emit: Emit): void {
    const dirs = [
      paths.data,
      paths.backups,
      paths.logs,
      paths.temp,
      paths.updates,
      paths.attachments,
      paths.exports,
      paths.uploads,
      path.join(paths.uploads, 'branding'),
    ];

    emit({ level: 'info', message: 'جارٍ إنشاء مجلدات النظام...', timestamp: now() });

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        emit({ level: 'info', message: `✓ ${dir}`, timestamp: now() });
      }
    }

    emit({ level: 'success', message: 'تم إنشاء مجلدات النظام', timestamp: now() });
  }

  writeVersionFile(installDir: string, version: string, extra?: Record<string, unknown>): void {
    const versionFile = path.join(installDir, 'version.json');
    fs.writeFileSync(versionFile, JSON.stringify({
      version,
      installedAt: new Date().toISOString(),
      ...extra,
    }, null, 2));
  }
}

function now() { return new Date().toISOString(); }
