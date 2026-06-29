import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');

const ALLOWED_DIRS = ['client-app/src', 'server-app/src'];
const EXCLUDED = new Set(['node_modules', '.git', 'dist', 'build', '.cache', '__pycache__', '.vite']);
const MAX_FILE_SIZE = 512 * 1024;

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  json: 'json', css: 'css', html: 'html', md: 'markdown', sql: 'sql',
  txt: 'text', sh: 'bash', env: 'text',
};

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  ext?: string;
  size?: number;
  children?: FileNode[];
}

function buildTree(dir: string, relBase: string): FileNode[] {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return []; }

  const nodes: FileNode[] = [];
  for (const e of entries) {
    if (EXCLUDED.has(e.name) || e.name.startsWith('.')) continue;
    const fullPath  = path.join(dir, e.name);
    const relPath   = path.join(relBase, e.name).replace(/\\/g, '/');

    if (e.isDirectory()) {
      nodes.push({ name: e.name, path: relPath, type: 'dir', children: buildTree(fullPath, relPath) });
    } else if (e.isFile()) {
      const ext  = e.name.split('.').pop() ?? '';
      let size = 0;
      try { size = fs.statSync(fullPath).size; } catch {}
      nodes.push({ name: e.name, path: relPath, type: 'file', ext, size });
    }
  }
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

export const sourceCodeRouter = router({
  getTree: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') {
      throw new Error('غير مصرح');
    }
    return ALLOWED_DIRS.map(dir => {
      const fullDir = path.join(ROOT, dir);
      const parts   = dir.split('/');
      return {
        name: dir,
        path: dir,
        type: 'dir' as const,
        children: buildTree(fullDir, dir),
      };
    });
  }),

  getFile: protectedProcedure
    .input(z.object({ filePath: z.string().max(300) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') {
        throw new Error('غير مصرح');
      }

      const allowed = ALLOWED_DIRS.some(d => input.filePath.startsWith(d + '/') || input.filePath === d);
      if (!allowed) throw new Error('مسار غير مسموح');
      if (input.filePath.includes('..')) throw new Error('مسار غير صالح');

      const fullPath = path.join(ROOT, input.filePath);
      let stat: fs.Stats;
      try { stat = fs.statSync(fullPath); } catch { throw new Error('الملف غير موجود'); }
      if (!stat.isFile()) throw new Error('ليس ملفاً');
      if (stat.size > MAX_FILE_SIZE) return { content: `/* الملف كبير جداً (${Math.round(stat.size/1024)} KB) */`, lang: 'text', lines: 0, size: stat.size };

      const content = fs.readFileSync(fullPath, 'utf-8');
      const ext = input.filePath.split('.').pop() ?? '';
      const lang = LANG_MAP[ext] ?? 'text';
      return { content, lang, lines: content.split('\n').length, size: stat.size };
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().max(100) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== 'superadmin' && ctx.user?.role !== 'admin') {
        throw new Error('غير مصرح');
      }
      if (!input.query.trim()) return [];

      const results: { path: string; line: number; text: string }[] = [];
      const q = input.query.toLowerCase();

      function scanDir(dir: string, rel: string) {
        let entries: fs.Dirent[];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
          if (EXCLUDED.has(e.name) || e.name.startsWith('.')) continue;
          const fp = path.join(dir, e.name);
          const rp = `${rel}/${e.name}`;
          if (e.isDirectory()) { scanDir(fp, rp); continue; }
          if (!e.isFile()) continue;
          let content = '';
          try {
            const stat = fs.statSync(fp);
            if (stat.size > 200 * 1024) continue;
            content = fs.readFileSync(fp, 'utf-8');
          } catch { continue; }
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(q)) {
              results.push({ path: rp, line: i + 1, text: lines[i].trim().slice(0, 120) });
              if (results.length >= 50) return;
            }
          }
        }
      }

      for (const d of ALLOWED_DIRS) scanDir(path.join(ROOT, d), d);
      return results;
    }),
});
