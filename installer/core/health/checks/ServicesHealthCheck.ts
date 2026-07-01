import { spawnSync } from 'child_process';
import type { HealthCheckResult } from '../../types.js';

const SERVICES = ['OneSoft-Server', 'OneSoft-Client', 'OneSoft-Updater'] as const;

export async function checkServicesHealth(): Promise<HealthCheckResult> {
  const id = 'windows-services';
  const label = 'Windows Services';

  if (process.platform !== 'win32') {
    return { id, label, status: 'skipped', detail: 'غير Windows' };
  }

  const statuses = SERVICES.map(name => {
    try {
      const result = spawnSync('sc', ['query', name], { encoding: 'utf-8' });
      const out = result.stdout || '';
      const running = out.includes('RUNNING');
      const installed = !out.includes('FAILED') && !out.includes('1060');
      return { name, running, installed };
    } catch {
      return { name, running: false, installed: false };
    }
  });

  const notRunning = statuses.filter(s => s.installed && !s.running).map(s => s.name);
  const notInstalled = statuses.filter(s => !s.installed).map(s => s.name);

  if (notRunning.length === 0 && notInstalled.length === 0) {
    return { id, label, status: 'healthy', detail: 'جميع الخدمات تعمل' };
  }
  if (notRunning.length > 0) {
    return { id, label, status: 'warning', detail: `الخدمات التالية متوقفة: ${notRunning.join(', ')}` };
  }
  return { id, label, status: 'skipped', detail: 'الخدمات لم تُثبَّت بعد (وضع التطوير)' };
}
