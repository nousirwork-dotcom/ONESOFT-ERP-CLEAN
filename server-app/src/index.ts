import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import path from 'path';
import { fileURLToPath } from 'url';
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

// ─── Auto-Login (dev / single-user mode) ─────────────────────────────────────
app.post('/api/auth/auto-login', async (_req, res) => {
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

// ─── Backup Download (requires superadmin session) ────────────────────────────
app.get('/download/backup', async (req, res) => {
  const { getUserFromRequest } = await import('./auth.js');
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
  const file = path.join(__dirname, '..', '..', 'OneSoft-ERP-backup-20260626.zip');
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
