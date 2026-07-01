import * as os from 'os';
import { execSync } from 'child_process';
import type { RequirementResult } from '../../types.js';

export async function checkWindowsVersion(): Promise<RequirementResult> {
  const id = 'windows-version';
  const label = 'Windows 10/11 (64-bit)';

  if (process.platform !== 'win32') {
    return { id, label, status: 'warn', detail: 'غير Windows — بيئة تطوير', fixable: false };
  }

  try {
    const release = os.release();
    const [major, minor, build] = release.split('.').map(Number);
    const arch = os.arch();

    if (arch !== 'x64') {
      return { id, label, status: 'fail', detail: 'يتطلب نظام 64-bit', fixable: false };
    }

    // Windows 10 = build >= 10240, Windows 11 = build >= 22000
    if (major >= 10 && (minor > 0 || build >= 10240)) {
      const winVersion = build >= 22000 ? '11' : '10';
      return { id, label, status: 'pass', detail: `Windows ${winVersion} (Build ${build})`, fixable: false };
    }

    return { id, label, status: 'fail', detail: `Windows ${release} غير مدعوم — يتطلب Windows 10 أو أحدث`, fixable: false };
  } catch {
    return { id, label, status: 'warn', detail: 'تعذّر فحص إصدار Windows', fixable: false };
  }
}
