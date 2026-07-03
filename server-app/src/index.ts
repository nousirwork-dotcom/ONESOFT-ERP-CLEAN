import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { ENV } from './env.js';
import { logger } from './logger.js';
import { createContext } from './trpc.js';
import { appRouter } from './routers/index.js';
import { loginHandler, logoutHandler, meHandler } from './auth.js';
import { pool } from './db.js';
import { checkSchema } from './check-schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/auth/login', loginHandler);
app.post('/api/auth/logout', logoutHandler);
app.get('/api/auth/logout', logoutHandler);
app.get('/api/auth/me', meHandler);

// ─── Auto-Login (Electron / dev only — DISABLED in production) ───────────────
// Only available when:  NODE_ENV !== 'production'  AND  ELECTRON_MODE=1
// AND the request originates from localhost (127.0.0.1 or ::1).
app.post('/api/auth/auto-login', async (req, res) => {
  const isElectronDev = ENV.isElectron && ENV.nodeEnv !== 'production';
  const isLocalhost   = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');

  if (!isElectronDev || !isLocalhost) {
    return res.status(403).json({ error: 'هذا المسار غير متاح في وضع الإنتاج' });
  }

  try {
    const { db } = await import('./db.js');
    const { users } = await import('./schema.js');
    const { eq } = await import('drizzle-orm');
    const { createToken } = await import('./auth.js');
    const user = await db.query.users.findFirst({ where: eq(users.id, 1) });
    if (!user) return res.status(404).json({ error: 'لا يوجد مستخدم افتراضي' });
    const token = await createToken({ userId: user.id, orgId: user.orgId, username: user.username, role: user.role });
    res.cookie(ENV.cookieName, token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: ENV.sessionExpiry });
    return res.json({ success: true, user: { id: user.id, name: user.name, username: user.username, role: user.role, orgId: user.orgId } });
  } catch (err) {
    console.error('[AutoLogin]', err);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});
app.get('/api/health', (_req, res) => res.json({
  status:    'ok',
  version:   '1.0.0',
  env:       ENV.nodeEnv,
  port:      ENV.port,
  electron:  ENV.isElectron,
  ts:        new Date().toISOString(),
}));

// ─── System/Services Status (requires authenticated admin/superadmin session) ──
app.get('/api/system/status', async (req, res) => {
  const { getUserFromRequest } = await import('./auth.js');
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });

  const adminRoles = ['admin', 'superadmin'];
  if (!adminRoles.includes(user.role)) {
    return res.status(403).json({ error: 'هذه الصفحة متاحة للمسؤولين فقط' });
  }

  const configPath = process.platform === 'win32'
    ? 'C:\\ProgramData\\OneSoft\\config\\onesoft.config.json'
    : path.join(process.env['HOME'] ?? '/tmp', '.onesoft', 'config', 'onesoft.config.json');

  let config: Record<string, unknown> | null = null;
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    }
  } catch { /* ignore */ }

  const svcStatus = (name: string): string => {
    if (process.platform !== 'win32') return 'n/a';
    try {
      const r = spawnSync('sc', ['query', name], { encoding: 'utf-8', stdio: 'pipe' });
      const out = String(r.stdout ?? '');
      if (out.includes('RUNNING'))       return 'running';
      if (out.includes('STOPPED'))       return 'stopped';
      if (out.includes('START_PENDING')) return 'starting';
      if (out.includes('1060') || String(r.stderr ?? '').includes('1060')) return 'not-installed';
      return 'unknown';
    } catch { return 'unknown'; }
  };

  const db    = config?.['database'] as Record<string, unknown> | undefined;
  const srv   = config?.['server']   as Record<string, unknown> | undefined;
  const paths = config?.['paths']    as Record<string, unknown> | undefined;

  return res.json({
    backendPort:    ENV.port,
    frontendPort:   Number(srv?.['frontendPort'] ?? 5000),
    backendStatus:  svcStatus('OneSoft-Server'),
    frontendStatus: svcStatus('OneSoft-Client'),
    dbHost:         db ? String(db['host'] ?? 'localhost') : 'localhost',
    dbPort:         db ? Number(db['port']  ?? 5432)       : 5432,
    dbName:         db ? String(db['name']  ?? 'onesoft_erp') : 'onesoft_erp',
    dbUser:         db ? String(db['user']  ?? 'onesoft_app') : 'onesoft_app',
    logPath:        String(paths?.['logs'] ?? 'C:\\ProgramData\\OneSoft\\Logs'),
    configPath,
    configFound:    config !== null,
    platform:       process.platform,
    nodeVersion:    process.version,
    uptime:         Math.floor(process.uptime()),
  });
});

