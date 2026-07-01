import * as net from 'net';
import type { HealthCheckResult } from '../../types.js';

async function isPortListening(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(port, '127.0.0.1');
  });
}

export async function checkPortsHealth(ports: number[]): Promise<HealthCheckResult> {
  const id = 'ports-listening';
  const label = `المنافذ تستقبل الاتصالات (${ports.join(', ')})`;

  const results = await Promise.all(ports.map(async p => ({ port: p, listening: await isPortListening(p) })));
  const notListening = results.filter(r => !r.listening).map(r => r.port);

  if (notListening.length === 0) {
    return { id, label, status: 'healthy', detail: `جميع المنافذ تستقبل الاتصالات` };
  }

  return { id, label, status: 'unhealthy', detail: `المنافذ ${notListening.join(', ')} لا تستجيب` };
}
