import type { RequirementResult } from '../../types.js';
import { PostgreSQLToolsResolver } from '../../database/PostgreSQLToolsResolver.js';

const MIN_PG_MAJOR = 16;

export async function checkPostgreSQL(): Promise<RequirementResult> {
  const id = 'postgresql';
  const label = `PostgreSQL ${MIN_PG_MAJOR}+`;

  try {
    const resolver = new PostgreSQLToolsResolver();
    resolver.resolveAll();
    const output = resolver.version('psql');
    const match = output.match(/(\d+)\.\d+/);
    const major = match ? parseInt(match[1] ?? '0', 10) : 0;
    if (major >= MIN_PG_MAJOR) {
      return { id, label, status: 'pass', detail: output, fixable: false };
    }
    return {
      id, label, status: 'fail',
      detail: `${output} — يتطلب PostgreSQL ${MIN_PG_MAJOR} أو أحدث`,
      fixable: true,
      fixLabel: `تثبيت PostgreSQL ${MIN_PG_MAJOR} تلقائياً`,
    };
  } catch {
    return {
      id, label, status: 'fail',
      detail: 'PostgreSQL غير مثبت',
      fixable: true,
      fixLabel: `تثبيت PostgreSQL ${MIN_PG_MAJOR} تلقائياً`,
    };
  }
}
