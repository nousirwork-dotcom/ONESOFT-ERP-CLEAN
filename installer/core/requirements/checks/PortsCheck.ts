import * as net from 'net';
import type { RequirementResult } from '../../types.js';

// المنفذ الأساسي فقط — لم يعد هناك منفذ Frontend منفصل (تم دمجه مع الـ Backend).
// ملاحظة: حتى لو كان 3000 مشغولاً، يختار المُثبِّت تلقائياً منفذاً بديلاً
// (installer/core/services/ServiceManager.ts → findAvailablePort)، لذا هذا
// الفحص إعلامي فقط ولا يوقف التثبيت.
const PREFERRED_PORT = 3000;

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
  const label = 'المنفذ الافتراضي (3000)';

  const free = await isPortFree(PREFERRED_PORT);

  if (free) {
    return { id, label, status: 'pass', detail: 'المنفذ 3000 متاح', fixable: false };
  }

  return {
    id, label, status: 'warn',
    detail: 'المنفذ 3000 مشغول — سيختار المُثبِّت منفذاً بديلاً تلقائياً',
    fixable: false,
  };
}
