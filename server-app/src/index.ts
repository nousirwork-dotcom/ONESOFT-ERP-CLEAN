import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ENV } from './env.js';
import { createContext } from './trpc.js';
import { appRouter } from './routers/index.js';
import { loginHandler, logoutHandler, meHandler } from './auth.js';

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
}

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(ENV.port, () => {
  console.log(`Server running on http://localhost:${ENV.port}`);
});

export type { AppRouter } from './routers/index.js';
