import { readFileSync, writeFileSync, statSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const OWNER    = 'nousirwork-dotcom';
const REPO     = 'ONESOFT-ERP';
const TOKEN    = process.env.GITHUB_TOKEN;
const ROOT     = '/home/runner/workspace';
const PROGRESS = `${ROOT}/.local/github-push-progress.json`;
const DELAY    = 250; // ms between requests

const EXCLUDES = ['/.git/', '/node_modules/', '/.local/', '/dist/', '/.cache/', '/scripts/github-push'];
const EXCLUDE_EXT = ['.tar.gz', '.zip'];

function isExcluded(p) {
  return EXCLUDE_EXT.some(e => p.endsWith(e)) || EXCLUDES.some(e => p.includes(e));
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(method, path, body, retries = 6) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 403 || res.status === 429) {
      const w = Math.min(60000, 4000 * Math.pow(2, i));
      process.stdout.write(` ⏳${w/1000}s`);
      await sleep(w);
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${(await res.text()).slice(0,300)}`);
    return res.json();
  }
  throw new Error(`${method} ${path} gave up after ${retries} retries`);
}

// Load progress
let progress = existsSync(PROGRESS) ? JSON.parse(readFileSync(PROGRESS, 'utf-8')) : {};
// progress = { "rel/path": "sha", ... }

// Collect files
const files = execSync(`find ${ROOT} -type f`, { maxBuffer: 50 * 1024 * 1024 })
  .toString().trim().split('\n')
  .filter(f => !isExcluded(f))
  .filter(f => { try { return statSync(f).size < 50e6; } catch { return false; } })
  .map(f => f.slice(ROOT.length + 1));

console.log(`📦 ${files.length} total files`);
const missing = files.filter(f => !progress[f]);
console.log(`⬆️  ${missing.length} need uploading, ${files.length - missing.length} already done\n`);

// Upload missing blobs
for (let i = 0; i < missing.length; i++) {
  const rel = missing[i];
  const abs = `${ROOT}/${rel}`;
  let content, encoding;
  try {
    const buf = readFileSync(abs);
    if (!buf.includes(0x00)) { content = buf.toString('utf-8'); encoding = 'utf-8'; }
    else                      { content = buf.toString('base64'); encoding = 'base64'; }
  } catch { continue; }

  process.stdout.write(`  [${i+1}/${missing.length}] ${rel.slice(0,70)}`);
  try {
    const blob = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content, encoding });
    progress[rel] = blob.sha;
    // Save progress every 5 uploads
    if (i % 5 === 4) writeFileSync(PROGRESS, JSON.stringify(progress));
    process.stdout.write(' ✓\n');
    await sleep(DELAY);
  } catch (e) {
    process.stdout.write(` ✗ ${e.message.slice(0,80)}\n`);
  }
}
writeFileSync(PROGRESS, JSON.stringify(progress));

// Check if all files are done
const covered = files.filter(f => progress[f]);
console.log(`\n✅ ${covered.length}/${files.length} blobs ready`);

if (covered.length < files.length) {
  console.log(`⚠️  ${files.length - covered.length} files still missing — run again to continue`);
  process.exit(0);
}

// All blobs ready — create tree + commit + push
console.log('\n🌲 Creating tree...');
const treeItems = files
  .filter(f => progress[f])
  .map(f => ({ path: f, mode: '100644', type: 'blob', sha: progress[f] }));

const tree = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree: treeItems });
console.log(`  sha: ${tree.sha}`);

console.log('💾 Creating commit...');
const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
  message: 'OneSoft ERP — complete source code (clean history)',
  tree: tree.sha,
  parents: [],
  author: { name: 'OneSoft ERP', email: 'dev@onesoft.app', date: new Date().toISOString() },
});
console.log(`  sha: ${commit.sha}`);

console.log('🚀 Force-updating main...');
try {
  await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, { sha: commit.sha, force: true });
} catch {
  await api('POST',  `/repos/${OWNER}/${REPO}/git/refs`, { ref: 'refs/heads/main', sha: commit.sha });
}

// Clean up progress file
writeFileSync(PROGRESS, '{}');
console.log('\n✅ GitHub push complete!');
console.log(`🔗 https://github.com/${OWNER}/${REPO}`);
