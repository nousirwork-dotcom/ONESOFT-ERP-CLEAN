import type { IpcMain, BrowserWindow } from 'electron';
import { ServiceManager, ConfigManager } from '../../core/index.js';
import type { ServiceName, DeploymentType, AccessMode } from '../../core/types.js';
import { Pool } from 'pg';

const mgr = new ServiceManager();

export function registerServicesIpc(ipc: IpcMain, win: BrowserWindow | null) {
  const emit = (e: unknown) => win?.webContents.send('installer:progress', e);

  ipc.handle('services:install', async (_, opts: {
    installDir:     string;
    logsDir:        string;
    deploymentType: DeploymentType;
    accessModes:    AccessMode[];
    databaseUrl?:   string;
    backendPort?:   number;
    frontendPort?:  number;
  }) => {
    const result = await mgr.installAll({
      ...opts,
      resourcesPath: process.resourcesPath ?? '',
    }, emit as any);
    return { ok: true, backendPort: result.backendPort, frontendPort: result.frontendPort };
  });

  ipc.handle('services:status',  (_, name: ServiceName) => mgr.getStatus(name));
  ipc.handle('services:start',   (_, name: ServiceName) => mgr.start(name));
  ipc.handle('services:stop',    (_, name: ServiceName) => mgr.stop(name));
  ipc.handle('services:restart', (_, name: ServiceName) => mgr.restart(name));

  // تشخيص شامل للنظام
  ipc.handle('services:diagnose', async () => {
    const installDir = 'C:\\Program Files\\OneSoft ERP';
    return mgr.diagnose(
      { installDir, resourcesPath: process.resourcesPath ?? '' },
      emit as any,
    );
  });

  // ── اختبار تجريبي: التحقق من صحة الإعدادات المحفوظة قبل تثبيت الخدمة ────
  ipc.handle('backend:verify-config', async () => {
    const start = Date.now();
    try {
      if (!ConfigManager.exists()) {
        return {
          ok: false,
          detail: 'ملف الإعدادات غير موجود — يجب حفظ الإعدادات أولاً',
          hint: 'اضغط "حفظ الإعدادات" قبل اختبار الخادم',
          ms: Date.now() - start,
        };
      }

      const cfg = ConfigManager.load();
      const db  = cfg.database;

      if (!db?.user || !db?.host || !db?.password) {
        return {
          ok: false,
          detail: 'بيانات قاعدة البيانات غير مكتملة في ملف الإعدادات',
          hint: `المستخدم: ${db?.user ?? '—'} | المضيف: ${db?.host ?? '—'}`,
          ms: Date.now() - start,
        };
      }

      emit({ level: 'info', message: `اختبار الاتصال بـ ${db.host}:${db.port} كـ "${db.user}"...`, timestamp: new Date().toISOString() });

      const pool = new Pool({
        host: db.host, port: db.port,
        database: db.name, user: db.user, password: db.password,
        connectionTimeoutMillis: 8000, max: 1,
      });

      try {
        const client = await pool.connect();
        const res = await client.query('SELECT current_database() AS db, current_user AS usr, version() AS ver');
        client.release();
        const row = res.rows[0] as { db: string; usr: string; ver: string };
        const ms  = Date.now() - start;
        emit({ level: 'success', message: `✅ الاتصال ناجح — ${row.db} كـ ${row.usr} (${ms}ms)`, timestamp: new Date().toISOString() });
        return {
          ok: true,
          detail: `الإعدادات صحيحة — الاتصال نجح كـ "${db.user}" على "${db.name}" (${ms}ms)`,
          configPath: ConfigManager.getConfigPath(),
          dbUser: db.user, dbHost: db.host, dbPort: db.port, dbName: db.name,
          ms,
        };
      } finally {
        await pool.end().catch(() => {});
      }

    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      const ms  = Date.now() - start;
      emit({ level: 'error', message: `❌ فشل الاختبار: ${raw}`, timestamp: new Date().toISOString() });

      let detail = `فشل الاتصال: ${raw}`;
      let hint   = 'راجع ملف الإعدادات وتأكد من صحة بيانات قاعدة البيانات';

      if (raw.toLowerCase().includes('password authentication failed')) {
        detail = 'كلمة مرور قاعدة البيانات غير صحيحة في ملف الإعدادات';
        hint   = 'تحقق من كلمة المرور في onesoft.config.json وأعد التثبيت إذا لزم';
      } else if (raw.toLowerCase().includes('econnrefused')) {
        detail = 'PostgreSQL غير متاح — تأكد من تشغيل الخدمة';
        hint   = 'ابحث عن "postgresql" في خدمات Windows وتأكد من تشغيلها';
      } else if (raw.toLowerCase().includes('does not exist')) {
        detail = 'قاعدة البيانات أو المستخدم غير موجود';
        hint   = 'أعد تشغيل خطوة إنشاء قاعدة البيانات';
      }

      return { ok: false, detail, hint, rawError: raw, ms };
    }
  });
}
