import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import type { ProgressEvent } from '../../types.js';

type Emit = (e: ProgressEvent) => void;

// EDB silent installer for PostgreSQL 16
const PG_INSTALLER_URL =
  'https://get.enterprisedb.com/postgresql/postgresql-16.3-1-windows-x64.exe';
const TEMP_PATH = path.join(process.env['TEMP'] || 'C:\\Windows\\Temp', 'pg16-installer.exe');
const PG_INSTALL_DIR = 'C:\\Program Files\\PostgreSQL\\16';
const PG_DATA_DIR    = 'C:\\Program Files\\PostgreSQL\\16\\data';

export class PostgreSQLFixer {
  constructor(private readonly pgPassword: string = 'postgres') {}

  async fix(emit: Emit): Promise<void> {
    emit({ level: 'info', message: 'جارٍ تنزيل PostgreSQL 16...', timestamp: now() });

    await downloadFile(PG_INSTALLER_URL, TEMP_PATH, (pct) => {
      emit({ level: 'info', message: `تنزيل PostgreSQL... ${pct}%`, timestamp: now(), percent: pct });
    });

    emit({ level: 'info', message: 'جارٍ تثبيت PostgreSQL 16 (قد يستغرق دقيقتين)...', timestamp: now() });

    await runSilentInstaller(TEMP_PATH, this.pgPassword);

    emit({ level: 'success', message: 'تم تثبيت PostgreSQL 16 بنجاح', timestamp: now() });

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
      res.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        if (total > 0) onProgress(Math.round(downloaded / total * 100));
      });
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', reject);
  });
}

function runSilentInstaller(exePath: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '--mode', 'unattended',
      '--unattendedmodeui', 'none',
      '--superpassword', password,
      '--servicename', 'postgresql-x64-16',
      '--serviceaccount', 'NT AUTHORITY\\NetworkService',
      '--datadir', PG_DATA_DIR,
      '--prefix', PG_INSTALL_DIR,
      '--enable_acledit', '1',
    ];
    const proc = spawn(exePath, args, { stdio: 'ignore' });
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`PostgreSQL installer exited with ${code}`)));
    proc.on('error', reject);
  });
}
