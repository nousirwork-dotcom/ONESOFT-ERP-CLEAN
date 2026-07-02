import { useInstallerStore } from '../store/installer.store';
import logoUrl from '../assets/logo.png';

export default function Step01Welcome() {
  const { nextStep } = useInstallerStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, paddingTop: 20 }}>

      {/* Logo */}
      <div style={{ position: 'relative', width: 96, height: 96 }}>
        <img
          src={logoUrl}
          alt="OneSoft ERP"
          style={{
            width: 96, height: 96, borderRadius: 24,
            objectFit: 'cover',
            boxShadow: '0 12px 32px rgba(64,107,147,0.35)',
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
            (e.currentTarget.nextSibling as HTMLElement).style.display = 'flex';
          }}
        />
        {/* Fallback — hidden when image loads */}
        <div style={{
          width: 96, height: 96, borderRadius: 24,
          background: 'linear-gradient(135deg, #406B93 0%, #2d5070 100%)',
          display: 'none', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 12px 32px rgba(64,107,147,0.35)',
          position: 'absolute', top: 0, left: 0,
        }}>
          <span style={{ color: '#fff', fontSize: 46, fontWeight: 900, lineHeight: 1 }}>O</span>
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1E344F', margin: '0 0 8px' }}>
          مرحباً بك في <span style={{ color: '#406B93' }}>OneSoft ERP</span>
        </h1>
        <p style={{ color: '#6B7280', fontSize: 14, margin: 0, lineHeight: 1.7 }}>
          سيرشدك هذا المعالج خلال خطوات تثبيت النظام وإعداده بالكامل تلقائياً.
          <br />
          لا تحتاج إلى أي خبرة تقنية — اتبع الخطوات وسيتولى النظام الباقي.
        </p>
      </div>

      {/* Features */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', maxWidth: 500 }}>
        {[
          { icon: '🔧', title: 'تثبيت تلقائي',   desc: 'تثبيت جميع المتطلبات تلقائياً' },
          { icon: '🏢', title: 'إعداد المؤسسة',   desc: 'إنشاء بيانات مؤسستك في دقائق' },
          { icon: '🛡️', title: 'آمن ومحمي',        desc: 'تشفير كامل للبيانات والكلمات المرور' },
          { icon: '⚡', title: 'خدمات تلقائية',   desc: 'يعمل تلقائياً مع تشغيل الجهاز' },
        ].map(f => (
          <div key={f.title} style={{
            background: '#fff', borderRadius: 10, padding: '12px 14px',
            border: '1px solid #E5E0D8', display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 20 }}>{f.icon}</span>
            <div>
              <div style={{ fontWeight: 700, color: '#1E344F', fontSize: 13 }}>{f.title}</div>
              <div style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={nextStep} style={{
        background: 'linear-gradient(135deg, #406B93, #2d5070)',
        color: '#fff', border: 'none', borderRadius: 10,
        padding: '12px 48px', fontSize: 15, fontWeight: 700,
        cursor: 'pointer', boxShadow: '0 4px 16px rgba(64,107,147,0.4)',
        fontFamily: 'inherit',
      }}>
        بدء التثبيت ◀
      </button>

      <p style={{ color: '#9CA3AF', fontSize: 11, margin: 0 }}>
        الإصدار 1.0.0 — OneSoft ERP
      </p>
    </div>
  );
}
