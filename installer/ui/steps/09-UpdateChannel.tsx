import { useInstallerStore } from '../store/installer.store';
import type { UpdateChannel } from '../../core/types';

const CHANNELS: {
  id:          UpdateChannel;
  icon:        string;
  title:       string;
  subtitle:    string;
  tags:        string[];
  recommended?: boolean;
  restricted?: boolean;
}[] = [
  {
    id:          'stable',
    icon:        '🟢',
    title:       'مستقر (Stable)',
    subtitle:    'إصدارات مختبرة ومعتمدة — موصى به لجميع العملاء الإنتاجيين',
    tags:        ['مختبر بالكامل', 'أبطأ دورة', 'الأكثر أماناً'],
    recommended: true,
  },
  {
    id:       'beta',
    icon:     '🟡',
    title:    'تجريبي (Beta)',
    subtitle: 'ميزات جديدة قبل الإطلاق الرسمي — للعملاء الراغبين في التجربة المبكرة',
    tags:     ['ميزات مبكرة', 'قد يحوي أخطاء', 'ملاحظات مطلوبة'],
  },
  {
    id:         'internal-testing',
    icon:       '🔴',
    title:      'اختبار داخلي (Internal Testing)',
    subtitle:   'للفريق الداخلي وبيئات الاختبار فقط — لا يصلح للبيئات الإنتاجية',
    tags:       ['فريق OneSoft فقط', 'غير مستقر', 'للاختبار حصراً'],
    restricted: true,
  },
];

export default function Step10UpdateChannel() {
  const { updateChannel, setUpdateChannel, nextStep, prevStep } = useInstallerStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* العنوان */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
          📡 قناة التحديث
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          حدِّد القناة التي سيتلقى منها هذا الجهاز التحديثات التلقائية
        </p>
      </div>

      {/* البطاقات */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CHANNELS.map(ch => {
          const selected = updateChannel === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => setUpdateChannel(ch.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
                background: selected ? '#EBF5FF' : '#fff',
                border: `2px solid ${selected ? '#3B82F6' : '#E5E0D8'}`,
                borderRadius: 12, cursor: 'pointer', textAlign: 'right',
                fontFamily: 'inherit', transition: 'all 0.15s', width: '100%',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{ch.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700,
                  color: selected ? '#1D4ED8' : '#1E344F',
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3,
                }}>
                  {ch.title}
                  {ch.recommended && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#fff',
                      background: '#059669', padding: '1px 7px', borderRadius: 10,
                    }}>
                      موصى به
                    </span>
                  )}
                  {ch.restricted && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#fff',
                      background: '#DC2626', padding: '1px 7px', borderRadius: 10,
                    }}>
                      مقيّد
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>{ch.subtitle}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ch.tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                      background: selected ? '#DBEAFE' : '#F3F4F6',
                      color: selected ? '#1D4ED8' : '#6B7280',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              {selected && (
                <span style={{ fontSize: 20, color: '#3B82F6', flexShrink: 0, marginTop: 2 }}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      {/* تحذير للقناة الداخلية */}
      {updateChannel === 'internal-testing' && (
        <div style={{
          padding: '10px 14px', background: '#FEF2F2', borderRadius: 8,
          fontSize: 12, color: '#B91C1C', border: '1px solid #FCA5A5',
          fontWeight: 600,
        }}>
          ⚠️ القناة الداخلية مخصصة لفريق OneSoft فقط — لا تستخدمها في بيئة عمل إنتاجية
        </div>
      )}

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
