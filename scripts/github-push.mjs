import { readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const OWNER = 'nousirwork-dotcom';
const REPO  = 'ONESOFT-ERP';
const TOKEN = process.env.GITHUB_TOKEN;
const ROOT  = '/home/runner/workspace';

const EXCLUDES = [
  '/.git/', '/node_modules/', '/.local/', '/dist/', '/.cache/',
  '/scripts/github-push.mjs',
];
const EXCLUDE_EXT = ['.tar.gz', '.zip'];

function isExcluded(path) {
  if (EXCLUDE_EXT.some(e => path.endsWith(e))) return true;
  return EXCLUDES.some(e => path.includes(e));
}

async function api(method, path, body) {
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// Get all files
const raw = execSync(
  `find ${ROOT} -type f`,
  { maxBuffer: 50 * 1024 * 1024 }
).toString().trim().split('\n');

const files = raw
  .filter(f => !isExcluded(f))
  .filter(f => {
    try { return statSync(f).size < 50 * 1024 * 1024; }
    catch { return false; }
  });

console.log(`📦 ${files.length} files to push`);

// Create blobs in batches of 10
const treeItems = [];
const BATCH = 10;

for (let i = 0; i < files.length; i += BATCH) {
  const batch = files.slice(i, i + BATCH);
  await Promise.all(batch.map(async (abs) => {
    const rel = abs.slice(ROOT.length + 1);
    let content, encoding;
    try {
      const buf = readFileSync(abs);
      // Try UTF-8 text first
      const txt = buf.toString('utf-8');
      // Check if it's valid text (no null bytes)
      if (!buf.includes(0x00)) {
        content = txt;
        encoding = 'utf-8';
      } else {
        content = buf.toString('base64');
        encoding = 'base64';
      }
    } catch (e) {
      console.warn(`  skip ${rel}: ${e.message}`);
      return;
    }
    try {
      const blob = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content, encoding });
      treeItems.push({ path: rel, mode: '100644', type: 'blob', sha: blob.sha });
    } catch (e) {
      console.warn(`  blob failed ${rel}: ${e.message}`);
    }
  }));

  const pct = Math.round(((i + BATCH) / files.length) * 100);
  process.stdout.write(`\r  blobs: ${Math.min(i + BATCH, files.length)}/${files.length} (${pct}%)`);
}
console.log('\n✅ Blobs created');

// Create tree
console.log('🌲 Creating tree...');
const tree = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree: treeItems });
console.log(`  tree sha: ${tree.sha}`);

// Create orphan commit (no parent)
console.log('💾 Creating commit...');
const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
  message: 'OneSoft ERP - full source code (clean history)',
  tree: tree.sha,
  parents: [],
  author: { name: 'OneSoft', email: 'dev@onesoft.app', date: new Date().toISOString() },
});
console.log(`  commit sha: ${commit.sha}`);

// Force update main ref
console.log('🚀 Updating main branch...');
try {
  await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, {
    sha: commit.sha,
    force: true,
  });
} catch {
  // Might not exist yet — create it
  await api('POST', `/repos/${OWNER}/${REPO}/git/refs`, {
    ref: 'refs/heads/main',
    sha: commit.sha,
  });
}
console.log('✅ GitHub push complete!');
console.log(`🔗 https://github.com/${OWNER}/${REPO}`);
