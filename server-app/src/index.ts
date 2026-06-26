import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ENV } from './env.js';
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
app.get('/api/auth/me', meHandler);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// ─── Backup Download ───────────────────────────────────────────────────────────
app.get('/download/backup', (_req, res) => {
  const file = path.join(__dirname, '..', '..', '..', 'OneSoft-ERP-src-20260626.zip');
  res.download(file, 'OneSoft-ERP-src-20260626.zip');
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
  console.log(`Server running on http://localhost:${ENV.port}`);
});

export type { AppRouter } from './routers/index.js';
