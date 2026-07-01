import { useState, useEffect, useRef } from 'react';
import { useInstallerStore } from '../store/installer.store';
import type { ProgressEvent } from '../../core/types';

const LEVEL_COLOR: Record<string, string> = {
  info: '#374151', success: '#15803D', warning: '#D97706',
  error: '#B91C1C', warn: '#D97706',
};
const LEVEL_BG: Record<string, string> = {
  info: '#F9FAFB', success: '#F0FDF4', warning: '#FFF7ED',
  error: '#FEF2F2', warn: '#FFF7ED',
};

export default function Step08Services() {
  const store = useInstallerStore();
  const { progressLog, nextStep, dbOpts, organization, firstUser,
          runMode, setOrgId, setOrgCode, getDatabaseUrl, clearProgress } = store;

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [progressLog.length]);

  const run = async () => {
    clearProgress();
    setRunning(true);
    setError(null);

    try {
      const databaseUrl = getDatabaseUrl();
      const adminOpts = { host: dbOpts.host, port: dbOpts.port, database: 'postgres', user: dbOpts.user, password: dbOpts.password };

      // 1. إنشاء مجلدات النظام
      const paths = buildPaths();
      await window.installer?.createDirectories?.(paths);

      // 2. إنشاء قاعدة البيانات
      await window.installer?.createDatabase?.({
        adminOpts, dbName: dbOpts.database,
        appUser: 'onesoft_app', appPassword: dbOpts.password,
      });

      // 3. تشغيل Migrations
      await window.installer?.runMigrations?.(databaseUrl);

      // 4. إنشاء المؤسسة
      const orgResult = await window.installer?.createOrganization?.({
        databaseUrl, org: organization,
      });
      if (orgResult?.id) {
        setOrgId(orgResult.id);
        setOrgCode(orgResult.code);
      }

      // 5. إنشاء المستخدم
      if (orgResult?.id) {
        await window.installer?.createUser?.({
          databaseUrl, orgId: orgResult.id, user: firstUser,
        });
      }

      // 6. تثبيت شجرة الحسابات
      await window.installer?.seedAccounts?.(databaseUrl);

      // 7. تثبيت وتشغيل الخدمات
      const installDir = 'C:\\Program Files\\OneSoft ERP';
      await window.installer?.installServices?.({
        installDir,
        logsDir: paths.logs,
        runMode,
      });

      // 8. إنشاء الاختصارات
      await window.installer?.createShortcuts?.({
        installDir,
        appExe: `${installDir}\\OneSoft ERP.exe`,
        iconPath: `${installDir}\\resources\\icons\\onesoft.ico`,
      });

      // 9. كتابة Registry — يظهر في إضافة/إزالة البرامج
      await (window as any).installer?.writeRegistry?.({
        installDir,
        version: '1.0.0',
        uninstallExe: `${installDir}\\OneSoft ERP Setup.exe`,
        iconPath: `${installDir}\\resources\\icons\\onesoft.ico`,
        sizeKB: 150000,
      });

      // 10. حفظ الإعدادات
      await window.installer?.saveConfig?.({
        version: '1.0.0',
        installMode: store.installMode,
        runMode,
        database: { host: dbOpts.host, port: dbOpts.port, name: dbOpts.database, user: 'onesoft_app', password: dbOpts.password, poolMin: 2, poolMax: 10 },
        server: { backendPort: 3000, frontendPort: 5000, host: '0.0.0.0', allowedOrigins: ['localhost'] },
        paths,
      });

      // 11. تسجيل النسخة — لاكتشافها عند الترقية لاحقاً
      await (window as any).installer?.markInstalled?.({
        version: '1.0.0',
        installDir,
      });

      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => { run(); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
            🚀 جارٍ التثبيت...
          </h2>
          <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
            يرجى الانتظار — لا تغلق النافذة
          </p>
        </div>
        {running && <div style={{ width: 24, height: 24, border: '3px solid #E5E0D8', borderTopColor: '#406B93', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
        {done && <span style={{ fontSize: 28 }}>✅</span>}
        {error && <span style={{ fontSize: 28 }}>❌</span>}
      </div>

      {/* Progress Log */}
      <div ref={logRef} style={{
        flex: 1, overflowY: 'auto', background: '#1E1E2E',
        borderRadius: 10, padding: '12px 14px', maxHeight: 320,
        fontFamily: "'Courier New', monospace", fontSize: 12,
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>
        {progressLog.length === 0 && (
          <div style={{ color: '#6B7280' }}>⏳ جارٍ البدء...</div>
        )}
        {progressLog.map((e: ProgressEvent, i) => (
          <div key={i} style={{
            color: LEVEL_COLOR[e.level] ?? '#D1D5DB',
            padding: '2px 6px', borderRadius: 4,
            background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
          }}>
            <span style={{ color: '#4B5563', marginLeft: 8, fontSize: 10 }}>
              {new Date(e.timestamp).toLocaleTimeString('ar-SA')}
            </span>
            {' '}{e.level === 'success' ? '✅' : e.level === 'error' ? '❌' : e.level === 'warning' ? '⚠️' : 'ℹ️'}
            {' '}{e.message}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 12, color: '#B91C1C' }}>
          ❌ {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        {error && <button onClick={run} style={btnSecondary}>🔄 إعادة المحاولة</button>}
        <button onClick={nextStep} disabled={!done} style={{
          ...btnPrimary, opacity: done ? 1 : 0.4,
          cursor: done ? 'pointer' : 'not-allowed',
        }}>
          التالي — فحص الصحة ▶
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function buildPaths() {
  const base = 'C:\\ProgramData\\OneSoft';
  return {
    data: `${base}\\Data`, backups: `${base}\\Backups`, logs: `${base}\\Logs`,
    temp: `${base}\\Temp`, updates: `${base}\\Updates`,
    attachments: `${base}\\Attachments`, exports: `${base}\\Exports`,
  };
}

const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #406B93, #2d5070)', color: '#fff',
  border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 13,
  fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
};
const btnSecondary: React.CSSProperties = {
  background: '#fff', color: '#6B7280', border: '1px solid #D1D5DB',
  borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};
