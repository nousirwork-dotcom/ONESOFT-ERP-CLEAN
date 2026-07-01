import { execSync } from 'child_process';
import type { RequirementResult } from '../../types.js';

export async function checkAdminPrivileges(): Promise<RequirementResult> {
  const id = 'admin-privileges';
  const label = 'صلاحيات Administrator';

  if (process.platform !== 'win32') {
    return { id, label, status: 'warn', detail: 'غير Windows — تخطي الفحص', fixable: false };
  }

  try {
    execSync('net session', { stdio: 'pipe' });
    return { id, label, status: 'pass', detail: 'يعمل بصلاحيات Administrator', fixable: false };
  } catch {
    return {
      id, label, status: 'fail',
      detail: 'يجب تشغيل المثبت كمسؤول (Run as Administrator)',
      fixable: false,
    };
  }
}
