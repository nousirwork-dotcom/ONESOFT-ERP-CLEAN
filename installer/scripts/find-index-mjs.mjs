/**
 * find-index-mjs.mjs — يفحص المشروع ويطبع جميع ملفات index.mjs مع SHA256
 * الاستخدام: node installer/scripts/find-index-mjs.mjs
 */
import * as fs   from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..', '..');

const IGNORE = ['node_modules', '.git', '.local'];

function sha256(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch { return 'error'; }
}

function findFiles(dir, name, results = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const e of entries) {
    if (IGNORE.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { findFiles(full, name, results); }
    else if (e.name === name) { results.push(full); }
  }
  return results;
}

const sep = '─'.repeat(70);
console.log(`\n${'═'.repeat(70)}`);
console.log('  🔍 فحص جميع ملفات index.mjs في المشروع');
console.log(`${'═'.repeat(70)}\n`);

const files = findFiles(ROOT, 'index.mjs');

if (files.length === 0) {
  console.log('  ⚠️  لم يُعثر على أي ملف index.mjs — ربما لم يتم البناء بعد\n');
  process.exit(0);
}

for (const f of files) {
  const rel   = path.relative(ROOT, f);
  const stat  = fs.statSync(f);
  const mtime = stat.mtime.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  const size  = (stat.size / 1024).toFixed(1) + ' KB';
  const sha   = sha256(f).slice(0, 16) + '...';

  console.log(`  📄 ${rel}`);
  console.log(`     Size   : ${size}`);
  console.log(`     Built  : ${mtime}`);
  console.log(`     SHA256 : ${sha}`);
  console.log(sep);
}

console.log(`\n  ✅ المجموع: ${files.length} ملف\n`);
