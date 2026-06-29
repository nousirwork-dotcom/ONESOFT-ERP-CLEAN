/**
 * logger.ts — مسجّل الأحداث المركزي
 * يكتب السجلات على الكونسول + ملفات يومية في مجلد logs/
 */
import path from 'path';
import fs   from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── مجلد السجلات ──────────────────────────────────────────────────────────────
const LOG_DIR = process.env.LOG_DIR
  ?? path.join(__dirname, '..', '..', 'logs');

if (!fs.existsSync(LOG_DIR)) {
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
}

// ── مستويات السجل ─────────────────────────────────────────────────────────────
type Level = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LEVEL_COLOR: Record<Level, string> = {
  DEBUG: '\x1b[36m',   // cyan
  INFO:  '\x1b[32m',   // green
  WARN:  '\x1b[33m',   // yellow
  ERROR: '\x1b[31m',   // red
};
const RESET = '\x1b[0m';

// ── كتابة السجل ───────────────────────────────────────────────────────────────
function write(level: Level, module: string, msg: string, data?: unknown) {
  const now  = new Date();
  const ts   = now.toISOString();
  const date = ts.slice(0, 10);

  const entry = JSON.stringify({
    ts, level, module, msg,
    ...(data !== undefined ? { data } : {}),
  });

  // الكونسول (ملوّن)
  const color = LEVEL_COLOR[level];
  console.log(`${color}[${level}]${RESET} ${ts.slice(11, 19)} [${module}] ${msg}${data !== undefined ? ' ' + JSON.stringify(data) : ''}`);

  // ملف اليوم
  const logFile = path.join(LOG_DIR, `onesoft-${date}.log`);
  try { fs.appendFileSync(logFile, entry + '\n'); } catch {}

  // تنظيف السجلات الأقدم من 30 يوماً
  if (level === 'INFO' && Math.random() < 0.01) pruneOldLogs();
}

function pruneOldLogs() {
  try {
    const cutoff = Date.now() - 30 * 24 * 3600_000;
    fs.readdirSync(LOG_DIR)
      .filter(f => f.startsWith('onesoft-') && f.endsWith('.log'))
      .forEach(f => {
        const fp = path.join(LOG_DIR, f);
        if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
      });
  } catch {}
}

// ── API العام ─────────────────────────────────────────────────────────────────
export const logger = {
  debug: (module: string, msg: string, data?: unknown) => write('DEBUG', module, msg, data),
  info:  (module: string, msg: string, data?: unknown) => write('INFO',  module, msg, data),
  warn:  (module: string, msg: string, data?: unknown) => write('WARN',  module, msg, data),
  error: (module: string, msg: string, data?: unknown) => write('ERROR', module, msg, data),
};

// ── مسار مجلد السجلات (للـ API) ──────────────────────────────────────────────
export const LOG_PATH = LOG_DIR;
