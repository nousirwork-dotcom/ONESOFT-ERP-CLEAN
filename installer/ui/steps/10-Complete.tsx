import { useInstallerStore } from '../store/installer.store';

export default function Step10Complete() {
  const { orgCode, firstUser, healthReport, installedPort } = useInstallerStore();
  const appUrl = `http://localhost:${installedPort}`;

  const open  = (url: string) => window.installer?.openUrl?.(url);
  const close = () => window.installer?.close?.();

  const passed = healthReport?.passedCount ?? 0;
  const total  = healthReport?.totalCount  ?? 0;

  const launchApp = () => {
    open(appUrl);
    setTimeout(() => close(), 800);
  };

  const openFolder = () => {
    // افتح مجلد التثبيت الافتراضي
    open('C:\\Program Files\\OneSoft ERP');
  };

  const openDocs = () => {
    open(`${appUrl}/help`);
  };

  const restartPC = () => {
    if (confirm('هل تريد إعادة تشغيل الجهاز الآن؟ احفظ عملك أولاً.')) {
      window.installer?.openUrl?.('shutdown /r /t 5 /c "إعادة تشغيل بعد تثبيت OneSoft ERP"');
    }
  };

  const noPassword = !firstUser.password;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, paddingTop: 8 }}>

      {/* Success Icon */}
      <div style={{
        width: 90, height: 90, borderRadius: '50%',
        background: 'linear-gradient(135deg, #16A34A, #15803D)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(22,163,74,0.35)',
        animation: 'pop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <span style={{ fontSize: 44 }}>✅</span>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1E344F', margin: '0 0 6px' }}>
          🎉 تم تثبيت OneSoft ERP بنجاح!
        </h1>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          جميع الخدمات مثبّتة وتعمل تلقائياً مع Windows
        </p>
      </div>

      {/* Health Summary */}
      <div style={{
        background: passed === total ? '#F0FDF4' : '#FEF3C7',
        border: `1px solid ${passed === total ? '#BBF7D0' : '#FDE68A'}`,
        borderRadius: 10, padding: '10px 20px', fontSize: 13,
        color: passed === total ? '#15803D' : '#92400E',
        width: '100%', maxWidth: 460, textAlign: 'center',
      }}>
        {passed === total
          ? `✅ جميع فحوصات الصحة اجتازت (${passed}/${total})`
          : `⚠️ ${passed} من ${total} فحوصات اجتازت — يمكنك المتابعة والمراجعة لاحقاً`}
      </div>

      {/* Login Info */}
      <div style={{
        background: '#1E344F', borderRadius: 12, padding: '18px 24px',
        width: '100%', maxWidth: 460, color: '#fff',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: '#93C5FD', letterSpacing: 1 }}>
          🔑 بيانات الدخول
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[
            { label: 'العنوان',        value: appUrl },
            { label: 'كود المؤسسة',   value: orgCode ?? '1001' },
            { label: 'اسم المستخدم', value: firstUser.username || 'admin' },
            { label: 'كلمة المرور',  value: noPassword ? '(بدون كلمة مرور)' : '(التي اخترتها)' },
          ].map(row => (
            <div key={row.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            }}>
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
        {noPassword && (
          <div style={{
            marginTop: 12, padding: '8px 10px',
            background: 'rgba(251,191,36,0.15)', borderRadius: 8,
            color: '#FDE68A', fontSize: 11,
          }}>
            ⚠️ لم تُعيَّن كلمة مرور — سيطلب منك النظام تعيينها عند أول تسجيل دخول.
          </div>
        )}
      </div>

      {/* Primary action */}
      <button onClick={launchApp} style={{
        width: '100%', maxWidth: 460,
        background: 'linear-gradient(135deg, #16A34A, #15803D)',
        color: '#fff', border: 'none', borderRadius: 12, padding: '14px 20px',
        fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: '0 4px 18px rgba(22,163,74,0.35)',
        transition: 'transform 0.1s',
      }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        🚀 تشغيل OneSoft ERP الآن
      </button>

      {/* Secondary actions */}
      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 460, flexWrap: 'wrap' }}>
        <button onClick={openFolder} style={secBtn('#406B93', '#fff')}>
          📁 فتح مجلد التثبيت
        </button>
        <button onClick={openDocs} style={secBtn('#059669', '#fff')}>
          📖 دليل المستخدم
        </button>
        <button onClick={restartPC} style={secBtn('#6B7280', '#fff')}>
          🔄 إعادة تشغيل الجهاز
        </button>
        <button onClick={close} style={{ ...secBtn('#fff', '#6B7280'), border: '1px solid #D1D5DB', flex: '0 0 auto', minWidth: 80 }}>
          إنهاء
        </button>
      </div>

      {/* Footer */}
      <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', maxWidth: 420 }}>
        الخدمات تعمل تلقائياً مع Windows — لا تحتاج إعادة تشغيل يدوية.
        <br />
        لإدارة الخدمات: ابحث عن <strong>OneSoft ERP</strong> في قائمة Start.
      </div>

      <style>{`@keyframes pop { 0%{transform:scale(0.5);opacity:0} 100%{transform:scale(1);opacity:1} }`}</style>
    </div>
  );
}

function secBtn(bg: string, color: string): React.CSSProperties {
  return {
    flex: 1, minWidth: 120,
    background: bg, color,
    border: 'none', borderRadius: 10, padding: '10px 14px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'Cairo', Tahoma, sans-serif",
    boxShadow: bg !== '#fff' ? `0 2px 8px rgba(0,0,0,0.15)` : 'none',
  };
}
