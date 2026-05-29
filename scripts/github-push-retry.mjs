import { readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';

const OWNER = 'nousirwork-dotcom';
const REPO  = 'ONESOFT-ERP';
const TOKEN = process.env.GITHUB_TOKEN;
const ROOT  = '/home/runner/workspace';

const EXCLUDES = [
  '/.git/', '/node_modules/', '/.local/', '/dist/', '/.cache/',
  '/scripts/github-push',
];
const EXCLUDE_EXT = ['.tar.gz', '.zip'];

function isExcluded(path) {
  if (EXCLUDE_EXT.some(e => path.endsWith(e))) return true;
  return EXCLUDES.some(e => path.includes(e));
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(method, path, body, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
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

    // Rate limit — wait and retry
    if (res.status === 403 || res.status === 429) {
      const wait = Math.min(30000, 5000 * Math.pow(2, attempt));
      process.stdout.write(` [rate limit, wait ${wait/1000}s]`);
      await sleep(wait);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }
  throw new Error(`${method} ${path} failed after ${retries} retries`);
}

// Get all files
const raw = execSync(`find ${ROOT} -type f`, { maxBuffer: 50 * 1024 * 1024 })
  .toString().trim().split('\n');

const files = raw
  .filter(f => !isExcluded(f))
  .filter(f => { try { return statSync(f).size < 50 * 1024 * 1024; } catch { return false; } });

console.log(`📦 ${files.length} files to push\n`);

// Get current tree SHA from GitHub to find existing blobs
let existingBlobs = {};
try {
  const ref = await api('GET', `/repos/${OWNER}/${REPO}/git/refs/heads/main`);
  const commitSha = ref.object.sha;
  const commit = await api('GET', `/repos/${OWNER}/${REPO}/git/commits/${commitSha}`);
  const tree = await api('GET', `/repos/${OWNER}/${REPO}/git/trees/${commit.tree.sha}?recursive=1`);
  for (const item of tree.tree) {
    existingBlobs[item.path] = item.sha;
  }
  console.log(`♻️  Found ${Object.keys(existingBlobs).length} existing blobs to reuse\n`);
} catch (e) {
  console.log('No existing tree found, starting fresh\n');
}

// Create blobs sequentially with throttling
const treeItems = [];
let done = 0;

for (const abs of files) {
  const rel = abs.slice(ROOT.length + 1);

  // Reuse existing blob if unchanged
  if (existingBlobs[rel]) {
    treeItems.push({ path: rel, mode: '100644', type: 'blob', sha: existingBlobs[rel] });
    done++;
    continue;
  }

  let content, encoding;
  try {
    const buf = readFileSync(abs);
    if (!buf.includes(0x00)) {
      content = buf.toString('utf-8');
      encoding = 'utf-8';
    } else {
      content = buf.toString('base64');
      encoding = 'base64';
    }
  } catch (e) {
    console.warn(`  skip ${rel}: ${e.message}`);
    done++;
    continue;
  }

  try {
    process.stdout.write(`  [${done+1}/${files.length}] ${rel.slice(0, 60)}`);
    const blob = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content, encoding });
    treeItems.push({ path: rel, mode: '100644', type: 'blob', sha: blob.sha });
    process.stdout.write(' ✓\n');
    await sleep(300); // throttle: 300ms between new blobs
  } catch (e) {
    console.warn(`\n  ✗ failed ${rel}: ${e.message}`);
  }
  done++;
}

console.log(`\n✅ ${treeItems.length} items ready\n`);

// Create tree
console.log('🌲 Creating tree...');
const tree = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree: treeItems });
console.log(`  sha: ${tree.sha}\n`);

// Create orphan commit
console.log('💾 Creating commit...');
const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
  message: 'OneSoft ERP - complete source code',
  tree: tree.sha,
  parents: [],
  author: { name: 'OneSoft', email: 'dev@onesoft.app', date: new Date().toISOString() },
});
console.log(`  sha: ${commit.sha}\n`);

// Force update main
console.log('🚀 Updating main branch...');
await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, {
  sha: commit.sha,
  force: true,
});

console.log('✅ Done!');
console.log(`🔗 https://github.com/${OWNER}/${REPO}`);
