import { useState, useEffect, useRef } from 'react';
import { useInstallerStore } from '../store/installer.store';
import type { ProgressEvent } from '../../core/types';
import { APP_VERSION } from '../../core/version';

type Phase = 'detect' | 'confirm' | 'running' | 'done' | 'failed';
const acceptanceMode = typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('acceptance') === '1';

export default function UpgradeWizard() {
  const { dbOpts, setDbOpts } = useInstallerStore();
  const [phase, setPhase] = useState<Phase>('detect');
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [targetVersion, setTargetVersion] = useState(APP_VERSION);
  const [runtimePassword, setRuntimePassword] = useState(dbOpts.password);
  const [adminUser, setAdminUser] = useState('postgres');
  const [adminPassword, setAdminPassword] = useState('');
  const [acceptancePassword, setAcceptancePassword] = useState('');
  const [needsAdminCredential, setNeedsAdminCredential] = useState(false);
  const [backendPort, setBackendPort] = useState(3000);
  const [log, setLog] = useState<ProgressEvent[]>([]);
  const [backupDir, setBackupDir] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const acceptanceStarted = useRef(false);

  const makeRuntimePassword = (): string => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  useEffect(() => {
    (async () => {
      try {
        const [info, config] = await Promise.all([
          window.installer?.detectVersion?.(),
          window.installer?.getConfig?.(),
        ]);
        if (config?.database?.password && config.database.user === 'onesoft_app') {
          setRuntimePassword(config.database.password);
        }
        if (config?.database) {
          setDbOpts({
            host: config.database.host,
            port: config.database.port,
            database: config.database.name,
          });
          // The v1.0.0 acceptance fixture stores the legacy administrator
          // connection (postgres), while newer installs store onesoft_app.
          // Acceptance mode must be able to exercise the real one-time
          // administrator path for either configured user.
          if (acceptanceMode) setAcceptancePassword(config.database.password ?? '');
          const legacyUser = config.database.user?.trim();
          if (legacyUser && legacyUser !== 'onesoft_app') {
            setAdminUser(legacyUser);
            setRuntimePassword(makeRuntimePassword());
            setNeedsAdminCredential(true);
          } else {
            setNeedsAdminCredential(true);
          }
        }
        if (info) {
          setCurrentVersion(info.version ?? null);
        } else {
          setCurrentVersion(null);
        }
        const configuredPort = config?.server?.backendPort;
        if (typeof configuredPort === 'number' && configuredPort > 0) {
          setBackendPort(configuredPort);
        }
        // Keep the upgrade target from the installer bundle's version.json.
        // app:get-version is the Electron runtime version and can be stale in
        // legacy packages (for example 1.0.0); it must never replace the
        // target release shown or sent to UpgradeManager.
        if (config?.database?.user === 'onesoft_app') {
          const credentialProbe = await window.installer?.hasMigrationCredential?.();
          if (!credentialProbe) {
            setNeedsAdminCredential(true);
          } else {
            const preflight = await window.installer?.upgradePreflight?.({
              host: config.database.host,
              port: config.database.port,
              database: config.database.name,
            });
            if (preflight?.error) {
              throw new Error(`تعذر فحص ملكية قاعدة البيانات قبل الترقية: ${preflight.error}`);
            }
            // A protected migration credential is sufficient only after the
            // read-only preflight confirms that Legacy ownership is clean.
            // Ownership drift still needs the one-time PostgreSQL admin.
            setNeedsAdminCredential(preflight?.needsAdminCredential === true);
          }
        }
        setPhase('confirm');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase('failed');
      }
    })();
  }, [setDbOpts]);

  const runUpgrade = async (credentialOverride?: { adminUser: string; adminPassword: string }) => {
    setPhase('running');
    setLog([]);
    setError(null);
    const effectiveAdminUser = credentialOverride?.adminUser ?? adminUser;
    const effectiveAdminPassword = credentialOverride?.adminPassword ?? adminPassword;

    const off = window.installer?.onProgress?.((e: unknown) => {
      setLog(prev => [...prev, e as ProgressEvent]);
    });

    try {
      if (needsAdminCredential && (!effectiveAdminUser.trim() || !effectiveAdminPassword)) {
        throw new Error('أدخل اسم مستخدم PostgreSQL الإداري وكلمة مروره لمرة واحدة قبل متابعة ترقية Legacy.');
      }
      const result = await window.installer?.runUpgrade?.({
        dbOpts: {
          host: dbOpts.host, port: dbOpts.port,
          database: dbOpts.database, user: 'onesoft_app', password: runtimePassword,
        },
        ...(needsAdminCredential ? {
          adminDbOpts: {
            host: dbOpts.host, port: dbOpts.port,
            database: dbOpts.database, user: effectiveAdminUser.trim(), password: effectiveAdminPassword,
          },
        } : {}),
        forceRoleProvision: needsAdminCredential,
        databaseUrl: `postgresql://onesoft_app:${encodeURIComponent(runtimePassword)}@${dbOpts.host}:${dbOpts.port}/${dbOpts.database}`,
        backupsDir: 'C:\\ProgramData\\OneSoft\\Backups',
        targetVersion,
        backendPort,
      });

      if (result?.success) {
        setBackupDir(result.backupDir ?? null);
        setAdminPassword('');
        setPhase('done');
      } else {
        const detail = result?.error
          ? `${result.error}${result.stage ? ` (المرحلة: ${result.stage})` : ''}${result.migration ? ` (migration: ${result.migration})` : ''}`
          : 'فشلت عملية الترقية — تم استعادة النسخة السابقة تلقائياً';
        setError(detail);
        if (result?.rollback && !result.rollback.ok) {
          setError(`${detail} — حالة التراجع: قاعدة البيانات=${result.rollback.databaseRollback}، الأدوار=${result.rollback.roleBootstrapRollback}، الملكية=${result.rollback.ownershipRollback}، OneSoft-Server=${result.rollback.serviceRollback}`);
        }
        setPhase('failed');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('failed');
    } finally {
      // The admin password is intentionally never persisted and is cleared
      // after the Upgrade Core has consumed it.
      setAdminPassword('');
      if (typeof off === 'function') off();
      if (acceptanceMode) {
        window.setTimeout(() => window.installer?.close?.(), 500);
      }
    }
  };

  useEffect(() => {
    if (!acceptanceMode || phase !== 'confirm' || !needsAdminCredential ||
        acceptanceStarted.current || !acceptancePassword) return;
    acceptanceStarted.current = true;
    setAdminUser('postgres');
    setAdminPassword(acceptancePassword);
    const timer = window.setTimeout(() => {
      void runUpgrade({ adminUser: 'postgres', adminPassword: acceptancePassword });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [phase, needsAdminCredential, acceptancePassword]);

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

      {needsAdminCredential && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: 14 }}>
          <div style={{ fontWeight: 800, color: '#991B1B', marginBottom: 6 }}>
            يلزم اعتماد PostgreSQL إداري لمرة واحدة
          </div>
          <div style={{ color: '#7F1D1D', fontSize: 12, marginBottom: 10 }}>
            هذه القاعدة تستخدم حساب Runtime ولا تملك صلاحية إنشاء أدوار أو تعديل المخطط.
            لن يتم حفظ كلمة المرور بعد الترقية.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={fieldLabel}>
              المستخدم الإداري
               <input value={adminUser} onChange={e => setAdminUser(e.target.value)} style={fieldInput} autoComplete="username" autoFocus={needsAdminCredential} />
            </label>
            <label style={fieldLabel}>
              كلمة المرور
               <input
                 type="password"
                 value={adminPassword}
                 onChange={e => setAdminPassword(e.target.value)}
                 onKeyDown={e => {
                   if (e.key === 'Enter') {
                     e.preventDefault();
                     void runUpgrade();
                   }
                 }}
                 style={fieldInput}
                 autoComplete="current-password"
               />
            </label>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={() => window.installer?.close?.()} style={btnSecondary}>إلغاء</button>
        <button onClick={() => void runUpgrade()} style={btnPrimary}>بدء الترقية ▶</button>
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
const fieldLabel: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 5,
  color: '#4B5563', fontSize: 12, fontWeight: 700,
};
const fieldInput: React.CSSProperties = {
  border: '1px solid #D1D5DB', borderRadius: 7, padding: '9px 10px',
  fontSize: 13, fontFamily: 'inherit', direction: 'ltr',
};
