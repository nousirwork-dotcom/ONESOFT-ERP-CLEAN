import './startup-banner.js';  // ← أول import — يطبع بيانات التشخيص قبل أي كود آخر
// [1/6] بانر بدء التشغيل يُطبع داخل startup-banner.js
console.log('[2/6] Loading environment (env.ts + config.json)...');
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
import { loginHandler, logoutHandler, meHandler, getAuthCookieOptions } from './auth.js';
import { pool } from './db.js';
import { checkSchema } from './check-schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── مجلد رفع الملفات ─────────────────────────────────────────────────────────
// أولوية الاختيار:
//   1. UPLOADS_DIR  (تُعيَّنه Electron أو أي wrapper قبل تشغيل الخادم)
//   2. Windows:     C:\ProgramData\OneSoft\uploads   ← لا يُمسح أبداً بالتحديث
//   3. غير Windows: {cwd()}/uploads
//
// لماذا ProgramData وليس AppData أو Program Files؟
//   • Program Files يُستبدَل كاملاً عند تحديث NSIS installer
//   • AppData\Roaming يختلف بين المستخدمين
//   • ProgramData مشترك لكل المستخدمين + يُبقي الـ installer عليه
//   ← نفس المسار المستخدم بالفعل لـ onesoft.config.json
const uploadsDir = process.env.UPLOADS_DIR
  ? process.env.UPLOADS_DIR
  : process.platform === 'win32'
    ? path.join(process.env['PROGRAMDATA'] || 'C:\\ProgramData', 'OneSoft', 'uploads')
    : path.join(process.cwd(), 'uploads');

console.log('[3/6] All modules loaded — creating HTTP app...');
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

