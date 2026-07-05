import { useEffect, useState } from 'react';
import { trpc } from '@/shared/lib/trpc';
import { useLocation } from 'wouter';
import FirstRunWizard from '@/core/auth/FirstRunWizard';

export default function LoginPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [error, setError]   = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();

  const firstRunQ = trpc.setup.isFirstRun.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (firstRunQ.isError) {
      setError('تعذّر الاتصال بالخادم — يرجى تسجيل الدخول يدوياً');
      setStatus('error');
      return;
    }

    if (firstRunQ.data?.firstRun === true) {
      setShowWizard(true);
      setStatus('error');
      return;
    }

    if (firstRunQ.data?.firstRun === false) {
      // في وضع الإنتاج نعرض نموذج الدخول مباشرة بدون محاولة auto-login
      // (auto-login محجوب في production ويُظهر رسالة خطأ مربكة للمستخدم)
      setStatus('error');
    }
  }, [firstRunQ.data, firstRunQ.isError]);

  if (showWizard) {
    return (
      <FirstRunWizard
        onComplete={async () => {
          setShowWizard(false);
          await utils.auth.me.invalidate();
          navigate('/');
        }}
      />
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(145deg, #E8E0D4 0%, #D4CCC0 40%, #C8C0B4 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Cairo', Tahoma, sans-serif",
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 64, height: 64,
          background: 'linear-gradient(135deg, #406B93 0%, #2d5070 100%)',
          borderRadius: 18, marginBottom: 20,
          boxShadow: '0 8px 24px rgba(64,107,147,0.35)',
        }}>
          <span style={{ color: '#fff', fontSize: 26, fontWeight: 800 }}>O</span>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1E344F', margin: '0 0 6px' }}>
          One<span style={{ color: '#406B93' }}>Soft</span> ERP
        </h1>
        <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 28px' }}>نظام إدارة الأعمال المتكامل</p>

        {status === 'loading' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36,
              border: '3px solid rgba(64,107,147,0.2)',
              borderTopColor: '#406B93',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ color: '#6B7280', fontSize: 13 }}>جارٍ التحقق...</span>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255,255,255,0.85)',
            borderRadius: 12,
            padding: '20px 28px',
            border: '1px solid #D4CDC1',
            boxShadow: '0 4px 20px rgba(30,52,79,0.1)',
          }}>
            {error && (
              <div style={{ color: '#B91C1C', fontWeight: 600, marginBottom: 14 }}>
                ⚠️ {error}
              </div>
            )}
            <ManualLoginForm onSuccess={() => navigate('/')} utils={utils} />
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ManualLoginForm({ onSuccess, utils }: { onSuccess: (role: string) => void; utils: any }) {
  const [form, setForm]   = useState({ orgCode: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'خطأ في تسجيل الدخول');
      else { await utils.auth.me.invalidate(); onSuccess(data.user?.role); }
    } catch { setError('تعذر الاتصال بالخادم'); }
    finally { setLoading(false); }
  };

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: '#F7F4F0',
    border: '1px solid #C8C1B8', borderRadius: 8, padding: '9px 14px',
    fontSize: 13, color: '#1E344F', outline: 'none',
    fontFamily: "'Cairo', Tahoma, sans-serif",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 280 }}>
      {error && <div style={{ color: '#B91C1C', fontSize: 12, textAlign: 'center' }}>{error}</div>}
      <input style={inp} placeholder="كود المؤسسة (اختياري)" value={form.orgCode}
        onChange={e => setForm(f => ({ ...f, orgCode: e.target.value.toUpperCase() }))} />
      <input style={inp} placeholder="اسم المستخدم" required value={form.username}
        onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
      <input type="password" style={inp} placeholder="كلمة المرور" required value={form.password}
        onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
      <button type="submit" disabled={loading}
        style={{ background: 'linear-gradient(135deg,#406B93,#2d5070)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
        {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
      </button>
    </form>
  );
}
