import { useInstallerStore } from '../store/installer.store';

const TELEMETRY_OPTIONS: {
  key: 'crashReports' | 'diagnosticLogs' | 'usageStatistics';
  icon:  string;
  title: string;
  desc:  string;
}[] = [
  {
    key:   'crashReports',
    icon:  '🐛',
    title: 'تقارير الأعطال',
    desc:  'إرسال تقرير تلقائي عند توقف التطبيق بشكل غير متوقع — يساعد في إصلاح الأخطاء بسرعة',
  },
  {
    key:   'diagnosticLogs',
    icon:  '📋',
    title: 'سجلات التشخيص',
    desc:  'مشاركة سجلات الأداء والأخطاء — لا تحتوي على بيانات مالية أو شخصية',
  },
  {
    key:   'usageStatistics',
    icon:  '📊',
    title: 'إحصاءات الاستخدام',
    desc:  'بيانات مجهولة الهوية عن الميزات الأكثر استخداماً — تساعد في تحديد الأولويات',
  },
];

export default function Step12Telemetry() {
  const { telemetry, setTelemetry, nextStep, prevStep } = useInstallerStore();

  const anyEnabled = telemetry.crashReports || telemetry.diagnosticLogs || telemetry.usageStatistics;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* العنوان */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
          🔒 الخصوصية والتشخيص
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          جميع الخيارات معطلة افتراضياً — يمكنك تفعيل ما تريد مشاركته طوعاً
        </p>
      </div>

      {/* إشعار الخصوصية */}
      <div style={{
        padding: '12px 16px', background: '#F0F9FF', borderRadius: 10,
        border: '1px solid #BAE6FD', fontSize: 12, color: '#0369A1',
        lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>🔐 التزام الخصوصية</div>
        <ul style={{ margin: '0 20px 0 0', padding: 0 }}>
          <li>لا نجمع أي بيانات مالية أو تجارية أو شخصية</li>
          <li>البيانات المُرسَلة مجهولة الهوية تماماً</li>
          <li>يمكنك تغيير هذه الإعدادات في أي وقت من داخل التطبيق</li>
          <li>عدم الموافقة لا يؤثر على أداء أو وظائف OneSoft</li>
        </ul>
      </div>

      {/* خيارات التشخيص */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TELEMETRY_OPTIONS.map(opt => {
          const enabled = telemetry[opt.key];
          return (
            <div
              key={opt.key}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                background: enabled ? '#F0FDF4' : '#fff',
                border: `1.5px solid ${enabled ? '#86EFAC' : '#E5E0D8'}`,
                borderRadius: 10, transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{opt.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: enabled ? '#15803D' : '#1E344F', marginBottom: 3,
                }}>
                  {opt.title}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{opt.desc}</div>
              </div>
              {/* Toggle */}
              <button
                onClick={() => setTelemetry({ [opt.key]: !enabled })}
                style={{
                  flexShrink: 0, cursor: 'pointer', border: 'none', padding: 0,
                  background: 'transparent', marginTop: 2,
                }}
              >
                <div style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: enabled ? '#22C55E' : '#D1D5DB',
                  transition: 'background 0.2s', position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', top: 3,
                    left: enabled ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* حالة الموافقة */}
      <div style={{
        padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
        background: anyEnabled ? '#F0FDF4' : '#F9FAFB',
        border: `1px solid ${anyEnabled ? '#86EFAC' : '#E5E7EB'}`,
        color: anyEnabled ? '#15803D' : '#6B7280',
        textAlign: 'center',
      }}>
        {anyEnabled
          ? `✅ شكراً — أنت توافق على مشاركة بعض البيانات لتحسين OneSoft`
          : `🔒 الخصوصية الكاملة — لا يُرسَل أي شيء`
        }
      </div>

      {/* التنقل */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={prevStep} style={btnSecondary}>◀ السابق</button>
        <button onClick={nextStep} style={btnPrimary}>التالي ▶</button>
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