// ─── Auto-Login (Electron — localhost only) ──────────────────────────────────
// يعمل في كل وضع (dev + production) طالما:
//   1. الطلب من localhost (127.0.0.1 أو ::1)
//   2. ELECTRON_MODE=1
//   3. المستخدم الأول لديه كلمة مرور فارغة (لم تُعيَّن)
// إذا كان المستخدم قد عيَّن كلمة مرور → يُعاد 403 ويُظهر شاشة الدخول.
app.post('/api/auth/auto-login', async (req, res) => {
  const isLocalhost = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
  const isElectron  = ENV.isElectron;

  // في الإنتاج: auto-login يجب أن يكون الطلب من localhost + Electron
  // في التطوير (Replit preview): نرخّص الـ Electron فقط في production.
  if (ENV.nodeEnv === 'production' && (!isElectron || !isLocalhost)) {
    return res.status(403).json({ error: 'auto-login متاح فقط لتطبيق Electron من localhost' });
  }

  try {
    const { db }        = await import('./db.js');
    const { users }     = await import('./schema.js');
    const { eq }        = await import('drizzle-orm');
    const { createToken } = await import('./auth.js');

    // نجيب أول مستخدم نشط بدور admin أو superadmin
    const user = await db.query.users.findFirst({
      where: eq(users.isActive, true),
      orderBy: (u, { asc }) => [asc(u.id)],
    });
    if (!user) return res.status(404).json({ error: 'لا يوجد مستخدم' });

    // الدخول التلقائي يعمل فقط إذا password_status = 'not_set' (في الإنتاج)
    // في التطوير: نسمح بالدخول التلقائي دائماً لتسهيل الاختبار
    if (ENV.nodeEnv === 'production' && user.passwordStatus !== 'not_set') {
      return res.status(403).json({ error: 'يجب تسجيل الدخول يدوياً' });
    }

    const token = await createToken({ userId: user.id, orgId: user.orgId, username: user.username, role: user.role, sessionVersion: user.sessionVersion ?? 1 });
    res.cookie(ENV.cookieName, token, { ...getAuthCookieOptions(), maxAge: ENV.sessionExpiry });
    return res.json({ success: true, user: { id: user.id, name: user.name, username: user.username, role: user.role, orgId: user.orgId } });
  } catch (err) {
    console.error('[AutoLogin]', err);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Public Branding (no auth — needed before login page renders) ────────────
app.get('/api/public/branding', async (_req, res) => {
  try {
    const { DEFAULT_BRANDING } = await import('./routers/branding.js');
    const { db }               = await import('./db.js');
    const { organizations }    = await import('./schema.js');
    const org = await db.query.organizations.findFirst();
    if (!org) return res.json(DEFAULT_BRANDING);
    const stored = (org.themeSettings ?? {}) as Record<string, unknown>;
    return res.json({ ...DEFAULT_BRANDING, ...stored });
  } catch {
    const { DEFAULT_BRANDING } = await import('./routers/branding.js');
    return res.json(DEFAULT_BRANDING);
  }
});

// ─── Static Uploads (شعارات ومرفقات) ─────────────────────────────────────────
app.use('/uploads', express.static(uploadsDir));

// ─── Logo Upload (يتطلب مصادقة + صلاحية إدارة الهوية) ───────────────────────
app.post('/api/upload/logo', async (req, res) => {
  try {
    const { getUserFromRequest } = await import('./auth.js');
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });

    const perms = (user.extraPermissions ?? {}) as Record<string, boolean>;
    const allowed = ['admin', 'superadmin'].includes(user.role) || perms.manage_branding === true;
    if (!allowed) return res.status(403).json({ error: 'ليس لديك صلاحية إدارة هوية النظام' });

    const { data, mimeType } = req.body as { data?: string; mimeType?: string };
    if (!data || !mimeType) return res.status(400).json({ error: 'data و mimeType مطلوبان' });

    const ext      = (mimeType.split('/')[1] ?? 'png').replace('jpeg', 'jpg');
    const filename = `logo_${user.orgId}.${ext}`;
    const dir      = path.join(uploadsDir, 'branding');

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const base64 = data.replace(/^data:[^;]+;base64,/, '');
    fs.writeFileSync(path.join(dir, filename), Buffer.from(base64, 'base64'));

    return res.json({ url: `/uploads/branding/${filename}` });
  } catch (err) {
    console.error('[UploadLogo]', err);
    return res.status(500).json({ error: 'خطأ أثناء حفظ الشعار' });
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
  const { getUserFromRequest } = await import('./auth.js');
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'يجب تسجيل الدخول أولاً' });
  if (user.role !== 'superadmin') {
    return res.status(403).json({ ok: false, error: 'هذه العملية متاحة للمسؤول الأعلى فقط' });
  }

  const origin = req.headers['origin'] ?? '';
  const host   = req.headers['host']   ?? '';
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
const clientIndexPath = path.join(clientBuildPath, 'index.html');
const clientFilesExist = existsSync(clientIndexPath);
console.log(`[OneSoft] __dirname        = ${__dirname}`);
console.log(`[OneSoft] clientBuildPath  = ${clientBuildPath}`);
console.log(`[OneSoft] index.html found = ${clientFilesExist}`);

if (clientFilesExist) {
  const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
  };

  app.use(express.static(clientBuildPath, {
    index: false, // نتعامل مع index.html يدوياً
    setHeaders: (res, filePath) => {
      const basename = path.basename(filePath);
      // sw.js و manifest.json: لا كاش أبداً
      if (basename === 'sw.js' || basename === 'manifest.json') {
        Object.entries(NO_CACHE_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
        return;
      }
      // أصول مع hash في اسم الملف (assets/name.HASH.js): كاش دائم
      if (filePath.includes(`${path.sep}assets${path.sep}`) && /\.[a-f0-9]{8,}\.(js|css|woff2?|ttf|eot|svg|png|webp|ico)$/i.test(basename)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  // index.html: لا يُخزَّن في الكاش أبداً — يجب دائماً تحميل أحدث نسخة
  app.get('*', (_req, res) => {
    Object.entries(NO_CACHE_HEADERS).forEach(([k, v]) => res.set(k, v));
    res.sendFile(clientIndexPath);
  });
} else {
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  app.get('*', (req, res) => {
    if (devDomain) {
      res.redirect(`https://${devDomain}:5000${req.path}`);
    } else {
      // في الـ production: اعرض صفحة تشخيص بدل إعادة توجيه فارغة
      const diagPage = `<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8">
<style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;
background:#FEF3C7;font-family:system-ui,sans-serif;direction:rtl;}
.box{max-width:600px;padding:32px;background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.1);}
h2{color:#92400E;margin:0 0 16px;}
code{display:block;background:#F3F4F6;padding:8px 12px;border-radius:6px;font-size:12px;margin:4px 0;word-break:break-all;}
</style></head>
<body><div class="box">
<h2>⚠️ ملفات الواجهة غير موجودة</h2>
<p>لم يجد الخادم ملفات React في المسار المتوقع.</p>
<p><b>المسار المتوقع:</b></p>
<code>${clientBuildPath.replace(/</g,'&lt;')}</code>
<p><b>__dirname:</b></p>
<code>${__dirname.replace(/</g,'&lt;')}</code>
<p><b>PORT:</b> ${process.env.PORT || 3000}</p>
<p style="margin-top:16px;color:#6B7280;font-size:12px">
  إذا رأيت هذه الصفحة، أرسل هذه المعلومات للدعم الفني.
</p>
</div></body></html>`;
      res.status(503).send(diagPage);
    }
  });
}

// ─── Start — مع logging تفصيلي لكل مرحلة ────────────────────────────────────
//
// ⚠️ التسلسل الحرج:
//   1. app.listen() يُستدعى أولاً — قبل أي فحص لقاعدة البيانات
//      السبب: فحص الصحة في المثبّت (installer) يفحص port 3000 ويعطيه 90 ثانية فقط.
//      إذا لم يبدأ الاستماع قبل انتهاء المهلة → يظهر خطأ "لا يستجيب" حتى لو المتعطل
//      هو انتظار المخطط وليس الخادم نفسه.
//   2. waitForDatabaseReady() يعمل بعد بدء الاستماع — يستغرق حتى 150 ثانية
//      في أسوأ الحالات (30 محاولة × 5 ثوانٍ). هذا مقبول لأن الخادم يستجيب
//      لـ /api/health طوال هذا الوقت.
//   3. إذا فشل التهيئة بعد كل المحاولات → process.exit(1) → NSSM يعيد التشغيل.

console.log(`[4/6] Starting HTTP server on port ${ENV.port} (DB init will follow)...`);
let _listenRetries = 0;
const _maxListenRetries = 6;

const server = app.listen(ENV.port, () => {
  console.log(`[5/6] ✅ OneSoft ERP listening on http://localhost:${ENV.port}`);
  logger.info('server', `OneSoft ERP HTTP server started on http://localhost:${ENV.port}`, {
    env: ENV.nodeEnv, electron: ENV.isElectron, status: 'db-initializing',
  });
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    _listenRetries++;
    if (_listenRetries <= _maxListenRetries) {
      console.error(`[5/6] ⚠️ المنفذ ${ENV.port} مشغول — إعادة المحاولة خلال 10s (${_listenRetries}/${_maxListenRetries})...`);
      setTimeout(() => {
        server.close();
        server.listen(ENV.port);
      }, 10_000);
    } else {
      console.error(`[5/6] ❌ المنفذ ${ENV.port} مشغول بعد ${_maxListenRetries} محاولات — الخروج.`);
      process.exit(1);
    }
  } else {
    console.error(`[5/6] ❌ خطأ في تشغيل الخادم: ${err.message}`);
    process.exit(1);
  }
});

// ── انتظار جاهزية قاعدة البيانات + إصلاح ذاتي للمخطط ───────────────────────
console.log('[6/6] Connecting to PostgreSQL...');
console.log(`      URL  : ${ENV.dbUrl.replace(/:([^:@]+)@/, ':***@')}`);
console.log(`      User : ${ENV.dbUser}`);
console.log(`      Host : ${ENV.dbHost}`);
console.log(`      DB   : ${ENV.dbName}`);

const MAX_ATTEMPTS   = 30;
const RETRY_DELAY_MS = 5_000;
let autoMigrateTried = false;

async function waitForDatabaseReady(): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ok = await checkSchema(pool);
    if (ok) return true;

    if (!autoMigrateTried) {
      autoMigrateTried = true;
      try {
        await pool.query('SELECT 1');
        console.log('[startup] الجداول غير مكتملة — جارٍ تطبيق auto-migrate...');
        const { autoMigrate } = await import('./auto-migrate.js');
        const result = await autoMigrate(pool);
        if (result.ok) {
          console.log('[startup] ✅ auto-migrate نجح — إعادة فحص المخطط...');
          continue;
        } else {
          console.error(`[startup] ❌ auto-migrate فشل: ${result.error}`);
        }
      } catch {
        // فشل الاتصال أصلاً — الانتظار العادي أدناه سيتكفل بإعادة المحاولة
      }
    }

    console.log(
      `[startup] قاعدة البيانات غير جاهزة بعد (محاولة ${attempt}/${MAX_ATTEMPTS}) — ` +
      `إعادة المحاولة خلال ${RETRY_DELAY_MS / 1000} ثوانٍ...`
    );
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  return false;
}

const schemaOk = await waitForDatabaseReady();
if (!schemaOk) {
  console.error(`[startup] ❌ [6/6] FAILED — تعذّر الاتصال بقاعدة البيانات أو إصلاح المخطط بعد ${MAX_ATTEMPTS} محاولة.`);
  console.error(`          DATABASE_URL source: ${ENV.configSource}`);
  process.exit(1);
}
// ─── تهيئة أول تشغيل ─────────────────────────────────────────────────────────
// على قاعدة بيانات جديدة (جدول المستخدمين فارغ): يُنشئ مؤسسة تجريبية + مستخدم ADMIN
// بكلمة مرور فارغة. على قاعدة موجودة: no-op (لا يمس أي مستخدم أو صلاحية).
try {
  const { ensureDefaultAdmin } = await import('./bootstrap.js');
  await ensureDefaultAdmin();
} catch (err) {
  console.error('[startup] ⚠️ ensureDefaultAdmin error:', err);
}

// ── Foundation Update للعملاء الحاليين ───────────────────────────────────────
// يُضيف السجلات التأسيسية الجديدة فقط (idempotent — لا يُعدّل أو يحذف أي سجل).
try {
  const { runFoundationUpdateForAllOrgs } = await import('./foundation-update.js');
  await runFoundationUpdateForAllOrgs(ENV.dbUrl);
} catch (err) {
  console.error('[startup] ⚠️ foundation-update error:', err);
}

console.log('[6/6] ✅ PostgreSQL connected — schema OK — server fully ready');

// Durable Mock-only ZATCA queue. It is started only after schema validation,
// survives process restarts through PostgreSQL, and never contacts Production.
try {
  const { startZatcaQueueWorker } = await import('./services/zatcaQueue.js');
  startZatcaQueueWorker();
  console.log('[zatca-queue] durable Mock worker started');
} catch (err) {
  console.error('[zatca-queue] worker could not start:', err);
}

export type { AppRouter } from './routers/index.js';
