import { useState, useEffect, useRef } from 'react';
import { useInstallerStore } from '../store/installer.store';
import type { ProgressEvent } from '../../core/types';

type Phase = 'detect' | 'confirm' | 'running' | 'done' | 'failed';

export default function UpgradeWizard() {
  const { dbOpts, getDatabaseUrl } = useInstallerStore();
  const [phase, setPhase] = useState<Phase>('detect');
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [targetVersion, setTargetVersion] = useState('1.0.25');
  const [backendPort, setBackendPort] = useState(3000);
  const [log, setLog] = useState<ProgressEvent[]>([]);
  const [backupDir, setBackupDir] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  useEffect(() => {
    (async () => {
      const [info, config] = await Promise.all([
        window.installer?.detectVersion?.(),
        window.installer?.getConfig?.(),
      ]);
      if (info) {
        setCurrentVersion(info.version ?? null);
      } else {
        setCurrentVersion(null);
      }
      const configuredPort = config?.server?.backendPort;
      if (typeof configuredPort === 'number' && configuredPort > 0) {
        setBackendPort(configuredPort);
      }
      const installedVersion = await window.installer?.getVersion?.();
      if (installedVersion) setTargetVersion(installedVersion);
      setPhase('confirm');
    })();
  }, []);

  const runUpgrade = async () => {
    setPhase('running');
    setLog([]);
    setError(null);

    const off = window.installer?.onProgress?.((e: unknown) => {
      setLog(prev => [...prev, e as ProgressEvent]);
    });

    try {
      const result = await window.installer?.runUpgrade?.({
        dbOpts: {
          host: dbOpts.host, port: dbOpts.port,
          database: dbOpts.database, user: dbOpts.user, password: dbOpts.password,
        },
        databaseUrl: getDatabaseUrl(),
        backupsDir: 'C:\\ProgramData\\OneSoft\\Backups',
        targetVersion,
        backendPort,
      });

      if (result?.success) {
        setBackupDir(result.backupDir ?? null);
        setPhase('done');
      } else {
        setError('فشلت عملية الترقية — تم استعادة النسخة السابقة تلقائياً');
        setPhase('failed');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('failed');
    } finally {
      if (typeof off === 'function') off();
    }
  };

  const runRollback = async () => {
    if (!backupDir) return;
    setPhase('running');
    setLog([]);
    const off = window.installer?.onProgress?.((e: unknown) => {
      setLog(prev => [...prev, e as ProgressEvent]);
    });
    await window.installer?.rollback?.({
      backupDir,
      dbOpts: { host: dbOpts.host, port: dbOpts.port, database: dbOpts.database, user: dbOpts.user, password: dbOpts.password },
    });
    if (typeof off === 'function') off();
    setPhase('done');
  };

  const ICONS: Record<string, string> = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
  const COLOR: Record<string, string> = { info: '#D1D5DB', success: '#86EFAC', warning: '#FCD34D', error: '#FCA5A5' };

  if (phase === 'detect') return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
      <p style={{ color: '#6B7280' }}>جارٍ فحص الإصدار المثبت...</p>
    </div>
  );

  if (phase === 'confirm') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#1E344F', margin: '0 0 6px' }}>
          🔄 ترقية OneSoft ERP
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          مراجعة التفاصيل قبل بدء الترقية
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>النسخة الحالية</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#B91C1C' }}>
            v{currentVersion ?? '—'}
          </div>
        </div>
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>النسخة الجديدة</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#15803D' }}>
            v{targetVersion}
          </div>
        </div>
      </div>

      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 16px', fontSize: 13 }}>
        <div style={{ fontWeight: 700, color: '#1D4ED8', marginBottom: 8 }}>📋 خطوات الترقية التلقائية:</div>
        {[
          '١. نسخة احتياطية تلقائية لقاعدة البيانات',
          '٢. إيقاف خدمات Windows مؤقتاً',
          '٣. تطبيق Migrations الجديدة',
          '٤. إعادة تشغيل الخدمات',
          '٥. فحص صحة النظام',
          '٦. استعادة تلقائية عند الفشل',
        ].map((s, i) => (
          <div key={i} style={{ color: '#1E40AF', padding: '2px 0', fontSize: 12 }}>{s}</div>
        ))}
      </div>

      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400E' }}>
        ⚠️ لا يُمكن استرجاع البيانات بعد الترقية إلا من النسخة الاحتياطية التي ستُنشأ تلقائياً.
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={() => window.installer?.close?.()} style={btnSecondary}>إلغاء</button>
        <button onClick={runUpgrade} style={btnPrimary}>بدء الترقية ▶</button>
      </div>
    </div>
  );

  if (phase === 'running') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 22, height: 22, border: '3px solid #E5E0D8', borderTopColor: '#406B93', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1E344F', margin: 0 }}>
          جارٍ الترقية... لا تغلق النافذة
        </h2>
      </div>
      <div ref={logRef} style={{
        background: '#1E1E2E', borderRadius: 10, padding: '12px 14px',
        flex: 1, maxHeight: 340, overflowY: 'auto',
        fontFamily: "'Courier New', monospace", fontSize: 12,
      }}>
        {log.map((e, i) => (
          <div key={i} style={{ color: COLOR[e.level] ?? '#D1D5DB', marginBottom: 3 }}>
            {ICONS[e.level]} {e.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (phase === 'done') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 16 }}>
      <span style={{ fontSize: 60 }}>✅</span>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#15803D', margin: '0 0 6px' }}>
          تمت الترقية بنجاح!
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13 }}>
          النظام يعمل على النسخة <strong>v{targetVersion}</strong> — بياناتك محفوظة بالكامل
        </p>
      </div>
      {backupDir && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 16px', fontSize: 12, color: '#15803D', width: '100%' }}>
          📁 النسخة الاحتياطية: <code style={{ fontFamily: 'monospace', background: '#D1FAE5', padding: '2px 6px', borderRadius: 4 }}>{backupDir}</code>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => window.installer?.openUrl?.('http://localhost:5000')} style={btnPrimary}>
          🚀 فتح البرنامج
        </button>
        <button onClick={() => window.installer?.close?.()} style={btnSecondary}>إغلاق</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 16 }}>
      <span style={{ fontSize: 60 }}>❌</span>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#B91C1C', margin: '0 0 6px' }}>
          فشلت الترقية
        </h2>
        {error && <p style={{ color: '#6B7280', fontSize: 12, maxWidth: 380 }}>{error}</p>}
      </div>
      {backupDir && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 16px', fontSize: 12, color: '#B91C1C', width: '100%' }}>
          💾 نسخة احتياطية متاحة — يمكن الاستعادة منها
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        {backupDir && (
          <button onClick={runRollback} style={{ ...btnSecondary, color: '#B91C1C', borderColor: '#FCA5A5' }}>
            🔄 استعادة النسخة السابقة
          </button>
        )}
        <button onClick={() => window.installer?.close?.()} style={btnSecondary}>إغلاق</button>
      </div>
    </div>
  );
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
