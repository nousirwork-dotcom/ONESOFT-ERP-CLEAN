import { execSync } from 'child_process';
import type { HealthCheckResult } from '../../types.js';

export async function checkPostgresHealth(): Promise<HealthCheckResult> {
  const id = 'postgresql';
  const label = 'PostgreSQL Service';

  if (process.platform !== 'win32') {
    return { id, label, status: 'skipped', detail: 'غير Windows' };
  }

  try {
    const start = Date.now();
    const out = execSync('sc query postgresql-x64-16', { encoding: 'utf-8', stdio: 'pipe' });
    const ms = Date.now() - start;
    if (out.includes('RUNNING')) {
      return { id, label, status: 'healthy', detail: 'يعمل', responseMs: ms };
    }
    return { id, label, status: 'unhealthy', detail: 'الخدمة متوقفة' };
  } catch {
    // جرب اسم خدمة بديل
    try {
      const out2 = execSync('sc query postgresql-x64-15', { encoding: 'utf-8', stdio: 'pipe' });
      if (out2.includes('RUNNING')) {
        return { id, label, status: 'healthy', detail: 'PostgreSQL 15 يعمل' };
      }
    } catch {}
    return { id, label, status: 'unhealthy', detail: 'خدمة PostgreSQL غير موجودة أو متوقفة' };
  }
}
