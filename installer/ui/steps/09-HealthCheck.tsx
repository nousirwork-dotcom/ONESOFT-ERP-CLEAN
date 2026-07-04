import { useState, useEffect, useRef } from 'react';
import { useInstallerStore } from '../store/installer.store';
import type { HealthCheckResult } from '../../core/types';
import type { ServiceDiagnostics } from '../../core/services/ServiceManager';

const STATUS_ICON: Record<string, string> = {
  healthy: '✅', unhealthy: '❌', warning: '⚠️', checking: '⏳', skipped: '⏭️',
};
const STATUS_COLOR: Record<string, string> = {
  healthy: '#15803D', unhealthy: '#B91C1C', warning: '#D97706', checking: '#6B7280', skipped: '#9CA3AF',
};
const STATUS_BG: Record<string, string> = {
  healthy: '#F0FDF4', unhealthy: '#FEF2F2', warning: '#FFFBEB', checking: '#F9FAFB', skipped: '#F9FAFB',
};
const STATUS_BORDER: Record<string, string> = {
  healthy: '#86EFAC', unhealthy: '#FCA5A5', warning: '#FCD34D', checking: '#E5E7EB', skipped: '#E5E7EB',
};

function arabicDetail(id: string, detail: string, bPort = 3000): string {
  if (!detail) return '';
  if (detail.includes('ECONNREFUSED') || detail.includes('connection refused')) {
    if (id.includes('backend') || detail.includes(String(bPort))) return `الخادم لا يستجيب على المنفذ ${bPort}`;
    return 'الاتصال مرفوض — الخدمة لم تبدأ بعد';
  }
  if (detail.includes('password authentication failed')) return 'كلمة مرور قاعدة البيانات غير صحيحة — تحقق من ملف onesoft.config.json';
  if (detail.includes('role') && detail.includes('does not exist')) return 'مستخدم قاعدة البيانات غير موجود — أعد تشغيل التثبيت';
  if (detail.includes('relation') && detail.includes('does not exist')) return 'جدول مفقود — يرجى إعادة تشغيل Migrations';
  if (detail.includes('ETIMEDOUT') || detail.includes('timed out')) return 'انتهت مهلة الاتصال — تأكد من تشغيل الخدمة';
  if (detail.includes('not installed') || detail.includes('not-installed')) return 'الخدمة غير مثبتة';
  if (detail.includes('stopped')) return 'الخدمة متوقفة — اضغط "إعادة تشغيل الخدمات"';
  return detail;
}

