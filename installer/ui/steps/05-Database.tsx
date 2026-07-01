import { useState } from 'react';
import { useInstallerStore } from '../store/installer.store';

export default function Step05Database() {
  const { dbOpts, setDbOpts, nextStep, prevStep } = useInstallerStore();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    const r = await window.installer?.testConnection?.({
      host: dbOpts.host, port: dbOpts.port,
      database: 'postgres', user: dbOpts.user, password: dbOpts.password,
    });
    setTestResult(r ?? { ok: false, detail: 'لا استجابة' });
    setTesting(false);
  };

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 12px',
    border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13,
    background: '#F9FAFB', color: '#1E344F', fontFamily: 'inherit', outline: 'none',
  };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
          🗄️ إعداد قاعدة البيانات
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          أدخل بيانات اتصال PostgreSQL — تأكد من تشغيل PostgreSQL أولاً
        </p>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #E5E0D8', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>الخادم (Host)</label>
            <input style={inp} value={dbOpts.host}
              onChange={e => setDbOpts({ host: e.target.value })} placeholder="localhost" />
          </div>
          <div>
            <label style={lbl}>المنفذ (Port)</label>
            <input style={inp} type="number" value={dbOpts.port}
              onChange={e => setDbOpts({ port: parseInt(e.target.value) || 5432 })} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>المستخدم الإداري</label>
            <input style={inp} value={dbOpts.user}
              onChange={e => setDbOpts({ user: e.target.value })} placeholder="postgres" />
          </div>
          <div>
            <label style={lbl}>كلمة المرور</label>
            <input style={inp} type="password" value={dbOpts.password}
              onChange={e => setDbOpts({ password: e.target.value })} placeholder="••••••••" />
          </div>
        </div>
        <div>
          <label style={lbl}>اسم قاعدة البيانات (سيُنشأ تلقائياً)</label>
          <input style={{ ...inp, background: '#F3F4F6', color: '#6B7280' }}
            value={dbOpts.database} readOnly />
        </div>
      </div>

      <button onClick={test} disabled={testing || !dbOpts.password} style={{
        background: testing ? '#9CA3AF' : '#1E344F',
        color: '#fff', border: 'none', borderRadius: 8,
        padding: '9px 20px', fontSize: 13, fontWeight: 600,
        cursor: (testing || !dbOpts.password) ? 'not-allowed' : 'pointer',
        alignSelf: 'flex-start', fontFamily: 'inherit',
      }}>
        {testing ? '⏳ جارٍ الاختبار...' : '🔌 اختبار الاتصال'}
      </button>

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

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={prevStep} style={btnSecondary}>◀ السابق</button>
        <button onClick={nextStep} disabled={!testResult?.ok} style={{
          ...btnPrimary, opacity: testResult?.ok ? 1 : 0.4,
          cursor: testResult?.ok ? 'pointer' : 'not-allowed',
        }}>
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
