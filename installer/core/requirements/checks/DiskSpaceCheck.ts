import * as fs from 'fs';
import * as os from 'os';
import type { RequirementResult } from '../../types.js';

const REQUIRED_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export async function checkDiskSpace(): Promise<RequirementResult> {
  const id = 'disk-space';
  const label = 'مساحة القرص (2GB+)';

  try {
    const drive = process.platform === 'win32' ? 'C:\\' : '/';
    const stats = fs.statfsSync(drive);
    const available = stats.bfree * stats.bsize;
    const availableGB = (available / (1024 ** 3)).toFixed(1);

    if (available >= REQUIRED_BYTES) {
      return { id, label, status: 'pass', detail: `${availableGB} GB متاح`, fixable: false };
    }

    return {
      id, label, status: 'fail',
      detail: `${availableGB} GB متاح فقط — يتطلب 2 GB على الأقل`,
      fixable: false,
    };
  } catch {
    return { id, label, status: 'warn', detail: 'تعذّر فحص مساحة القرص', fixable: false };
  }
}
