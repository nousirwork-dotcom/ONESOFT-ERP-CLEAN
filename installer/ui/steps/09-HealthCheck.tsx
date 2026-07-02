import { useState, useEffect } from 'react';
import { useInstallerStore } from '../store/installer.store';
import type { HealthCheckResult } from '../../core/types';

const STATUS_ICON: Record<string, string> = {
  healthy: '✅', unhealthy: '❌', warning: '⚠️', checking: '⏳', skipped: '⏭️',
};
const STATUS_COLOR: Record<string, string> = {
  healthy: '#15803D', unhealthy: '#B91C1C', warning: '#D97706', checking: '#6B7280', skipped: '#9CA3AF',
};

// رسائل عربية للأخطاء الشائعة
function arabicDetail(id: string, detail: string): string {
  if (!detail) return '';
  if (detail.includes('ECONNREFUSED') || detail.includes('connection refused')) {
    if (id.includes('backend') || detail.includes('3000')) return 'الخادم الخلفي لا يستجيب على المنفذ 3000';
    if (id.includes('frontend') || detail.includes('5000')) return 'الخادم الأمامي لا يستجيب على المنفذ 5000';
    return 'الاتصال مرفوض — الخدمة لم تبدأ بعد';
  }
  if (detail.includes('password authentication failed')) return 'كلمة مرور قاعدة البيانات غير صحيحة';
  if (detail.includes('relation') && detail.includes('does not exist')) return 'جدول مفقود في قاعدة البيانات — يرجى إعادة تشغيل Migrations';
  if (detail.includes('ETIMEDOUT') || detail.includes('timed out')) return 'انتهت مهلة الاتصال — تأكد من تشغيل الخدمة';
  if (detail.includes('not installed') || detail.includes('not-installed')) return 'الخدمة غير مثبتة';
  if (detail.includes('stopped')) return 'الخدمة متوقفة — اضغط "إعادة تشغيل الخدمات"';
  return detail;
}

