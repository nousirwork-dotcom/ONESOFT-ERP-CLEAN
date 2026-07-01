import * as net from 'net';
import type { RequirementResult } from '../../types.js';

const REQUIRED_PORTS = [3000, 5000];

async function isPortFree(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

export async function checkPorts(): Promise<RequirementResult> {
  const id = 'ports';
  const label = 'المنافذ المطلوبة (3000, 5000)';

  const results = await Promise.all(
    REQUIRED_PORTS.map(async p => ({ port: p, free: await isPortFree(p) }))
  );

  const blocked = results.filter(r => !r.free).map(r => r.port);

  if (blocked.length === 0) {
    return { id, label, status: 'pass', detail: 'جميع المنافذ متاحة', fixable: false };
  }

  return {
    id, label, status: 'fail',
    detail: `المنافذ ${blocked.join(', ')} مشغولة — أغلق البرامج التي تستخدمها`,
    fixable: false,
  };
}
