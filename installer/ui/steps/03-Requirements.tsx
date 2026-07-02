import { useState, useEffect } from 'react';
import { useInstallerStore } from '../store/installer.store';
import type { RequirementResult } from '../../core/types';

const STATUS_ICON: Record<string, string> = {
  pass: '✅', fail: '❌', warn: '⚠️', checking: '⏳', fixing: '🔧',
};
const STATUS_COLOR: Record<string, string> = {
  pass: '#16A34A', fail: '#B91C1C', warn: '#D97706', checking: '#6B7280', fixing: '#406B93',
};

export default function Step03Requirements() {
  const { requirementsReport, setRequirementsReport } = useInstallerStore();
  const [loading, setLoading] = useState(false);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [pgPasswordPrompt, setPgPasswordPrompt] = useState(false);
  const [pgPassword, setPgPassword] = useState('');
  const [pgError, setPgError] = useState('');

  const run = async () => {
    setLoading(true);
    const report = await window.installer?.checkRequirements?.();
    if (report) setRequirementsReport(report);
    setLoading(false);
  };

  useEffect(() => { run(); }, []);

  const fix = async (id: string) => {
    if (id === 'postgresql') {
      setPgPasswordPrompt(true);
      return;
    }
    setFixingId(id);
    await window.installer?.fixRequirement?.(id);
    setFixingId(null);
    await run();
  };

  const fixPostgres = async () => {
    if (!pgPassword || pgPassword.length < 8) {
      setPgError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    setPgPasswordPrompt(false);
    setPgError('');
    setFixingId('postgresql');
    await window.installer?.fixRequirement?.('postgresql', pgPassword);
    setFixingId(null);
    setPgPassword('');
    await run();
  };

  const results: RequirementResult[] = requirementsReport?.results ?? [];
  const canContinue = requirementsReport?.canContinue ?? false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ✅ نموذج كلمة مرور PostgreSQL عند التثبيت التلقائي */}
      {pgPasswordPrompt && (
        <div style={{
          background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: 10,
          padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontWeight: 700, color: '#1E344F', fontSize: 14 }}>
            🔐 تثبيت PostgreSQL تلقائياً
          </div>
          <div style={{ fontSize: 12, color: '#4B5563' }}>
            أدخل كلمة مرور لمستخدم postgres — ستُستخدم فقط للتثبيت الصامت
          </div>
          <input
            type="password"
            placeholder="كلمة مرور superuser (8 أحرف على الأقل)"
            value={pgPassword}
            onChange={e => { setPgPassword(e.target.value); setPgError(''); }}
            style={{
              background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7,
              padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
              color: '#1E344F', outline: 'none', width: '100%', boxSizing: 'border-box',
            }}
          />
          {pgError && <div style={{ fontSize: 11, color: '#B91C1C' }}>{pgError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={fixPostgres} style={{ ...btnPrimary, padding: '7px 18px', fontSize: 12 }}>
              🚀 تثبيت PostgreSQL
            </button>
            <button onClick={() => { setPgPasswordPrompt(false); setPgPassword(''); setPgError(''); }}
              style={{ ...btnSecondary, padding: '7px 14px', fontSize: 12 }}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
            🔍 فحص متطلبات النظام
          </h2>
          <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
            يفحص النظام جاهزية البيئة قبل التثبيت
          </p>
        </div>
        <button onClick={run} disabled={loading} style={{
          background: '#fff', border: '1px solid #D1D5DB', borderRadius: 8,
          padding: '8px 16px', fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer',
          color: '#374151', fontFamily: 'inherit',
        }}>
          {loading ? '⏳ جارٍ الفحص...' : '🔄 إعادة الفحص'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && results.length === 0 ? (
          [1,2,3,4,5,6,7,8].map(i => (
            <div key={i} style={{
              height: 52, background: '#fff', borderRadius: 8,
              border: '1px solid #E5E0D8', animation: 'pulse 1.5s infinite',
            }} />
          ))
        ) : (
          results.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#fff', borderRadius: 8, padding: '10px 14px',
              border: `1px solid ${r.status === 'fail' ? '#FCA5A5' : r.status === 'warn' ? '#FCD34D' : '#E5E0D8'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>
                  {fixingId === r.id ? '🔧' : STATUS_ICON[r.status] ?? '⏳'}
                </span>
                <div>
                  <div style={{ fontWeight: 600, color: '#1E344F', fontSize: 13 }}>{r.label}</div>
                  {r.detail && (
                    <div style={{ fontSize: 11, color: STATUS_COLOR[r.status] ?? '#6B7280', marginTop: 1 }}>
                      {r.detail}
                    </div>
                  )}
                </div>
              </div>
              {r.status === 'fail' && r.fixable && (
                <button onClick={() => fix(r.id)} disabled={fixingId === r.id} style={{
                  background: '#406B93', color: '#fff', border: 'none', borderRadius: 6,
                  padding: '6px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}>
                  {fixingId === r.id ? 'جارٍ التثبيت...' : r.fixLabel ?? 'تثبيت تلقائي'}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {!loading && results.length > 0 && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: canContinue ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${canContinue ? '#86EFAC' : '#FCA5A5'}`,
          fontSize: 13, fontWeight: 600,
          color: canContinue ? '#15803D' : '#B91C1C',
        }}>
          {canContinue
            ? '✅ النظام جاهز — يمكنك المتابعة'
            : '❌ يجب إصلاح المتطلبات الناقصة قبل المتابعة'}
        </div>
      )}

    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #406B93, #2d5070)',
  color: '#fff', border: 'none', borderRadius: 8,
  padding: '10px 28px', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
};
const btnSecondary: React.CSSProperties = {
  background: '#fff', color: '#6B7280', border: '1px solid #D1D5DB',
  borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};
