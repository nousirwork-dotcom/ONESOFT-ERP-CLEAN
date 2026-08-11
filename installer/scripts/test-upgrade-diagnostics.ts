import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UpgradeDiagnosticLogger } from '../core/upgrade/UpgradeDiagnosticLogger.js';

const logPath = path.join(os.tmpdir(), `onesoft-upgrade-utf8-${process.pid}.log`);
try {
  fs.rmSync(logPath, { force: true });
  new UpgradeDiagnosticLogger(logPath).record('verification', 'failure', {
    error: 'فشل التحقق من قاعدة البيانات — نص UTF-8',
  });
  const bytes = fs.readFileSync(logPath);
  const content = bytes.toString('utf8');
  assert.match(content, /فشل التحقق من قاعدة البيانات/);
  assert.deepEqual(Buffer.from(content, 'utf8'), bytes);
  console.log('[diagnostics-test] upgrade.log writes valid UTF-8 bytes: PASS');
  console.log('ALL UPGRADE DIAGNOSTIC TESTS: PASS');
} finally {
  fs.rmSync(logPath, { force: true });
}