export default function Step09HealthCheck() {
  const { dbOpts, setHealthReport, healthReport } = useInstallerStore();
  const [loading,         setLoading]         = useState(true);
  const [results,         setResults]         = useState<HealthCheckResult[]>([]);
  const [restarting,      setRestarting]      = useState(false);
  const [expandedId,      setExpandedId]      = useState<string | null>(null);

  const runCheck = async () => {
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

  const restartServices = async () => {
    setRestarting(true);
    try {
      await window.installer?.restartService?.('OneSoft-Server');
      // انتظر 5 ثوانٍ ثم شغّل Frontend
      await new Promise(r => setTimeout(r, 5000));
      await window.installer?.restartService?.('OneSoft-Client');
      // انتظر 3 ثوانٍ ثم أعد الفحص
      await new Promise(r => setTimeout(r, 3000));
    } catch {
      // ignore
    }
    setRestarting(false);
    await runCheck();
  };

  const openServiceManager = () => {
    window.installer?.openUrl?.('services.msc');
  };

  useEffect(() => { runCheck(); }, []);

  const passed = results.filter(r => r.status === 'healthy').length;
  const total  = results.filter(r => r.status !== 'skipped').length;
  const allOk  = healthReport?.allHealthy ?? false;
  const hasUnhealthy = results.some(r => r.status === 'unhealthy' || r.status === 'warning');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
            🏥 فحص صحة النظام
          </h2>
          <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
            التحقق من أن جميع مكونات النظام تعمل بصحة
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasUnhealthy && (
            <button
              onClick={restartServices}
              disabled={restarting || loading}
              style={{
                background: 'linear-gradient(135deg, #406B93, #2d5070)',
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 16px', fontSize: 12, cursor: (restarting || loading) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', opacity: (restarting || loading) ? 0.6 : 1,
              }}
            >
              {restarting ? '⏳ جارٍ التشغيل...' : '▶ إعادة تشغيل الخدمات'}
            </button>
          )}
          <button
            onClick={runCheck}
            disabled={loading || restarting}
            style={{
              background: '#fff', border: '1px solid #D1D5DB', borderRadius: 8,
              padding: '8px 14px', fontSize: 12, cursor: (loading || restarting) ? 'not-allowed' : 'pointer',
              color: '#374151', fontFamily: 'inherit',
            }}
          >
            {loading ? '⏳' : '🔄'} إعادة الفحص
          </button>
        </div>
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
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#1E344F', fontSize: 14 }}>
              {allOk ? 'النظام يعمل بكفاءة تامة' : 'بعض المكونات تحتاج مراجعة'}
            </div>
            <div style={{ color: '#6B7280', fontSize: 12 }}>
              {passed}/{total} فحص ناجح
              {!allOk && ' — اضغط "إعادة تشغيل الخدمات" لمحاولة الإصلاح التلقائي'}
            </div>
          </div>
          {!allOk && (
            <button
              onClick={restartServices}
              disabled={restarting || loading}
              style={{
                background: '#F97316', color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {restarting ? '⏳...' : '🔧 إصلاح تلقائي'}
            </button>
          )}
        </div>
      )}

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading && results.length === 0 ? (
          [1,2,3,4,5,6].map(i => (
            <div key={i} style={{
              height: 50, background: '#fff', borderRadius: 8,
              border: '1px solid #E5E0D8', animation: 'pulse 1.5s infinite',
            }} />
          ))
        ) : (
          results.map(r => {
            const friendlyDetail = arabicDetail(r.id, r.detail ?? '');
            const isExpanded     = expandedId === r.id;
            const rawDiffers     = friendlyDetail !== r.detail;

            return (
              <div key={r.id} style={{
                background: '#fff', borderRadius: 8, padding: '10px 14px',
                border: `1px solid ${
                  r.status === 'unhealthy' ? '#FCA5A5'
                  : r.status === 'warning' ? '#FCD34D'
                  : '#E5E0D8'
                }`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 18 }}>{STATUS_ICON[r.status] ?? '⏳'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#1E344F', fontSize: 13 }}>{r.label}</div>
                    {friendlyDetail && (
                      <div style={{ fontSize: 11, color: STATUS_COLOR[r.status] ?? '#6B7280', marginTop: 1 }}>
                        {friendlyDetail}
                        {r.responseMs ? ` — ${r.responseMs}ms` : ''}
                      </div>
                    )}
                  </div>
                  {/* زر التفاصيل التقنية */}
                  {r.status === 'unhealthy' && rawDiffers && r.detail && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      style={{
                        background: 'none', border: '1px solid #E5E0D8', borderRadius: 6,
                        color: '#9CA3AF', fontSize: 10, cursor: 'pointer', padding: '2px 8px',
                        fontFamily: 'inherit',
                      }}
                    >
                      {isExpanded ? 'إخفاء' : 'تفاصيل'}
                    </button>
                  )}
                </div>
                {/* Technical details expanded */}
                {isExpanded && r.detail && (
                  <pre style={{
                    margin: '8px 0 0', padding: '8px 10px', borderRadius: 6,
                    background: '#1E344F', color: '#93C5FD',
                    fontSize: 10, fontFamily: 'monospace', overflowX: 'auto',
                    direction: 'ltr', textAlign: 'left', whiteSpace: 'pre-wrap',
                  }}>
                    {r.detail}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Help footer when there are errors */}
      {!loading && hasUnhealthy && (
        <div style={{
          background: '#F8FAFC', border: '1px solid #E5E0D8', borderRadius: 8,
          padding: '10px 14px', fontSize: 11, color: '#6B7280',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        }}>
          <span>
            💡 إذا استمر الخطأ بعد الإصلاح التلقائي، افتح مدير الخدمات وتأكد من تشغيل OneSoft-Server وOneSoft-Client.
          </span>
          <button
            onClick={openServiceManager}
            style={{
              background: '#fff', border: '1px solid #D1D5DB', borderRadius: 6,
              color: '#374151', fontSize: 11, cursor: 'pointer', padding: '4px 12px',
              fontFamily: 'inherit',
            }}
          >
            فتح مدير الخدمات
          </button>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}
