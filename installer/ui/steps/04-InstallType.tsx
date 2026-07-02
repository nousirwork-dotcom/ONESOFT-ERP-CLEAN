import { useInstallerStore } from '../store/installer.store';
import type { DeploymentType } from '../../core/types';

// ── أنواع التثبيت — ما يُثبَّت على هذا الجهاز (اختيار واحد) ────────────────
const DEPLOYMENT_TYPES: Array<{
  id: DeploymentType;
  icon: string;
  label: string;
  desc: string;
  components: string;
  recommended?: boolean;
}> = [
  {
    id: 'server+client',
    icon: '🏢',
    label: 'سيرفر + عميل',
    desc: 'السيرفر والواجهة على نفس الجهاز — مناسب لـ LAN والمكاتب',
    components: 'DB + Backend + Frontend',
    recommended: true,
  },
  {
    id: 'server',
    icon: '🖥️',
    label: 'سيرفر رئيسي',
    desc: 'قاعدة البيانات والـ Backend فقط — العملاء يتصلون من الشبكة',
    components: 'DB + Backend',
  },
  {
    id: 'client',
    icon: '💻',
    label: 'عميل فقط',
    desc: 'يتصل بسيرفر موجود مسبقاً — لا تثبيت DB أو Backend محلي',
    components: 'Frontend فقط',
  },
  {
    id: 'branch',
    icon: '🌐',
    label: 'فرع',
    desc: 'DB + Backend محلي مع ربط بالسيرفر الرئيسي للمزامنة',
    components: 'DB + Backend + Frontend + Sync',
  },
  {
    id: 'cloud',
    icon: '☁️',
    label: 'سحابي',
    desc: 'بدون تثبيت محلي — وصول عبر الإنترنت فقط (مستقبلاً)',
    components: 'لا شيء محلياً',
  },
];

export default function Step04InstallType() {
  const { deploymentType, setDeploymentType } = useInstallerStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
          🏗️ نوع التثبيت
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          ما الذي سيُثبَّت على هذا الجهاز؟
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DEPLOYMENT_TYPES.map(t => {
          const selected = deploymentType === t.id;
          return (
            <label key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
              background: selected ? '#EFF6FF' : '#fff',
              border: `2px solid ${selected ? '#406B93' : '#E5E0D8'}`,
              borderRadius: 10, padding: '12px 16px',
              transition: 'all 0.15s',
              boxShadow: selected ? '0 0 0 3px rgba(64,107,147,0.1)' : 'none',
            }}>
              <input
                type="radio"
                name="deploymentType"
                value={t.id}
                checked={selected}
                onChange={() => setDeploymentType(t.id)}
                style={{ accentColor: '#406B93', width: 16, height: 16 }}
              />
              <span style={{ fontSize: 22 }}>{t.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, color: '#1E344F', fontSize: 14 }}>{t.label}</span>
                  {t.recommended && (
                    <span style={{
                      fontSize: 10, background: '#406B93', color: '#fff',
                      padding: '1px 8px', borderRadius: 10, fontWeight: 600,
                    }}>موصى به</span>
                  )}
                </div>
                <div style={{ color: '#6B7280', fontSize: 12 }}>{t.desc}</div>
                <div style={{
                  marginTop: 4, fontSize: 11, color: selected ? '#406B93' : '#9CA3AF',
                  fontWeight: 600, fontFamily: 'monospace',
                }}>
                  {t.components}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* تنبيه للـ cloud */}
      {deploymentType === 'cloud' && (
        <div style={{
          padding: '10px 14px', background: '#FFF7ED',
          border: '1px solid #FCD34D', borderRadius: 8,
          fontSize: 12, color: '#92400E',
        }}>
          ☁️ الوضع السحابي سيُتيح إعداد عنوان السيرفر السحابي في الخطوة التالية.
          لا يوجد تثبيت محلي في هذا الوضع.
        </div>
      )}

      {/* تنبيه للـ client */}
      {deploymentType === 'client' && (
        <div style={{
          padding: '10px 14px', background: '#F0FDF4',
          border: '1px solid #86EFAC', borderRadius: 8,
          fontSize: 12, color: '#14532D',
        }}>
          💡 ستحتاج إلى تحديد عنوان السيرفر الرئيسي في خطوة لاحقة.
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
  borderRadius: 8, padding: '10px 20px', fontSize: 13,
  cursor: 'pointer', fontFamily: 'inherit',
};
