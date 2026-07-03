import { useState, useEffect, useRef } from 'react';
import { useInstallerStore } from '../store/installer.store';
import type { ProgressEvent } from '../../core/types';

const LEVEL_COLOR: Record<string, string> = {
  info: '#374151', success: '#15803D', warning: '#D97706',
  error: '#B91C1C', warn: '#D97706',
};

// ── خريطة رسائل أخطاء قاعدة البيانات ──────────────────────────────────────
const DB_ERROR_UI: Record<string, { icon: string; title: string; action: string }> = {
  auth:     { icon: '🔑', title: 'كلمة مرور PostgreSQL غير صحيحة',       action: 'تعديل كلمة المرور' },
  user:     { icon: '👤', title: 'اسم المستخدم غير موجود في PostgreSQL',  action: 'تعديل اسم المستخدم' },
  database: { icon: '🗄️', title: 'قاعدة البيانات غير موجودة',            action: 'تعديل اسم قاعدة البيانات' },
  service:  { icon: '⚙️', title: 'خدمة PostgreSQL غير مشغّلة',           action: 'تشغيل الخدمة وإعادة المحاولة' },
  network:  { icon: '🌐', title: 'لا يمكن الوصول إلى السيرفر',           action: 'تعديل عنوان السيرفر' },
  timeout:  { icon: '⏱️', title: 'انتهت مهلة الاتصال',                   action: 'إعادة المحاولة' },
  other:    { icon: '❌', title: 'خطأ في الاتصال بقاعدة البيانات',        action: 'إعادة المحاولة' },
};

