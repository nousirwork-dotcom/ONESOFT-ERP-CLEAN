/**
 * startup-banner.ts — يُطبع قبل أي كود آخر في index.ts
 * يُستورد كأول import في index.ts حتى يتم تنفيذه قبل env.ts وdb.ts
 */
import { fileURLToPath } from 'url';
import path from 'path';
import fs   from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);

// وقت البناء = وقت تعديل الملف (يتغير مع كل build)
const buildTime = (() => {
  try {
    const mtime = fs.statSync(__filename).mtime;
    return mtime.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  } catch { return 'unknown'; }
})();

// Git commit — يعمل إذا كان git موجوداً في PATH
const gitCommit = (() => {
  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf-8', timeout: 2000, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch { return 'N/A (no git)'; }
})();

// مسار config.json
const configPath = (() => {
  if (process.env['ONESOFT_CONFIG']) return process.env['ONESOFT_CONFIG'];
  const PD = process.env['PROGRAMDATA'] ?? process.env['ProgramData'] ?? 'C:\\ProgramData';
  return path.join(PD, 'OneSoft', 'config', 'onesoft.config.json');
})();

const configExists = fs.existsSync(configPath);

const sep = '═'.repeat(60);
process.stdout.write([
  '',
  sep,
  '  🚀 OneSoft Backend Startup',
  sep,
  `  Backend File  : ${__filename}`,
  `  import.meta   : ${import.meta.url}`,
  `  Build Time    : ${buildTime}`,
  `  Git Commit    : ${gitCommit}`,
  `  NODE_ENV      : ${process.env['NODE_ENV'] ?? '(not set)'}`,
  `  DATABASE_URL  : ${process.env['DATABASE_URL'] ? process.env['DATABASE_URL'].replace(/:([^:@]+)@/, ':***@') : '(empty)'}`,
  `  node exe      : ${process.execPath}`,
  `  cwd           : ${process.cwd()}`,
  `  Config Path   : ${configPath}`,
  `  Config Exists : ${configExists ? '✅ YES' : '❌ NO — سيفشل في production'}`,
  sep,
  '',
].join('\n'));
