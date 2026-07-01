import * as http from 'http';
import type { HealthCheckResult } from '../../types.js';

export async function checkBackendHealth(port: number): Promise<HealthCheckResult> {
  const id = 'backend';
  const label = `Backend Server (:${port})`;

  return new Promise(resolve => {
    const start = Date.now();
    const req = http.get(`http://localhost:${port}/api/health`, { timeout: 5000 }, res => {
      const ms = Date.now() - start;
      if (res.statusCode && res.statusCode < 500) {
        resolve({ id, label, status: 'healthy', detail: `HTTP ${res.statusCode}`, responseMs: ms });
      } else {
        resolve({ id, label, status: 'unhealthy', detail: `HTTP ${res.statusCode}`, responseMs: ms });
      }
    });
    req.on('error', () => {
      // جرب trpc endpoint
      const req2 = http.get(`http://localhost:${port}/trpc/auth.me`, { timeout: 5000 }, res2 => {
        const ms2 = Date.now() - start;
        resolve({ id, label, status: 'healthy', detail: `tRPC OK — HTTP ${res2.statusCode}`, responseMs: ms2 });
      });
      req2.on('error', () => {
        resolve({ id, label, status: 'unhealthy', detail: `لا يستجيب على :${port}` });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ id, label, status: 'unhealthy', detail: 'انتهت مهلة الاتصال (5s)' });
    });
  });
}
