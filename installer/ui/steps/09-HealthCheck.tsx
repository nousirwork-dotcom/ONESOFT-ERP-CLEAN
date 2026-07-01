import { useState, useEffect } from 'react';
import { useInstallerStore } from '../store/installer.store';
import type { HealthCheckResult } from '../../core/types';

const STATUS_ICON: Record<string, string> = {
  healthy: '✅', unhealthy: '❌', warning: '⚠️', checking: '⏳', skipped: '⏭️',
};
const STATUS_COLOR: Record<string, string> = {
  healthy: '#15803D', unhealthy: '#B91C1C', warning: '#D97706', checking: '#6B7280', skipped: '#9CA3AF',
};

export default function Step09HealthCheck() {
  const { dbOpts, setHealthReport, healthReport, nextStep } = useInstallerStore();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<HealthCheckResult[]>([]);

  const run = async () => {
    setLoading(true);
    setResults([]);
    const report = await window.installer?.runHealthCheck?.({
      dbOpts: { host: dbOpts.host, port: dbOpts.port, database: dbOpts.database, user: 'onesoft_app', password: dbOpts.password },
      backendPort: 3000,
      frontendPort: 5000,
    });
    if (report) {
      setHealthReport(report);
      setResults(report.results);
    }
    setLoading(false);
  };

  useEffect(() => { run(); }, []);

  const passed = results.filter(r => r.status === 'healthy').length;
  const total  = results.filter(r => r.status !== 'skipped').length;
  const allOk  = healthReport?.allHealthy ?? false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
            🏥 فحص صحة النظام
          </h2>
          <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
            التحقق من أن جميع مكونات النظام تعمل بصحة
          </p>
        </div>
        <button onClick={run} disabled={loading} style={{
          background: '#fff', border: '1px solid #D1D5DB', borderRadius: 8,
          padding: '7px 14px', fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer',
          color: '#374151', fontFamily: 'inherit',
        }}>
          {loading ? '⏳' : '🔄 إعادة'} الفحص
        </button>
      </div>

      {/* Summary */}
      {!loading && results.length > 0 && (
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: allOk ? '#F0FDF4' : '#FFF7ED',
          border: `1px solid ${allOk ? '#86EFAC' : '#FCD34D'}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 28 }}>{allOk ? '✅' : '⚠️'}</span>
          <div>
            <div style={{ fontWeight: 700, color: '#1E344F', fontSize: 14 }}>
              {allOk ? 'النظام يعمل بكفاءة تامة' : 'بعض المكونات تحتاج مراجعة'}
            </div>
            <div style={{ color: '#6B7280', fontSize: 12 }}>
              {passed}/{total} فحص ناجح
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading && results.length === 0 ? (
          [1,2,3,4,5,6].map(i => (
            <div key={i} style={{ height: 50, background: '#fff', borderRadius: 8, border: '1px solid #E5E0D8' }} />
          ))
        ) : (
          results.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#fff', borderRadius: 8, padding: '10px 14px',
              border: `1px solid ${r.status === 'unhealthy' ? '#FCA5A5' : r.status === 'warning' ? '#FCD34D' : '#E5E0D8'}`,
            }}>
              <span style={{ fontSize: 18 }}>{STATUS_ICON[r.status] ?? '⏳'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#1E344F', fontSize: 13 }}>{r.label}</div>
                {r.detail && (
                  <div style={{ fontSize: 11, color: STATUS_COLOR[r.status] ?? '#6B7280', marginTop: 1 }}>
                    {r.detail}{r.responseMs ? ` — ${r.responseMs}ms` : ''}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={nextStep} style={btnPrimary}>
          إنهاء التثبيت ▶
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
