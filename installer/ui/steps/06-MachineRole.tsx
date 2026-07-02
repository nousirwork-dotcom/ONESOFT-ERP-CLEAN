import { useInstallerStore } from '../store/installer.store';
import type { MachineRole } from '../../core/types';

const ROLES: {
  id: MachineRole;
  icon: string;
  title: string;
  subtitle: string;
  tags: string[];
  future?: boolean;
}[] = [
  {
    id:       'main-server',
    icon:     '🏢',
    title:    'السيرفر الرئيسي',
    subtitle: 'هذا الجهاز هو مصدر البيانات الأساسي للمؤسسة — يحتوي على قاعدة البيانات الرئيسية',
    tags:     ['DB رئيسية', 'مصدر المزامنة', 'نقطة مركزية'],
  },
  {
    id:       'branch-server',
    icon:     '🌿',
    title:    'سيرفر فرع',
    subtitle: 'هذا الجهاز يخدم فرعاً مستقلاً ويتزامن مع السيرفر الرئيسي',
    tags:     ['DB محلية للفرع', 'مزامنة دورية', 'يعمل أوفلاين'],
  },
  {
    id:       'client-workstation',
    icon:     '💻',
    title:    'محطة عمل (Client)',
    subtitle: 'هذا الجهاز يتصل بسيرفر موجود — لا توجد قاعدة بيانات محلية',
    tags:     ['بدون DB محلية', 'يتصل بالسيرفر', 'خفيف'],
  },
  {
    id:       'mobile-workstation',
    icon:     '📱',
    title:    'محطة عمل متنقلة',
    subtitle: 'جهاز محمول — يعمل أوفلاين ويتزامن عند الاتصال',
    tags:     ['محجوز للمستقبل'],
    future:   true,
  },
];

export default function Step07MachineRole() {
  const { machineRole, setMachineRole } = useInstallerStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* العنوان */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
          🖥️ دور هذا الجهاز
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          حدِّد دور هذا الجهاز في بنية OneSoft — سيؤثر على المزامنة وإدارة الفروع
        </p>
      </div>

      {/* البطاقات */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ROLES.map(r => {
          const selected = machineRole === r.id;
          return (
            <button
              key={r.id}
              onClick={() => !r.future && setMachineRole(r.id)}
              disabled={r.future}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
                background: selected ? '#EBF5FF' : r.future ? '#FAFAFA' : '#fff',
                border: `2px solid ${selected ? '#3B82F6' : r.future ? '#E5E7EB' : '#E5E0D8'}`,
                borderRadius: 12, cursor: r.future ? 'not-allowed' : 'pointer',
                textAlign: 'right', fontFamily: 'inherit', opacity: r.future ? 0.55 : 1,
                transition: 'all 0.15s', width: '100%',
              }}
            >
              <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{r.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700,
                  color: selected ? '#1D4ED8' : '#1E344F',
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3,
                }}>
                  {r.title}
                  {r.future && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                      background: '#F3F4F6', padding: '1px 7px', borderRadius: 10,
                    }}>
                      قريباً
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>{r.subtitle}</div>
                {/* Tags */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {r.tags.map(tag => (
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

      {/* ملاحظة توضيحية */}
      {machineRole === 'branch-server' && (
        <div style={{
          padding: '10px 14px', background: '#FFFBEB', borderRadius: 8, fontSize: 12,
          border: '1px solid #FCD34D', color: '#92400E',
        }}>
          ⚠️ ستحتاج لاحقاً إلى إدخال عنوان السيرفر الرئيسي لإتمام إعداد المزامنة
        </div>
      )}

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
