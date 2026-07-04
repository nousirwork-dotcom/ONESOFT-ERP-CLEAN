/**
 * backup.ts — نسخ احتياطي واستعادة
 * يدعم: PostgreSQL dump | نسخ احتياطي من قاعدة البيانات + السجلات
 */
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { ENV } from '../env.js';
import { logger } from '../logger.js';
import fs   from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..', '..', '..');

// ── مجلد النسخ الاحتياطي ──────────────────────────────────────────────────────
function getBackupDir(): string {
  const envDir = process.env.BACKUP_DIR;
  if (envDir && envDir.trim()) return envDir.trim();
  return path.join(ROOT, 'backups');
}

function ensureBackupDir(): string {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── اسم الملف بالتاريخ ────────────────────────────────────────────────────────
function makeFileName(prefix = 'backup'): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${prefix}_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// ── قراءة قائمة النسخ ─────────────────────────────────────────────────────────
function listBackups() {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql') || f.endsWith('.dump') || f.endsWith('.zip'))
    .map(f => {
      const fp   = path.join(dir, f);
      const stat = fs.statSync(fp);
      return {
        name:    f,
        path:    fp,
        size:    stat.size,
        sizeStr: formatSize(stat.size),
        mtime:   stat.mtime.toISOString(),
        type:    f.endsWith('.zip') ? 'zip' : 'sql',
      };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
}

function formatSize(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── تنفيذ النسخ الاحتياطي ─────────────────────────────────────────────────────
function dumpPostgres(outPath: string): void {
  const url = new URL(ENV.dbUrl);
  const env = {
    ...process.env,
    PGPASSWORD: url.password,
  };
  const args = [
    '-h', url.hostname,
    '-p', url.port || '5432',
    '-U', url.username,
    '-d', url.pathname.slice(1),
    '-F', 'p',   // plain SQL
    '-f', outPath,
    '--no-password',
  ];
  const result = spawnSync('pg_dump', args, { env, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'pg_dump failed');
  }
}

function restorePostgres(dumpPath: string): void {
  const url = new URL(ENV.dbUrl);
  const env = {
    ...process.env,
    PGPASSWORD: url.password,
  };
  const args = [
    '-h', url.hostname,
    '-p', url.port || '5432',
    '-U', url.username,
    '-d', url.pathname.slice(1),
    '-f', dumpPath,
    '--no-password',
    '--single-transaction',
  ];
  const result = spawnSync('psql', args, { env, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'psql restore failed');
  }
}

// ── Router ────────────────────────────────────────────────────────────────────
export const backupRouter = router({

  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('غير مصرح');
    return listBackups();
  }),

  getDir: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('غير مصرح');
    return { dir: getBackupDir() };
  }),

  create: protectedProcedure
    .input(z.object({ label: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('غير مصرح');
      const dir  = ensureBackupDir();
      const name = makeFileName(input.label ?? 'backup');
      const file = path.join(dir, `${name}.sql`);

      logger.info('backup', `creating backup: ${file}`);
      try {
        dumpPostgres(file);
        const stat = fs.statSync(file);
        logger.info('backup', `backup created: ${file} (${formatSize(stat.size)})`);
        return { ok: true, name: path.basename(file), size: stat.size, sizeStr: formatSize(stat.size) };
      } catch (err: any) {
        logger.error('backup', `backup failed: ${err.message}`);
        throw new Error(`فشل إنشاء النسخة الاحتياطية: ${err.message}`);
      }
    }),

  restore: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== 'superadmin') throw new Error('يتطلب صلاحية المدير العام');
      const dir  = getBackupDir();
      const file = path.join(dir, input.name);
      if (!fs.existsSync(file)) throw new Error('الملف غير موجود');
      if (!file.startsWith(dir)) throw new Error('مسار غير صالح');

      logger.warn('backup', `restoring from: ${file}`);
      try {
        restorePostgres(file);
        logger.info('backup', 'restore completed');
        return { ok: true };
      } catch (err: any) {
        logger.error('backup', `restore failed: ${err.message}`);
        throw new Error(`فشل الاستعادة: ${err.message}`);
      }
    }),

  delete: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('غير مصرح');
      const dir  = getBackupDir();
      const file = path.join(dir, input.name);
      if (!file.startsWith(dir)) throw new Error('مسار غير صالح');
      if (!fs.existsSync(file)) throw new Error('الملف غير موجود');
      fs.unlinkSync(file);
      logger.info('backup', `deleted: ${file}`);
      return { ok: true };
    }),

  getLogs: protectedProcedure
    .input(z.object({ lines: z.number().min(10).max(1000).default(200) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('غير مصرح');
      const logDir = process.env.LOG_DIR ?? path.join(ROOT, 'logs');
      if (!fs.existsSync(logDir)) return { lines: [], dir: logDir };
      const today   = new Date().toISOString().slice(0, 10);
      const logFile = path.join(logDir, `onesoft-${today}.log`);
      if (!fs.existsSync(logFile)) return { lines: [], dir: logDir, file: logFile };
      const content = fs.readFileSync(logFile, 'utf-8');
      const lines   = content.split('\n').filter(Boolean).slice(-input.lines);
      return { lines, dir: logDir, file: logFile };
    }),

  getLogFiles: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') throw new Error('غير مصرح');
    const logDir = process.env.LOG_DIR ?? path.join(ROOT, 'logs');
    if (!fs.existsSync(logDir)) return [];
    return fs.readdirSync(logDir)
      .filter(f => f.endsWith('.log'))
      .map(f => {
        const fp   = path.join(logDir, f);
        const stat = fs.statSync(fp);
        return { name: f, size: stat.size, sizeStr: formatSize(stat.size), mtime: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  }),
});
