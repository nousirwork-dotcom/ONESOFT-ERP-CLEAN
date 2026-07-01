import { useInstallerStore } from '../store/installer.store';

export default function Step10Complete() {
  const { orgCode, firstUser, healthReport } = useInstallerStore();

  const open = (url: string) => window.installer?.openUrl?.(url);
  const close = () => window.installer?.close?.();

  const passed = healthReport?.passedCount ?? 0;
  const total  = healthReport?.totalCount ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, paddingTop: 10 }}>
      {/* Success Icon */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'linear-gradient(135deg, #16A34A, #15803D)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(22,163,74,0.35)',
      }}>
        <span style={{ fontSize: 40 }}>✅</span>
      </div>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1E344F', margin: '0 0 8px' }}>
          🎉 تم التثبيت بنجاح!
        </h1>
        <p style={{ color: '#6B7280', fontSize: 14, margin: 0 }}>
          OneSoft ERP جاهز للاستخدام — جميع الخدمات تعمل تلقائياً
        </p>
      </div>

      {/* Login Info */}
      <div style={{
        background: '#1E344F', borderRadius: 12, padding: '16px 24px',
        width: '100%', maxWidth: 420, color: '#fff',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#93C5FD' }}>
          🔑 بيانات الدخول
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'العنوان', value: 'http://localhost:5000' },
            { label: 'كود المؤسسة', value: orgCode ?? '1001' },
            { label: 'اسم المستخدم', value: firstUser.username || 'admin' },
            { label: 'كلمة المرور', value: '(التي اخترتها)' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#9CA3AF', fontSize: 12 }}>{row.label}:</span>
              <span style={{
                fontWeight: 700, fontSize: 13,
                background: 'rgba(255,255,255,0.1)', padding: '2px 10px', borderRadius: 6,
              }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Health Summary */}
      {total > 0 && (
        <div style={{
          background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10,
          padding: '10px 20px', fontSize: 13, color: '#15803D', fontWeight: 600,
          width: '100%', maxWidth: 420, textAlign: 'center',
        }}>
          🏥 فحص الصحة: {passed}/{total} مكون يعمل بكفاءة
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => open('http://localhost:5000')} style={{
          background: 'linear-gradient(135deg, #406B93, #2d5070)',
          color: '#fff', border: 'none', borderRadius: 10,
          padding: '12px 28px', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 4px 16px rgba(64,107,147,0.4)',
        }}>
          🚀 تشغيل OneSoft الآن
        </button>
        <button onClick={close} style={{
          background: '#fff', color: '#6B7280',
          border: '1px solid #D1D5DB', borderRadius: 10,
          padding: '12px 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          إغلاق المثبت
        </button>
      </div>

      <p style={{ color: '#9CA3AF', fontSize: 11, textAlign: 'center', maxWidth: 380 }}>
        النظام سيعمل تلقائياً في كل مرة تشغّل فيها الجهاز عبر خدمات Windows
      </p>
    </div>
  );
}
