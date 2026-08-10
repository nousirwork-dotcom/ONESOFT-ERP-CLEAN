import * as http from 'http';
import type { HealthCheckResult } from '../../types.js';

export async function checkBackendHealth(port: number): Promise<HealthCheckResult> {
  const id = 'backend';
  const label = `Backend Server (:${port})`;

  return new Promise(resolve => {
    const start = Date.now();
    const req = http.get(`http://localhost:${port}/api/health`, { timeout: 5000 }, res => {
      const ms = Date.now() - start;
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { ready?: boolean };
          if (res.statusCode === 200 && body.ready === true) {
            resolve({ id, label, status: 'healthy', detail: 'HTTP 200 — ready=true', responseMs: ms });
          } else {
            resolve({ id, label, status: 'unhealthy', detail: `HTTP ${res.statusCode} — ready=${String(body.ready)}`, responseMs: ms });
          }
        } catch {
          resolve({ id, label, status: 'unhealthy', detail: `HTTP ${res.statusCode} — استجابة health غير صالحة`, responseMs: ms });
        }
      });
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
