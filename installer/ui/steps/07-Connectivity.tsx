import { useInstallerStore } from '../store/installer.store';
import type { ConnectivityMode } from '../../core/types';

const CONNECTIVITY_MODES: {
  id: ConnectivityMode;
  icon: string;
  title: string;
  subtitle: string;
  tags: string[];
  recommended?: boolean;
}[] = [
  {
    id:          'always-online',
    icon:        '🌍',
    title:       'متصل دائماً (Always Online)',
    subtitle:    'الجهاز متصل بالإنترنت دائماً — البيانات تُزامَن فورياً ولا حاجة لوضع أوفلاين',
    tags:        ['بيانات فورية', 'أبسط إعداداً', 'يتطلب إنترنت'],
    recommended: true,
  },
  {
    id:       'offline-first',
    icon:     '📴',
    title:    'أوفلاين أولاً (Offline First)',
    subtitle: 'الجهاز يعمل بدون إنترنت ويزامن تلقائياً عند الاتصال — مناسب للبيئات غير المستقرة',
    tags:     ['يعمل بدون إنترنت', 'مزامنة تلقائية', 'DB محلية'],
  },
  {
    id:       'lan-only',
    icon:     '🔗',
    title:    'شبكة محلية فقط (LAN Only)',
    subtitle: 'الجهاز يتصل فقط بالشبكة الداخلية — لا إنترنت ولا مزامنة خارجية',
    tags:     ['شبكة داخلية', 'آمن', 'بدون إنترنت'],
  },
  {
    id:       'internet+lan',
    icon:     '🔀',
    title:    'إنترنت + شبكة محلية (Hybrid)',
    subtitle: 'يعمل على الشبكة المحلية ويدعم الاتصال بالإنترنت للتحديثات والسحابة',
    tags:     ['أقصى مرونة', 'شبكة + إنترنت', 'مناسب للفروع'],
  },
];

export default function Step08Connectivity() {
  const { connectivityMode, setConnectivityMode, nextStep, prevStep } = useInstallerStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* العنوان */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
          🌐 طريقة الاتصال بالشبكة
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          حدِّد كيف يتصل هذا الجهاز بالشبكة — يُحفظ في الإعدادات لنظام المزامنة
        </p>
      </div>

      {/* البطاقات */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CONNECTIVITY_MODES.map(m => {
          const selected = connectivityMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setConnectivityMode(m.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
                background: selected ? '#EBF5FF' : '#fff',
                border: `2px solid ${selected ? '#3B82F6' : '#E5E0D8'}`,
                borderRadius: 12, cursor: 'pointer', textAlign: 'right',
                fontFamily: 'inherit', transition: 'all 0.15s', width: '100%',
              }}
            >
              <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{m.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700,
                  color: selected ? '#1D4ED8' : '#1E344F',
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3,
                }}>
                  {m.title}
                  {m.recommended && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#059669',
                      background: '#D1FAE5', padding: '1px 7px', borderRadius: 10,
                    }}>
                      موصى به
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>{m.subtitle}</div>
                {/* Tags */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {m.tags.map(tag => (
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

      {/* ملاحظة حسب الاختيار */}
      {connectivityMode === 'offline-first' && (
        <div style={{
          padding: '10px 14px', background: '#FFFBEB', borderRadius: 8, fontSize: 12,
          border: '1px solid #FCD34D', color: '#92400E',
        }}>
          ℹ️ وضع أوفلاين يتطلب تفعيل <b>طريقة وصول Offline</b> في الخطوة السابقة لضمان عمل المزامنة
        </div>
      )}
      {connectivityMode === 'lan-only' && (
        <div style={{
          padding: '10px 14px', background: '#F0F9FF', borderRadius: 8, fontSize: 12,
          border: '1px solid #BAE6FD', color: '#0369A1',
        }}>
          ℹ️ في وضع LAN فقط، التحديثات التلقائية ستكون معطلة — يجب التحديث يدوياً
        </div>
      )}

      {/* ملخص الإعدادات حتى الآن */}
      <Summary />

      {/* التنقل */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={prevStep} style={btnSecondary}>◀ السابق</button>
        <button onClick={nextStep} style={btnPrimary}>التالي ▶</button>
      </div>
    </div>
  );
}

// ── ملخص الإعدادات المختارة حتى الآن ──────────────────────────────────────────
function Summary() {
  const { deploymentType, accessModes, databaseMode, machineRole } = useInstallerStore();

  const items: { label: string; value: string; icon: string }[] = [
    { icon: '🏗️', label: 'نوع التثبيت',     value: DEPLOY_LABELS[deploymentType] ?? deploymentType },
    { icon: '🖥️', label: 'طرق الاستخدام',   value: accessModes.map(m => ACCESS_LABELS[m]).join(' + ') },
    { icon: '🗄️', label: 'قاعدة البيانات',   value: DB_LABELS[databaseMode] ?? databaseMode },
    { icon: '🔧', label: 'دور الجهاز',        value: ROLE_LABELS[machineRole] ?? machineRole },
  ];

  return (
    <div style={{
      background: '#F8FAFC', borderRadius: 10, padding: '12px 16px',
      border: '1px solid #E2E8F0',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
        📋 ملخص الإعدادات حتى الآن
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
        {items.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>{item.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1E344F' }}>{item.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const DEPLOY_LABELS: Record<string, string> = {
  'server':        'سيرفر رئيسي',
  'client':        'عميل',
  'server+client': 'سيرفر + عميل',
  'branch':        'فرع',
  'cloud':         'سحابي',
};
const ACCESS_LABELS: Record<string, string> = {
  desktop: 'سطح المكتب',
  web:     'متصفح',
  offline: 'أوفلاين',
};
const DB_LABELS: Record<string, string> = {
  'local-install':  'تثبيت جديد',
  'local-existing': 'موجود محلياً',
  'remote':         'بعيد (Remote)',
  'cloud':          'سحابي',
};
const ROLE_LABELS: Record<string, string> = {
  'main-server':        'سيرفر رئيسي',
  'branch-server':      'سيرفر فرع',
  'client-workstation': 'محطة عمل',
  'mobile-workstation': 'محمول',
};

const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #406B93, #2d5070)', color: '#fff',
  border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 13,
  fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
};
const btnSecondary: React.CSSProperties = {
  background: '#fff', color: '#6B7280', border: '1px solid #D1D5DB',
  borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};
