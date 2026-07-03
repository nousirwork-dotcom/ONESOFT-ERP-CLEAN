/**
 * env.ts — مصدر الإعدادات الوحيد لـ OneSoft
 *
 * البانر يُطبع دائماً — حتى عند الفشل — لأغراض التشخيص.
 * في الإنتاج: config.json إلزامي. في التطوير: DATABASE_URL ثم defaults.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env للتطوير فقط
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ── مسار ملف الإعدادات ────────────────────────────────────────────────────────
const CONFIG_PATH: string =
  process.env['ONESOFT_CONFIG'] ??
  (process.platform === 'win32'
    ? path.join(process.env['PROGRAMDATA'] ?? process.env['ProgramData'] ?? 'C:\\ProgramData',
                'OneSoft', 'config', 'onesoft.config.json')
    : path.join(process.env['HOME'] ?? '/tmp', '.onesoft', 'config', 'onesoft.config.json'));

// ── بنية نتيجة التحميل ───────────────────────────────────────────────────────
interface ConfigResult {
  dbUrl:        string;
  host:         string;
  pgPort:       number;
  user:         string;
  dbName:       string;
  passwordLen:  number;
  backendPort:  number;
  frontendPort: number;
  source:       string;
  urlSource:    string;
  configExists: boolean;
  fatal?:       string;   // رسالة الفشل إن وُجدت (لطباعتها في البانر)
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
      const fatal = isProduction
        ? `❌ FATAL: config.json موجود لكن JSON خاطئ: ${CONFIG_PATH}\n   ${e}`
        : undefined;
      if (!isProduction) {
        console.warn(`[OneSoft] config.json تعذّر قراءته — الرجوع للإعدادات الافتراضية\n${e}`);
      }
      return { ...devFallback(configExists), fatal };
    }

    const db  = raw['database'] as Record<string, unknown> | undefined;
    const srv = raw['server']   as Record<string, unknown> | undefined;

    const host     = String(db?.['host']       ?? '');
    const pgPort   = Number(db?.['port']       ?? 5432);
    const dbName   = String(db?.['name']       ?? 'onesoft_erp');
    const user     = String(db?.['user']       ?? '');
    const password = String(db?.['password']   ?? '');
    const bPort    = Number(srv?.['backendPort']  ?? 3000);
    const fPort    = Number(srv?.['frontendPort'] ?? 5000);

    if (!host || !user) {
      const fatal = isProduction
        ? `❌ FATAL: config.json ناقص — host="${host}" user="${user}"`
        : undefined;
      if (!isProduction) {
        console.warn(`[OneSoft] config.json ناقص (host/user فارغ) — الرجوع للإعدادات الافتراضية`);
      }
      return { ...devFallback(configExists), fatal };
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
  const fatal = isProduction
    ? `❌ FATAL: config.json غير موجود في وضع الإنتاج — المسار: ${CONFIG_PATH}`
    : undefined;
  return { ...devFallback(false), fatal };
}

function devFallback(configExists: boolean): ConfigResult {
  const urlFromEnv = process.env['DATABASE_URL'];
  const dbUrl      = urlFromEnv ?? 'postgresql://postgres:postgres@localhost:5432/onesoft_erp';
  const urlSource  = urlFromEnv ? 'DATABASE_URL (env)' : 'built-in default (dev)';

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
    source:       configExists ? `${CONFIG_PATH} (فشل قراءة)` : `${CONFIG_PATH} (غير موجود)`,
    urlSource,
    configExists,
  };
}

// ── تحميل الإعدادات ───────────────────────────────────────────────────────────
const _cfg = loadConfig();
const isProduction = (process.env['NODE_ENV'] ?? 'development') === 'production';

// ── البانر التشخيصي — يُطبع دائماً حتى عند الفشل ──────────────────────────
console.log('');
console.log('======== OneSoft Startup ========');
console.log(`NODE_ENV             : ${process.env['NODE_ENV'] ?? '(غير محدد)'}`);
console.log(`Configuration Source : ${_cfg.source}`);
console.log(`Config Exists        : ${_cfg.configExists}`);
console.log(`Database Host        : ${_cfg.host}`);
console.log(`Database Port        : ${_cfg.pgPort}`);
console.log(`Database User        : ${_cfg.user}`);    // ← إذا كان "postgres" فهناك مشكلة!
console.log(`Database Name        : ${_cfg.dbName}`);
console.log(`Password Length      : ${_cfg.passwordLen} chars`);
console.log(`Backend Port         : ${_cfg.backendPort}`);
console.log(`Frontend Port        : ${_cfg.frontendPort}`);
console.log(`DATABASE_URL Source  : ${_cfg.urlSource}`);
if (_cfg.fatal) {
  console.log(`FATAL ERROR          : ${_cfg.fatal}`);
}
console.log('=================================');
console.log('');

// ── إذا كان هناك خطأ حرج في الإنتاج — الفشل بعد طباعة البانر ───────────────
if (_cfg.fatal && isProduction) {
  console.error('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.error(`║  ${_cfg.fatal}`);
  console.error('║  الحل: أعد تشغيل المثبّت أو تحقق من ملف onesoft.config.json        ║');
  console.error('╚══════════════════════════════════════════════════════════════════════╝\n');
  process.exit(1);
}

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
  configSource:  _cfg.source,
  configExists:  _cfg.configExists,
  dbUser:        _cfg.user,
  dbHost:        _cfg.host,
  dbName:        _cfg.dbName,
};