export default function Step09Services() {
  const store = useInstallerStore();
  const {
    progressLog, dbOpts, organization, firstUser,
    deploymentType, accessModes, databaseMode, machineRole, connectivityMode,
    licensingMode, updateChannel, backupPolicy, telemetry,
    setOrgId, setOrgCode, getDatabaseUrl, clearProgress,
    setInstallRunning, setInstallDone,
    prevStep,
  } = store;

  const [running,   setRunning]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [dbError,   setDbError]   = useState<{
    message: string; hint: string; errorType: string;
  } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [progressLog.length]);

  const run = async () => {
    clearProgress();
    setRunning(true);
    setInstallRunning(true);
    setInstallDone(false);
    setError(null);
    setDbError(null);

    try {
      const databaseUrl = getDatabaseUrl();
      const adminOpts = {
        host: dbOpts.host, port: dbOpts.port,
        database: 'postgres', user: dbOpts.user, password: dbOpts.password,
      };

      // ────────────────────────────────────────────────────────────────────────
      // 0. اختبار الاتصال بقاعدة البيانات قبل أي خطوة أخرى
      //    (للـ local-existing و remote — ليس local-install لأن PG لم يُثبَّت بعد)
      // ────────────────────────────────────────────────────────────────────────
      if (databaseMode !== 'local-install') {
        const testResult = await window.installer?.testConnection?.({
          host:     dbOpts.host,
          port:     dbOpts.port,
          database: 'postgres',
          user:     dbOpts.user,
          password: dbOpts.password,
        });

        if (!testResult?.ok) {
          // إيقاف التثبيت فوراً وإظهار خطأ واضح مع توجيه المستخدم
          setRunning(false);
          setInstallRunning(false);
          setDbError({
            message:   testResult?.detail   ?? 'فشل الاتصال بقاعدة البيانات',
            hint:      (testResult as any)?.hint ?? 'راجع بيانات الاتصال وأعد المحاولة',
            errorType: (testResult as any)?.errorType ?? 'other',
          });
          return;
        }
      }

      const needsLocalDb = ['server', 'server+client', 'branch'].includes(deploymentType);
      const installDir   = 'C:\\Program Files\\OneSoft ERP';
      const paths        = buildPaths();

      // 1. إنشاء مجلدات النظام
      await window.installer?.createDirectories?.(paths);

      // 2. إنشاء قاعدة البيانات (فقط إذا كان النوع يتطلبها)
      if (needsLocalDb) {
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

        // 5. إنشاء المستخدم الأول
        if (orgResult?.id) {
          await window.installer?.createUser?.({
            databaseUrl, orgId: orgResult.id, user: firstUser,
          });
        }

        // 6. بذر شجرة الحسابات (فقط لـ server و server+client — ليس branch)
        if (deploymentType !== 'branch') {
          await window.installer?.seedAccounts?.(databaseUrl);
        }
      }

      // 7. تثبيت الخدمات بناءً على نوع التثبيت + طرق الاستخدام
      await window.installer?.installServices?.({
        installDir,
        logsDir:        paths.logs,
        deploymentType,
        accessModes,
      });

      // 8. إنشاء اختصارات سطح المكتب (فقط إذا اختار المستخدم Desktop)
      if (accessModes.includes('desktop')) {
        await window.installer?.createShortcuts?.({
          installDir,
          appExe:   `${installDir}\\OneSoft ERP.exe`,
          iconPath: `${installDir}\\resources\\icons\\onesoft.ico`,
        });
      }

      // 9. كتابة Registry — يظهر في إضافة/إزالة البرامج
      await (window as any).installer?.writeRegistry?.({
        installDir,
        version:      '1.0.0',
        uninstallExe: `${installDir}\\OneSoft ERP Setup.exe`,
        iconPath:     `${installDir}\\resources\\icons\\onesoft.ico`,
        sizeKB:       150000,
      });

      // 10. حفظ الإعدادات بالبنية الكاملة (configVersion: 4 — تسعة أبعاد)
      await window.installer?.saveConfig?.({
        version:       '1.0.0',
        configVersion: 4,
        // ── الأبعاد الخمسة الأصلية ──────────────────────────────────────
        deploymentType,
        accessModes,
        databaseMode,
        machineRole,
        connectivityMode,
        // ── الأبعاد الأربعة الجديدة ──────────────────────────────────────
        licensingMode,
        updateChannel,
        backupPolicy,
        telemetry,
        database: {
          host: dbOpts.host, port: dbOpts.port,
          name: dbOpts.database, user: 'onesoft_app',
          password: dbOpts.password, poolMin: 2, poolMax: 10,
        },
        server: {
          backendPort: 3000, frontendPort: 5000,
          host: '0.0.0.0', allowedOrigins: ['localhost'],
        },
        paths,
      });

      // 11. تسجيل النسخة — لاكتشافها عند الترقية لاحقاً
      await (window as any).installer?.markInstalled?.({
        version: '1.0.0',
        installDir,
      });

      setDone(true);
      setInstallDone(true);

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setInstallRunning(false);
    }
  };

  useEffect(() => { run(); }, []);

  // ── حالة خطأ الاتصال بقاعدة البيانات ─────────────────────────────────────
  if (dbError) {
    const ui = DB_ERROR_UI[dbError.errorType] ?? DB_ERROR_UI.other;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
            ⚠️ تعذّر الاتصال بقاعدة البيانات
          </h2>
          <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
            يجب إصلاح هذه المشكلة قبل المتابعة
          </p>
        </div>

        {/* بطاقة الخطأ */}
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5',
          borderRadius: 12, padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 32 }}>{ui.icon}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#B91C1C' }}>
                {ui.title}
              </div>
              <div style={{ fontSize: 13, color: '#7F1D1D', marginTop: 2 }}>
                {dbError.message}
              </div>
            </div>
          </div>

          {/* التلميح */}
          <div style={{
            padding: '10px 14px', background: '#FFF7ED',
            border: '1px solid #FED7AA', borderRadius: 8,
            fontSize: 13, color: '#9A3412',
          }}>
            💡 <strong>كيف تصلحها:</strong> {dbError.hint}
          </div>
        </div>

        {/* معلومات الاتصال الحالية */}
        <div style={{
          background: '#F8FAFC', border: '1px solid #E2E8F0',
          borderRadius: 10, padding: '14px 18px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10 }}>
            📋 بيانات الاتصال المستخدمة:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 12 }}>
            <span style={{ color: '#64748B' }}>السيرفر:</span>
            <span style={{ fontFamily: 'monospace', color: '#1E344F' }}>{dbOpts.host}</span>
            <span style={{ color: '#64748B' }}>المنفذ:</span>
            <span style={{ fontFamily: 'monospace', color: '#1E344F' }}>{dbOpts.port}</span>
            <span style={{ color: '#64748B' }}>المستخدم:</span>
            <span style={{ fontFamily: 'monospace', color: '#1E344F' }}>{dbOpts.user}</span>
            <span style={{ color: '#64748B' }}>كلمة المرور:</span>
            <span style={{ fontFamily: 'monospace', color: '#1E344F' }}>{'•'.repeat(Math.min(dbOpts.password?.length ?? 0, 12))}</span>
          </div>
        </div>

        {/* أزرار الإجراء */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={() => prevStep()}
            style={{
              background: 'linear-gradient(135deg, #406B93, #2d5070)',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 24px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ← العودة لتعديل بيانات الاتصال
          </button>
          <button
            onClick={run}
            style={{
              background: '#fff', color: '#6B7280',
              border: '1px solid #D1D5DB', borderRadius: 8,
              padding: '10px 20px', fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            🔄 إعادة الاختبار
          </button>
        </div>
      </div>
    );
  }

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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {running && (
            <div style={{
              width: 24, height: 24,
              border: '3px solid #E5E0D8', borderTopColor: '#406B93',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
          )}
          {done  && <span style={{ fontSize: 28 }}>✅</span>}
          {error && <span style={{ fontSize: 28 }}>❌</span>}
        </div>
      </div>

      {/* ملخص ما سيُثبَّت */}
      <div style={{
        padding: '8px 12px', background: '#F0F9FF',
        border: '1px solid #BAE6FD', borderRadius: 8,
        fontSize: 11, color: '#0369A1', display: 'flex', gap: 16,
      }}>
        <span>🏗️ <strong>{DEPLOYMENT_LABELS[deploymentType] ?? deploymentType}</strong></span>
        <span>🔑 {accessModes.map(m => ACCESS_LABELS[m] ?? m).join(' + ')}</span>
      </div>

      {/* Progress Log */}
      <div ref={logRef} style={{
        flex: 1, overflowY: 'auto', background: '#1E1E2E',
        borderRadius: 10, padding: '12px 14px', maxHeight: 300,
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
        <div style={{
          padding: '10px 14px', background: '#FEF2F2',
          border: '1px solid #FCA5A5', borderRadius: 8,
          fontSize: 12, color: '#B91C1C',
        }}>
          ❌ {error}
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => prevStep()} style={btnSecondary}>← العودة</button>
          <button onClick={run} style={btnSecondary}>🔄 إعادة المحاولة</button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function buildPaths() {
  const base = 'C:\\ProgramData\\OneSoft';
  return {
    data:        `${base}\\Data`,
    backups:     `${base}\\Backups`,
    logs:        `${base}\\Logs`,
    temp:        `${base}\\Temp`,
    updates:     `${base}\\Updates`,
    attachments: `${base}\\Attachments`,
    exports:     `${base}\\Exports`,
  };
}

const DEPLOYMENT_LABELS: Record<string, string> = {
  'server':       'سيرفر رئيسي',
  'client':       'عميل',
  'server+client':'سيرفر + عميل',
  'branch':       'فرع',
  'cloud':        'سحابي',
};

const ACCESS_LABELS: Record<string, string> = {
  desktop: 'مكتبي',
  web:     'متصفح',
  offline: 'أوفلاين',
};

const btnSecondary: React.CSSProperties = {
  background: '#fff', color: '#6B7280', border: '1px solid #D1D5DB',
  borderRadius: 8, padding: '10px 20px', fontSize: 13,
  cursor: 'pointer', fontFamily: 'inherit',
};
