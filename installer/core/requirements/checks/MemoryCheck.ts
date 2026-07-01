import * as os from 'os';
import type { RequirementResult } from '../../types.js';

const REQUIRED_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB

export async function checkMemory(): Promise<RequirementResult> {
  const id = 'memory';
  const label = 'الذاكرة RAM (4GB+)';

  const total = os.totalmem();
  const totalGB = (total / (1024 ** 3)).toFixed(1);

  if (total >= REQUIRED_BYTES) {
    return { id, label, status: 'pass', detail: `${totalGB} GB`, fixable: false };
  }

  return {
    id, label, status: 'warn',
    detail: `${totalGB} GB — يُوصى بـ 4 GB على الأقل للأداء الأمثل`,
    fixable: false,
  };
}
