import { execSync, spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import type { ServiceName, ServiceStatus, ServiceInfo, ServiceOperationResult, ProgressEvent, DeploymentType, AccessMode } from '../types.js';

type Emit = (e: ProgressEvent) => void;

// NSSM مُضمَّن في resources/bin/nssm.exe
const electronResourcesPath: string =
  'resourcesPath' in process
    ? String((process as typeof process & { resourcesPath?: string }).resourcesPath ?? '')
    : '';

function getNssmPath(): string {
  const candidates = [
    path.join(electronResourcesPath, 'bin', 'nssm.exe'),
    path.join(__dirname, '..', '..', 'resources', 'bin', 'nssm.exe'),
    path.join(process.cwd(), 'resources', 'bin', 'nssm.exe'),
    'nssm.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return 'nssm';
}

export class ServiceManager {
  private readonly nssm: string;

  constructor() {
    this.nssm = getNssmPath();
  }

  // ─── فحص الحالة ────────────────────────────────────────────────────────────
  getStatus(name: ServiceName): ServiceStatus {
    if (process.platform !== 'win32') return 'not-installed';
    try {
      const result = spawnSync('sc', ['query', name], { encoding: 'utf-8' });
      const out = result.stdout || '';
      if (out.includes('RUNNING')) return 'running';
      if (out.includes('STOPPED')) return 'stopped';
      if (out.includes('START_PENDING')) return 'starting';
      if (out.includes('STOP_PENDING')) return 'stopping';
      if (out.includes('FAILED_TO_START')) return 'error';
      return 'not-installed';
    } catch {
      return 'not-installed';
    }
  }

  // ─── تثبيت خدمة ────────────────────────────────────────────────────────────
  install(
    name: ServiceName,
    executablePath: string,
    args: string[],
    logPath: string,
    emit?: Emit,
  ): ServiceOperationResult {
    emit?.({ level: 'info', message: `جارٍ تثبيت خدمة ${name}...`, timestamp: now() });

    if (process.platform !== 'win32') {
      emit?.({ level: 'warning', message: `تخطي تثبيت ${name} (غير Windows)`, timestamp: now() });
      return { success: true };
    }

    try {
      const existing = this.getStatus(name);
      if (existing !== 'not-installed') {
        this.remove(name);
      }

      exec(this.nssm, ['install', name, executablePath, ...args]);
      exec(this.nssm, ['set', name, 'AppDirectory', path.dirname(executablePath)]);
      exec(this.nssm, ['set', name, 'Start', 'SERVICE_AUTO_START']);
      exec(this.nssm, ['set', name, 'AppStdout', logPath]);
      exec(this.nssm, ['set', name, 'AppStderr', logPath]);
      exec(this.nssm, ['set', name, 'AppRotateFiles', '1']);
      exec(this.nssm, ['set', name, 'AppRotateBytes', '10485760']);

      emit?.({ level: 'success', message: `تم تثبيت خدمة ${name}`, timestamp: now() });
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      emit?.({ level: 'error', message: `فشل تثبيت ${name}: ${msg}`, timestamp: now() });
      return { success: false, error: msg };
    }
  }

  // ─── تشغيل / إيقاف / إعادة تشغيل ─────────────────────────────────────────
  start(name: ServiceName): ServiceOperationResult {
    return this._sc('start', name);
  }

  stop(name: ServiceName): ServiceOperationResult {
    return this._sc('stop', name);
  }

  restart(name: ServiceName): ServiceOperationResult {
    this._sc('stop', name);
    return this._sc('start', name);
  }

  // ─── إزالة خدمة ────────────────────────────────────────────────────────────
  remove(name: ServiceName): ServiceOperationResult {
    if (process.platform !== 'win32') return { success: true };
    try {
      const status = this.getStatus(name);
      if (status === 'running') this.stop(name);
      exec(this.nssm, ['remove', name, 'confirm']);
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // ─── انتظار حتى يستجيب منفذ TCP ───────────────────────────────────────────
  // يُرسل GET إلى localhost:port كل pollMs حتى يصل timeout (ms)
  // يعيد true عند النجاح، false عند انتهاء الوقت
  async waitForPort(
    port: number,
    emit: Emit,
    timeoutMs = 90_000,
    pollMs = 3_000,
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    emit({ level: 'info', message: `⏳ انتظار المنفذ ${port}...`, timestamp: now() });

    while (Date.now() < deadline) {
      const ok = await new Promise<boolean>(resolve => {
        const req = http.get(
          { hostname: '127.0.0.1', port, path: '/', timeout: 2_500 },
          res => { res.resume(); resolve(true); },
        );
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
      });

      if (ok) {
        emit({ level: 'success', message: `✅ المنفذ ${port} يستجيب`, timestamp: now() });
        return true;
      }

      // أيضاً نعتبره جاهزاً إذا كان مقبولاً (ECONNREFUSED → الخدمة لم تبدأ بعد)
      const elapsed = Math.round((Date.now() - (deadline - timeoutMs)) / 1000);
      emit({ level: 'info', message: `⏳ المنفذ ${port} لم يستجب بعد (${elapsed}s)...`, timestamp: now() });
      await sleep(pollMs);
    }

    emit({ level: 'warning', message: `⚠️ انتهى الوقت — المنفذ ${port} لم يستجب خلال ${timeoutMs / 1000}s`, timestamp: now() });
    return false;
  }

  // ─── تثبيت جميع خدمات النظام ───────────────────────────────────────────────
  async installAll(
    opts: {
      installDir:     string;
      logsDir:        string;
      deploymentType: DeploymentType;
      accessModes:    AccessMode[];
    },
    emit: Emit,
  ): Promise<void> {
    const { installDir, logsDir, deploymentType, accessModes } = opts;
    const nodePath = findNode();

    const needsBackend  = ['server', 'server+client', 'branch'].includes(deploymentType);
    const needsFrontend = ['server+client', 'branch'].includes(deploymentType)
                       || (deploymentType === 'server' && accessModes.includes('web'));
    const needsUpdater  = deploymentType !== 'cloud';

    // ── تثبيت الخدمات ──────────────────────────────────────────────────────
    if (needsBackend) {
      const serverScript = path.join(installDir, 'server-app', 'dist', 'index.mjs');
      this.install(
        'OneSoft-Server', nodePath,
        [serverScript],
        path.join(logsDir, 'server.log'),
        emit,
      );
    }

    if (needsFrontend) {
      const clientScript = path.join(installDir, 'client-app', 'dist-serve', 'server.js');
      this.install(
        'OneSoft-Client', nodePath,
        [clientScript],
        path.join(logsDir, 'client.log'),
        emit,
      );
    }

    if (needsUpdater) {
      const updaterScript = path.join(installDir, 'installer', 'core', 'updater.js');
      if (fs.existsSync(updaterScript)) {
        this.install(
          'OneSoft-Updater', nodePath,
          [updaterScript],
          path.join(logsDir, 'updater.log'),
          emit,
        );
      }
    }

    // ── تشغيل الخدمات بالترتيب الصحيح مع انتظار حقيقي ────────────────────
    emit({ level: 'info', message: 'جارٍ تشغيل الخدمات...', timestamp: now() });

    if (needsBackend) {
      emit({ level: 'info', message: 'تشغيل OneSoft-Server (Backend)...', timestamp: now() });
      this.start('OneSoft-Server');

      // انتظر حتى يستجيب Backend على المنفذ 3000 (مهلة 90 ثانية)
      const backendReady = await this.waitForPort(3000, emit, 90_000);
      if (!backendReady) {
        emit({ level: 'warning', message: '⚠️ Backend لم يبدأ في الوقت المحدد — قد تحتاج لإعادة تشغيل الخدمة يدوياً', timestamp: now() });
      }
    }

    if (needsFrontend) {
      emit({ level: 'info', message: 'تشغيل OneSoft-Client (Frontend)...', timestamp: now() });
      this.start('OneSoft-Client');

      // انتظر حتى يستجيب Frontend على المنفذ 5000 (مهلة 60 ثانية)
      const frontendReady = await this.waitForPort(5000, emit, 60_000);
      if (!frontendReady) {
        emit({ level: 'warning', message: '⚠️ Frontend لم يبدأ في الوقت المحدد — قد تحتاج لإعادة تشغيل الخدمة يدوياً', timestamp: now() });
      }
    }

    emit({ level: 'success', message: '✅ اكتمل تشغيل الخدمات', timestamp: now() });
  }

  // ─── Private ───────────────────────────────────────────────────────────────
  private _sc(action: 'start' | 'stop', name: ServiceName): ServiceOperationResult {
    if (process.platform !== 'win32') return { success: true };
    try {
      exec('sc', [action, name]);
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

function exec(cmd: string, args: string[]): string {
  return execSync(`"${cmd}" ${args.map(a => `"${a}"`).join(' ')}`, {
    encoding: 'utf-8', stdio: 'pipe',
  });
}

function findNode(): string {
  try {
    return execSync('where node', { encoding: 'utf-8' }).trim().split('\n')[0] || 'node';
  } catch {
    return process.execPath;
  }
}

function now() { return new Date().toISOString(); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