// ─── Restart Windows Service (requires superadmin session + same-origin) ───────
app.post('/api/system/restart-service', async (req, res) => {
  // Auth check — superadmin only
  const { getUserFromRequest } = await import('./auth.js');
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'يجب تسجيل الدخول أولاً' });
  if (user.role !== 'superadmin') {
    return res.status(403).json({ ok: false, error: 'هذه العملية متاحة للمسؤول الأعلى فقط' });
  }

  // Origin guard — strict same-origin check
  const origin = req.headers['origin'] ?? '';
  const host   = req.headers['host']   ?? '';
  // Compare full scheme+host (strip trailing port from both sides before compare)
  const normalizeOrigin = (o: string) => o.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
  const normalizeHost   = (h: string) => h.replace(/:\d+$/, '');
  if (origin && normalizeOrigin(origin) !== normalizeHost(host)) {
    return res.status(403).json({ ok: false, error: 'طلب مرفوض — مصدر غير مسموح' });
  }

  if (process.platform !== 'win32') {
    return res.json({ ok: true, message: 'Linux — لا توجد خدمات Windows' });
  }

  const { name } = req.body as { name?: string };
  const allowed  = ['OneSoft-Server', 'OneSoft-Client'];
  if (!name || !allowed.includes(name)) {
    return res.status(400).json({ ok: false, error: 'اسم خدمة غير مسموح' });
  }

  try {
    spawnSync('sc', ['stop', name],  { encoding: 'utf-8', stdio: 'pipe' });
    await new Promise(r => setTimeout(r, 2500));
    spawnSync('sc', ['start', name], { encoding: 'utf-8', stdio: 'pipe' });
    return res.json({ ok: true, message: `تمّت إعادة تشغيل ${name}` });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// ─── Backup Download (requires superadmin session) ────────────────────────────
app.get('/download/backup', async (req, res) => {
  const { getUserFromRequest } = await import('./auth.js');
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
  if (user.role !== 'superadmin') {
    return res.status(403).json({ error: 'تنزيل النسخة الاحتياطية متاح للمسؤول الأعلى فقط' });
  }
  const file = path.join(__dirname, '..', '..', 'OneSoft-ERP-backup-20260626.zip');
  console.log(`[Backup] Download requested by superadmin: ${user.username} (id=${user.id})`);
  res.download(file, 'OneSoft-ERP-backup-20260626.zip', (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'الملف غير موجود' });
  });
});

// ─── tRPC ─────────────────────────────────────────────────────────────────────
app.use('/api/trpc', createExpressMiddleware({
  router: appRouter,
  createContext: ({ req, res }) => createContext({ req, res }),
}));

// ─── Static Files (React Build - Production Only) ─────────────────────────────
import { existsSync } from 'fs';
const clientBuildPath = path.join(__dirname, '..', '..', 'client-app', 'dist');
if (existsSync(path.join(clientBuildPath, 'index.html'))) {
  app.use(express.static(clientBuildPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  // Development: redirect non-API requests to Vite dev server
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  app.get('*', (req, res) => {
    if (devDomain) {
      res.redirect(`https://${devDomain}:5000${req.path}`);
    } else {
      res.redirect(`http://localhost:5000${req.path}`);
    }
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
const schemaOk = await checkSchema(pool);
if (!schemaOk) {
  console.error('[startup] Aborting: database schema is out of date or unreachable.');
  process.exit(1);
}

app.listen(ENV.port, () => {
  logger.info('server', `OneSoft ERP started on http://localhost:${ENV.port}`, {
    env: ENV.nodeEnv, electron: ENV.isElectron,
  });
});

export type { AppRouter } from './routers/index.js';
