/**
 * env.ts — تحميل الإعدادات
 * الأولوية: متغيرات البيئة (من Electron / .env) → قيم افتراضية
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// حمّل .env إذا وُجد (للتطوير المحلي)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const ENV = {
  port:          parseInt(process.env.PORT         || '3737'),
  nodeEnv:       process.env.NODE_ENV              || 'development',
  dbUrl:         process.env.DATABASE_URL          || 'postgresql://postgres:postgres@localhost:5432/onesoft_erp',
  dbType:        process.env.DB_TYPE               || 'postgresql',
  jwtSecret:     process.env.JWT_SECRET            || 'onesoft-erp-secret-2024',
  backupDir:     process.env.BACKUP_DIR            || '',
  logDir:        process.env.LOG_DIR               || '',
  isElectron:    process.env.ELECTRON_MODE         === '1',
  cookieName:    'onesoft_session',
  sessionExpiry: 30 * 24 * 60 * 60 * 1000,
};
