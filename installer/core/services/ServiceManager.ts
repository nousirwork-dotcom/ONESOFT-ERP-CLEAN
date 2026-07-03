import { execSync, spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import type {
  ServiceName, ServiceStatus, ServiceOperationResult,
  ProgressEvent, DeploymentType, AccessMode,
} from '../types.js';

export interface ServiceDiagnostics {
  timestamp: string;
  isAdmin: boolean;
  nodeVersion: string;
  nodePath: string;
  nssmPath: string;
  nssmVersion: string;
  resourcesPath: string;
  installDir: string;
  backendScript: string;
  frontendScript: string;
  backendExists: boolean;
  frontendExists: boolean;
  backendTest: { ok: boolean; timedOut: boolean; stdout: string; stderr: string; exitCode: number | null };
  frontendTest: { ok: boolean; timedOut: boolean; stdout: string; stderr: string; exitCode: number | null };
  nssmBackendInstall: { cmd: string; stdout: string; stderr: string; exitCode: number } | null;
  nssmFrontendInstall: { cmd: string; stdout: string; stderr: string; exitCode: number } | null;
  serviceBackendStatus: string;
  serviceFrontendStatus: string;
  port3000: boolean;
  port5000: boolean;
  logPath: string;
}

type Emit = (e: ProgressEvent) => void;

// ─── أدوات مساعدة ────────────────────────────────────────────────────────────

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

function findNode(): string {
  try {
    const r = spawnSync('where', ['node'], { encoding: 'utf-8', stdio: 'pipe' });
    const lines = (r.stdout ?? '').trim().split('\n').map(l => l.trim()).filter(Boolean);
    return lines[0] ?? process.execPath;
  } catch {
    return process.execPath;
  }
}

/** تنفيذ أمر مع تسجيل الأمر كاملاً + stdout + stderr + exitCode */
function execVerbose(
  cmd: string, args: string[], emit: Emit, label: string,
): { ok: boolean; stdout: string; stderr: string; exitCode: number; cmdStr: string } {
  const cmdStr = `"${cmd}" ${args.map(a => `"${a}"`).join(' ')}`;
  emit({ level: 'info', message: `🔧 [${label}] الأمر الكامل:\n  ${cmdStr}`, timestamp: now() });

  const result = spawnSync(cmd, args, { encoding: 'utf-8', stdio: 'pipe', windowsHide: true });
  const stdout   = (result.stdout  ?? '').trim();
  const stderr   = (result.stderr  ?? '').trim();
  const exitCode = result.status ?? -1;

  if (stdout) emit({ level: 'info',    message: `📤 stdout:\n${stdout.slice(0, 800)}`,   timestamp: now() });
  if (stderr) emit({ level: exitCode !== 0 ? 'error' : 'warning',
                     message: `📥 stderr:\n${stderr.slice(0, 800)}`,   timestamp: now() });

  emit({
    level: exitCode === 0 ? 'success' : 'error',
    message: `↩ exit code: ${exitCode}`,
    timestamp: now(),
  });

  return { ok: exitCode === 0, stdout, stderr, exitCode, cmdStr };
}

/** هل يعمل البرنامج بصلاحيات Administrator؟ */
function isAdmin(): boolean {
  if (process.platform !== 'win32') return true;
  try {
    const r = spawnSync('net', ['session'], { encoding: 'utf-8', stdio: 'pipe' });
    return (r.status ?? 1) === 0;
  } catch {
    return false;
  }
}

/** اختبار تشغيل السكريبت لمدة 5 ثوانٍ — إذا لم يتعطل = جيد */
function testScript(
  nodePath: string, scriptPath: string, emit: Emit, label: string,
): { ok: boolean; timedOut: boolean; stdout: string; stderr: string; exitCode: number | null } {
  const cmdStr = `"${nodePath}" "${scriptPath}"`;
  emit({ level: 'info', message: `🧪 اختبار ${label} (مهلة 5s):\n  ${cmdStr}`, timestamp: now() });

  // PORT مؤقت لتجنب التعارض مع الخدمات الفعلية
  // NODE_ENV=production: يجبر Backend على قراءة config.json فقط (لا DATABASE_URL)
  // DATABASE_URL مفرغة: تمنع استخدام أي قيمة مورثة خاطئة من بيئة المثبت
  const result = spawnSync(nodePath, [scriptPath], {
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: 5000,
    windowsHide: true,
    env: {
      ...process.env,
      PORT:          '19999',
      FRONTEND_PORT: '19998',
      NODE_ENV:      'production',
      DATABASE_URL:  '',           // إلغاء أي قيمة مورثة — config.json هو المصدر الوحيد
    },
  });

  const stdout   = (result.stdout ?? '').trim();
  const stderr   = (result.stderr ?? '').trim();
  const exitCode = result.status;
  const timedOut = result.signal === 'SIGTERM' || result.signal === 'SIGKILL' || exitCode === null;

  if (stdout) emit({ level: 'info',    message: `stdout (5s):\n${stdout.slice(0, 400)}`, timestamp: now() });
  if (stderr) emit({ level: 'warning', message: `stderr (5s):\n${stderr.slice(0, 400)}`, timestamp: now() });

  if (timedOut) {
    emit({ level: 'success', message: `✅ ${label} يعمل — أُوقف بعد 5s دون تعطل`, timestamp: now() });
    return { ok: true, timedOut: true, stdout, stderr, exitCode: null };
  }

  if (exitCode !== null && exitCode !== 0) {
    emit({ level: 'error', message: `❌ ${label} خرج بكود ${exitCode}`, timestamp: now() });
    return { ok: false, timedOut: false, stdout, stderr, exitCode };
  }

  emit({ level: 'warning', message: `⚠️ ${label} خرج بكود 0 خلال 5s (سلوك غير متوقع للسيرفر)`, timestamp: now() });
  return { ok: true, timedOut: false, stdout, stderr, exitCode: 0 };
}

/** انتظار حتى تختفي الخدمة من sc query */
function waitForServiceRemoval(name: string, maxWaitMs = 10_000): void {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const r = spawnSync('sc', ['query', name], { encoding: 'utf-8', stdio: 'pipe' });
    if ((r.stdout ?? '').includes('1060') || (r.status ?? 0) !== 0) return;
    const s = (r.stdout ?? '');
    if (!s.includes('SERVICE_NAME') && !s.includes('RUNNING') && !s.includes('STOPPED')) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
}

/** تحديد مسار السكريبت الحقيقي من قائمة مرشحين */
function resolveScript(candidates: string[], emit: Emit, label: string): string | null {
  for (const p of candidates) {
    const normalized = p.replace(/\\/g, '/');
    emit({ level: 'info', message: `🔍 فحص ${label}: ${normalized}`, timestamp: now() });
    if (fs.existsSync(p)) {
      emit({ level: 'success', message: `✅ وُجد ${label}: ${normalized}`, timestamp: now() });
      return p;
    }
  }
  emit({ level: 'error', message: `❌ لم يُعثر على ${label} في أيٍّ من المسارات`, timestamp: now() });
  return null;
}

function now() { return new Date().toISOString(); }
async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── فحص المنافذ وإيجاد منفذ متاح ───────────────────────────────────────────

/** هل المنفذ مشغول بعملية أخرى؟ */
function isPortBusy(port: number): boolean {
  if (process.platform !== 'win32') {
    try {
      const r = spawnSync('lsof', ['-i', `:${port}`, '-t'], { encoding: 'utf-8', stdio: 'pipe' });
      return (r.stdout ?? '').trim().length > 0;
    } catch { return false; }
  }
  try {
    const r = spawnSync('netstat', ['-ano'], { encoding: 'utf-8', stdio: 'pipe' });
    const lines = (r.stdout ?? '').split('\n');
    return lines.some(l => l.includes(`:${port} `) && (l.includes('LISTENING') || l.includes('ESTABLISHED')));
  } catch { return false; }
}

/** إيجاد منفذ متاح — يجرب المفضّل أولاً ثم البدائل */
function findAvailablePort(preferred: number, alternatives: number[], emit: Emit): number {
  if (!isPortBusy(preferred)) {
    emit({ level: 'success', message: `✅ المنفذ ${preferred} متاح`, timestamp: now() });
    return preferred;
  }

  // اكتشف العملية التي تشغّل المنفذ
  let occupiedBy = '';
  try {
    if (process.platform === 'win32') {
      const r = spawnSync('netstat', ['-ano'], { encoding: 'utf-8', stdio: 'pipe' });
      const line = (r.stdout ?? '').split('\n').find(l => l.includes(`:${preferred} `) && l.includes('LISTENING'));
      if (line) {
        const pid = line.trim().split(/\s+/).pop() ?? '';
        const proc = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf-8', stdio: 'pipe' });
        occupiedBy = (proc.stdout ?? '').trim().split(',')[0]?.replace(/"/g, '') ?? `PID ${pid}`;
      }
    }
  } catch { /* ignore */ }

  const who = occupiedBy ? ` (يستخدمه: ${occupiedBy})` : '';
  emit({ level: 'warning', message: `⚠️ المنفذ ${preferred} مشغول${who} — أبحث عن بديل...`, timestamp: now() });

  for (const alt of alternatives) {
    if (!isPortBusy(alt)) {
      emit({ level: 'success', message: `✅ سيُستخدم المنفذ البديل ${alt}`, timestamp: now() });
      return alt;
    }
    emit({ level: 'info', message: `   المنفذ ${alt} مشغول أيضاً`, timestamp: now() });
  }

  emit({ level: 'error', message: `❌ جميع المنافذ مشغولة — سيُستخدم ${preferred} رغم ذلك`, timestamp: now() });
  return preferred;
}

// ─── ServiceManager ──────────────────────────────────────────────────────────

export class ServiceManager {
  private readonly nssm: string;

  constructor() {
    this.nssm = getNssmPath();
  }

  // ── فحص الحالة ─────────────────────────────────────────────────────────────
  getStatus(name: ServiceName): ServiceStatus {
    if (process.platform !== 'win32') return 'not-installed';
    try {
      const r = spawnSync('sc', ['query', name], { encoding: 'utf-8' });
      const out = r.stdout ?? '';
      if (out.includes('RUNNING'))        return 'running';
      if (out.includes('START_PENDING'))  return 'starting';
      if (out.includes('STOP_PENDING'))   return 'stopping';
      if (out.includes('STOPPED'))        return 'stopped';
      if (out.includes('1060'))           return 'not-installed';
      return 'not-installed';
    } catch { return 'not-installed'; }
  }

  // ── تشغيل / إيقاف / إعادة تشغيل ──────────────────────────────────────────
  start(name: ServiceName): ServiceOperationResult {
    if (process.platform !== 'win32') return { success: true };
    const r = spawnSync('sc', ['start', name], { encoding: 'utf-8', stdio: 'pipe' });
    return { success: (r.status ?? 1) === 0, error: r.stderr?.trim() || undefined };
  }

  stop(name: ServiceName): ServiceOperationResult {
    if (process.platform !== 'win32') return { success: true };
    const r = spawnSync('sc', ['stop', name], { encoding: 'utf-8', stdio: 'pipe' });
    return { success: (r.status ?? 1) === 0, error: r.stderr?.trim() || undefined };
  }

  restart(name: ServiceName): ServiceOperationResult {
    this.stop(name);
    return this.start(name);
  }

  // ── إزالة خدمة مع انتظار الاكتمال ────────────────────────────────────────
  remove(name: ServiceName, emit?: Emit): ServiceOperationResult {
    if (process.platform !== 'win32') return { success: true };
    try {
      const status = this.getStatus(name);
      if (status === 'not-installed') return { success: true };

      emit?.({ level: 'info', message: `🛑 إيقاف ${name} قبل الحذف...`, timestamp: now() });
      spawnSync('sc', ['stop', name], { encoding: 'utf-8', stdio: 'pipe' });
      // انتظار قصير حتى يتوقف
      for (let i = 0; i < 10; i++) {
        if (this.getStatus(name) !== 'running') break;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
      }

      emit?.({ level: 'info', message: `🗑 حذف الخدمة ${name}...`, timestamp: now() });
      const r = spawnSync(this.nssm, ['remove', name, 'confirm'], { encoding: 'utf-8', stdio: 'pipe', windowsHide: true });
      if (r.status !== 0) {
        // NSSM فشل — جرّب sc delete
        spawnSync('sc', ['delete', name], { encoding: 'utf-8', stdio: 'pipe', windowsHide: true });
      }

      // انتظار حتى تختفي الخدمة فعلاً
      waitForServiceRemoval(name);
      emit?.({ level: 'success', message: `✅ تم حذف ${name}`, timestamp: now() });
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // ── تثبيت خدمة واحدة ──────────────────────────────────────────────────────
  installService(
    name: ServiceName,
    nodePath: string,
    scriptPath: string,
    logPath: string,
    emit: Emit,
    envVars?: Record<string, string>,
  ): { ok: boolean; installResult: { cmd: string; stdout: string; stderr: string; exitCode: number } } {
    emit({ level: 'info', message: `\n━━━ تثبيت خدمة ${name} ━━━`, timestamp: now() });
    emit({ level: 'info', message: `  Application:  ${nodePath}`, timestamp: now() });
    emit({ level: 'info', message: `  Script:       ${scriptPath}`, timestamp: now() });
    emit({ level: 'info', message: `  Log:          ${logPath}`, timestamp: now() });

    // حذف أي نسخة قديمة أولاً
    this.remove(name as ServiceName, emit);

    const install = execVerbose(this.nssm, ['install', name, nodePath, scriptPath], emit, `nssm install ${name}`);
    const installResult = { cmd: install.cmdStr, stdout: install.stdout, stderr: install.stderr, exitCode: install.exitCode };

    if (!install.ok) {
      emit({ level: 'error', message: `❌ فشل تثبيت ${name}`, timestamp: now() });
      return { ok: false, installResult };
    }

    // ضبط إعدادات الخدمة
    execVerbose(this.nssm, ['set', name, 'AppDirectory', path.dirname(scriptPath)], emit, 'AppDirectory');
    execVerbose(this.nssm, ['set', name, 'Start',        'SERVICE_AUTO_START'],     emit, 'Start');
    execVerbose(this.nssm, ['set', name, 'AppStdout',    logPath],                  emit, 'AppStdout');
    execVerbose(this.nssm, ['set', name, 'AppStderr',    logPath],                  emit, 'AppStderr');
    execVerbose(this.nssm, ['set', name, 'AppRotateFiles','1'],                     emit, 'AppRotate');
    execVerbose(this.nssm, ['set', name, 'AppRotateBytes','10485760'],              emit, 'AppRotateBytes');

    // ضبط متغيرات البيئة (DATABASE_URL, PORT, ...)
    if (envVars && Object.keys(envVars).length > 0) {
      const envArgs = Object.entries(envVars).map(([k, v]) => `${k}=${v}`);
      emit({ level: 'info', message: `🔑 ضبط متغيرات البيئة: ${Object.keys(envVars).join(', ')}`, timestamp: now() });
      execVerbose(this.nssm, ['set', name, 'AppEnvironmentExtra', ...envArgs], emit, 'AppEnvironmentExtra');
    }

    emit({ level: 'success', message: `✅ تم تثبيت ${name} بنجاح`, timestamp: now() });
    return { ok: true, installResult };
  }

  // ── انتظار حتى يستجيب منفذ HTTP ─────────────────────────────────────────
  async waitForPort(port: number, emit: Emit, timeoutMs = 90_000, pollMs = 3_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    emit({ level: 'info', message: `⏳ انتظار المنفذ ${port}...`, timestamp: now() });

    while (Date.now() < deadline) {
      const ok = await new Promise<boolean>(resolve => {
        const req = http.get(
          { hostname: '127.0.0.1', port, path: '/', timeout: 2_500 },
          res => { res.resume(); resolve(true); },
        );
        req.on('error',   () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
      });

      if (ok) {
        emit({ level: 'success', message: `✅ المنفذ ${port} يستجيب`, timestamp: now() });
        return true;
      }

      const elapsed = Math.round((Date.now() - (deadline - timeoutMs)) / 1000);
      emit({ level: 'info', message: `⏳ المنفذ ${port} لم يستجب بعد (${elapsed}s / ${timeoutMs / 1000}s)`, timestamp: now() });
      await sleep(pollMs);
    }

    emit({ level: 'warning', message: `⚠️ انتهت المهلة — المنفذ ${port} لم يستجب`, timestamp: now() });
    return false;
  }

  // ── التثبيت الكامل ─────────────────────────────────────────────────────────
  async installAll(
    opts: {
      installDir:      string;
      logsDir:         string;
      deploymentType:  DeploymentType;
      accessModes:     AccessMode[];
      resourcesPath?:  string;
      databaseUrl?:    string;
      backendPort?:    number;
      frontendPort?:   number;
    },
    emit: Emit,
  ): Promise<{ backendPort: number; frontendPort: number }> {
    const { installDir, logsDir, deploymentType, accessModes } = opts;
    const rp = opts.resourcesPath ?? electronResourcesPath;

    emit({ level: 'info', message: `\n${'━'.repeat(50)}`, timestamp: now() });
    emit({ level: 'info', message: `📋 بدء تثبيت الخدمات`, timestamp: now() });
    emit({ level: 'info', message: `   resourcesPath: ${rp}`, timestamp: now() });
    emit({ level: 'info', message: `   installDir:    ${installDir}`, timestamp: now() });
    emit({ level: 'info', message: `   deploymentType:${deploymentType}`, timestamp: now() });
    emit({ level: 'info', message: `   accessModes:   ${accessModes.join(', ')}`, timestamp: now() });

    // ── 1. فحص صلاحيات Administrator ──────────────────────────────────────
    const admin = isAdmin();
    emit({
      level: admin ? 'success' : 'error',
      message: admin
        ? '✅ يعمل بصلاحيات Administrator'
        : '❌ يعمل بدون صلاحيات Administrator — تثبيت الخدمات سيفشل! أعد تشغيل المثبت كمسؤول.',
      timestamp: now(),
    });
    if (!admin && process.platform === 'win32') {
      throw new Error('البرنامج لا يعمل بصلاحيات Administrator. أعد تشغيله بالنقر اليمين → تشغيل كمسؤول.');
    }

    // ── 2. إيجاد node.exe ──────────────────────────────────────────────────
    const nodePath = findNode();
    emit({ level: 'info', message: `📍 node.exe: ${nodePath}`, timestamp: now() });

    // ── 3. إيجاد nssm.exe ──────────────────────────────────────────────────
    emit({ level: 'info', message: `📍 nssm.exe: ${this.nssm}`, timestamp: now() });
    const nssmExists = fs.existsSync(this.nssm) || this.nssm === 'nssm';
    if (!nssmExists) {
      emit({ level: 'error', message: `❌ nssm.exe غير موجود في ${this.nssm}`, timestamp: now() });
    }

    const needsBackend  = ['server', 'server+client', 'branch'].includes(deploymentType);
    const needsFrontend = ['server+client', 'branch'].includes(deploymentType)
                       || (deploymentType === 'server' && accessModes.includes('web'));

    // ── 4. تحديد المسارات + فحص وجود الملفات ──────────────────────────────
    let serverScript: string | null = null;
    let clientScript: string | null = null;

    if (needsBackend) {
      serverScript = resolveScript([
        path.join(rp, 'app', 'server-app', 'dist', 'index.mjs'),
        path.join(installDir, 'server-app', 'dist', 'index.mjs'),
        path.join(process.cwd(), 'server-app', 'dist', 'index.mjs'),
      ], emit, 'Backend (index.mjs)');
    }

    if (needsFrontend) {
      clientScript = resolveScript([
        path.join(rp, 'serve-client.js'),
        path.join(rp, 'app', 'client-app', 'dist-serve', 'server.js'),
        path.join(installDir, 'client-app', 'dist-serve', 'server.js'),
      ], emit, 'Frontend (serve-client.js)');
    }

    // ── 5. اختبار تشغيل السكريبت قبل إنشاء الخدمة ─────────────────────────
    if (needsBackend && serverScript) {
      const test = testScript(nodePath, serverScript, emit, 'Backend');
      if (!test.ok) {
        emit({ level: 'error', message: '❌ Backend لا يعمل بشكل صحيح — إلغاء تثبيت الخدمة', timestamp: now() });
        serverScript = null; // لا تثبت الخدمة
      }
    }

    if (needsFrontend && clientScript) {
      const test = testScript(nodePath, clientScript, emit, 'Frontend');
      if (!test.ok) {
        emit({ level: 'error', message: '❌ Frontend لا يعمل بشكل صحيح — إلغاء تثبيت الخدمة', timestamp: now() });
        clientScript = null;
      }
    }

    // ── 6. اختيار المنافذ المتاحة ──────────────────────────────────────────
    emit({ level: 'info', message: `\n━━━ فحص المنافذ ━━━`, timestamp: now() });
    const backendPort  = findAvailablePort(opts.backendPort  ?? 3000, [3001, 3002, 3100, 3200], emit);
    const frontendPort = findAvailablePort(opts.frontendPort ?? 5000, [5001, 5002, 5100, 5200], emit);
    emit({ level: 'info', message: `📌 Backend:  منفذ ${backendPort}`, timestamp: now() });
    emit({ level: 'info', message: `📌 Frontend: منفذ ${frontendPort}`, timestamp: now() });

    // متغيرات البيئة للخدمات
    const backendEnvVars: Record<string, string> = {
      NODE_ENV: 'production',
      PORT:     String(backendPort),
    };
    if (opts.databaseUrl) {
      backendEnvVars['DATABASE_URL'] = opts.databaseUrl;
      emit({ level: 'info', message: `🔑 DATABASE_URL سيُضبط في OneSoft-Server`, timestamp: now() });
    } else {
      emit({ level: 'warning', message: `⚠️ لم يُمرَّر DATABASE_URL — سيستخدم Backend قيمه الافتراضية`, timestamp: now() });
    }

    const frontendEnvVars: Record<string, string> = {
      NODE_ENV:    'production',
      PORT:        String(frontendPort),
      BACKEND_URL: `http://localhost:${backendPort}`,
    };

    // ── 7. تثبيت الخدمات وتسجيل نتيجة nssm كاملة ─────────────────────────
    if (needsBackend) {
      if (serverScript) {
        this.installService(
          'OneSoft-Server', nodePath, serverScript,
          path.join(logsDir, 'server.log'), emit,
          backendEnvVars,
        );
      } else {
        emit({ level: 'warning', message: '⚠️ تخطي OneSoft-Server — السكريبت غير متاح', timestamp: now() });
      }
    }

    if (needsFrontend) {
      if (clientScript) {
        this.installService(
          'OneSoft-Client', nodePath, clientScript,
          path.join(logsDir, 'client.log'), emit,
          frontendEnvVars,
        );
      } else {
        emit({ level: 'warning', message: '⚠️ تخطي OneSoft-Client — السكريبت غير متاح', timestamp: now() });
      }
    }

    // ── 8. تشغيل الخدمات مع انتظار حقيقي ────────────────────────────────
    emit({ level: 'info', message: `\n━━━ تشغيل الخدمات ━━━`, timestamp: now() });

    let backendOk  = false;
    let frontendOk = false;

    if (needsBackend && this.getStatus('OneSoft-Server') !== 'not-installed') {
      emit({ level: 'info', message: `▶ تشغيل OneSoft-Server على المنفذ ${backendPort}...`, timestamp: now() });
      const r = this.start('OneSoft-Server');
      if (!r.success) {
        emit({ level: 'warning', message: `⚠️ تعذّر تشغيل Backend: ${r.error ?? ''}`, timestamp: now() });
      }
      backendOk = await this.waitForPort(backendPort, emit, 90_000);
    } else if (!needsBackend) {
      backendOk = true;
    }

    if (needsFrontend && this.getStatus('OneSoft-Client') !== 'not-installed') {
      emit({ level: 'info', message: `▶ تشغيل OneSoft-Client على المنفذ ${frontendPort}...`, timestamp: now() });
      const r = this.start('OneSoft-Client');
      if (!r.success) {
        emit({ level: 'warning', message: `⚠️ تعذّر تشغيل Frontend: ${r.error ?? ''}`, timestamp: now() });
      }
      frontendOk = await this.waitForPort(frontendPort, emit, 60_000);
    } else if (!needsFrontend) {
      frontendOk = true;
    }

    // ── 9. ملخص النتيجة ───────────────────────────────────────────────────
    emit({ level: 'info', message: `\n${'━'.repeat(50)}`, timestamp: now() });
    if (backendOk && frontendOk) {
      emit({ level: 'success', message: '🎉 جميع الخدمات تعمل بنجاح', timestamp: now() });
    } else {
      const missing = [
        !backendOk  && needsBackend  ? `Backend  (${backendPort})`  : null,
        !frontendOk && needsFrontend ? `Frontend (${frontendPort})` : null,
      ].filter(Boolean).join(', ');
      emit({ level: 'warning', message: `⚠️ بعض الخدمات لم تستجب: ${missing}`, timestamp: now() });
      emit({ level: 'info', message: '💡 ستجد تفاصيل في ProgramData\\OneSoft\\Logs\\', timestamp: now() });
    }

    return { backendPort, frontendPort };
  }

  // ── تشخيص شامل للنظام ──────────────────────────────────────────────────
  async diagnose(
    opts: { installDir: string; resourcesPath: string },
    emit: Emit,
  ): Promise<ServiceDiagnostics> {
    const { installDir, resourcesPath: rp } = opts;
    const logPath = `C:\\ProgramData\\OneSoft\\Logs\\diagnostics-${Date.now()}.txt`;

    emit({ level: 'info', message: '🔬 بدء التشخيص الشامل...', timestamp: now() });

    // إصدار node
    const nodeResult = spawnSync(process.execPath, ['--version'], { encoding: 'utf-8', stdio: 'pipe' });
    const nodeVersion = (nodeResult.stdout ?? '').trim();
    const nodePath    = findNode();

    // إصدار nssm — نتحقق فقط من وجود الملف (بدون تشغيل nssm)
    const nssmVersion = fs.existsSync(this.nssm) ? 'NSSM (موجود)' : 'NSSM (غير موجود)';

    // صلاحيات
    const admin = isAdmin();
    emit({ level: admin ? 'success' : 'error', message: `صلاحيات Admin: ${admin ? 'نعم' : 'لا'}`, timestamp: now() });

    // مسارات السكريبتات
    const backendCandidates = [
      path.join(rp, 'app', 'server-app', 'dist', 'index.mjs'),
      path.join(installDir, 'server-app', 'dist', 'index.mjs'),
    ];
    const frontendCandidates = [
      path.join(rp, 'serve-client.js'),
      path.join(rp, 'app', 'client-app', 'dist-serve', 'server.js'),
      path.join(installDir, 'client-app', 'dist-serve', 'server.js'),
    ];

    const backendScript  = backendCandidates.find(p => fs.existsSync(p))  ?? backendCandidates[0]!;
    const frontendScript = frontendCandidates.find(p => fs.existsSync(p)) ?? frontendCandidates[0]!;
    const backendExists  = fs.existsSync(backendScript);
    const frontendExists = fs.existsSync(frontendScript);

    emit({ level: backendExists  ? 'success' : 'error', message: `Backend:  ${backendScript}  [${backendExists  ? 'موجود' : 'غير موجود'}]`, timestamp: now() });
    emit({ level: frontendExists ? 'success' : 'error', message: `Frontend: ${frontendScript} [${frontendExists ? 'موجود' : 'غير موجود'}]`, timestamp: now() });

    // اختبار تشغيل السكريبتات
    const backendTest  = backendExists  ? testScript(nodePath, backendScript,  emit, 'Backend')  : { ok: false, timedOut: false, stdout: '', stderr: 'الملف غير موجود', exitCode: -1 };
    const frontendTest = frontendExists ? testScript(nodePath, frontendScript, emit, 'Frontend') : { ok: false, timedOut: false, stdout: '', stderr: 'الملف غير موجود', exitCode: -1 };

    // حالة الخدمات
    const serviceBackendStatus  = this.getStatus('OneSoft-Server');
    const serviceFrontendStatus = this.getStatus('OneSoft-Client');
    emit({ level: 'info', message: `OneSoft-Server:  ${serviceBackendStatus}`,  timestamp: now() });
    emit({ level: 'info', message: `OneSoft-Client:  ${serviceFrontendStatus}`, timestamp: now() });

    // قراءة المنافذ الفعلية من config.json (إن وُجد) — تجنّب القيم المضمّنة
    let diagBackendPort  = 3000;
    let diagFrontendPort = 5000;
    try {
      const { ConfigManager } = await import('../config/ConfigManager.js');
      if (ConfigManager.exists()) {
        const cfg = ConfigManager.load();
        diagBackendPort  = cfg.server?.backendPort  ?? 3000;
        diagFrontendPort = cfg.server?.frontendPort ?? 5000;
        emit({ level: 'info', message: `📌 المنافذ من config.json — Backend: ${diagBackendPort}, Frontend: ${diagFrontendPort}`, timestamp: now() });
      }
    } catch { /* ignore — use defaults */ }

    const port3000 = await this.waitForPort(diagBackendPort,  emit, 5_000, 1_000);
    const port5000 = await this.waitForPort(diagFrontendPort, emit, 5_000, 1_000);

    emit({ level: 'success', message: '✅ اكتمل التشخيص', timestamp: now() });

    const report: ServiceDiagnostics = {
      timestamp: now(), isAdmin: admin,
      nodeVersion, nodePath,
      nssmPath: this.nssm, nssmVersion,
      resourcesPath: rp, installDir,
      backendScript, frontendScript,
      backendExists, frontendExists,
      backendTest, frontendTest,
      nssmBackendInstall: null, nssmFrontendInstall: null,
      serviceBackendStatus, serviceFrontendStatus,
      port3000, port5000,
      logPath,
    };

    // كتابة التقرير إلى ملف
    try {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.writeFileSync(logPath, JSON.stringify(report, null, 2), 'utf-8');
      emit({ level: 'success', message: `📄 تقرير التشخيص: ${logPath}`, timestamp: now() });
    } catch { /* ignore */ }

    return report;
  }
}
