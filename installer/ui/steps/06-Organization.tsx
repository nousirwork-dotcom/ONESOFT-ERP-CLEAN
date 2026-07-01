import { useInstallerStore } from '../store/installer.store';

const CURRENCIES = ['SAR', 'USD', 'EUR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'EGP', 'JOD'];
const COUNTRIES = [
  { code: 'SA', name: 'المملكة العربية السعودية' },
  { code: 'AE', name: 'الإمارات العربية المتحدة' },
  { code: 'KW', name: 'الكويت' },
  { code: 'QA', name: 'قطر' },
  { code: 'BH', name: 'البحرين' },
  { code: 'OM', name: 'سلطنة عُمان' },
  { code: 'EG', name: 'مصر' },
  { code: 'JO', name: 'الأردن' },
];

export default function Step06Organization() {
  const { organization, setOrganization, nextStep, prevStep } = useInstallerStore();

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 12px',
    border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13,
    background: '#F9FAFB', color: '#1E344F', fontFamily: 'inherit', outline: 'none',
  };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' };

  const isValid = organization.name.trim().length >= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
          🏢 بيانات المؤسسة
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          أدخل بيانات مؤسستك — ستظهر في جميع المستندات والتقارير
        </p>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #E5E0D8', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>اسم المؤسسة (عربي) <span style={{ color: '#EF4444' }}>*</span></label>
            <input style={inp} value={organization.name}
              onChange={e => setOrganization({ name: e.target.value })}
              placeholder="شركة الأمل للتجارة" />
          </div>
          <div>
            <label style={lbl}>اسم المؤسسة (إنجليزي)</label>
            <input style={inp} value={organization.nameEn}
              onChange={e => setOrganization({ nameEn: e.target.value })}
              placeholder="Al-Amal Trading Co." />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>الدولة</label>
            <select style={inp} value={organization.country}
              onChange={e => setOrganization({ country: e.target.value })}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>العملة</label>
            <select style={inp} value={organization.currency}
              onChange={e => setOrganization({ currency: e.target.value })}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>كود المؤسسة</label>
            <input style={inp} value={organization.code}
              onChange={e => setOrganization({ code: e.target.value.toUpperCase() })}
              placeholder="1001" maxLength={10} />
          </div>
          <div>
            <label style={lbl}>الرقم الضريبي (اختياري)</label>
            <input style={inp} value={organization.taxNumber ?? ''}
              onChange={e => setOrganization({ taxNumber: e.target.value })}
              placeholder="300000000000003" />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={prevStep} style={btnSecondary}>◀ السابق</button>
        <button onClick={nextStep} disabled={!isValid} style={{
          ...btnPrimary, opacity: isValid ? 1 : 0.4,
          cursor: isValid ? 'pointer' : 'not-allowed',
        }}>
          التالي ▶
        </button>
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
