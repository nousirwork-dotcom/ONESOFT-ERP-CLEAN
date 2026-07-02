import { useInstallerStore } from '../store/installer.store';

const LICENSE_TEXT = `اتفاقية ترخيص مستخدم OneSoft ERP

هذه الاتفاقية تحدد شروط استخدام برنامج OneSoft ERP.

1. منح الترخيص
   تمنح OneSoft للمستخدم المرخص ترخيصاً غير حصري لاستخدام البرنامج وفق الشروط المذكورة.

2. القيود
   - يُحظر نسخ البرنامج أو توزيعه بدون إذن خطي.
   - يُحظر إجراء هندسة عكسية أو تفكيك كود البرنامج.
   - يُحظر استخدام البرنامج لأغراض غير مشروعة.

3. الملكية الفكرية
   البرنامج وجميع مكوناته هي ملكية حصرية لشركة OneSoft.

4. إخلاء المسؤولية
   يُقدَّم البرنامج "كما هو" دون ضمان صريح أو ضمني.

5. المسؤولية المحدودة
   لا تتحمل OneSoft مسؤولية أي أضرار مباشرة أو غير مباشرة.

6. إنهاء الترخيص
   تنتهي هذه الاتفاقية تلقائياً عند انتهاك أي شرط من شروطها.

7. القانون المعمول به
   تخضع هذه الاتفاقية للقوانين المعمول بها في المملكة العربية السعودية.`;

export default function Step02License() {
  const { acceptedLicense, setAcceptedLicense } = useInstallerStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 6px' }}>
          📄 اتفاقية الترخيص
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          يرجى قراءة اتفاقية الترخيص قبل المتابعة
        </p>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', background: '#fff',
        border: '1px solid #E5E0D8', borderRadius: 10,
        padding: '16px 20px', fontSize: 12.5, color: '#374151',
        lineHeight: 2, whiteSpace: 'pre-wrap', maxHeight: 320,
      }}>
        {LICENSE_TEXT}
      </div>

      <label style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: acceptedLicense ? '#EFF6FF' : '#fff',
        border: `1px solid ${acceptedLicense ? '#93C5FD' : '#E5E0D8'}`,
        borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
        transition: 'all 0.2s',
      }}>
        <input
          type="checkbox"
          checked={acceptedLicense}
          onChange={e => setAcceptedLicense(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: '#406B93', cursor: 'pointer' }}
        />
        <div>
          <span style={{ fontWeight: 700, color: '#1E344F', fontSize: 13 }}>
            أوافق على جميع شروط الاتفاقية
          </span>
          <div style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>
            يجب الموافقة على الاتفاقية للمتابعة
          </div>
        </div>
      </label>

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
  borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};
