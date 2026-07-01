import { execSync } from 'child_process';
import type { RequirementResult } from '../../types.js';

const MIN_NODE_MAJOR = 20;

export async function checkNodeJs(): Promise<RequirementResult> {
  const id = 'nodejs';
  const label = `Node.js v${MIN_NODE_MAJOR}+`;

  try {
    const output = execSync('node --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    const versionStr = output.replace('v', '');
    const major = parseInt(versionStr.split('.')[0] || '0', 10);

    if (major >= MIN_NODE_MAJOR) {
      return { id, label, status: 'pass', detail: `Node.js ${output}`, fixable: false };
    }

    return {
      id, label, status: 'fail',
      detail: `الإصدار الحالي ${output} — يتطلب v${MIN_NODE_MAJOR} أو أحدث`,
      fixable: true,
      fixLabel: 'تثبيت Node.js تلقائياً',
    };
  } catch {
    return {
      id, label, status: 'fail',
      detail: 'Node.js غير مثبت',
      fixable: true,
      fixLabel: 'تثبيت Node.js تلقائياً',
    };
  }
}
