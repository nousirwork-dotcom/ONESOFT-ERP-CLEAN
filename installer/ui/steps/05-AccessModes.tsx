import { useInstallerStore } from '../store/installer.store';
import type { AccessMode, DeploymentType } from '../../core/types';

// ── طرق الاستخدام — كيف يصل المستخدمون للنظام (اختيار متعدد) ────────────────
const ACCESS_OPTIONS: Array<{
  id: AccessMode;
  icon: string;
  label: string;
  desc: string;
  detail: string;
  notAvailableFor?: DeploymentType[];
}> = [
  {
    id: 'desktop',
    icon: '🖥️',
    label: 'تطبيق مكتبي',
    desc: 'اختصار على سطح المكتب — يفتح النظام في نافذة مخصصة',
    detail: 'تطبيق Electron — لا يحتاج متصفحاً',
    notAvailableFor: ['cloud'],
  },
  {
    id: 'web',
    icon: '🌐',
    label: 'متصفح الإنترنت',
    desc: 'الوصول عبر Browser — من أي جهاز على الشبكة',
    detail: 'http://SERVER-IP:5000 — Chrome, Edge, Firefox',
  },
  {
    id: 'offline',
    icon: '📴',
    label: 'وضع أوفلاين',
    desc: 'العمل بدون إنترنت مع مزامنة تلقائية عند الاتصال',
    detail: 'يتطلب قاعدة بيانات محلية — مناسب للفروع',
    notAvailableFor: ['cloud', 'client'],
  },
];

// ── تحديد الخيارات المنطقية لكل نوع تثبيت ──────────────────────────────────
function isAvailable(opt: typeof ACCESS_OPTIONS[0], type: DeploymentType): boolean {
  return !opt.notAvailableFor?.includes(type);
}

// ── السيناريوهات الشائعة للمساعدة ──────────────────────────────────────────
const SCENARIOS: Array<{
  label: string;
  modes: AccessMode[];
  forTypes?: DeploymentType[];
}> = [
  { label: 'مكتب صغير (موصى به)', modes: ['desktop', 'web'] },
  { label: 'تطبيق مكتبي فقط',       modes: ['desktop'] },
  { label: 'متصفح فقط',              modes: ['web'] },
  { label: 'Desktop + Offline',       modes: ['desktop', 'offline'], forTypes: ['server+client', 'branch'] },
  { label: 'الكل',                    modes: ['desktop', 'web', 'offline'], forTypes: ['server+client', 'branch'] },
];

export default function Step05AccessModes() {
  const { deploymentType, accessModes, toggleAccessMode, setAccessModes, nextStep, prevStep } = useInstallerStore();

  const availableOptions = ACCESS_OPTIONS.filter(o => isAvailable(o, deploymentType));
  const applicableScenarios = SCENARIOS.filter(s => !s.forTypes || s.forTypes.includes(deploymentType));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
          🔑 طرق استخدام النظام
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          اختر كيف سيصل المستخدمون للنظام — يمكن اختيار أكثر من طريقة
        </p>
      </div>

      {/* الخيارات الرئيسية — Checkboxes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {availableOptions.map(opt => {
          const checked = accessModes.includes(opt.id);
          const isLast = accessModes.length === 1 && checked;

          return (
            <label key={opt.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14, cursor: isLast ? 'not-allowed' : 'pointer',
              background: checked ? '#EFF6FF' : '#fff',
              border: `2px solid ${checked ? '#406B93' : '#E5E0D8'}`,
              borderRadius: 10, padding: '14px 16px',
              transition: 'all 0.15s',
              boxShadow: checked ? '0 0 0 3px rgba(64,107,147,0.1)' : 'none',
              opacity: isLast ? 0.7 : 1,
            }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => { if (!isLast) toggleAccessMode(opt.id); }}
                disabled={isLast}
                style={{ accentColor: '#406B93', width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
              />
              <span style={{ fontSize: 24, flexShrink: 0 }}>{opt.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, color: '#1E344F', fontSize: 14 }}>{opt.label}</span>
                  {checked && (
                    <span style={{
                      fontSize: 10, background: '#DCF5E7', color: '#15803D',
                      padding: '1px 8px', borderRadius: 10, fontWeight: 600,
                    }}>مُفعَّل ✓</span>
                  )}
                  {isLast && (
                    <span style={{
                      fontSize: 10, background: '#FEF3C7', color: '#92400E',
                      padding: '1px 8px', borderRadius: 10, fontWeight: 600,
                    }}>يجب بقاء خيار واحد</span>
                  )}
                </div>
                <div style={{ color: '#374151', fontSize: 13, marginBottom: 2 }}>{opt.desc}</div>
                <div style={{ color: '#9CA3AF', fontSize: 11 }}>{opt.detail}</div>
              </div>
            </label>
          );
        })}
      </div>

      {/* سيناريوهات سريعة */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
          📋 سيناريوهات شائعة
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {applicableScenarios.map(s => {
            const active = s.modes.length === accessModes.length &&
              s.modes.every(m => accessModes.includes(m));
            return (
              <button
                key={s.label}
                onClick={() => setAccessModes(s.modes)}
                style={{
                  fontSize: 11, padding: '5px 12px', borderRadius: 20,
                  border: `1.5px solid ${active ? '#406B93' : '#D1D5DB'}`,
                  background: active ? '#EFF6FF' : '#fff',
                  color: active ? '#406B93' : '#6B7280',
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                  transition: 'all 0.15s',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ملخص الخيارات المحددة */}
      <div style={{
        padding: '12px 16px', background: '#F8FAFC',
        border: '1px solid #E2E8F0', borderRadius: 10,
        fontSize: 12, color: '#374151',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: '#1E344F' }}>
          📌 ملخص ما سيُثبَّت
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {accessModes.includes('desktop') && (
            <div>✅ <strong>تطبيق مكتبي:</strong> اختصار على سطح المكتب + Electron</div>
          )}
          {accessModes.includes('web') && (
            <div>✅ <strong>متصفح:</strong> خادم ويب على المنفذ 5000</div>
          )}
          {accessModes.includes('offline') && (
            <div>✅ <strong>أوفلاين:</strong> تخزين محلي + مزامنة تلقائية</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={prevStep} style={btnSecondary}>◀ السابق</button>
        <button onClick={nextStep} style={btnPrimary}>التالي — قاعدة البيانات ▶</button>
      </div>
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
