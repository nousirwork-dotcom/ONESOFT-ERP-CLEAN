import { execSync } from 'child_process';
import type { RequirementResult } from '../../types.js';

export async function checkPostgreSQL(): Promise<RequirementResult> {
  const id = 'postgresql';
  const label = 'PostgreSQL 16+';

  const commands = ['psql', 'psql.exe'];
  const pgPaths = [
    'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
  ];

  for (const cmd of [...commands, ...pgPaths]) {
    try {
      const output = execSync(`"${cmd}" --version`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
      const match = output.match(/(\d+)\.\d+/);
      if (match) {
        const major = parseInt(match[1] || '0', 10);
        if (major >= 15) {
          return { id, label, status: 'pass', detail: output, fixable: false };
        }
        return {
          id, label, status: 'fail',
          detail: `${output} — يتطلب PostgreSQL 16+`,
          fixable: true,
          fixLabel: 'تثبيت PostgreSQL 16 تلقائياً',
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
    fixLabel: 'تثبيت PostgreSQL 16 تلقائياً',
  };
}
