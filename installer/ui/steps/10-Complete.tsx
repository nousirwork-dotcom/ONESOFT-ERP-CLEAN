import { useInstallerStore } from '../store/installer.store';

export default function Step10Complete() {
  const { orgCode, firstUser, healthReport } = useInstallerStore();

  const open  = (url: string) => window.installer?.openUrl?.(url);
  const close = () => window.installer?.close?.();

  const passed = healthReport?.passedCount ?? 0;
  const total  = healthReport?.totalCount ?? 0;

  const launchApp = () => {
    // فتح المتصفح على واجهة البرنامج
    open('http://localhost:5000');
    // إغلاق المثبت بعد ثانية
    setTimeout(() => close(), 1000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, paddingTop: 8 }}>

      {/* Success Icon */}
      <div style={{
        width: 84, height: 84, borderRadius: '50%',
        background: 'linear-gradient(135deg, #16A34A, #15803D)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(22,163,74,0.35)',
        animation: 'pop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <span style={{ fontSize: 42 }}>✅</span>
      </div>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1E344F', margin: '0 0 6px' }}>
          🎉 تم التثبيت بنجاح!
        </h1>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          OneSoft ERP جاهز للاستخدام — جميع الخدمات تعمل تلقائياً
        </p>
      </div>

      {/* Health Summary */}
      <div style={{
        background: passed === total ? '#F0FDF4' : '#FEF3C7',
        border: `1px solid ${passed === total ? '#BBF7D0' : '#FDE68A'}`,
        borderRadius: 10, padding: '10px 20px', fontSize: 13,
        color: passed === total ? '#15803D' : '#92400E',
      }}>
        {passed === total
          ? `✅ جميع فحوصات الصحة اجتازت (${passed}/${total})`
          : `⚠️ ${passed} من ${total} فحوصات اجتازت`}
      </div>

      {/* Login Info */}
      <div style={{
        background: '#1E344F', borderRadius: 12, padding: '16px 24px',
        width: '100%', maxWidth: 400, color: '#fff',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: '#93C5FD', letterSpacing: 1 }}>
          🔑 بيانات الدخول
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[
            { label: 'العنوان',        value: 'http://localhost:5000' },
            { label: 'كود المؤسسة',   value: orgCode ?? '1001' },
            { label: 'اسم المستخدم', value: firstUser.username || 'admin' },
            { label: 'كلمة المرور',  value: '(التي اخترتها في الخطوة 7)' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap' }}>{row.label}:</span>
              <span style={{
                color: '#F0F9FF', fontWeight: 700, fontSize: 12,
                background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '2px 8px',
                textAlign: 'left', direction: 'ltr', fontFamily: 'monospace',
              }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 400 }}>
        <button onClick={launchApp} style={{
          flex: 2, background: 'linear-gradient(135deg, #16A34A, #15803D)',
          color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px',
          fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
        }}>
          🚀 تشغيل البرنامج الآن
        </button>
        <button onClick={close} style={{
          flex: 1, background: '#fff', color: '#6B7280',
          border: '1px solid #D1D5DB', borderRadius: 10, padding: '12px 16px',
          fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          إغلاق
        </button>
      </div>

      {/* Footer notes */}
      <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', maxWidth: 380 }}>
        الخدمات تعمل تلقائياً مع Windows — لا تحتاج إعادة تشغيل يدوية.
        <br />
        لإدارة الخدمات: ابحث عن <strong>OneSoft ERP</strong> في قائمة Start.
      </div>

      <style>{`@keyframes pop { 0%{transform:scale(0.5);opacity:0} 100%{transform:scale(1);opacity:1} }`}</style>
    </div>
  );
}
