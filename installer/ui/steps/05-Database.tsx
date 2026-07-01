import { useState } from 'react';
import { useInstallerStore } from '../store/installer.store';
import type { DatabaseMode } from '../../core/types';

// ── تعريف الأوضاع ─────────────────────────────────────────────────────────────
const DB_MODES: {
  id: DatabaseMode;
  icon: string;
  title: string;
  subtitle: string;
  future?: boolean;
}[] = [
  {
    id:       'local-install',
    icon:     '📦',
    title:    'PostgreSQL محلي — تثبيت جديد',
    subtitle: 'سيقوم المثبِّت بتنزيل وإعداد PostgreSQL تلقائياً على هذا الجهاز',
  },
  {
    id:       'local-existing',
    icon:     '🔍',
    title:    'PostgreSQL محلي — موجود مسبقاً',
    subtitle: 'استخدم PostgreSQL مثبَّتاً على هذا الجهاز — يمكنك اختيار قاعدة موجودة أو إنشاء جديدة',
  },
  {
    id:       'remote',
    icon:     '🌐',
    title:    'قاعدة بيانات بعيدة (Remote)',
    subtitle: 'الاتصال بـ PostgreSQL على جهاز أو سيرفر آخر في الشبكة',
  },
  {
    id:       'cloud',
    icon:     '☁️',
    title:    'قاعدة بيانات سحابية',
    subtitle: 'محجوز للمستقبل — Supabase / RDS / Azure PostgreSQL',
    future:   true,
  },
];

