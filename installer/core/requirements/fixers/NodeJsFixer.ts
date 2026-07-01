import { execSync, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import type { ProgressEvent } from '../../types.js';

type Emit = (e: ProgressEvent) => void;

const NODE_INSTALLER_URL = 'https://nodejs.org/dist/v20.15.0/node-v20.15.0-x64.msi';
const TEMP_PATH = path.join(process.env['TEMP'] || 'C:\\Windows\\Temp', 'node-installer.msi');

export class NodeJsFixer {
  async fix(emit: Emit): Promise<void> {
    emit({ level: 'info', message: 'جارٍ تنزيل Node.js v20...', timestamp: now() });

    await downloadFile(NODE_INSTALLER_URL, TEMP_PATH, (pct) => {
      emit({ level: 'info', message: `تنزيل Node.js... ${pct}%`, timestamp: now(), percent: pct });
    });

    emit({ level: 'info', message: 'جارٍ تثبيت Node.js...', timestamp: now() });
    await runMsi(TEMP_PATH);

    emit({ level: 'success', message: 'تم تثبيت Node.js بنجاح', timestamp: now() });

    try { fs.unlinkSync(TEMP_PATH); } catch {}
  }
}

function now() { return new Date().toISOString(); }

function downloadFile(url: string, dest: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      const total = parseInt(res.headers['content-length'] ?? '0', 10);
      let downloaded = 0;
      res.on('data', chunk => {
        downloaded += chunk.length;
        if (total > 0) onProgress(Math.round(downloaded / total * 100));
      });
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', reject);
  });
}

function runMsi(msiPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('msiexec', ['/i', msiPath, '/qn', '/norestart'], { stdio: 'ignore' });
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`MSI exited with ${code}`)));
    proc.on('error', reject);
  });
}
