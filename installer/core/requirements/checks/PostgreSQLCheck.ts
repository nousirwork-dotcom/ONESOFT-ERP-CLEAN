import { execSync } from 'child_process';
import type { RequirementResult } from '../../types.js';

const MIN_PG_MAJOR = 16;

export async function checkPostgreSQL(): Promise<RequirementResult> {
  const id = 'postgresql';
  const label = `PostgreSQL ${MIN_PG_MAJOR}+`;

  const commands = ['psql', 'psql.exe'];
  const pgPaths = [
    'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
  ];

  for (const cmd of [...commands, ...pgPaths]) {
    try {
      const output = execSync(`"${cmd}" --version`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
      const match = output.match(/(\d+)\.\d+/);
      if (match) {
        const major = parseInt(match[1] ?? '0', 10);
        if (major >= MIN_PG_MAJOR) {
          return { id, label, status: 'pass', detail: output, fixable: false };
        }
        return {
          id, label, status: 'fail',
          detail: `${output} — يتطلب PostgreSQL ${MIN_PG_MAJOR} أو أحدث`,
          fixable: true,
          fixLabel: `تثبيت PostgreSQL ${MIN_PG_MAJOR} تلقائياً`,
        };
      }
    } catch {
      continue;
    }
  }

  return {
    id, label, status: 'fail',
    detail: 'PostgreSQL غير مثبت',
    fixable: true,
    fixLabel: `تثبيت PostgreSQL ${MIN_PG_MAJOR} تلقائياً`,
  };
}