export default function Step06DatabaseMode() {
  const {
    databaseMode, setDatabaseMode,
    dbOpts, setDbOpts,
    nextStep, prevStep,
  } = useInstallerStore();

  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [detecting,  setDetecting]  = useState(false);
  const [detectedDbs, setDetectedDbs] = useState<string[]>([]);

  const selectMode = (m: DatabaseMode) => {
    setDatabaseMode(m);
    setTestResult(null);
    setDetectedDbs([]);
    // تحديث الـ host تلقائياً حسب الوضع
    if (m === 'local-install' || m === 'local-existing') {
      setDbOpts({ host: 'localhost' });
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const r = await window.installer?.testConnection?.({
      host: dbOpts.host, port: dbOpts.port,
      database: 'postgres', user: dbOpts.user, password: dbOpts.password,
    });
    setTestResult(r ?? { ok: false, detail: 'لا استجابة من الاتصال' });
    setTesting(false);
  };

  const detectDatabases = async () => {
    setDetecting(true);
    try {
      const r = await window.installer?.testConnection?.({
        host: 'localhost', port: dbOpts.port,
        database: 'postgres', user: dbOpts.user, password: dbOpts.password,
      });
      if (r?.ok) {
        setDetectedDbs(['onesoft_erp', 'postgres']);
        setDbOpts({ host: 'localhost' });
        setTestResult({ ok: true, detail: 'تم اكتشاف PostgreSQL المحلي بنجاح' });
      } else {
        setTestResult({ ok: false, detail: r?.detail ?? 'لم يُعثر على PostgreSQL محلي' });
      }
    } finally {
      setDetecting(false);
    }
  };

  // هل يمكن المتابعة؟
  const canContinue: boolean = (() => {
    if (databaseMode === 'local-install') return !!dbOpts.password;
    if (databaseMode === 'cloud') return false; // محجوز
    return testResult?.ok === true;
  })();

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 12px',
    border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13,
    background: '#F9FAFB', color: '#1E344F', fontFamily: 'inherit', outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* العنوان */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
          🗄️ إعداد قاعدة البيانات
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          اختر كيف تريد توصيل OneSoft بقاعدة البيانات
        </p>
      </div>

      {/* بطاقات الأوضاع */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DB_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => !m.future && selectMode(m.id)}
            disabled={m.future}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
              background: databaseMode === m.id ? '#EBF5FF' : m.future ? '#FAFAFA' : '#fff',
              border: `2px solid ${databaseMode === m.id ? '#3B82F6' : m.future ? '#E5E7EB' : '#E5E0D8'}`,
              borderRadius: 10, cursor: m.future ? 'not-allowed' : 'pointer', textAlign: 'right',
              fontFamily: 'inherit', opacity: m.future ? 0.55 : 1, transition: 'all 0.15s',
              width: '100%',
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{m.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: databaseMode === m.id ? '#1D4ED8' : '#1E344F',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {m.title}
                {m.future && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                    background: '#F3F4F6', padding: '1px 7px', borderRadius: 10,
                  }}>
                    قريباً
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{m.subtitle}</div>
            </div>
            {databaseMode === m.id && (
              <span style={{ fontSize: 18, color: '#3B82F6', flexShrink: 0, marginTop: 1 }}>✓</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── حقول local-install ─────────────────────────────────────────────── */}
      {databaseMode === 'local-install' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #E5E0D8' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E344F', marginBottom: 12 }}>
            🔐 كلمة مرور postgres (المستخدم الإداري)
          </div>
          <div>
            <label style={lbl}>كلمة المرور التي ستُضبَط عند التثبيت</label>
            <input
              style={inp} type="password" value={dbOpts.password}
              onChange={e => setDbOpts({ password: e.target.value })}
              placeholder="••••••••"
            />
          </div>
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#F0F9FF', borderRadius: 8, fontSize: 12, color: '#0369A1' }}>
            ℹ️ سيتم تثبيت PostgreSQL 16 تلقائياً وإنشاء قاعدة بيانات <b>onesoft_erp</b>
          </div>
        </div>
      )}

      {/* ─── حقول local-existing ────────────────────────────────────────────── */}
      {databaseMode === 'local-existing' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #E5E0D8', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E344F' }}>
              🔍 اكتشاف PostgreSQL المحلي
            </div>
            <button
              onClick={detectDatabases}
              disabled={detecting || !dbOpts.password}
              style={{
                background: detecting ? '#9CA3AF' : '#6366F1',
                color: '#fff', border: 'none', borderRadius: 7,
                padding: '6px 16px', fontSize: 12, fontWeight: 600,
                cursor: (detecting || !dbOpts.password) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {detecting ? '⏳ جارٍ الاكتشاف...' : '🔍 اكتشاف تلقائي'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>المستخدم الإداري</label>
              <input style={inp} value={dbOpts.user}
                onChange={e => setDbOpts({ user: e.target.value })} placeholder="postgres" />
            </div>
            <div>
              <label style={lbl}>المنفذ</label>
              <input style={inp} type="number" value={dbOpts.port}
                onChange={e => setDbOpts({ port: parseInt(e.target.value) || 5432 })} />
            </div>
          </div>
          <div>
            <label style={lbl}>كلمة المرور</label>
            <input style={inp} type="password" value={dbOpts.password}
              onChange={e => setDbOpts({ password: e.target.value })} placeholder="••••••••" />
          </div>

          {detectedDbs.length > 0 && (
            <div>
              <label style={lbl}>قاعدة البيانات</label>
              <select
                style={inp}
                value={dbOpts.database}
                onChange={e => setDbOpts({ database: e.target.value })}
              >
                <option value="onesoft_erp">onesoft_erp (جديدة — ستُنشأ)</option>
                {detectedDbs.filter(d => d !== 'onesoft_erp').map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={testConnection}
            disabled={testing || !dbOpts.password}
            style={{
              background: testing ? '#9CA3AF' : '#1E344F',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 20px', fontSize: 13, fontWeight: 600,
              cursor: (testing || !dbOpts.password) ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-start', fontFamily: 'inherit',
            }}
          >
            {testing ? '⏳ جارٍ الاختبار...' : '🔌 اختبار الاتصال'}
          </button>
        </div>
      )}

      {/* ─── حقول remote ────────────────────────────────────────────────────── */}
      {databaseMode === 'remote' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #E5E0D8', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E344F', marginBottom: 4 }}>
            🌐 بيانات الاتصال بالسيرفر البعيد
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>عنوان السيرفر (IP أو Hostname)</label>
              <input
                style={inp} value={dbOpts.host}
                onChange={e => setDbOpts({ host: e.target.value })}
                placeholder="192.168.1.100 أو db.example.com"
                dir="ltr"
              />
            </div>
            <div>
              <label style={lbl}>المنفذ</label>
              <input style={inp} type="number" value={dbOpts.port}
                onChange={e => setDbOpts({ port: parseInt(e.target.value) || 5432 })} />
            </div>
          </div>
          <div>
            <label style={lbl}>اسم قاعدة البيانات</label>
            <input style={inp} value={dbOpts.database}
              onChange={e => setDbOpts({ database: e.target.value })} placeholder="onesoft_erp" dir="ltr" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>المستخدم</label>
              <input style={inp} value={dbOpts.user}
                onChange={e => setDbOpts({ user: e.target.value })} placeholder="postgres" dir="ltr" />
            </div>
            <div>
              <label style={lbl}>كلمة المرور</label>
              <input style={inp} type="password" value={dbOpts.password}
                onChange={e => setDbOpts({ password: e.target.value })} placeholder="••••••••" />
            </div>
          </div>
          <button
            onClick={testConnection}
            disabled={testing || !dbOpts.password || !dbOpts.host}
            style={{
              background: testing ? '#9CA3AF' : '#1E344F',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 20px', fontSize: 13, fontWeight: 600,
              cursor: (testing || !dbOpts.password || !dbOpts.host) ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-start', fontFamily: 'inherit',
            }}
          >
            {testing ? '⏳ جارٍ الاختبار...' : '🔌 اختبار الاتصال'}
          </button>
        </div>
      )}

      {/* نتيجة الاختبار */}
      {testResult && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: testResult.ok ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${testResult.ok ? '#86EFAC' : '#FCA5A5'}`,
          color: testResult.ok ? '#15803D' : '#B91C1C',
        }}>
          {testResult.ok ? '✅' : '❌'} {testResult.detail}
        </div>
      )}

      {/* التنقل */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={prevStep} style={btnSecondary}>◀ السابق</button>
        <button
          onClick={nextStep}
          disabled={!canContinue}
          style={{ ...btnPrimary, opacity: canContinue ? 1 : 0.4, cursor: canContinue ? 'pointer' : 'not-allowed' }}
        >
          التالي ▶
        </button>
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
