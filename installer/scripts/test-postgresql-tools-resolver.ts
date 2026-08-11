import assert from 'node:assert/strict';
import { PostgreSQLToolsResolutionError, PostgreSQLToolsResolver } from '../core/database/PostgreSQLToolsResolver.js';

const serviceBin = 'C:\\Program Files\\PostgreSQL\\16\\bin';
const programFilesBin = 'C:\\Program Files\\PostgreSQL\\17\\bin';
const x86Bin = 'C:\\Program Files (x86)\\PostgreSQL\\15\\bin';
const pathBin = 'C:\\Fallback\\bin';
const executableNames = ['pg_dump.exe', 'pg_restore.exe', 'psql.exe'];

function fakeResolver(options: {
  serviceOutput?: string;
  programFiles?: string[];
  x86?: string[];
  path?: string;
} = {}): PostgreSQLToolsResolver {
  const directories = new Set([
    ...(options.serviceOutput ? [serviceBin] : []),
    ...(options.programFiles ?? [programFilesBin]),
    ...(options.x86 ?? []),
    ...(options.path ? [pathBin] : []),
  ]);
  const files = new Set<string>();
  for (const directory of directories) {
    files.add(directory);
    for (const executable of executableNames) files.add(`${directory}\\${executable}`);
  }

  return new PostgreSQLToolsResolver({
    platform: 'win32',
    env: {
      ProgramW6432: 'C:\\Program Files',
      'ProgramFiles(x86)': 'C:\\Program Files (x86)',
      PATH: options.path ? `${pathBin};C:\\Windows\\System32` : 'C:\\Windows\\System32',
    },
    existsSync: (filePath) => files.has(filePath) || filePath.endsWith('\\PostgreSQL'),
    readdirSync: (directory) => {
      if (directory === 'C:\\Program Files\\PostgreSQL') {
        return (options.programFiles ?? [programFilesBin]).map((bin) => ({
          name: bin.split('\\').at(-2)!,
          isDirectory: () => true,
        })) as never;
      }
      if (directory === 'C:\\Program Files (x86)\\PostgreSQL') {
        return (options.x86 ?? []).map((bin) => ({
          name: bin.split('\\').at(-2)!,
          isDirectory: () => true,
        })) as never;
      }
      return [];
    },
    runCommand: (filePath, args) => {
      if (filePath === 'sc.exe' && args[0] === 'query') {
        return options.serviceOutput ?? '';
      }
      if (filePath === 'sc.exe' && args[0] === 'qc') {
        return 'SERVICE_NAME: postgresql-x64-16\n        BINARY_PATH_NAME   : "C:\\Program Files\\PostgreSQL\\16\\bin\\postgres.exe" -D "C:\\data"';
      }
      return `${filePath} (PostgreSQL) 16.10`;
    },
    probeCommand: () => true,
  });
}

const fromService = fakeResolver({
  serviceOutput: 'SERVICE_NAME: postgresql-x64-16',
  programFiles: [programFilesBin],
});
const serviceTools = fromService.resolveAll();
assert.equal(serviceTools.sourceByTool.pg_dump, 'service');
assert.equal(serviceTools.pgDump, `${serviceBin}\\pg_dump.exe`);
assert.equal(serviceTools.pgRestore, `${serviceBin}\\pg_restore.exe`);
assert.equal(serviceTools.psql, `${serviceBin}\\psql.exe`);
console.log('[resolver-test] service ImagePath wins over Program Files and PATH: PASS');

const fromProgramFiles = fakeResolver({ programFiles: [programFilesBin] });
const programTools = fromProgramFiles.resolveAll();
assert.equal(programTools.sourceByTool.psql, 'program-files');
assert.equal(programTools.psql, `${programFilesBin}\\psql.exe`);
console.log('[resolver-test] Program Files discovery works without service or PATH: PASS');

const fromPath = fakeResolver({ programFiles: [], x86: [], path: 'C:\\Fallback\\bin' });
const pathTools = fromPath.resolveAll();
assert.equal(pathTools.sourceByTool.pg_dump, 'path');
assert.equal(pathTools.pgDump, `${pathBin}\\pg_dump.exe`);
console.log('[resolver-test] PATH is used only as the final fallback: PASS');

assert.throws(
  () => fakeResolver({ programFiles: [], x86: [] }).resolveAll(),
  (error: unknown) => error instanceof PostgreSQLToolsResolutionError &&
    error.message === 'تعذر العثور على أدوات PostgreSQL اللازمة للنسخ الاحتياطي.' &&
    error.missingTools.length === 3,
);
console.log('[resolver-test] missing tools fail closed with the required message: PASS');

console.log('ALL POSTGRESQL TOOLS RESOLVER TESTS: PASS');