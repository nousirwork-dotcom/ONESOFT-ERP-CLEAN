import { execSync, spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type { ServiceName, ServiceStatus, ServiceInfo, ServiceOperationResult, ProgressEvent, DeploymentType, AccessMode } from '../types.js';

type Emit = (e: ProgressEvent) => void;

// NSSM مُضمَّن في resources/bin/nssm.exe
// process.resourcesPath متاح فقط في Electron — نصل إليه بشكل آمن لتجنب TS2352
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
  return 'nssm'; // fallback — يُفترض وجوده في PATH
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
      // إزالة الخدمة القديمة إذا كانت موجودة
      const existing = this.getStatus(name);
      if (existing !== 'not-installed') {
        this.remove(name);
      }

      // تسجيل الخدمة
      exec(this.nssm, ['install', name, executablePath, ...args]);
      exec(this.nssm, ['set', name, 'AppDirectory', path.dirname(executablePath)]);
      exec(this.nssm, ['set', name, 'Start', 'SERVICE_AUTO_START']);
      exec(this.nssm, ['set', name, 'AppStdout', logPath]);
      exec(this.nssm, ['set', name, 'AppStderr', logPath]);
      exec(this.nssm, ['set', name, 'AppRotateFiles', '1']);
      exec(this.nssm, ['set', name, 'AppRotateBytes', '10485760']); // 10MB

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

  // ─── تثبيت جميع خدمات النظام ───────────────────────────────────────────────
  // يُحدَّد ما يُثبَّت بناءً على DeploymentType + AccessModes
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

    // OneSoft-Server (Backend) — يعمل فقط إذا كان على هذا الجهاز DB + Backend
    if (needsBackend) {
      const serverScript = path.join(installDir, 'server-app', 'dist', 'index.mjs');
      this.install(
        'OneSoft-Server', nodePath,
        [serverScript],
        path.join(logsDir, 'server.log'),
        emit,
      );
    }

    // OneSoft-Client (Frontend) — يعمل إذا كان هناك واجهة محلية
    if (needsFrontend) {
      const clientScript = path.join(installDir, 'client-app', 'dist-serve', 'server.js');
      this.install(
        'OneSoft-Client', nodePath,
        [clientScript],
        path.join(logsDir, 'client.log'),
        emit,
      );
    }

    // OneSoft-Updater — يعمل في كل الأوضاع ما عدا cloud
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

    // تشغيل الخدمات بالترتيب الصحيح
    emit({ level: 'info', message: 'جارٍ تشغيل الخدمات...', timestamp: now() });

    if (needsBackend) {
      this.start('OneSoft-Server');
    }

    if (needsFrontend) {
      await sleep(2000); // انتظر Server يبدأ أولاً
      this.start('OneSoft-Client');
    }

    emit({ level: 'success', message: 'تم تشغيل جميع الخدمات', timestamp: now() });
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
    return process.execPath; // مسار Node.js الحالي
  }
}

function now() { return new Date().toISOString(); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
