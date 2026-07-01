import { useInstallerStore } from '../store/installer.store';
import type { InstallMode, RunMode } from '../../core/types';

const INSTALL_MODES: Array<{ id: InstallMode; label: string; desc: string; icon: string; recommended?: boolean }> = [
  { id: 'single-user',    icon: '🖥️',  label: 'مستخدم واحد',          desc: 'جهاز واحد — مثالي للمكاتب الصغيرة',            recommended: true },
  { id: 'multi-user',     icon: '🏢',  label: 'متعدد المستخدمين',    desc: 'سيرفر مشترك في الشبكة المحلية (LAN)'            },
  { id: 'branch-server',  icon: '🌐',  label: 'سيرفر الفروع',         desc: 'سيرفر رئيسي مع فروع متعددة ومزامنة دورية'      },
  { id: 'hybrid-cloud',   icon: '☁️',  label: 'هجين (Hybrid)',         desc: 'عمل محلي مع نسخ احتياطي في السحابة'           },
  { id: 'cloud-only',     icon: '🚀',  label: 'سحابي كامل',           desc: 'كل شيء في السحابة — وصول عبر البراوزر فقط'     },
];

const RUN_MODES: Array<{ id: RunMode; label: string; desc: string }> = [
  { id: 'desktop+web', label: 'Desktop + Web (موصى به)', desc: 'تطبيق مكتبي + وصول عبر البراوزر' },
  { id: 'desktop',     label: 'Desktop فقط',             desc: 'تطبيق Electron مكتبي فقط'         },
  { id: 'web',         label: 'Web فقط',                 desc: 'وصول عبر البراوزر فقط'           },
];

export default function Step04InstallType() {
  const { installMode, setInstallMode, runMode, setRunMode, nextStep, prevStep } = useInstallerStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
          ⚙️ نوع التثبيت
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          اختر نمط التثبيت المناسب لبيئة عملك
        </p>
      </div>

      {/* Install Mode */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
          نوع البيئة
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {INSTALL_MODES.map(m => (
            <label key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              background: installMode === m.id ? '#EFF6FF' : '#fff',
              border: `2px solid ${installMode === m.id ? '#406B93' : '#E5E0D8'}`,
              borderRadius: 8, padding: '10px 14px', transition: 'all 0.15s',
            }}>
              <input type="radio" name="installMode" value={m.id}
                checked={installMode === m.id}
                onChange={() => setInstallMode(m.id)}
                style={{ accentColor: '#406B93' }}
              />
              <span style={{ fontSize: 20 }}>{m.icon}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, color: '#1E344F', fontSize: 13 }}>{m.label}</span>
                {m.recommended && (
                  <span style={{
                    marginRight: 8, fontSize: 10, background: '#406B93',
                    color: '#fff', padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                  }}>موصى به</span>
                )}
                <div style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>{m.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Run Mode */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
          وضع التشغيل
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {RUN_MODES.map(m => (
            <label key={m.id} style={{
              flex: 1, display: 'flex', flexDirection: 'column', gap: 4,
              cursor: 'pointer', textAlign: 'center',
              background: runMode === m.id ? '#EFF6FF' : '#fff',
              border: `2px solid ${runMode === m.id ? '#406B93' : '#E5E0D8'}`,
              borderRadius: 8, padding: '10px 8px', transition: 'all 0.15s',
            }}>
              <input type="radio" name="runMode" value={m.id}
                checked={runMode === m.id}
                onChange={() => setRunMode(m.id)}
                style={{ accentColor: '#406B93', margin: '0 auto' }}
              />
              <div style={{ fontWeight: 700, color: '#1E344F', fontSize: 12 }}>{m.label}</div>
              <div style={{ color: '#6B7280', fontSize: 10 }}>{m.desc}</div>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={prevStep} style={btnSecondary}>◀ السابق</button>
        <button onClick={nextStep} style={btnPrimary}>التالي ▶</button>
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #406B93, #2d5070)',
  color: '#fff', border: 'none', borderRadius: 8,
  padding: '10px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
};
const btnSecondary: React.CSSProperties = {
  background: '#fff', color: '#6B7280', border: '1px solid #D1D5DB',
  borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};
