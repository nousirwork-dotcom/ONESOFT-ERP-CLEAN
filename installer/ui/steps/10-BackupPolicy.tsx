import { useInstallerStore } from '../store/installer.store';
import type { BackupFrequency, BackupLocation } from '../../core/types';

const FREQUENCIES: { id: BackupFrequency; icon: string; label: string; desc: string }[] = [
  { id: 'disabled', icon: '🚫', label: 'معطّل', desc: 'لا نسخ احتياطي' },
  { id: 'daily',    icon: '📅', label: 'يومي',  desc: 'نسخة كل يوم' },
  { id: 'weekly',   icon: '🗓️', label: 'أسبوعي', desc: 'نسخة كل أسبوع' },
  { id: 'monthly',  icon: '📆', label: 'شهري',   desc: 'نسخة كل شهر' },
];

const LOCATIONS: {
  id: BackupLocation; icon: string; label: string; desc: string; future?: boolean;
}[] = [
  { id: 'local',   icon: '💾', label: 'محلي',          desc: 'مجلد على هذا الجهاز' },
  { id: 'network', icon: '🔗', label: 'شبكة محلية',     desc: 'مسار شبكي UNC أو mapped drive' },
  { id: 'cloud',   icon: '☁️', label: 'OneSoft Cloud',  desc: 'محجوز للمستقبل', future: true },
];

export default function Step11BackupPolicy() {
  const {
    backupPolicy,
    setBackupFrequency, toggleBackupLocation,
    setBackupRetainDays, setBackupPath,
  } = useInstallerStore();

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
          💾 سياسة النسخ الاحتياطي
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          حدِّد جدول النسخ ووجهة التخزين — البنية تُحفظ الآن، التنفيذ الفعلي في الإصدار القادم
        </p>
      </div>

      {/* ── تكرار النسخ ── */}
      <div style={{ background: '#fff', border: '1px solid #E5E0D8', borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1E344F', marginBottom: 10 }}>
          🕐 جدول النسخ
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {FREQUENCIES.map(f => (
            <button
              key={f.id}
              onClick={() => setBackupFrequency(f.id)}
              style={{
                padding: '10px 8px', textAlign: 'center',
                background: backupPolicy.frequency === f.id ? '#EBF5FF' : '#F9FAFB',
                border: `2px solid ${backupPolicy.frequency === f.id ? '#3B82F6' : '#E5E0D8'}`,
                borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 3 }}>{f.icon}</div>
              <div style={{
                fontSize: 12, fontWeight: 700,
                color: backupPolicy.frequency === f.id ? '#1D4ED8' : '#1E344F',
              }}>
                {f.label}
              </div>
              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{f.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── وجهات التخزين (تظهر فقط إذا لم تكن معطلة) ── */}
      {backupPolicy.frequency !== 'disabled' && (
        <>
          <div style={{ background: '#fff', border: '1px solid #E5E0D8', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E344F', marginBottom: 10 }}>
              📂 وجهات التخزين (يمكن اختيار أكثر من واحدة)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {LOCATIONS.map(loc => {
                const active = backupPolicy.locations.includes(loc.id);
                return (
                  <button
                    key={loc.id}
                    onClick={() => !loc.future && toggleBackupLocation(loc.id)}
                    disabled={loc.future}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      background: active ? '#EBF5FF' : loc.future ? '#FAFAFA' : '#fff',
                      border: `2px solid ${active ? '#3B82F6' : loc.future ? '#E5E7EB' : '#E5E0D8'}`,
                      borderRadius: 8, cursor: loc.future ? 'not-allowed' : 'pointer',
                      textAlign: 'right', fontFamily: 'inherit',
                      opacity: loc.future ? 0.5 : 1, width: '100%',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{loc.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 700,
                        color: active ? '#1D4ED8' : '#1E344F',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        {loc.label}
                        {loc.future && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                            background: '#F3F4F6', padding: '1px 7px', borderRadius: 10,
                          }}>
                            قريباً
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{loc.desc}</div>
                    </div>
                    <div style={{
                      width: 20, height: 20, borderRadius: 4,
                      border: `2px solid ${active ? '#3B82F6' : '#D1D5DB'}`,
                      background: active ? '#3B82F6' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {active && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── مسار النسخ المحلية (اختياري) ── */}
          {backupPolicy.locations.includes('local') && (
            <div style={{ background: '#fff', border: '1px solid #E5E0D8', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>مسار مجلد النسخ الاحتياطي (اختياري)</label>
                  <input
                    style={inp}
                    value={backupPolicy.path ?? ''}
                    onChange={e => setBackupPath(e.target.value)}
                    placeholder="C:\OneSoft Backups"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label style={lbl}>الاحتفاظ بالنسخ (يوماً)</label>
                  <input
                    style={inp} type="number" min={1} max={365}
                    value={backupPolicy.retainDays}
                    onChange={e => setBackupRetainDays(parseInt(e.target.value) || 30)}
                  />
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                اتركه فارغاً لاستخدام المسار الافتراضي: <code style={{ direction: 'ltr', display: 'inline-block' }}>C:\ProgramData\OneSoft\Backups</code>
              </div>
            </div>
          )}
        </>
      )}

      {/* ملاحظة تنفيذ */}
      <div style={{
        padding: '9px 14px', background: '#FFFBEB', borderRadius: 8,
        fontSize: 12, color: '#92400E', border: '1px solid #FCD34D',
      }}>
        ℹ️ خدمة النسخ الاحتياطي التلقائي تُفعَّل في الإصدار القادم — الإعدادات تُحفظ الآن في ملف الإعدادات
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
