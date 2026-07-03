/**
 * env.ts — تحميل الإعدادات
 * الأولوية:
 *   1. C:\ProgramData\OneSoft\config\onesoft.config.json  (أعلى أولوية — مثبّت على Windows)
 *   2. متغيرات البيئة الخاصة بالخدمة (nssm AppEnvironmentExtra)
 *   3. ملف .env (للتطوير المحلي)
 *   4. قيم افتراضية
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ─── قراءة config.json (أعلى أولوية) ────────────────────────────────────────
function loadFromConfigFile(): { dbUrl?: string; port?: number } {
  const candidates: string[] = [
    process.env['ONESOFT_CONFIG'] ?? '',
    process.platform === 'win32'
      ? 'C:\\ProgramData\\OneSoft\\config\\onesoft.config.json'
      : path.join(process.env['HOME'] ?? '/tmp', '.onesoft', 'config', 'onesoft.config.json'),
  ].filter(Boolean);

  for (const configPath of candidates) {
    if (!fs.existsSync(configPath)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
      const db  = raw['database'] as Record<string, unknown> | undefined;
      const srv = raw['server']   as Record<string, unknown> | undefined;
      if (!db?.['user'] || !db?.['host']) continue;

      const user     = String(db['user']);
      const password = String(db['password'] ?? '');
      const host     = String(db['host']);
      const pgPort   = Number(db['port']     ?? 5432);
      const name     = String(db['name']     ?? 'onesoft_erp');
      const backPort = Number(srv?.['backendPort'] ?? 3000);

      const dbUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${pgPort}/${name}`;

      console.log(`[OneSoft] OneSoft-Server environment loaded from: ${configPath}`);
      console.log(`[OneSoft] DB_HOST=${host} DB_PORT=${pgPort} DB_NAME=${name} DB_USER=${user} DB_PASSWORD=***hidden*** CONFIG_SOURCE=${configPath}`);

      return { dbUrl, port: backPort };
    } catch (e) {
      console.warn(`[OneSoft] فشل قراءة ${configPath}:`, e);
    }
  }
  return {};
}

const _cfg = loadFromConfigFile();

// ─── تحذير إذا كنا على Windows ولم نجد ملف الإعدادات ─────────────────────────
if (process.platform === 'win32' && !_cfg.dbUrl && !process.env['DATABASE_URL']) {
  const expectedPath = 'C:\\ProgramData\\OneSoft\\config\\onesoft.config.json';
  console.error('╔══════════════════════════════════════════════════════════════╗');
  console.error('║  [OneSoft] تحذير: لم يتم العثور على ملف الإعدادات!         ║');
  console.error(`║  المسار المتوقع: ${expectedPath}`);
  console.error('║  سيستخدم الخادم بيانات اتصال افتراضية (postgres:postgres)   ║');
  console.error('║  إذا فشل الاتصال: تحقق من وجود الملف وأعد تشغيل الخدمة    ║');
  console.error('╚══════════════════════════════════════════════════════════════╝');
}

export const ENV = {
  port:          _cfg.port ?? parseInt(process.env['PORT'] ?? '3000'),
  nodeEnv:       process.env['NODE_ENV']      ?? 'development',
  dbUrl:         _cfg.dbUrl ?? process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/onesoft_erp',
  dbType:        process.env['DB_TYPE']       ?? 'postgresql',
  jwtSecret:     process.env['JWT_SECRET']    ?? 'onesoft-erp-secret-2024',
  backupDir:     process.env['BACKUP_DIR']    ?? '',
  logDir:        process.env['LOG_DIR']       ?? '',
  isElectron:    process.env['ELECTRON_MODE'] === '1',
  cookieName:    'onesoft_session',
  sessionExpiry: 30 * 24 * 60 * 60 * 1000,
};
