import { useInstallerStore } from '../store/installer.store';
import type { LicensingMode } from '../../core/types';

const LICENSES: {
  id:       LicensingMode;
  icon:     string;
  title:    string;
  subtitle: string;
  features: string[];
  badge?:   string;
  badgeColor?: string;
  future?:  boolean;
}[] = [
  {
    id:       'trial',
    icon:     '🧪',
    title:    'تجريبي (Trial)',
    subtitle: 'مجاني لمدة 3 أشهر — كل الميزات متاحة للتجربة',
    features: ['مستخدم واحد', '3 أشهر', 'كل الميزات'],
    badge:    'الافتراضي',
    badgeColor: '#2563EB',
  },
  {
    id:       'standard',
    icon:     '⭐',
    title:    'أساسي (Standard)',
    subtitle: 'للشركات الصغيرة — الميزات الجوهرية لإدارة المحاسبة والمخزون',
    features: ['حتى 5 مستخدمين', 'محاسبة + مخزون', 'تقارير أساسية'],
  },
  {
    id:       'professional',
    icon:     '💼',
    title:    'احترافي (Professional)',
    subtitle: 'للشركات المتوسطة — ميزات متقدمة وتقارير شاملة',
    features: ['حتى 25 مستخدماً', 'كل الميزات', 'API + تكاملات'],
    badge:    'الأكثر شيوعاً',
    badgeColor: '#059669',
  },
  {
    id:       'enterprise',
    icon:     '🏢',
    title:    'مؤسسي (Enterprise)',
    subtitle: 'للمجموعات والشركات الكبيرة — متعدد الفروع + دعم مخصص',
    features: ['مستخدمون غير محدودين', 'فروع متعددة', 'دعم أولوية', 'SLA مضمون'],
  },
  {
    id:       'cloud-subscription',
    icon:     '☁️',
    title:    'اشتراك سحابي (Cloud)',
    subtitle: 'محجوز للمستقبل — اشتراك شهري/سنوي مع hosting كامل',
    features: ['SaaS', 'بدون تثبيت', 'محجوز'],
    future:   true,
  },
];

export default function Step09Licensing() {
  const { licensingMode, setLicensingMode } = useInstallerStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* العنوان */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
          🔑 نوع الترخيص
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          اختر نوع الترخيص المناسب — البنية تُحفظ في الإعدادات الآن، التفعيل يتم لاحقاً
        </p>
      </div>

      {/* البطاقات */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {LICENSES.map(lic => {
          const selected = licensingMode === lic.id;
          return (
            <button
              key={lic.id}
              onClick={() => !lic.future && setLicensingMode(lic.id)}
              disabled={lic.future}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                background: selected ? '#EBF5FF' : lic.future ? '#FAFAFA' : '#fff',
                border: `2px solid ${selected ? '#3B82F6' : lic.future ? '#E5E7EB' : '#E5E0D8'}`,
                borderRadius: 10, cursor: lic.future ? 'not-allowed' : 'pointer',
                textAlign: 'right', fontFamily: 'inherit',
                opacity: lic.future ? 0.5 : 1, transition: 'all 0.15s', width: '100%',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{lic.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: selected ? '#1D4ED8' : '#1E344F',
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2,
                }}>
                  {lic.title}
                  {lic.badge && (
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: '#fff', background: lic.badgeColor ?? '#6B7280',
                      padding: '1px 7px', borderRadius: 10,
                    }}>
                      {lic.badge}
                    </span>
                  )}
                  {lic.future && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                      background: '#F3F4F6', padding: '1px 7px', borderRadius: 10,
                    }}>
                      قريباً
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{lic.subtitle}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {lic.features.map(f => (
                    <span key={f} style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 20,
                      background: selected ? '#DBEAFE' : '#F3F4F6',
                      color: selected ? '#1D4ED8' : '#4B5563',
                      fontWeight: 600,
                    }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              {selected && (
                <span style={{ fontSize: 18, color: '#3B82F6', flexShrink: 0, marginTop: 2 }}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      {/* تنبيه */}
      <div style={{
        padding: '9px 14px', background: '#F0F9FF', borderRadius: 8,
        fontSize: 12, color: '#0369A1', border: '1px solid #BAE6FD',
      }}>
        ℹ️ الترخيص المختار يُحفظ في الإعدادات فقط — لا يتطلب مفتاح تفعيل الآن، يمكن تفعيله من داخل التطبيق لاحقاً
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
