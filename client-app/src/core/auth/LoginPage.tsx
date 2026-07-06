import { useEffect, useState } from 'react';
import { trpc } from '@/shared/lib/trpc';
import { useLocation } from 'wouter';
import FirstRunWizard from '@/core/auth/FirstRunWizard';

export default function LoginPage() {
  const [phase, setPhase] = useState<'loading' | 'dbError' | 'login' | 'wizard'>('loading');
  const [retryKey, setRetryKey] = useState(0);
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();

  const firstRunQ = trpc.setup.isFirstRun.useQuery(undefined, {
    retry: 3,
    retryDelay: 2000,
    staleTime: 0,
  });

  const tryAutoLogin = async () => {
    try {
      const res = await fetch('/api/auth/auto-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        await utils.auth.me.invalidate();
        navigate('/');
        return true;
      }
    } catch { /* تجاهل — سيظهر شاشة الدخول العادية */ }
    return false;
  };

  useEffect(() => {
    if (firstRunQ.isLoading) { setPhase('loading'); return; }
    if (firstRunQ.isError)  { setPhase('dbError'); return; }
    const { firstRun, dbError } = firstRunQ.data ?? {};
    if (dbError) { setPhase('dbError'); return; }
    if (firstRun) { setPhase('wizard'); return; }
    tryAutoLogin().then(success => { if (!success) setPhase('login'); });
  }, [firstRunQ.isLoading, firstRunQ.isError, firstRunQ.data]);

  if (phase === 'wizard') {
    return (
      <FirstRunWizard
        onComplete={async () => {
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
        background: 'var(--brand-login-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Cairo', Tahoma, sans-serif",
        fontSize: 'var(--brand-font-size)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        {/* Logo */}
        <img
          src="/logo.png"
          alt="OneSoft ERP"
          style={{
            width: 88, height: 88, marginBottom: 20,
            borderRadius: 'var(--brand-border-radius)',
            boxShadow: '0 8px 28px rgba(var(--brand-primary-rgb) / 0.35)',
            objectFit: 'cover',
          }}
        />
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 6px' }}>
          One<span style={{ color: 'var(--primary)' }}>Soft</span> ERP
        </h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 13, margin: '0 0 28px' }}>
          نظام إدارة الأعمال المتكامل
        </p>

        {phase === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36,
              border: '3px solid rgba(var(--brand-primary-rgb) / 0.2)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>جارٍ الاتصال بالخادم...</span>
          </div>
        )}

        {phase === 'dbError' && (
          <div style={{
            background: 'var(--card)', borderRadius: 'var(--brand-border-radius)',
            padding: '24px 28px', border: '1px solid #FCA5A5',
            boxShadow: '0 4px 20px rgba(var(--brand-primary-rgb) / 0.1)', maxWidth: 340,
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
            <div style={{ color: '#B91C1C', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              تعذّر الاتصال بقاعدة البيانات
            </div>
            <div style={{ color: 'var(--muted-foreground)', fontSize: 12, marginBottom: 16, lineHeight: 1.6 }}>
              الخادم يعمل لكن لا يستطيع الاتصال بـ PostgreSQL.
              تأكد من أن الخدمة تعمل وأن ملف config.json صحيح.
            </div>
            <button
              onClick={() => { setPhase('loading'); firstRunQ.refetch(); }}
              style={{
                background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none',
                borderRadius: 'var(--brand-border-radius)', padding: '9px 20px', fontWeight: 700,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                marginBottom: 10, width: '100%',
              }}
            >
              🔄 إعادة المحاولة
            </button>
            <button
              onClick={() => setPhase('login')}
              style={{
                background: 'transparent', color: 'var(--muted-foreground)', border: '1px solid var(--border)',
                borderRadius: 'var(--brand-border-radius)', padding: '7px 20px', fontWeight: 600,
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', width: '100%',
              }}
            >
              تسجيل الدخول يدوياً
            </button>
          </div>
        )}

        {phase === 'login' && (
          <div style={{
            background: 'var(--card)', borderRadius: 'var(--brand-border-radius)',
            padding: '20px 28px', border: '1px solid var(--border)',
            boxShadow: '0 4px 20px rgba(var(--brand-primary-rgb) / 0.1)',
          }}>
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
    width: '100%', boxSizing: 'border-box', background: 'var(--background)',
    border: '1px solid var(--border)', borderRadius: 'var(--brand-border-radius)',
    padding: '9px 14px', fontSize: 13, color: 'var(--foreground)', outline: 'none',
    fontFamily: "'Cairo', Tahoma, sans-serif",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 280 }}>
      {error && <div style={{ color: '#B91C1C', fontSize: 12, textAlign: 'center' }}>{error}</div>}
      <input style={inp} placeholder="كود المؤسسة (اختياري)" value={form.orgCode}
        onChange={e => setForm(f => ({ ...f, orgCode: e.target.value.toUpperCase() }))} />
      <input style={inp} placeholder="اسم المستخدم" required value={form.username}
        onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
      <input type="password" style={inp} placeholder="كلمة المرور (اتركها فارغة إن لم تُعيَّن)" value={form.password}
        onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
      <button type="submit" disabled={loading}
        style={{
          background: 'var(--primary)', color: 'var(--primary-foreground)',
          border: 'none', borderRadius: 'var(--brand-border-radius)', padding: '10px 0',
          fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
        }}>
        {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
      </button>
    </form>
  );
}
