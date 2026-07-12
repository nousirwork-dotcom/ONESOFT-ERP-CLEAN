import { useState, useRef, useEffect } from 'react';
import type { ProgressEvent } from '../../core/types';

interface UninstallConfig {
  installDir: string;
  dataDir: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
}

type UninstallMode = 'keep-db' | 'remove-all';

export default function UninstallWizard() {
  const [step, setStep] = useState<'confirm' | 'options' | 'running' | 'done'>('confirm');
  // الوضع الافتراضي: إزالة البرنامج فقط مع الاحتفاظ بقاعدة البيانات
  const [mode, setMode] = useState<UninstallMode>('keep-db');
  const deleteDb = mode === 'remove-all';
  const deleteData = mode === 'remove-all';
  const [config] = useState<UninstallConfig>({
    installDir: 'C:\\Program Files\\OneSoft ERP',
    dataDir: 'C:\\ProgramData\\OneSoft',
    dbHost: 'localhost', dbPort: 5432,
    dbName: 'onesoft_erp', dbUser: 'postgres', dbPassword: '',
  });
  const [dbPassword, setDbPassword] = useState('');
  const [log, setLog] = useState<ProgressEvent[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const run = async () => {
    setStep('running');
    setLog([]);
    const off = window.installer?.onProgress?.((e: unknown) => {
      setLog(prev => [...prev, e as ProgressEvent]);
    });
    await window.installer?.runHealthCheck?.({
      dbOpts: { host: config.dbHost, port: config.dbPort, database: config.dbName, user: config.dbUser, password: dbPassword },
      backendPort: 3000, frontendPort: 5000,
    });
    // Call uninstall via IPC
    await (window as any).installer?.uninstall?.({
      installDir: config.installDir,
      dataDir: config.dataDir,
      dbOpts: { host: config.dbHost, port: config.dbPort, database: config.dbName, user: config.dbUser, password: dbPassword },
      deleteDatabase: deleteDb,
      deleteData,
    });
    if (typeof off === 'function') off();
    setStep('done');
  };

  const ICONS: Record<string, string> = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };

  if (step === 'confirm') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', paddingTop: 20 }}>
      <div style={{ fontSize: 60 }}>⚠️</div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#B91C1C', margin: '0 0 8px' }}>
          إلغاء تثبيت OneSoft ERP
        </h2>
        <p style={{ color: '#6B7280', fontSize: 14, maxWidth: 400 }}>
          هذا سيوقف جميع الخدمات ويحذف ملفات البرنامج من جهازك.
          يمكنك الاحتفاظ ببياناتك وقاعدة البيانات إذا أردت.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => window.installer?.close?.()} style={btnSecondary}>إلغاء الأمر</button>
        <button onClick={() => setStep('options')} style={{ ...btnPrimary, background: 'linear-gradient(135deg, #B91C1C, #991B1B)' }}>
          متابعة الإلغاء ▶
        </button>
      </div>
    </div>
  );

  if (step === 'options') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>خيارات الإلغاء</h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>اختر طريقة الإزالة المناسبة</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* الخيار الافتراضي — الاحتفاظ بقاعدة البيانات */}
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
          background: mode === 'keep-db' ? '#EFF6FF' : '#fff',
          border: `2px solid ${mode === 'keep-db' ? '#3B82F6' : '#E5E0D8'}`,
          borderRadius: 10, padding: '14px 16px',
        }}>
          <input type="radio" name="uninstall-mode" checked={mode === 'keep-db'}
            onChange={() => setMode('keep-db')}
            style={{ width: 18, height: 18, marginTop: 2, accentColor: '#2563EB', cursor: 'pointer' }} />
          <div>
            <div style={{ fontWeight: 800, color: '#1D4ED8', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              إزالة البرنامج فقط مع الاحتفاظ بقاعدة البيانات
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#1D4ED8',
                background: '#DBEAFE', padding: '1px 8px', borderRadius: 10,
              }}>موصى به</span>
            </div>
            <div style={{ color: '#374151', fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
              يوقف الخدمات ويحذف البرنامج والاختصارات والمهام المجدولة وقواعد الجدار الناري
              وملفات الإعداد والذاكرة المؤقتة والسجلات. <b>تبقى قاعدة البيانات والنسخ الاحتياطية
              والمرفقات والبيانات كما هي</b> — يمكنك إعادة التثبيت والاتصال بها لاحقاً.
            </div>
          </div>
        </label>

        {/* الخيار الخطير — إزالة كل شيء */}
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
          background: mode === 'remove-all' ? '#FEF2F2' : '#fff',
          border: `2px solid ${mode === 'remove-all' ? '#FCA5A5' : '#E5E0D8'}`,
          borderRadius: 10, padding: '14px 16px',
        }}>
          <input type="radio" name="uninstall-mode" checked={mode === 'remove-all'}
            onChange={() => setMode('remove-all')}
            style={{ width: 18, height: 18, marginTop: 2, accentColor: '#B91C1C', cursor: 'pointer' }} />
          <div>
            <div style={{ fontWeight: 800, color: '#B91C1C', fontSize: 14 }}>
              إزالة كل شيء نهائياً — بما فيها قاعدة البيانات
            </div>
            <div style={{ color: '#374151', fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
              يحذف كل ما سبق <b>بالإضافة إلى قاعدة البيانات ومستخدم التطبيق وكامل مجلد البيانات
              (النسخ الاحتياطية والمرفقات)</b>. لا يمكن التراجع عن هذا الإجراء.
            </div>
          </div>
        </label>
      </div>

      {deleteDb && (
        <div style={{ background: '#fff', border: '1px solid #FCA5A5', borderRadius: 8, padding: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#B91C1C', display: 'block', marginBottom: 4 }}>
            كلمة مرور PostgreSQL (للتأكيد)
          </label>
          <input type="password" value={dbPassword} onChange={e => setDbPassword(e.target.value)}
            placeholder="أدخل كلمة مرور postgres للتأكيد"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #FCA5A5', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
      )}

      {deleteDb ? (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#B91C1C' }}>
          ⚠️ <strong>تحذير:</strong> ستُحذف قاعدة البيانات وكل بياناتك بشكل دائم ولا يمكن استرجاعها.
        </div>
      ) : (
        <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#15803D' }}>
          ✅ ستُحذف ملفات البرنامج فقط — قاعدة البيانات والنسخ الاحتياطية والمرفقات محفوظة.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={() => setStep('confirm')} style={btnSecondary}>◀ رجوع</button>
        <button onClick={run} disabled={deleteDb && !dbPassword} style={{
          ...btnPrimary, background: 'linear-gradient(135deg, #B91C1C, #991B1B)',
          opacity: (deleteDb && !dbPassword) ? 0.4 : 1,
        }}>
          بدء الإلغاء ▶
        </button>
      </div>
    </div>
  );

  if (step === 'running') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#B91C1C', margin: 0 }}>
        🗑️ جارٍ إلغاء التثبيت...
      </h2>
      <div ref={logRef} style={{
        background: '#1E1E2E', borderRadius: 10, padding: '12px 14px',
        maxHeight: 380, overflowY: 'auto',
        fontFamily: "'Courier New', monospace", fontSize: 12,
      }}>
        {log.map((e, i) => (
          <div key={i} style={{ color: e.level === 'success' ? '#86EFAC' : e.level === 'error' ? '#FCA5A5' : '#D1D5DB', marginBottom: 2 }}>
            {ICONS[e.level]} {e.message}
          </div>
        ))}
        {log.length === 0 && <div style={{ color: '#6B7280' }}>جارٍ البدء...</div>}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 20 }}>
      <span style={{ fontSize: 60 }}>✅</span>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#15803D', margin: '0 0 8px' }}>
          تم إلغاء التثبيت بنجاح
        </h2>
        <p style={{ color: '#6B7280', fontSize: 14 }}>
          تمت إزالة OneSoft ERP من جهازك بالكامل.
        </p>
      </div>
      <button onClick={() => window.installer?.close?.()} style={btnPrimary}>إغلاق</button>
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
