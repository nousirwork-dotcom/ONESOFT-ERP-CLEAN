import * as http from 'http';
import type { HealthCheckResult } from '../../types.js';

export async function checkFrontendHealth(port: number): Promise<HealthCheckResult> {
  const id = 'frontend';
  const label = `Frontend Server (:${port})`;

  return new Promise(resolve => {
    const start = Date.now();
    const req = http.get(`http://localhost:${port}`, { timeout: 5000 }, res => {
      const ms = Date.now() - start;
      if (res.statusCode && res.statusCode < 500) {
        resolve({ id, label, status: 'healthy', detail: `HTTP ${res.statusCode}`, responseMs: ms });
      } else {
        resolve({ id, label, status: 'unhealthy', detail: `HTTP ${res.statusCode}` });
      }
    });
    req.on('error', () => {
      resolve({ id, label, status: 'unhealthy', detail: `لا يستجيب على :${port}` });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ id, label, status: 'unhealthy', detail: 'انتهت مهلة الاتصال (5s)' });
    });
  });
}
