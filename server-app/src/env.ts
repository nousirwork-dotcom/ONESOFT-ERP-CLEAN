/**
 * env.ts — مصدر الإعدادات الوحيد لـ OneSoft
 *
 * في الإنتاج (NODE_ENV=production):
 *   المصدر الوحيد المقبول هو config.json فقط — لا DATABASE_URL لا .env لا قيم افتراضية.
 *   إذا لم يوجد الملف أو كان ناقصاً: يفشل الخادم مع رسالة واضحة.
 *
 * في التطوير:
 *   يجرّب config.json أولاً، ثم DATABASE_URL، ثم .env، ثم قيم افتراضية.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env للتطوير فقط — سيُتجاهَل إذا وُجد config.json
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ── مسار ملف الإعدادات ────────────────────────────────────────────────────────
const CONFIG_PATH: string =
  process.env['ONESOFT_CONFIG'] ??
  (process.platform === 'win32'
    ? 'C:\\ProgramData\\OneSoft\\config\\onesoft.config.json'
    : path.join(process.env['HOME'] ?? '/tmp', '.onesoft', 'config', 'onesoft.config.json'));

// ── بنية نتيجة التحميل ───────────────────────────────────────────────────────
interface ConfigResult {
  dbUrl:         string;
  host:          string;
  pgPort:        number;
  user:          string;
  dbName:        string;
  passwordLen:   number;
  backendPort:   number;
  frontendPort:  number;
  source:        string;
  urlSource:     string;
  configExists:  boolean;
}

// ── تحميل الإعدادات ───────────────────────────────────────────────────────────
function loadConfig(): ConfigResult {
  const isProduction = (process.env['NODE_ENV'] ?? 'development') === 'production';
  const configExists = fs.existsSync(CONFIG_PATH);

  // ── 1. محاولة قراءة config.json ──────────────────────────────────────────
  if (configExists) {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, unknown>;
    } catch (e) {
      const msg = `[OneSoft] ❌ ملف الإعدادات موجود لكن تعذّر قراءته (JSON خاطئ): ${CONFIG_PATH}\n${e}`;
      if (isProduction) {
        console.error(msg);
        process.exit(1);
      }
      console.warn(msg + '\n[OneSoft] الرجوع لإعدادات التطوير...');
      return devFallback(configExists);
    }

    const db  = raw['database'] as Record<string, unknown> | undefined;
    const srv = raw['server']   as Record<string, unknown> | undefined;

    const host       = String(db?.['host']        ?? '');
    const pgPort     = Number(db?.['port']        ?? 5432);
    const dbName     = String(db?.['name']        ?? 'onesoft_erp');
    const user       = String(db?.['user']        ?? '');
    const password   = String(db?.['password']    ?? '');
    const bPort      = Number(srv?.['backendPort']  ?? 3000);
    const fPort      = Number(srv?.['frontendPort'] ?? 5000);

    if (!host || !user) {
      const msg = `[OneSoft] ❌ config.json ناقص: host="${host}" user="${user}" — تحقق من الملف: ${CONFIG_PATH}`;
      if (isProduction) {
        console.error(msg);
        process.exit(1);
      }
      console.warn(msg + '\n[OneSoft] الرجوع لإعدادات التطوير...');
      return devFallback(configExists);
    }

    const dbUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${pgPort}/${dbName}`;

    return {
      dbUrl, host, pgPort, user, dbName,
      passwordLen:  password.length,
      backendPort:  bPort,
      frontendPort: fPort,
      source:       CONFIG_PATH,
      urlSource:    'config.json',
      configExists: true,
    };
  }

  // ── 2. config.json غير موجود ─────────────────────────────────────────────
  if (isProduction) {
    console.error('');
    console.error('╔══════════════════════════════════════════════════════════════════════╗');
    console.error('║  [OneSoft] ❌ FATAL: ملف الإعدادات غير موجود في وضع الإنتاج       ║');
    console.error(`║  المسار المطلوب: ${CONFIG_PATH}`);
    console.error('║  لا يمكن تشغيل الخادم بدون هذا الملف.                              ║');
    console.error('║  الحل: أعد تشغيل المثبّت أو أنشئ الملف يدوياً.                    ║');
    console.error('╚══════════════════════════════════════════════════════════════════════╝');
    console.error('');
    process.exit(1);
  }

  // في التطوير: fallback
  return devFallback(false);
}

function devFallback(configExists: boolean): ConfigResult {
  const urlFromEnv  = process.env['DATABASE_URL'];
  const dbUrl       = urlFromEnv ?? 'postgresql://postgres:postgres@localhost:5432/onesoft_erp';
  const urlSource   = urlFromEnv ? 'DATABASE_URL (env)' : 'built-in default (dev)';

  // استخراج مكوّنات URL للتسجيل
  let host = 'localhost', pgPort = 5432, user = 'postgres', dbName = 'onesoft_erp', passwordLen = 0;
  try {
    const u  = new URL(dbUrl);
    host     = u.hostname;
    pgPort   = Number(u.port) || 5432;
    user     = u.username;
    dbName   = u.pathname.replace('/', '');
    passwordLen = decodeURIComponent(u.password).length;
  } catch { /* ignore */ }

  return {
    dbUrl, host, pgPort, user, dbName, passwordLen,
    backendPort:  parseInt(process.env['PORT'] ?? '3000'),
    frontendPort: 5000,
    source:       configExists ? `${CONFIG_PATH} (قراءة فاشلة)` : `${CONFIG_PATH} (غير موجود)`,
    urlSource,
    configExists,
  };
}

// ── تحميل الإعدادات وطباعة بانر التشخيص ─────────────────────────────────────
const _cfg = loadConfig();

console.log('');
console.log('======== OneSoft Startup ========');
console.log(`Configuration Source : ${_cfg.source}`);
console.log(`Config Exists        : ${_cfg.configExists}`);
console.log(`Database Host        : ${_cfg.host}`);
console.log(`Database Port        : ${_cfg.pgPort}`);
console.log(`Database User        : ${_cfg.user}`);
console.log(`Database Name        : ${_cfg.dbName}`);
console.log(`Password Length      : ${_cfg.passwordLen} chars`);
console.log(`Backend Port         : ${_cfg.backendPort}`);
console.log(`Frontend Port        : ${_cfg.frontendPort}`);
console.log(`DATABASE_URL Source  : ${_cfg.urlSource}`);
console.log('=================================');
console.log('');

// ── تصدير ENV ────────────────────────────────────────────────────────────────
export const ENV = {
  port:          _cfg.backendPort,
  nodeEnv:       process.env['NODE_ENV'] ?? 'development',
  dbUrl:         _cfg.dbUrl,
  dbType:        process.env['DB_TYPE'] ?? 'postgresql',
  jwtSecret:     process.env['JWT_SECRET'] ?? 'onesoft-erp-secret-2024',
  backupDir:     process.env['BACKUP_DIR'] ?? '',
  logDir:        process.env['LOG_DIR']    ?? '',
  isElectron:    process.env['ELECTRON_MODE'] === '1',
  cookieName:    'onesoft_session',
  sessionExpiry: 30 * 24 * 60 * 60 * 1000,
  // معلومات تشخيصية إضافية
  configSource:  _cfg.source,
  configExists:  _cfg.configExists,
  dbUser:        _cfg.user,
  dbHost:        _cfg.host,
  dbName:        _cfg.dbName,
};