export default function Step09HealthCheck() {
  const { dbOpts, setHealthReport, healthReport } = useInstallerStore();

  const [loading,        setLoading]        = useState(true);
  const [results,        setResults]        = useState<HealthCheckResult[]>([]);
  const [restarting,     setRestarting]     = useState(false);
  const [expandedId,     setExpandedId]     = useState<string | null>(null);
  const [diagRunning,    setDiagRunning]    = useState(false);
  const [diagReport,     setDiagReport]     = useState<ServiceDiagnostics | null>(null);
  const [diagLogs,       setDiagLogs]       = useState<string[]>([]);
  const [showDiag,       setShowDiag]       = useState(false);
  const diagRef = useRef<HTMLDivElement>(null);
  const [backendPort,  setBackendPort]  = useState(3000);
  const backendPortRef  = useRef(3000);

  // قراءة المنفذ الفعلي من ملف الإعدادات — ثم تشغيل الفحص بعدها مباشرة
  useEffect(() => {
    window.installer?.getConfig?.().then((cfg: any) => {
      const bPort = cfg?.server?.backendPort  ?? 3000;
      backendPortRef.current  = bPort;
      setBackendPort(bPort);
      runCheckWithPorts(bPort);
    }).catch(() => {
      runCheckWithPorts(3000);
    });
  }, []);

  // سجل أحداث التشخيص
  useEffect(() => {
    const unsub = window.installer?.onProgress?.((e: any) => {
      if (diagRunning) {
        setDiagLogs(prev => [...prev, `[${e.level?.toUpperCase()}] ${e.message}`]);
      }
    });
    return () => unsub?.();
  }, [diagRunning]);

  useEffect(() => {
    if (diagRef.current) diagRef.current.scrollTop = diagRef.current.scrollHeight;
  }, [diagLogs]);

  const runCheckWithPorts = async (bPort = backendPortRef.current) => {
    setLoading(true);
    setResults([]);
    const report = await window.installer?.runHealthCheck?.({
      dbOpts: {
        host: dbOpts.host, port: dbOpts.port,
        database: dbOpts.database, user: 'onesoft_app', password: dbOpts.password,
      },
      backendPort: bPort,
    });
    if (report) {
      setHealthReport(report);
      setResults(report.results);
    }
    setLoading(false);
  };

  const runCheck = async () => runCheckWithPorts();

  const restartServices = async () => {
    setRestarting(true);
    try {
      await window.installer?.restartService?.('OneSoft-Server');
      await new Promise(r => setTimeout(r, 5000));
    } catch { /* ignore */ }
    setRestarting(false);
    await runCheck();
  };

  const runDiagnose = async () => {
    setDiagRunning(true);
    setDiagLogs([]);
    setDiagReport(null);
    setShowDiag(true);
    try {
      const report = await (window.installer as any)?.diagnoseServices?.();
      setDiagReport(report ?? null);
    } catch (e: unknown) {
      setDiagLogs(prev => [...prev, `[ERROR] ${e instanceof Error ? e.message : String(e)}`]);
    }
    setDiagRunning(false);
  };

  // لا useEffect منفرد هنا — الفحص يبدأ فقط بعد تحميل config.json في useEffect أعلاه

  const passed      = results.filter(r => r.status === 'healthy').length;
  const total       = results.filter(r => r.status !== 'skipped').length;
  const allOk       = healthReport?.allHealthy ?? false;
  const hasUnhealthy = results.some(r => r.status === 'unhealthy' || r.status === 'warning');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
            🏥 فحص صحة النظام
          </h2>
          <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
            التحقق من أن جميع مكونات النظام تعمل بصحة
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {hasUnhealthy && (
            <button
              onClick={restartServices} disabled={restarting || loading}
              style={btnStyle('#406B93', '#fff', restarting || loading)}
            >
              {restarting ? '⏳ جارٍ التشغيل...' : '▶ إعادة تشغيل الخدمات'}
            </button>
          )}
          <button
            onClick={runDiagnose} disabled={diagRunning}
            style={btnStyle('#7C3AED', '#fff', diagRunning)}
          >
            {diagRunning ? '⏳ تشخيص...' : '🔬 تشخيص الخدمات'}
          </button>
          <button
            onClick={runCheck} disabled={loading || restarting}
            style={btnStyle(null, '#374151', loading || restarting)}
          >
            {loading ? '⏳' : '🔄'} إعادة الفحص
          </button>
        </div>
      </div>

      {/* ─── Summary ────────────────────────────────────────────────────────── */}
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
              onClick={restartServices} disabled={restarting || loading}
              style={btnStyle('#F97316', '#fff', restarting || loading)}
            >
              {restarting ? '⏳...' : '🔧 إصلاح تلقائي'}
            </button>
          )}
        </div>
      )}

      {/* ─── نتائج الفحص ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading && results.length === 0
          ? [1,2,3,4,5,6].map(i => (
              <div key={i} style={{
                height: 54, background: '#fff', borderRadius: 8,
                border: '1px solid #E5E0D8', animation: 'pulse 1.5s infinite',
              }} />
            ))
          : results.map(r => {
              const friendly   = arabicDetail(r.id, r.detail ?? '', backendPort);
              const isExpanded = expandedId === r.id;
              return (
                <div key={r.id} style={{
                  background: STATUS_BG[r.status] ?? '#fff',
                  borderRadius: 8, padding: '10px 16px',
                  border: `1px solid ${STATUS_BORDER[r.status] ?? '#E5E0D8'}`,
                  width: '100%', boxSizing: 'border-box',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18 }}>{STATUS_ICON[r.status] ?? '⏳'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#1E344F', fontSize: 13 }}>{r.label}</div>
                      {friendly && (
                        <div style={{ fontSize: 11, color: STATUS_COLOR[r.status] ?? '#6B7280', marginTop: 2 }}>
                          {friendly}{r.responseMs ? ` — ${r.responseMs}ms` : ''}
                        </div>
                      )}
                    </div>
                    {r.status === 'unhealthy' && r.detail && friendly !== r.detail && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        style={{
                          background: 'none', border: '1px solid #E5E0D8', borderRadius: 6,
                          color: '#9CA3AF', fontSize: 10, cursor: 'pointer',
                          padding: '2px 8px', fontFamily: 'inherit', whiteSpace: 'nowrap',
                        }}
                      >
                        {isExpanded ? 'إخفاء' : 'تفاصيل'}
                      </button>
                    )}
                  </div>
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
        }
      </div>

      {/* ─── لوحة التشخيص ─────────────────────────────────────────────────── */}
      {showDiag && (
        <div style={{
          background: '#0F172A', borderRadius: 12,
          border: '1px solid #334155', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          flex: 1, minHeight: 280,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: '1px solid #1E293B',
          }}>
            <span style={{ color: '#7C3AED', fontWeight: 700, fontSize: 13 }}>
              🔬 تقرير التشخيص {diagRunning ? '⏳' : ''}
            </span>
            <button
              onClick={() => setShowDiag(false)}
              style={{
                background: 'none', border: 'none', color: '#64748B',
                cursor: 'pointer', fontSize: 16, padding: 0,
              }}
            >✕</button>
          </div>

          {/* سجل الأحداث */}
          <div
            ref={diagRef}
            style={{
              flex: 1, overflowY: 'auto',
              padding: '10px 14px', fontFamily: 'monospace', fontSize: 11,
              display: 'flex', flexDirection: 'column', gap: 2,
            }}
          >
            {diagLogs.map((line, i) => {
              const level = line.startsWith('[ERROR]') ? '#F87171'
                          : line.startsWith('[SUCCESS]') ? '#4ADE80'
                          : line.startsWith('[WARNING]') ? '#FBBF24'
                          : '#94A3B8';
              return (
                <div key={i} style={{ color: level, direction: 'ltr', textAlign: 'left' }}>
                  {line}
                </div>
              );
            })}
            {diagRunning && (
              <div style={{ color: '#7C3AED' }}>⏳ جارٍ التشخيص...</div>
            )}
          </div>

          {/* ملخص التقرير */}
          {diagReport && !diagRunning && (
            <div style={{
              borderTop: '1px solid #1E293B', padding: '12px 14px',
              display: 'grid', gap: 8,
            }}>
              <DiagRow label="صلاحيات Admin"     value={diagReport.isAdmin ? 'نعم ✅' : 'لا ❌'}     ok={diagReport.isAdmin} />
              <DiagRow label="Node.js"           value={`${diagReport.nodeVersion} — ${diagReport.nodePath}`} ok />
              <DiagRow label="NSSM"              value={diagReport.nssmVersion} ok={fs_exists_hint(diagReport.nssmPath)} />
              <DiagRow label="Backend Script"    value={diagReport.backendScript}  ok={diagReport.backendExists} />
              <DiagRow label="اختبار Backend"    value={diagReport.backendTest.ok  ? 'نجح ✅' : 'فشل ❌'} ok={diagReport.backendTest.ok} />
              <DiagRow label="OneSoft-Server"    value={diagReport.serviceBackendStatus}  ok={diagReport.serviceBackendStatus === 'running'} />
              <DiagRow label={`المنفذ ${backendPort}`}   value={diagReport.port3000 ? 'يستجيب ✅' : 'لا يستجيب ❌'} ok={diagReport.port3000} />
              {diagReport.logPath && (
                <div style={{ color: '#64748B', fontSize: 10, marginTop: 4 }}>
                  📄 التقرير الكامل: {diagReport.logPath}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── تعليمات المساعدة ──────────────────────────────────────────────── */}
      {!loading && hasUnhealthy && !showDiag && (
        <div style={{
          background: '#F8FAFC', border: '1px solid #E5E0D8', borderRadius: 8,
          padding: '10px 14px', fontSize: 11, color: '#6B7280',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        }}>
          <span>
            💡 اضغط "تشخيص الخدمات" لمعرفة السبب الحقيقي للمشكلة بالتفصيل.
          </span>
          <button
            onClick={() => window.installer?.openUrl?.('services.msc')}
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

// ─── مساعد: صف في جدول التشخيص ────────────────────────────────────────────

function DiagRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8,
      fontSize: 11, fontFamily: 'monospace',
    }}>
      <span style={{ color: '#64748B', minWidth: 120, flexShrink: 0 }}>{label}:</span>
      <span style={{
        color: ok === false ? '#F87171' : ok === true ? '#4ADE80' : '#94A3B8',
        wordBreak: 'break-all',
      }}>
        {value || '—'}
      </span>
    </div>
  );
}

function fs_exists_hint(p: string): boolean {
  return p !== 'nssm' && p.length > 4;
}

function btnStyle(bg: string | null, color: string, disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? '#9CA3AF' : (bg ?? '#fff'),
    color: disabled ? '#fff' : color,
    border: bg ? 'none' : '1px solid #D1D5DB',
    borderRadius: 8, padding: '8px 16px', fontSize: 12,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', opacity: disabled ? 0.7 : 1,
    whiteSpace: 'nowrap' as const,
  };
}
